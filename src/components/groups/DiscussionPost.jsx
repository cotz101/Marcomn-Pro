'use client';

import { useState, useRef, useEffect } from 'react';
import { 
  MessageSquare, ThumbsUp, 
  Send, MoreHorizontal,
  FileText, Paperclip
} from 'lucide-react';
import { createClient } from '@/lib/supabase';
import { useProfile } from '@/app/context/ProfileContext';
import DOMPurify from 'dompurify';

/* ═══ Comment Component (Handles both Top-level and Replies) ═══ */
function CommentItem({ comment, isReply, onAddComment, postAuthor, onReplyAction }) {
  const isAuthor = comment.author === postAuthor;
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(comment.likes || 0);
  const avatarSize = isReply ? "w-8 h-8" : "w-10 h-10";
  const textSize = isReply ? "text-[13px]" : "text-[14px]";

  const toggleLike = () => {
    setLiked(prev => !prev);
    setLikeCount(prev => liked ? prev - 1 : prev + 1);
  };

  const handleReplyClick = () => {
    // If this is a reply, we reply to the original parent to keep it 2-layer
    const targetId = isReply ? comment.parent_id : comment.id;
    onReplyAction(targetId, comment.author);
  };

  return (
    <div className={`py-3 ${isReply ? 'mt-2' : 'mt-4'}`}>
      <div className="flex gap-3">
        {/* Avatar */}
        <div className={`${avatarSize} rounded-full bg-gradient-to-br from-blue-400 to-[#002b4e] flex items-center justify-center text-white font-bold ${isReply ? 'text-[10px]' : 'text-sm'} flex-shrink-0 shadow-sm`}>
          {comment.author.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <div className={`bg-white rounded-xl px-4 py-3 border border-gray-100 shadow-sm ${isReply ? 'bg-gray-50/30' : ''}`}>
            <p className="text-xs font-bold text-[#002b4e] flex items-center gap-1.5">
              {comment.author}
              {isAuthor && (
                <span className="bg-gray-100 text-gray-600 text-[10px] px-2 py-0.5 rounded-md font-bold uppercase tracking-wider">Author</span>
              )}
            </p>
            <p className="text-[11px] text-gray-400 mb-1">{comment.role} · {comment.timestamp}</p>
            <p className={`${textSize} text-gray-700 leading-relaxed`}>{comment.text}</p>
          </div>
          {/* Actions */}
          <div className="flex gap-4 mt-1.5 pl-2">
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
              onClick={handleReplyClick}
              className="text-[11px] font-semibold text-gray-400 hover:text-blue-600 transition-colors"
            >
              Reply
            </button>
          </div>
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
  const [activeParentId, setActiveParentId] = useState(null);
  const mainInputRef = useRef(null);
  const { userId, profile } = useProfile();
  const supabase = createClient();

  useEffect(() => {
    if (showComments && groupId) {
      const fetchComments = async () => {
        setLoadingComments(true);
        try {
          const { data, error } = await supabase
            .from('group_comments')
            .select('*')
            .eq('post_id', post.id)
            .order('created_at', { ascending: true });

          if (error) throw error;
          
          const formattedComments = (data || []).map(c => ({
            id: c.id,
            parent_id: c.parent_id,
            author: c.author_name || 'Anonymous',
            role: c.author_role || 'Member',
            text: c.content,
            timestamp: new Date(c.created_at).toLocaleDateString()
          }));
          
          setComments(formattedComments);
        } catch (err) {
          console.error('Error fetching group comments:', err);
        } finally {
          setLoadingComments(false);
        }
      };
      fetchComments();
    }
  }, [showComments, groupId, post.id, supabase]);

  const handleLike = () => {
    setLiked(prev => !prev);
    setLikeCount(prev => liked ? prev - 1 : prev + 1);
  };

  const handleToggleComments = () => {
    const nextState = !showComments;
    setShowComments(nextState);
    if (nextState) {
      setTimeout(() => mainInputRef.current?.focus(), 50);
    }
  };

  const handleAddComment = async (text, parentId = null) => {
    const content = text || commentText;
    const finalParentId = parentId || activeParentId;
    if (!content.trim() || !userId) return;

    const newComment = {
      post_id: post.id,
      user_id: userId,
      parent_id: finalParentId,
      content: content.trim(),
      author_name: profile?.fullName || 'Anonymous',
      author_role: profile?.currentRole || 'Member'
    };

    try {
      const { data, error } = await supabase
        .from('group_comments')
        .insert(newComment)
        .select('*')
        .maybeSingle();

      if (error) throw error;

      const formatted = {
        id: data.id,
        parent_id: data.parent_id,
        author: data.author_name,
        role: data.author_role,
        text: data.content,
        timestamp: 'Just now'
      };

      setComments(prev => [...prev, formatted]);
      setCommentText('');
      setActiveParentId(null);
    } catch (err) {
      console.error('Error adding comment:', err);
      alert('Failed to post comment.');
    }
  };

  const handleReplyAction = (parentId, authorName) => {
    setActiveParentId(parentId);
    setCommentText(`@${authorName.split(' ').pop()} `);
    setTimeout(() => mainInputRef.current?.focus(), 50);
  };

  // ═══ Diagnostic Trap & Layer Logic ═══
  const topLevelComments = comments?.filter(c => !c.parent_id) || [];
  const getReplies = (parentId) => comments?.filter(c => c.parent_id === parentId) || [];

  console.log("Discussion Thread Status -> Top Level:", topLevelComments.length, "Total Comments:", comments?.length);

  return (
    <article className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-md transition-shadow">
      {/* Post Header */}
      <div className="flex items-start gap-3 p-4 pb-0">
        <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#0a4b8a] to-[#002b4e] flex items-center justify-center text-white font-bold text-base flex-shrink-0 shadow-sm">
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
        <div 
          className="text-sm text-gray-800 leading-relaxed rich-text"
          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(post.content || '') }}
        />
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
          <span>{comments.length} {comments.length === 1 ? 'comment' : 'comments'}</span>
        </button>
      </div>

      {/* Comment Section — Strict 2-layer Mapping Loop */}
      {showComments && (
        <div className="bg-gray-50/70 border-t border-gray-100 px-4 pt-3 pb-6">
          <div className="space-y-6">
            {topLevelComments.map((comment) => (
              <div key={comment.id} className="relative">
                {/* Main Top-Level Comment */}
                <CommentItem 
                  comment={comment} 
                  postAuthor={post.author} 
                  onReplyAction={handleReplyAction}
                  onAddComment={handleAddComment}
                /> 

                {/* Nested Replies Loop */}
                {getReplies(comment.id).length > 0 && (
                  <div className="ml-8 md:ml-12 mt-1 space-y-2 border-l-2 border-gray-200 pl-4 relative">
                    {getReplies(comment.id).map((reply) => (
                      <CommentItem 
                        key={reply.id} 
                        comment={reply} 
                        isReply={true} 
                        postAuthor={post.author}
                        onReplyAction={handleReplyAction}
                        onAddComment={handleAddComment}
                      />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Main reply input — always at the bottom */}
          <div className="flex gap-2 mt-4 items-center">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-[#002b4e] flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
              {profile?.fullName?.charAt(0) || 'Y'}
            </div>
            <div className="flex-1 flex items-center gap-2 bg-white border border-gray-200 rounded-full px-4 py-2 focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 transition-all shadow-sm">
              <input
                ref={mainInputRef}
                type="text"
                placeholder={activeParentId ? "Replying..." : "Write a comment..."}
                value={commentText}
                onChange={e => setCommentText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddComment()}
                className="flex-1 text-sm outline-none bg-transparent text-gray-700 placeholder-gray-400"
              />
              <button
                onClick={() => handleAddComment()}
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
