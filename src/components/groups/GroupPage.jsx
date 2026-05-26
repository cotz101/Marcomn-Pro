'use client';

import { useState, useEffect, useRef } from 'react';
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

export default function GroupPage({ groupId: propGroupId }) {
  const supabase = createClient();

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

  const messagesEndRef = useRef(null);
  const composerRef = useRef(null);

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
      const { data: newMessage, error: newMessageError } = await supabase
        .from('group_thread_messages')
        .insert([{
          id: messageId,
          thread_id: activeThread.id,
          user_id: user.id,
          content: messageContent
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

      // Optimistic append: Map returned data back into the local state format expected by UI
      const localData = {
        id: messageId,
        thread_id: activeThread.id,
        user_id: user.id,
        content: messageContent,
        created_at: newMessage.created_at
      };

      setMessages(prev => {
        if (prev.some(m => m.id === localData.id)) return prev;
        return [...prev, localData];
      });
      
      setChatInput('');
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
  const handleReplyClick = (originalMessage) => {
    // 1. Strip HTML/tags safely
    const plainText = originalMessage.replace(/<[^>]*>?/gm, '');
    
    // 2. Truncate quote safely for clean UX
    const truncated = plainText.length > 50 ? plainText.substring(0, 50) + '...' : plainText;
    
    // 3. Format requested quote prefix
    const replyTemplate = `-- replying to > "${truncated}"\n`;
    setChatInput(replyTemplate);
    
    // 4. Focus and move selection cursor immediately to the end of the text template
    if (composerRef.current) {
      composerRef.current.focus();
      setTimeout(() => {
        if (composerRef.current) {
          composerRef.current.focus();
          const len = replyTemplate.length;
          composerRef.current.setSelectionRange(len, len);
        }
      }, 50);
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

  // Safe UI Text Helper
  const getThreadTitlePreview = (rawContent) => {
    if (!rawContent) return 'Untitled Thread';
    // 1. Strip HTML tags safely in UI layer
    const cleanText = rawContent.replace(/<[^>]*>?/gm, '');
    // 2. Remove giant double spaces or double newlines
    const singleSpaced = cleanText.replace(/\s+/g, ' ').trim();
    // 3. Truncate for extreme card protection
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

  // --- RENDER THREAD LIST (Main page with Header intact) ---
  if (view === 'list') {
    return (
      <div className="w-full max-w-2xl mx-auto py-[0.75rem] overflow-y-auto min-h-screen px-4">
        {/* Global Group Header (Unchanged styling as per instructions) */}
        <div className="bg-white border-b border-gray-100 mb-6 rounded-xl shadow-sm p-5">
          <div className="header-container flex flex-col md:flex-row md:items-start justify-between gap-6">
            <div className="title-section flex-1 min-w-0">
              <h1 className="main-title text-2xl font-black text-slate-900 mb-1 leading-tight break-words">
                {groupName}
              </h1>
              <p className="sub-title text-xs font-semibold text-slate-500 mb-4 leading-relaxed break-words">
                {groupDescription}
              </p>
              
              <div className="flex flex-wrap items-center gap-2">
                {/* Admin settings button */}
                {isAdmin && (
                  <button 
                    onClick={() => setShowManageModal(true)} 
                    className="py-2 px-4 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg transition-all flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.1em] border border-blue-200 shadow-sm cursor-pointer"
                  >
                    <Settings size={14} strokeWidth={2.5} /> Manage Group
                  </button>
                )}

                {/* Non-Admin leave button */}
                {!isAdmin && isMember && (
                  <button 
                    onClick={() => setShowLeaveModal(true)}
                    className="btn-leave flex items-center gap-2 py-2 px-4 bg-red-50 text-red-600 hover:bg-red-100 border border-red-100 rounded-lg text-[10px] font-black uppercase tracking-[0.1em] shadow-sm cursor-pointer transition-all"
                  >
                    <LogOut size={12} /> Leave Group
                  </button>
                )}
              </div>
            </div>

            {/* Right side: Member count and cascade */}
            <div className="avatar-section flex flex-col items-start md:items-end shrink-0">
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
              <div className="member-count mt-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                {memberCount} Members
              </div>
            </div>
          </div>
        </div>

        {/* Section Title & Add Thread Action */}
        <div className="flex items-center justify-between gap-4 mb-6">
          <h2 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
            <MessageSquare size={14} /> Group Discussions
          </h2>
          <button 
            onClick={() => setIsCreatingThread(!isCreatingThread)}
            className="bg-slate-900 text-white hover:bg-slate-800 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer border border-transparent shadow-sm"
          >
            {isCreatingThread ? 'Cancel' : <><Plus size={12}/> Start a Thread</>}
          </button>
        </div>

        {/* Start Thread Box */}
        {isCreatingThread && (
          <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 mb-6 shadow-md animate-in fade-in slide-in-from-top-2 duration-200">
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              ➤ Start a Thread
            </h3>
            <input
              type="text"
              placeholder="Thread Title (Required)"
              value={newThreadTitle}
              onChange={e => setNewThreadTitle(e.target.value)}
              className="w-full border border-slate-200 bg-slate-50 rounded-lg px-4 py-2.5 text-xs mb-3 focus:outline-none focus:border-blue-500 font-bold text-slate-800 focus:bg-white transition-all shadow-inner"
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
                className="bg-blue-600 text-white hover:bg-blue-700 px-5 py-2 rounded-lg text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-all w-full sm:w-auto shadow-md"
              >
                {isSending ? 'Creating...' : 'Create Thread'}
              </button>
            </div>
          </div>
        )}

        {/* Thread Cards List */}
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
                      {/* Robust Title with line-clamp-2 protection & safe preview for legacy compatibility */}
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

                  {/* Absolute positioning for thread delete button */}
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

        {/* Global Admin Manage Group Modal */}
        {showManageModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border-t-4 border-blue-600 animate-in zoom-in-95 duration-200">
              <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center relative">
                <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest text-center w-full">Manage Group Members</h3>
                <button onClick={() => setShowManageModal(false)} className="text-slate-400 hover:text-red-500 transition-colors absolute right-4 cursor-pointer"><X size={20} /></button>
              </div>
              
              <div className="max-h-[60vh] overflow-y-auto divide-y divide-slate-100">
                {/* Pending Requests Section */}
                <div className="p-5 bg-blue-50/20">
                  <div className="flex items-center gap-1.5 mb-4">
                    <UserPlus size={14} className="text-blue-600" />
                    <h4 className="text-[10px] font-black text-blue-900 uppercase tracking-wider">Pending Requests ({pendingRequests.length})</h4>
                  </div>
                  <div className="space-y-3">
                    {pendingRequests.length === 0 ? (
                      <p className="text-[10px] text-slate-400 italic">No pending requests</p>
                    ) : (
                      pendingRequests.map(r => (
                        <div key={r.id} className="flex items-center justify-between p-2.5 bg-white rounded-xl border border-blue-100 shadow-sm">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <img src={r.avatar_url || '/avatar_placeholder.png'} className="w-8 h-8 rounded-full object-cover border shadow-sm shrink-0" />
                            <span className="text-xs font-bold text-slate-800 truncate">{r.name}</span>
                          </div>
                          <div className="flex gap-1.5 shrink-0">
                            <button onClick={() => handleMemberAction(r.id, 'approve')} className="p-1.5 bg-green-50 text-green-600 hover:bg-green-600 hover:text-white border border-green-100 rounded-lg transition-all cursor-pointer" title="Approve"><Check size={14} /></button>
                            <button onClick={() => handleMemberAction(r.id, 'decline')} className="p-1.5 bg-red-50 text-red-600 hover:bg-red-600 hover:text-white border border-red-100 rounded-lg transition-all cursor-pointer" title="Decline"><X size={14} /></button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Current Members Section */}
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

        {/* Kick Confirmation Modal */}
        {userToKick && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-xs rounded-xl p-5 text-center shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-200">
              <AlertTriangle size={28} className="text-red-500 mx-auto mb-3" />
              <h4 className="text-sm font-bold text-slate-900 mb-1">Remove Member?</h4>
              <p className="text-xs text-slate-500 mb-4 leading-relaxed">Are you sure you want to remove <span className="font-bold text-slate-950">{userToKick.name}</span> from the group?</p>
              <div className="flex gap-2">
                <button onClick={() => setUserToKick(null)} className="flex-1 py-2 text-[10px] font-black uppercase tracking-wider text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer transition-colors">Cancel</button>
                <button onClick={() => handleMemberAction(userToKick.id, 'kick')} className="flex-1 py-2 text-[10px] font-black uppercase tracking-wider text-white bg-red-600 hover:bg-red-700 rounded-lg cursor-pointer transition-colors">Kick</button>
              </div>
            </div>
          </div>
        )}

        {/* Leave Group Modal */}
        {showLeaveModal && (
          <div className="fixed inset-0 bg-black/55 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-xs rounded-xl p-6 text-center shadow-2xl animate-in zoom-in-95 duration-200">
              <LogOut size={28} className="text-red-500 mx-auto mb-3" />
              <h4 className="text-sm font-bold text-slate-900 mb-1">Leave Group?</h4>
              <p className="text-xs text-slate-500 mb-5 leading-relaxed">Are you sure you want to leave this group? You will lose access to all threads.</p>
              <div className="flex gap-2.5">
                <button onClick={() => setShowLeaveModal(false)} className="flex-1 py-2 text-[10px] font-black uppercase tracking-wider text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer transition-colors">Cancel</button>
                <button onClick={confirmLeaveGroup} className="flex-1 py-2 text-[10px] font-black uppercase tracking-wider text-white bg-red-600 hover:bg-red-700 rounded-lg cursor-pointer transition-colors">Leave</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // --- RENDER THREAD CHAT ROOM ---
  return (
    <div
      className="bg-slate-50 flex flex-col w-full overflow-hidden relative"
      style={{ height: '100dvh' }}
    >
      {/* Immersive Chat Header – clears Dynamic Island / notch on mobile */}
      <div
        className="bg-white border-b border-slate-200 px-4 flex items-center shadow-sm z-10 shrink-0"
        style={{
          paddingTop: 'max(12px, env(safe-area-inset-top))',
          paddingBottom: '12px',
          minHeight: 'calc(56px + env(safe-area-inset-top))'
        }}
      >
        <button 
          onClick={closeThread}
          className="mr-3 p-1.5 hover:bg-slate-100 rounded-full text-slate-600 transition-colors shrink-0 cursor-pointer"
          title="Back to threads list"
        >
          <ChevronLeft size={20} className="stroke-[2.5]" />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="font-bold text-slate-900 truncate text-[14px] md:text-[15px] leading-tight">
            {getThreadTitlePreview(activeThread.title)}
          </h2>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            {messages.length} Message{messages.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Messages Scrollable Area (Teams/Slack layout) */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50 w-full">
        {/* Origin post timeline marker */}
        <div className="text-center my-4">
          <span className="bg-slate-200/80 text-slate-500 text-[9px] font-black uppercase tracking-wider px-3 py-1 rounded-full border border-slate-300/40">
            Thread Started • {formatDate(activeThread.created_at)}
          </span>
        </div>

        {messages.length === 0 ? (
          <div className="text-center text-slate-400 italic text-xs py-12">No messages in this discussion yet. Say hello!</div>
        ) : (
          messages.map((msg, idx) => {
            const isMe = msg.user_id === userId;
            const author = profilesMap[msg.user_id] || { name: msg.author_name || 'Member' };
            const showHeader = idx === 0 || messages[idx - 1].user_id !== msg.user_id;

            return (
              <div key={msg.id} className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'} animate-in fade-in duration-150`}>
                {/* Bubble Container with subtle touch action Reply positioning */}
                <div className={`flex w-full max-w-[90%] sm:max-w-[80%] md:max-w-[70%] gap-2.5 items-start ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                  
                  {/* Author Avatar */}
                  {showHeader ? (
                    <div className="w-8 h-8 rounded-full bg-slate-100 shrink-0 border border-slate-200 overflow-hidden">
                      {author.avatar_url ? (
                        <img src={author.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-blue-50 text-blue-700 font-black text-xs uppercase">
                          {author.name?.charAt(0) || 'M'}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="w-8 shrink-0" /> // Spacer to preserve vertical column alignment
                  )}

                  {/* Actual Text Bubble wrapper */}
                  <div className={`flex flex-col min-w-0 ${isMe ? 'items-end' : 'items-start'}`}>
                    {showHeader && (
                      <div className="flex items-baseline gap-2 mb-1 px-1">
                        <span className="text-[11px] font-bold text-slate-700 truncate max-w-[120px]">{author.name}</span>
                        <span className="text-[9px] font-medium text-slate-400 shrink-0 uppercase tracking-tight">{formatTime(msg.created_at)}</span>
                      </div>
                    )}
                    
                    {/* Hover reply trigger structure */}
                    <div className="group relative flex items-center gap-2 max-w-full">
                      
                      {/* Left side Reply Button (Me bubble) */}
                      {isMe && (
                        <button 
                          onClick={() => handleReplyClick(msg.content)}
                          className="opacity-40 hover:opacity-100 p-1 text-slate-400 hover:text-blue-500 hover:bg-white rounded-full border border-slate-100 shadow-sm transition-all shrink-0 cursor-pointer"
                          title="Reply to message"
                        >
                          <Reply size={12} className="stroke-[2.5]" />
                        </button>
                      )}

                      {/* Bubble */}
                      <div 
                        className={`px-3.5 py-2 md:px-4 md:py-2.5 rounded-2xl text-xs shadow-sm whitespace-pre-wrap break-words overflow-wrap-anywhere leading-relaxed max-w-full ${
                          isMe 
                            ? 'bg-blue-600 text-white rounded-tr-[4px] border border-blue-700' 
                            : 'bg-white text-slate-800 border border-slate-150 rounded-tl-[4px]'
                        }`}
                        style={{ wordBreak: 'break-word' }}
                      >
                        {msg.content}
                      </div>

                      {/* Right side Reply Button (Others bubble) */}
                      {!isMe && (
                        <button 
                          onClick={() => handleReplyClick(msg.content)}
                          className="opacity-40 hover:opacity-100 p-1 text-slate-400 hover:text-blue-500 hover:bg-white rounded-full border border-slate-100 shadow-sm transition-all shrink-0 cursor-pointer"
                          title="Reply to message"
                        >
                          <Reply size={12} className="stroke-[2.5]" />
                        </button>
                      )}
                    </div>
                  </div>

                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} className="h-4" />
      </div>

      {/* Chat Composer Input – always visible above mobile bottom nav */}
      {/* Bottom padding = mobile bottom nav height + iOS safe-area + 8px gutter */}
      <div
        className="bg-white border-t border-slate-200 p-2 md:p-3 shrink-0 shadow-lg z-20"
        style={{ paddingBottom: 'calc(var(--mobile-nav-height, 64px) + env(safe-area-inset-bottom) + 8px)' }}
      >
        <div className="max-w-4xl mx-auto flex items-end gap-2 bg-slate-50 border border-slate-200 rounded-xl p-1 pr-1.5 md:pr-2">
          <textarea
            ref={composerRef}
            className="flex-1 bg-transparent border-none focus:ring-0 text-xs resize-none max-h-[120px] md:max-h-[150px] min-h-[36px] md:min-h-[40px] py-2 px-3 focus:outline-none font-medium text-slate-700"
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
          />
          <button
            onClick={handleSendMessage}
            disabled={!chatInput.trim() || isSending}
            className="p-2 mb-0.5 bg-blue-600 text-white rounded-lg disabled:opacity-50 disabled:bg-slate-350 hover:bg-blue-700 transition-all shrink-0 cursor-pointer shadow-sm"
          >
            <Send size={14} className={chatInput.trim() ? 'translate-x-[0.5px] -translate-y-[0.5px]' : ''} />
          </button>
        </div>
      </div>
    </div>
  );
}
