"use client";
import { X, Image as ImageIcon, Video as VideoIcon } from 'lucide-react';
import { useRef, useState, useEffect } from 'react';
import 'react-quill/dist/quill.snow.css';



export default function ArticleEditor({ onClose, onPost }) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [coverMedia, setCoverMedia] = useState(null);
  const [mediaType, setMediaType] = useState('image'); // 'image' or 'video'
  const coverInputRef = useRef(null);
  const editorRef = useRef(null);
  const quillInstance = useRef(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const initQuill = async () => {
      if (mounted && editorRef.current && !quillInstance.current) {
        const Quill = (await import('quill')).default;
        quillInstance.current = new Quill(editorRef.current, {
          theme: 'snow',
          placeholder: 'Write here. You can also include @mentions.',
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

        if (content) {
          quillInstance.current.root.innerHTML = content;
        }
      }
    };

    initQuill();
  }, [mounted]);

  const handleMediaUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const type = file.type.startsWith('video') ? 'video' : 'image';
      const reader = new FileReader();
      reader.onloadend = () => {
        setCoverMedia(reader.result);
        setMediaType(type);
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePost = () => {
    onPost({
      type: 'article',
      title,
      content,
      media: coverMedia,
      mediaType
    });
  };

  return (
    <div className="article-editor-overlay" onClick={onClose}>
      <div className="article-editor-container" onClick={e => e.stopPropagation()}>
        <div className="article-editor-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button className="header-icon-btn" onClick={onClose}><X size={24} /></button>
            <h2 className="font-bold text-lg">Write Article</h2>
          </div>

          <div className="article-actions flex items-center gap-4">
            <span style={{ fontSize: '14px', color: '#666' }}>Saved as draft</span>
            <button 
              className="btn-primary-pill px-6" 
              onClick={handlePost}
              disabled={!title.trim() || !content.trim()}
            >
              Post
            </button>
          </div>
        </div>

        <div className="article-editor-content">
          <div className="article-cover-upload" onClick={() => coverInputRef.current.click()}>
            {coverMedia ? (
              mediaType === 'video' ? (
                <video src={coverMedia} controls style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <img src={coverMedia} alt="Cover" />
              )
            ) : (
              <>
                <div style={{ display: 'flex', gap: '16px', color: '#666' }}>
                  <ImageIcon size={48} />
                  <VideoIcon size={48} />
                </div>
                <p style={{ color: '#666', fontSize: '14px', marginTop: '12px' }}>Upload a cover photo or video</p>
                <button className="btn-secondary-pill mt-4">
                  Select File
                </button>
              </>
            )}
            <input 
              type="file" 
              accept="image/*,video/*" 
              ref={coverInputRef} 
              style={{ display: 'none' }} 
              onChange={handleMediaUpload} 
            />
          </div>

          <input 
            type="text" 
            className="article-title-input" 
            placeholder="Title"
            value={title}
            onChange={e => setTitle(e.target.value)}
          />

          <div className="quill-wrapper">
            {!mounted ? (
              <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>Loading Editor...</div>
            ) : (
              <div ref={editorRef}></div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
