import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// Read env variables
const env = fs.readFileSync('.env.local', 'utf-8');
let supabaseUrl = '';
let supabaseKey = '';
env.split('\n').forEach(line => {
  if (line.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) supabaseUrl = line.split('=')[1].trim();
  if (line.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) supabaseKey = line.split('=')[1].trim();
});

const supabase = createClient(supabaseUrl, supabaseKey);

async function simulateCheckout(payload) {
  const { packageId, packageAmount, customAmount } = payload;
  
  let packageInfo = null;

  if (customAmount !== undefined && customAmount !== null) {
    const customUsd = Number(customAmount);
    if (isNaN(customUsd)) {
      return { status: 400, body: 'Invalid custom amount. Must be a valid number.' };
    }
    if (customUsd < 5) {
      return { status: 400, body: 'Custom amount must be at least 5 USD.' };
    }
    if (customUsd > 10000) {
      return { status: 400, body: 'Custom amount cannot exceed 10,000 USD.' };
    }
    if (Number(customUsd.toFixed(2)) !== customUsd) {
      return { status: 400, body: 'Custom amount cannot have more than 2 decimal places.' };
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
    return { status: 400, body: 'Invalid or inactive package selected.' };
  }

  const usdAmount = packageInfo.usdPrice;
  const mcreditsAmount = packageInfo.mcreditAmount;
  const rate = usdAmount > 0 ? (mcreditsAmount / usdAmount) : 1.0;

  return {
    status: 200,
    body: {
      packageId: packageInfo.id,
      usdAmount,
      mcreditsAmount,
      rate,
      stripeCents: Math.round(usdAmount * 100)
    }
  };
}

async function run() {
  console.log("Simulating checkout payloads against DB settings...");

  const tests = [
    // 1. Predefined active packages by ID
    { name: "Preset package pkg_10 by ID", payload: { packageId: 'pkg_10' }, expectStatus: 200, expectCredits: 10 },
    { name: "Preset package pkg_250 by ID", payload: { packageId: 'pkg_250' }, expectStatus: 200, expectCredits: 250 },
    
    // 2. Predefined packages by Amount (compatibility fallback)
    { name: "Preset package 50 by Amount", payload: { packageAmount: 50 }, expectStatus: 200, expectCredits: 50 },
    
    // 3. Invalid package ID
    { name: "Invalid package ID", payload: { packageId: 'pkg_invalid' }, expectStatus: 400 },
    
    // 4. Custom amounts
    { name: "Custom amount 150.00 USD", payload: { customAmount: 150 }, expectStatus: 200, expectCredits: 150, expectCents: 15000 },
    { name: "Custom amount 5.00 USD", payload: { customAmount: 5 }, expectStatus: 200, expectCredits: 5, expectCents: 500 },
    { name: "Custom amount 10000.00 USD", payload: { customAmount: 10000 }, expectStatus: 200, expectCredits: 10000, expectCents: 1000000 },
    
    // 5. Custom amount validations
    { name: "Custom amount under minimum (4.99)", payload: { customAmount: 4.99 }, expectStatus: 400 },
    { name: "Custom amount over maximum (10000.01)", payload: { customAmount: 10000.01 }, expectStatus: 400 },
    { name: "Custom amount negative (-5)", payload: { customAmount: -5 }, expectStatus: 400 },
    { name: "Custom amount zero (0)", payload: { customAmount: 0 }, expectStatus: 400 },
    { name: "Custom amount too many decimals (5.123)", payload: { customAmount: 5.123 }, expectStatus: 400 },
    { name: "Custom amount invalid string", payload: { customAmount: "abc" }, expectStatus: 400 },
  ];

  let failed = 0;
  for (const t of tests) {
    const res = await simulateCheckout(t.payload);
    if (res.status !== t.expectStatus) {
      console.error(`FAIL: "${t.name}" -> Expected status ${t.expectStatus}, got ${res.status} (${JSON.stringify(res.body)})`);
      failed++;
    } else if (res.status === 200) {
      if (t.expectCredits && res.body.mcreditsAmount !== t.expectCredits) {
        console.error(`FAIL: "${t.name}" -> Expected ${t.expectCredits} MCredits, got ${res.body.mcreditsAmount}`);
        failed++;
      } else if (t.expectCents && res.body.stripeCents !== t.expectCents) {
        console.error(`FAIL: "${t.name}" -> Expected ${t.expectCents} Stripe Cents, got ${res.body.stripeCents}`);
        failed++;
      } else {
        console.log(`PASS: "${t.name}" -> Successfully simulated: ${res.body.mcreditsAmount} MC (${res.body.usdAmount} USD, cents: ${res.body.stripeCents})`);
      }
    } else {
      console.log(`PASS: "${t.name}" -> Successfully rejected with status 400: ${res.body}`);
    }
  }

  if (failed === 0) {
    console.log("\nALL SIMULATION TESTS PASSED SUCCESSFULLY!");
  } else {
    console.error(`\n${failed} SIMULATION TESTS FAILED!`);
  }
}

run();
