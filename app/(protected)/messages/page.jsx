'use client';

import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { useProfile } from '@/app/context/ProfileContext';
import {
  Send,
  ArrowLeft,
  MessageSquare,
  Search,
  User,
  Loader2,
  ExternalLink
} from 'lucide-react';

export default function InboxPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeChatId = searchParams.get('chat');

  const { userId, profile: currentUserProfile, showToast } = useProfile();
  
  const [conversations, setConversations] = useState([]);
  const [profiles, setProfiles] = useState({}); // map of userId -> profile data
  const [loading, setLoading] = useState(true);
  
  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [newMessageText, setNewMessageText] = useState('');
  const [sending, setSending] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');

  const chatEndRef = useRef(null);
  const supabase = createClient();

  // Scroll to bottom helper
  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // 1. Fetch all conversations and cache profiles
  useEffect(() => {
    if (!userId) return;

    async function loadInbox() {
      try {
        setLoading(true);
        // Fetch conversations
        const { data: convData, error: convError } = await supabase
          .from('conversations')
          .select('*')
          .or(`participant_one.eq.${userId},participant_two.eq.${userId}`)
          .order('created_at', { ascending: false });

        if (convError) throw convError;

        const conversationsList = convData || [];
        setConversations(conversationsList);

        // Find unique user IDs to fetch profiles for
        const otherUserIds = conversationsList.map(c => 
          c.participant_one === userId ? c.participant_two : c.participant_one
        );

        if (otherUserIds.length > 0) {
          const { data: profData, error: profError } = await supabase
            .from('profiles')
            .select('id, name, avatar_url, currentRole')
            .in('id', otherUserIds);

          if (profError) throw profError;

          const profileMap = {};
          (profData || []).forEach(p => {
            profileMap[p.id] = p;
          });
          setProfiles(profileMap);
        }
      } catch (err) {
        console.error('Error loading inbox:', err);
        showToast('Failed to load conversations', 'error');
      } finally {
        setLoading(false);
      }
    }

    loadInbox();
  }, [userId]);

  // 2. Load messages for the active conversation
  useEffect(() => {
    if (!activeChatId || !userId) {
      setMessages([]);
      return;
    }

    async function loadMessages() {
      try {
        setLoadingMessages(true);
        const { data, error } = await supabase
          .from('messages')
          .select('*')
          .eq('conversation_id', activeChatId)
          .order('created_at', { ascending: true });

        if (error) throw error;
        setMessages(data || []);
      } catch (err) {
        console.error('Error loading messages:', err);
        showToast('Failed to load messages', 'error');
      } finally {
        setLoadingMessages(false);
      }
    }

    loadMessages();
  }, [activeChatId, userId]);

  // 3. Realtime messages subscription
  useEffect(() => {
    if (!activeChatId) return;

    const channel = supabase
      .channel(`public:messages:conv_${activeChatId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages'
        },
        (payload) => {
          if (payload.new.conversation_id === activeChatId) {
            setMessages((prev) => {
              if (prev.some(m => m.id === payload.new.id)) return prev;
              return [...prev, payload.new];
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeChatId]);

  // 4. Scroll to bottom when messages load or change
  useEffect(() => {
    scrollToBottom();
  }, [messages, loadingMessages]);

  // 5. Send message logic
  const handleSendMessage = async (e) => {
    e?.preventDefault();
    if (!newMessageText.trim() || !activeChatId || !userId || sending) return;

    try {
      setSending(true);
      const textToSend = newMessageText.trim();
      setNewMessageText(''); // Clear early for snappy UX

      const { data, error } = await supabase
        .from('messages')
        .insert({
          conversation_id: activeChatId,
          sender_id: userId,
          body: textToSend
        })
        .select()
        .single();

      if (error) {
        setNewMessageText(textToSend); // Restore if error
        throw error;
      }

      setMessages(prev => {
        if (prev.some(m => m.id === data.id)) return prev;
        return [...prev, data];
      });
    } catch (err) {
      console.error('Error sending message:', err);
      showToast('Failed to send message', 'error');
    } finally {
      setSending(false);
    }
  };

  // Helper: Find the other participant's profile
  const getOtherParticipantProfile = (conv) => {
    const otherId = conv.participant_one === userId ? conv.participant_two : conv.participant_one;
    return profiles[otherId] || { name: 'Unknown User', id: otherId };
  };

  // Filter conversations based on search term
  const filteredConversations = conversations.filter(c => {
    const otherProfile = getOtherParticipantProfile(c);
    return (otherProfile.name || '').toLowerCase().includes(searchTerm.toLowerCase());
  });

  const activeConv = conversations.find(c => c.id === activeChatId);
  const activePartner = activeConv ? getOtherParticipantProfile(activeConv) : null;

  return (
    <div className="flex h-[calc(100vh-64px)] w-full overflow-hidden bg-gray-50 border-t border-gray-100">
      <style dangerouslySetInnerHTML={{ __html: `
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      ` }} />

      {/* Roster / Sidebar - Hidden on mobile if chat is active */}
      <div 
        className={`w-full md:w-80 lg:w-96 flex-shrink-0 flex flex-col border-r border-gray-200 bg-white ${
          activeChatId ? 'hidden md:flex' : 'flex'
        }`}
      >
        {/* Search header */}
        <div className="p-4 border-b border-gray-100 flex-shrink-0">
          <h1 className="text-xl font-extrabold text-[#002b4e] mb-4">Messages</h1>
          <div className="relative flex items-center bg-gray-50 border border-gray-200 rounded-xl px-3 py-2">
            <Search size={18} className="text-gray-400 mr-2 flex-shrink-0" />
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-transparent text-sm text-gray-700 placeholder-gray-400 outline-none border-none"
            />
          </div>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto no-scrollbar">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400 space-y-3">
              <Loader2 className="animate-spin text-[#002b4e]" size={28} />
              <span className="text-sm font-medium">Loading conversations...</span>
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center text-gray-400 mt-12">
              <MessageSquare size={44} className="text-gray-300 mb-3" />
              <p className="text-sm font-semibold text-gray-600">No conversations</p>
              <p className="text-xs text-gray-400 mt-1">Start messaging from a partner profile or connections directory.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {filteredConversations.map((conv) => {
                const partner = getOtherParticipantProfile(conv);
                const isActive = conv.id === activeChatId;
                
                return (
                  <button
                    key={conv.id}
                    onClick={() => router.push(`/messages?chat=${conv.id}`)}
                    className={`w-full flex items-center gap-3 p-4 text-left transition-all ${
                      isActive 
                        ? 'bg-blue-50/60 border-l-4 border-[#002b4e]' 
                        : 'hover:bg-gray-50 border-l-4 border-transparent'
                    }`}
                  >
                    {/* Avatar */}
                    {partner.avatar_url ? (
                      <img
                        src={partner.avatar_url}
                        alt={partner.name}
                        className="w-12 h-12 rounded-full object-cover border border-gray-100 shadow-sm"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center border border-gray-200 text-gray-500 font-bold text-lg">
                        {partner.name.charAt(0).toUpperCase()}
                      </div>
                    )}

                    {/* Meta info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h2 className="text-sm font-bold text-[#002b4e] truncate">
                          {partner.name}
                        </h2>
                        <span className="text-[10px] text-gray-400 font-medium">
                          {new Date(conv.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 truncate mt-0.5">
                        {partner.currentRole || 'Maritime Member'}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Active Stage - Hidden on mobile if no active chat */}
      <div 
        className={`flex-1 flex flex-col bg-slate-50 ${
          activeChatId ? 'flex' : 'hidden md:flex'
        }`}
      >
        {activeConv && activePartner ? (
          <>
            {/* Chat stage header */}
            <div className="bg-white border-b border-gray-200 p-4 flex items-center justify-between flex-shrink-0 z-10 shadow-sm">
              <div className="flex items-center min-w-0">
                {/* Back button on mobile */}
                <button
                  onClick={() => router.push('/messages')}
                  className="md:hidden p-2 -ml-2 mr-2 text-gray-500 hover:text-[#002b4e] rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <ArrowLeft size={20} />
                </button>

                {/* Partner Identity */}
                <div className="flex items-center gap-3 min-w-0">
                  {activePartner.avatar_url ? (
                    <img
                      src={activePartner.avatar_url}
                      alt={activePartner.name}
                      className="w-10 h-10 rounded-full object-cover border border-gray-100 shadow-sm"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center border border-gray-200 text-gray-500 font-bold">
                      {activePartner.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <h2 className="text-sm font-bold text-[#002b4e] truncate flex items-center gap-1.5">
                      {activePartner.name}
                    </h2>
                    <p className="text-xs text-gray-500 truncate mt-0.5">
                      {activePartner.currentRole || 'Maritime Member'}
                    </p>
                  </div>
                </div>
              </div>

              {/* View Profile Action */}
              <button
                onClick={() => router.push(`/profile/${activePartner.id}`)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 hover:bg-gray-100 text-gray-600 hover:text-[#002b4e] text-xs font-bold rounded-lg border border-gray-200/80 transition-colors"
              >
                <span>View Profile</span>
                <ExternalLink size={12} />
              </button>
            </div>

            {/* Message Feed */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 no-scrollbar">
              {loadingMessages ? (
                <div className="flex flex-col items-center justify-center h-full py-12 text-gray-400 space-y-3">
                  <Loader2 className="animate-spin text-[#002b4e]" size={28} />
                  <span className="text-sm font-medium">Loading messages...</span>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full py-12 text-center text-gray-400">
                  <MessageSquare size={36} className="text-gray-300 mb-2" />
                  <p className="text-sm font-semibold text-gray-500">No messages yet</p>
                  <p className="text-xs text-gray-400 mt-1">Send a message to start the conversation.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((msg) => {
                    const isOwn = msg.sender_id === userId;
                    
                    return (
                      <div
                        key={msg.id}
                        className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                      >
                        <div className={`max-w-[70%] flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}>
                          {/* Message bubble */}
                          <div
                            className={`p-3.5 text-sm leading-relaxed shadow-sm transition-all ${
                              isOwn
                                ? 'bg-[#002b4e] text-white rounded-2xl rounded-tr-none'
                                : 'bg-white text-gray-800 border border-gray-150 rounded-2xl rounded-tl-none'
                            }`}
                          >
                            <p className="whitespace-pre-wrap break-words">{msg.body}</p>
                          </div>
                          
                          {/* Timestamp */}
                          <span className="text-[10px] text-gray-400 mt-1.5 font-medium px-1">
                            {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={chatEndRef} />
                </div>
              )}
            </div>

            {/* Composer Footer */}
            <form 
              onSubmit={handleSendMessage}
              className="bg-white border-t border-gray-200 p-4 flex items-center gap-3 flex-shrink-0"
            >
              <input
                type="text"
                placeholder="Type your message..."
                value={newMessageText}
                onChange={(e) => setNewMessageText(e.target.value)}
                disabled={sending}
                className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 placeholder-gray-400 outline-none focus:border-[#002b4e] transition-colors"
              />
              <button
                type="submit"
                disabled={!newMessageText.trim() || sending}
                className="p-3 bg-[#002b4e] hover:bg-[#001e38] text-white rounded-xl transition-all duration-150 shadow-sm flex items-center justify-center disabled:opacity-40 disabled:hover:bg-[#002b4e] cursor-pointer"
              >
                {sending ? (
                  <Loader2 className="animate-spin" size={18} />
                ) : (
                  <Send size={18} />
                )}
              </button>
            </form>
          </>
        ) : (
          /* Empty / Default Active Stage */
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-gray-50/50">
            <div className="w-16 h-16 rounded-full bg-blue-50/80 flex items-center justify-center border border-blue-100 text-[#002b4e] mb-4 shadow-sm animate-pulse">
              <MessageSquare size={32} />
            </div>
            <h2 className="text-lg font-bold text-[#002b4e] mb-1">Your Inbox</h2>
            <p className="text-sm text-gray-500 max-w-sm leading-relaxed">
              Select a conversation from the sidebar roster or visit a partner profile to start a new chat.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
