/**
 * Helper utility for parsing and formatting job compensation.
 * Supports legacy formats and the new rate quantity / contract value structure.
 */
export function formatCompensation(job) {
  if (!job) {
    return {
      currency: 'USD',
      rateAmount: 0,
      rateType: 'Hour',
      quantity: null,
      contractValue: 0,
      displayRate: 'Competitive',
      displayContract: 'Competitive'
    };
  }

  let currency = 'USD';
  let rateAmount = 0;
  let rateType = 'Hour';

  // Parse salary_range (e.g., "USD 25/Hour" or "USD 5000/Lump Sum")
  if (job.salary_range) {
    const parts = job.salary_range.split(' ');
    if (parts.length >= 2) {
      currency = parts[0];
      const rateParts = parts[1].split('/');
      rateAmount = Number(rateParts[0]) || 0;
      rateType = rateParts[1] || 'Hour';
    } else {
      const rateParts = job.salary_range.split('/');
      rateAmount = Number(rateParts[0]) || 0;
      rateType = rateParts[1] || 'Hour';
    }
  } else {
    rateAmount = Number(job.salary_numeric || 0);
  }

  const quantity = job.pay_rate_quantity;
  const contractValue = Number(job.salary_numeric || 0);

  let displayRate = '';
  const displayContract = `${currency} ${contractValue.toLocaleString()}`;

  if (rateType === 'Lump Sum') {
    displayRate = `${currency} ${rateAmount.toLocaleString()} Lump Sum`;
  } else {
    if (quantity && quantity > 0) {
      const typePlural = rateType + (quantity === 1 ? '' : 's');
      displayRate = `${currency} ${rateAmount.toLocaleString()} / ${rateType} × ${quantity} ${typePlural}`;
    } else {
      displayRate = `${currency} ${rateAmount.toLocaleString()} / ${rateType}`;
    }
  }

  return {
    currency,
    rateAmount,
    rateType,
    quantity,
    contractValue,
    displayRate,
    displayContract
  };
}
