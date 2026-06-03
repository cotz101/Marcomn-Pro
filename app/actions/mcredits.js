'use server'

import * as service from '@/lib/services/mcreditService';

export async function getUserWallet(userId) {
  return await service.getOrCreateUserWallet(userId);
}

export async function getCompanyWallet(companyId) {
  return await service.getOrCreateCompanyWallet(companyId);
}

export async function grantCredits(walletId, amount, justification, adminUserId) {
  return await service.adminGrantCredits(walletId, amount, justification, adminUserId);
}

export async function deductCredits(walletId, amount, justification, adminUserId) {
  return await service.adminDeductCredits(walletId, amount, justification, adminUserId);
}
