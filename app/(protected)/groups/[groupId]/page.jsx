'use client';

import { useState, useEffect, use, useRef } from 'react';
import { createClient } from '@/lib/supabase';
import { MessageSquare, Send, Image as ImageIcon, FileText, Heart, Users, X, FileIcon, ExternalLink, Download, Paperclip, MoreVertical, Edit2, Trash2, Plus, CornerDownRight, AlertTriangle, UserPlus, Check, XCircle } from 'lucide-react';
import Link from 'next/link';

// Helper for relative timestamps
function formatRelativeTime(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now - date) / 1000);
  if (diffInSeconds < 60) return 'just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 172800) return 'Yesterday';
  return date.toLocaleDateString();
}

function DiscussionThread({ post, currentUserId, onDelete, onUpdate, uploadFile }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [comments, setComments] = useState([]);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(post.content);
  const [editFileUrls, setEditFileUrls] = useState(Array.isArray(post.file_urls) ? post.file_urls : []);
  const [newEditFiles, setNewEditFiles] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [replyingToId, setReplyingToId] = useState(null);
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editCommentText, setEditCommentText] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null); // 'post' or 'commentId'

  const editMediaRef = useRef(null);
  const editDocRef = useRef(null);
  const supabase = createClient();
  const isOwner = currentUserId === post.user_id;
  const fileUrls = Array.isArray(post.file_urls) ? post.file_urls : [];

  useEffect(() => {
    fetchComments();
  }, []);

  const fetchComments = async () => {
    setIsLoadingComments(true);
    try {
      const { data: commentsData } = await supabase.from('group_comments').select('*').eq('post_id', post.id).order('created_at', { ascending: true });
      if (commentsData && commentsData.length > 0) {
        const userIds = [...new Set(commentsData.map(c => c.user_id))];
        const { data: profiles } = await supabase.from('profiles').select('id, name, avatar_url').in('id', userIds);
        const pMap = {}; profiles?.forEach(p => pMap[p.id] = p);
        setComments(commentsData.map(c => ({ ...c, profiles: pMap[c.user_id] })));
      } else { setComments(commentsData || []); }
    } finally { setIsLoadingComments(false); }
  };

  const handleCommentSubmit = async (parentId = null) => {
    if (!commentText.trim()) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    try {
      const { data: newComment, error } = await supabase.from('group_comments').insert([{ post_id: post.id, user_id: user.id, content: commentText, parent_id: parentId }]).select('*').single();
      if (error) throw error;
      const { data: profile } = await supabase.from('profiles').select('name, avatar_url').eq('id', user.id).single();
      setComments([...comments, { ...newComment, profiles: profile }]);
      setCommentText(''); setReplyingToId(null);
    } catch (e) { alert(e.message); }
  };

  const handleCommentUpdate = async (cid) => {
    try {
      await supabase.from('group_comments').update({ content: editCommentText }).eq('id', cid);
      setComments(comments.map(c => c.id === cid ? { ...c, content: editCommentText } : c));
      setEditingCommentId(null);
    } catch (e) { alert(e.message); }
  };

  const handleCommentDelete = async (cid) => {
    await supabase.from('group_comments').delete().eq('id', cid);
    setComments(comments.filter(c => c.id !== cid));
    setShowDeleteConfirm(null);
  };

  const handleSaveEdit = async () => {
    setIsProcessing(true);
    try {
      const uploadedUrls = await Promise.all(newEditFiles.map(f => uploadFile(f)));
      const cleanNewUrls = uploadedUrls.filter(Boolean);
      const finalUrls = [...editFileUrls, ...cleanNewUrls];
      await onUpdate(post.id, editText, finalUrls);
      setNewEditFiles([]);
      setIsEditing(false);
    } catch (e) { alert(e.message); } finally { setIsProcessing(false); }
  };

  const getCommentById = (id) => comments.find(c => c.id === id);

  return (
    <div key={post.id} className="bg-white rounded-xl shadow-sm p-4 border border-gray-100 animate-in fade-in slide-in-from-bottom-2 duration-300 relative">
      {/* Post Action Menu */}
      {isOwner && !isEditing && (
        <div className="absolute top-4 right-4 z-10">
          <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg transition-all"><MoreVertical size={16} /></button>
          {isMenuOpen && (
            <div className="absolute right-0 mt-1 w-32 bg-white border border-gray-100 shadow-xl rounded-xl py-1 z-20">
              <button onClick={() => { setIsEditing(true); setIsMenuOpen(false); }} className="w-full text-left px-4 py-2 text-xs font-bold text-gray-600 hover:bg-blue-50 flex items-center gap-2"><Edit2 size={14} /> Edit</button>
              <button onClick={() => { setShowDeleteConfirm('post'); setIsMenuOpen(false); }} className="w-full text-left px-4 py-2 text-xs font-bold text-red-500 hover:bg-red-50 flex items-center gap-2"><Trash2 size={14} /> Delete</button>
            </div>
          )}
        </div>
      )}

      {/* Author Info */}
      <div className="flex items-center gap-3 mb-3">
        {post.authorAvatar ? <img src={post.authorAvatar} className="w-9 h-9 rounded-full object-cover border border-gray-200" /> : <div className="w-9 h-9 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center"><div className="w-5 h-5 bg-gray-300 rounded-full"></div></div>}
        <div className="text-left">
          <div className="text-sm font-bold text-gray-900 leading-none">{post.authorName || 'MNetwork Member'}</div>
          <div className="text-[10px] text-gray-400 font-medium uppercase tracking-wider mt-1">{formatRelativeTime(post.created_at)}</div>
        </div>
      </div>
      
      {/* Post Content */}
      <div className="space-y-3">
        {isEditing ? (
          <div className="space-y-4">
            <textarea value={editText} onChange={(e) => setEditText(e.target.value)} className="w-full min-h-[120px] p-4 text-[15px] bg-gray-50 border border-blue-100 rounded-xl focus:outline-none leading-relaxed" />
            
            <div className="flex flex-wrap gap-2">
              {editFileUrls.map((url, i) => (
                <div key={i} className="relative group">
                  <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center border border-gray-200 shadow-sm">
                    {url.toLowerCase().includes('.pdf') ? <FileText size={20} className="text-yellow-600" /> : <ImageIcon size={20} className="text-blue-500" />}
                  </div>
                  <button onClick={() => setEditFileUrls(editFileUrls.filter((_, idx) => idx !== i))} className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full p-0.5 shadow-sm"><X size={10} /></button>
                </div>
              ))}
              {newEditFiles.map((f, i) => (
                <div key={i} className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center border border-blue-200 relative shadow-sm">
                  {f.name.toLowerCase().endsWith('.pdf') ? <FileText size={20} className="text-yellow-600" /> : <ImageIcon size={20} className="text-blue-500" />}
                  <button onClick={() => setNewEditFiles(newEditFiles.filter((_, idx) => idx !== i))} className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full p-0.5 shadow-sm"><X size={10} /></button>
                </div>
              ))}
              <div className="flex gap-2">
                <button onClick={() => editMediaRef.current.click()} className="w-12 h-12 border-2 border-dashed border-gray-200 rounded-lg flex items-center justify-center text-gray-400 hover:border-blue-400 hover:text-blue-400 transition-all"><ImageIcon size={20} /></button>
                <button onClick={() => editDocRef.current.click()} className="w-12 h-12 border-2 border-dashed border-gray-200 rounded-lg flex items-center justify-center text-gray-400 hover:border-yellow-400 hover:text-yellow-500 transition-all"><FileText size={20} /></button>
                <input type="file" ref={editMediaRef} className="hidden" onChange={(e) => setNewEditFiles([...newEditFiles, ...Array.from(e.target.files)])} multiple />
                <input type="file" ref={editDocRef} className="hidden" onChange={(e) => setNewEditFiles([...newEditFiles, ...Array.from(e.target.files)])} multiple />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button onClick={() => setIsEditing(false)} className="px-4 py-1.5 text-xs font-bold text-gray-500">Cancel</button>
              <button onClick={handleSaveEdit} disabled={isProcessing} className="px-4 py-1.5 text-xs font-bold bg-blue-950 text-white rounded-lg shadow-md">{isProcessing ? 'Saving...' : 'Save Changes'}</button>
            </div>
          </div>
        ) : (
          <>
            <p className="text-gray-700 text-[15px] leading-relaxed text-left pr-8">{post.content}</p>
            {fileUrls.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {fileUrls.map((url, idx) => (
                  <button key={idx} onClick={() => window.open(url, '_blank')} className="w-12 h-12 flex items-center justify-center bg-gray-50 border border-gray-200 rounded-xl hover:bg-blue-50 hover:border-blue-200 transition-all shadow-sm">
                    {url.toLowerCase().includes('.pdf') ? <FileText size={20} className="text-yellow-600" /> : <ImageIcon size={20} className="text-blue-500" />}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Post Custom Delete Confirmation Modal */}
      {showDeleteConfirm === 'post' && (
        <div className="absolute inset-0 bg-white/95 rounded-xl flex flex-col items-center justify-center p-6 z-40 animate-in fade-in backdrop-blur-sm">
          <AlertTriangle size={24} className="text-red-500 mb-2" />
          <span className="text-sm font-bold text-gray-900 mb-4 uppercase tracking-wider">Delete this discussion?</span>
          <div className="flex gap-4">
            <button onClick={() => setShowDeleteConfirm(null)} className="px-5 py-2 text-xs font-bold text-gray-500 uppercase bg-gray-100 rounded-lg hover:bg-gray-200">Cancel</button>
            <button onClick={() => onDelete(post.id)} className="px-5 py-2 text-xs font-bold text-white bg-red-600 rounded-lg uppercase shadow-md hover:bg-red-700">Confirm</button>
          </div>
        </div>
      )}

      {/* Post Stats & Actions (Eager Loaded) */}
      <div className="mt-4 pt-3 border-t border-gray-50 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <button className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-gray-400 hover:text-red-500 transition-colors"><Heart size={14} /> <span>Like</span></button>
          <button onClick={() => setIsExpanded(!isExpanded)} className={`flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider ${isExpanded ? 'text-blue-600' : 'text-gray-400'}`}><MessageSquare size={14} /> <span>{comments.length} Comments</span></button>
        </div>
        <div className="flex flex-row items-center -space-x-2">
          {[...new Set(comments.map(c => c.profiles?.avatar_url))].filter(Boolean).slice(0, 3).map((url, i) => (
            <img key={i} src={url} className="w-6 h-6 rounded-full border-2 border-white shadow-sm object-cover" />
          ))}
        </div>
      </div>

      {/* Comments Section */}
      {isExpanded && (
        <div className="mt-4 pl-3 border-l-[1px] border-gray-100 space-y-4 animate-in fade-in slide-in-from-top-2">
          <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
            {isLoadingComments && comments.length === 0 ? <div className="flex justify-center py-4"><div className="w-5 h-5 border-2 border-blue-950/20 border-t-blue-950 rounded-full animate-spin"></div></div> : 
              comments.length === 0 ? (
                <div className="text-center py-6 text-xs font-bold text-gray-400 uppercase tracking-widest italic">No comments yet. Share your thoughts!</div>
              ) : (
                comments.map((comment) => {
                  const isReply = !!comment.parent_id;
                  const parent = isReply ? getCommentById(comment.parent_id) : null;
                  const isCommentOwner = currentUserId === comment.user_id;

                  return (
                    <div key={comment.id} className={`${isReply ? 'ml-4 pl-4 border-l-2 border-gray-200 mt-2 relative' : ''}`}>
                      {isReply && parent && (
                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-gray-500 uppercase tracking-tight mb-1 ml-1">
                          <CornerDownRight size={12} className="text-gray-400" />
                          <span>Replying to {parent.profiles?.name}: "{parent.content.slice(0, 20)}..."</span>
                        </div>
                      )}
                      
                      <div className="bg-slate-50/80 rounded-2xl p-3 border border-gray-100/50 shadow-sm relative">
                        <div className="flex items-start gap-2">
                          <img src={comment.profiles?.avatar_url} className="w-7 h-7 rounded-full object-cover border border-white shadow-sm" />
                          <div className="flex-1">
                            <div className="flex justify-between items-center mb-0.5">
                              <span className="text-[12px] font-bold text-gray-900">{comment.profiles?.name || 'Member'}</span>
                              <span className="text-[9px] text-gray-400 font-bold uppercase">{formatRelativeTime(comment.created_at)}</span>
                            </div>
                            
                            {editingCommentId === comment.id ? (
                              <div className="space-y-2 mt-2">
                                <textarea value={editCommentText} onChange={(e) => setEditCommentText(e.target.value)} className="w-full bg-white border border-blue-100 rounded-xl p-3 text-xs focus:outline-none shadow-sm min-h-[80px] leading-relaxed" />
                                <div className="flex justify-end gap-2">
                                  <button onClick={() => setEditingCommentId(null)} className="text-[10px] font-bold text-gray-400 uppercase px-2 py-1">Cancel</button>
                                  <button onClick={() => handleCommentUpdate(comment.id)} className="text-[10px] font-bold text-blue-600 uppercase bg-blue-50 px-3 py-1 rounded-lg">Save Changes</button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <p className="text-xs text-gray-700 leading-relaxed font-medium">{comment.content}</p>
                                <div className="flex gap-4 mt-2 items-center justify-start">
                                  {!isReply && (
                                    <button onClick={() => setReplyingToId(comment.id)} className="text-[10px] font-bold text-blue-600 uppercase tracking-wider hover:underline">Reply</button>
                                  )}
                                  {isCommentOwner && (
                                    <>
                                      <button onClick={() => { setEditingCommentId(comment.id); setEditCommentText(comment.content); }} className="text-[10px] font-bold text-amber-600 uppercase tracking-wider hover:underline">Edit</button>
                                      <button onClick={() => setShowDeleteConfirm(comment.id)} className="text-[10px] font-bold text-red-600 uppercase tracking-wider hover:underline">Delete</button>
                                    </>
                                  )}
                                </div>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Comment Custom Delete Confirmation Modal */}
                        {showDeleteConfirm === comment.id && (
                          <div className="absolute inset-0 bg-white/95 rounded-2xl flex flex-col items-center justify-center p-3 z-30 animate-in fade-in backdrop-blur-sm">
                            <AlertTriangle size={16} className="text-red-500 mb-1" />
                            <span className="text-[11px] font-bold text-gray-900 mb-2 uppercase">Delete comment?</span>
                            <div className="flex gap-3">
                              <button onClick={() => setShowDeleteConfirm(null)} className="px-3 py-1 text-[10px] font-bold text-gray-500 uppercase bg-gray-100 rounded-lg">Cancel</button>
                              <button onClick={() => handleCommentDelete(comment.id)} className="px-3 py-1 text-[10px] font-bold text-white bg-red-600 rounded-lg uppercase">Confirm</button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )
            }
          </div>

          {/* Comment Input */}
          <div className="pt-4 border-t border-gray-100 space-y-3">
            {replyingToId && (
              <div className="flex items-center justify-between bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100 animate-in slide-in-from-bottom-2">
                <span className="text-[10px] font-bold text-blue-700 uppercase tracking-tighter flex items-center gap-2">
                  <CornerDownRight size={12} /> Replying to {getCommentById(replyingToId)?.profiles?.name}
                </span>
                <button onClick={() => setReplyingToId(null)} className="text-blue-400 hover:text-red-500 p-1"><X size={14} /></button>
              </div>
            )}
            <div className="relative flex-1">
              <textarea 
                value={commentText} 
                onChange={(e) => setCommentText(e.target.value)} 
                placeholder={replyingToId ? "Write a reply..." : "Write a comment..."} 
                className="w-full bg-gray-50 border border-gray-200 rounded-2xl py-4 px-4 pr-12 text-xs text-gray-700 focus:outline-none focus:border-blue-200 transition-all min-h-[80px] resize-none leading-relaxed" 
              />
              <button onClick={() => handleCommentSubmit(replyingToId)} className="absolute right-3 bottom-3 p-1.5 text-blue-600 hover:text-blue-700 bg-white rounded-full shadow-sm border border-gray-100"><Send size={16} /></button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function GroupPage({ params: paramsPromise }) {
  const params = use(paramsPromise);
  const groupId = params?.groupId;

  const [attachments, setAttachments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const mediaInputRef = useRef(null);
  const documentInputRef = useRef(null);

  const [posts, setPosts] = useState([]);
  const [postText, setPostText] = useState('');
  const [groupData, setGroupData] = useState({ name: '', description: '', memberCount: 0, members: [], isAdmin: false });
  const [pendingRequests, setPendingRequests] = useState([]);
  const [showRequests, setShowRequests] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState(null);
  const supabase = createClient();

  useEffect(() => {
    async function fetchData() {
      if (!groupId) return;
      setIsLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setCurrentUserId(user.id);
      
      const { data: group } = await supabase.from('groups').select('name, description').eq('id', groupId).single();
      
      const { data: membersData, count } = await supabase.from('group_members').select('user_id, role', { count: 'exact' }).eq('group_id', groupId);
      const isAdmin = membersData?.some(m => m.user_id === user?.id && m.role === 'admin');
      
      let memberAvatars = [];
      if (membersData && membersData.length > 0) {
        const uids = membersData.slice(0, 5).map(m => m.user_id);
        const { data: profs } = await supabase.from('profiles').select('avatar_url').in('id', uids);
        memberAvatars = profs?.map(p => p.avatar_url).filter(Boolean) || [];
      }

      if (group) setGroupData({ name: group.name, description: group.description, memberCount: count || 1, members: memberAvatars, isAdmin });
      
      // Fetch pending requests for admins
      if (isAdmin) {
        const { data: pending } = await supabase.from('group_members').select('user_id').eq('group_id', groupId).eq('status', 'pending');
        if (pending && pending.length > 0) {
          const uids = pending.map(p => p.user_id);
          const { data: pProfs } = await supabase.from('profiles').select('id, name, avatar_url').in('id', uids);
          setPendingRequests(pProfs || []);
        }
      }

      const { data: postsData } = await supabase.from('group_posts').select('*').eq('group_id', groupId).order('created_at', { ascending: false });
      if (postsData && postsData.length > 0) {
        const uids = [...new Set(postsData.map(p => p.user_id))];
        const { data: profs } = await supabase.from('profiles').select('id, name, avatar_url').in('id', uids);
        const pMap = {}; profs?.forEach(p => pMap[p.id] = p);
        setPosts(postsData.map(p => ({ ...p, authorName: pMap[p.user_id]?.name || 'MNetwork Member', authorAvatar: pMap[p.user_id]?.avatar_url })));
      } else { setPosts(postsData || []); }
      setIsLoading(false);
    }
    fetchData();
  }, [groupId, supabase]);

  const handleMemberAction = async (userId, action) => {
    if (action === 'approve') {
      await supabase.from('group_members').update({ status: 'joined' }).eq('group_id', groupId).eq('user_id', userId);
    } else {
      await supabase.from('group_members').delete().eq('group_id', groupId).eq('user_id', userId);
    }
    setPendingRequests(pendingRequests.filter(r => r.id !== userId));
  };

  const uploadFile = async (f) => {
    const n = `${Math.random().toString(36).substring(2)}_${Date.now()}.${f.name.split('.').pop()}`;
    const { error } = await supabase.storage.from('group-attachments').upload(n, f);
    return error ? null : supabase.storage.from('group-attachments').getPublicUrl(n).data.publicUrl;
  };

  const handlePost = async () => {
    if (!postText.trim() && attachments.length === 0) return;
    setUploading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const urls = await Promise.all(attachments.map(uploadFile));
    const cleanUrls = urls.filter(u => u !== null);
    try {
      const { data: newPost, error } = await supabase.from('group_posts').insert([{ group_id: groupId, user_id: user.id, content: postText, file_urls: cleanUrls }]).select('*').single();
      if (error) throw error;
      const { data: p } = await supabase.from('profiles').select('name, avatar_url').eq('id', user.id).single();
      setPosts([{ ...newPost, authorName: p?.name || 'MNetwork Member', authorAvatar: p?.avatar_url }, ...posts]);
      setPostText(''); setAttachments([]);
    } catch (e) { alert(e.message); } finally { setUploading(false); }
  };

  const handleUpdate = async (pid, content, urls) => {
    try {
      await supabase.from('group_posts').update({ content, file_urls: urls }).eq('id', pid);
      setPosts(posts.map(p => p.id === pid ? { ...p, content, file_urls: urls } : p));
      return true;
    } catch (e) { return false; }
  };

  const handleDelete = async (pid) => {
    await supabase.from('group_posts').delete().eq('id', pid);
    setPosts(posts.filter(p => p.id !== pid));
  };

  if (isLoading) return <div className="w-full max-w-2xl mx-auto px-6 py-20 bg-white">Loading...</div>;

  return (
    <div className="w-full max-w-2xl mx-auto pb-10">
      <div className="bg-white border-b border-gray-100">
        <div className="px-6 py-8 flex justify-between items-start w-full relative">
          <div className="flex flex-col items-start text-left ml-8 pl-4">
            <h1 className="text-2xl font-bold text-blue-950 tracking-tight">{groupData.name}</h1>
            <p className="text-sm text-gray-600 mt-1 max-w-md">{groupData.description}</p>
          </div>
          <div className="flex flex-col items-end gap-2 pr-6">
            <div className="flex flex-row items-center -space-x-3">
              {groupData.members.map((url, i) => (
                <img key={i} src={url} className="w-8 h-8 rounded-full border-2 border-white shadow-sm object-cover" />
              ))}
              {groupData.memberCount > 5 && <div className="w-8 h-8 rounded-full bg-gray-50 border-2 border-white shadow-sm flex items-center justify-center text-[10px] font-bold text-gray-400">+{groupData.memberCount - 5}</div>}
            </div>
            <div className="flex items-center gap-4">
              {groupData.isAdmin && pendingRequests.length > 0 && (
                <button onClick={() => setShowRequests(!showRequests)} className="relative p-2.5 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-all border border-blue-200 shadow-md">
                  <UserPlus size={22} />
                  <div className="absolute -top-2 -right-2 w-6 h-6 bg-red-600 text-white text-[12px] font-black rounded-lg flex items-center justify-center border-2 border-white shadow-lg animate-bounce">
                    {pendingRequests.length}
                  </div>
                </button>
              )}
              <span className="text-xs font-medium text-gray-500 uppercase tracking-widest">{groupData.memberCount} Members</span>
            </div>
          </div>

          {/* Pending Requests Dropdown */}
          {showRequests && (
            <div className="absolute top-full right-6 mt-4 w-80 bg-white border border-gray-100 shadow-2xl rounded-2xl p-6 z-50 animate-in fade-in slide-in-from-top-4 border-t-blue-500 border-t-4">
              <div className="flex justify-between items-center mb-6 border-b border-gray-50 pb-3">
                <div className="flex items-center gap-2">
                  <Users size={16} className="text-blue-600" />
                  <span className="text-[12px] font-black text-blue-950 uppercase tracking-widest">Waiting Room</span>
                </div>
                <button onClick={() => setShowRequests(false)} className="text-gray-300 hover:text-red-500 transition-colors"><X size={20} /></button>
              </div>
              <div className="space-y-6">
                {pendingRequests.map(r => (
                  <div key={r.id} className="flex items-center justify-between group p-2 hover:bg-gray-50 rounded-xl transition-all">
                    <div className="flex items-center gap-3">
                      <img src={r.avatar_url} className="w-10 h-10 rounded-full object-cover border-2 border-white shadow-md group-hover:border-blue-200 transition-all" />
                      <span className="text-xs font-bold text-gray-900 truncate max-w-[110px]">{r.name}</span>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => handleMemberAction(r.id, 'approve')} title="Approve Member" className="px-3.5 py-2 bg-green-50 text-green-600 rounded-xl hover:bg-green-600 hover:text-white border border-green-100 transition-all shadow-sm"><Check size={18} /></button>
                      <button onClick={() => handleMemberAction(r.id, 'decline')} title="Decline Request" className="px-3.5 py-2 bg-red-50 text-red-600 rounded-xl hover:bg-red-600 hover:text-white border border-red-100 transition-all shadow-sm"><X size={18} /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="px-[22px] mt-6 space-y-8">
        {/* Composer */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <textarea value={postText} onChange={(e) => setPostText(e.target.value)} placeholder="Share an update..." className="w-full min-h-[100px] bg-gray-50 rounded-lg p-4 text-sm focus:outline-none resize-none leading-relaxed" />
          
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3 p-2 bg-blue-50/50 rounded-lg border border-blue-100">
              {attachments.map((f, i) => (
                <div key={i} className="relative group">
                  <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center border border-blue-200 shadow-sm">
                    {f.name.toLowerCase().endsWith('.pdf') ? <FileText size={20} className="text-yellow-600" /> : <ImageIcon size={20} className="text-blue-500" />}
                  </div>
                  <button onClick={() => setAttachments(attachments.filter((_, idx) => idx !== i))} className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full p-0.5 shadow-sm"><X size={10} /></button>
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 flex items-center justify-between pt-3 border-t border-gray-50">
            <div className="flex items-center gap-4">
              <button onClick={() => mediaInputRef.current.click()} className="text-blue-400 p-2 hover:bg-blue-50 rounded-lg transition-all"><ImageIcon size={20} /></button>
              <button onClick={() => documentInputRef.current.click()} className="text-yellow-500 p-2 hover:bg-yellow-50 rounded-lg transition-all"><FileText size={20} /></button>
              <input type="file" ref={mediaInputRef} onChange={(e) => setAttachments([...attachments, ...Array.from(e.target.files)])} multiple className="hidden" />
              <input type="file" ref={documentInputRef} onChange={(e) => setAttachments([...attachments, ...Array.from(e.target.files)])} multiple className="hidden" />
            </div>
            <div className="flex items-center">
              <Link href="/groups"><button className="text-gray-500 px-4 text-sm font-medium hover:text-blue-950 transition-colors">Back</button></Link>
              <button onClick={handlePost} disabled={uploading} className="bg-blue-950 text-white w-[110px] h-[38px] rounded-lg font-bold text-sm shadow-md hover:bg-blue-900 transition-all">{uploading ? 'Posting...' : 'Post'}</button>
            </div>
          </div>
        </div>

        {/* Feed */}
        <div className="space-y-4">
          {posts.length === 0 ? (
            <div className="py-20 text-center flex flex-col items-center">
              <MessageSquare size={48} className="text-gray-100 mb-4" />
              <p className="text-sm font-bold text-gray-400 uppercase tracking-widest italic">No discussions yet. Be the first to start the conversation!</p>
            </div>
          ) : (
            posts.map(p => (
              <DiscussionThread 
                key={p.id} 
                post={p} 
                currentUserId={currentUserId} 
                onDelete={handleDelete} 
                onUpdate={handleUpdate} 
                uploadFile={uploadFile}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
