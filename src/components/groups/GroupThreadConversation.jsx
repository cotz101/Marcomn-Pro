'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, Loader2, MessageSquare, Reply, Send, X } from 'lucide-react';
import { createClient } from '@/lib/supabase';
import { useProfile } from '@/app/context/ProfileContext';

const threadTitle = (value) => {
  const clean = (value || 'Untitled thread').replace(/<[^>]*>?/gm, '').replace(/\s+/g, ' ').trim();
  return clean.length > 150 ? `${clean.slice(0, 150)}...` : clean;
};

export default function GroupThreadConversation({ thread, groupName, onBack, embedded = false }) {
  const supabase = useMemo(() => createClient(), []);
  const { userId, showToast } = useProfile();
  const [messages, setMessages] = useState([]);
  const [profiles, setProfiles] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [replyTarget, setReplyTarget] = useState(null);
  const endRef = useRef(null);
  const composerRef = useRef(null);
  const activeThreadIdRef = useRef(thread?.id);

  useEffect(() => {
    activeThreadIdRef.current = thread?.id;
    if (!thread?.id) {
      return;
    }

    let cancelled = false;
    async function load() {
      setLoading(true);
      const { data, error: messageError } = await supabase
        .from('group_thread_messages')
        .select('*')
        .eq('thread_id', thread.id)
        .eq('is_deleted', false)
        .order('created_at', { ascending: true });

      if (cancelled || activeThreadIdRef.current !== thread.id) return;
      if (messageError) {
        setError(messageError.message || 'Unable to load this group thread.');
        setLoading(false);
        return;
      }

      const loaded = data || [];
      setMessages(loaded);
      const userIds = [...new Set(loaded.map(message => message.user_id).filter(Boolean))];
      if (userIds.length) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('id, name, avatar_url')
          .in('id', userIds);
        if (!cancelled && activeThreadIdRef.current === thread.id) {
          setProfiles(Object.fromEntries((profileData || []).map(profile => [profile.id, profile])));
        }
      }
      if (!cancelled) setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, [thread?.id, supabase]);

  useEffect(() => {
    if (!thread?.id) return;
    const channel = supabase
      .channel(`room:${thread.id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'group_thread_messages', filter: `thread_id=eq.${thread.id}`
      }, async ({ new: incoming }) => {
        if (incoming.thread_id !== activeThreadIdRef.current) return;
        setMessages(current => current.some(message => message.id === incoming.id) ? current : [...current, incoming]);
        if (incoming.user_id) {
          const { data } = await supabase.from('profiles').select('id, name, avatar_url').eq('id', incoming.user_id).maybeSingle();
          if (data && activeThreadIdRef.current === incoming.thread_id) {
            setProfiles(current => ({ ...current, [data.id]: data }));
          }
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [thread?.id, supabase]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: loading ? 'auto' : 'smooth' });
  }, [messages.length, loading]);

  const sendMessage = async () => {
    const content = draft.trim();
    if (!content || !thread?.id || sending) return;
    setSending(true);
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw new Error(authError?.message || 'You must be signed in to send a message.');
      const id = crypto.randomUUID();
      const reply = replyTarget ? {
        reply_to_message_id: replyTarget.id,
        reply_author_name: replyTarget.author,
        reply_preview: replyTarget.snippet
      } : {};
      const { data, error: insertError } = await supabase.from('group_thread_messages').insert({
        id, thread_id: thread.id, user_id: user.id, content, ...reply
      }).select().maybeSingle();
      if (insertError) throw insertError;

      const { error: legacyError } = await supabase.from('group_comments').insert({
        id, post_id: thread.id, user_id: user.id, content,
        author_name: profiles[user.id]?.name || 'Member'
      });
      if (legacyError) console.warn('Legacy group message mirror failed:', legacyError.message);

      const local = data || { id, thread_id: thread.id, user_id: user.id, content, created_at: new Date().toISOString(), ...reply };
      setMessages(current => current.some(message => message.id === id) ? current : [...current, local]);
      setDraft('');
      setReplyTarget(null);
      if (composerRef.current) composerRef.current.style.height = '36px';
    } catch (sendError) {
      showToast?.(sendError.message || 'Failed to send group message', 'error');
    } finally {
      setSending(false);
    }
  };

  const replyTo = (message) => {
    const plain = (message.content || '').replace(/<[^>]*>?/gm, '');
    setReplyTarget({
      id: message.id,
      author: profiles[message.user_id]?.name || message.author_name || 'Member',
      snippet: plain.length > 50 ? `${plain.slice(0, 50)}...` : plain
    });
    composerRef.current?.focus();
  };

  return (
    <section className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-slate-50">
      <header className="flex min-h-[64px] shrink-0 items-center border-b border-slate-200 bg-white px-4 py-2 shadow-sm">
        <button onClick={onBack} className={`mr-3 rounded-full p-1.5 text-slate-600 hover:bg-slate-100 ${embedded ? 'md:hidden' : ''}`} aria-label="Back to group threads">
          <ChevronLeft size={22} />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-black uppercase tracking-wider text-blue-600">{groupName || thread?.group?.name || 'Group'}</p>
          <h2 className="truncate text-base font-bold text-slate-900">{threadTitle(thread?.title)}</h2>
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto bg-slate-50 px-2 py-4 sm:px-4">
        {loading ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-slate-400"><Loader2 className="animate-spin" /><span>Loading messages...</span></div>
        ) : error ? (
          <div className="flex h-full flex-col items-center justify-center px-6 text-center text-red-600"><MessageSquare className="mb-3" /><p className="font-semibold">Unable to open thread</p><p className="mt-1 text-sm text-red-500">{error}</p></div>
        ) : messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center text-slate-400"><MessageSquare className="mb-3 text-slate-300" /><p className="font-semibold text-slate-500">No messages yet</p><p className="mt-1 text-sm">Send a message to start the conversation.</p></div>
        ) : (
          <div className="space-y-3">
            {messages.map(message => {
              const mine = message.user_id === userId;
              const author = profiles[message.user_id] || { name: message.author_name || 'Member' };
              return (
                <div key={message.id} className={`flex w-full ${mine ? 'justify-end' : 'justify-start'}`}>
                  <div className={`flex w-full max-w-[90%] items-end gap-2 sm:max-w-[78%] ${mine ? 'flex-row-reverse' : ''}`}>
                    <div className="mb-1 h-8 w-8 shrink-0 overflow-hidden rounded-full border border-slate-200 bg-slate-100">
                      {author.avatar_url ? <img src={author.avatar_url} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center bg-blue-50 text-xs font-black text-blue-800">{author.name?.charAt(0) || 'M'}</div>}
                    </div>
                    <div className="min-w-0">
                      {!mine && <p className="mb-0.5 ml-1 truncate text-[10px] font-semibold text-slate-500">{author.name}</p>}
                      <div className={`break-words whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed shadow-sm ${mine ? 'rounded-br-md bg-[#004173] text-white' : 'rounded-bl-md border border-slate-200 bg-white text-slate-800'}`}>
                        {message.reply_preview && <div className={`mb-2 truncate rounded-lg border-l-4 p-2 text-xs ${mine ? 'border-white/50 bg-white/10' : 'border-[#004173] bg-slate-100 text-slate-600'}`}><strong>Replying to {message.reply_author_name || 'Member'}</strong><br />{message.reply_preview}</div>}
                        {message.content}
                      </div>
                      <div className="mt-0.5 flex items-center gap-2 px-1">
                        <button onClick={() => replyTo(message)} className="flex items-center gap-1 text-[10px] font-bold text-[#004173]"><Reply size={12} />Reply</button>
                        <time className="text-[10px] text-slate-400">{message.created_at ? new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</time>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={endRef} />
          </div>
        )}
      </main>

      <footer className="messages-composer shrink-0 border-t border-slate-200 bg-white px-3 pt-3 shadow-[0_-2px_8px_rgba(0,0,0,0.06)]">
        {replyTarget && <div className="mb-2 flex items-center justify-between rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-xs text-slate-700"><span className="truncate">Replying to <strong>{replyTarget.author}</strong>: {replyTarget.snippet}</span><button onClick={() => setReplyTarget(null)} className="ml-2 shrink-0 text-slate-500"><X size={16} /></button></div>}
        <div className="mx-auto flex w-full max-w-4xl items-end gap-3">
          <textarea ref={composerRef} value={draft} disabled={sending || !!error} placeholder="Type your message..." className="min-h-[44px] max-h-[120px] flex-1 resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none focus:border-[#004173]" onChange={event => { setDraft(event.target.value); event.target.style.height = 'auto'; event.target.style.height = `${Math.min(event.target.scrollHeight, 120)}px`; }} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); sendMessage(); } }} />
          <button onClick={sendMessage} disabled={!draft.trim() || sending || !!error} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-sky-600 text-white shadow-md disabled:opacity-40">{sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}</button>
        </div>
      </footer>
    </section>
  );
}
