'use client';
import { useState, useEffect, useCallback } from 'react';
import CreatePost from './CreatePost';
import PostComposerModal from './PostComposerModal';
import { createClient } from '@/lib/supabase';
import { useProfile } from '@/app/context/ProfileContext';
import PostCard from './PostCard';
import { Anchor } from 'lucide-react';

export default function LogbookFeed({ profile }) {
  const [posts, setPosts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingPost, setEditingPost] = useState(null);
  const [isClient, setIsClient] = useState(false);
  const { userId } = useProfile();
  const supabase = createClient();

  useEffect(() => {
    setIsClient(true);
  }, []);

  const fetchPosts = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('posts')
        .select(`
          *,
          author:profiles(full_name, avatar_url, headline),
          company:companies(name, logo_url, industry),
          comments:comments(count)
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Supabase fetch error:', error);
        setIsLoading(false);
        return;
      }

      if (data) {
        const formattedPosts = data.map(post => {
          const isCompanyPost = !!post.posted_as_company_id;
          const authorName = isCompanyPost ? post.company?.name : post.author?.full_name;
          const authorAvatar = isCompanyPost ? post.company?.logo_url : post.author?.avatar_url;
          const authorHeadline = isCompanyPost ? post.company?.industry : post.author?.headline;
          
          const dateObj = new Date(post.created_at);
          const timeString = dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

          return {
            id: post.id,
            authorId: post.user_id,
            author: authorName || 'Anonymous',
            headline: authorHeadline || (isCompanyPost ? 'Maritime Company' : 'Maritime Professional'),
            time: timeString,
            avatar: authorAvatar || (isCompanyPost ? '/favicon.svg' : '/profile_pic.png'),
            isCompany: isCompanyPost,
            content: post.content,
            type: post.title ? 'article' : 'standard',
            title: post.title,
            media: post.media_url,
            mediaType: post.media_type,
            youtubeLink: post.youtube_link,
            comment_count: post.comments?.[0]?.count || 0
          };
        });
        setPosts(formattedPosts);
      }
    } catch (err) {
      console.error('Fatal fetch error:', err);
    } finally {
      setIsLoading(false);
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

  const handleUpdate = async (postData) => {
    const { error } = await supabase
      .from('posts')
      .update({
        title: postData.title,
        content: postData.content,
        media_url: postData.media,
        media_type: postData.mediaType
      })
      .eq('id', postData.id);

    if (error) {
      console.error('Error updating post:', error);
      alert('Failed to save changes: ' + error.message);
    } else {
      setEditingPost(null);
      await fetchPosts();
    }
  };

  if (!isClient) {
    return <div className="feed-container"><CreatePost profile={profile} /></div>;
  }

  const PostSkeleton = () => (
    <div className="card post-card p-4">
      <div className="flex gap-3 mb-4">
        <div className="skeleton skeleton-avatar"></div>
        <div className="flex-1">
          <div className="skeleton skeleton-text" style={{ width: '40%' }}></div>
          <div className="skeleton skeleton-text" style={{ width: '25%' }}></div>
        </div>
      </div>
      <div className="skeleton skeleton-title"></div>
      <div className="skeleton skeleton-text"></div>
      <div className="skeleton skeleton-text"></div>
      <div className="skeleton skeleton-text" style={{ width: '80%' }}></div>
      <div className="skeleton skeleton-media"></div>
    </div>
  );

  return (
    <div className="feed-container">
      <CreatePost profile={profile} />
      
      {isLoading ? (
        <div className="feed-loading">
          <PostSkeleton />
          <PostSkeleton />
          <PostSkeleton />
        </div>
      ) : posts.length > 0 ? (
        posts.map(post => (
          <PostCard 
            key={post.id} 
            post={post} 
            userId={userId} 
            profile={profile}
            onEdit={setEditingPost} 
            onDeleteSuccess={fetchPosts} 
          />
        ))
      ) : (
        <div className="empty-state-container">
          <Anchor className="empty-state-icon" />
          <div className="empty-state-text">
            No log entries found. Start the voyage by posting an update.
          </div>
        </div>
      )}

      {editingPost && (
        <PostComposerModal
          isOpen={true}
          onClose={() => setEditingPost(null)}
          onPostSubmit={handleUpdate}
          profile={profile}
          initialData={editingPost}
        />
      )}
    </div>
  );
}
