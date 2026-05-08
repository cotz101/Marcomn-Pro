'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { ThumbsUp, MessageSquare, Share2 } from 'lucide-react';
import PostActions from './PostActions';
import DOMPurify from 'dompurify';
import CommentSection from './CommentSection';
import ReactionsModal from './ReactionsModal';
import { createClient } from '@/lib/supabase';

export default function PostCard({ post, userId, profile, onEdit, onDeleteSuccess }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLiked, setIsLiked] = useState(post.user_has_liked || false);
  const [showComments, setShowComments] = useState(false);
  const [commentCount, setCommentCount] = useState(post.comment_count || 0);
  const [likeCount, setLikeCount] = useState(post.like_count || 0);
  const [showReactions, setShowReactions] = useState(false);
  const supabase = createClient();
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
    if (typeof window === 'undefined') return html || '';
    if (!html) return '';
    const txt = document.createElement('textarea');
    txt.innerHTML = html;
    return txt.value;
  };

  const toggleLike = async () => {
    if (!userId) return;

    // Optimistic UI
    const newLikedState = !isLiked;
    setIsLiked(newLikedState);
    setLikeCount(prev => newLikedState ? prev + 1 : prev - 1);

    try {
      if (newLikedState) {
        // Add like
        const { error } = await supabase
          .from('likes')
          .insert({ post_id: post.id, user_id: userId });
        if (error) throw error;
      } else {
        // Remove like
        const { error } = await supabase
          .from('likes')
          .delete()
          .eq('post_id', post.id)
          .eq('user_id', userId);
        if (error) throw error;
      }
    } catch (err) {
      console.error('Error toggling like:', err);
      // Revert optimistic UI on error
      setIsLiked(!newLikedState);
      setLikeCount(prev => !newLikedState ? prev + 1 : prev - 1);
    }
  };

  const truncateHtmlWithTags = (html, limit) => {
    if (!html) return '';
    if (typeof window === 'undefined') return html; // SSR Fallback
    
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

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const contentLimit = 180;
  
  const processedContent = useMemo(() => {
    const rawContent = post.content || '';
    const isEscaped = rawContent.includes('&lt;') || rawContent.includes('&gt;');
    const unescaped = isEscaped && mounted ? unescapeHtml(rawContent) : rawContent;
    
    if (!mounted) return unescaped;
    
    return isExpanded ? unescaped : truncateHtmlWithTags(unescaped, contentLimit);
  }, [post.content, mounted, isExpanded]);

  const shouldTruncate = (post.content || '').length > 200;

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
            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(processedContent || '') }} 
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
        <div className="action-group" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <button 
            className={`action-btn ${isLiked ? 'active' : ''}`}
            onClick={toggleLike}
            style={{ color: isLiked ? '#002b4e' : 'inherit', flex: likeCount > 0 ? 'none' : 1 }}
          >
            <ThumbsUp size={18} fill={isLiked ? '#002b4e' : 'none'} /> 
            <span className="font-medium">Like</span>
          </button>
          {likeCount > 0 && (
            <button 
              className="like-count-btn"
              onClick={(e) => {
                e.stopPropagation();
                setShowReactions(true);
              }}
            >
              {likeCount}
            </button>
          )}
        </div>
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

      <ReactionsModal 
        isOpen={showReactions}
        onClose={() => setShowReactions(false)}
        postId={post.id}
        currentUserId={userId}
      />
    </div>
  );
}
