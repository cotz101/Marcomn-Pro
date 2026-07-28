/**
 * Shared utility for calculating Advance Ledger and Financial Summary.
 * Used by both Applicant (my-applications) and Company (applicants) pages.
 */
export function calculateAdvanceLedger(job, requests = []) {
  const salary = Number(job?.salary_numeric || 0);

  // Calculate maximum advance eligible cap
  let maxEligible = 0;
  if (job?.advance_payment_type === 'percentage') {
    maxEligible = (salary * Number(job.advance_payment_value || 0)) / 100;
  } else {
    maxEligible = Number(job?.advance_payment_value || 0);
  }
  if (job?.advance_payment_max !== null && job?.advance_payment_max !== undefined) {
    maxEligible = Math.min(maxEligible, Number(job.advance_payment_max));
  }

  let totalRequested = 0;
  let totalApproved = 0;
  let totalTransferred = 0;
  let totalConfirmed = 0;
  let totalActive = 0; // Sum of active requests for remaining eligibility limit

  for (const r of requests) {
    // Ignore: Rejected, Cancelled, Expired, Review Closed
    const isIgnored = ['rejected', 'cancelled', 'expired', 'review_closed'].includes(r.status);
    if (isIgnored) continue;

    const amount = Number(r.counter_amount !== null && r.counter_amount !== undefined ? r.counter_amount : r.requested_amount || 0);

    // Requested: sum of requested amount of all non-ignored requests
    totalRequested += Number(r.requested_amount || 0);

    // Approved: status is approved, transfer_recorded, confirmed, or disputed
    if (['approved', 'transfer_recorded', 'confirmed', 'disputed'].includes(r.status)) {
      totalApproved += amount;
    }

    // Transferred: status is transfer_recorded, confirmed, or disputed
    if (['transfer_recorded', 'confirmed', 'disputed'].includes(r.status)) {
      totalTransferred += amount;
    }

    // Confirmed: status is confirmed
    if (r.status === 'confirmed') {
      totalConfirmed += amount;
    }

    // Active (contributes to cap reduction)
    totalActive += amount;
  }

  const remainingEligibility = Math.max(0, maxEligible - totalConfirmed - (totalActive - totalConfirmed));
  const remainingSalary = Math.max(0, salary - totalConfirmed);

  return {
    contractValue: salary,
    maxEligible,
    totalRequested,
    totalApproved,
    totalTransferred,
    totalConfirmed,
    remainingEligibility,
    remainingSalary
  };
}
