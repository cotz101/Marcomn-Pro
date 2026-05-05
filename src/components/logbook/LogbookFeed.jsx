'use client';
import { useState, useEffect, useCallback } from 'react';
import CreatePost from './CreatePost';
import PostComposerModal from './PostComposerModal';
import { createClient } from '@/lib/supabase';
import { useProfile } from '@/app/context/ProfileContext';
import PostCard from './PostCard';

export default function LogbookFeed({ profile }) {
  const [posts, setPosts] = useState([]);
  const [editingPost, setEditingPost] = useState(null);
  const [isClient, setIsClient] = useState(false);
  const { userId } = useProfile();
  const supabase = createClient();

  useEffect(() => {
    setIsClient(true);
  }, []);

  const fetchPosts = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('posts')
        .select(`
          *,
          author:profiles(full_name, avatar_url, headline),
          company:companies(name, logo_url, industry)
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Supabase fetch error:', error);
        return;
      }

      if (data) {
        const formattedPosts = data.map(post => {
          const isCompanyPost = !!post.posted_as_company_id;
          const authorName = isCompanyPost ? post.company?.name : post.author?.full_name;
          const authorAvatar = isCompanyPost ? post.company?.logo_url : post.author?.avatar_url;
          const authorHeadline = isCompanyPost ? post.company?.industry : post.author?.headline;
          
          // Hydration-safe date formatting (handled on client or with stable format)
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
            youtubeLink: post.youtube_link
          };
        });
        setPosts(formattedPosts);
      }
    } catch (err) {
      console.error('Fatal fetch error:', err);
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

  // Prevent hydration mismatch by only rendering the dynamic content on the client
  if (!isClient) {
    return <div className="feed-container"><CreatePost profile={profile} /></div>;
  }

  return (
    <div className="feed-container">
      <CreatePost profile={profile} />
      
      {posts.length > 0 ? (
        posts.map(post => (
          <PostCard 
            key={post.id} 
            post={post} 
            userId={userId} 
            onEdit={setEditingPost} 
            onDeleteSuccess={fetchPosts} 
          />
        ))
      ) : (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
          No posts in the logbook yet.
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
