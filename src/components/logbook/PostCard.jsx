'use client';

import { useState, useRef } from 'react';
import { Heart, MessageSquare, Share2 } from 'lucide-react';
import PostActions from './PostActions';
import DOMPurify from 'dompurify';
import CommentSection from './CommentSection';

export default function PostCard({ post, userId, profile, onEdit, onDeleteSuccess }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [commentCount, setCommentCount] = useState(post.comment_count || 0);
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

  const truncateHtmlWithTags = (html, limit) => {
    if (!html) return '';
    
    // Create a temporary div to parse HTML
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    
    // Helper to find the first two sentences or hit a character limit
    const getSmartBreakpoint = (text, charLimit) => {
      // Find sentences (period/exclamation/question mark followed by space or end)
      const sentenceRegex = /[^.!?]+[.!?](\s|$)/g;
      let match;
      let count = 0;
      let lastIndex = 0;
      
      while ((match = sentenceRegex.exec(text)) !== null) {
        count++;
        lastIndex = sentenceRegex.lastIndex;
        if (count === 2) break;
      }
      
      // If we found 2 sentences and they are within a reasonable range (not too long)
      if (count >= 2 && lastIndex <= charLimit * 1.5) {
        return lastIndex;
      }
      
      // Fallback: find nearest word break around charLimit
      const beforeLimit = text.lastIndexOf(' ', charLimit);
      return beforeLimit > 0 ? beforeLimit : charLimit;
    };

    const plainText = tempDiv.textContent || tempDiv.innerText || '';
    const smartLimit = getSmartBreakpoint(plainText, limit);

    if (plainText.length <= smartLimit) return html;

    let currentLength = 0;
    let resultHtml = '';
    let isTruncated = false;

    const traverse = (node) => {
      if (isTruncated) return;

      if (node.nodeType === Node.TEXT_NODE) {
        const remaining = smartLimit - currentLength;
        if (node.textContent.length > remaining) {
          resultHtml += node.textContent.substring(0, remaining).trim();
          currentLength = smartLimit;
          isTruncated = true;
        } else {
          resultHtml += node.textContent;
          currentLength += node.textContent.length;
        }
      } else if (node.nodeType === Node.ELEMENT_NODE) {
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

  const contentLimit = 180; // Targeting roughly 150-200 chars for first two sentences
  
  const rawContent = post.content || '';
  // Only unescape if we see escaped tags like &lt; or &gt;
  const isEscaped = rawContent.includes('&lt;') || rawContent.includes('&gt;');
  const contentToProcess = isEscaped ? unescapeHtml(rawContent) : rawContent;

  // Determine displayed content based on expansion state
  const displayedContent = isExpanded ? contentToProcess : truncateHtmlWithTags(contentToProcess, contentLimit);
  
  const tempTextDiv = document.createElement('div');
  tempTextDiv.innerHTML = contentToProcess;
  const plainText = tempTextDiv.textContent || '';
  
  // Rule check: only truncate if we actually have more sentences/text than the smartLimit
  const shouldTruncate = plainText.length > 200; // General threshold for "See more"

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
            <div className={`post-media-container ${isExpanded ? 'expanded' : ''}`}>
              <iframe 
                width="100%" 
                src={getYoutubeEmbedUrl(post.youtubeLink)} 
                title="YouTube video" 
                frameBorder="0" 
                allowFullScreen>
              </iframe>
            </div>
          ) : post.media && (
            <div className={`post-media-container ${isExpanded ? 'expanded' : ''}`}>
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
        <div className={`post-media-container ${isExpanded ? 'expanded' : ''}`}>
          {post.mediaType === 'video' ? (
            <video src={post.media} controls />
          ) : (
            <img src={post.media} alt="Attached Media" />
          )}
        </div>
      )}

      <div className="post-actions">
        <button 
          className={`action-btn ${isLiked ? 'active' : ''}`}
          onClick={() => setIsLiked(!isLiked)}
          style={{ color: isLiked ? '#002b4e' : 'inherit' }}
        >
          <Heart size={18} fill={isLiked ? '#002b4e' : 'none'} /> 
          <span>Like</span>
        </button>
        <button 
          className={`action-btn ${showComments ? 'active' : ''}`}
          onClick={() => setShowComments(!showComments)}
          style={{ color: showComments ? '#002b4e' : 'inherit' }}
        >
          <div className="flex items-center gap-1.5">
            <MessageSquare size={18} fill={showComments ? '#002b4e' : 'none'} /> 
            <span className="font-medium">
              {commentCount} {commentCount === 1 ? 'comment' : 'comments'}
            </span>
          </div>
        </button>
      </div>

      {showComments && (
        <CommentSection 
          postId={post.id} 
          userId={userId} 
          profile={profile} 
          onCommentAdded={() => setCommentCount(prev => prev + 1)}
          onCommentDeleted={() => setCommentCount(prev => prev - 1)}
        />
      )}
    </div>
  );
}
