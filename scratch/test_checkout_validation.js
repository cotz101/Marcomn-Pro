// Simulation of validation logic in app/api/checkout/route.js
function validateCustomAmount(customAmount) {
  if (customAmount === undefined || customAmount === null) {
    return { valid: false, reason: "Missing customAmount" };
  }
  const customUsd = Number(customAmount);
  if (isNaN(customUsd)) {
    return { valid: false, reason: 'Invalid custom amount. Must be a valid number.' };
  }
  if (customUsd < 5) {
    return { valid: false, reason: 'Custom amount must be at least 5 USD.' };
  }
  if (customUsd > 10000) {
    return { valid: false, reason: 'Custom amount cannot exceed 10,000 USD.' };
  }
  if (Number(customUsd.toFixed(2)) !== customUsd) {
    return { valid: false, reason: 'Custom amount cannot have more than 2 decimal places.' };
  }
  return { valid: true, value: customUsd };
}

// Test cases
const testCases = [
  { input: 150.00, expectedValid: true },
  { input: 5.00, expectedValid: true },
  { input: 10000.00, expectedValid: true },
  { input: 4.99, expectedValid: false, expectedReason: 'Custom amount must be at least 5 USD.' },
  { input: 10000.01, expectedValid: false, expectedReason: 'Custom amount cannot exceed 10,000 USD.' },
  { input: -10, expectedValid: false, expectedReason: 'Custom amount must be at least 5 USD.' },
  { input: 0, expectedValid: false, expectedReason: 'Custom amount must be at least 5 USD.' },
  { input: 15.123, expectedValid: false, expectedReason: 'Custom amount cannot have more than 2 decimal places.' },
  { input: "invalid", expectedValid: false, expectedReason: 'Invalid custom amount. Must be a valid number.' },
  { input: null, expectedValid: false, expectedReason: 'Invalid custom amount. Must be a valid number.' },
  { input: undefined, expectedValid: false, expectedReason: 'Missing customAmount' },
];

console.log("Running Custom Amount Validation Tests...");
let failed = 0;
for (const tc of testCases) {
  const result = validateCustomAmount(tc.input);
  if (result.valid !== tc.expectedValid) {
    console.error(`FAIL: Input ${tc.input} expected valid=${tc.expectedValid}, got ${result.valid}`);
    failed++;
  } else if (!result.valid && result.reason !== tc.expectedReason) {
    console.error(`FAIL: Input ${tc.input} expected reason "${tc.expectedReason}", got "${result.reason}"`);
    failed++;
  } else {
    console.log(`PASS: Input ${tc.input} -> valid: ${result.valid}${!result.valid ? ` (Reason: ${result.reason})` : ''}`);
  }
}

if (failed === 0) {
  console.log("ALL TESTS PASSED SUCCESSFULLY!");
} else {
  console.error(`${failed} TESTS FAILED!`);
}
