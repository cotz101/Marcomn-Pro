'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { User, Calendar, ExternalLink, FileText, Play, PlayCircle, ChevronDown, ChevronUp, Pencil, Paperclip, Share2, X, Check, Trash2, AlertTriangle, ThumbsUp, MessageSquare } from 'lucide-react';
import { useProfile } from '@/app/context/ProfileContext';
import { createClient } from '@/lib/supabase';
import DOMPurify from 'dompurify';
import { extractYouTubeId } from '@/src/lib/youtubeUtils';


export default function MBlogCard({ article, userId, isEditable, onEdit, onDelete }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [showShareConfirm, setShowShareConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { showToast } = useProfile();
  const cardRef = useRef(null);
  const supabase = createClient();
  const searchParams = useSearchParams();
  const { profile } = useProfile();

  // Interaction State
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [comments, setComments] = useState([]);
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editCommentValue, setEditCommentValue] = useState('');
  const [commentToDelete, setCommentToDelete] = useState(null);

  useEffect(() => {
    const articleIdParam = searchParams.get('articleId');
    if (articleIdParam === article.id && cardRef.current) {
      setTimeout(() => {
        cardRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        cardRef.current.classList.add('ring-2', 'ring-blue-500', 'ring-offset-4');
        setTimeout(() => {
          cardRef.current.classList.remove('ring-2', 'ring-blue-500', 'ring-offset-4');
        }, 3000);
      }, 500);
    }
  }, [searchParams, article.id]);

  useEffect(() => {
    setMounted(true);
    if (article.id) {
      fetchInteractions();
    }
  }, [article.id, userId]);

  const fetchInteractions = async () => {
    try {
      // 1. Fetch Like Count
      const { count, error: countError } = await supabase
        .from('mblog_article_likes')
        .select('*', { count: 'exact', head: true })
        .eq('article_id', article.id);
      
      if (countError) throw countError;
      setLikeCount(count || 0);

      // 2. Fetch User's Like Status
      if (userId) {
        const { data: likeData, error: likeError } = await supabase
          .from('mblog_article_likes')
          .select('id')
          .eq('article_id', article.id)
          .eq('user_id', userId)
          .maybeSingle();
        
        if (likeError) throw likeError;
        setIsLiked(!!likeData);
      }

      // 3. Fetch Comments
      const { data: commentData, error: commentError } = await supabase
        .from('mblog_article_comments')
        .select(`
          id,
          content,
          created_at,
          user_id,
          user:profiles(name, avatar_url)
        `)
        .eq('article_id', article.id)
        .order('created_at', { ascending: false });

      if (commentError) throw commentError;
      
      // Map data to match UI expectations
      const mappedComments = (commentData || []).map(c => ({
        id: c.id,
        user: c.user,
        userId: c.user_id,
        text: c.content,
        created_at: c.created_at
      }));
      
      setComments(mappedComments);
    } catch (err) {
      console.error('Error fetching interactions:', err);
    }
  };

  const getRelativeTime = (dateString) => {
    const now = new Date();
    const past = new Date(dateString);
    const diffInMs = now - past;
    const diffInSecs = Math.floor(diffInMs / 1000);
    const diffInMins = Math.floor(diffInSecs / 60);
    const diffInHours = Math.floor(diffInMins / 60);
    const diffInDays = Math.floor(diffInHours / 24);

    if (diffInSecs < 60) return 'Just now';
    if (diffInMins < 60) return `${diffInMins}m ago`;
    if (diffInHours < 24) return `${diffInHours}h ago`;
    if (diffInDays < 7) return `${diffInDays}d ago`;
    return past.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const getPlainText = (html) => {
    if (!html) return '';
    if (typeof window === 'undefined') return '';
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    return tempDiv.textContent || tempDiv.innerText || '';
  };

  const truncateHtmlWithTags = (html, limit) => {
    if (!html) return '';
    if (typeof window === 'undefined') return html; // SSR Fallback
    
    // Create a temporary div to parse HTML
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    
    // Helper to find the first two paragraphs or hit a character limit
    const getSmartBreakpoint = (text, charLimit) => {
      // Find sentence endings
      const sentenceRegex = /[^.!?]+[.!?](\s|$)/g;
      let match;
      let lastIndex = 0;
      
      while ((match = sentenceRegex.exec(text)) !== null) {
        lastIndex = sentenceRegex.lastIndex;
        // Break at or around the character limit
        if (lastIndex >= charLimit) break;
      }
      
      // Fallback: find nearest word break around charLimit
      if (lastIndex === 0 || lastIndex < charLimit * 0.5) {
        const beforeLimit = text.lastIndexOf(' ', charLimit);
        return beforeLimit > 0 ? beforeLimit : charLimit;
      }
      
      return lastIndex;
    };

    const plainText = tempDiv.textContent || tempDiv.innerText || '';
    const smartLimit = getSmartBreakpoint(plainText, limit);

    if (plainText.length <= smartLimit) return html;

    let currentLength = 0;
    let resultHtml = '';
    let isTruncated = false;

    const traverse = (node) => {
      if (isTruncated) return;

      if (node.nodeType === 3) { // Node.TEXT_NODE
        const remaining = smartLimit - currentLength;
        if (node.textContent.length > remaining) {
          resultHtml += node.textContent.substring(0, remaining).trim();
          currentLength = smartLimit;
          isTruncated = true;
        } else {
          resultHtml += node.textContent;
          currentLength += node.textContent.length;
        }
      } else if (node.nodeType === 1) { // Node.ELEMENT_NODE
        const tagName = node.tagName.toLowerCase();
        resultHtml += `<${tagName}${Array.from(node.attributes).map(attr => ` ${attr.name}="${attr.value}"`).join('')}>`;
        
        for (const child of node.childNodes) {
          traverse(child);
          if (isTruncated) break;
        }
        
        resultHtml += `</${tagName}>`;
      }
    };

    for (const child of tempDiv.childNodes) {
      traverse(child);
      if (isTruncated) break;
    }
    return isTruncated ? resultHtml + '...' : resultHtml;
  };

  const handleShare = async () => {
    if (!userId || isSharing) return;
    
    setIsSharing(true);
    try {
      const { error } = await supabase
        .from('logbook_posts')
        .insert({
          user_id: userId,
          shared_article_id: article.id,
          content: `Check out this blog post: ${article.title}`,
          media_type: 'article_share'
        });

      if (error) throw error;
      showToast('Successfully shared to Logbook!', 'success');
      setShowShareConfirm(false);
    } catch (err) {
      console.error('Error sharing to Logbook:', err);
      showToast('Failed to share to Logbook.', 'error');
    } finally {
      setIsSharing(false);
    }
  };

  const handleDelete = async () => {
    if (!userId || isDeleting) return;
    
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('mblog_articles')
        .delete()
        .eq('id', article.id);

      if (error) throw error;
      
      showToast('Article deleted successfully', 'success');
      onDelete?.(article.id);
      setShowDeleteConfirm(false);
    } catch (err) {
      console.error('Error deleting article:', err);
      showToast('Failed to delete article.', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleLikeToggle = async () => {
    if (!userId) {
      showToast('Please sign in to like articles', 'info');
      return;
    }

    const previousLiked = isLiked;
    const previousCount = likeCount;

    // Optimistic Update
    setIsLiked(!previousLiked);
    setLikeCount(prev => previousLiked ? prev - 1 : prev + 1);

    try {
      if (previousLiked) {
        // Unlike
        const { error } = await supabase
          .from('mblog_article_likes')
          .delete()
          .eq('article_id', article.id)
          .eq('user_id', userId);
        if (error) throw error;
      } else {
        // Like
        const { error } = await supabase
          .from('mblog_article_likes')
          .insert({
            article_id: article.id,
            user_id: userId
          });
        if (error) throw error;
      }
    } catch (err) {
      console.error('Error toggling like:', err);
      // Rollback
      setIsLiked(previousLiked);
      setLikeCount(previousCount);
      showToast('Failed to update like status.', 'error');
    }
  };

  const handlePostComment = async () => {
    if (!commentText.trim() || !userId) return;
    
    const textToPost = commentText;
    const tempId = Date.now();
    const previousComments = [...comments];

    // Optimistic Update
    const optimisticComment = {
      id: tempId,
      user: { 
        name: profile?.name || 'Anonymous User', 
        avatar_url: profile?.avatar_url 
      },
      text: textToPost,
      created_at: new Date().toISOString()
    };
    
    setComments([optimisticComment, ...comments]);
    setCommentText('');

    try {
      const { data, error } = await supabase
        .from('mblog_article_comments')
        .insert({
          article_id: article.id,
          user_id: userId,
          content: textToPost
        })
        .select(`
          id,
          content,
          created_at,
          user:profiles(name, avatar_url)
        `)
        .maybeSingle();

      if (error) throw error;

      // Replace optimistic comment with real one from DB
      setComments(prev => prev.map(c => c.id === tempId ? {
        id: data.id,
        user: data.user,
        userId: data.user_id,
        text: data.content,
        created_at: data.created_at
      } : c));

    } catch (err) {
      console.error('Error posting comment:', err);
      // Rollback
      setComments(previousComments);
      setCommentText(textToPost);
      showToast('Failed to post comment.', 'error');
    }
  };

  const handleDeleteComment = async () => {
    const commentId = commentToDelete;
    if (!commentId) return;

    const previousComments = [...comments];
    
    // Optimistic UI Update
    setComments(prev => prev.filter(c => c.id !== commentId));
    setCommentToDelete(null);

    try {
      // Execute Deletion (Logic)
      const { error } = await supabase
        .from('mblog_article_comments')
        .delete()
        .eq('id', commentId);

      if (error) throw error;
      showToast('Comment deleted', 'success');
    } catch (err) {
      console.error('Error deleting comment:', err);
      // Rollback on error
      setComments(previousComments);
      showToast('Failed to delete comment.', 'error');
    }
  };

  const handleUpdateComment = async (commentId) => {
    if (!editCommentValue.trim()) return;
    
    const newText = editCommentValue;
    const previousComments = [...comments];
    
    // Optimistic Update
    setComments(prev => prev.map(c => c.id === commentId ? { ...c, text: newText } : c));
    setEditingCommentId(null);

    try {
      const { error } = await supabase
        .from('mblog_article_comments')
        .update({ content: newText })
        .eq('id', commentId);

      if (error) throw error;
    } catch (err) {
      console.error('Error updating comment:', err);
      setComments(previousComments);
      showToast('Failed to update comment.', 'error');
    }
  };

  const contentLimit = 300;
  const plainText = getPlainText(article.content_html || '');
  const shouldTruncate = plainText.length > contentLimit;

  return (
    <div 
      className="card p-0 overflow-hidden hover:shadow-md transition-shadow border border-gray-100 bg-white" 
      ref={cardRef}
    >
      <div className="p-6 relative">
        {/* HIERARCHY: TITLE FIRST */}
        <div className="flex justify-between items-start gap-4 mb-3">
          <h2 className="text-2xl font-bold text-[#0e2a4d] leading-tight hover:text-[#004173] transition-colors flex-1">
            {article.title}
          </h2>
          
          {isEditable && (
            <div className="flex items-center gap-2">
              <button 
                onClick={() => onEdit?.(article)}
                className="p-2 bg-gray-50 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-all active:scale-90 border border-transparent hover:border-blue-100"
                title="Edit Article"
              >
                <Pencil size={18} />
              </button>
              <button 
                onClick={() => setShowDeleteConfirm(true)}
                className="p-2 bg-gray-50 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-all active:scale-90 border border-transparent hover:border-red-100"
                title="Delete Article"
              >
                <Trash2 size={18} />
              </button>
            </div>
          )}
        </div>

        {/* METADATA SECOND */}
        <div className="flex items-center gap-4 text-xs text-gray-500 mb-6">
          <div className="flex items-center gap-2">
            {article.author?.avatar_url ? (
              <img src={article.author.avatar_url} className="w-6 h-6 rounded-full object-cover border border-gray-100" alt="" />
            ) : (
              <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center border border-gray-100">
                <User size={12} className="text-gray-400" />
              </div>
            )}
            <span className="font-bold text-gray-700">{article.author?.name || 'Anonymous'}</span>
          </div>
          <div className="flex items-center gap-1.5 text-gray-400">
            <Calendar size={14} />
            <span className="font-medium">{getRelativeTime(article.created_at)}</span>
          </div>
        </div>

        {/* MEDIA THIRD - IMAGE ONLY (Video moved to footer) */}
        {article.media_url && (
          <div className="mb-6 rounded-xl overflow-hidden bg-gray-50 border border-gray-100 shadow-sm">
            <img 
              src={article.media_url} 
              alt={article.title} 
              className="w-full max-h-[400px] object-cover hover:scale-[1.01] transition-transform duration-700" 
            />
          </div>
        )}

        {/* CONTENT FOURTH */}
        <div className="mblog-content-wrapper">
          <div 
            className="rich-text text-gray-600 leading-relaxed text-[15px]"
            dangerouslySetInnerHTML={{ 
              __html: DOMPurify.sanitize(
                isExpanded 
                  ? (article.content_html || '') 
                  : truncateHtmlWithTags(article.content_html || '', contentLimit)
              ) 
            }}
          />
          
          {shouldTruncate && (
            <button 
              onClick={() => setIsExpanded(!isExpanded)}
              className="mt-3 flex items-center gap-2 text-sm font-bold text-[#004173] hover:text-[#0e2a4d] transition-colors py-2 px-4 rounded-lg bg-blue-50 hover:bg-blue-100 w-fit"
            >
              {isExpanded ? (
                <>Show less <ChevronUp size={16} /></>
              ) : (
                <>Read full blog <ChevronDown size={16} /></>
              )}
            </button>
          )}
        </div>

        {/* INTERACTION BAR (BASKET 2 & 3) */}
        <div className="mt-8 pt-4 border-t border-gray-100 flex items-center gap-6">
          <button 
            onClick={handleLikeToggle}
            className={`flex items-center gap-2 text-sm font-bold transition-all active:scale-95 ${
              isLiked ? 'text-[#004173]' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <ThumbsUp 
              size={18} 
              fill={isLiked ? '#004173' : 'transparent'} 
              className={isLiked ? 'animate-bounce-small' : ''}
            />
            <span>{likeCount} {likeCount === 1 ? 'Like' : 'Likes'}</span>
          </button>
          
          <button 
            onClick={() => setShowComments(!showComments)}
            className={`flex items-center gap-2 text-sm font-bold transition-all active:scale-95 ${
              showComments ? 'text-[#0e2a4d]' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <MessageSquare size={18} className={showComments ? 'text-[#0e2a4d]' : ''} />
            <span>{comments.length} {comments.length === 1 ? 'Comment' : 'Comments'}</span>
          </button>
        </div>

        {/* LINEAR COMMENT SECTION */}
        {showComments && (
          <div className="mt-6 animate-in slide-in-from-top-2 duration-200">
            {/* Comment Composer */}
            <div className="flex gap-3 mb-6">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} className="w-8 h-8 rounded-full object-cover shrink-0" alt="" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                  <User size={14} className="text-gray-400" />
                </div>
              )}
              <div className="flex-1 flex gap-2">
                <input 
                  type="text"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Add a professional comment..."
                  className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#004173] focus:border-[#004173] transition-all"
                  onKeyDown={(e) => e.key === 'Enter' && handlePostComment()}
                />
                <button 
                  onClick={handlePostComment}
                  disabled={!commentText.trim()}
                  className="px-4 py-2 bg-[#0e2a4d] text-white text-xs font-bold rounded-lg hover:bg-[#004173] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Post
                </button>
              </div>
            </div>

            {/* Flat Comment List */}
            <div className="space-y-5">
              {comments.map((comment) => (
                <div key={comment.id} className="flex gap-3">
                  {comment.user.avatar_url ? (
                    <img src={comment.user.avatar_url} className="w-8 h-8 rounded-full object-cover shrink-0" alt="" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center shrink-0 border border-gray-100">
                      <User size={14} className="text-gray-400" />
                    </div>
                  )}
                  <div className="flex-1">
                    <div className="bg-gray-50 rounded-2xl px-4 py-3 border border-gray-100 relative group">
                      <div className="flex justify-between items-baseline mb-1">
                        <span className="font-bold text-xs text-[#0e2a4d]">{comment.user.name}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] text-gray-400 font-medium">{getRelativeTime(comment.created_at)}</span>
                          
                          {/* Author Actions */}
                          {comment.userId === userId && (
                            <div className="flex items-center gap-1.5 ml-2">
                              <button 
                                onClick={() => {
                                  setEditingCommentId(comment.id);
                                  setEditCommentValue(comment.text);
                                }}
                                className="text-gray-400 hover:text-blue-600 transition-colors p-0.5"
                              >
                                <Pencil size={14} />
                              </button>
                              <button 
                                type="button"
                                onClick={(e) => { 
                                  e.preventDefault(); 
                                  e.stopPropagation(); 
                                  setCommentToDelete(comment.id); 
                                }}
                                className="text-gray-400 hover:text-red-500 transition-colors p-0.5"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {editingCommentId === comment.id ? (
                        <div className="mt-2 flex gap-2">
                          <input 
                            type="text"
                            value={editCommentValue}
                            onChange={(e) => setEditCommentValue(e.target.value)}
                            className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#004173]"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleUpdateComment(comment.id);
                              if (e.key === 'Escape') setEditingCommentId(null);
                            }}
                          />
                          <button 
                            onClick={() => handleUpdateComment(comment.id)}
                            className="p-1.5 bg-[#0e2a4d] text-white rounded-lg hover:bg-[#004173] transition-colors"
                          >
                            <Check size={14} />
                          </button>
                          <button 
                            onClick={() => setEditingCommentId(null)}
                            className="p-1.5 bg-gray-200 text-gray-600 rounded-lg hover:bg-gray-300 transition-colors"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-600 leading-relaxed">{comment.text}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* FOOTER ACTIONS / BADGES */}
        <div className="flex items-center gap-3 mt-6 pt-4 border-t border-gray-50 empty:hidden">
          {article.pdf_url && (
            <a 
              href={article.pdf_url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-[10px] font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-100 hover:bg-blue-100 transition-colors"
            >
              <Paperclip size={12} />
              DOCUMENT
            </a>
          )}
          {article.youtube_id && (
            <a 
              href={`https://www.youtube.com/watch?v=${extractYouTubeId(article.youtube_id)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-[10px] font-bold text-red-600 bg-red-50 px-2.5 py-1 rounded-full border border-red-100 hover:bg-red-100 transition-colors"
            >
              <PlayCircle size={12} />
              WATCH VIDEO
            </a>
          )}
          
          {isEditable && (
            <button 
              onClick={() => setShowShareConfirm(true)}
              disabled={isSharing}
              className={`ml-auto flex items-center gap-1.5 text-[10px] font-bold py-1 px-3 rounded-full border transition-all active:scale-95 ${
                isSharing 
                  ? 'bg-gray-50 text-gray-400 border-gray-100' 
                  : 'bg-green-50 text-green-600 border-green-100 hover:bg-green-100'
              }`}
            >
              <Share2 size={12} className={isSharing ? 'animate-pulse' : ''} />
              {isSharing ? 'SHARING...' : 'SHARE TO LOGBOOK'}
            </button>
          )}
        </div>
      </div>

      {/* Confirmation Dialog Overlay */}
      {showShareConfirm && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-8 animate-in zoom-in-95 duration-200">
            <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center mb-4 mx-auto">
              <Share2 size={24} className="text-[#002b4e]" />
            </div>
            <h3 className="text-lg font-bold text-center text-[#0e2a4d] mb-2">Share to Logbook?</h3>
            <p className="text-gray-500 text-center text-sm mb-6">
              This article will be posted to your Logbook feed for your connections to see.
            </p>
            <div className="flex gap-4 px-8 mb-2">
              <button 
                onClick={() => setShowShareConfirm(false)}
                className="flex-1 py-2.5 rounded-lg border border-gray-200 text-gray-600 font-bold text-sm hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleShare}
                disabled={isSharing}
                className="flex-1 py-2.5 rounded-lg bg-[#002b4e] text-white font-bold text-sm hover:bg-[#004173] transition-colors flex items-center justify-center gap-2"
              >
                {isSharing ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Check size={16} />
                )}
                Confirm Share
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Overlay */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-8 animate-in zoom-in-95 duration-200">
            <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mb-4 mx-auto">
              <AlertTriangle size={24} className="text-red-600" />
            </div>
            <h3 className="text-lg font-bold text-center text-[#0e2a4d] mb-2">Delete Article?</h3>
            <p className="text-gray-500 text-center text-sm mb-6">
              Are you sure you want to permanently delete this article? This action cannot be undone.
            </p>
            <div className="flex gap-4 px-8 mb-2">
              <button 
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-2.5 rounded-lg border border-gray-200 text-gray-600 font-bold text-sm hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex-1 py-2.5 rounded-lg bg-red-600 text-white font-bold text-sm hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
              >
                {isDeleting ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Trash2 size={16} />
                )}
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Comment Delete Confirmation Overlay */}
      {commentToDelete && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-8 animate-in zoom-in-95 duration-200">
            <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mb-4 mx-auto">
              <Trash2 size={24} className="text-red-600" />
            </div>
            <h3 className="text-lg font-bold text-center text-[#0e2a4d] mb-2">Delete Comment?</h3>
            <p className="text-gray-500 text-center text-sm mb-6">
              Are you sure you want to permanently delete this comment?
            </p>
            <div className="flex gap-4 px-8 mb-2">
              <button 
                onClick={() => setCommentToDelete(null)}
                className="flex-1 py-2.5 rounded-lg border border-gray-200 text-gray-600 font-bold text-sm hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleDeleteComment}
                className="flex-1 py-2.5 rounded-lg bg-red-600 text-white font-bold text-sm hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
