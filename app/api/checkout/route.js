import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@/lib/supabase-server';

// Ensure Stripe is configured
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;

const ALLOWED_PACKAGES = [10, 25, 50, 100, 250, 500];

export async function POST(req) {
  try {
    if (!stripe) {
      console.error('Checkout API: Stripe Secret Key is missing.');
      return new NextResponse('Stripe integration is not configured on this server.', { status: 500 });
    }

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { ownerType, ownerId, packageAmount } = await req.json();

    // 1. Validate package amount
    const usdAmount = Number(packageAmount);
    if (!ALLOWED_PACKAGES.includes(usdAmount)) {
      return new NextResponse('Invalid package amount. Must be one of 10, 25, 50, 100, 250, or 500 USD.', { status: 400 });
    }

    // 2. Validate ownership & permission
    if (ownerType === 'user' && ownerId !== user.id) {
      return new NextResponse('Unauthorized access to user wallet.', { status: 403 });
    }

    if (ownerType === 'company') {
      const { data: member, error: memberError } = await supabase
        .from('company_members')
        .select('id')
        .eq('company_id', ownerId)
        .eq('profile_id', user.id)
        .maybeSingle();
        
      if (memberError || !member) {
        return new NextResponse('Unauthorized access to company wallet.', { status: 403 });
      }
    }

    // 3. Fetch exchange rate (cost of 1 MCredit in USD)
    const { data: setting } = await supabase
      .from('platform_settings')
      .select('value')
      .eq('key', 'mcredits_per_usd')
      .maybeSingle();

    const rate = setting ? Number(setting.value) : 1.0;
    const mcreditsAmount = usdAmount * rate;

    // 4. Create Pending top-up request
    const { data: request, error: requestError } = await supabase
      .from('mcredit_topup_requests')
      .insert({
        requester_id: user.id,
        owner_type: ownerType,
        owner_id: ownerId,
        amount: mcreditsAmount,
        status: 'Pending',
        payment_method: 'stripe',
        remarks: `Stripe Checkout: USD ${usdAmount} package`,
      })
      .select()
      .single();

    if (requestError || !request) {
      console.error('Checkout API: Failed to create database top-up request:', requestError);
      return new NextResponse(`Database Error: ${requestError?.message || 'Failed to create request'}`, { status: 500 });
    }

    // 5. Create Stripe Checkout Session
    const origin = req.headers.get('origin') || 'http://localhost:3000';
    const environment = process.env.NODE_ENV || 'development';

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `MCredits Top-Up Package`,
              description: `Purchase of ${mcreditsAmount.toFixed(2)} MCredits (Package: USD ${usdAmount})`,
            },
            unit_amount: usdAmount * 100, // unit amount in cents
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${origin}/${ownerType === 'company' ? 'company' : 'profile'}/wallet?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/${ownerType === 'company' ? 'company' : 'profile'}/wallet?cancelled=true`,
      metadata: {
        topupRequestId: request.id,
        ownerType,
        ownerId,
        requesterId: user.id,
        usdAmount: usdAmount.toString(),
        mcreditsAmount: mcreditsAmount.toString(),
        exchangeRate: rate.toString(),
        environment,
      },
    });

    // 6. Save Stripe Session ID in payment_reference
    const { error: updateError } = await supabase
      .from('mcredit_topup_requests')
      .update({ payment_reference: session.id })
      .eq('id', request.id);

    if (updateError) {
      console.error('Checkout API: Failed to update payment_reference:', updateError);
    }

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error('Checkout API Error:', err);
    return new NextResponse(`Server Error: ${err.message}`, { status: 500 });
  }
}
