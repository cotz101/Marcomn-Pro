'use client';
import { ThumbsUp, MessageSquare, Share2 } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import CreatePost from './CreatePost';
import { createClient } from '@/lib/supabase';

export default function LogbookFeed({ profile }) {
  const [posts, setPosts] = useState([]);
  const supabase = createClient();

  const fetchPosts = useCallback(async () => {
    const { data, error } = await supabase
      .from('posts')
      .select(`
        *,
        author:profiles(full_name, avatar_url, headline),
        company:companies(name, logo_url, industry)
      `)
      .order('created_at', { ascending: false });

    if (data && !error) {
      const formattedPosts = data.map(post => {
        const isCompanyPost = !!post.posted_as_company_id;
        const authorName = isCompanyPost ? post.company?.name : post.author?.full_name;
        const authorAvatar = isCompanyPost ? post.company?.logo_url : post.author?.avatar_url;
        const authorHeadline = isCompanyPost ? post.company?.industry : post.author?.headline;
        
        return {
          id: post.id,
          author: authorName || 'Anonymous',
          headline: authorHeadline || (isCompanyPost ? 'Maritime Company' : 'Maritime Professional'),
          time: new Date(post.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          avatar: authorAvatar || (isCompanyPost ? '/favicon.svg' : '/profile_pic.png'),
          isCompany: isCompanyPost,
          content: post.content,
          type: post.title ? 'article' : 'standard',
          title: post.title,
          media: post.media_url,
          mediaType: post.media_type
        };
      });
      setPosts(formattedPosts);
    }
  }, [supabase]);

  useEffect(() => {
    fetchPosts();

    const channel = supabase
      .channel('public:posts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, () => {
        fetchPosts();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchPosts, supabase]);

  const handleNewPost = async (postData) => {
    // This is now just a placeholder if needed, 
    // but the actual insertion should happen in the composer.
    // However, to keep it simple, we can still call it here if we want.
  };

  const getYoutubeEmbedUrl = (url) => {
    if (!url) return null;
    const videoIdMatch = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&]{11})/);
    return videoIdMatch ? `https://www.youtube.com/embed/${videoIdMatch[1]}` : null;
  };

  return (
    <div className="feed-container">
      <CreatePost profile={profile} />
      
      {posts.map(post => (
        <div key={post.id} className="card post-card">
          <div className="post-header">
            <img 
              src={post.avatar} 
              alt={post.author} 
              className="post-avatar" 
              style={{ borderRadius: post.isCompany ? '8px' : '50%' }}
            />
            <div>
              <div className="post-author">{post.author}</div>
              <div className="post-headline">{post.headline}</div>
              <div className="post-time">{post.time}</div>
            </div>
          </div>
          
          {post.type === 'article' && (
            <div style={{ marginBottom: '16px' }}>
              <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '8px' }}>{post.title}</h2>
              {post.youtubeLink && getYoutubeEmbedUrl(post.youtubeLink) ? (
                <iframe 
                  width="100%" 
                  height="300" 
                  src={getYoutubeEmbedUrl(post.youtubeLink)} 
                  title="YouTube video" 
                  frameBorder="0" 
                  style={{ borderRadius: '8px', marginBottom: '16px' }}
                  allowFullScreen>
                </iframe>
              ) : post.media && (
                post.mediaType === 'video' ? (
                  <video 
                    src={post.media} 
                    controls 
                    style={{ width: '100%', maxHeight: '400px', objectFit: 'cover', borderRadius: '8px', marginBottom: '16px', backgroundColor: 'black' }} 
                  />
                ) : (
                  <img src={post.media} alt="Cover" style={{ width: '100%', maxHeight: '400px', objectFit: 'cover', borderRadius: '8px', marginBottom: '16px' }} />
                )
              )}
            </div>
          )}
          
          {(post.type === 'standard' && post.media) && (
            post.mediaType === 'video' ? (
              <video src={post.media} controls style={{ width: '100%', maxHeight: '400px', objectFit: 'cover', borderRadius: '8px', marginBottom: '16px', backgroundColor: 'black' }} />
            ) : (
              <img src={post.media} alt="Attached Media" style={{ width: '100%', maxHeight: '400px', objectFit: 'cover', borderRadius: '8px', marginBottom: '16px' }} />
            )
          )}

          {post.type === 'article' ? (
            <div className="post-content ql-editor" dangerouslySetInnerHTML={{ __html: post.content }} style={{ padding: 0 }} />
          ) : (
            <div className="post-content">{post.content}</div>
          )}
          
          <div className="post-actions">
            <button className="action-btn"><ThumbsUp size={18} /> Like</button>
            <button className="action-btn"><MessageSquare size={18} /> Comment</button>
            <button className="action-btn"><Share2 size={18} /> Share</button>
          </div>
        </div>
      ))}
    </div>
  );
}
