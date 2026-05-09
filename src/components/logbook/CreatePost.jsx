import { Image as MediaIcon, Newspaper } from 'lucide-react';
import { useState } from 'react';
import ArticleEditor from './ArticleEditor';
import PostComposerModal from './PostComposerModal';
import { createClient } from '@/lib/supabase';
import { useProfile } from '@/app/context/ProfileContext';

export default function CreatePost({ profile, onPostCreated }) {
  const [isArticleOpen, setIsArticleOpen] = useState(false);
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const { userId, currentIdentity } = useProfile();
  const supabase = createClient();

  const isCompany = currentIdentity?.type === 'company';
  const identityName = isCompany ? currentIdentity.data.name : profile?.fullName;
  const identityImage = isCompany 
    ? (currentIdentity.data.logo_url || '/favicon.svg') 
    : (profile?.profilePic || '/profile_pic.png');

  const handlePostSubmit = async (postData) => {
    console.log('CreatePost: Attempting to create post:', postData);
    
    const postToInsert = {
      user_id: userId,
      content: postData.content,
      title: postData.title || null,
      media_url: postData.media || null,
      media_type: postData.mediaType || 'image',
      posted_as_company_id: isCompany ? currentIdentity.id : null
    };

    const { data, error } = await supabase
      .from('posts')
      .insert(postToInsert)
      .select(`
        *,
        author:profiles(name, avatar_url, headline),
        company:companies(name, logo_url, industry)
      `)
      .single();

    if (!error && data) {
      console.log('CreatePost: Post created successfully:', data.id);
      
      // Format the post for immediate UI feedback
      const authorName = isCompany ? data.company?.name : data.author?.name;
      const authorAvatar = isCompany ? data.company?.logo_url : data.author?.avatar_url;
      const authorHeadline = isCompany ? data.company?.industry : data.author?.headline;
      
      const formattedPost = {
        id: data.id,
        authorId: data.user_id,
        author: authorName || identityName || 'Anonymous',
        headline: authorHeadline || (isCompany ? 'Maritime Company' : 'Maritime Professional'),
        time: 'Just now',
        avatar: authorAvatar || identityImage,
        isCompany: isCompany,
        content: data.content,
        type: data.title ? 'article' : 'standard',
        title: data.title,
        media: data.media_url,
        mediaType: data.media_type,
        comment_count: 0,
        like_count: 0,
        user_has_liked: false
      };

      if (onPostCreated) {
        onPostCreated(formattedPost);
      }

      setIsArticleOpen(false);
      setIsComposerOpen(false);
    } else {
      console.error('CreatePost: Error posting:', error);
      alert('Error posting: ' + (error?.message || 'Unknown error'));
    }
  };

  return (
    <>
      <div className="card create-post-card">
        <div className="create-post-top">
          <img 
            src={identityImage} 
            alt={identityName || 'User'} 
            className="post-avatar" 
            style={{ borderRadius: isCompany ? '8px' : '50%' }} 
          />
          <div 
            className="create-post-input"
            onClick={() => setIsComposerOpen(true)}
          >
            Start a post as {identityName}
          </div>
        </div>
        <div className="create-post-actions">
          <button className="create-action-btn" onClick={() => setIsComposerOpen(true)}>
            <MediaIcon size={24} className="icon-media" style={{ color: '#004173' }} />
            <span>Media</span>
          </button>
          <button className="create-action-btn" onClick={() => setIsArticleOpen(true)}>
            <Newspaper size={24} className="icon-article" style={{ color: '#004173' }} />
            <span>Write article</span>
          </button>
        </div>
      </div>

      <PostComposerModal 
        isOpen={isComposerOpen} 
        onClose={() => setIsComposerOpen(false)} 
        onPostSubmit={handlePostSubmit} 
        profile={profile} 
      />

      {isArticleOpen && (
        <ArticleEditor 
          onClose={() => setIsArticleOpen(false)} 
          onPost={handlePostSubmit} 
        />
      )}
    </>
  );
}
