import { Video, Image as ImageIcon, Newspaper } from 'lucide-react';
import { useState } from 'react';
import ArticleEditor from './ArticleEditor';
import PostComposerModal from './PostComposerModal';
import { createClient } from '@/lib/supabase';
import { useProfile } from '@/app/context/ProfileContext';

export default function CreatePost({ profile }) {
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
    const { error } = await supabase.from('posts').insert({
      user_id: userId,
      content: postData.content,
      title: postData.title || null,
      media_url: postData.media || null,
      media_type: postData.mediaType || 'image',
      posted_as_company_id: isCompany ? currentIdentity.id : null
    });

    if (!error) {
      setIsArticleOpen(false);
      setIsComposerOpen(false);
    } else {
      alert('Error posting: ' + error.message);
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
            <Video size={24} className="icon-video" />
            <span>Video</span>
          </button>
          <button className="create-action-btn" onClick={() => setIsComposerOpen(true)}>
            <ImageIcon size={24} className="icon-photo" />
            <span>Photo</span>
          </button>
          <button className="create-action-btn" onClick={() => setIsArticleOpen(true)}>
            <Newspaper size={24} className="icon-article" />
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
