'use client';

import React, { useState, useEffect, memo } from 'react';
import { User, Calendar, ThumbsUp, MessageSquare, Save, X, Loader2, BookOpen } from 'lucide-react';
import { createClient } from '@/lib/supabase';
import { useProfile } from '@/app/context/ProfileContext';
import LogbookActionBar from './LogbookActionBar';
import RichTextEditor from '@/src/components/common/RichTextEditor';
import EngagementModal from '../ui/EngagementModal';

const LogbookPostCard = memo(({ post, userId, onPostDeleted, onPostUpdated, resolveMediaUrl }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(post.content || '');
  const [editTitle, setEditTitle] = useState(post.title || '');
  const [saving, setSaving] = useState(false);

  const supabase = createClient();
  const { profile } = useProfile();

  // Reactive states for optimistic updates
  const [likesList, setLikesList] = useState(post.likes || []);
  const [commentsList, setCommentsList] = useState(post.comments || []);
  const [showComments, setShowComments] = useState(false);
  const [newCommentText, setNewCommentText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [isLikesModalOpen, setIsLikesModalOpen] = useState(false);
  const [selectedLikes, setSelectedLikes] = useState([]);
  const [loadingLikes, setLoadingLikes] = useState(false);

  useEffect(() => {
    setLikesList(post.likes || []);
    setCommentsList(post.comments || []);
  }, [post.likes, post.comments]);

  const author = post.author || { name: 'Maritime Professional', avatar_url: null, headline: 'MarComn Member' };
  const likeCount = likesList.length;
  const commentCount = commentsList.length;
  const hasLiked = userId ? likesList.some(like => like.user_id === userId) : false;

  // Align article_id parameter
  post.article_id = post.article_id || post.shared_article_id;

  // Diagnostic Enforcement
  if (post.article_id) {
    console.log('DEBUG: Rendering post with article_id:', post.article_id, 'Hydrated Blog Data:', post.mblogs);
  }

  const handleLikeCountClick = async () => {
    if (likeCount === 0) return;
    setLoadingLikes(true);
    const postId = post.id;
    try {
      const { data, error } = await supabase
        .from('likes')
        .select('user_id') // First, just fetch the ID
        .eq('post_id', postId);

      if (error) throw error;
      
      // Log specifically what we got back
      console.log('DEBUG: Likes raw data:', data);
      
      // If that works, then we attempt the join
      const { data: hydrated, error: joinError } = await supabase
        .from('likes')
        .select('user_id, profiles(name, avatar_url)')
        .eq('post_id', postId);

      if (joinError) {
        console.error('DEBUG: Join error details:', joinError);
        throw joinError;
      }
      setSelectedLikes(hydrated || []);
      setIsLikesModalOpen(true);
    } catch (err) {
      console.error('DEBUG: Critical failure during hydration:', JSON.stringify(err, null, 2));
    } finally {
      setLoadingLikes(false);
    }
  };

  const handleLike = async () => {
    if (!userId) {
      alert('Please log in to like posts.');
      return;
    }
    if (isSubmitting) return;

    setIsSubmitting(true);

    const alreadyLiked = likesList.some(like => like.user_id === userId);
    const optimisticLikes = alreadyLiked
      ? likesList.filter(like => like.user_id !== userId)
      : [...likesList, { id: 'temp-id', user_id: userId, post_id: post.id }];
    
    setLikesList(optimisticLikes);

    try {
      // Verbatim DB check
      const { data: existingLikes, error: checkError } = await supabase
        .from('likes')
        .select('id')
        .eq('post_id', post.id)
        .eq('user_id', userId);
      
      if (checkError) throw checkError;

      if (existingLikes && existingLikes.length > 0) {
        // If it exists, delete() it
        const { error: deleteError } = await supabase
          .from('likes')
          .delete()
          .eq('post_id', post.id)
          .eq('user_id', userId);
        if (deleteError) throw deleteError;
      } else {
        // If it does not exist, insert() it
        const { data: newLike, error: insertError } = await supabase
          .from('likes')
          .insert({ post_id: post.id, user_id: userId })
          .select('id')
          .single();
        if (insertError) throw insertError;
        
        setLikesList(prev => prev.map(l => l.id === 'temp-id' ? { ...l, id: newLike.id } : l));
      }
    } catch (err) {
      console.error('Error during handleLike:', err);
      // Revert optimistic update
      setLikesList(likesList);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCommentSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!userId) {
      alert('Please log in to add a comment.');
      return;
    }
    if (!newCommentText.trim() || isSubmitting) return;

    setIsSubmitting(true);
    const commentContent = newCommentText.trim();
    
    // Create optimistic comment representation
    const optimisticComment = {
      id: 'temp-comment-id',
      post_id: post.id,
      user_id: userId,
      content: commentContent,
      created_at: new Date().toISOString(),
      profiles: {
        name: profile?.name || 'Maritime Professional',
        avatar_url: profile?.profilePic || null
      }
    };

    setCommentsList(prev => [optimisticComment, ...prev]);
    setNewCommentText('');

    try {
      const { data: newComment, error } = await supabase
        .from('comments')
        .insert({ 
          post_id: post.id, 
          user_id: userId, 
          content: commentContent 
        })
        .select(`
          id,
          post_id,
          user_id,
          content,
          created_at,
          profiles:profiles!user_id (name, avatar_url)
        `)
        .single();

      if (error) throw error;

      setCommentsList(prev => prev.map(c => c.id === 'temp-comment-id' ? newComment : c));
    } catch (err) {
      console.error('Comment submission failed:', err);
      setCommentsList(commentsList);
      setNewCommentText(commentContent);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Utility to determine if content contains HTML tags
  const isHtml = (str) => {
    return /<[a-z][\s\S]*>/i.test(str);
  };

  // Safe scanner to dynamically find plain YouTube links inside HTML and replace them with responsive iframes
  const renderContentWithEmbeds = (content) => {
    if (!content) return '';

    // Regex to scan for youtube.com or youtu.be links
    const youtubeRegex = /(https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{11})[^\s<]*)/g;

    return content.replace(youtubeRegex, (match, url, videoId) => {
      return `
        <div class="my-4 rounded-xl overflow-hidden bg-gray-50 border border-gray-100 shadow-sm relative w-full aspect-video" style="aspect-ratio: 16/9; max-width: 100%;">
          <iframe
            src="https://www.youtube.com/embed/${videoId}"
            title="YouTube video player"
            frameborder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowfullscreen
            class="absolute top-0 left-0 w-full h-full rounded-xl"
          ></iframe>
        </div>
      `;
    });
  };

  const getPlainText = (html) => {
    if (!html) return '';
    if (typeof window === 'undefined') return html;
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    return tempDiv.textContent || tempDiv.innerText || '';
  };

  // Truncation utility for normal/quick posts
  const truncateHtmlWithTags = (html, limit) => {
    if (!html) return '';
    if (typeof window === 'undefined') return html;

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;

    const plainText = tempDiv.textContent || tempDiv.innerText || '';
    if (plainText.length <= limit) return html;

    let currentLength = 0;
    let resultHtml = '';
    let isTruncated = false;

    const traverse = (node) => {
      if (isTruncated) return;

      if (node.nodeType === 3) { // TEXT_NODE
        const remaining = limit - currentLength;
        if (node.textContent.length > remaining) {
          resultHtml += node.textContent.substring(0, remaining).trim();
          currentLength = limit;
          isTruncated = true;
        } else {
          resultHtml += node.textContent;
          currentLength += node.textContent.length;
        }
      } else if (node.nodeType === 1) { // ELEMENT_NODE
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
    return resultHtml;
  };

  const isArticle = post.post_type === 'article';
  const plainTextLength = getPlainText(post.content || '').length;
  const shouldTruncate = !isArticle && plainTextLength > 300;

  // Render normal description text
  const displayContent = shouldTruncate && !isExpanded
    ? truncateHtmlWithTags(post.content || '', 300)
    : post.content || '';

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

  const handleUpdate = async () => {
    if (isArticle && !editTitle.trim()) {
      alert('Article title cannot be empty.');
      return;
    }
    if (!editContent.trim() || editContent.trim() === '<p><br></p>') {
      alert('Content cannot be empty.');
      return;
    }
    setSaving(true);
    try {
      console.log('DEBUG: Updating post content via API for id:', post.id);
      
      const updateData = { 
        content: editContent.trim(),
        excerpt: isArticle ? getPlainText(editContent).substring(0, 150).trim() + '...' : null
      };
      
      if (isArticle) {
        updateData.title = editTitle.trim();
      }

      const { data, error } = await supabase
        .from('logbook_posts')
        .update(updateData)
        .eq('id', post.id)
        .select(`
          id,
          title,
          content,
          media_url,
          media_type,
          video_url,
          post_type,
          excerpt,
          cover_media_url,
          embedded_media,
          author_id,
          created_at,
          user_id,
          author:profiles!user_id (name, avatar_url, headline),
          likes ( id ),
          comments ( id )
        `)
        .single();

      if (error) {
        console.error('Update Error:', error);
        alert('Failed to update entry: ' + error.message);
        return;
      }

      console.log('SUCCESS: Post updated cleanly');
      setIsEditing(false);
      if (onPostUpdated && data) {
        onPostUpdated(data);
      }
    } catch (err) {
      console.error('Critical update failure:', err);
      alert('An error occurred during save.');
    } finally {
      setSaving(false);
    }
  };

  const renderMedia = (mediaUrl, mediaType, videoUrl) => {
    if (videoUrl) {
      return (
        <div className="mt-4 w-full">
          <iframe
            src={`https://www.youtube.com/embed/${videoUrl}`}
            title="YouTube video player"
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            className="w-full aspect-video rounded-lg"
          />
        </div>
      );
    }

    if (mediaUrl) {
      if (mediaType === 'video') {
        return (
          <div className="mt-4 w-full">
            <video
              src={resolveMediaUrl(mediaUrl)}
              controls
              className="w-full rounded-lg"
            />
          </div>
        );
      } else {
        return (
          <div className="mt-4 w-full">
            <img
              src={resolveMediaUrl(mediaUrl)}
              alt="Post media"
              className="w-full rounded-lg"
              onError={(e) => {
                console.error('DEBUG: Image failed to load:', e.target.src);
                e.target.style.display = 'none';
              }}
            />
          </div>
        );
      }
    }

    return null;
  };

  return (
    <div className={`card border border-gray-100 bg-white hover:shadow-md transition-shadow duration-300 rounded-xl shadow-sm ${isArticle ? 'p-0 overflow-hidden' : 'p-6'}`}>
      
      {/* Main Container */}
      <div className={isArticle ? 'p-6' : ''}>
        
        {/* Post Author Info Header */}
        <div className="flex justify-between items-start gap-4 mb-4">
          <div className="flex items-center gap-3">
            {author.avatar_url ? (
              <img
                src={author.avatar_url}
                alt={author.name}
                className="w-10 h-10 rounded-full object-cover border border-gray-100 shadow-xs"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center border border-gray-100">
                <User size={18} className="text-gray-400" />
              </div>
            )}
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="font-bold text-[#0e2a4d] text-sm sm:text-base leading-tight">
                  {author.name || 'Maritime Professional'}
                </h4>
                {isArticle && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[9px] font-extrabold tracking-wider bg-emerald-50 text-emerald-950 rounded-full border border-emerald-100 uppercase select-none">
                    <BookOpen size={10} />
                    <span>Article</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 font-medium mt-0.5">
                {author.headline || 'MarComn Member'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-gray-400 text-xs font-semibold select-none flex-shrink-0">
            <Calendar size={13} />
            <span>{getRelativeTime(post.created_at)}</span>
          </div>
        </div>

        {/* Post Content Area */}
        {isEditing ? (
          <div className="space-y-4 mb-4">
            {isArticle && (
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="Article title..."
                className="w-full text-lg font-extrabold text-gray-900 border border-gray-250 focus:border-blue-300 focus:outline-none rounded-xl p-3 bg-gray-50/50"
              />
            )}
            
            {isArticle ? (
              <div className="border border-gray-250 rounded-xl overflow-hidden min-h-[220px] bg-white">
                <RichTextEditor
                  value={editContent}
                  onChange={setEditContent}
                  placeholder="Compose your article..."
                  className="quill-composer border-0"
                />
              </div>
            ) : (
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="w-full min-h-[120px] text-gray-800 border border-gray-250 focus:border-blue-300 focus:outline-none rounded-xl p-3 resize-none text-[15px] leading-relaxed transition-all bg-gray-50"
              />
            )}

            <div className="flex items-center gap-2 justify-end">
              <button
                type="button"
                onClick={() => {
                  setEditContent(post.content || '');
                  setEditTitle(post.title || '');
                  setIsEditing(false);
                }}
                disabled={saving}
                className="flex items-center gap-1.5 px-4 py-2 border border-gray-200 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg text-xs font-bold transition-all cursor-pointer active:scale-95 disabled:opacity-50 select-none"
              >
                <X size={13} />
                <span>Cancel</span>
              </button>
              <button
                type="button"
                onClick={handleUpdate}
                disabled={saving || !editContent.trim() || editContent === '<p><br></p>'}
                className="flex items-center gap-1.5 px-5 py-2 bg-[#002b4e] hover:bg-[#004173] text-white rounded-lg text-xs font-bold transition-all cursor-pointer active:scale-95 disabled:opacity-50 select-none"
              >
                {saving ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <Save size={13} />
                )}
                <span>Save Changes</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="mb-4">
            
            {post.article_id ? (
              /* Shared Blog Preview Mode */
              (() => {
                console.log('DEBUG: Rendering post with article_id:', post.article_id, 'Hydrated Blog Data:', post.mblogs);
                return (
                  <div className="border border-gray-100 rounded-t-lg rounded-b-lg bg-gray-50/50 font-sans overflow-hidden flex flex-col">
                    {/* Hero Image Section */}
                    <div className="w-full h-64 bg-gray-100 flex items-center justify-center overflow-hidden relative shrink-0">
                      {post.mblogs?.cover_image ? (
                        <img
                          src={post.mblogs.cover_image}
                          alt={post.mblogs?.title || 'Shared Post'}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.nextSibling.style.display = 'flex';
                          }}
                        />
                      ) : null}
                      <div 
                        className="w-full h-full bg-blue-50 flex flex-col items-center justify-center gap-2"
                        style={{ display: post.mblogs?.cover_image ? 'none' : 'flex' }}
                      >
                        <BookOpen size={48} className="text-navy-900" />
                        <span className="text-xs text-navy-900/60 font-semibold uppercase tracking-wider">Shared Blog Article</span>
                      </div>
                    </div>

                    {/* Content Section with breathing room padding */}
                    <div className="p-4 flex flex-col flex-1">
                      <h4 className="text-xl font-bold text-[#0e2a4d] mb-2 leading-snug">
                        {post.mblogs?.title || 'Shared Post'}
                      </h4>
                      <p className="text-sm text-gray-700 mb-4 leading-relaxed line-clamp-3">
                        {post.mblogs?.content?.replace(/<[^>]*>?/gm, '') || 'No description available.'}
                      </p>
                      
                      <div className="mt-auto pt-2 border-t border-gray-100 flex">
                        <a
                          href={`/mblog`}
                          className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-navy-900 hover:bg-navy-800 rounded-lg transition-colors font-sans cursor-pointer active:scale-98 select-none"
                        >
                          Read full blog
                        </a>
                      </div>
                    </div>
                  </div>
                );
              })()
            ) : (
              /* Standard Logbook Post Content */
              <div>
                {/* ARTICLE VIEW */}
                {isArticle ? (
                  <div>
                    {/* 1. Title */}
                    <h2 className={`font-extrabold text-[#0e2a4d] tracking-tight mt-1 mb-3 leading-snug ${isExpanded ? 'text-2xl md:text-3xl' : 'text-xl hover:text-blue-900 transition-colors'}`}>
                      {post.title}
                    </h2>

                    {/* 2. Content Body */}
                    {isExpanded ? (
                      <div className="prose prose-sm max-w-none text-gray-800 text-[15px] leading-relaxed space-y-4">
                        <div
                          dangerouslySetInnerHTML={{ __html: renderContentWithEmbeds(post.content) }}
                          className="article-full-html"
                        />
                        
                        <button
                          type="button"
                          onClick={() => setIsExpanded(false)}
                          className="text-[#004173] hover:text-blue-800 font-extrabold text-xs mt-4 flex items-center gap-1 select-none focus:outline-none"
                        >
                          <span>Read less</span>
                        </button>
                      </div>
                    ) : (
                      <div>
                        {/* Excerpt */}
                        <p className="text-gray-600 text-sm font-medium leading-relaxed mb-3 line-clamp-3">
                          {post.excerpt || getPlainText(post.content).substring(0, 150) + '...'}
                        </p>

                        <button
                          type="button"
                          onClick={() => setIsExpanded(true)}
                          className="text-[#004173] hover:text-blue-800 font-extrabold text-xs flex items-center gap-1 select-none focus:outline-none"
                        >
                          <span>Read More</span>
                        </button>
                      </div>
                    )}

                    {/* 3. Media (Image/Video/Embed) */}
                    {!isEditing && renderMedia(post.cover_media_url, post.media_type, post.video_url)}
                  </div>
                ) : (
                  /* QUICK STATUS VIEW */
                  <div>
                    {isHtml(displayContent) ? (
                      <div
                        dangerouslySetInnerHTML={{ __html: displayContent }}
                        className="prose prose-sm max-w-none text-gray-700 text-[15px] leading-relaxed"
                      />
                    ) : (
                      <div className="text-gray-700 text-[15px] leading-relaxed whitespace-pre-wrap break-words">
                        {displayContent}
                      </div>
                    )}

                    {shouldTruncate && (
                      <button
                        type="button"
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="text-[#004173] hover:underline font-bold text-xs mt-1 focus:outline-none select-none"
                      >
                        {isExpanded ? '... Show less' : '... Show more'}
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

          </div>
        )}

        {/* Media for Quick Post */}
        {!isArticle && !isEditing && renderMedia(post.media_url, post.media_type, post.video_url)}

        {/* Action badges bar (Likes/Comments count) */}
        <div className="flex justify-between items-center pt-3 border-t border-gray-100 text-gray-400 text-xs font-semibold select-none">
          <div className="flex items-center gap-4 font-sans">
            <span
              onClick={handleLikeCountClick}
              className={`font-sans flex items-center gap-1.5 ${
                likeCount > 0 ? 'cursor-pointer hover:underline hover:text-[#0e2a4d] transition-colors' : ''
              }`}
            >
              {loadingLikes && <Loader2 size={12} className="animate-spin text-gray-400" />}
              <span>{likeCount} {likeCount === 1 ? 'like' : 'likes'}</span>
            </span>
            <span>•</span>
            <span>{commentCount} {commentCount === 1 ? 'comment' : 'comments'}</span>
          </div>
        </div>

        {/* Interactive Action Buttons Bar (Like & Comment triggers) */}
        <div className="flex items-center gap-1 border-t border-b border-gray-100 py-1 mt-3">
          <button
            type="button"
            onClick={handleLike}
            disabled={isSubmitting}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-bold transition-all cursor-pointer select-none active:scale-[0.98] outline-none focus:outline-none focus:ring-0 font-sans ${
              hasLiked
                ? 'text-navy-900 bg-navy-50/50'
                : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
            }`}
          >
            <ThumbsUp size={18} className={hasLiked ? 'fill-navy-900 stroke-navy-900' : 'text-gray-500'} />
            <span className="font-sans">Like</span>
          </button>

          <button
            type="button"
            onClick={() => setShowComments(!showComments)}
            disabled={isSubmitting}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-bold text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-all cursor-pointer select-none active:scale-[0.98] outline-none focus:outline-none focus:ring-0 font-sans ${
              showComments ? 'bg-gray-50/80 text-gray-800' : ''
            }`}
          >
            <MessageSquare size={18} />
            <span className="font-sans">Comment</span>
          </button>
        </div>

        {/* Expandable Comments Section */}
        {showComments && (
          <div className="mt-4 pt-4 border-t border-gray-100 space-y-4 animate-fadeIn">
            
            {/* Comment Input Box */}
            <form onSubmit={handleCommentSubmit} className="flex gap-3 items-start">
              {profile?.profilePic ? (
                <img
                  src={profile.profilePic}
                  alt={profile.name || 'User'}
                  className="w-8 h-8 rounded-full object-cover border border-gray-100 flex-shrink-0"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center shadow-inner flex-shrink-0">
                  <span className="text-[11px] font-extrabold text-blue-900 font-sans">
                    {profile?.name?.charAt(0)?.toUpperCase() || 'M'}
                  </span>
                </div>
              )}
              
              <div className="flex-1 flex gap-2">
                <input
                  type="text"
                  value={newCommentText}
                  onChange={(e) => setNewCommentText(e.target.value)}
                  placeholder="Add a comment..."
                  disabled={isSubmitting}
                  className="flex-1 bg-gray-50 border border-gray-200 text-gray-800 placeholder-gray-400 text-sm rounded-full px-4 py-2 focus:ring-1 focus:ring-navy-900/10 focus:border-navy-900/30 focus:outline-none outline-none transition-all disabled:opacity-60 font-sans"
                />
                <button
                  type="submit"
                  disabled={isSubmitting || !newCommentText.trim()}
                  className="bg-navy-900 hover:bg-navy-800 text-white text-xs font-bold px-4 py-2 rounded-full transition-all disabled:bg-gray-100 disabled:text-gray-400 disabled:pointer-events-none select-none cursor-pointer outline-none focus:outline-none active:scale-95 font-sans"
                >
                  Post
                </button>
              </div>
            </form>

            {/* Comments List */}
            {commentsList.length > 0 ? (
              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                {commentsList.map((comment) => {
                  const commentAuthor = comment.profiles || { name: 'Maritime Professional', avatar_url: null };
                  return (
                    <div key={comment.id} className="flex gap-2.5 items-start text-sm">
                      {commentAuthor.avatar_url ? (
                        <img
                          src={commentAuthor.avatar_url}
                          alt={commentAuthor.name}
                          className="w-7 h-7 rounded-full object-cover border border-gray-100 flex-shrink-0 mt-0.5"
                        />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-gray-150 flex items-center justify-center flex-shrink-0 mt-0.5 border border-gray-200">
                          <User size={12} className="text-gray-400" />
                        </div>
                      )}
                      
                      <div className="flex-1 bg-gray-50 rounded-2xl px-3 py-2 border border-gray-100">
                        <div className="flex justify-between items-center mb-0.5 flex-wrap gap-x-2">
                          <span className="font-extrabold text-[#0e2a4d] text-xs font-sans">
                            {commentAuthor.name}
                          </span>
                          <span className="text-[10px] text-gray-400 font-medium select-none font-sans">
                            {getRelativeTime(comment.created_at)}
                          </span>
                        </div>
                        <p className="text-gray-700 text-xs leading-relaxed whitespace-pre-wrap break-words font-sans">
                          {comment.content}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-4 text-gray-400 text-xs font-medium font-sans">
                No comments yet. Start the conversation!
              </div>
            )}

          </div>
        )}

        {/* Edit/Delete Action Controls */}
        {!isEditing && (
          <LogbookActionBar
            post={post}
            userId={userId}
            onEditClick={() => {
              setEditContent(post.content || '');
              setEditTitle(post.title || '');
              setIsEditing(true);
            }}
            onDeleteSuccess={onPostDeleted}
          />
        )}

        {/* Likes Modal */}
        <EngagementModal
          isOpen={isLikesModalOpen}
          onClose={() => setIsLikesModalOpen(false)}
          title="Likes"
          data={selectedLikes}
          searchPlaceholder="Search who liked..."
          emptyMessage="No likes match your search."
        />

      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Prevent re-render unless posts attributes or user changes
  return prevProps.post.id === nextProps.post.id &&
         prevProps.post.content === nextProps.post.content &&
         prevProps.post.title === nextProps.post.title &&
         prevProps.post.post_type === nextProps.post.post_type &&
         prevProps.post.video_url === nextProps.post.video_url &&
         prevProps.post.media_url === nextProps.post.media_url &&
         prevProps.post.cover_media_url === nextProps.post.cover_media_url &&
         prevProps.post.media_type === nextProps.post.media_type &&
         prevProps.post.likes?.length === nextProps.post.likes?.length &&
         prevProps.post.comments?.length === nextProps.post.comments?.length &&
         prevProps.userId === nextProps.userId &&
         prevProps.post.mblogs?.id === nextProps.post.mblogs?.id &&
         prevProps.post.mblogs?.title === nextProps.post.mblogs?.title &&
         prevProps.post.mblogs?.cover_image === nextProps.post.mblogs?.cover_image &&
         prevProps.post.mblogs?.content === nextProps.post.mblogs?.content;
});

LogbookPostCard.displayName = 'LogbookPostCard';

export default LogbookPostCard;
