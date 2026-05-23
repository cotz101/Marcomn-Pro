'use client';

import { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase';
import { useProfile } from '@/app/context/ProfileContext';
import { sendNotification } from '@/app/actions/notifications';
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
  const currentUser = { id: userId };
  
  const [conversations, setConversations] = useState([]);
  const [profiles, setProfiles] = useState({}); // map of userId -> profile data
  const [lastMessages, setLastMessages] = useState({}); // map of conversationId -> message string
  const [loading, setLoading] = useState(true);
  
  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');

  const chatEndRef = useRef(null);
  const supabase = createClient();

  // Scroll to bottom helper
  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Lock body scroll on mobile when active chat is open
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const handleResize = () => {
      const isMobile = window.innerWidth < 768;
      if (isMobile && activeChatId) {
        document.body.style.overflow = 'hidden';
      } else {
        document.body.style.overflow = '';
      }
    };
    
    handleResize();
    window.addEventListener('resize', handleResize);
    
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('resize', handleResize);
    };
  }, [activeChatId]);

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

        // Fetch last messages for all conversations to show one-line preview
        if (conversationsList.length > 0) {
          const convIds = conversationsList.map(c => c.id);
          const { data: lastMsgs, error: lastMsgsError } = await supabase
            .from('messages')
            .select('conversation_id, body, created_at')
            .in('conversation_id', convIds)
            .order('created_at', { ascending: true });
          
          if (!lastMsgsError && lastMsgs) {
            const lastMsgMap = {};
            lastMsgs.forEach(m => {
              lastMsgMap[m.conversation_id] = m.body;
            });
            setLastMessages(lastMsgMap);
          }
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
            setLastMessages((prev) => ({
              ...prev,
              [activeChatId]: payload.new.body
            }));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeChatId]);

  // 4. Scroll layout effect: triggered when messages length changes
  useLayoutEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // 5. Direct Notification creation helper
  const createNotification = async (recipientId, senderId, text, chatId) => {
    try {
      console.log('DEBUG: Creating direct notification for recipient:', recipientId);
      if (!recipientId) { console.warn('Notification skipped: No recipientId provided.'); return; }

      // Preference gatekeeper
      let allowNotification = true;
      // Force allow for testing (bypass gatekeeper)
      allowNotification = true;
      try {
          // Lookup notification settings
          console.log('DEBUG: Sending notification to:', recipientId);
          const { data: pref, error: prefError } = await supabase
            .from('notification_settings')
            .select('messaging_enabled')
            .eq('user_id', recipientId)
            .maybeSingle();

          if (prefError && prefError.code !== 'PGRST116') {
            console.error('Lookup Debug:', { name: prefError?.name, message: prefError?.message, query: 'notification_settings' });
          }
          const messagingEnabled = pref?.messaging_enabled ?? true;

          // Lookup profile inbox privacy
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('inbox_privacy')
            .eq('id', recipientId)
            .maybeSingle();

          if (profileError && profileError.code !== 'PGRST116') {
            console.error('Lookup Debug:', { name: profileError?.name, message: profileError?.message, query: 'profiles' });
          }
          const inboxPrivacy = profile?.inbox_privacy ?? 'public';

          // Determine if notification is allowed
          if (messagingEnabled === false || inboxPrivacy === 'private') {
            allowNotification = false;
          }
      } catch (gateErr) {
        console.error('DEBUG: Notification gatekeeper exception:', gateErr);
      }

      if (allowNotification) {
        const notificationData = {
          recipient_id: recipientId,
          sender_id: senderId,
          type: 'message',
          title: 'New Message',
          body: `${currentUserProfile?.name || 'Someone'} sent you a message.`,
          link: `/messages?chat=${chatId}`,
          is_read: false
        };

        const { data: insertData, error: insertError } = await supabase
          .from('notifications')
          .insert([notificationData]);

        if (insertError) {
          console.error('Insertion Failed:', insertError);
        } else {
          console.log('Notification successfully inserted for:', recipientId);
        }
      } else {
        console.log('⚠️ Notification blocked by user preferences for recipient:', recipientId);
      }
    } catch (err) {
      console.error('DEBUG: Direct notification exception caught:', err);
    }
  };

  // 6. Send message logic
  const handleSendMessage = async (e) => {
    e?.preventDefault();
    if (!newMessage.trim() || !activeChatId || !currentUser.id || sending) return;

    try {
      setSending(true);
      const textToSend = newMessage.trim();

      const { data, error } = await supabase
        .from('messages')
        .insert({
          conversation_id: activeChatId,
          sender_id: currentUser.id,
          body: textToSend
        })
        .select()
        .maybeSingle();

      if (error) throw error;

      setNewMessage(''); // On a successful database insert, completely wipe the input text state clean
      
      setMessages(prev => {
        if (prev.some(m => m.id === data.id)) return prev;
        return [...prev, data];
      });
      setLastMessages(prev => ({
        ...prev,
        [activeChatId]: textToSend
      }));

      // Ensure we have a valid recipient ID from the active conversation before broadcasting
      const activeConv = conversations.find(c => c.id === activeChatId);
      const recipientId = activeConv
        ? (activeConv.participant_one === currentUser.id ? activeConv.participant_two : activeConv.participant_one)
        : null;

      // Verify the Recipient ID
      console.log('Target Recipient ID Lookup:', recipientId);

      if (recipientId && recipientId !== currentUser.id) {
        // Strict Gatekeeper Patch: Check recipient preferences before inserting
        try {
          // 1. Fetch recipient's notification settings and profile privacy
          const [{ data: settings }, { data: profile }] = await Promise.all([
            supabase
              .from('notification_settings')
              .select('messaging_enabled')
              .eq('user_id', recipientId)
              .maybeSingle(),
            supabase
              .from('profiles')
              .select('inbox_privacy')
              .eq('id', recipientId)
              .maybeSingle()
          ]);

          // 2. Gatekeeper: If muted or private, EXIT.
          const isMuted = settings && settings.messaging_enabled === false;
          const isPrivate = profile && profile.inbox_privacy === 'private';
          
          if (isMuted || isPrivate) {
            console.log('Notification muted or private for user:', recipientId, '- Skipping insert.');
          } else {
            // 3. Only proceed if not muted
            // Basket 2 (Logic) Patch: Asynchronous insert into the 'notifications' table
            supabase.from('notifications').insert([{
              recipient_id: recipientId,
              sender_id: currentUser.id,
              type: 'message',
              title: 'New Message',
              body: 'Sent you a new message', // content
              link: '/messages?chat=' + activeChatId,
              is_read: false
            }]).then(({ error }) => {
              if (error) {
                console.error('⚠️ Notification insertion failed:', error);
              } else {
                console.log('✅ Notification successfully inserted');
              }
            });
          }
        } catch (notifErr) {
          console.error('⚠️ Critical Notification Gatekeeper Fail:', notifErr.message);
        }
      } else {
        console.warn('⚠️ recipientId is null or matches current user; skipping notification insertion.');
      }
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
    <div className="flex flex-row w-full h-[100dvh] md:h-[calc(100vh-80px)] overflow-hidden">
      <style dangerouslySetInnerHTML={{ __html: `
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        @media (max-width: 767px) {
          .mobile-chat-container {
            position: fixed !important;
            top: calc(56px + env(safe-area-inset-top)) !important;
            bottom: calc(72px + env(safe-area-inset-bottom)) !important;
            left: 0 !important;
            right: 0 !important;
            height: calc(100dvh - (56px + env(safe-area-inset-top)) - (72px + env(safe-area-inset-bottom))) !important;
            width: 100vw !important;
            z-index: 50 !important;
            background-color: #ffffff !important;
            display: flex !important;
            flex-direction: column !important;
            overflow: hidden !important;
          }
          .mobile-chat-feed {
            flex: 1 !important;
            overflow-y: auto !important;
            -webkit-overflow-scrolling: touch !important;
            overscroll-behavior-y: contain !important;
          }
          .mobile-chat-composer {
            padding-top: 12px !important;
            padding-bottom: 12px !important;
            padding-left: 16px !important;
            padding-right: 16px !important;
            background-color: #ffffff !important;
            border-top: 1px solid #f3f4f6 !important;
          }
        }
      ` }} />

      {/* Roster / Sidebar - Hidden on mobile if chat is active */}
      <div 
        className={activeChatId ? "hidden md:flex flex-col w-1/3 max-w-[350px] min-w-[250px] border-r border-gray-200 h-full overflow-y-auto bg-white" : "flex flex-col w-full md:w-1/3 md:max-w-[350px] md:min-w-[250px] border-r border-gray-200 h-full overflow-y-auto bg-white"}
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
                  <Link
                    key={conv.id}
                    href={`?chat=${conv.id}`}
                    className={`w-full flex items-center gap-3 p-4 text-left cursor-pointer transition-colors duration-200 border-l-4 ${
                      isActive 
                        ? 'bg-gray-100 border-blue-900' 
                        : 'hover:bg-gray-50 border-transparent'
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
                        {lastMessages[conv.id] || partner.currentRole || 'No messages yet'}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Active Stage - Hidden on mobile if no active chat */}
      <div 
        className={activeChatId ? "mobile-chat-container grid grid-rows-[auto_1fr_auto] h-[100dvh] md:h-full w-full md:flex-1 overflow-hidden bg-white min-w-0 pb-0" : "hidden md:grid md:grid-rows-[auto_1fr_auto] md:h-full md:flex-1 overflow-hidden bg-white min-w-0 md:pb-0"}
      >
        {activeConv && activePartner ? (
          <>
            {/* Chat stage header */}
            <div className="row-start-1 flex-none border-b border-gray-200 bg-white p-4 z-20 flex items-center justify-between shadow-sm">
              <div className="flex items-center min-w-0">
                {/* Back button on mobile */}
                <button
                  onClick={() => router.push('/messages')}
                  className="md:hidden mr-2 p-2 text-gray-500 hover:text-[#002b4e] rounded-lg hover:bg-gray-100 transition-colors"
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
            <div className="mobile-chat-feed row-start-2 overflow-y-auto p-4 flex flex-col space-y-4 no-scrollbar">
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
                  {messages.map((message) => {
                    const isOwn = message.sender_id === currentUser.id;
                    
                    return (
                      <div
                        key={message.id}
                        className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                      >
                        <div className={`max-w-[70%] flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}>
                          {/* Message bubble */}
                          <div
                            className={`p-3.5 text-sm leading-relaxed shadow-sm transition-all break-words whitespace-pre-wrap ${
                              isOwn
                                ? 'bg-blue-900 text-white rounded-2xl rounded-br-none'
                                : 'bg-gray-100 text-gray-800 rounded-2xl rounded-bl-none'
                            }`}
                          >
                            <p className="whitespace-pre-wrap break-words">{message.body}</p>
                          </div>
                          
                          {/* Timestamp */}
                          <span className="text-[10px] text-gray-400 mt-1.5 font-medium px-1">
                            {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
              className="mobile-chat-composer row-start-3 shrink-0 border-t border-gray-100 bg-white px-4 pt-4 pb-[100px] md:pb-4 z-20 flex items-center gap-3"
            >
              <input
                type="text"
                placeholder="Type your message..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                disabled={sending}
                className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 placeholder-gray-400 outline-none focus:border-[#002b4e] transition-colors"
              />
              <button
                type="submit"
                disabled={!newMessage.trim() || sending}
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
