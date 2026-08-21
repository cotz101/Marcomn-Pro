import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase-server';

const EXPIRY_SECONDS = 60;

function storedProof(value, requestId) {
  if (typeof value !== 'string') return null;
  if (value.startsWith('private://advance-proofs/')) return { bucket: 'advance-proofs', path: value.slice('private://advance-proofs/'.length) };
  const marker = '/storage/v1/object/public/resumes/';
  const index = value.indexOf(marker);
  if (index < 0) return null;
  const path = value.slice(index + marker.length).split(/[?#]/, 1)[0];
  return path.startsWith(`advance_proofs/${requestId}_`) ? { bucket: 'resumes', path } : null;
}

export async function GET(request) {
  const requestId = new URL(request.url).searchParams.get('requestId');
  if (!requestId) return NextResponse.json({ error: 'Invalid proof request.' }, { status: 400 });
  const userClient = await createClient();
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  const service = createServiceClient();
  const { data: proof, error } = await service.from('job_advance_requests').select('id,applicant_id,proof_url,jobs!inner(poster_id,company_id)').eq('id', requestId).maybeSingle();
  if (error || !proof) return NextResponse.json({ error: 'Proof unavailable.' }, { status: 404 });
  const job = Array.isArray(proof.jobs) ? proof.jobs[0] : proof.jobs;
  const { data: permission } = await service
    .from('platform_admin_user_roles')
    .select('id, platform_admin_roles!inner(platform_admin_role_permissions!inner(platform_admin_permissions!inner(permission_key)))')
    .eq('user_id', user.id).eq('is_active', true)
    .eq('platform_admin_roles.platform_admin_role_permissions.platform_admin_permissions.permission_key', 'can_view_finance_reports')
    .maybeSingle();
  const financeReader = Boolean(permission);
  if (proof.applicant_id !== user.id && job?.poster_id !== user.id && !financeReader) return NextResponse.json({ error: 'Not authorized.' }, { status: 403 });
  const object = storedProof(proof.proof_url, requestId);
  if (!object) return NextResponse.json({ error: 'Proof unavailable.' }, { status: 404 });
  const { data, error: signError } = await service.storage.from(object.bucket).createSignedUrl(object.path, EXPIRY_SECONDS, { download: 'payment-proof' });
  if (signError) return NextResponse.json({ error: 'Unable to authorize proof.' }, { status: 500 });
  return NextResponse.redirect(data.signedUrl);
}
