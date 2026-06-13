import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@/lib/supabase-server';

// Ensure Stripe is configured
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;

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

    const { ownerType, ownerId, packageId, packageAmount, customAmount } = await req.json();

    // 1. Validate package amount/ID or custom amount against platform settings configuration
    let packageInfo = null;

    if (customAmount !== undefined && customAmount !== null) {
      const customUsd = Number(customAmount);
      if (isNaN(customUsd)) {
        return new NextResponse('Invalid custom amount. Must be a valid number.', { status: 400 });
      }
      if (customUsd < 5) {
        return new NextResponse('Custom amount must be at least 5 USD.', { status: 400 });
      }
      if (customUsd > 10000) {
        return new NextResponse('Custom amount cannot exceed 10,000 USD.', { status: 400 });
      }
      if (Number(customUsd.toFixed(2)) !== customUsd) {
        return new NextResponse('Custom amount cannot have more than 2 decimal places.', { status: 400 });
      }

      // Fetch exchange rate to compute custom mcredits amount
      const { data: rateSetting } = await supabase
        .from('platform_settings')
        .select('value')
        .eq('key', 'mcredits_per_usd')
        .maybeSingle();
        
      const rateVal = rateSetting ? Number(rateSetting.value) : 1.0;
      packageInfo = {
        id: 'stripe_custom',
        usdPrice: customUsd,
        mcreditAmount: customUsd * rateVal,
        isActive: true
      };
    } else {
      const { data: packagesSetting } = await supabase
        .from('platform_settings')
        .select('value')
        .eq('key', 'mcredit_topup_packages')
        .maybeSingle();

      if (packagesSetting) {
        try {
          const parsed = JSON.parse(packagesSetting.value);
          if (Array.isArray(parsed) && parsed.length > 0) {
            if (packageId) {
              packageInfo = parsed.find(pkg => pkg.id === packageId && pkg.isActive);
            } else if (packageAmount) {
              const usdAmountVal = Number(packageAmount);
              packageInfo = parsed.find(pkg => pkg.usdPrice === usdAmountVal && pkg.isActive);
            }
          }
        } catch (e) {
          console.error('Checkout API: Failed to parse stripe packages from settings:', e);
        }
      }

      // Fallback if no packageInfo found (settings missing or invalid)
      if (!packageInfo) {
        const fallbackDefaults = [10, 25, 50, 100, 250, 500];
        const usdAmountVal = Number(packageAmount);
        
        if (fallbackDefaults.includes(usdAmountVal)) {
          const { data: rateSetting } = await supabase
            .from('platform_settings')
            .select('value')
            .eq('key', 'mcredits_per_usd')
            .maybeSingle();
            
          const rateVal = rateSetting ? Number(rateSetting.value) : 1.0;
          packageInfo = {
            id: `pkg_${usdAmountVal}`,
            usdPrice: usdAmountVal,
            mcreditAmount: usdAmountVal * rateVal,
            isActive: true
          };
        }
      }
    }

    if (!packageInfo || !packageInfo.isActive || packageInfo.usdPrice <= 0 || packageInfo.mcreditAmount <= 0) {
      return new NextResponse('Invalid or inactive package selected.', { status: 400 });
    }

    const usdAmount = packageInfo.usdPrice;
    const mcreditsAmount = packageInfo.mcreditAmount;
    const rate = usdAmount > 0 ? (mcreditsAmount / usdAmount) : 1.0;

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
        remarks: packageInfo.id === 'stripe_custom'
          ? `Stripe Checkout: USD ${usdAmount} custom amount`
          : `Stripe Checkout: USD ${usdAmount} package`,
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
              name: `MCredits Top-Up`,
              description: packageInfo.id === 'stripe_custom'
                ? `Purchase of ${mcreditsAmount.toFixed(2)} MCredits (Custom: USD ${usdAmount})`
                : `Purchase of ${mcreditsAmount.toFixed(2)} MCredits (Package: USD ${usdAmount})`,
            },
            unit_amount: Math.round(usdAmount * 100), // unit amount in cents
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${origin}/${ownerType === 'company' ? 'company' : 'profile'}/wallet?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/${ownerType === 'company' ? 'company' : 'profile'}/wallet?cancelled=true&session_id={CHECKOUT_SESSION_ID}`,
      metadata: {
        topupRequestId: request.id,
        ownerType,
        ownerId,
        requesterId: user.id,
        usdAmount: usdAmount.toString(),
        mcreditsAmount: mcreditsAmount.toString(),
        exchangeRate: rate.toString(),
        topupType: packageInfo.id === 'stripe_custom' ? 'stripe_custom' : 'stripe_package',
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
