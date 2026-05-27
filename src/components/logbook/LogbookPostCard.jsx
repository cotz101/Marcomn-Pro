'use client';

import React, { useState, useEffect, memo } from 'react';
import { User, Calendar, ThumbsUp, MessageSquare, Save, X, Loader2, BookOpen } from 'lucide-react';
import { createClient } from '@/lib/supabase';
import { useProfile } from '@/app/context/ProfileContext';
import LogbookActionBar from './LogbookActionBar';
import RichTextEditor from '@/src/components/common/RichTextEditor';
import LikersModal from '@/src/components/modals/LikersModal';

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

  const [connections, setConnections] = useState([]);
  const [mentionSearch, setMentionSearch] = useState('');
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const commentInputRef = React.useRef(null);

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
    setIsLikesModalOpen(true);
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

  const fetchConnections = async () => {
    if (!userId) return;
    try {
      const { data: followData, error: followError } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', userId);
        
      if (followError) throw followError;
      const followingIds = followData?.map(f => f.following_id) || [];
      
      if (followingIds.length === 0) {
        setConnections([]);
        return;
      }
      
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, name, avatar_url, username')
        .in('id', followingIds);
        
      if (profilesError) throw profilesError;
      setConnections(profilesData || []);
    } catch (err) {
      console.error('Error fetching connections for mentions:', err);
    }
  };

  const filteredConnections = React.useMemo(() => {
    if (!mentionSearch) return connections;
    const searchLower = mentionSearch.toLowerCase();
    return connections.filter(c => {
      const nameMatch = (c.name || '').toLowerCase().includes(searchLower);
      const usernameMatch = (c.username || '').toLowerCase().includes(searchLower);
      return nameMatch || usernameMatch;
    });
  }, [connections, mentionSearch]);

  const handleKeyUp = async (e) => {
    const input = e.target;
    const val = input.value;
    const selStart = input.selectionStart;
    
    const textBeforeCaret = val.slice(0, selStart);
    const lastAtIdx = textBeforeCaret.lastIndexOf('@');
    
    if (lastAtIdx !== -1 && (lastAtIdx === 0 || textBeforeCaret.charAt(lastAtIdx - 1) === ' ')) {
      const query = textBeforeCaret.slice(lastAtIdx + 1);
      
      if (!query.includes(' ')) {
        setMentionSearch(query);
        setShowMentionDropdown(true);
        
        if (connections.length === 0) {
          await fetchConnections();
        }
        return;
      }
    }
    
    setShowMentionDropdown(false);
  };

  const handleSelectMention = (connection) => {
    const input = commentInputRef.current;
    if (!input) return;
    
    const val = newCommentText;
    const selStart = input.selectionStart;
    
    const textBeforeCaret = val.slice(0, selStart);
    const lastAtIdx = textBeforeCaret.lastIndexOf('@');
    
    if (lastAtIdx !== -1) {
      const mentionName = connection.username || (connection.name || '').replace(/\s+/g, '');
      const insertedText = `@${mentionName} `;
      
      const newText = val.slice(0, lastAtIdx) + insertedText + val.slice(selStart);
      setNewCommentText(newText);
      setShowMentionDropdown(false);
      
      setTimeout(() => {
        input.focus();
        const newCaretPos = lastAtIdx + insertedText.length;
        input.setSelectionRange(newCaretPos, newCaretPos);
      }, 50);
    }
  };

  const extractMentions = async (text) => {
    if (!text) return [];
    const regex = /@([a-zA-Z0-9_-]+)/g;
    const matches = [...text.matchAll(regex)];
    if (matches.length === 0) return [];
    
    const usernames = [...new Set(matches.map(m => m[1].toLowerCase()))];
    
    try {
      const { data: allProfiles, error } = await supabase
        .from('profiles')
        .select('id, username, name');
        
      if (error || !allProfiles) return [];
      
      const matchedUserIds = [];
      for (const username of usernames) {
        const match = allProfiles.find(p => {
          if (p.username && p.username.toLowerCase() === username) {
            return true;
          }
          if (p.name) {
            const normalizedName = p.name.toLowerCase().replace(/\s+/g, '');
            if (normalizedName === username) {
              return true;
            }
          }
          return false;
        });
        
        if (match) {
          matchedUserIds.push(match.id);
        }
      }
      
      return [...new Set(matchedUserIds)];
    } catch (err) {
      console.error('Error extracting mentions:', err);
      return [];
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

      // Asynchronously process mentions resiliently
      extractMentions(commentContent).then(async (mentionedUserIds) => {
        const filteredUserIds = mentionedUserIds.filter(id => id !== userId);
        if (filteredUserIds.length > 0) {
          try {
            await Promise.all(
              filteredUserIds.map(async (mentionedUserId) => {
                return supabase.from('notifications').insert([{
                  recipient_id: mentionedUserId,
                  sender_id: userId,
                  type: 'mention',
                  title: 'New Mention',
                  body: 'Mentioned you in a comment',
                  link: '/logbook/' + post.id,
                  is_read: false
                }]);
              })
            );
          } catch (notifErr) {
            console.error('Failed to send mention notification:', notifErr);
          }
        }
      }).catch(err => {
        console.error('Error in extractMentions process:', err);
      });

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
    const diffInWeeks = Math.floor(diffInDays / 7);

    if (diffInSecs < 60) return 'just now';
    if (diffInMins < 60) return `${diffInMins}m ago`;
    if (diffInHours < 24) return `${diffInHours}h ago`;
    if (diffInDays < 7) return `${diffInDays}d ago`;
    if (diffInWeeks < 4) return `${diffInWeeks}w ago`;
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
              className="w-full h-auto object-contain rounded-lg"
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
    <div id={`post-${post.id}`} className="card border border-gray-100 bg-white hover:shadow-md transition-shadow duration-300 rounded-xl shadow-sm overflow-hidden p-4 md:p-6 mb-4 relative">
        
        {/* Post Author Info Header */}
        <div className="flex justify-between items-start mb-4">
          {/* Left: Avatar & Metadata */}
          <div className="flex items-start gap-3 min-w-0 flex-1 pr-4">
            <div className="flex-shrink-0">
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
            </div>
            
            <div className="flex flex-col justify-center min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="font-semibold text-[#0e2a4d] text-[15px] sm:text-base leading-tight truncate">
                  {author.name || 'Maritime Professional'}
                </h4>
                {isArticle && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[9px] font-extrabold tracking-wider bg-emerald-50 text-emerald-950 rounded-full border border-emerald-100 uppercase select-none flex-shrink-0">
                    <BookOpen size={10} />
                    <span>Article</span>
                  </span>
                )}
              </div>
              <div className="text-[12px] sm:text-[13px] text-gray-400 flex items-center gap-1.5 font-normal mt-0.5 truncate">
                <span className="truncate">{author.headline || 'MarComn Member'}</span>
                <span className="flex-shrink-0 text-gray-300 font-normal">•</span>
                <span className="flex-shrink-0 text-gray-300 font-normal">{getRelativeTime(post.created_at)}</span>
              </div>
            </div>
          </div>
          
          {/* Right: 3-Dot Menu */}
          {!isEditing && (
            <div className="flex-shrink-0 relative z-20 flex items-center justify-center px-2">
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
            </div>
          )}
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
                  <div className="border border-gray-100 rounded-lg p-4 bg-gray-50/50 font-sans overflow-hidden flex flex-col gap-4">
                    {/* Hero Image Section */}
                    <div className="w-full h-64 bg-gray-100 flex items-center justify-center overflow-hidden relative shrink-0 rounded-lg border border-gray-150">
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
                    <div className="flex flex-col flex-1">
                      <h4 className="text-lg md:text-2xl font-bold leading-snug md:leading-tight text-navy-900 mb-2">
                        {post.mblogs?.title || 'Shared Post'}
                      </h4>
                      <p className="text-[15px] sm:text-base leading-[1.45] sm:leading-relaxed text-gray-700 mt-2 line-clamp-3">
                        {post.mblogs?.content?.replace(/<[^>]*>?/gm, '') || 'No description available.'}
                      </p>
                      
                      <div className="text-left mt-3">
                        <a
                          href={`/mblog`}
                          className="text-blue-900 font-semibold text-sm hover:underline cursor-pointer"
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
                    {/* --- SURGICAL INSET ALIGNMENT --- */}
                    <div>
                      {/* 1. Title */}
                    <h2 className="text-lg md:text-2xl font-bold leading-snug md:leading-tight text-navy-900">
                      {post.title}
                    </h2>

                    {/* 2. Content Body */}
                    {isExpanded ? (
                      <div className="prose prose-sm max-w-none text-[15px] sm:text-base leading-[1.45] sm:leading-relaxed text-gray-700 mt-2 space-y-4">
                        <div
                          dangerouslySetInnerHTML={{ __html: renderContentWithEmbeds(post.content) }}
                          className="article-full-html"
                        />
                        
                        <button
                          type="button"
                          onClick={() => setIsExpanded(false)}
                          className="text-[#004173] hover:text-blue-800 font-extrabold text-[14px] sm:text-xs mt-4 flex items-center gap-1 select-none focus:outline-none"
                        >
                          <span>Read less</span>
                        </button>
                      </div>
                    ) : (
                      <div>
                        {/* Excerpt */}
                        <p className="text-[15px] sm:text-base leading-[1.45] sm:leading-relaxed text-gray-700 mt-2 line-clamp-3">
                          {post.excerpt || getPlainText(post.content).substring(0, 150) + '...'}
                        </p>

                        <button
                          type="button"
                          onClick={() => setIsExpanded(true)}
                          className="text-[#004173] hover:text-blue-800 font-extrabold text-[14px] sm:text-xs flex items-center gap-1 select-none focus:outline-none"
                        >
                          <span>Read More</span>
                        </button>
                      </div>
                    )}
                    </div>

                    {/* 3. Media (Image/Video/Embed) */}
                    {!isEditing && renderMedia(post.cover_media_url, post.media_type, post.video_url)}
                  </div>
                ) : (
                  /* QUICK STATUS VIEW */
                  <div>
                    {isHtml(displayContent) ? (
                      <div
                        dangerouslySetInnerHTML={{ __html: displayContent }}
                        className="prose prose-sm max-w-none text-[15px] sm:text-base leading-[1.45] sm:leading-relaxed text-gray-700 mt-2"
                      />
                    ) : (
                      <div className="text-[15px] sm:text-base leading-[1.45] sm:leading-relaxed text-gray-700 mt-2 whitespace-pre-wrap break-words">
                        {displayContent}
                      </div>
                    )}

                    {shouldTruncate && (
                      <button
                        type="button"
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="text-[#004173] hover:underline font-bold text-[14px] sm:text-xs mt-1 focus:outline-none select-none"
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

        {/* Footer Actions */}
        <div className="pt-3.5 mt-3.5 border-t border-gray-100/70">
          {/* Action badges bar (Likes/Comments count) */}
          <div className="flex justify-between items-center text-gray-400 text-[12px] font-medium select-none mb-2.5">
            <div className="flex items-center gap-4 font-sans">
              <span
                onClick={handleLikeCountClick}
                className={`font-sans flex items-center gap-1.5 ${
                  likeCount > 0 ? 'cursor-pointer hover:underline hover:text-[#0e2a4d] transition-colors' : ''
                }`}
              >
                <span>{likeCount} {likeCount === 1 ? 'like' : 'likes'}</span>
              </span>
              <span>•</span>
              <span>{commentCount} {commentCount === 1 ? 'comment' : 'comments'}</span>
            </div>
          </div>

          {/* Interactive Action Buttons Bar (Like & Comment triggers & 3-dot Menu) */}
          <div className="flex items-center gap-1 w-full">
            <button
              type="button"
              onClick={handleLike}
              disabled={isSubmitting}
              className={`flex-1 flex items-center justify-center gap-2 min-h-[44px] py-2.5 px-3 rounded-lg text-[14px] sm:text-sm font-medium transition-all cursor-pointer select-none active:scale-[0.98] outline-none focus:outline-none focus:ring-0 font-sans ${
                hasLiked
                  ? 'text-blue-950 font-bold bg-navy-50/50'
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
              className={`flex-1 flex items-center justify-center gap-2 min-h-[44px] py-2.5 px-3 rounded-lg text-[14px] sm:text-sm font-medium text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-all cursor-pointer select-none active:scale-[0.98] outline-none focus:outline-none focus:ring-0 font-sans ${
                showComments ? 'bg-gray-50/80 text-gray-800' : ''
              }`}
            >
              <MessageSquare size={18} />
              <span className="font-sans">Comment</span>
            </button>
          </div>
        </div>

        {/* Expandable Comments Section */}
        {showComments && (
          <div className="mt-4 pt-4 border-t border-gray-100 space-y-4 animate-fadeIn">
            
            {/* Comment Input Box */}
            <form onSubmit={handleCommentSubmit} className="flex gap-3 items-start relative mb-5">
              {showMentionDropdown && filteredConnections.length > 0 && (
                <div 
                  className="absolute bottom-full left-11 mb-2 w-64 max-h-48 overflow-y-auto bg-white border border-gray-200 rounded-xl shadow-lg z-50 py-1.5 animate-fadeIn"
                  style={{
                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                  }}
                >
                  {filteredConnections.map((connection) => (
                    <div
                      key={connection.id}
                      onClick={() => handleSelectMention(connection)}
                      className="flex items-center gap-2.5 px-3.5 py-2 hover:bg-slate-50 cursor-pointer transition-colors"
                    >
                      {connection.avatar_url ? (
                        <img
                          src={connection.avatar_url}
                          alt={connection.name}
                          className="w-6.5 h-6.5 rounded-full object-cover border border-slate-100"
                        />
                      ) : (
                        <div className="w-6.5 h-6.5 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center">
                          <User size={10} className="text-gray-400" />
                        </div>
                      )}
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-slate-800 leading-tight">
                          {connection.name}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          @{connection.username || (connection.name || '').replace(/\s+/g, '').toLowerCase()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
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
                  ref={commentInputRef}
                  type="text"
                  value={newCommentText}
                  onChange={(e) => setNewCommentText(e.target.value)}
                  onKeyUp={handleKeyUp}
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
              <div className="flex flex-col gap-1.5 max-h-[300px] overflow-y-auto pr-1">
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
                      
                      <div className="flex-1 bg-gray-50 rounded-2xl px-3 py-2 border border-gray-100 ml-6">
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



        {/* Removed Action Controls from bottom */}


        {/* Likes Modal */}
        <LikersModal
          isOpen={isLikesModalOpen}
          onClose={() => setIsLikesModalOpen(false)}
          postId={post.id}
          tableName="likes"
          foreignKey="post_id"
        />

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
