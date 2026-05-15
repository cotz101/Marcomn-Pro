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
    console.log('LogbookFeed: Fetching posts for user:', userId);
    try {
      // We want to fetch all posts, but also know if the CURRENT user liked them.
      // To do this without filtering the entire post list, we fetch the posts 
      // and a sub-selection of likes that match the current user.
      const { data, error } = await supabase
        .from('posts')
        .select(`
          *,
          author:profiles(name, avatar_url, headline),
          company:companies(name, logo_url, industry),
          comments:comments(count),
          likes:likes(count),
          user_liked:likes(id, user_id),
          shared_article:mblog_articles(
            id, 
            title, 
            media_url, 
            content_html,
            created_at,
            author:profiles(name)
          )
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Supabase fetch error:', error);
        setIsLoading(false);
        return;
      }

      console.log('LogbookFeed: Received posts data, count:', data?.length);

      if (data) {
        const formattedPosts = data.map(post => {
          const isCompanyPost = !!post.posted_as_company_id;
          const authorName = isCompanyPost ? post.company?.name : post.author?.name;
          const authorAvatar = isCompanyPost ? post.company?.logo_url : post.author?.avatar_url;
          const authorHeadline = isCompanyPost ? post.company?.industry : post.author?.headline;
          
          const dateObj = new Date(post.created_at);
          const timeString = dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

          // Check if current user is among the likes
          // Since we didn't filter the join in the query (to avoid filtering out posts),
          // we should ideally have filtered the joined table if possible, 
          // but checking in JS is safer for compatibility.
          // Note: In the query above, user_liked is just an array of likes.
          // We need to see if any of those likes belong to the current user.
          // Actually, if we wanted only the current user's like, we'd need a more complex query.
          // For now, let's assume we'll just check the likes array if we fetched it all, 
          // but the current select returns ALL likes for each post in 'user_liked'.
          // Let's refine the check.
          
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
            comment_count: post.comments?.[0]?.count || 0,
            like_count: post.likes?.[0]?.count || 0,
            // For now, we'll need to check the user_liked array if it contains a record for this user
            // This requires having fetched user_id in the likes subselect.
            // Let's fix the select above to include user_id in user_liked.
            user_has_liked: post.user_liked?.some(l => l.user_id === userId),
            shared_article_id: post.shared_article_id,
            shared_article: post.shared_article
          };
        });
        setPosts(formattedPosts);
      }
    } catch (err) {
      console.error('Fatal fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [supabase, userId]);

  useEffect(() => {
    fetchPosts();

    const channel = supabase
      .channel('public:posts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, (payload) => {
        console.log('LogbookFeed: Real-time update received:', payload.eventType);
        fetchPosts();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchPosts, supabase]);

  const handlePostCreated = (newPost) => {
    console.log('LogbookFeed: New post created, updating local state.');
    // The newPost here is already formatted for the UI by CreatePost or we can fetch it.
    // For instant feedback, we prepend it.
    setPosts(prev => [newPost, ...prev]);
    // Also re-fetch to ensure all joins (author, etc.) are correct
    fetchPosts();
  };

  const handlePostDelete = (deletedId) => {
    // Optimistically update the list
    setPosts(prevPosts => prevPosts.filter(p => p.id !== deletedId));
    // Also trigger fetch to sync with DB state
    fetchPosts();
  };

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
      <CreatePost profile={profile} onPostCreated={handlePostCreated} />
      
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
            onDeleteSuccess={handlePostDelete} 
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
