'use server';

import { createClient } from '@/lib/supabase-server';
import { userHasAdminPermission } from '@/lib/adminPermissions';
import { logPlatformAdminAction } from '@/lib/adminAuditLogger';
import * as service from '@/lib/services/mcreditService';

export async function getUserWallet(userId) {
  return await service.getOrCreateUserWallet(userId);
}

export async function getCompanyWallet(companyId) {
  return await service.getOrCreateCompanyWallet(companyId);
}

export async function grantCredits(walletId, amount, justification, adminUserId) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');
  
  const hasPermission = await userHasAdminPermission(user.id, 'can_grant_mcredits');
  if (!hasPermission) throw new Error('Unauthorized: Missing grant permission');

  const res = await service.adminGrantCredits(walletId, amount, justification, user.id);
  
  await logPlatformAdminAction({
    actorUserId: user.id,
    actionKey: 'mcredits.grant',
    targetType: 'wallet',
    targetId: walletId,
    details: { amount, justification, result: res }
  });

  return res;
}

export async function deductCredits(walletId, amount, justification, adminUserId) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const hasPermission = await userHasAdminPermission(user.id, 'can_deduct_mcredits');
  if (!hasPermission) throw new Error('Unauthorized: Missing deduct permission');

  const res = await service.adminDeductCredits(walletId, amount, justification, user.id);

  await logPlatformAdminAction({
    actorUserId: user.id,
    actionKey: 'mcredits.deduct',
    targetType: 'wallet',
    targetId: walletId,
    details: { amount, justification, result: res }
  });

  return res;
}

