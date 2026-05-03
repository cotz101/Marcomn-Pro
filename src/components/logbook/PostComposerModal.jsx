import { X, Image as ImageIcon, Video as VideoIcon, ChevronDown } from 'lucide-react';
import { useRef, useState } from 'react';

export default function PostComposerModal({ isOpen, onClose, onPostSubmit, profile }) {
  const [content, setContent] = useState('');
  const [media, setMedia] = useState(null);
  const [mediaType, setMediaType] = useState(null);
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const handleMediaUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const type = file.type.startsWith('video/') ? 'video' : 'image';
      const reader = new FileReader();
      reader.onloadend = () => {
        setMedia(reader.result);
        setMediaType(type);
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePost = () => {
    onPostSubmit({
      type: 'standard',
      content,
      media,
      mediaType,
    });
    setContent('');
    setMedia(null);
    setMediaType(null);
    onClose();
  };

  const isPostDisabled = !content.trim() && !media;

  return (
    <div className="post-composer-overlay">
      <div className="post-composer-modal">
        <div className="composer-header">
          <div className="composer-user-info">
            <img src={profile?.profilePic || '/profile_pic.png'} alt="Me" />
            <div className="composer-name-group">
              <span className="composer-name">
                {profile?.fullName || 'User'} <ChevronDown size={16} color="var(--text-secondary)" />
              </span>
              <span className="composer-visibility">Post to Anyone</span>
            </div>
          </div>
          <button className="btn-close" onClick={onClose}><X size={24} /></button>
        </div>

        <div className="composer-body">
          <textarea
            className="composer-textarea"
            placeholder="What do you want to talk about?"
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />

          {media && (
            <div className="media-preview-container">
              <button className="btn-remove-media" onClick={() => { setMedia(null); setMediaType(null); }}>
                <X size={16} />
              </button>
              {mediaType === 'video' ? (
                <video src={media} controls style={{ width: '100%', maxHeight: '300px', objectFit: 'contain' }} />
              ) : (
                <img src={media} alt="Attached Media" />
              )}
            </div>
          )}
        </div>

        <div className="composer-footer">
          <div className="composer-actions-left">
            <div onClick={() => fileInputRef.current.click()} style={{ cursor: 'pointer', display: 'flex' }}>
              <ImageIcon size={24} className="composer-action-icon" />
            </div>
            <div onClick={() => fileInputRef.current.click()} style={{ cursor: 'pointer', display: 'flex' }}>
              <VideoIcon size={24} className="composer-action-icon" />
            </div>
          </div>

          <div className="composer-actions-right">
            <button 
              className="btn-post" 
              disabled={isPostDisabled}
              onClick={handlePost}
            >
              Post
            </button>
          </div>
        </div>
        <input 
          type="file" 
          accept="image/*,video/*" 
          ref={fileInputRef} 
          style={{ display: 'none' }} 
          onChange={handleMediaUpload} 
        />
      </div>
    </div>
  );
}
