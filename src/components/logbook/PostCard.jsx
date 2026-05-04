'use client';

import { useState, useRef } from 'react';
import { ThumbsUp, MessageSquare, Share2 } from 'lucide-react';
import PostActions from './PostActions';

export default function PostCard({ post, userId, onEdit, onDeleteSuccess }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const cardRef = useRef(null);
  const isAuthor = post.authorId === userId;

  const getYoutubeEmbedUrl = (url) => {
    if (!url) return null;
    const videoIdMatch = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&]{11})/);
    return videoIdMatch ? `https://www.youtube.com/embed/${videoIdMatch[1]}` : null;
  };

  const contentLimit = 300;
  
  const truncateHtml = (html, limit) => {
    if (!html) return '';
    if (html.length <= limit) return html;
    let truncated = html.substring(0, limit);
    const lastOpenTag = truncated.lastIndexOf('<');
    const lastCloseTag = truncated.lastIndexOf('>');
    if (lastOpenTag > lastCloseTag) {
      truncated = truncated.substring(0, lastOpenTag);
    }
    return truncated;
  };

  const shouldTruncate = post.content?.length > contentLimit;
  const rawContent = post.content || '';
  const displayedContent = (!isExpanded && shouldTruncate) 
    ? truncateHtml(rawContent, contentLimit) 
    : rawContent;

  return (
    <div className="card post-card" ref={cardRef} style={{ position: 'relative', marginBottom: '16px', padding: '16px', background: 'var(--card-bg)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
      {/* Absolute top-right menu */}
      <div style={{ position: 'absolute', top: '16px', right: '16px', zIndex: 10 }}>
        {isAuthor && (
          <PostActions 
            postId={post.id} 
            onEdit={() => onEdit && onEdit(post)} 
            onDeleteSuccess={onDeleteSuccess} 
          />
        )}
      </div>

      <div className="post-header" style={{ display: 'flex', gap: '12px', marginBottom: '12px', paddingRight: '40px' }}>
        <img 
          src={post.avatar} 
          alt={post.author} 
          className="post-avatar" 
          style={{ width: '48px', height: '48px', borderRadius: post.isCompany ? '8px' : '50%', objectFit: 'cover' }}
        />
        <div style={{ flex: 1 }}>
          <div className="post-author" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{post.author}</div>
          <div className="post-headline" style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{post.headline}</div>
          <div className="post-time" style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            {post.time}
          </div>
        </div>
      </div>

      {/* ARTICLE TITLE ABOVE CONTENT */}
      {post.type === 'article' && post.title && (
        <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '12px', color: 'var(--text-primary)' }}>
          {post.title}
        </h2>
      )}

      {/* TEXT CONTENT ALWAYS ABOVE MEDIA */}
      <div className="post-content-wrapper" style={{ position: 'relative', marginBottom: '16px' }}>
        {post.type === 'article' ? (
          <div className="post-content ql-editor" style={{ padding: 0 }}>
            <div 
              dangerouslySetInnerHTML={{ __html: displayedContent }} 
              style={{ color: 'var(--text-primary)', fontSize: '14px', lineHeight: '1.5' }}
            />
            {shouldTruncate && (
              <button 
                className="see-more-btn" 
                onClick={() => {
                  if (isExpanded) {
                    cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }
                  setIsExpanded(!isExpanded);
                }}
                style={{ color: '#0073b1', fontWeight: 600, fontSize: '14px', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginTop: '8px', display: 'block' }}
              >
                {isExpanded ? 'show less' : '... see more'}
              </button>
            )}
          </div>
        ) : (
          <div className="post-content" style={{ whiteSpace: 'pre-wrap', color: 'var(--text-primary)', fontSize: '14px', lineHeight: '1.5' }}>
            {displayedContent}
            {shouldTruncate && (
              <button 
                className="see-more-btn" 
                onClick={() => {
                  if (isExpanded) {
                    cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }
                  setIsExpanded(!isExpanded);
                }}
                style={{ color: '#0073b1', fontWeight: 600, fontSize: '14px', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginLeft: isExpanded ? '8px' : '4px', display: 'inline' }}
              >
                {isExpanded ? 'show less' : '... see more'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* MEDIA CONTAINER */}
      {post.type === 'article' && (
        <div style={{ marginBottom: '16px' }}>
          {post.youtubeLink && getYoutubeEmbedUrl(post.youtubeLink) ? (
            <div className="post-media-container" style={{ aspectRatio: '16/9', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000', marginBottom: '16px', borderRadius: '8px' }}>
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
            <div className="post-media-container" style={{ aspectRatio: '16/9', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000', marginBottom: '16px', borderRadius: '8px' }}>
              {post.mediaType === 'video' ? (
                <video src={post.media} controls style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              ) : (
                <img src={post.media} alt="Cover" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              )}
            </div>
          )}
        </div>
      )}

      {(post.type === 'standard' && post.media) && (
        <div className="post-media-container" style={{ aspectRatio: '16/9', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000', marginBottom: '16px', borderRadius: '8px' }}>
          {post.mediaType === 'video' ? (
            <video src={post.media} controls style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          ) : (
            <img src={post.media} alt="Attached Media" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          )}
        </div>
      )}

      <div className="post-actions" style={{ marginTop: '12px', paddingTop: '8px', borderTop: '1px solid var(--border-color)', display: 'flex', gap: '8px' }}>
        <button className="action-btn" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '8px', background: 'none', border: 'none', color: 'var(--text-secondary)', fontWeight: 600, cursor: 'pointer', borderRadius: '4px' }}>
          <ThumbsUp size={18} /> Like
        </button>
        <button className="action-btn" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '8px', background: 'none', border: 'none', color: 'var(--text-secondary)', fontWeight: 600, cursor: 'pointer', borderRadius: '4px' }}>
          <MessageSquare size={18} /> Comment
        </button>
        <button className="action-btn" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '8px', background: 'none', border: 'none', color: 'var(--text-secondary)', fontWeight: 600, cursor: 'pointer', borderRadius: '4px' }}>
          <Share2 size={18} /> Share
        </button>
      </div>
    </div>
  );
}
