import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createServiceClient } from '@/lib/supabase-server';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;

function generateReceiptNumber() {
  const date = new Date();
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const randomStr = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `MCR-${yyyy}${mm}${dd}-${randomStr}`;
}

export async function POST(req) {
  try {
    if (!stripe) {
      console.error('Stripe Webhook: Stripe SDK is not configured on this server.');
      return new NextResponse('Stripe webhook configuration error.', { status: 500 });
    }

    const body = await req.text();
    const signature = req.headers.get('stripe-signature');

    if (!signature) {
      return new NextResponse('Missing Stripe Signature', { status: 400 });
    }

    let event;
    try {
      event = stripe.webhooks.constructEvent(
        body,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.error('Stripe Webhook Signature Verification Failed:', err.message);
      return new NextResponse(`Webhook Error: ${err.message}`, { status: 400 });
    }

    // Crucial: Only credit wallet on checkout.session.completed event
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const { topupRequestId, ownerType, ownerId, requesterId, usdAmount, mcreditsAmount } = session.metadata || {};

      if (!topupRequestId || !ownerType || !ownerId || !requesterId || !mcreditsAmount) {
        console.error('Stripe Webhook: Missing required metadata in session:', session.id);
        return new NextResponse('Stripe Webhook Error: Missing required session metadata.', { status: 400 });
      }

      // Bypass RLS using the service role client
      const supabase = createServiceClient();

      // 1. Fetch top-up request
      const { data: request, error: fetchError } = await supabase
        .from('mcredit_topup_requests')
        .select('*')
        .eq('id', topupRequestId)
        .maybeSingle();

      if (fetchError || !request) {
        console.error('Stripe Webhook: Top-up request not found:', topupRequestId);
        return new NextResponse('Top-up request not found in database.', { status: 404 });
      }

      // 2. Idempotency Check: check if request is already approved
      if (request.status === 'Approved') {
        console.log('Stripe Webhook: Request already processed and approved:', topupRequestId);
        return NextResponse.json({ received: true, message: 'Request already processed' });
      }

      // 3. Resolve or create wallet for the owner
      const { data: walletId, error: walletError } = await supabase.rpc('get_or_create_wallet', {
        p_owner_type: ownerType,
        p_owner_id: ownerId,
      });

      if (walletError || !walletId) {
        console.error('Stripe Webhook: Failed to resolve wallet:', walletError);
        return new NextResponse('Failed to resolve wallet ID.', { status: 500 });
      }

      // 4. Adjust wallet balance (credits the wallet)
      // Enforces idempotency via DB unique index idx_unique_mcredit_transaction_ref (reference_type, reference_id)
      const { data: balanceAfter, error: creditError } = await supabase.rpc('adjust_wallet_balance', {
        p_wallet_id: walletId,
        p_amount: Number(mcreditsAmount),
        p_direction: 'credit',
        p_transaction_type: 'purchase_completed',
        p_justification_note: `Stripe Top-Up - USD ${usdAmount}`,
        p_created_by: requesterId,
        p_reference_type: 'stripe_checkout',
        p_reference_id: topupRequestId,
        p_override_insufficient: true,
      });

      if (creditError) {
        console.error('Stripe Webhook: Crediting failed:', creditError.message);
        return new NextResponse(`Database Wallet Credit Error: ${creditError.message}`, { status: 500 });
      }

      // 5. Query the transaction ID created by adjust_wallet_balance
      const { data: transactions, error: txError } = await supabase
        .from('mcredit_transactions')
        .select('id')
        .eq('reference_type', 'stripe_checkout')
        .eq('reference_id', topupRequestId)
        .order('created_at', { ascending: false })
        .limit(1);

      const transactionId = transactions && transactions.length > 0 ? transactions[0].id : null;

      // 6. Update top-up request
      // Store both identifiers: Stripe Checkout Session ID and Stripe Payment Intent ID (if available)
      const stripeSessionId = session.id;
      const stripePaymentIntentId = session.payment_intent || null;
      const serializedPaymentRef = `stripe_session_id: ${stripeSessionId}, stripe_payment_intent_id: ${stripePaymentIntentId || 'N/A'}, usd_amount: ${usdAmount}`;
      
      const adminNotesStr = `stripe_session_id: ${stripeSessionId}${stripePaymentIntentId ? `, stripe_payment_intent_id: ${stripePaymentIntentId}` : ''}`;

      const { error: updateError } = await supabase
        .from('mcredit_topup_requests')
        .update({
          status: 'Approved',
          approved_by: requesterId,
          approved_at: new Date().toISOString(),
          payment_reference: serializedPaymentRef,
          transaction_id: transactionId,
          admin_notes: adminNotesStr,
          updated_at: new Date().toISOString()
        })
        .eq('id', topupRequestId);

      if (updateError) {
        console.error('Stripe Webhook: Failed to update request:', updateError.message);
        return new NextResponse('Failed to update top-up request status.', { status: 500 });
      }

      // 7. Generate Receipt in mcredit_receipts
      let issuedToName = 'User';
      let issuedToEmail = null;
      let issuedToCompany = null;
      
      try {

        const { data: profile } = await supabase.from('profiles').select('name').eq('id', requesterId).maybeSingle();
        if (profile) issuedToName = profile.name;

        const { data: emailData } = await supabase.rpc('get_user_email', { user_id: requesterId });
        if (emailData) issuedToEmail = emailData;

        if (ownerType === 'company') {
          const { data: company } = await supabase.from('companies').select('name').eq('id', ownerId).maybeSingle();
          if (company) issuedToCompany = company.name;
        }

        const { error: receiptError } = await supabase.from('mcredit_receipts').insert({
          receipt_number: generateReceiptNumber(),
          owner_type: ownerType,
          owner_id: ownerId,
          wallet_id: walletId,
          topup_request_id: topupRequestId,
          transaction_id: transactionId,
          amount: Number(mcreditsAmount),
          payment_method: 'stripe',
          payment_reference: serializedPaymentRef,
          status: 'issued',
          issued_to_name: issuedToName,
          issued_to_email: issuedToEmail,
          issued_to_company_name: issuedToCompany,
          issued_at: new Date().toISOString()
        });

        if (receiptError) {
          console.error('Stripe Webhook: Failed to insert receipt:', receiptError.message);
        }
      } catch (receiptErr) {
        console.error('Stripe Webhook: Receipt creation error:', receiptErr);
      }

      // 8. Create Notifications
      try {
        // Fetch admins to alert
        const { data: adminProfiles } = await supabase
          .from('profiles')
          .select('id')
          .in('global_role', ['super_admin', 'admin', 'brand_manager']);

        // User Notification
        await supabase.from('notifications').insert({
          recipient_id: requesterId,
          sender_id: null,
          title: 'Top-Up Success',
          body: 'Your Stripe payment was successfully processed and your wallet has been credited.',
          type: 'wallet_credit',
          link: ownerType === 'company' ? '/company/wallet' : '/profile/wallet',
          is_read: false
        });

        // Admin Notification
        if (adminProfiles && adminProfiles.length > 0) {
          const adminNotifications = adminProfiles.map(admin => ({
            recipient_id: admin.id,
            sender_id: null,
            title: 'Stripe Payment Received',
            body: `Stripe payment completed: USD ${usdAmount} (${mcreditsAmount} MC) credited to ${ownerType} wallet. Requester: ${issuedToName} (ID: ${requesterId}). Reference: ${stripeSessionId}.`,
            type: 'wallet_topup',
            link: '/admin/finance',
            is_read: false
          }));
          await supabase.from('notifications').insert(adminNotifications);
        }
      } catch (notifErr) {
        console.error('Stripe Webhook: Notification creation error:', notifErr);
      }
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error('Stripe Webhook Server Error:', err);
    return new NextResponse(`Server Error: ${err.message}`, { status: 500 });
  }
}
