'use client';

import { useState, useEffect, use, useRef } from 'react';
import { createClient } from '@/lib/supabase';
import { MessageSquare, Send, Image as ImageIcon, FileText, Heart, Users, X, FileIcon, ExternalLink, Download, Paperclip, MoreVertical, Edit2, Trash2, Plus, CornerDownRight, AlertTriangle, UserPlus, Check, XCircle } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Settings, LogOut } from 'lucide-react';
import DOMPurify from 'dompurify';
const RichTextEditor = ({ value, onChange, placeholder, className = "" }) => {
  const containerRef = useRef(null);
  const quillRef = useRef(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && containerRef.current && !quillRef.current) {
      const initQuill = async () => {
        const Quill = (await import('quill')).default;
        quillRef.current = new Quill(containerRef.current, {
          theme: 'snow',
          placeholder: placeholder || 'Type here...',
          modules: {
            toolbar: [
              ['bold', 'italic'],
              [{ 'list': 'ordered' }, { 'list': 'bullet' }],
            ],
          },
        });

        quillRef.current.on('text-change', () => {
          const html = quillRef.current.root.innerHTML;
          if (html === '<p><br></p>') {
            onChange('');
          } else {
            onChange(html);
          }
        });

        if (value) {
          quillRef.current.root.innerHTML = value;
        }
      };
      initQuill();
    }
  }, [mounted]);

  useEffect(() => {
    if (quillRef.current && value !== quillRef.current.root.innerHTML) {
      if (value === '' && quillRef.current.root.innerHTML === '<p><br></p>') return;
      quillRef.current.root.innerHTML = value || '';
    }
  }, [value]);

  return (
    <div className={`rich-text-editor-container ${className}`}>
      <div ref={containerRef} />
    </div>
  );
};

import 'react-quill/dist/quill.snow.css';

const QUILL_STYLE = `
  .quill-composer .ql-container {
    font-family: inherit;
    font-size: 14px;
    border: none !important;
  }
  .quill-composer .ql-editor {
    min-height: 40px;
    max-height: 120px;
    padding: 10px 16px;
    line-height: 1.6;
    background: #f9fafb;
    border-radius: 8px;
  }
  .quill-composer .ql-editor.ql-blank::before {
    left: 16px;
    color: #9ca3af;
    font-style: normal;
  }
  .quill-composer .ql-toolbar {
    border: none !important;
    padding: 8px 0 0 0 !important;
    display: flex;
    align-items: center;
  }
  .quill-composer .ql-formats {
    margin-right: 8px !important;
  }
`;


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

function WhoLikedModal({ postId, onClose }) {
  const [likers, setLikers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    async function fetchLikers() {
      const { data: likes } = await supabase.from('group_post_likes').select('user_id').eq('post_id', postId);
      if (likes && likes.length > 0) {
        const uids = likes.map(l => l.user_id);
        const { data: profiles } = await supabase.from('profiles').select('name, avatar_url').in('id', uids);
        setLikers(profiles || []);
      }
      setLoading(false);
    }
    fetchLikers();
  }, [postId]);

  const displayedLikers = searchQuery.trim() 
    ? likers.filter(l => l.name?.toLowerCase().includes(searchQuery.toLowerCase()))
    : likers.slice(0, 5);

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white w-full max-w-sm rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="px-6 pt-6 pb-4 border-b border-gray-100 flex items-center bg-gray-50/50 relative">
          <h3 className="w-full text-center text-lg font-bold uppercase text-blue-950">{likers.length} PEOPLE WHO LIKED IT</h3>
          <button onClick={onClose} className="absolute right-4 text-gray-400 hover:text-red-500 transition-colors"><X size={20} /></button>
        </div>
        
        <div className="px-6 mt-4 mb-2">
          <input 
            type="text" 
            placeholder="Search name..." 
            className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-900" 
            value={searchQuery} 
            onChange={(e) => setSearchQuery(e.target.value)} 
          />
        </div>

        <div className="max-h-[300px] overflow-y-auto p-6 space-y-4 pt-4">
          {loading ? <div className="py-10 text-center text-xs font-bold text-gray-400 uppercase animate-pulse">Loading...</div> :
            likers.length === 0 ? <div className="py-10 text-center text-xs font-bold text-gray-400 uppercase italic">No likes yet</div> :
            <>
              {displayedLikers.map((l, i) => (
                <div key={i} className="flex items-center gap-3 p-2 hover:bg-blue-50 rounded-xl transition-all">
                  <img src={l.avatar_url} className="w-10 h-10 rounded-full object-cover border-2 border-white shadow-md" />
                  <span className="text-sm font-bold text-gray-900">{l.name}</span>
                </div>
              ))}
              {!searchQuery && likers.length > 5 && (
                <p className="text-xs text-center text-gray-400 mt-2 italic">Search to see more...</p>
              )}
            </>
          }
        </div>
      </div>
    </div>
  );
}

function DiscussionThread({ post, currentUserId, isAdmin, onDelete, onUpdate, uploadFile }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [comments, setComments] = useState([]);
  const [visibleCommentsCount, setVisibleCommentsCount] = useState(3);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(post.content);
  const [editFileUrls, setEditFileUrls] = useState(Array.isArray(post.file_urls) ? post.file_urls : []);
  const [newEditFiles, setNewEditFiles] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editCommentText, setEditCommentText] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null); // 'post' or 'commentId'

  // Social Stats State
  const [likesCount, setLikesCount] = useState(0);
  const [userHasLiked, setUserHasLiked] = useState(false);
  const [showLikers, setShowLikers] = useState(false);
  const [activeThread, setActiveThread] = useState(null);
  const [modalCommentText, setModalCommentText] = useState('');
  const [visibleBatchCount, setVisibleBatchCount] = useState(2);

  const editMediaRef = useRef(null);
  const editDocRef = useRef(null);
  const supabase = createClient();
  const isPostAuthor = currentUserId === post.user_id;
  const fileUrls = Array.isArray(post.file_urls) ? post.file_urls : [];

  useEffect(() => {
    fetchComments();
    fetchLikes();
  }, []);

  const fetchLikes = async () => {
    const { data: likes, count } = await supabase.from('group_post_likes').select('*', { count: 'exact' }).eq('post_id', post.id);
    setLikesCount(count || 0);
    if (currentUserId) {
      setUserHasLiked(likes?.some(l => l.user_id === currentUserId) || false);
    }
  };

  const handleLikeToggle = async () => {
    if (!currentUserId) return;
    const wasLiked = userHasLiked;
    setUserHasLiked(!wasLiked);
    setLikesCount(prev => wasLiked ? prev - 1 : prev + 1);
    try {
      if (wasLiked) {
        await supabase.from('group_post_likes').delete().eq('post_id', post.id).eq('user_id', currentUserId);
      } else {
        await supabase.from('group_post_likes').insert([{ post_id: post.id, user_id: currentUserId }]);
      }
    } catch (e) {
      setUserHasLiked(wasLiked);
      setLikesCount(prev => wasLiked ? prev + 1 : prev - 1);
      alert("Social action failed.");
    }
  };

  const fetchComments = async () => {
    setIsLoadingComments(true);
    try {
      const { data: commentsData } = await supabase.from('group_comments').select('*').eq('post_id', post.id).order('created_at', { ascending: false });
      if (commentsData && commentsData.length > 0) {
        const userIds = [...new Set(commentsData.map(c => c.user_id))];
        const { data: profiles } = await supabase.from('profiles').select('id, name, avatar_url').in('id', userIds);
        const pMap = {}; profiles?.forEach(p => pMap[p.id] = p);
        setComments(commentsData.map(c => ({ ...c, profiles: pMap[c.user_id] })));
      } else { setComments(commentsData || []); }
    } finally { setIsLoadingComments(false); }
  };

  const handleCommentSubmit = async (parentId = null) => {
    const text = parentId ? modalCommentText : commentText;
    if (!text.trim()) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    try {
      const { data: newComment, error } = await supabase.from('group_comments').insert([
        { post_id: post.id, user_id: user.id, content: text, parent_id: parentId }
      ]).select('*').maybeSingle();
      if (error) throw error;
      const { data: profile } = await supabase.from('profiles').select('name, avatar_url').eq('id', user.id).maybeSingle();
      setComments([{ ...newComment, profiles: profile }, ...comments]);
      if (parentId) setModalCommentText(''); else setCommentText('');
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
    if (!editText.replace(/<[^>]*>/g, '').trim() && editFileUrls.length === 0) {
      alert("Post cannot be empty");
      return;
    }
    setIsProcessing(true);
    try {
      await onUpdate(post.id, editText, editFileUrls);
      setIsEditing(false);
    } catch (e) { alert(e.message); } finally { setIsProcessing(false); }
  };

  const handleReplyClick = (comment) => {
    setActiveThread(comment);
  };

  const getReplyCount = (cid) => comments.filter(c => c.parent_id === cid).length;
  const handleDiveIntoLevel2 = (comment) => {
    setVisibleBatchCount(2);
    setActiveThread(comment);
  };
  const setEditingComment = (comment) => {
    setEditingCommentId(comment.id);
    setEditCommentText(comment.content);
  };
  const handleDeleteComment = (cid) => setShowDeleteConfirm(cid);

  return (
    <div key={post.id} className="bg-white rounded-xl shadow-sm p-4 border border-gray-100 animate-in fade-in slide-in-from-bottom-2 duration-300 relative text-left">
      {/* Post Header */}
      {!isEditing && (isPostAuthor || isAdmin) && (
        <div className="absolute top-4 right-4 z-10">
          <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg"><MoreVertical size={16} /></button>
          {isMenuOpen && (
            <div className="absolute right-0 mt-1 w-32 bg-white border border-gray-100 shadow-xl rounded-xl py-1 z-20">
              {isPostAuthor && <button onClick={() => { setIsEditing(true); setIsMenuOpen(false); }} className="w-full text-left px-4 py-2 text-xs font-bold text-gray-600 hover:bg-blue-50 flex items-center gap-2"><Edit2 size={14} /> Edit</button>}
              <button onClick={() => { setShowDeleteConfirm('post'); setIsMenuOpen(false); }} className="w-full text-left px-4 py-2 text-xs font-bold text-red-500 hover:bg-red-50 flex items-center gap-2"><Trash2 size={14} /> Delete</button>
            </div>
          )}
        </div>
      )}

      <div className="flex items-center gap-3 mb-3">
        {post.authorAvatar ? <img src={post.authorAvatar} className="w-9 h-9 rounded-full object-cover border border-gray-200" /> : <div className="w-9 h-9 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center"><div className="w-5 h-5 bg-gray-300 rounded-full"></div></div>}
        <div>
          <div className="text-sm font-bold text-gray-900 leading-none">{post.authorName || 'MNetwork Member'}</div>
          <div className="text-[10px] text-gray-400 font-medium uppercase mt-1 tracking-wider">{formatRelativeTime(post.created_at)}</div>
        </div>
      </div>

      {/* Post Body */}
      <div className="space-y-3">
        {isEditing ? (
          <div className="space-y-4 quill-composer">
            <RichTextEditor 
              value={editText}
              onChange={setEditText}
              className="bg-gray-50 border border-blue-100 rounded-xl overflow-hidden"
              placeholder="Edit your post..."
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setIsEditing(false)} className="px-4 py-1.5 text-xs font-bold text-gray-500">Cancel</button>
              <button onClick={handleSaveEdit} disabled={isProcessing} className="px-4 py-1.5 text-xs font-bold bg-blue-950 text-white rounded-lg shadow-md">{isProcessing ? 'Saving...' : 'Save Changes'}</button>
            </div>
          </div>
        ) : (
          <>
            <div 
              className="text-gray-700 text-[15px] leading-relaxed pr-8 rich-text"
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(post.content || '') }}
            />
            {fileUrls.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {fileUrls.map((url, idx) => (
                  <button key={idx} onClick={() => window.open(url, '_blank')} className="w-12 h-12 flex items-center justify-center bg-gray-50 border border-gray-200 rounded-xl hover:bg-blue-50 transition-all shadow-sm">
                    {url.toLowerCase().includes('.pdf') ? <FileText size={20} className="text-yellow-600" /> : <ImageIcon size={20} className="text-blue-500" />}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Post Actions */}
      <div className="mt-4 pt-4 border-t border-gray-50 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-1.5">
            <button onClick={handleLikeToggle} className={`p-1.5 rounded-full transition-all ${userHasLiked ? 'text-red-500 bg-red-50' : 'text-gray-400 hover:text-red-500 hover:bg-red-50'}`}><Heart size={18} fill={userHasLiked ? "currentColor" : "none"} /></button>
            {likesCount > 0 && <button onClick={() => setShowLikers(true)} className="text-xs font-black text-gray-400 hover:text-gray-600">{likesCount}</button>}
          </div>
          <button onClick={() => setIsExpanded(!isExpanded)} className={`flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider ${isExpanded ? 'text-blue-600' : 'text-gray-400 hover:text-blue-500'}`}><MessageSquare size={16} /> <span>{comments.length > 0 ? comments.length : ''}</span></button>
        </div>
        <div className="flex flex-row items-center -space-x-2">
          {[...new Set(comments.map(c => c.profiles?.avatar_url))].filter(Boolean).slice(0, 3).map((url, i) => (
            <img key={i} src={url} className="w-6 h-6 rounded-full border-2 border-white shadow-sm object-cover" />
          ))}
        </div>
      </div>

      {showLikers && <WhoLikedModal postId={post.id} onClose={() => setShowLikers(false)} />}

      {/* STABILIZED LOGBOOK COMMENTS */}
      {isExpanded && (
        <div className="mt-4 border-t border-gray-100 pt-4 space-y-4 animate-in fade-in slide-in-from-top-2">
          <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
            {isLoadingComments && comments.length === 0 ? (
              <div className="flex justify-center py-4">
                <div className="w-5 h-5 border-2 border-blue-950/20 border-t-blue-950 rounded-full animate-spin"></div>
              </div>
            ) : comments.length === 0 ? (
              <div className="text-center py-6 text-xs font-bold text-gray-400 uppercase tracking-widest italic">No comments yet.</div>
            ) : (
              <div className="space-y-4">
                {comments.filter(c => !c.parent_id).slice(0, visibleCommentsCount).map((comment) => (
                  <div key={comment.id} className="flex gap-3 items-start w-full group">
                    <img src={comment.profiles?.avatar_url || '/default-avatar.png'} className="w-8 h-8 rounded-full object-cover border border-white shadow-sm mt-1 shrink-0" />
                    <div className="flex-1 flex flex-col items-start min-w-0">
                      {/* Text Bubble */}
                      <div className="bg-gray-50 rounded-2xl px-4 py-2 relative border border-gray-100/50 h-auto w-fit max-w-[85%]">
                        <div className="flex justify-between items-center gap-4 mb-0.5">
                          <span className="text-xs font-bold text-blue-950 truncate">{comment.profiles?.name}</span>
                          <span className="text-[9px] text-gray-400 font-bold uppercase shrink-0">{formatRelativeTime(comment.created_at)}</span>
                        </div>
                        
                        {editingCommentId === comment.id ? (
                          <div className="space-y-2 mt-2 min-w-[200px]">
                            <textarea value={editCommentText} onChange={(e) => setEditCommentText(e.target.value)} className="w-full bg-white border border-blue-100 rounded-xl p-2 text-xs focus:outline-none min-h-[60px]" />
                            <div className="flex justify-end gap-2">
                              <button onClick={() => setEditingCommentId(null)} className="text-[9px] font-bold text-gray-400 uppercase">Cancel</button>
                              <button onClick={() => handleCommentUpdate(comment.id)} className="text-[9px] font-bold text-blue-600 uppercase bg-blue-50 px-2 py-0.5 rounded-lg">Save</button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm text-gray-800 leading-relaxed break-words">{comment.content}</p>
                        )}

                        {showDeleteConfirm === comment.id && (
                          <div className="absolute inset-0 bg-white/95 rounded-2xl flex flex-col items-center justify-center z-10">
                            <span className="text-[10px] font-bold text-gray-900 mb-2 uppercase">Delete?</span>
                            <div className="flex gap-3">
                              <button onClick={() => setShowDeleteConfirm(null)} className="px-2 py-0.5 text-[9px] font-bold text-gray-500 uppercase bg-gray-100 rounded">No</button>
                              <button onClick={() => handleCommentDelete(comment.id)} className="px-2 py-0.5 text-[9px] font-bold text-white bg-red-600 rounded">Yes</button>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Unified Action Bar (Verbatim) */}
                      <div className="flex items-center gap-4 mt-1 ml-2">
                        <button 
                          onClick={() => handleDiveIntoLevel2(comment)} 
                          className={`flex items-center gap-1 text-[11px] transition-colors ${
                            getReplyCount(comment.id) > 0 ? 'text-orange-500 font-bold' : 'text-gray-400'
                          }`}
                        >
                          <MessageSquare size={12} fill={getReplyCount(comment.id) > 0 ? "currentColor" : "none"} />
                          <span>{getReplyCount(comment.id) > 0 ? getReplyCount(comment.id) : 'Reply'}</span>
                        </button>

                        {currentUserId === comment.user_id && !editingCommentId && (
                          <>
                            <button onClick={() => setEditingComment(comment)} className="text-gray-400 text-[11px] hover:text-blue-900 font-bold uppercase">Edit</button>
                            <button onClick={() => handleDeleteComment(comment.id)} className="text-gray-400 text-[11px] hover:text-red-600 font-bold uppercase">Delete</button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {comments.filter(c => !c.parent_id).length > visibleCommentsCount && (
                  <button onClick={() => setVisibleCommentsCount(prev => prev + 3)} className="text-[10px] font-bold text-blue-600 uppercase tracking-widest pl-11 hover:underline">View more comments...</button>
                )}
              </div>
            )
          }
        </div>

          {/* Stabilized Input Box */}
          <div className="pt-4 border-t border-gray-100">
            <div className="relative">
              <textarea 
                value={commentText} 
                onChange={(e) => setCommentText(e.target.value)} 
                placeholder="Write a comment..." 
                className="w-full bg-gray-50 border border-gray-200 rounded-2xl py-3 px-4 pr-12 text-xs text-gray-700 focus:outline-none focus:border-blue-200 transition-all min-h-[60px] resize-none shadow-inner" 
              />
              <button onClick={() => handleCommentSubmit()} className="absolute right-3 bottom-3 p-1.5 text-blue-600 hover:text-blue-700 bg-white rounded-full shadow-sm border border-gray-100"><Send size={16} /></button>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm === 'post' && (
        <div className="absolute inset-0 bg-white/95 rounded-xl flex flex-col items-center justify-center p-6 z-40 animate-in fade-in backdrop-blur-sm">
          <AlertTriangle size={24} className="text-red-500 mb-2" />
          <span className="text-sm font-bold text-gray-900 mb-4 uppercase tracking-wider text-center">Delete this discussion?</span>
          <div className="flex gap-4">
            <button onClick={() => setShowDeleteConfirm(null)} className="px-5 py-2 text-xs font-bold text-gray-500 uppercase bg-gray-100 rounded-lg hover:bg-gray-200">Cancel</button>
            <button onClick={() => onDelete(post.id)} className="px-5 py-2 text-xs font-bold text-white bg-red-600 rounded-lg uppercase shadow-md hover:bg-red-700">Confirm</button>
          </div>
        </div>
      )}

      {/* CONVERSATION DRILL-DOWN MODAL */}
      {activeThread && (
        <div className="fixed inset-0 z-[9999] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in overflow-hidden">
          <style dangerouslySetInnerHTML={{ __html: `
            .no-scrollbar::-webkit-scrollbar { display: none !important; }
            .modal-scroll-area { 
              scrollbar-width: none !important; 
              -ms-overflow-style: none !important; 
            }
          `}} />
          <div 
            className="bg-white w-full max-w-xl max-w-full rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            {/* Header */}
            <div className="p-4 border-b border-gray-100 flex items-center justify-between shrink-0">
              <div className="w-10"></div>
              <h3 className="text-sm font-black text-gray-900 tracking-widest uppercase text-center">Conversation</h3>
              <button onClick={() => { setActiveThread(null); setVisibleBatchCount(2); }} className="p-2 hover:bg-gray-100 rounded-full transition-colors"><X size={20} /></button>
            </div>

            {/* Main Topic (Parent) */}
            <div className="p-4 bg-blue-50 border-b border-blue-100 shrink-0">
              <div className="flex gap-3 items-start">
                <img src={activeThread.profiles?.avatar_url || '/default-avatar.png'} className="w-8 h-8 rounded-full object-cover border-2 border-white shadow-sm mt-1" />
                <div className="flex-1">
                   <div className="text-xs font-bold text-blue-900 uppercase mb-1">{activeThread.profiles?.name}</div>
                   <p className="text-sm text-gray-800 leading-relaxed font-medium">{activeThread.content}</p>
                </div>
              </div>
            </div>

            {/* Replies List */}
            <div 
              className="flex-1 overflow-y-auto overflow-x-hidden px-4 pt-4 pb-20 space-y-4 bg-slate-50/30 no-scrollbar modal-scroll-area" 
              style={{ 
                msOverflowStyle: 'none', 
                scrollbarWidth: 'none', 
                WebkitOverflowScrolling: 'touch',
                overflowX: 'hidden'
              }}
            >
              {comments.filter(c => c.parent_id === activeThread.id).length === 0 ? (
                <div className="text-center py-10 text-xs font-bold text-gray-400 uppercase tracking-widest italic">No replies yet. Start the conversation!</div>
              ) : (
                comments.filter(c => c.parent_id === activeThread.id).reverse().slice(0, visibleBatchCount).map((comment) => (
                  <div key={comment.id} className="flex gap-3 items-start w-full animate-in slide-in-from-left-2">
                    <img src={comment.profiles?.avatar_url || '/default-avatar.png'} className="w-8 h-8 rounded-full object-cover shadow-sm border border-white mt-1 shrink-0" />
                    <div className="flex-1 flex flex-col items-start min-w-0">
                      {/* Text Bubble */}
                      <div className="bg-gray-50 rounded-2xl px-4 py-2 border border-gray-100 shadow-sm relative h-auto w-fit max-w-[85%]">
                         <div className="flex justify-between items-center gap-4 mb-0.5">
                           <span className="text-xs font-bold text-gray-900 truncate">{comment.profiles?.name}</span>
                           <span className="text-[9px] text-gray-400 font-bold uppercase shrink-0">{formatRelativeTime(comment.created_at)}</span>
                         </div>
                         
                         {editingCommentId === comment.id ? (
                           <div className="space-y-2 mt-2 min-w-[200px]">
                             <textarea value={editCommentText} onChange={(e) => setEditCommentText(e.target.value)} className="w-full bg-white border border-blue-100 rounded-xl p-2 text-xs focus:outline-none min-h-[60px]" />
                             <div className="flex justify-end gap-2">
                               <button onClick={() => setEditingCommentId(null)} className="text-[9px] font-bold text-gray-400 uppercase">Cancel</button>
                               <button onClick={() => handleCommentUpdate(comment.id)} className="text-[9px] font-bold text-blue-600 uppercase bg-blue-50 px-2 py-0.5 rounded-lg">Save</button>
                             </div>
                           </div>
                         ) : (
                           <p className="text-sm text-gray-700 leading-relaxed break-words">{comment.content}</p>
                         )}

                         {showDeleteConfirm === comment.id && (
                           <div className="absolute inset-0 bg-white/95 rounded-2xl flex flex-col items-center justify-center z-10">
                             <span className="text-[10px] font-bold text-gray-900 mb-2 uppercase">Delete?</span>
                             <div className="flex gap-3">
                               <button onClick={() => setShowDeleteConfirm(null)} className="px-2 py-0.5 text-[9px] font-bold text-gray-500 uppercase bg-gray-100 rounded">No</button>
                               <button onClick={() => handleCommentDelete(comment.id)} className="px-2 py-0.5 text-[9px] font-bold text-white bg-red-600 rounded">Yes</button>
                             </div>
                           </div>
                         )}
                      </div>

                      {/* Unified Action Bar (Verbatim) */}
                      <div className="flex items-center gap-4 mt-1 ml-2">
                        <button 
                          onClick={() => handleDiveIntoLevel2(comment)} 
                          className={`flex items-center gap-1 text-[11px] transition-colors ${
                            getReplyCount(comment.id) > 0 ? 'text-orange-500 font-bold' : 'text-gray-400'
                          }`}
                        >
                          <MessageSquare size={12} fill={getReplyCount(comment.id) > 0 ? "currentColor" : "none"} />
                          <span>{getReplyCount(comment.id) > 0 ? getReplyCount(comment.id) : 'Reply'}</span>
                        </button>

                        {currentUserId === comment.user_id && !editingCommentId && (
                          <>
                            <button onClick={() => setEditingComment(comment)} className="text-gray-400 text-[11px] hover:text-blue-900 font-bold uppercase">Edit</button>
                            <button onClick={() => handleDeleteComment(comment.id)} className="text-gray-400 text-[11px] hover:text-red-600 font-bold uppercase">Delete</button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
              {comments.filter(c => c.parent_id === activeThread.id).length > visibleBatchCount && (
                <button onClick={() => setVisibleBatchCount(prev => prev + 2)} className="w-full py-2 text-xs text-blue-900 font-semibold italic">Show more replies...</button>
              )}
            </div>

            {/* Modal Input Section */}
            <div className="p-4 border-t border-gray-100 bg-white shrink-0">
              <div className="relative">
                <textarea 
                  value={modalCommentText} 
                  onChange={(e) => setModalCommentText(e.target.value)}
                  placeholder="Reply to this conversation..."
                  className="w-full bg-gray-50 border border-gray-200 rounded-2xl py-3 px-4 pr-12 text-xs text-gray-700 focus:outline-none focus:border-blue-200 transition-all min-h-[60px] resize-none"
                />
                <button 
                  onClick={() => handleCommentSubmit(activeThread.id)}
                  className="absolute right-3 bottom-3 p-1.5 text-blue-600 hover:text-blue-700 bg-white rounded-full shadow-sm border border-gray-100"
                >
                  <Send size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function GroupPage({ params: paramsPromise }) {
  // 1. TOP-LEVEL HOOKS ONLY (No early returns before these)
  const params = use(paramsPromise);
  const groupId = params?.groupId;
  const router = useRouter();
  const supabase = createClient();

  const [attachments, setAttachments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const mediaInputRef = useRef(null);
  const documentInputRef = useRef(null);
  const postComposerRef = useRef(null);

  const [posts, setPosts] = useState([]);
  const [postLimit, setPostLimit] = useState(5);
  const [hasMorePosts, setHasMorePosts] = useState(true);
  const [postText, setPostText] = useState('');
  const [groupData, setGroupData] = useState({ name: '', description: '', memberCount: 0, members: [], owner_id: null });
  const [isMember, setIsMember] = useState(false);
  const [isAdminState, setIsAdminState] = useState(false);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [currentMembers, setCurrentMembers] = useState([]);
  const [showManageModal, setShowManageModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [userToKick, setUserToKick] = useState(null);
  const [showLeaveModal, setShowLeaveModal] = useState(false);

  useEffect(() => {
    fetchData();
  }, [groupId, supabase, postLimit]);

  // Derived State (Ownership)
  const isAdmin = String(currentUserId) === String(groupData?.owner_id);


  const fetchData = async () => {
    if (!groupId) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (user) setCurrentUserId(user.id);
    
    const { data: group } = await supabase.from('groups').select('name, description, owner_id').eq('id', groupId).maybeSingle();
    
    const { data: membersData } = await supabase.from('group_members').select('user_id, role, status').eq('group_id', groupId);
    
    const membership = membersData?.find(m => m.user_id === user?.id);
    const isApprovedMember = membership?.status === 'member';
    const isAdminCheck = user?.id === group?.owner_id;

    // RBAC SECURITY: No Guest Access
    if (!isApprovedMember && user?.id !== group?.owner_id) {
      console.warn("Unauthorized access attempt. Redirecting to directory.");
      router.replace('/groups');
      return;
    }

    setIsMember(isApprovedMember);
    setIsAdminState(isAdminCheck);
    
    let memberAvatars = [];
    if (membersData && membersData.length > 0) {
      const uids = membersData.filter(m => m.status === 'member').slice(0, 5).map(m => m.user_id);
      const { data: profs } = await supabase.from('profiles').select('avatar_url').in('id', uids);
      memberAvatars = profs?.map(p => p.avatar_url).filter(Boolean) || [];
    }

    if (group) setGroupData({ 
      name: group.name, 
      description: group.description, 
      memberCount: membersData?.filter(m => m.status === 'member').length || 0, 
      members: memberAvatars, 
      owner_id: group.owner_id 
    });
    
    // Fetch Detailed Member Info for Modal
    if (isAdminCheck) {
      const pendingUids = membersData?.filter(m => m.status === 'pending').map(m => m.user_id) || [];
      const joinedUids = membersData?.filter(m => m.status === 'member').map(m => m.user_id) || [];
      
      if (pendingUids.length > 0) {
        const { data: pProfs } = await supabase.from('profiles').select('id, name, avatar_url').in('id', pendingUids);
        setPendingRequests(pProfs || []);
      } else { setPendingRequests([]); }

      if (joinedUids.length > 0) {
        const { data: jProfs } = await supabase.from('profiles').select('id, name, avatar_url').in('id', joinedUids);
        setCurrentMembers(jProfs?.map(p => ({ ...p, role: membersData.find(m => m.user_id === p.id)?.role })) || []);
      } else { setCurrentMembers([]); }
    }

    // FIX: Force Topic Pagination (Initial limit 5)
    const { data: postsData } = await supabase.from('group_posts').select('*').eq('group_id', groupId).order('created_at', { ascending: false }).limit(postLimit);
    if (postsData && postsData.length > 0) {
      const uids = [...new Set(postsData.map(p => p.user_id))];
      const { data: profs } = await supabase.from('profiles').select('id, name, avatar_url').in('id', uids);
      const pMap = {}; profs?.forEach(p => pMap[p.id] = p);
      setPosts(postsData.map(p => ({ ...p, authorName: pMap[p.user_id]?.name || 'MNetwork Member', authorAvatar: pMap[p.user_id]?.avatar_url })));
      setHasMorePosts(postsData.length === postLimit);
    } else { setPosts([]); setHasMorePosts(false); }
    setIsLoading(false);
  };

  const fetchRequests = async () => {
    const { data: membersData } = await supabase.from('group_members').select('user_id, role, status').eq('group_id', groupId);
    const pendingUids = membersData?.filter(m => m.status === 'pending').map(m => m.user_id) || [];
    const joinedUids = membersData?.filter(m => m.status === 'member').map(m => m.user_id) || [];
    
    if (pendingUids.length > 0) {
      const { data: pProfs } = await supabase.from('profiles').select('id, name, avatar_url').in('id', pendingUids);
      setPendingRequests(pProfs || []);
    } else { setPendingRequests([]); }

    if (joinedUids.length > 0) {
      const { data: jProfs } = await supabase.from('profiles').select('id, name, avatar_url').in('id', joinedUids);
      setCurrentMembers(jProfs?.map(p => ({ ...p, role: membersData.find(m => m.user_id === p.id)?.role })) || []);
    } else { setCurrentMembers([]); }
  };

  const handleMemberAction = async (targetId, action) => {
    if (!isAdmin) {
      alert("Unauthorized: Only admins can manage members.");
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
      
      // Revalidate
      await Promise.all([fetchData(), fetchRequests()]);
      if (action === 'kick') setUserToKick(null);
    } catch (err) {
      console.error(`Error performing ${action}:`, err.message);
      alert(`Action failed: ${err.message}`);
    }
  };

  const uploadFile = async (f) => {
    const n = `${Math.random().toString(36).substring(2)}_${Date.now()}.${f.name.split('.').pop()}`;
    const { error } = await supabase.storage.from('group-attachments').upload(n, f);
    return error ? null : supabase.storage.from('group-attachments').getPublicUrl(n).data.publicUrl;
  };

  const handlePost = async () => {
    const isTextEmpty = !postText.replace(/<[^>]*>/g, '').trim();
    if (isTextEmpty && attachments.length === 0) return;
    setUploading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const urls = await Promise.all(attachments.map(uploadFile));
    const cleanUrls = urls.filter(u => u !== null);
    try {
      const { data: newPost, error } = await supabase.from('group_posts').insert([{ group_id: groupId, user_id: user.id, content: postText, file_urls: cleanUrls }]).select('*').maybeSingle();
      if (error) throw error;
      const { data: p } = await supabase.from('profiles').select('name, avatar_url').eq('id', user.id).maybeSingle();
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
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Fetch post to check ownership
      const { data: post } = await supabase.from('group_posts').select('user_id').eq('id', pid).maybeSingle();
      
      // RBAC Check: Author or Admin
      if (post?.user_id !== user?.id && !isAdmin) {
        alert("Unauthorized: Only the author or an admin can delete this post.");
        return;
      }

      await supabase.from('group_posts').delete().eq('id', pid);
      setPosts(posts.filter(p => p.id !== pid));
    } catch (error) {
      console.error('Error deleting post:', error);
    }
  };




  const confirmLeaveGroup = async () => {
    const { error } = await supabase
      .from('group_members')
      .delete()
      .eq('group_id', groupId)
      .eq('user_id', currentUserId);
    if (error) {
      alert("Failed to leave group.");
    } else {
      window.location.href = '/groups';
    }
  };

  if (isLoading) return <div className="w-full max-w-2xl mx-auto px-6 py-20 bg-white text-center font-bold text-blue-950 uppercase tracking-widest animate-pulse">Loading Environment...</div>;

  // FIX: Absolute Floor Logic for Member Counter
  const otherMembersCount = Math.max(0, currentMembers.filter(m => m.id !== currentUserId).length);

  // DEBUG: Verify Ownership Match
  console.log("Current User:", currentUserId, "Owner ID:", groupData?.owner_id);

  return (
    // FIX: Scroll Fix and Vertical Padding (pb-32)
    <div className="w-full max-w-2xl mx-auto pb-32 overflow-y-auto">
      <div className="bg-white border-b border-gray-100">

        <div className="px-6 py-8 flex justify-between items-start w-full">
          <div className="flex flex-col items-start text-left pl-4">
            <h1 className="text-lg font-bold text-blue-950 tracking-tight pl-2">{groupData?.name}</h1>
            <p className="text-sm text-gray-600 mt-1 max-w-md pl-2">{groupData?.description}</p>
            
            {/* Goldilocks Admin Action Group */}
            {isAdmin && (
              <div className="flex flex-row items-center gap-2 mt-4 pl-2">
                <button 
                  onClick={() => setShowManageModal(true)} 
                  className="py-2 px-4 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.1em] border border-blue-200 shadow-sm"
                >
                  <Settings size={14} strokeWidth={2.5} /> Manage Group
                </button>
              </div>
            )}

            {/* Non-Admin Actions: Relocated for visibility */}
            {!isAdmin && isMember && (
              <div className="flex flex-wrap gap-2 mt-4 pl-2">
                <button 
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowLeaveModal(true); }}
                  className="px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.15em] text-red-500 border-2 border-red-100 rounded-full hover:bg-red-50 hover:border-red-200 transition-all flex items-center gap-2 relative z-[9999] pointer-events-auto cursor-pointer"
                >
                  <LogOut size={12} /> Leave Group
                </button>
              </div>
            )}
          </div>

          <div className="hidden min-[472px]:flex flex-col items-end gap-2 pr-6">
            <div className="flex flex-row items-center -space-x-3">
              {groupData?.members?.map((url, i) => (
                <img key={i} src={url} className="w-8 h-8 rounded-full border-2 border-white shadow-sm object-cover" />
              ))}
              {(groupData?.memberCount || 0) > 5 && <div className="w-8 h-8 rounded-full bg-gray-50 border-2 border-white shadow-sm flex items-center justify-center text-[10px] font-bold text-gray-400">+{(groupData?.memberCount || 0) - 5}</div>}
            </div>
            <div className="flex items-center gap-4">
              <span className="text-xs font-medium text-gray-500 uppercase tracking-widest">{(groupData?.memberCount || 0)} Members</span>
            </div>

          </div>
        </div>
      </div>

      {/* Smart Hybrid Admin Modal */}
      {showManageModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 border-t-4 border-blue-600">
            <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h2 className="text-lg font-medium text-blue-950 pl-6">Manage Group Members</h2>
              <button onClick={() => setShowManageModal(false)} className="text-gray-400 hover:text-red-500 transition-colors pr-4"><X size={24} /></button>
            </div>
            
            <div className="max-h-[70vh] overflow-y-auto">
              {/* Pinned: Pending Requests */}
              <div className="p-6 pb-2 border-b border-gray-50 bg-blue-50/20">
                <div className="flex items-center gap-2 mb-4 pl-6">
                  <UserPlus size={16} className="text-blue-600" />
                  <h3 className="text-[11px] font-black text-blue-900 uppercase tracking-[0.2em]">Pending Requests ({pendingRequests.length})</h3>
                </div>
                <div className="space-y-4">
                  {pendingRequests.length === 0 ? (
                    <p className="text-[10px] text-gray-400 italic pl-6 pb-2">No pending requests</p>
                  ) : (
                    pendingRequests.map(r => (
                      <div key={r.id} className="flex items-center justify-between p-3 bg-white rounded-xl border border-blue-100 shadow-sm">
                        <div className="flex items-center gap-3 pl-6">
                          <img src={r.avatar_url} className="w-10 h-10 rounded-full object-cover border-2 border-white shadow-md" />
                          <span className="text-sm font-bold text-gray-900">{r.name}</span>
                        </div>
                        <div className="flex gap-2 pr-4 mr-4">
                          <button onClick={() => handleMemberAction(r.id, 'approve')} className="px-4 py-2 bg-green-50 text-green-600 rounded-xl hover:bg-green-600 hover:text-white border border-green-100 transition-all shadow-sm"><Check size={20} /></button>
                          <button onClick={() => handleMemberAction(r.id, 'decline')} className="px-4 py-2 bg-red-50 text-red-600 rounded-xl hover:bg-red-600 hover:text-white border border-red-100 transition-all shadow-sm"><X size={20} /></button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Scrollable: Current Members */}
              <div className="p-6">
                <div className="flex items-center gap-2 mb-4 pl-6">
                  <Users size={16} className="text-gray-400" />
                  {/* FIX: Absolute Floor for display count */}
                  <h3 className="text-[11px] font-black text-gray-500 uppercase tracking-[0.2em]">Current Members ({otherMembersCount > 0 ? otherMembersCount : '0'})</h3>
                </div>
                <div className="space-y-4">
                  {currentMembers.filter(m => m.id !== currentUserId).map(m => (
                    <div key={m.id} className="flex items-center justify-between group p-3 hover:bg-gray-50 rounded-xl transition-all border border-transparent hover:border-gray-100">
                      <div className="flex items-center gap-3 pl-6">
                        <img src={m.avatar_url} className="w-10 h-10 rounded-full object-cover border-2 border-white shadow-sm" />
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-gray-900">{m.name}</span>
                          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tight">{m.role}</span>
                        </div>
                      </div>
                      {m.role !== 'admin' && (
                        <div className="pr-4 mr-4">
                          <button onClick={() => setUserToKick(m)} className="text-[11px] font-bold text-red-500 uppercase tracking-widest bg-red-50 px-4 py-2 rounded-xl hover:bg-red-600 hover:text-white transition-all">Kick</button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>


            </div>
          </div>

          {/* Custom Kick Confirmation Modal */}
          {userToKick && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[110] flex items-center justify-center p-4">
              <div className="bg-white w-full max-w-sm rounded-2xl p-8 text-center shadow-2xl animate-in zoom-in-95">
                <AlertTriangle size={32} className="text-red-500 mx-auto mb-4" />
                <h3 className="text-lg font-bold text-gray-900 mb-2">Remove Member?</h3>
                <p className="text-sm text-gray-600 mb-6 leading-relaxed px-2 text-center">Remove <span className="font-bold text-gray-900">{userToKick.name}</span> from the group? They can still request to join again later.</p>
                <div className="flex gap-4">
                  <button onClick={() => setUserToKick(null)} className="flex-1 px-4 py-2.5 text-xs font-bold text-gray-500 uppercase bg-gray-100 rounded-xl hover:bg-gray-200 transition-all">Cancel</button>
                  <button onClick={() => handleMemberAction(userToKick.id, 'kick')} className="flex-1 px-4 py-2.5 text-xs font-bold text-white bg-red-600 rounded-xl hover:bg-red-700 shadow-lg shadow-red-200 transition-all">Confirm Kick</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="px-[22px] mt-10 space-y-8">
        {/* Composer */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 quill-composer">
          <style>{QUILL_STYLE}</style>
          <RichTextEditor 
            value={postText}
            onChange={setPostText}
            placeholder="Share an update..."
          />
          
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
            <div className="flex items-center gap-4">
              <Link href="/groups">
                <button className="text-blue-600 px-6 h-[38px] text-sm font-bold hover:text-blue-800 transition-colors flex items-center">
                  Back
                </button>
              </Link>
              {/* FIX: Locked Post Button Geometry 110x38px */}
              <button 
                onClick={handlePost} 
                disabled={uploading || (!postText.replace(/<[^>]*>/g, '').trim() && attachments.length === 0)} 
                className="bg-blue-950 text-white w-[110px] h-[38px] rounded-lg font-bold text-sm shadow-md hover:bg-blue-900 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {uploading ? 'Posting...' : 'Post'}
              </button>
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
            <>
              {posts.map(p => (
                <DiscussionThread 
                key={p.id} 
                post={p} 
                currentUserId={currentUserId}
                isAdmin={isAdmin}
                onDelete={handleDelete}
                onUpdate={handleUpdate}
                uploadFile={uploadFile}
              />
              ))}
              {/* FIX: Topic Pagination Show More Button */}
              {hasMorePosts && (
                <button onClick={() => setPostLimit(prev => prev + 5)} className="w-full py-4 text-blue-600 font-bold hover:bg-blue-50 transition-all rounded-xl border-2 border-dashed border-blue-100 mt-4 uppercase text-xs tracking-widest">Show More Topics</button>
              )}
            </>
          )}
        </div>
      </div>
      {/* Leave Group Confirmation Modal */}
      {showLeaveModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full shadow-2xl flex flex-col items-center text-center animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-bold mb-2 text-center">Leave Group?</h3>
            <p className="text-gray-600 mb-6 px-2 text-sm text-center">Are you sure you want to leave this group? You will lose access to all posts and discussions.</p>
            <div className="flex justify-center gap-4 w-full">
              <button onClick={() => setShowLeaveModal(false)} className="px-6 py-2 text-gray-500 font-medium hover:bg-gray-100 rounded-lg text-sm transition-colors">Cancel</button>
              <button onClick={confirmLeaveGroup} className="px-6 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 text-sm transition-colors">Leave</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
