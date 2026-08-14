'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Upload as TusUpload } from 'tus-js-client';
import { ChevronLeft, FileText, Image as ImageIcon, Link2, Loader2, MessageSquare, Paperclip, RefreshCw, Reply, Send, Trash2, X } from 'lucide-react';
import { createClient } from '@/lib/supabase';
import { ALLOWED_FILE_TYPES, formatBytes, GROUP_ATTACHMENT_BUCKET, MAX_ATTACHMENTS, mergeMessage, normalizeExternalUrl, TUS_THRESHOLD, validateFile, vimeoEmbedUrl, youtubeEmbedUrl } from '@/lib/group-attachments';
import { useProfile } from '@/app/context/ProfileContext';

const cleanText = value => (value || '').replace(/<[^>]*>?/gm, '').replace(/\s+/g, ' ').trim();
const threadTitle = value => cleanText(value || 'Untitled thread').slice(0, 150) || 'Untitled thread';
const attachmentKey = attachment => attachment.id;

function AttachmentCard({ attachment, onOpen }) {
  const [imageUrl, setImageUrl] = useState('');
  const unavailable = attachment.deleted_at || attachment.status !== 'ready';
  const type = attachment.attachment_type;
  const embed = type === 'youtube' ? youtubeEmbedUrl(attachment.external_url) : type === 'vimeo' ? vimeoEmbedUrl(attachment.external_url) : null;
  useEffect(() => {
    if (type !== 'image' || unavailable) return;
    let active = true;
    fetch('/api/group-attachments/signed-url', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ attachmentId: attachment.id }) })
      .then(response => response.ok ? response.json() : null)
      .then(result => { if (active && result?.url) setImageUrl(result.url); })
      .catch(() => {});
    return () => { active = false; };
  }, [attachment.id, type, unavailable]);
  if (unavailable) return <div className="mt-2 max-w-full rounded-lg border border-dashed border-slate-300 px-3 py-2 text-xs text-slate-500">Attachment unavailable or deleted</div>;
  if (embed) return <div className="mt-2 aspect-video w-full max-w-[320px] overflow-hidden rounded-lg bg-black"><iframe src={embed} title={attachment.title || `${type} preview`} className="h-full w-full" loading="lazy" allow="encrypted-media; picture-in-picture" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen /></div>;
  if (type === 'image' && imageUrl) return <button type="button" onClick={() => onOpen(attachment)} className="mt-2 block w-full max-w-[320px] overflow-hidden rounded-lg border border-current/15 bg-white/40"><img src={imageUrl} alt={attachment.original_filename || 'Attached image'} className="max-h-56 w-full object-contain" /></button>;
  return <button type="button" onClick={() => onOpen(attachment)} className="mt-2 flex w-full max-w-[320px] items-center gap-2 overflow-hidden rounded-lg border border-current/15 bg-white/40 px-3 py-2 text-left text-xs">
    {type === 'image' ? <ImageIcon size={18} className="shrink-0" /> : <FileText size={18} className="shrink-0" />}
    <span className="min-w-0 flex-1"><span className="block truncate font-semibold">{attachment.original_filename}</span><span className="block opacity-70">{attachment.mime_type} · {formatBytes(attachment.byte_size)}</span></span>
  </button>;
}

export default function GroupThreadConversation({ thread, groupName, onBack, embedded = false }) {
  const supabase = useMemo(() => createClient(), []);
  const { userId, showToast } = useProfile();
  const threadId = thread?.id;
  const [messages, setMessages] = useState([]);
  const [profiles, setProfiles] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState('');
  const [items, setItems] = useState([]);
  const [urlDraft, setUrlDraft] = useState('');
  const [showVideoLink, setShowVideoLink] = useState(false);
  const [videoError, setVideoError] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [reservationId, setReservationId] = useState(null);
  const [replyTarget, setReplyTarget] = useState(null);
  const endRef = useRef(null), composerRef = useRef(null), fileRef = useRef(null), activeThreadIdRef = useRef(threadId);

  const attachVisibleAttachments = useCallback(async loadedMessages => {
    const messageIds = loadedMessages.map(message => message.id).filter(Boolean);
    if (!messageIds.length) return loadedMessages.map(message => ({ ...message, group_message_attachments: [] }));
    const { data: attachmentRows } = await supabase.from('group_message_attachments')
      .select('*').in('message_id', messageIds).eq('status', 'ready').is('deleted_at', null).order('sort_order');
    const byMessage = new Map();
    for (const attachment of attachmentRows || []) {
      const current = byMessage.get(attachment.message_id) || [];
      current.push(attachment); byMessage.set(attachment.message_id, current);
    }
    return loadedMessages.map(message => ({ ...message, group_message_attachments: byMessage.get(message.id) || [] }));
  }, [supabase]);

  const loadMessages = useCallback(async () => {
    if (!threadId) return;
    const { data, error: messageError } = await supabase.from('group_thread_messages')
      .select('*').eq('thread_id', threadId).eq('delivery_status', 'published').eq('is_deleted', false).order('created_at');
    if (activeThreadIdRef.current !== threadId) return;
    if (messageError) { setError(messageError.message || 'Unable to load this group thread.'); setLoading(false); return; }
    const loaded = await attachVisibleAttachments(data || []);
    if (activeThreadIdRef.current !== threadId) return;
    setMessages(loaded); setError('');
    const ids = [...new Set(loaded.map(message => message.user_id).filter(Boolean))];
    if (ids.length) {
      const { data: rows } = await supabase.from('profiles').select('id,name,avatar_url').in('id', ids);
      setProfiles(Object.fromEntries((rows || []).map(profile => [profile.id, profile])));
    }
    setLoading(false);
  }, [attachVisibleAttachments, supabase, threadId]);

  useEffect(() => {
    activeThreadIdRef.current = threadId;
    const timer = window.setTimeout(loadMessages, 0);
    return () => window.clearTimeout(timer);
  }, [threadId, loadMessages]);
  useEffect(() => {
    if (!threadId) return;
    const receive = async incoming => {
      if (incoming.thread_id !== activeThreadIdRef.current || incoming.delivery_status !== 'published' || incoming.is_deleted) return;
      const { data } = await supabase.from('group_thread_messages').select('*').eq('id', incoming.id).eq('delivery_status', 'published').eq('is_deleted', false).maybeSingle();
      if (data) {
        const [message] = await attachVisibleAttachments([data]);
        if (message) setMessages(current => mergeMessage(current, message));
      }
    };
    const channel = supabase.channel(`room:${threadId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'group_thread_messages', filter: `thread_id=eq.${threadId}` }, ({ new: row }) => receive(row))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'group_thread_messages', filter: `thread_id=eq.${threadId}` }, ({ new: row }) => receive(row)).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [attachVisibleAttachments, threadId, supabase]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: loading ? 'auto' : 'smooth' }); }, [messages.length, loading]);

  const addFiles = event => {
    const selected = [...event.target.files]; event.target.value = '';
    try {
      if (items.length + selected.length > MAX_ATTACHMENTS) throw new Error(`A message can contain at most ${MAX_ATTACHMENTS} attachments.`);
      setItems(current => [...current, ...selected.map(file => ({ id: crypto.randomUUID(), kind: validateFile(file), file, state: 'selected', progress: 0 }))]);
      setSendError('');
    } catch (selectionError) { setSendError(selectionError.message); }
  };
  const addUrl = () => {
    try {
      if (items.length >= MAX_ATTACHMENTS) throw new Error(`A message can contain at most ${MAX_ATTACHMENTS} attachments.`);
      const parsed = normalizeExternalUrl(urlDraft);
      setItems(current => [...current, { id: crypto.randomUUID(), kind: parsed.attachmentType, url: parsed.canonical, title: parsed.title, state: 'selected', progress: 0 }]);
      setUrlDraft(''); setVideoError(''); setShowVideoLink(false); setSendError('');
    } catch (urlError) {
      if (urlError.message?.includes('at most')) setSendError(urlError.message);
      else setVideoError('Enter a valid YouTube or Vimeo link.');
    }
  };
  const cancelVideoLink = () => { setUrlDraft(''); setVideoError(''); setShowVideoLink(false); };
  const descriptors = items.map(item => item.file ? { id: item.id, attachment_type: item.kind, original_filename: item.file.name, mime_type: item.file.type, byte_size: item.file.size, preview_metadata: {} } : { id: item.id, attachment_type: item.kind, external_url: item.url, title: item.title, preview_metadata: {} });

  const uploadTus = async (item, reserved, accessToken) => new Promise((resolve, reject) => {
    const endpoint = `${supabase.storageUrl}/upload/resumable`;
    const upload = new TusUpload(item.file, { endpoint, retryDelays: [0, 1000, 3000, 5000], chunkSize: TUS_THRESHOLD,
      headers: { authorization: `Bearer ${accessToken}`, 'x-upsert': 'false' },
      metadata: { bucketName: reserved.storage_bucket, objectName: reserved.storage_path, contentType: item.file.type, cacheControl: '3600' },
      uploadDataDuringCreation: true,
      onError: reject,
      onProgress: (sent, total) => setItems(current => current.map(value => value.id === item.id ? { ...value, state: 'uploading', progress: Math.round(sent / total * 100) } : value)),
      onSuccess: resolve,
    });
    upload.start();
  });

  const uploadFile = async (item, reserved, token) => {
    setItems(current => current.map(value => value.id === item.id ? { ...value, state: 'uploading', progress: 0 } : value));
    if (item.file.size > TUS_THRESHOLD) await uploadTus(item, reserved, token);
    else {
      const { error: uploadError } = await supabase.storage.from(reserved.storage_bucket || GROUP_ATTACHMENT_BUCKET).upload(reserved.storage_path, item.file, { contentType: item.file.type, upsert: false });
      if (uploadError && !/already exists|duplicate/i.test(uploadError.message)) throw uploadError;
    }
  };

  const sendMessage = async () => {
    const content = draft.trim();
    if ((!content && !items.length) || !thread?.id || sending) return;
    setSending(true); setSendError('');
    const messageId = reservationId || crypto.randomUUID(); setReservationId(messageId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('You must be signed in to send a message.');
      const { data: reservation, error: reserveError } = await supabase.rpc('reserve_group_thread_message', { p_message_id: messageId, p_thread_id: thread.id, p_content: content, p_attachments: descriptors });
      if (reserveError) throw reserveError;
      if (replyTarget) {
        const response = await fetch('/api/group-attachments/message-metadata', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ messageId, reply: replyTarget }) });
        if (!response.ok) throw new Error((await response.json()).error || 'Unable to attach reply metadata.');
      }
      const reservedById = new Map((reservation.attachments || []).map(value => [value.id, value]));
      for (const item of items) {
        const reserved = reservedById.get(item.id);
        if (!reserved) throw new Error('Reservation attachment mismatch.');
        if (reserved.status !== 'ready') {
          if (item.file) await uploadFile(item, reserved, session.access_token);
          setItems(current => current.map(value => value.id === item.id ? { ...value, state: 'validating', progress: 100 } : value));
          const validation = await fetch('/api/group-attachments/validate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ attachmentId: item.id }) });
          if (!validation.ok) throw new Error((await validation.json()).error || 'Attachment validation failed.');
          setItems(current => current.map(value => value.id === item.id ? { ...value, state: 'ready', progress: 100 } : value));
        }
      }
      const { error: publishError } = await supabase.rpc('publish_group_thread_message', { p_message_id: messageId });
      if (publishError) throw publishError;
      await loadMessages();
      setDraft(''); setItems([]); setUrlDraft(''); setVideoError(''); setShowVideoLink(false); setReplyTarget(null); setReservationId(null);
      if (composerRef.current) composerRef.current.style.height = '36px';
    } catch (sendFailure) {
      setSendError(sendFailure.message || 'Message could not be sent. Retry will safely resume this send.');
      setItems(current => current.map(value => value.state === 'uploading' || value.state === 'validating' ? { ...value, state: 'error' } : value));
    } finally { setSending(false); }
  };

  const cancelSend = async () => {
    if (reservationId) await supabase.rpc('cancel_group_message_reservation', { p_message_id: reservationId });
    setReservationId(null); setItems([]); setSendError(''); setSending(false);
  };
  const openAttachment = async attachment => {
    const response = await fetch('/api/group-attachments/signed-url', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ attachmentId: attachment.id }) });
    const result = await response.json();
    if (!response.ok) return showToast?.(result.error || 'Attachment unavailable.', 'error');
    window.open(result.url, '_blank', 'noopener,noreferrer');
  };
  const replyTo = message => { const plain = cleanText(message.content); setReplyTarget({ id: message.id, author: profiles[message.user_id]?.name || message.author_name || 'Member', snippet: plain.slice(0, 50) || 'Attachment' }); composerRef.current?.focus(); };

  return <section className="group-conversation flex h-full min-h-0 w-full flex-col overflow-hidden bg-[#f5f5f7]">
    <header className="shrink-0 border-b border-slate-200 bg-white"><div className="group-conversation__content flex min-h-[64px] items-center px-4 py-2"><button onClick={onBack} className={`mr-3 rounded-full p-1.5 text-slate-600 hover:bg-slate-100 ${embedded ? 'md:hidden' : ''}`} aria-label="Back to group threads"><ChevronLeft size={22} /></button><div className="min-w-0 flex-1"><p className="truncate text-xs font-black uppercase tracking-wider text-[#5b5fc7]">{groupName || thread?.group?.name || 'Group'}</p><h2 className="truncate text-base font-bold text-slate-900">{threadTitle(thread?.title)}</h2></div></div></header>
    <main className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto bg-[#f5f5f7] px-2 py-4 sm:px-4">
      {loading ? <div className="flex h-full items-center justify-center gap-3 text-slate-400"><Loader2 className="animate-spin" />Loading messages...</div> : error ? <div className="flex h-full flex-col items-center justify-center px-6 text-center text-red-600"><MessageSquare className="mb-3" /><p className="font-semibold">Unable to open thread</p><p className="mt-1 text-sm">{error}</p></div> : !messages.length ? <div className="flex h-full flex-col items-center justify-center text-center text-slate-400"><MessageSquare className="mb-3" /><p className="font-semibold text-slate-500">No messages yet</p><p className="mt-1 text-sm">Send a message to start the conversation.</p></div> : <div className="group-conversation__content space-y-3">{messages.map(message => {
        const mine = message.user_id === userId, author = profiles[message.user_id] || { name: message.author_name || 'Member' };
        return <div key={message.id} className={`message-row flex w-full ${mine ? 'justify-end' : 'justify-start'}`}><div className={`flex w-full max-w-[94%] items-end gap-2 sm:max-w-[78%] ${mine ? 'flex-row-reverse' : ''}`}><div className="mb-1 h-8 w-8 shrink-0 overflow-hidden rounded-full border bg-slate-100">{author.avatar_url ? <img src={author.avatar_url} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center bg-blue-50 text-xs font-black text-blue-800">{author.name?.charAt(0) || 'M'}</div>}</div><div className="min-w-0 max-w-full">{!mine && <p className="mb-0.5 ml-1 truncate text-[10px] font-semibold text-slate-500">{author.name}</p>}<div className={`max-w-full overflow-hidden break-words whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-[15px] shadow-sm ${mine ? 'rounded-br-md border border-[#d6d8f5] bg-[#e8e9f8] text-slate-900' : 'rounded-bl-md border border-slate-200 bg-[#eeeeef] text-slate-800'}`}>{message.reply_preview && <blockquote className="mb-2 overflow-hidden rounded-md border-l-[3px] border-[#5b5fc7] bg-white/40 px-2.5 py-2 text-xs"><strong className="block truncate">{message.reply_author_name || 'Member'}</strong><span className="line-clamp-2 [overflow-wrap:anywhere]">{message.reply_preview}</span></blockquote>}{message.content && <p className="[overflow-wrap:anywhere]">{message.content}</p>}{(message.group_message_attachments || []).map(attachment => <AttachmentCard key={attachmentKey(attachment)} attachment={attachment} onOpen={openAttachment} />)}</div><div className="mt-0.5 flex min-h-7 items-center gap-1.5 text-[10px]"><button onClick={() => replyTo(message)} className="flex min-h-7 items-center gap-1 rounded-md px-1.5 font-semibold text-[#5b5fc7]" aria-label={`Reply to ${author.name}`}><Reply size={12} />Reply</button><span>•</span><time className="text-slate-400">{new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time></div></div></div></div>;
      })}<div ref={endRef} /></div>}
    </main>
    <footer className="messages-composer group-conversation__composer shrink-0 min-w-0 border-t border-slate-200 bg-white">
      {replyTarget && <div className="messages-composer__reply"><span className="min-w-0 flex-1 truncate">Replying to <strong>{replyTarget.author}</strong>: {replyTarget.snippet}</span><button onClick={() => setReplyTarget(null)} aria-label="Cancel reply"><X size={16} /></button></div>}
      {showVideoLink && <div id="group-video-link-row" className="mx-3 mt-2 rounded-lg border border-slate-200 bg-slate-50 p-2"><label htmlFor="group-video-link" className="mb-1 block text-xs font-semibold text-slate-600">Video link</label><div className="flex min-w-0 flex-wrap items-center gap-2 sm:flex-nowrap"><input id="group-video-link" value={urlDraft} onChange={event => { setUrlDraft(event.target.value); if (videoError) setVideoError(''); }} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); addUrl(); } else if (event.key === 'Escape') cancelVideoLink(); }} disabled={sending || items.length >= MAX_ATTACHMENTS} placeholder="Paste a YouTube or Vimeo link" className="min-w-0 flex-[1_1_12rem] rounded-lg border bg-white px-3 py-2 text-sm" aria-label="Video link" aria-invalid={Boolean(videoError)} aria-describedby={videoError ? 'group-video-link-error' : undefined} autoFocus /><button type="button" onClick={addUrl} disabled={!urlDraft.trim() || sending || items.length >= MAX_ATTACHMENTS} className="rounded-lg bg-[#004173] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Add</button><button type="button" onClick={cancelVideoLink} disabled={sending} className="rounded-lg border px-3 py-2 text-xs font-semibold text-slate-600">Cancel</button></div>{videoError && <p id="group-video-link-error" role="alert" className="mt-1 text-xs text-red-600">{videoError}</p>}</div>}
      {items.length > 0 && <div className="flex max-w-full gap-2 overflow-x-auto px-3 pt-2" aria-label="Selected attachments">{items.map(item => <div key={item.id} className="relative w-40 shrink-0 overflow-hidden rounded-lg border bg-slate-50 p-2 text-xs"><button disabled={sending} onClick={() => setItems(current => current.filter(value => value.id !== item.id))} className="absolute right-1 top-1 rounded bg-white p-0.5" aria-label="Remove attachment"><X size={13} /></button><p className="truncate pr-5 font-semibold">{item.file?.name || item.title}</p><p className="truncate text-slate-500">{item.kind}{item.file ? ` · ${formatBytes(item.file.size)}` : ''}</p>{item.state !== 'selected' && <div className="mt-1 h-1 overflow-hidden rounded bg-slate-200"><div className={`h-full ${item.state === 'error' ? 'bg-red-500' : 'bg-blue-600'}`} style={{ width: `${item.progress}%` }} /></div>}<p className="mt-1 text-[10px] text-slate-500">{item.state}</p></div>)}</div>}
      {sendError && <div role="alert" className="mx-3 mt-2 flex items-start justify-between gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700"><span>{sendError}</span>{reservationId && <button onClick={cancelSend} className="shrink-0 underline">Cancel upload</button>}</div>}
      <div className="messages-composer__row"><input ref={fileRef} type="file" multiple accept={[...ALLOWED_FILE_TYPES.keys()].join(',')} onChange={addFiles} className="hidden" /><button type="button" onClick={() => fileRef.current?.click()} disabled={sending || items.length >= MAX_ATTACHMENTS} className="messages-composer__send shrink-0" aria-label="Attach files"><Paperclip size={18} /></button><button type="button" onClick={() => { setShowVideoLink(current => !current); setVideoError(''); }} disabled={sending || items.length >= MAX_ATTACHMENTS} className="messages-composer__send shrink-0" aria-label="Add video link" aria-expanded={showVideoLink} aria-controls="group-video-link-row"><Link2 size={18} /></button><textarea ref={composerRef} rows={1} value={draft} disabled={sending || !!error} placeholder="Add a message (optional)" className="messages-composer__field" onChange={event => { setDraft(event.target.value); event.target.style.height = 'auto'; event.target.style.height = `${Math.min(event.target.scrollHeight, 120)}px`; }} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); sendMessage(); } }} /><button onClick={sendMessage} disabled={(!draft.trim() && !items.length) || sending || !!error} className="messages-composer__send" aria-label={reservationId ? 'Retry message' : 'Send message'}>{sending ? <Loader2 size={18} className="animate-spin" /> : reservationId ? <RefreshCw size={18} /> : <Send size={18} />}</button>{reservationId && <button onClick={cancelSend} disabled={sending} className="messages-composer__send" aria-label="Cancel failed send"><Trash2 size={18} /></button>}</div>
      <p className="px-3 pb-[max(0.4rem,env(safe-area-inset-bottom))] text-[10px] text-slate-400">Up to 5 items · JPG, PNG, WebP up to 10 MiB · PDF, Word, Excel, PowerPoint, TXT up to 25 MiB</p>
    </footer>
  </section>;
}
