import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase-server';

export async function POST(request) {
  try {
    const { messageId, reply } = await request.json();
    const userClient = await createClient();
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    if (!reply) return NextResponse.json({ ok: true });
    const service = createServiceClient();
    const { data: draft } = await service.from('group_thread_messages').select('id,thread_id,user_id,delivery_status').eq('id', messageId).maybeSingle();
    if (!draft || draft.user_id !== user.id || draft.delivery_status !== 'draft') return NextResponse.json({ error: 'Message send unavailable.' }, { status: 403 });
    const { data: source } = await service.from('group_thread_messages').select('id,thread_id,delivery_status,is_deleted').eq('id', reply.id).maybeSingle();
    if (!source || source.thread_id !== draft.thread_id || source.delivery_status !== 'published' || source.is_deleted) return NextResponse.json({ error: 'Reply target unavailable.' }, { status: 422 });
    const { error } = await service.from('group_thread_messages').update({
      reply_to_message_id: source.id,
      reply_author_name: String(reply.author || 'Member').slice(0, 200),
      reply_preview: String(reply.snippet || '').slice(0, 500),
    }).eq('id', messageId).eq('delivery_status', 'draft');
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Unable to prepare reply.' }, { status: 422 });
  }
}
