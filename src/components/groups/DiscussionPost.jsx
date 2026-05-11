'use client';

import { useState, useRef, useEffect } from 'react';
import { 
  MessageSquare, ThumbsUp, 
  Send, MoreHorizontal,
  FileText, Paperclip
} from 'lucide-react';
import { createClient } from '@/lib/supabase';
import { useProfile } from '@/app/context/ProfileContext';

/* ═══ Level 2 Sub-Reply (rendered inline — hook drawn by parent) ═══ */
function SubReplyBubble({ reply, postAuthor }) {
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(reply.likes || 0);
  const isAuthor = reply.author === postAuthor;

  const toggleLike = () => {
    setLiked(prev => !prev);
    setLikeCount(prev => liked ? prev - 1 : prev + 1);
  };

  return (
    <div className="flex gap-2.5 py-2">
      {/* Level 2 avatar — 28px */}
      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-sky-400 to-[#002b4e] flex items-center justify-center text-white font-bold text-[10px] flex-shrink-0 relative z-10">
        {reply.author.charAt(0)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="bg-white rounded-lg px-3 py-2 border border-gray-100">
          <p className="text-[11px] font-bold text-[#002b4e] flex items-center gap-1.5">
            {reply.author}
            {isAuthor && (
              <span className="bg-gray-100 text-gray-600 text-[10px] px-2 py-0.5 rounded-md font-bold">Author</span>
            )}
          </p>
          <p className="text-[10px] text-gray-400">{reply.role} · {reply.timestamp}</p>
          <p className="text-xs text-gray-700 leading-relaxed mt-0.5">{reply.text}</p>
        </div>
        <div className="flex gap-3 mt-0.5 pl-1">
          <button
            onClick={toggleLike}
            className={`text-[10px] font-semibold transition-colors flex items-center gap-1 ${
              liked ? 'text-blue-600' : 'text-gray-400 hover:text-blue-600'
            }`}
          >
            <ThumbsUp size={10} className={liked ? 'fill-blue-600' : ''} />
            {likeCount > 0 ? likeCount : 'Like'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══ Level 1 Comment ═══ */
function CommentItem({ comment, onAddSubReply, postAuthor }) {
  const isAuthor = comment.author === postAuthor;
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(comment.likes || 0);
  const [showReplyInput, setShowReplyInput] = useState(false);
  const [replyText, setReplyText] = useState('');
  const replyInputRef = useRef(null);

  const toggleLike = () => {
    setLiked(prev => !prev);
    setLikeCount(prev => liked ? prev - 1 : prev + 1);
  };

  const handleReply = () => {
    if (!replyText.trim()) return;
    onAddSubReply(comment.id, replyText.trim());
    setReplyText('');
    setShowReplyInput(false);
  };

  const handleShowReply = () => {
    setShowReplyInput(true);
  };

  // Auto-focus the reply input when it becomes visible
  useEffect(() => {
    if (showReplyInput && replyInputRef.current) {
      replyInputRef.current.focus();
    }
  }, [showReplyInput]);

  const hasReplies = comment.replies && comment.replies.length > 0;

  return (
    <div className="py-2.5">
      {/* L1 Comment — flat layout, no thread line to parent */}
      <div className="flex gap-2.5">
        {/* Avatar */}
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-400 to-[#002b4e] flex items-center justify-center text-white font-bold text-[10px] flex-shrink-0">
          {comment.author.charAt(0)}
        </div>
        {/* Right column: bubble + actions + sub-replies */}
        <div className="flex-1 min-w-0">
          <div className="bg-white rounded-xl px-4 py-3 border border-gray-100">
            <p className="text-xs font-bold text-[#002b4e] flex items-center gap-1.5">
              {comment.author}
              {isAuthor && (
                <span className="bg-gray-100 text-gray-600 text-[10px] px-2 py-0.5 rounded-md font-bold">Author</span>
              )}
            </p>
            <p className="text-[11px] text-gray-400 mb-1">{comment.role} · {comment.timestamp}</p>
            <p className="text-[13px] text-gray-700 leading-relaxed">{comment.text}</p>
          </div>
          {/* Like + Reply */}
          <div className="flex gap-4 mt-1 pl-2">
            <button
              onClick={toggleLike}
              className={`text-[11px] font-semibold transition-colors flex items-center gap-1 ${
                liked ? 'text-blue-600' : 'text-gray-400 hover:text-blue-600'
              }`}
            >
              <ThumbsUp size={12} className={liked ? 'fill-blue-600' : ''} />
              {likeCount > 0 ? likeCount : 'Like'}
            </button>
            <button
              onClick={handleShowReply}
              className="text-[11px] font-semibold text-gray-400 hover:text-blue-600 transition-colors"
            >
              Reply
            </button>
          </div>

          {/* Level 2 Sub-Replies — standalone branch hooks */}
          {hasReplies && (
            <div className="mt-1 ml-2">
              {comment.replies.map(reply => (
                <div key={reply.id} className="flex items-start gap-3 py-1.5">
                  {/* Branch hook: L-shaped connector */}
                  <div
                    className="flex-shrink-0 border-l-2 border-b-2 border-slate-500 rounded-bl-xl mt-1"
                    style={{ width: '14px', height: '14px' }}
                  />
                  <SubReplyBubble reply={reply} postAuthor={postAuthor} />
                </div>
              ))}
            </div>
          )}

          {/* Inline reply input with branch hook */}
          {showReplyInput && (
            <div className="flex items-start gap-3 mt-1 ml-2 py-1.5">
              {/* Branch hook */}
              <div
                className="flex-shrink-0 border-l-2 border-b-2 border-slate-500 rounded-bl-xl mt-3"
                style={{ width: '14px', height: '14px' }}
              />
              <div className="flex gap-2.5 items-center flex-1">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-400 to-[#002b4e] flex items-center justify-center text-white font-bold text-[10px] flex-shrink-0">
                  Y
                </div>
                <div className="flex-1 flex items-center gap-2 bg-white border border-gray-200 rounded-full px-3 py-1.5 focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
                  <input
                    ref={replyInputRef}
                    type="text"
                    placeholder={`Reply to ${comment.author.split(' ').pop()}...`}
                    value={replyText}
                    onChange={e => setReplyText(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleReply()}
                    className="flex-1 text-xs outline-none bg-transparent text-gray-700 placeholder-gray-400"
                  />
                  <button
                    onClick={handleReply}
                    disabled={!replyText.trim()}
                    className="text-blue-500 disabled:text-gray-300 hover:text-blue-700 transition-colors"
                  >
                    <Send size={13} />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══ Media Renderer ═══ */
function MediaRenderer({ media }) {
  if (!media) return null;

  if (media.type === 'image') {
    return (
      <div className="mt-3 rounded-xl overflow-hidden border border-gray-100">
        <img src={media.url} alt={media.alt || 'Discussion image'} className="w-full object-cover max-h-80" />
      </div>
    );
  }

  if (media.type === 'youtube') {
    const videoId = media.url.split('v=')[1]?.split('&')[0] || media.url.split('/').pop();
    return (
      <div className="mt-3 rounded-xl overflow-hidden border border-gray-100 bg-black aspect-video">
        <iframe
          width="100%"
          height="100%"
          src={`https://www.youtube.com/embed/${videoId}`}
          title="Video"
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="w-full h-full"
        />
      </div>
    );
  }

  if (media.type === 'pdf') {
    return (
      <div className="mt-3 flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl cursor-pointer hover:bg-amber-100 transition-colors group">
        <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center group-hover:bg-amber-200 transition-colors flex-shrink-0">
          <FileText size={20} className="text-amber-700" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-amber-800 truncate">{media.filename || 'Document.pdf'}</p>
          <p className="text-xs text-amber-600">{media.size || 'PDF Document'} · Click to download</p>
        </div>
        <Paperclip size={16} className="text-amber-500 ml-auto flex-shrink-0" />
      </div>
    );
  }

  return null;
}

/* ═══ Main Post Component ═══ */
export default function DiscussionPost({ post, groupId }) {
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(post.likes || 0);
  const [comments, setComments] = useState([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const mainInputRef = useRef(null);
  const { userId, profile } = useProfile();
  const supabase = createClient();

  useEffect(() => {
    if (showComments && groupId) {
      fetchComments();
    }
  }, [showComments, groupId]);

  const fetchComments = async () => {
    setLoadingComments(true);
    try {
      const { data, error } = await supabase
        .from('group_comments')
        .select('*')
        .eq('post_id', post.id)
        .order('created_at', { ascending: true });

      if (error) throw error;
      
      // Map to expected UI format
      const formattedComments = (data || []).map(c => ({
        id: c.id,
        author: c.author_name || 'Anonymous',
        role: c.author_role || 'Member',
        text: c.content,
        timestamp: new Date(c.created_at).toLocaleDateString(),
        replies: [] // Sub-replies logic can be added later if needed
      }));
      
      setComments(formattedComments);
    } catch (err) {
      console.error('Error fetching group comments:', err);
    } finally {
      setLoadingComments(false);
    }
  };

  const handleLike = () => {
    setLiked(prev => !prev);
    setLikeCount(prev => liked ? prev - 1 : prev + 1);
  };

  // Count all comments + sub-replies for the action bar
  const totalCommentCount = comments.reduce(
    (acc, c) => acc + 1 + (c.replies?.length || 0), 0
  );

  const handleToggleComments = () => {
    const nextState = !showComments;
    setShowComments(nextState);
    if (nextState) {
      // Focus the main input after the section renders
      setTimeout(() => mainInputRef.current?.focus(), 50);
    }
  };

  const handleAddComment = async () => {
    if (!commentText.trim() || !userId) return;

    const newComment = {
      post_id: post.id,
      user_id: userId,
      content: commentText.trim(),
      author_name: profile?.fullName || 'Anonymous',
      author_role: profile?.currentRole || 'Member'
    };

    try {
      const { data, error } = await supabase
        .from('group_comments')
        .insert(newComment)
        .select('*')
        .single();

      if (error) throw error;

      const formatted = {
        id: data.id,
        author: data.author_name,
        role: data.author_role,
        text: data.content,
        timestamp: 'Just now',
        replies: []
      };

      setComments(prev => [...prev, formatted]);
      setCommentText('');
    } catch (err) {
      console.error('Error adding comment:', err);
      alert('Failed to post comment.');
    }
  };

  const handleAddSubReply = (parentCommentId, text) => {
    const newReply = {
      id: Date.now(),
      author: 'You',
      role: 'Maritime Professional',
      timestamp: 'Just now',
      text,
    };
    setComments(prev =>
      prev.map(c =>
        c.id === parentCommentId
          ? { ...c, replies: [...(c.replies || []), newReply] }
          : c
      )
    );
  };

  return (
    <article className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-md transition-shadow">
      {/* Post Header */}
      <div className="flex items-start gap-3 p-4 pb-0">
        <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#0a4b8a] to-[#002b4e] flex items-center justify-center text-white font-bold text-base flex-shrink-0">
          {post.author.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm text-[#002b4e] truncate">{post.author}</p>
          <p className="text-xs text-gray-500 truncate">{post.role} · {post.timestamp}</p>
        </div>
        <button className="p-1.5 rounded-full hover:bg-gray-100 transition-colors text-gray-400">
          <MoreHorizontal size={18} />
        </button>
      </div>

      {/* Post Body */}
      <div className="px-4 pt-3 pb-2">
        <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-line">{post.content}</p>
        <MediaRenderer media={post.media} />
      </div>

      {/* Action Bar — Logbook Style */}
      <div className="flex items-center justify-around w-full py-3 border-t border-gray-100">
        <button
          onClick={handleLike}
          className={`flex items-center gap-2 px-4 py-1 rounded-lg text-sm font-semibold transition-all ${
            liked 
              ? 'text-blue-600 hover:bg-blue-50' 
              : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
          }`}
        >
          <ThumbsUp size={18} className={liked ? 'fill-blue-600' : ''} />
          <span>Like</span>
          <span className={`text-sm ${liked ? 'text-blue-500' : 'text-gray-400'}`}>{likeCount}</span>
        </button>
        <button
          onClick={handleToggleComments}
          className={`flex items-center gap-2 px-4 py-1 rounded-lg text-sm font-semibold transition-all ${
            showComments
              ? 'text-[#002b4e] hover:bg-gray-100'
              : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
          }`}
        >
          <MessageSquare size={18} />
          <span>{totalCommentCount} {totalCommentCount === 1 ? 'comment' : 'comments'}</span>
        </button>
      </div>

      {/* Comment Section — 2 levels deep max */}
      {showComments && (
        <div className="bg-gray-50/70 border-t border-gray-100 px-4 pt-3 pb-6">
          {/* Level 1 Comments — flat layout, no vertical line (LinkedIn style) */}
          {comments.length > 0 && (
            <div className="divide-y divide-gray-100/60">
              {comments.map(comment => (
                <CommentItem
                  key={comment.id}
                  comment={comment}
                  onAddSubReply={handleAddSubReply}
                  postAuthor={post.author}
                />
              ))}
            </div>
          )}

          {/* Main reply input — always at the bottom */}
          <div className="flex gap-2 mt-3 items-center">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-[#002b4e] flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
              Y
            </div>
            <div className="flex-1 flex items-center gap-2 bg-white border border-gray-200 rounded-full px-4 py-2 focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
              <input
                ref={mainInputRef}
                type="text"
                placeholder="Write a reply..."
                value={commentText}
                onChange={e => setCommentText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddComment()}
                className="flex-1 text-sm outline-none bg-transparent text-gray-700 placeholder-gray-400"
              />
              <button
                onClick={handleAddComment}
                disabled={!commentText.trim()}
                className="text-blue-500 disabled:text-gray-300 hover:text-blue-700 transition-colors"
              >
                <Send size={15} />
              </button>
            </div>
          </div>
        </div>
      )}
    </article>
  );
}
