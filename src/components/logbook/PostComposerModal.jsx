import { X, Image as ImageIcon, Video as VideoIcon, ChevronDown } from 'lucide-react';
import { useRef, useState, useEffect } from 'react';
import { useProfile } from '@/app/context/ProfileContext';
import 'react-quill/dist/quill.snow.css';

export default function PostComposerModal({ isOpen, onClose, onPostSubmit, profile, initialData = null }) {
  const { currentIdentity } = useProfile();
  const [content, setContent] = useState('');
  const [title, setTitle] = useState('');
  const [media, setMedia] = useState(null);
  const [mediaType, setMediaType] = useState(null);
  const fileInputRef = useRef(null);
  const editorRef = useRef(null);
  const quillInstance = useRef(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (initialData && isOpen) {
      setContent(initialData.content || '');
      setTitle(initialData.title || '');
      setMedia(initialData.media || null);
      setMediaType(initialData.mediaType || null);
    } else if (!initialData && isOpen) {
      setContent('');
      setTitle('');
      setMedia(null);
      setMediaType(null);
    }
  }, [initialData, isOpen]);

  useEffect(() => {
    const initQuill = async () => {
      if (mounted && editorRef.current && !quillInstance.current) {
        const Quill = (await import('quill')).default;
        quillInstance.current = new Quill(editorRef.current, {
          theme: 'snow',
          placeholder: 'What do you want to talk about?',
          modules: {
            toolbar: [
              ['bold', 'italic'],
              [{ 'list': 'ordered'}, { 'list': 'bullet' }],
              ['clean']
            ]
          }
        });

        quillInstance.current.on('text-change', () => {
          setContent(quillInstance.current.root.innerHTML);
        });
      }
      
      // Update quill content when initialData changes or modal opens
      if (quillInstance.current && content !== quillInstance.current.root.innerHTML) {
        quillInstance.current.root.innerHTML = content;
      }
    };

    if (isOpen) {
      initQuill();
    } else {
      // Cleanup quill instance when modal closes to prevent duplicates
      if (quillInstance.current) {
        quillInstance.current = null;
      }
    }
  }, [mounted, isOpen, initialData]);

  if (!isOpen) return null;

  const isCompany = currentIdentity?.type === 'company';
  const identityName = isCompany ? currentIdentity.data.name : profile?.fullName;
  const identityImage = isCompany 
    ? (currentIdentity.data.logo_url || '/favicon.svg') 
    : (profile?.profilePic || '/profile_pic.png');

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
      id: initialData?.id,
      type: initialData?.title ? 'article' : 'standard',
      title,
      content,
      media,
      mediaType,
    });
    if (!initialData) {
      setContent('');
      setTitle('');
      setMedia(null);
      setMediaType(null);
    }
    onClose();
  };

  const isPostDisabled = !content.trim() && !media;

  return (
    <div className="post-composer-overlay">
      <div className="post-composer-modal">
        <div className="composer-header">
          <div className="composer-user-info">
            <img 
              src={identityImage} 
              alt={identityName} 
              style={{ borderRadius: isCompany ? '4px' : '50%' }}
            />
            <div className="composer-name-group">
              <span className="composer-name">
                {identityName} <ChevronDown size={16} color="var(--text-secondary)" />
              </span>
              <span className="composer-visibility">Post to Anyone</span>
            </div>
          </div>
          <button className="btn-close" onClick={onClose}><X size={24} /></button>
        </div>

        <div className="composer-body">
          {initialData?.title && (
            <input 
              type="text" 
              className="article-title-input" 
              placeholder="Title"
              value={title}
              onChange={e => setTitle(e.target.value)}
              style={{ 
                width: '100%', 
                border: 'none', 
                fontSize: '20px', 
                fontWeight: 'bold', 
                marginBottom: '12px',
                outline: 'none',
                background: 'transparent',
                color: 'var(--text-primary)'
              }}
            />
          )}
          {!mounted ? (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading Editor...</div>
          ) : (
            <div className="quill-wrapper" style={{ minHeight: '150px', border: 'none' }}>
              <div ref={editorRef} style={{ fontSize: '16px' }}></div>
            </div>
          )}

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
              {initialData ? 'Save Changes' : 'Post'}
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
