import { Video, Image as ImageIcon, Newspaper } from 'lucide-react';
import { useState } from 'react';
import ArticleEditor from './ArticleEditor';
import PostComposerModal from './PostComposerModal';

export default function CreatePost({ onPostSubmit, profile }) {
  const [isArticleOpen, setIsArticleOpen] = useState(false);
  const [isComposerOpen, setIsComposerOpen] = useState(false);

  const handlePostSubmit = (postData) => {
    onPostSubmit(postData);
    setIsArticleOpen(false);
  };

  return (
    <>
      <div className="card create-post-card">
        <div className="create-post-top">
          <img src={profile?.profilePic || '/profile_pic.png'} alt="Me" className="post-avatar" style={{ width: '48px', height: '48px' }} />
          <div 
            className="create-post-input"
            onClick={() => setIsComposerOpen(true)}
          >
            Start a post
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
