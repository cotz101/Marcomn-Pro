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
  ExternalLink,
  Trash2
} from 'lucide-react';

export default function InboxPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeChatId = searchParams.get('chat');
  const activeAppId = searchParams.get('application');

  const { userId, profile: currentUserProfile, showToast, currentIdentity } = useProfile();
  const currentUser = { id: userId };
  
  const [conversations, setConversations] = useState([]);
  const [profiles, setProfiles] = useState({}); // map of userId -> profile data
  const [lastMessages, setLastMessages] = useState({}); // map of conversationId -> message string
  const [activeTab, setActiveTab] = useState('direct'); // 'direct', 'applications', 'groups'
  const [groupThreads, setGroupThreads] = useState([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [groupProfilesMap, setGroupProfilesMap] = useState({});

  const [appThreads, setAppThreads] = useState([]);
  const [loadingApps, setLoadingApps] = useState(false);
  const [activeAppThread, setActiveAppThread] = useState(null);

  const [searchTerm, setSearchTerm] = useState('');

  // Auto-switch tabs based on URL
  useEffect(() => {
    if (currentIdentity?.type === 'company') {
      setActiveTab('applications');
    } else {
      if (activeAppId) setActiveTab('applications');
      else if (activeChatId) setActiveTab('direct');
    }
  }, [activeAppId, activeChatId, currentIdentity?.type]);
  
  const [loading, setLoading] = useState(true);
  
  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);

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
    let isActive = true;

    if (currentIdentity?.isCompany || currentIdentity?.type === 'company') {
      setConversations([]);
      setProfiles({});
      setLastMessages({});
      setLoading(false);
      return;
    }

    async function loadInbox() {
      try {
        setLoading(true);
        // Fetch conversations
        const { data: convData, error: convError } = await supabase
          .from('conversations')
          .select('*')
          .or(`participant_one.eq.${userId},participant_two.eq.${userId}`)
          .order('created_at', { ascending: false });

        if (!isActive) return;
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

  // 2.2 Fetch App Threads
  useEffect(() => {
    if (activeTab !== 'applications' || !userId) return;
    let isActive = true;
    setAppThreads([]);

    async function loadAppThreads() {
      try {
        setLoadingApps(true);

        // Auto-create thread if missing and activeAppId present
        if (activeAppId) {
          const { data: existing } = await supabase
            .from('application_threads')
            .select('id')
            .eq('application_id', activeAppId)
            .maybeSingle();

          if (!existing) {
            const { data: appData } = await supabase
              .from('applications')
              .select('id, applicant_id, job:jobs!job_id(user_id, company_id)')
              .eq('id', activeAppId)
              .maybeSingle();

            if (appData && appData.job) {
              await supabase.from('application_threads').insert({
                application_id: activeAppId,
                applicant_id: appData.applicant_id,
                poster_user_id: appData.job.user_id,
                company_id: appData.job.company_id || null
              });
            }
          }
        }

        // Fetch threads
        const { data: threads, error } = await supabase
          .from('application_threads')
          .select('*, application:applications(status), job:jobs(title), applicant:profiles!applicant_id(name, avatar_url, currentRole), poster:profiles!poster_user_id(name, avatar_url, currentRole), company:companies!company_id(name, logo_url, industry)')
          .or(`applicant_id.eq.${userId},poster_user_id.eq.${userId}`)
          .order('last_message_at', { ascending: false });

        if (!isActive) return;

        if (!error && threads) {
          const isComp = currentIdentity?.isCompany || currentIdentity?.type === 'company';
          const filteredThreads = threads.filter(t => {
            if (isComp) {
              return t.company_id === currentIdentity.id;
            } else {
              return t.applicant_id === userId || (t.poster_user_id === userId && !t.company_id);
            }
          });
          setAppThreads(filteredThreads);
          if (activeAppId) {
            const active = filteredThreads.find(t => t.application_id === activeAppId);
            setActiveAppThread(active || null);
          }
        }
      } catch (err) {
        console.error('Error app threads:', err);
      } finally {
        if (isActive) setLoadingApps(false);
      }
    }
    loadAppThreads();

    return () => {
      isActive = false;
    };
  }, [activeTab, userId, activeAppId, currentIdentity?.id, currentIdentity?.type, currentIdentity?.isCompany]);

  // Fetch Group Threads (Restored from M1)
  useEffect(() => {
    if (activeTab !== 'groups' || !userId) return;

    async function loadGroupThreads() {
      if (currentIdentity?.type === 'company') {
        setGroupThreads([]);
        setLoadingGroups(false);
        return;
      }

      try {
        setLoadingGroups(true);
        
        // 1. Fetch user's joined groups using user_id
        const { data: memberships } = await supabase
          .from('group_members')
          .select('group_id, status')
          .eq('user_id', userId);
          
        // 2. Fetch owned groups
        const { data: ownedGroups } = await supabase
          .from('groups')
          .select('id')
          .eq('owner_id', userId);

        const groupIdsSet = new Set();
        
        if (ownedGroups) {
          ownedGroups.forEach(g => groupIdsSet.add(g.id));
        }
        
        if (memberships) {
          memberships.forEach(m => {
            if (m.status !== 'pending' && m.status !== 'rejected') {
              groupIdsSet.add(m.group_id);
            }
          });
        }

        if (groupIdsSet.size === 0) {
          setGroupThreads([]);
          setLoadingGroups(false);
          return;
        }

        const groupIds = Array.from(groupIdsSet);
        
        // Fetch threads. Note: Supabase JS doesn't support complex COALESCE order by.
        // We order by last_message_at, then created_at.
        const { data: threads, error } = await supabase
          .from('group_threads')
          .select('*, group:groups(name)')
          .in('group_id', groupIds)
          .order('last_message_at', { ascending: false, nullsFirst: false })
          .order('created_at', { ascending: false });

        if (error) throw error;

        // Fetch authors
        const authorIds = [...new Set(threads.map(t => t.created_by))];
        const { data: profilesData } = await supabase.from('profiles').select('id, name, avatar_url').in('id', authorIds);
        
        const profMap = {};
        if (profilesData) {
          profilesData.forEach(p => profMap[p.id] = p);
        }
        setGroupProfilesMap(profMap);
        setGroupThreads(threads || []);
      } catch (err) {
        console.error('Error group threads:', err);
      } finally {
        setLoadingGroups(false);
      }
    }
    loadGroupThreads();
  }, [activeTab, userId]);

  // 2.3 Fetch App Messages
  useEffect(() => {
    if (activeTab !== 'applications') {
      if (activeTab === 'applications') setMessages([]);
      return;
    }
    if (!activeAppThread) return;

    async function loadAppMessages() {
      try {
        setLoadingMessages(true);
        const { data, error } = await supabase
          .from('application_messages')
          .select('*')
          .eq('thread_id', activeAppThread.id)
          .order('created_at', { ascending: true });
        if (!error) setMessages(data || []);
      } finally {
        setLoadingMessages(false);
      }
    }
    loadAppMessages();
  }, [activeAppThread, activeTab]);

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

  // 3.5 Realtime for Application Messages
  useEffect(() => {
    if (!activeAppThread || activeTab !== 'applications') return;

    const channel = supabase
      .channel(`public:app_messages:${activeAppThread.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'application_messages' },
        (payload) => {
          if (payload.new.thread_id === activeAppThread.id) {
            setMessages((prev) => {
              if (prev.some(m => m.id === payload.new.id)) return prev;
              return [...prev, payload.new];
            });
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [activeAppThread, activeTab]);

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
    if (!newMessage.trim() || !currentUser.id || sending) return;

    if (activeTab === 'applications' && activeAppThread) {
      const isCompanyIdentity = currentIdentity?.type === 'company';
      const isThreadCompanyOwned = !!activeAppThread.company_id;
      const isApplicant = activeAppThread.applicant_id === currentUser.id;
      
      if (isCompanyIdentity) {
        if (activeAppThread.company_id !== currentIdentity.id) {
          showToast("You cannot reply to this thread from this company identity.", "error");
          return;
        }
      } else {
        if (!isApplicant && isThreadCompanyOwned) {
          showToast("Please switch to your company profile to reply to this applicant.", "error");
          return;
        }
      }

      try {
        setSending(true);
        const { data, error } = await supabase.from('application_messages').insert({
          thread_id: activeAppThread.id,
          sender_id: currentUser.id,
          body: newMessage.trim()
        }).select().maybeSingle();

        if (error) throw error;
        setNewMessage('');
        setMessages(prev => prev.some(m => m.id === data.id) ? prev : [...prev, data]);

        // --- Application Message Notification Block ---
        const recipientId = activeAppThread.applicant_id === currentUser.id 
          ? activeAppThread.poster_user_id 
          : activeAppThread.applicant_id;

        const isSenderApplicant = activeAppThread.applicant_id === currentUser.id;
        const senderDisplayType = (!isSenderApplicant && activeAppThread.company_id) ? 'company' : 'personal';
        const senderDisplayName = senderDisplayType === 'company' ? activeAppThread.company?.name : currentUserProfile?.name;
        const senderAvatarUrl = senderDisplayType === 'company' ? activeAppThread.company?.logo_url : currentUserProfile?.avatar_url;

        try {
          // Gatekeeper checks
          const [{ data: settings }, { data: profile }] = await Promise.all([
            supabase.from('notification_settings').select('messaging_enabled').eq('user_id', recipientId).maybeSingle(),
            supabase.from('profiles').select('inbox_privacy').eq('id', recipientId).maybeSingle()
          ]);

          const isMuted = settings && settings.messaging_enabled === false;
          const isPrivate = profile && profile.inbox_privacy === 'private';

          if (!isMuted && !isPrivate) {
            await supabase.from('notifications').insert([{
              recipient_id: recipientId,
              sender_id: currentUser.id,
              type: 'application_message',
              title: 'New Application Message',
              body: `${senderDisplayName || 'Someone'} sent you a message about ${activeAppThread.job?.title || 'an application'}.`,
              link: `/messages?application=${activeAppThread.application_id}`,
              is_read: false,
              metadata: {
                notification_type: 'application_message',
                application_id: activeAppThread.application_id,
                thread_id: activeAppThread.id,
                company_id: activeAppThread.company_id || null,
                sender_display_type: senderDisplayType,
                sender_display_name: senderDisplayName,
                sender_avatar_url: senderAvatarUrl
              }
            }]);
          }
        } catch (notifErr) {
          console.error('DEBUG: Application notification gatekeeper exception:', notifErr);
        }
        // --- End Application Message Notification Block ---

      } catch (err) {
        console.error(err);
        showToast(err.message || 'Failed to send message', 'error');
      } finally {
        setSending(false);
      }
      return;
    }

    if (!activeChatId) return;

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

  const handleDeleteAppThread = async () => {
    if (!activeAppThread) return;
    if (!window.confirm("Delete this application conversation? This will remove all messages in this thread.")) return;
    
    try {
      const { error: msgErr } = await supabase.from('application_messages').delete().eq('thread_id', activeAppThread.id);
      if (msgErr) throw msgErr;

      const { error } = await supabase.from('application_threads').delete().eq('id', activeAppThread.id);
      if (error) throw error;
      
      setAppThreads(prev => prev.filter(t => t.id !== activeAppThread.id));
      setActiveAppThread(null);
      showToast('Conversation deleted', 'success');
      router.push('/messages'); // clear the ?application parameter
    } catch (err) {
      console.error('Delete failed:', err);
      showToast('Failed to delete conversation', 'error');
    }
  };

  const handleDeleteDirectThread = async () => {
    if (!activeConv) return;
    if (!window.confirm("Delete this conversation?")) return;
    
    try {
      // Safely delete messages first in case ON DELETE CASCADE is missing
      const { error: msgError } = await supabase.from('messages').delete().eq('conversation_id', activeConv.id);
      if (msgError) throw msgError;

      const { error } = await supabase.from('conversations').delete().eq('id', activeConv.id);
      if (error) throw error;
      
      setConversations(prev => prev.filter(c => c.id !== activeConv.id));
      showToast('Conversation deleted', 'success');
      router.push('/messages'); // clear the ?chat parameter
    } catch (err) {
      console.error('Delete failed:', err);
      showToast('Failed to delete conversation', 'error');
    }
  };

  const activeConv = conversations.find(c => c.id === activeChatId);
  const activePartner = activeConv ? getOtherParticipantProfile(activeConv) : null;


  let activeAppPartner = null;
  if (activeAppThread && currentUser) {
    const isApplicant = activeAppThread.applicant_id === currentUser.id;
    activeAppPartner = isApplicant 
      ? (activeAppThread.company ? { name: activeAppThread.company.name, avatar_url: activeAppThread.company.logo_url, currentRole: activeAppThread.company.industry || 'Company' } : activeAppThread.poster) 
      : activeAppThread.applicant;
  }

  return (
    <div className="flex flex-col w-full h-full flex-1 bg-white overflow-hidden">
      <div className="flex flex-row flex-1 min-h-0 w-full bg-white overflow-hidden">


      <div 
        className={(activeChatId || activeAppId) 
          ? "hidden md:flex flex-col w-1/3 lg:w-1/4 border-r border-gray-200 overflow-hidden bg-white h-full min-h-0" 
          : "flex flex-col w-full md:w-1/3 lg:w-1/4 border-r border-gray-200 overflow-hidden bg-white h-full min-h-0"
        }
      >
        {/* Search header */}
        <div className="flex-none border-b p-4">
          <h1 className="text-xl font-extrabold text-[#002b4e] mb-4">Messages</h1>

          {/* Messaging Hub Tabs */}
          <div className="flex bg-gray-100 p-1 rounded-lg mb-4">
            {currentIdentity?.type !== 'company' && (
              <button
                onClick={() => { setActiveTab('direct'); router.push('/messages'); }}
                className={`flex-1 py-1.5 text-sm font-bold rounded-md transition-colors ${activeTab === 'direct' ? 'bg-white text-[#002b4e] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Direct
              </button>
            )}
            <button
              onClick={() => { setActiveTab('applications'); router.push('/messages'); }}
              className={`flex-1 py-1.5 text-sm font-bold rounded-md transition-colors ${activeTab === 'applications' ? 'bg-white text-[#002b4e] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Applications
            </button>
            {currentIdentity?.type !== 'company' && (
              <button
                onClick={() => { setActiveTab('groups'); router.push('/messages'); }}
                className={`flex-1 py-1.5 text-sm font-bold rounded-md transition-colors ${activeTab === 'groups' ? 'bg-white text-[#002b4e] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Groups
              </button>
            )}
          </div>

          <div className="relative flex items-center bg-gray-50 border border-gray-200 rounded-xl px-3 py-2">
            <Search size={18} className="text-gray-400 mr-2 flex-shrink-0" />
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-transparent text-base text-gray-700 placeholder-gray-400 outline-none border-none"
            />
          </div>
        </div>

        {/* Conversation List */}
        <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400 space-y-3">
              <Loader2 className="animate-spin text-[#002b4e]" size={28} />
              <span className="text-base font-medium">Loading conversations...</span>
            </div>
          ) : activeTab === 'applications' ? (
            <>
              {loadingApps ? (
                <div className="flex flex-col items-center justify-center py-12 text-gray-400 space-y-3">
                  <Loader2 className="animate-spin text-[#002b4e]" size={28} />
                  <span className="text-base font-medium">Loading applications...</span>
                </div>
              ) : appThreads.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-8 text-center text-gray-400 mt-12">
                  <MessageSquare size={44} className="text-gray-300 mb-3" />
                  <p className="text-base font-semibold text-gray-600">No application conversations yet.</p>
                  <p className="text-sm text-gray-400 mt-1">Company applications will appear here.</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {appThreads.filter(t => t.job?.title?.toLowerCase().includes(searchTerm.toLowerCase())).map((thread) => {
                    const isApplicant = thread.applicant_id === currentUser.id;
                    const partner = isApplicant 
                      ? (thread.company ? { name: thread.company.name, avatar_url: thread.company.logo_url, currentRole: thread.company.industry || 'Company' } : thread.poster) 
                      : thread.applicant;
                    const isActive = activeAppId === thread.application_id;

                    return (
                      <Link
                        key={thread.id}
                        href={`?application=${thread.application_id}`}
                        className={`w-full flex flex-col gap-1 p-4 text-left cursor-pointer transition-colors duration-200 border-l-4 ${
                          isActive ? 'bg-gray-100 border-blue-900' : 'hover:bg-gray-50 border-transparent'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black uppercase tracking-wider text-blue-600 truncate">{partner?.name || 'Unknown'}</span>
                          <span className="text-[10px] text-gray-400 font-medium shrink-0">
                            {new Date(thread.last_message_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                          </span>
                        </div>
                        <h2 className="text-sm font-bold text-[#002b4e] truncate mt-0.5">
                          {thread.job?.title || 'Job'}
                        </h2>
                        {thread.application?.status && (
                          <span className="inline-block mt-1 text-[10px] font-bold px-2 py-0.5 bg-gray-200 text-gray-700 rounded w-max">
                            {thread.application.status}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              )}
            </>
          ) : activeTab === 'groups' ? (
            <>
              {loadingGroups ? (
                <div className="flex flex-col items-center justify-center py-12 text-gray-400 space-y-3">
                  <Loader2 className="animate-spin text-[#002b4e]" size={28} />
                  <span className="text-base font-medium">Loading groups...</span>
                </div>
              ) : groupThreads.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-8 text-center text-gray-400 mt-12">
                  <MessageSquare size={44} className="text-gray-300 mb-3" />
                  <p className="text-base font-semibold text-gray-600">
                    {currentIdentity?.type === 'company' ? 'Company groups not supported yet' : 'No group discussions'}
                  </p>
                  <p className="text-sm text-gray-400 mt-1">
                    {currentIdentity?.type === 'company' ? 'Switch to your personal profile to access your groups.' : 'Join a group to see discussions here.'}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {groupThreads.filter(t => t.title.toLowerCase().includes(searchTerm.toLowerCase())).map((thread) => {
                    const author = groupProfilesMap[thread.created_by] || { name: 'Member' };
                    return (
                      <Link
                        key={thread.id}
                        href={`/groups/${thread.group_id}?thread=${thread.id}`}
                        className="w-full flex flex-col gap-1 p-4 text-left cursor-pointer transition-colors duration-200 border-l-4 hover:bg-gray-50 border-transparent"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black uppercase tracking-wider text-blue-600 truncate">{thread.group?.name || 'Group'}</span>
                          <span className="text-[10px] text-gray-400 font-medium shrink-0">
                            {new Date(thread.last_message_at || thread.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                          </span>
                        </div>
                        <h2 className="text-sm font-bold text-[#002b4e] truncate mt-0.5">
                          {thread.title}
                        </h2>
                        <div className="flex items-center gap-2 mt-1">
                          {author.avatar_url ? (
                            <img src={author.avatar_url} className="w-5 h-5 rounded-full object-cover" alt="Avatar" />
                          ) : (
                            <div className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center text-[10px] font-bold text-gray-500">
                              {author.name.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <p className="text-xs text-gray-500 truncate">
                            <span className="font-medium text-gray-700">{author.name}</span> started thread
                          </p>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </>
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
                        <h2 className="text-base font-bold text-[#002b4e] truncate">
                          {partner.name}
                        </h2>
                        <span className="text-xs text-gray-400 font-medium">
                          {new Date(conv.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 truncate mt-0.5">
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

      <div 
        className={(activeChatId || activeAppId) 
          ? "flex-1 flex flex-col h-full bg-white w-full overflow-hidden min-h-0" 
          : "hidden md:flex flex-1 flex-col h-full bg-white overflow-hidden min-h-0"
        }
      >
        {(activeTab === 'applications' && activeAppThread) ? (
          <>
            {/* Chat stage header for App Thread */}
            <header className="flex-none w-full bg-white border-b border-gray-200 z-10 flex items-center justify-between px-4 py-3 min-h-[64px]">
              <div className="flex items-center min-w-0 ml-4">
                <button 
                  onClick={() => router.push('/messages')}
                  className="mr-2 p-1 text-gray-500 hover:text-[#002b4e] md:hidden"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <div className="flex items-center gap-3">
                  {activeAppPartner?.avatar_url ? (
                    <img 
                      src={activeAppPartner.avatar_url} 
                      alt="Avatar" 
                      className="h-10 w-10 rounded-full object-cover" 
                    />
                  ) : (
                    <div className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center border border-gray-200 text-gray-500 font-bold">
                      {activeAppPartner?.name?.charAt(0).toUpperCase() || 'U'}
                    </div>
                  )}
                  <div className="flex flex-col min-w-0">
                    <h2 className="text-base font-bold text-[#002b4e] truncate">{activeAppThread.job?.title || 'Application'}</h2>
                    <p className="text-sm text-gray-500 truncate">{activeAppPartner?.name || 'Unknown'}</p>
                  </div>
                </div>
              </div>
              <button 
                onClick={handleDeleteAppThread}
                className="mr-[10px] p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors shrink-0"
                title="Delete Conversation"
              >
                <Trash2 size={20} />
              </button>
            </header>

            {/* Message Feed */}
            <main className="flex-1 min-h-0 overflow-y-auto w-full bg-gray-50 p-4 scroll-smooth flex flex-col space-y-4 no-scrollbar">
              {loadingMessages ? (
                <div className="flex flex-col items-center justify-center h-full py-12 text-gray-400 space-y-3">
                  <Loader2 className="animate-spin text-[#002b4e]" size={28} />
                  <span className="text-base font-medium">Loading messages...</span>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full py-12 text-center text-gray-400">
                  <MessageSquare size={36} className="text-gray-300 mb-2" />
                  <p className="text-base font-semibold text-gray-500">No messages yet</p>
                  <p className="text-sm text-gray-400 mt-1">Send a message to start the conversation.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {messages.map((message) => {
                    const isOwn = message.sender_id === currentUser.id;
                    
                    return (
                      <div
                        key={message.id}
                        className={`flex w-full px-2 ${isOwn ? 'justify-end' : 'justify-start'}`}
                      >
                        {!isOwn && (
                          <div className="mr-2 flex-shrink-0 mt-auto mb-5">
                            {activeAppPartner?.avatar_url ? (
                              <img src={activeAppPartner.avatar_url} className="w-6 h-6 rounded-full object-cover" alt="Sender Avatar" />
                            ) : (
                              <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-[10px] font-bold text-gray-500">
                                {activeAppPartner?.name?.charAt(0).toUpperCase() || 'U'}
                              </div>
                            )}
                          </div>
                        )}
                        <div className={`max-w-[85%] flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}>
                          {/* Sender name for partner */}
                          {!isOwn && (
                            <span className="text-[10px] text-gray-400 font-medium ml-1 mb-0.5">
                              {activeAppPartner?.name || 'Unknown'}
                            </span>
                          )}
                          <div
                            className={`px-4 py-2 text-[1.1rem] leading-relaxed shadow-sm transition-all break-words whitespace-pre-wrap ${
                              isOwn
                                ? 'bg-blue-950 text-white rounded-2xl rounded-tr-none'
                                : 'bg-gray-100 text-gray-900 rounded-2xl rounded-tl-none'
                            }`}
                          >
                            <p className="whitespace-pre-wrap break-words">{message.body}</p>
                          </div>
                          
                          <span className="text-xs text-gray-400 mt-0.5 font-medium px-1">
                            {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={chatEndRef} />
                </div>
              )}
            </main>

            <form 
              onSubmit={handleSendMessage}
              className="flex-none w-full bg-white border-t border-gray-200 z-20 flex items-center gap-3 pl-4 pr-5 md:pr-6 pt-4 pb-2 messages-composer"
            >
              <input
                type="text"
                placeholder="Type your message..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                disabled={sending}
                className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-base text-gray-700 placeholder-gray-400 outline-none focus:border-[#002b4e] transition-colors"
              />
              <button
                type="submit"
                disabled={!newMessage.trim() || sending}
                className="bg-blue-600 hover:bg-blue-700 text-white p-2.5 rounded-full min-w-[44px] min-h-[44px] flex items-center justify-center font-bold transition-all duration-150 shadow-sm disabled:opacity-40 cursor-pointer shrink-0"
              >
                {sending ? (
                  <Loader2 className="animate-spin" size={18} />
                ) : (
                  <Send size={18} className="ml-0.5" />
                )}
              </button>
            </form>
          </>
        ) : activeConv && activePartner && activeTab === 'direct' ? (
          <>
            {/* Chat stage header – sits cleanly below the sticky app header */}
            <header className="flex-none w-full bg-white border-b border-gray-200 z-10 flex items-center justify-between px-4 py-3 min-h-[64px]">
              <div className="flex items-center min-w-0 ml-4">
                <button 
                  onClick={() => router.push('/messages')}
                  className="mr-2 p-1 text-gray-500 hover:text-[#002b4e] md:hidden"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <div className="flex items-center gap-3">
                  {activePartner.avatar_url ? (
                    <img 
                      src={activePartner.avatar_url} 
                      alt="User Avatar" 
                      className="h-10 w-10 rounded-full object-cover" 
                    />
                  ) : (
                    <div className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center border border-gray-200 text-gray-500 font-bold">
                      {activePartner.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="flex flex-col min-w-0">
                    <h2 className="text-base font-bold text-[#002b4e] truncate">{activePartner.name}</h2>
                    <p className="text-sm text-gray-500 truncate">{activePartner.currentRole || 'Maritime Member'}</p>
                  </div>
                </div>
              </div>
              <button 
                onClick={() => router.push(`/profile/${activePartner.id}`)}
                className="mr-[10px] rounded-lg border border-gray-200 bg-gray-50 px-5 py-2.5 text-base font-bold text-gray-600 transition-colors hover:bg-gray-100 hover:text-[#002b4e] shrink-0"
              >
                View profile
              </button>
              <button 
                onClick={handleDeleteDirectThread}
                className="mr-[10px] p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors shrink-0"
                title="Delete Conversation"
              >
                <Trash2 size={20} />
              </button>
            </header>

            {/* Message Feed */}
            <main className="flex-1 min-h-0 overflow-y-auto w-full bg-gray-50 p-4 scroll-smooth flex flex-col space-y-4 no-scrollbar">
              {loadingMessages ? (
                <div className="flex flex-col items-center justify-center h-full py-12 text-gray-400 space-y-3">
                  <Loader2 className="animate-spin text-[#002b4e]" size={28} />
                  <span className="text-base font-medium">Loading messages...</span>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full py-12 text-center text-gray-400">
                  <MessageSquare size={36} className="text-gray-300 mb-2" />
                  <p className="text-base font-semibold text-gray-500">No messages yet</p>
                  <p className="text-sm text-gray-400 mt-1">Send a message to start the conversation.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {messages.map((message) => {
                    const isOwn = message.sender_id === currentUser.id;
                    
                    return (
                      <div
                        key={message.id}
                        className={`flex w-full px-2 ${isOwn ? 'justify-end' : 'justify-start'}`}
                      >
                        <div className={`max-w-[85%] flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}>
                          {/* Message bubble */}
                          <div
                            className={`px-4 py-2 text-[1.1rem] leading-relaxed shadow-sm transition-all break-words whitespace-pre-wrap ${
                              isOwn
                                ? 'bg-blue-950 text-white rounded-2xl rounded-tr-none'
                                : 'bg-gray-100 text-gray-900 rounded-2xl rounded-tl-none'
                            }`}
                          >
                            <p className="whitespace-pre-wrap break-words">{message.body}</p>
                          </div>
                          
                          {/* Timestamp */}
                          <span className="text-xs text-gray-400 mt-0.5 font-medium px-1">
                            {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={chatEndRef} />
                </div>
              )}
            </main>

            {/* Composer Footer – must sit above the mobile bottom nav + iOS safe-area */}
            <form 
              onSubmit={handleSendMessage}
              className="flex-none w-full bg-white border-t border-gray-200 z-20 flex items-center gap-3 pl-4 pr-5 md:pr-6 pt-4 pb-2 messages-composer"
            >
              <input
                type="text"
                placeholder="Type your message..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                disabled={sending}
                className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-base text-gray-700 placeholder-gray-400 outline-none focus:border-[#002b4e] transition-colors"
              />
              <button
                type="submit"
                disabled={!newMessage.trim() || sending}
                className="bg-blue-600 hover:bg-blue-700 text-white p-2.5 rounded-full min-w-[44px] min-h-[44px] flex items-center justify-center font-bold transition-all duration-150 shadow-sm disabled:opacity-40 cursor-pointer shrink-0"
              >
                {sending ? (
                  <Loader2 className="animate-spin" size={18} />
                ) : (
                  <Send size={18} className="ml-0.5" />
                )}
              </button>
            </form>
          </>
        ) : (
          /* Empty / Default Active Stage */
          <div className="row-start-1 row-span-3 flex flex-col items-center justify-center p-8 text-center bg-gray-50/50 md:flex-1 md:min-h-0">
            <div className="w-16 h-16 rounded-full bg-blue-50/80 flex items-center justify-center border border-blue-100 text-[#002b4e] mb-4 shadow-sm animate-pulse">
              <MessageSquare size={32} />
            </div>
            <h2 className="text-xl font-bold text-[#002b4e] mb-1">
              {activeTab === 'applications' ? 'Applications' : activeTab === 'groups' ? 'Groups' : 'Your Messages'}
            </h2>
            <p className="text-base text-gray-500 max-w-sm leading-relaxed">
              {activeTab === 'applications' ? 'Select an application thread to start chatting.' : activeTab === 'groups' ? 'Select a group thread to open it.' : 'Select a conversation from the sidebar roster or visit a partner profile to start a new chat.'}
            </p>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
