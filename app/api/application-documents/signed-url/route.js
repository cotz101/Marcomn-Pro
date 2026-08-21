import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase-server';

const BUCKET = 'resumes';
const EXPIRY_SECONDS = 60;

function legacyPathFromUrl(value) {
  if (typeof value !== 'string') return null;
  const marker = '/storage/v1/object/public/resumes/';
  const index = value.indexOf(marker);
  if (index < 0) return null;
  const path = value.slice(index + marker.length).split(/[?#]/, 1)[0];
  try { return decodeURIComponent(path); } catch { return null; }
}

function documentPath(document) {
  if (typeof document?.path === 'string') return document.path;
  return legacyPathFromUrl(document?.url);
}

function isSafeApplicantPath(path, applicantId) {
  return path.startsWith(`${applicantId}/`) || path.startsWith(`${applicantId}-`);
}

export async function POST(request) {
  const { applicationId, documentIndex } = await request.json().catch(() => ({}));
  if (typeof applicationId !== 'string' || !Number.isInteger(documentIndex) || documentIndex < 0) {
    return NextResponse.json({ error: 'Invalid document request.' }, { status: 400 });
  }

  const userClient = await createClient();
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

  const service = createServiceClient();
  const { data: application, error } = await service
    .from('applications')
    .select('id, applicant_id, job_id, documents, jobs!inner(id, poster_id, company_id)')
    .eq('id', applicationId)
    .maybeSingle();
  if (error || !application) return NextResponse.json({ error: 'Document unavailable.' }, { status: 404 });

  const job = Array.isArray(application.jobs) ? application.jobs[0] : application.jobs;
  let authorized = application.applicant_id === user.id || job?.poster_id === user.id;
  if (!authorized && job?.company_id) {
    const { data: membership } = await service
      .from('company_members')
      .select('id')
      .eq('company_id', job.company_id)
      .eq('profile_id', user.id)
      .in('role', ['Owner', 'Admin'])
      .maybeSingle();
    authorized = Boolean(membership);
  }
  if (!authorized) return NextResponse.json({ error: 'Not authorized to access this document.' }, { status: 403 });

  const document = Array.isArray(application.documents) ? application.documents[documentIndex] : null;
  const path = documentPath(document);
  if (!path || !isSafeApplicantPath(path, application.applicant_id)) {
    return NextResponse.json({ error: 'Document unavailable.' }, { status: 404 });
  }

  const safeFilename = String(document?.name || 'document').replace(/[^a-zA-Z0-9._ -]/g, '_').slice(0, 180) || 'document';
  const { data, error: signError } = await service.storage
    .from(BUCKET)
    .createSignedUrl(path, EXPIRY_SECONDS, { download: safeFilename });
  if (signError) return NextResponse.json({ error: 'Unable to authorize document download.' }, { status: 500 });
  return NextResponse.json({ url: data.signedUrl, expiresIn: EXPIRY_SECONDS });
}
