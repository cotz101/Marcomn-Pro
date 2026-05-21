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
          id,
          title,
          content,
          media_url,
          created_at,
          user_id,
          profiles:user_id (
            name,
            avatar_url
          ),
          likes ( id, user_id ),
          comments ( id, content, user_id )
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('PostgREST Optimization Trace:', JSON.stringify(error, null, 2));
        setPosts([]);
        setIsLoading(false);
        return;
      }

      // Flattening structure and injecting default mocks to prevent UI layout failure
      const sanitizedPosts = (data || []).map(post => {
        const postLikes = post.likes || [];
        const postComments = post.comments || [];
        const profilesObj = post.profiles || { name: 'MarComn Professional', avatar_url: null };
        const dateObj = new Date(post.created_at);
        const timeString = dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

        return {
          ...post,
          likes: postLikes,
          comments: postComments,
          
          // UI properties for PostCard compatibility
          author: profilesObj.name || 'MarComn Professional',
          avatar: profilesObj.avatar_url || '/profile_pic.png',
          headline: 'Maritime Professional',
          time: timeString,
          comment_count: postComments.length,
          like_count: postLikes.length,
          user_has_liked: postLikes.some(l => l.user_id === userId)
        };
      });

      setPosts(sanitizedPosts);
      setIsLoading(false);
    } catch (err) {
      console.error('Fatal fetch error:', err);
      setPosts([]);
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

  const handleLike = useCallback(async (postId) => {
    if (!userId) return;

    let wasLiked = false;
    let originalLikes = [];

    setPosts(currentPosts => currentPosts.map(post => {
      if (post.id === postId) {
        const hasLiked = post.likes.some(like => like.user_id === userId);
        wasLiked = hasLiked;
        originalLikes = post.likes;

        const updatedLikes = hasLiked
          ? post.likes.filter(like => like.user_id !== userId)
          : [...post.likes, { user_id: userId }];

        return {
          ...post,
          likes: updatedLikes,
          like_count: updatedLikes.length,
          user_has_liked: !hasLiked
        };
      }
      return post;
    }));

    try {
      if (wasLiked) {
        const { error } = await supabase
          .from('likes')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', userId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('likes')
          .insert({ post_id: postId, user_id: userId });
        if (error) throw error;
      }
    } catch (err) {
      console.error('Failed to update like in DB, reverting local state:', err);
      setPosts(currentPosts => currentPosts.map(post => {
        if (post.id === postId) {
          return {
            ...post,
            likes: originalLikes,
            like_count: originalLikes.length,
            user_has_liked: wasLiked
          };
        }
        return post;
      }));
    }
  }, [supabase, userId]);

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
            onRefresh={fetchPosts}
            onLike={handleLike}
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
