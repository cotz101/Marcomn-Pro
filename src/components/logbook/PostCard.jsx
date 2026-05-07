'use client';

import { useState, useRef } from 'react';
import { ThumbsUp, MessageSquare, Share2, MoreHorizontal } from 'lucide-react';
import PostActions from './PostActions';
import DOMPurify from 'dompurify';

export default function PostCard({ post, userId, onEdit, onDeleteSuccess }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const cardRef = useRef(null);
  const isAuthor = post.user_id === userId || post.userId === userId || post.authorId === userId;
  
  // Debug log for author check (invisible to user)
  // console.log('Post:', post.id, 'AuthorId:', post.authorId, 'CurrentUserId:', userId, 'IsAuthor:', isAuthor);

  const getYoutubeEmbedUrl = (url) => {
    if (!url) return null;
    const videoIdMatch = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&]{11})/);
    return videoIdMatch ? `https://www.youtube.com/embed/${videoIdMatch[1]}` : null;
  };

  const unescapeHtml = (html) => {
    if (!html) return '';
    const txt = document.createElement('textarea');
    txt.innerHTML = html;
    return txt.value;
  };

  const contentLimit = 300;
  
  const truncateHtml = (html, limit) => {
    if (!html) return '';
    
    // Create a temporary div to extract plain text
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    const plainText = tempDiv.textContent || tempDiv.innerText || '';
    
    if (plainText.length <= limit) return html;
    
    // For the truncated preview, we return clean text with an ellipsis
    // This guarantees no "Ghost Brackets" or broken tags
    return plainText.substring(0, limit).trim() + '...';
  };

  const rawContent = post.content || '';
  // Only unescape if we see escaped tags like &lt; or &gt;
  const isEscaped = rawContent.includes('&lt;') || rawContent.includes('&gt;');
  const contentToProcess = isEscaped ? unescapeHtml(rawContent) : rawContent;

  // Determine displayed content based on expansion state
  const displayedContent = isExpanded ? contentToProcess : truncateHtml(contentToProcess, contentLimit);
  const shouldTruncate = contentToProcess.length > contentLimit;

  return (
    <div className="card post-card" ref={cardRef}>
      {/* Absolute top-right menu */}
      <div style={{ position: 'absolute', top: '16px', right: '16px', zIndex: 10 }}>
        <PostActions 
          postId={post.id} 
          isAuthor={isAuthor}
          onEdit={() => onEdit && onEdit(post)} 
          onDeleteSuccess={onDeleteSuccess} 
        />
      </div>

      <div className="post-header" style={{ paddingRight: '40px' }}>
        <img 
          src={post.avatar} 
          alt={post.author} 
          className="post-avatar" 
          style={{ borderRadius: post.isCompany ? '8px' : '50%' }}
        />
        <div className="post-author-group">
          <div className="post-author" style={{ fontWeight: 600, color: '#1b1c1c' }}>{post.author}</div>
          <div className="post-headline">{post.headline}</div>
          <div className="post-time">{post.time}</div>
        </div>
      </div>

      {/* ARTICLE TITLE ABOVE CONTENT */}
      {post.type === 'article' && post.title && (
        <h2 className="post-title" style={{ fontWeight: 600 }}>
          {post.title}
        </h2>
      )}

      {/* TEXT CONTENT ALWAYS ABOVE MEDIA */}
      <div className="post-content-wrapper">
        <div className="post-content">
          <div 
            className="rich-text"
            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(displayedContent || '') }} 
          />
          {shouldTruncate && (
            <button 
              className="see-more-btn" 
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (isExpanded) {
                  // If closing, scroll back to the top of the card
                  cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
                setIsExpanded(!isExpanded);
              }}
            >
              {isExpanded ? 'show less' : 'see more'}
            </button>
          )}
        </div>
      </div>

      {/* MEDIA CONTAINER */}
      {post.type === 'article' && (
        <div style={{ marginBottom: '16px' }}>
          {post.youtubeLink && getYoutubeEmbedUrl(post.youtubeLink) ? (
            <div className="post-media-container">
              <iframe 
                width="100%" 
                height="100%" 
                src={getYoutubeEmbedUrl(post.youtubeLink)} 
                title="YouTube video" 
                frameBorder="0" 
                allowFullScreen>
              </iframe>
            </div>
          ) : post.media && (
            <div className="post-media-container">
              {post.mediaType === 'video' ? (
                <video src={post.media} controls />
              ) : (
                <img src={post.media} alt="Cover" />
              )}
            </div>
          )}
        </div>
      )}

      {(post.type === 'standard' && post.media) && (
        <div className="post-media-container">
          {post.mediaType === 'video' ? (
            <video src={post.media} controls />
          ) : (
            <img src={post.media} alt="Attached Media" />
          )}
        </div>
      )}

      <div className="post-actions">
        <button className="action-btn">
          <ThumbsUp size={18} /> Like
        </button>
        <button className="action-btn">
          <MessageSquare size={18} /> Comment
        </button>
        <button className="action-btn">
          <Share2 size={18} /> Share
        </button>
      </div>
    </div>
  );
}
