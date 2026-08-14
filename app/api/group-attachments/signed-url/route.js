import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase-server';

export async function POST(request) {
  const { attachmentId } = await request.json();
  const userClient = await createClient();
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  const { data: attachment, error } = await userClient.from('group_message_attachments')
    .select('id,attachment_type,storage_bucket,storage_path,original_filename,status,deleted_at').eq('id', attachmentId).eq('status', 'ready').is('deleted_at', null).maybeSingle();
  if (error || !attachment?.storage_path) return NextResponse.json({ error: 'Attachment unavailable.' }, { status: 404 });
  const safeFilename = String(attachment.original_filename || 'download').replace(/[^a-zA-Z0-9._ -]/g, '_').slice(0, 255);
  const options = attachment.attachment_type === 'document' ? { download: safeFilename } : undefined;
  const { data, error: signError } = await createServiceClient().storage.from(attachment.storage_bucket).createSignedUrl(attachment.storage_path, 60, options);
  if (signError) return NextResponse.json({ error: 'Unable to authorize download.' }, { status: 500 });
  return NextResponse.json({ url: data.signedUrl, expiresIn: 60 });
}
