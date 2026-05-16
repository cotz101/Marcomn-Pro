import { X, Image as MediaIcon, ChevronDown, Type } from 'lucide-react';
import { useRef, useState, useEffect } from 'react';
import { useProfile } from '@/app/context/ProfileContext';
import BaseModal from '../layout/BaseModal';
import 'react-quill/dist/quill.snow.css';

export default function PostComposerModal({ isOpen, onClose, onPostSubmit, profile, initialData = null, groupId = null }) {
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

        // Replace the "Tx" button icon with Lucide Type
        const cleanButton = document.querySelector('.ql-clean');
        if (cleanButton) {
          const Quill = (await import('quill')).default;
          // We can't easily change the icon via Quill API for 'clean', so we inject it
          const typeIconHtml = `<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-type"><polyline points="4 7 4 4 20 4 20 7"></polyline><line x1="9" y1="20" x2="15" y2="20"></line><line x1="12" y1="4" x2="12" y2="20"></line></svg>`;
          cleanButton.innerHTML = typeIconHtml;
          cleanButton.title = "Remove Formatting";
        }

        quillInstance.current.on('text-change', () => {
          setContent(quillInstance.current.root.innerHTML);
        });
      }
      
      // Update quill content when initialData changes or modal opens
      if (quillInstance.current && isOpen) {
        // Only update if current content in editor is different to avoid cursor jumps
        if (content !== quillInstance.current.root.innerHTML) {
          quillInstance.current.root.innerHTML = content;
        }
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
      type: (initialData?.title || title) ? 'article' : 'standard',
      title,
      content,
      media,
      mediaType,
    });
    
    // Clear local state if not editing
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
    <BaseModal 
      isOpen={isOpen} 
      onClose={onClose} 
      title={initialData ? "Edit Post" : "Create a Post"}
    >
      <div className="flex flex-col w-full overflow-x-hidden px-3 sm:px-6">
        <div className="composer-header-sub flex items-center gap-3 mb-6">
          <img 
            src={identityImage} 
            alt={identityName} 
            className="w-12 h-12 object-cover"
            style={{ borderRadius: isCompany ? '8px' : '50%' }}
          />
          <div className="composer-name-group flex flex-col">
            <span className="composer-name font-semibold text-base flex items-center gap-1 text-[var(--on-surface)]">
              {identityName} <ChevronDown size={14} className="text-[var(--on-surface-variant)]" />
            </span>
            <span className="composer-visibility text-xs text-[var(--on-surface-variant)]">
              {groupId ? 'Post to Group' : 'Post to Anyone'}
            </span>
          </div>
        </div>

        <div className="composer-content min-h-[250px]">
          {initialData?.title && (
            <input 
              type="text" 
              className="w-full border-none outline-none bg-transparent text-2xl font-bold mb-4 placeholder:text-[var(--on-surface-variant)] text-[var(--on-surface)]" 
              placeholder="Title"
              value={title}
              onChange={e => setTitle(e.target.value)}
            />
          )}
          {!mounted ? (
            <div className="p-8 text-center text-[var(--on-surface-variant)]">Loading Editor...</div>
          ) : (
            <div className="quill-wrapper border-none">
              <div ref={editorRef} className="text-base"></div>
            </div>
          )}

          {media && (
            <div className="media-preview-container relative mt-4 rounded-lg overflow-hidden border border-[var(--outline)]">
              <button className="btn-remove-media absolute top-2 right-2 bg-black/50 text-white p-1.5 rounded-full hover:bg-black/70" onClick={() => { setMedia(null); setMediaType(null); }}>
                <X size={14} />
              </button>
              {mediaType === 'video' ? (
                <video src={media} controls className="w-full max-h-[400px] object-contain bg-black" />
              ) : (
                <img src={media} alt="Attached Media" className="w-full max-h-[400px] object-contain" />
              )}
            </div>
          )}
        </div>

        <div className="m-composer-footer-actions flex flex-wrap justify-between items-center pt-4 border-t border-[var(--outline)]">
          <div className="m-composer-media-btns flex items-center gap-2 sm:gap-4">
            <button onClick={() => { setMediaType(null); fileInputRef.current.click(); }} className="flex items-center gap-2 text-[var(--on-surface-variant)] hover:text-[var(--primary)] transition-colors" title="Add Media">
              <MediaIcon size={22} />
              <span className="text-sm font-semibold">Media</span>
            </button>
          </div>

          <button 
            className="btn-primary-pill px-6 shrink-0"
            disabled={isPostDisabled}
            onClick={handlePost}
          >
            {initialData ? 'Save Changes' : 'Post'}
          </button>
        </div>
        
        <input 
          type="file" 
          accept="image/*,video/*" 
          ref={fileInputRef} 
          className="hidden"
          onChange={handleMediaUpload} 
        />
      </div>
    </BaseModal>
  );
}
