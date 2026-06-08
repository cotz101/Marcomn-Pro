'use client';

import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { 
  ChevronLeft, 
  MessageSquare, 
  Trash2, 
  Reply, 
  Send, 
  Plus, 
  Settings, 
  LogOut, 
  Users, 
  UserPlus, 
  Check, 
  X, 
  AlertTriangle 
} from 'lucide-react';
import DOMPurify from 'dompurify';
import { useProfile } from '@/app/context/ProfileContext';

export default function GroupPage({ groupId: propGroupId }) {
  const supabase = createClient();
  const searchParams = useSearchParams();
  const threadIdParam = searchParams.get('thread');

  // Resolve groupId from prop or fallback safely
  const [groupId, setGroupId] = useState(propGroupId);

  // Master State
  const [view, setView] = useState('list'); // 'list' | 'thread'
  const [activeThread, setActiveThread] = useState(null);
  const [groupName, setGroupName] = useState('Loading...');
  const [groupDescription, setGroupDescription] = useState('');
  const [memberCount, setMemberCount] = useState(0);
  const [memberAvatars, setMemberAvatars] = useState([]);
  const [ownerId, setOwnerId] = useState(null);
  const [isMember, setIsMember] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userId, setUserId] = useState(null);
  const [profilesMap, setProfilesMap] = useState({});

  // Modals & Management State
  const [showManageModal, setShowManageModal] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [userToKick, setUserToKick] = useState(null);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [currentMembers, setCurrentMembers] = useState([]);

  // Thread List State
  const [threads, setThreads] = useState([]);
  const [isCreatingThread, setIsCreatingThread] = useState(false);
  const [newThreadTitle, setNewThreadTitle] = useState('');
  const [newThreadMessage, setNewThreadMessage] = useState('');

  // Chat Room State
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [replyTarget, setReplyTarget] = useState(null);

  const messagesEndRef = useRef(null);
  const composerRef = useRef(null);

  const { currentIdentity } = useProfile();

  if (currentIdentity?.type === 'company') {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center text-gray-400 mt-20 w-full h-full">
        <AlertTriangle size={44} className="text-gray-300 mb-4" />
        <p className="text-lg font-semibold text-gray-600">Company groups not supported yet</p>
        <p className="text-sm text-gray-400 mt-1">Please switch to your personal profile to access this group.</p>
      </div>
    );
  }

  // Sync propGroupId if it changes
  useEffect(() => {
    if (propGroupId) {
      setGroupId(propGroupId);
    }
  }, [propGroupId]);

  // Initialize and Fetch Auth / Group details
  useEffect(() => {
    if (!groupId) return;

    const initGroupData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
      }

      // 1. Fetch Group Details
      const { data: group } = await supabase
        .from('groups')
        .select('*')
        .eq('id', groupId)
        .maybeSingle();

      if (!group) return;

      setGroupName(group.name);
      setGroupDescription(group.description || '');
      setOwnerId(group.owner_id);

      const adminCheck = user?.id === group.owner_id;
      setIsAdmin(adminCheck);

      // 2. Fetch Members
      const { data: membersData } = await supabase
        .from('group_members')
        .select('*')
        .eq('group_id', groupId);

      const membership = membersData?.find(m => m.user_id === user?.id);
      const isApprovedMember = membership?.status === 'member';

      // Security check: Only approved members or the owner can view this page
      if (!isApprovedMember && !adminCheck) {
        console.warn("Unauthorized access attempt. Redirecting to groups list.");
        window.location.href = '/groups';
        return;
      }

      setIsMember(isApprovedMember);

      // Extract details for member counter & avatar cascade
      if (membersData) {
        const approvedMembers = membersData.filter(m => m.status === 'member');
        setMemberCount(approvedMembers.length);

        const uids = approvedMembers.slice(0, 5).map(m => m.user_id);
        if (uids.length > 0) {
          const { data: profs } = await supabase
            .from('profiles')
            .select('avatar_url')
            .in('id', uids);
          setMemberAvatars(profs?.map(p => p.avatar_url).filter(Boolean) || []);
        }
      }

      // 3. Fetch Admin management data
      if (adminCheck && membersData) {
        const pendingUids = membersData.filter(m => m.status === 'pending').map(m => m.user_id);
        const joinedUids = membersData.filter(m => m.status === 'member').map(m => m.user_id);

        if (pendingUids.length > 0) {
          const { data: pProfs } = await supabase.from('profiles').select('id, name, avatar_url').in('id', pendingUids);
          setPendingRequests(pProfs || []);
        } else {
          setPendingRequests([]);
        }

        if (joinedUids.length > 0) {
          const { data: jProfs } = await supabase.from('profiles').select('id, name, avatar_url').in('id', joinedUids);
          setCurrentMembers(jProfs?.map(p => ({
            ...p,
            role: membersData.find(m => m.user_id === p.id)?.role || 'member'
          })) || []);
        } else {
          setCurrentMembers([]);
        }
      }

      // 4. Load Thread List
      loadThreads();
    };

    initGroupData();
  }, [groupId, supabase]);

  const profilesMapRef = useRef(profilesMap);
  useEffect(() => {
    profilesMapRef.current = profilesMap;
  }, [profilesMap]);

  // Real-time Chat Subscription
  useEffect(() => {
    let channel;
    if (view === 'thread' && activeThread) {
      console.log(`[Realtime] Creating channel for room:${activeThread.id}`);
      
      channel = supabase
        .channel(`room:${activeThread.id}`)
        .on('postgres_changes', { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'group_thread_messages', 
            filter: `thread_id=eq.${activeThread.id}` 
          }, 
          payload => {
            console.log('[Realtime] Payload received:', payload);
            console.log('[Realtime] payload.new.thread_id:', payload.new?.thread_id);
            console.log('[Realtime] activeThread.id:', activeThread.id);
            
            setMessages(prev => {
              // Duplicate prevention check
              if (prev.some(m => m.id === payload.new.id)) {
                console.log('[Realtime] Duplicate payload ignored:', payload.new.id);
                return prev;
              }
              
              if (!profilesMapRef.current[payload.new.user_id]) {
                fetchProfiles([payload.new.user_id]);
              }
              
              return [...prev, payload.new];
            });
          }
        )
        .subscribe((status) => {
          console.log(`[Realtime] Subscription status: ${status}`);
        });
    }

    return () => {
      if (channel) {
        console.log(`[Realtime] Removing channel for room:${activeThread?.id}`);
        supabase.removeChannel(channel);
      }
    };
  }, [view, activeThread, supabase]);

  // Auto-scroll reliability
  const scrollToBottom = (behavior = 'smooth') => {
    if (messagesEndRef.current) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior });
      }, 50);
    }
  };

  // Instant scroll on active thread open
  useEffect(() => {
    if (view === 'thread') {
      scrollToBottom('auto');
    }
  }, [view]);

  // Smooth scroll on incoming messages
  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom('smooth');
    }
  }, [messages]);

  // Lock body/html scroll and add active class when viewing a thread on mobile/desktop
  useEffect(() => {
    if (view === 'thread') {
      document.body.style.overflow = 'hidden';
      document.body.style.height = '100vh';
      document.documentElement.style.overflow = 'hidden';
      document.documentElement.style.height = '100vh';
      document.body.classList.add('in-group-thread-active');
    } else {
      document.body.style.overflow = '';
      document.body.style.height = '';
      document.documentElement.style.overflow = '';
      document.documentElement.style.height = '';
      document.body.classList.remove('in-group-thread-active');
    }
    return () => {
      document.body.style.overflow = '';
      document.body.style.height = '';
      document.documentElement.style.overflow = '';
      document.documentElement.style.height = '';
      document.body.classList.remove('in-group-thread-active');
    };
  }, [view]);

  const fetchProfiles = async (userIds) => {
    const missingIds = userIds.filter(id => !profilesMap[id] && id);
    if (missingIds.length === 0) return;

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, name, avatar_url')
      .in('id', missingIds);

    if (profiles) {
      setProfilesMap(prev => {
        const newMap = { ...prev };
        profiles.forEach(p => newMap[p.id] = p);
        return newMap;
      });
    }
  };

  const loadThreads = async () => {
    if (!groupId) return;
    const { data: pData } = await supabase
      .from('group_threads')
      .select('*')
      .eq('group_id', groupId)
      .eq('is_deleted', false)
      .eq('is_archived', false)
      .order('last_message_at', { ascending: false })
      .order('created_at', { ascending: false });
    
    if (pData) {
      setThreads(pData);
      const uids = [...new Set(pData.map(p => p.created_by))];
      fetchProfiles(uids);

      // Auto-open thread if threadIdParam is present
      if (threadIdParam && view !== 'thread') {
        const targetThread = pData.find(t => t.id === threadIdParam);
        if (targetThread) {
          openThread(targetThread);
        }
      }
    }
  };

  const loadMessages = async (threadId) => {
    const { data: mData } = await supabase
      .from('group_thread_messages')
      .select('*')
      .eq('thread_id', threadId)
      .eq('is_deleted', false)
      .order('created_at', { ascending: true });
    
    if (mData) {
      setMessages(mData);
      const uids = [...new Set(mData.map(m => m.user_id))];
      fetchProfiles(uids);
    }
  };

  const handleCreateThread = async () => {
    if (!newThreadTitle.trim() || !groupId) return;
    setIsSending(true);

    try {
      const threadTitle = newThreadTitle.trim();
      const initialMessageContent = newThreadMessage.trim();

      // 1. Fetch the authenticated Supabase user directly before insert
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error("Authentication failed: " + (userError?.message || "User is not logged in"));
      }

      // 2. Client-generate the thread UUID to maintain perfect ID parity across dual-writes
      const threadId = (typeof crypto !== 'undefined' && crypto.randomUUID) 
        ? crypto.randomUUID() 
        : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
          });

      // 3. Construct the explicit payload as required
      const threadPayload = {
        id: threadId,
        group_id: groupId,
        created_by: user.id,
        title: threadTitle,
        is_deleted: false,
        is_archived: false
      };

      // 4. Temporarily console.log credentials before writing to the database
      console.log("Auth User ID:", user.id);
      console.log("Thread Insert Payload:", threadPayload);

      // Confirm assertion: threadPayload.created_by === user.id (validated by design above)

      // DUAL WRITE: A. Write to the new primary normalized table `group_threads`
      const { data: newThread, error: newThreadError } = await supabase
        .from('group_threads')
        .insert([threadPayload])
        .select()
        .maybeSingle();

      if (newThreadError) throw newThreadError;

      // DUAL WRITE: B. Mirror legacy write to `group_posts` (Coherent ID mapping!)
      const { error: legacyThreadError } = await supabase
        .from('group_posts')
        .insert([{
          id: threadId,
          group_id: groupId,
          user_id: user.id,
          content: threadTitle
        }]);

      if (legacyThreadError) {
        console.warn('⚠️ Legacy thread mirroring failed:', legacyThreadError.message);
      }

      // If an initial message was provided:
      if (initialMessageContent) {
        const messageId = (typeof crypto !== 'undefined' && crypto.randomUUID) 
          ? crypto.randomUUID() 
          : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
              var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
              return v.toString(16);
            });

        // DUAL WRITE: C. Write to the new primary normalized table `group_thread_messages`
        const { data: newMessage, error: newMessageError } = await supabase
          .from('group_thread_messages')
          .insert([{
            id: messageId,
            thread_id: threadId,
            user_id: user.id,
            content: initialMessageContent
          }])
          .select()
          .maybeSingle();

        if (newMessageError) throw newMessageError;

        // DUAL WRITE: D. Mirror legacy write to `group_comments` (Coherent ID mapping!)
        const { error: legacyMessageError } = await supabase
          .from('group_comments')
          .insert([{
            id: messageId,
            post_id: threadId,
            user_id: user.id,
            content: initialMessageContent,
            author_name: profilesMap[user.id]?.name || 'Member'
          }]);

        if (legacyMessageError) {
          console.warn('⚠️ Legacy message mirroring failed:', legacyMessageError.message);
        }
      }

      setNewThreadTitle('');
      setNewThreadMessage('');
      setIsCreatingThread(false);
      loadThreads(); // Reload UI thread list
    } catch (error) {
      alert('Error creating thread: ' + error.message);
    } finally {
      setIsSending(false);
    }
  };

  const handleDeleteThread = async (threadId, e) => {
    e.stopPropagation();
    if (!confirm('Delete this entire thread?')) return;
    
    setThreads(prev => prev.filter(t => t.id !== threadId));

    try {
      // DUAL WRITE: A. Perform soft-delete on the new primary normalized table `group_threads`
      const { error: newDeleteError } = await supabase
        .from('group_threads')
        .update({ is_deleted: true })
        .eq('id', threadId);

      if (newDeleteError) throw newDeleteError;

      // DUAL WRITE: B. Mirror delete to `group_posts` (Safe to hard-delete for legacy compatibility)
      const { error: legacyDeleteError } = await supabase
        .from('group_posts')
        .delete()
        .eq('id', threadId);

      if (legacyDeleteError) {
        console.warn('⚠️ Legacy thread delete mirroring failed:', legacyDeleteError.message);
      }

      if (activeThread?.id === threadId) {
        closeThread();
      }
    } catch (error) {
      alert('Error deleting thread: ' + error.message);
    }
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim() || !activeThread) return;
    setIsSending(true);

    const messageContent = chatInput.trim();

    try {
      // Fetch the authenticated Supabase user directly before message insert
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error("Authentication failed: " + (userError?.message || "User is not logged in"));
      }

      // Client-generate the message UUID to maintain perfect ID parity across dual-writes
      const messageId = (typeof crypto !== 'undefined' && crypto.randomUUID) 
        ? crypto.randomUUID() 
        : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
          });

      // DUAL WRITE: A. Write to the new primary normalized table `group_thread_messages`
      const replyContext = replyTarget ? {
        reply_to_message_id: replyTarget.id,
        reply_author_name: replyTarget.author,
        reply_preview: replyTarget.snippet
      } : {};

      const { data: newMessage, error: newMessageError } = await supabase
        .from('group_thread_messages')
        .insert([{
          id: messageId,
          thread_id: activeThread.id,
          user_id: user.id,
          content: messageContent,
          ...replyContext
        }])
        .select()
        .maybeSingle();

      if (newMessageError) throw newMessageError;

      // DUAL WRITE: B. Mirror legacy write to `group_comments` (Coherent ID mapping!)
      const { error: legacyMessageError } = await supabase
        .from('group_comments')
        .insert([{
          id: messageId,
          post_id: activeThread.id,
          user_id: user.id,
          content: messageContent,
          author_name: profilesMap[user.id]?.name || 'Member'
        }]);

      if (legacyMessageError) {
        console.warn('⚠️ Legacy message mirroring failed:', legacyMessageError.message);
      }

      // Optimistic append
      const localData = {
        id: messageId,
        thread_id: activeThread.id,
        user_id: user.id,
        content: messageContent,
        created_at: newMessage ? newMessage.created_at : new Date().toISOString(),
        ...replyContext
      };

      setMessages(prev => {
        if (prev.some(m => m.id === localData.id)) return prev;
        return [...prev, localData];
      });
      
      setChatInput('');
      setReplyTarget(null);
      if (composerRef.current) {
        composerRef.current.style.height = 'auto';
      }
    } catch (error) {
      alert('Error sending message: ' + error.message);
    } finally {
      setIsSending(false);
    }
  };

  // Reply UX Helper
  const handleReplyClick = (msg) => {
    const plainText = msg.content.replace(/<[^>]*>?/gm, '');
    const truncated = plainText.length > 50 ? plainText.substring(0, 50) + '...' : plainText;
    setReplyTarget({ id: msg.id, author: profilesMap[msg.user_id]?.name || 'Member', snippet: truncated });
    if (composerRef.current) {
      composerRef.current.focus();
    }
    scrollToBottom('smooth');
  };

  const openThread = (thread) => {
    setMessages([]);
    setChatInput('');
    setActiveThread(thread);
    setView('thread');
    loadMessages(thread.id);
  };

  const closeThread = () => {
    setView('list');
    setActiveThread(null);
    setMessages([]);
    setChatInput('');
    loadThreads();
  };

  // Admin Management Actions
  const handleMemberAction = async (targetId, action) => {
    if (!isAdmin) {
      alert("Unauthorized: Only group admins can perform this action.");
      return;
    }
    
    try {
      if (action === 'approve') {
        const { error } = await supabase
          .from('group_members')
          .update({ status: 'member' })
          .match({ group_id: groupId, user_id: targetId });
        
        if (error) throw error;
        alert('Member approved successfully!');
      } else if (action === 'decline' || action === 'kick') {
        const { error } = await supabase
          .from('group_members')
          .delete()
          .match({ group_id: groupId, user_id: targetId });
        
        if (error) throw error;
        alert(action === 'decline' ? 'Request declined.' : 'Member removed.');
      }
      
      // Refresh component members list
      const { data: updatedMembers } = await supabase
        .from('group_members')
        .select('*')
        .eq('group_id', groupId);

      if (updatedMembers) {
        const pendingUids = updatedMembers.filter(m => m.status === 'pending').map(m => m.user_id);
        const joinedUids = updatedMembers.filter(m => m.status === 'member').map(m => m.user_id);

        if (pendingUids.length > 0) {
          const { data: pProfs } = await supabase.from('profiles').select('id, name, avatar_url').in('id', pendingUids);
          setPendingRequests(pProfs || []);
        } else {
          setPendingRequests([]);
        }

        if (joinedUids.length > 0) {
          const { data: jProfs } = await supabase.from('profiles').select('id, name, avatar_url').in('id', joinedUids);
          setCurrentMembers(jProfs?.map(p => ({
            ...p,
            role: updatedMembers.find(m => m.user_id === p.id)?.role || 'member'
          })) || []);
        } else {
          setCurrentMembers([]);
        }
        
        // Update general count
        const approved = updatedMembers.filter(m => m.status === 'member');
        setMemberCount(approved.length);
        const avatarsUids = approved.slice(0, 5).map(m => m.user_id);
        if (avatarsUids.length > 0) {
          const { data: profs } = await supabase.from('profiles').select('avatar_url').in('id', avatarsUids);
          setMemberAvatars(profs?.map(p => p.avatar_url).filter(Boolean) || []);
        }
      }

      if (action === 'kick') {
        setUserToKick(null);
      }
    } catch (err) {
      console.error(`Member action failed:`, err.message);
      alert(`Action failed: ${err.message}`);
    }
  };

  const confirmLeaveGroup = async () => {
    const { error } = await supabase
      .from('group_members')
      .delete()
      .eq('group_id', groupId)
      .eq('user_id', userId);
    
    if (error) {
      alert("Failed to leave group.");
    } else {
      window.location.href = '/groups';
    }
  };

  const getThreadTitlePreview = (rawContent) => {
    if (!rawContent) return 'Untitled Thread';
    const cleanText = rawContent.replace(/<[^>]*>?/gm, '');
    const singleSpaced = cleanText.replace(/\s+/g, ' ').trim();
    return singleSpaced.length > 150 ? singleSpaced.substring(0, 150) + '...' : singleSpaced;
  };

  const formatTime = (dateString) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const otherMembersCount = Math.max(0, currentMembers.filter(m => m.id !== userId).length);

  // --- RENDER THREAD LIST ---
  if (view === 'list') {
    return (
      <div className="w-full max-w-2xl mx-auto py-[0.75rem] overflow-y-auto min-h-screen px-4">
        <div className="bg-white border-b border-gray-100 mb-6 rounded-xl shadow-sm p-6">
          <div className="header-container flex flex-col md:flex-row md:items-start justify-between gap-6">
            <div className="title-section flex-1 min-w-0 pl-2 md:pl-3">
              <h1 className="main-title text-[26px] font-black text-slate-900 mb-1.5 leading-tight break-words">
                {groupName}
              </h1>
              <p className="sub-title text-xs font-semibold text-slate-500 mb-4 leading-relaxed break-words">
                {groupDescription}
              </p>
              
              <div className="flex flex-wrap items-center gap-3 mt-4 group-button-row">
                {/* Standard Back Button */}
                <a 
                  href="/groups" 
                  className="bg-white hover:bg-slate-50 text-[#004173] hover:text-[#002f54] border border-[#004173]/25 py-2 px-4 rounded-lg shadow-sm font-black text-[10px] uppercase tracking-[0.1em] transition-all flex items-center gap-1.5 cursor-pointer"
                  style={{ minHeight: '36px' }}
                >
                  ← Back
                </a>
                
                {isAdmin && (
                  <button 
                    onClick={() => setShowManageModal(true)} 
                    className="bg-[#002b4e] hover:bg-[#001f38] text-white py-2 px-4 rounded-lg transition-all flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.1em] border border-transparent shadow-sm cursor-pointer"
                    style={{ minHeight: '36px' }}
                  >
                    <Settings size={14} strokeWidth={2.5} /> Manage Group
                  </button>
                )}
                {!isAdmin && isMember && (
                  <button 
                    onClick={() => setShowLeaveModal(true)}
                    className="bg-red-600 text-white hover:bg-red-700 border border-transparent rounded-lg py-2 px-4 text-[10px] font-black uppercase tracking-[0.1em] shadow-sm cursor-pointer transition-all flex items-center gap-2"
                    style={{ minHeight: '36px' }}
                  >
                    <LogOut size={12} /> Leave Group
                  </button>
                )}
              </div>
            </div>

            <div className="avatar-section flex flex-col items-start shrink-0 pl-6">
              <div className="avatar-cascade flex items-center -space-x-2">
                {memberAvatars.map((url, i) => (
                  <img 
                    key={i} 
                    src={url} 
                    alt="" 
                    className="w-8 h-8 rounded-full object-cover border-2 border-white shadow-sm shrink-0" 
                  />
                ))}
                {memberCount > 5 && (
                  <div className="w-8 h-8 rounded-full bg-slate-100 border-2 border-white shadow-sm flex items-center justify-center text-[10px] font-bold text-slate-500 shrink-0">
                    +{memberCount - 5}
                  </div>
                )}
              </div>
              <div className="member-count mt-2 text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">
                {memberCount} Members
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 mb-6">
          <h2 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
            <MessageSquare size={14} /> Group Discussions
          </h2>
          <button 
            onClick={() => setIsCreatingThread(!isCreatingThread)}
            className="bg-[#002b4e] hover:bg-[#001f38] text-white px-4 py-2 rounded-lg text-[12px] font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer border border-transparent shadow-sm min-h-[44px]"
          >
            {isCreatingThread ? 'Cancel' : <><Plus size={12}/> Start a Thread</>}
          </button>
        </div>

        {isCreatingThread && (
          <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 mb-6 shadow-md">
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              ➤ Start a Thread
            </h3>
            <input
              type="text"
              placeholder="Thread Title (Required)"
              value={newThreadTitle}
              onChange={e => setNewThreadTitle(e.target.value)}
              className="w-full border border-slate-200 bg-slate-50 rounded-lg px-4 py-3.5 text-sm mb-3 focus:outline-none focus:border-blue-500 font-bold text-slate-800 focus:bg-white transition-all shadow-inner min-h-[48px]"
            />
            <textarea
              placeholder="Optional first message..."
              value={newThreadMessage}
              onChange={e => setNewThreadMessage(e.target.value)}
              className="w-full border border-slate-200 bg-slate-50 rounded-lg px-4 py-2.5 text-xs mb-4 focus:outline-none focus:border-blue-500 resize-none min-h-[90px] text-slate-700 focus:bg-white transition-all shadow-inner"
            />
            <div className="flex justify-end">
                <button
                  onClick={handleCreateThread}
                  disabled={!newThreadTitle.trim() || isSending}
                  className="bg-[#002b4e] hover:bg-[#001f38] text-white px-6 py-2.5 rounded-lg text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-all w-full sm:w-auto shadow-md flex items-center justify-center min-h-[44px]"
                >
                  {isSending ? 'Creating...' : 'Create Thread'}
                </button>
            </div>
          </div>
        )}

        <div className="space-y-3">
          {threads.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-150 p-12 text-center shadow-sm">
              <MessageSquare size={32} className="mx-auto text-slate-300 mb-3" />
              <p className="text-slate-400 italic text-xs font-medium">No discussions yet. Be the first to start one!</p>
            </div>
          ) : (
            threads.map(thread => {
              const author = profilesMap[thread.created_by] || {};
              const isOwner = thread.created_by === userId;
              
              return (
                <div 
                  key={thread.id} 
                  onClick={() => openThread(thread)}
                  className="bg-white border border-slate-200 hover:border-blue-400 rounded-xl p-4 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer flex items-start gap-4 group relative"
                >
                  <div className="w-9 h-9 rounded-full bg-slate-100 shrink-0 overflow-hidden mt-0.5 border border-slate-150">
                    {author.avatar_url ? (
                      <img src={author.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-blue-50 text-blue-700 font-bold text-sm uppercase">
                        {(author.name || 'M').charAt(0)}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0 pr-6 sm:pr-8">
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-1.5 gap-1 sm:gap-4">
                      <h3 className="font-bold text-slate-900 text-sm leading-snug line-clamp-2 break-words">
                        {getThreadTitlePreview(thread.title)}
                      </h3>
                      <span className="text-[10px] text-slate-400 font-medium whitespace-nowrap shrink-0 sm:mt-0.5 uppercase tracking-tight">
                        {formatDate(thread.created_at)}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 flex items-center gap-1.5">
                      <span className="font-bold text-slate-700 max-w-[120px] sm:max-w-[200px] truncate">{author.name || 'MNetwork Member'}</span>
                      <span className="text-slate-400">started this thread</span>
                    </p>
                  </div>

                  {(isOwner || isAdmin) && (
                    <button 
                      onClick={(e) => handleDeleteThread(thread.id, e)}
                      className="absolute right-3 top-3 p-1.5 text-slate-300 hover:text-red-500 sm:opacity-0 sm:group-hover:opacity-100 transition-all rounded-lg hover:bg-red-50 cursor-pointer"
                      title="Delete Thread"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>

        {showManageModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border-t-4 border-blue-600">
              <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center relative">
                <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest text-center w-full">Manage Group Members</h3>
                <button onClick={() => setShowManageModal(false)} className="text-slate-400 hover:text-red-500 transition-colors absolute right-4 cursor-pointer"><X size={20} /></button>
              </div>
              <div className="max-h-[60vh] overflow-y-auto divide-y divide-slate-100">
                <div className="p-5 bg-blue-50/20">
                  <div className="flex items-center gap-1.5 mb-4">
                    <UserPlus size={14} className="text-blue-600" />
                    <h4 className="text-[10px] font-black text-blue-900 uppercase tracking-wider">Pending Requests ({pendingRequests.length})</h4>
                  </div>
                  <div className="space-y-3">
                    {pendingRequests.length === 0 ? <p className="text-[10px] text-slate-400 italic">No pending requests</p> : pendingRequests.map(r => (
                      <div key={r.id} className="flex items-center justify-between p-2.5 bg-white rounded-xl border border-blue-100 shadow-sm">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <img src={r.avatar_url || '/avatar_placeholder.png'} className="w-8 h-8 rounded-full object-cover border shadow-sm shrink-0" />
                          <span className="text-xs font-bold text-slate-800 truncate">{r.name}</span>
                        </div>
                        <div className="flex gap-1.5 shrink-0">
                          <button onClick={() => handleMemberAction(r.id, 'approve')} className="p-1.5 bg-green-50 text-green-600 hover:bg-green-600 hover:text-white border border-green-100 rounded-lg transition-all cursor-pointer"><Check size={14} /></button>
                          <button onClick={() => handleMemberAction(r.id, 'decline')} className="p-1.5 bg-red-50 text-red-600 hover:bg-red-600 hover:text-white border border-red-100 rounded-lg transition-all cursor-pointer"><X size={14} /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="p-5">
                  <div className="flex items-center gap-1.5 mb-4">
                    <Users size={14} className="text-slate-400" />
                    <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Current Members ({otherMembersCount})</h4>
                  </div>
                  <div className="space-y-3">
                    {currentMembers.filter(m => m.id !== userId).map(m => (
                      <div key={m.id} className="flex items-center justify-between p-2 bg-slate-50 hover:bg-slate-100/60 rounded-xl transition-all border border-transparent">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <img src={m.avatar_url || '/avatar_placeholder.png'} className="w-8 h-8 rounded-full object-cover border shadow-sm shrink-0" />
                          <div className="flex flex-col min-w-0">
                            <span className="text-xs font-bold text-slate-800 truncate">{m.name}</span>
                            <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-tight">{m.role}</span>
                          </div>
                        </div>
                        {m.role !== 'admin' && (
                          <button onClick={() => setUserToKick(m)} className="text-[9px] font-black text-red-500 uppercase tracking-wider bg-red-50 px-2.5 py-1.5 rounded-lg hover:bg-red-600 hover:text-white transition-all cursor-pointer">Kick</button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {userToKick && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-xs rounded-xl p-5 text-center shadow-2xl">
              <AlertTriangle size={28} className="text-red-500 mx-auto mb-3" />
              <h4 className="text-sm font-bold text-slate-900 mb-1">Remove Member?</h4>
              <p className="text-xs text-slate-500 mb-4 leading-relaxed">Are you sure you want to remove <span className="font-bold text-slate-950">{userToKick.name}</span> from the group?</p>
              <div className="flex gap-2">
                <button onClick={() => setUserToKick(null)} className="flex-1 py-2 text-[10px] font-black uppercase tracking-wider text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer">Cancel</button>
                <button onClick={() => handleMemberAction(userToKick.id, 'kick')} className="flex-1 py-2 text-[10px] font-black uppercase tracking-wider text-white bg-red-600 hover:bg-red-700 rounded-lg cursor-pointer">Kick</button>
              </div>
            </div>
          </div>
        )}

        {showLeaveModal && (
          <div className="fixed inset-0 bg-black/55 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-xs rounded-xl p-6 text-center shadow-2xl">
              <LogOut size={28} className="text-red-500 mx-auto mb-3" />
              <h4 className="text-sm font-bold text-slate-900 mb-1">Leave Group?</h4>
              <p className="text-xs text-slate-500 mb-5 leading-relaxed">Are you sure you want to leave this group?</p>
              <div className="flex gap-2.5">
                <button onClick={() => setShowLeaveModal(false)} className="flex-1 py-2 text-[10px] font-black uppercase tracking-wider text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer">Cancel</button>
                <button onClick={confirmLeaveGroup} className="flex-1 py-2 text-[10px] font-black uppercase tracking-wider text-white bg-red-600 hover:bg-red-700 rounded-lg cursor-pointer">Leave</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // --- RENDER THREAD CHAT ROOM ---
  // The actual active thread conversation root becomes the isolated chat room container.
  // Using fixed positioning and body scroll lock guarantees no parent page drift.
  return (
    <div
      className="group-thread-container bg-slate-50 w-full overflow-hidden"
      style={{ display: 'flex', flexDirection: 'column' }}
    >
      {/* ── ThreadHeader ─────────────────────────────────────────────────────
          shrink-0 → never scrolls. Sits at top of the flex column. */}
      <div
        className="bg-white border-b border-slate-200 px-4 flex items-center shadow-md"
        style={{ flexShrink: 0, minHeight: '52px', paddingTop: '10px', paddingBottom: '10px', zIndex: 2 }}
      >
        <button onClick={closeThread} className="mr-3 p-1.5 hover:bg-slate-100 rounded-full text-slate-600 transition-colors shrink-0 cursor-pointer">
          <ChevronLeft size={20} className="stroke-[2.5]" />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="font-bold text-slate-900 truncate text-[15px] md:text-[16px] leading-tight">{getThreadTitlePreview(activeThread.title)}</h2>
        </div>
      </div>

      {/* ── MessageScrollArea ────────────────────────────────────────────────
          flex:1 + minHeight:0 → this is the ONLY element that scrolls.
          ThreadHeader and ComposerFooter are siblings, not parents/children. */}
      <div
        style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', WebkitOverflowScrolling: 'touch' }}
        className="message-scroll-area px-2 sm:px-4 py-4 bg-slate-50 w-full"
      >
        <div className="space-y-3">
          {messages.map((msg) => {
            const isMe = msg.user_id === userId;
            const author = profilesMap[msg.user_id] || { name: msg.author_name || 'Member' };
            return (
              <div key={msg.id} className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'}`}>
                <div className={`flex w-full max-w-[85%] md:max-w-[70%] gap-2 items-end ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                  <div className="w-8 h-8 rounded-full bg-slate-100 shrink-0 overflow-hidden border border-slate-200 mb-1">
                    {author.avatar_url
                      ? <img src={author.avatar_url} className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center text-xs font-black uppercase" style={{ backgroundColor: '#e0e9f4', color: '#004173' }}>{author.name?.charAt(0) || 'M'}</div>
                    }
                  </div>
                  <div className="flex flex-col gap-0.5 min-w-0">
                    {!isMe && (
                      <span className="text-[10px] font-semibold text-slate-500 ml-1 truncate">
                        {author.name || 'Member'}
                      </span>
                    )}
                    <div
                      className="px-4 py-2.5 rounded-2xl text-[15px] leading-relaxed shadow-sm whitespace-pre-wrap break-words"
                      style={isMe
                        ? { backgroundColor: '#004173', color: '#ffffff', borderBottomRightRadius: '6px' }
                        : { backgroundColor: '#ffffff', color: '#1e293b', border: '1px solid #e2e8f0', borderBottomLeftRadius: '6px' }
                      }
                    >
                      {msg.reply_preview && (
                        <div 
                          className="mb-2 p-2 rounded-lg text-xs leading-normal border-l-4"
                          style={isMe
                            ? { backgroundColor: 'rgba(255, 255, 255, 0.12)', borderLeftColor: 'rgba(255, 255, 255, 0.5)', color: 'rgba(255, 255, 255, 0.9)' }
                            : { backgroundColor: '#f1f5f9', borderLeftColor: '#004173', color: '#475569' }
                          }
                        >
                          <div className="font-bold mb-0.5">
                            Replying to {msg.reply_author_name || 'Member'}
                          </div>
                          <div className="italic truncate line-clamp-1 break-all">
                            {msg.reply_preview}
                          </div>
                        </div>
                      )}
                      {msg.content}
                    </div>
                    <button
                      onClick={() => handleReplyClick(msg)}
                      className="flex items-center gap-1 mt-0.5 px-1.5 py-0.5 rounded transition-colors cursor-pointer self-start"
                      style={{ color: '#004173', fontWeight: 'bold' }}
                    >
                      <Reply size={12} className="stroke-[2.5]" style={{ color: '#004173' }} />
                      <span className="text-[10px] font-bold" style={{ color: '#004173' }}>Reply</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} className="h-2" />
        </div>
      </div>

      {/* ── ComposerFooter ───────────────────────────────────────────────────
          shrink-0 → never scrolls. Sits at bottom of the flex column.
          paddingBottom clears the bottom nav + safe area. */}
      <div
        className="composer-footer bg-white border-t border-slate-200 px-2 pt-2"
        style={{
          flexShrink: 0,
          zIndex: 2,
          paddingBottom: 'calc(var(--mobile-nav-height, 72px) + env(safe-area-inset-bottom) + 8px)',
          boxShadow: '0 -2px 8px rgba(0,0,0,0.06)'
        }}
      >
        {replyTarget && (
          <div className="flex items-center justify-between bg-slate-100 border border-slate-200 rounded-lg px-3 py-2 mb-2">
            <div className="text-xs text-slate-700 truncate mr-2">
              Replying to <span className="font-semibold">{replyTarget.author}</span>: {replyTarget.snippet}
            </div>
            <button onClick={() => setReplyTarget(null)} className="p-1 text-slate-400 hover:text-slate-600 shrink-0">
              <X size={16} />
            </button>
          </div>
        )}
        <div className="max-w-4xl mx-auto flex items-center gap-3 w-full px-1">
          {/* Input container */}
          <div className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl flex items-center min-h-[44px] md:min-h-[48px] py-0.5">
            <textarea
              ref={composerRef}
              className="flex-1 bg-transparent border-none focus:ring-0 text-sm resize-none max-h-[120px] py-2 px-4 focus:outline-none font-medium text-slate-700 leading-normal"
              placeholder="Type your message..."
              value={chatInput}
              onChange={(e) => {
                setChatInput(e.target.value);
                e.target.style.height = 'auto';
                e.target.style.height = (e.target.scrollHeight < 150 ? e.target.scrollHeight : 150) + 'px';
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              style={{ height: '36px' }}
            />
          </div>
          
          {/* Circular Send Button */}
          <button
            onClick={handleSendMessage}
            disabled={!chatInput.trim() || isSending}
            className="w-11 h-11 md:w-12 md:h-12 rounded-full text-white flex items-center justify-center shadow-md hover:brightness-105 active:scale-95 transition-all shrink-0 cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
            style={{ 
              backgroundColor: '#0284c7', // Soft premium light blue matching specifications
              minWidth: '44px',
              minHeight: '44px'
            }}
          >
            <Send size={18} className="translate-x-[0.5px] -translate-y-[0.5px]" />
          </button>
        </div>
      </div>
    </div>
  );
}

