'use client';

import { useState } from 'react';
import { 
  MessageSquare, ThumbsUp, 
  ChevronDown, ChevronUp, Send, MoreHorizontal,
  FileText, Paperclip
} from 'lucide-react';

function CommentItem({ comment }) {
  return (
    <div className="flex gap-3 py-3">
      {/* Avatar */}
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-[#002b4e] flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
        {comment.author.charAt(0)}
      </div>
      {/* Comment Bubble */}
      <div className="flex-1 min-w-0">
        <div className="bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
          <p className="text-xs font-bold text-[#002b4e]">{comment.author}</p>
          <p className="text-xs text-gray-500 mb-1">{comment.role} · {comment.timestamp}</p>
          <p className="text-sm text-gray-700 leading-relaxed">{comment.text}</p>
        </div>
        <div className="flex gap-4 mt-1.5 pl-2">
          <button className="text-[11px] font-semibold text-gray-400 hover:text-blue-600 transition-colors">Like</button>
          <button className="text-[11px] font-semibold text-gray-400 hover:text-blue-600 transition-colors">Reply</button>
        </div>
      </div>
    </div>
  );
}

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

export default function DiscussionPost({ post }) {
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(post.likes || 0);
  const [comments, setComments] = useState(post.comments || []);

  const handleLike = () => {
    setLiked(prev => !prev);
    setLikeCount(prev => liked ? prev - 1 : prev + 1);
  };

  const handleAddComment = () => {
    if (!commentText.trim()) return;
    const newComment = {
      id: Date.now(),
      author: 'You',
      role: 'Maritime Professional',
      timestamp: 'Just now',
      text: commentText.trim(),
    };
    setComments(prev => [...prev, newComment]);
    setCommentText('');
    setShowComments(true);
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
          onClick={() => setShowComments(v => !v)}
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

      {/* Comment Section — 1 level deep only */}
      {showComments && (
        <div className="bg-gray-50/70 border-t border-gray-100 px-4 pt-2 pb-3">
          {/* Existing Comments */}
          {comments.length > 0 && (
            <div className="divide-y divide-gray-100/80">
              {comments.map(comment => (
                <CommentItem key={comment.id} comment={comment} />
              ))}
            </div>
          )}

          {/* Add Comment Input */}
          <div className="flex gap-2 mt-3 items-center">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-[#002b4e] flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
              Y
            </div>
            <div className="flex-1 flex items-center gap-2 bg-white border border-gray-200 rounded-full px-4 py-2 focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
              <input
                type="text"
                placeholder="Add a comment..."
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
