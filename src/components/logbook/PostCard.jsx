'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ThumbsUp, MessageSquare, Share2, Briefcase, MapPin, Building2 } from 'lucide-react';
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
  const [sharedJobId, setSharedJobId] = useState(null);
  const [sharedJob, setSharedJob] = useState(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const jobShareMatch = (post.content || '').match(/\[link\]\(route:\/mservices(?:\?jobId=|\/opportunity\/)([^)]+)\)/);
    if (jobShareMatch) {
      const jobId = jobShareMatch[1];
      setSharedJobId(jobId);

      // Pre-populate shared job details directly from public post content data payload
      let parsedTitle = 'Opportunity';
      let parsedCompanyName = 'Private Poster';
      const alertMatch = (post.content || '').match(/⚓ New Opportunity Alert:\s*(.*?)\s+at\s+(.*?)(?:!| We are looking|$)/);
      if (alertMatch) {
        parsedTitle = alertMatch[1]?.trim();
        parsedCompanyName = alertMatch[2]?.trim();
      }

      setSharedJob({
        id: jobId,
        title: parsedTitle,
        companyName: parsedCompanyName,
        location: 'Remote'
      });
    }
  }, [post.content]);

  useEffect(() => {
    if (sharedJobId) {
      const fetchSharedJob = async () => {
        const { data, error } = await supabase
          .from('jobs')
          .select('id, title, location, company:companies(name), poster:profiles(name)')
          .eq('id', sharedJobId)
          .single();
        if (data && !error) {
          setSharedJob(prev => ({
            ...prev,
            id: data.id,
            title: data.title || prev?.title || 'Opportunity',
            location: data.location || prev?.location || 'Remote',
            companyName: data.company?.name || data.poster?.name || prev?.companyName || 'Private Poster'
          }));
        }
      };
      fetchSharedJob();
    }
  }, [sharedJobId, supabase]);

  const contentLimit = 180;
  
  const processedContent = useMemo(() => {
    let rawContent = post.content || '';
    rawContent = rawContent.replace(/\[link\]\(route:\/mservices(?:\?jobId=|\/opportunity\/)[^)]+\)/g, '').trim();

    const isEscaped = rawContent.includes('&lt;') || rawContent.includes('&gt;');
    const unescaped = isEscaped && mounted ? unescapeHtml(rawContent) : rawContent;
    
    if (!mounted) return unescaped;
    
    return isExpanded ? unescaped : truncateHtmlWithTags(unescaped, contentLimit);
  }, [post.content, mounted, isExpanded]);

  const shouldTruncate = (post.content || '').length > 200;

  const router = useRouter();

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
          {post.shared_article ? (
            <div className="post-author" style={{ fontWeight: 600, color: '#1b1c1c' }}>
              <span className="flex flex-wrap items-center gap-1">
                {post.author} <span className="text-gray-500 font-normal">shared a blog:</span> {post.shared_article.title}
                <span className="text-gray-300 mx-1">•</span>
                <span className="text-gray-400 font-normal text-xs">{post.time}</span>
              </span>
            </div>
          ) : (
            <>
              <div className="post-author" style={{ fontWeight: 600, color: '#1b1c1c' }}>{post.author}</div>
              <div className="post-headline">{post.headline}</div>
              <div className="post-time">{post.time}</div>
            </>
          )}
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

      {/* SHARED ARTICLE PREVIEW */}
      {post.shared_article && (
        <div 
          onClick={() => router.push(`/mblog?articleId=${post.shared_article.id}`)}
          className="mx-4 mb-4 p-4 rounded-xl border border-gray-100 bg-gray-50/50 hover:bg-white hover:border-blue-200 hover:shadow-md transition-all cursor-pointer group shadow-sm active:scale-[0.98]"
        >
          <div className="flex flex-col gap-3">
            {post.shared_article.media_url && (
              <div className="rounded-lg overflow-hidden h-32 w-full">
                <img 
                  src={post.shared_article.media_url} 
                  alt="" 
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                />
              </div>
            )}
            <div>
              <h4 className="text-sm font-bold text-[#0e2a4d] mb-1 group-hover:text-[#004173] line-clamp-2">
                {post.shared_article.title}
              </h4>
              <div 
                className="text-xs text-gray-500 line-clamp-3 leading-relaxed"
                dangerouslySetInnerHTML={{ 
                  __html: DOMPurify.sanitize(truncateHtmlWithTags(post.shared_article.content_html || '', 150)) 
                }}
              />
              <div className="mt-2 text-[10px] font-bold text-blue-600 uppercase tracking-wider flex items-center gap-1">
                Read full article <span className="text-xs">→</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SHARED JOB PREVIEW */}
      {sharedJob && (
        <div className="mx-4 mb-4 p-5 rounded-xl border border-gray-200 bg-white shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded bg-blue-50 flex items-center justify-center text-blue-900">
                <Briefcase size={16} />
              </div>
              <h3 className="text-base font-bold text-blue-900">
                {sharedJob.title}
              </h3>
            </div>
            
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-sm text-gray-600 ml-10">
              <div className="flex items-center gap-1.5">
                <Building2 size={14} className="text-gray-400" />
                <span className="font-medium">{sharedJob.companyName}</span>
              </div>
              {sharedJob.location && (
                <div className="flex items-center gap-1.5">
                  <MapPin size={14} className="text-gray-400" />
                  <span>{sharedJob.location}</span>
                </div>
              )}
            </div>
          </div>
          
          <button
            onClick={() => router.push('/mservices?tab=opportunity&jobId=' + sharedJob.id)}
            className="px-6 py-2 bg-blue-900 text-white rounded-lg text-sm font-semibold hover:bg-blue-800 transition-colors whitespace-nowrap text-center shadow-sm"
          >
            View Job Details
          </button>
        </div>
      )}

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
