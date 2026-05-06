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
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return doc.documentElement.textContent || html;
  };

  const contentLimit = 300;
  
  const truncateHtml = (html, limit) => {
    if (!html) return '';
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    const text = tempDiv.textContent || tempDiv.innerText || '';
    
    if (text.length <= limit) return html;
    
    // Improved truncation: truncate text and close any open tags
    let count = 0;
    let result = '';
    let inTag = false;
    let tagBuffer = '';
    const openTags = [];
    
    for (let i = 0; i < html.length; i++) {
      const char = html[i];
      if (char === '<') {
        inTag = true;
        tagBuffer = '<';
      } else if (char === '>') {
        inTag = false;
        tagBuffer += '>';
        result += tagBuffer;
        
        // Track open tags
        if (tagBuffer.startsWith('</')) {
          openTags.pop();
        } else if (!tagBuffer.includes('/>') && !['<br>', '<hr>', '<img>'].includes(tagBuffer.toLowerCase())) {
          const tagName = tagBuffer.match(/<([a-z0-9]+)/i)?.[1];
          if (tagName) openTags.push(tagName);
        }
        tagBuffer = '';
        continue;
      }
      
      if (inTag) {
        tagBuffer += char;
      } else {
        if (count < limit) {
          result += char;
          count++;
        } else {
          // Add ellipsis and close all open tags
          result += '...';
          while (openTags.length > 0) {
            const tag = openTags.pop();
            result += `</${tag}>`;
          }
          break;
        }
      }
    }
    
    return result;
  };

  const rawContent = post.content || '';
  // Check if content looks like escaped HTML (contains &lt;)
  const needsUnescape = rawContent.includes('&lt;') || rawContent.includes('&gt;');
  const processedContent = needsUnescape ? unescapeHtml(rawContent) : rawContent;

  const shouldTruncate = processedContent.length > contentLimit;
  const displayedContent = (!isExpanded && shouldTruncate) 
    ? truncateHtml(processedContent, contentLimit) 
    : processedContent;

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
