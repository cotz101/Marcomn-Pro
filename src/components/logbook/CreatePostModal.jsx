'use client';

import { useState, useRef, useEffect } from 'react';
import { createClient } from '@/lib/supabase';
import { useProfile } from '@/app/context/ProfileContext';
import { Image as ImageIcon, X, Loader2, Globe } from 'lucide-react';
import RichTextEditor from '@/src/components/common/RichTextEditor';

export default function CreatePostModal({ isOpen, onClose, onPostCreated }) {
  const { userId, profile, currentIdentity } = useProfile();
  const supabase = createClient();

  const isCompany = currentIdentity?.type === 'company';
  const identityImage = isCompany ? (currentIdentity.data?.logo_url || '/company_placeholder.png') : (profile?.profilePic || '/avatar_placeholder.png');
  const identityName = isCompany ? (currentIdentity.data?.name || 'Company') : (profile?.name || 'Maritime Professional');

  const [postMode, setPostMode] = useState('quick'); // 'quick' | 'article'
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(false);

  // Quick Post States
  const [content, setContent] = useState('');

  // Article States
  const [articleTitle, setArticleTitle] = useState('');
  const [articleContent, setArticleContent] = useState('');

  // Shared Media States
  const [selectedFile, setSelectedFile] = useState(null);
  const [mediaPreview, setMediaPreview] = useState(null);
  const [mediaType, setMediaType] = useState(null);

  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!isOpen) {
      // Reset states on close
      setContent('');
      setArticleTitle('');
      setArticleContent('');
      setSelectedFile(null);
      setMediaPreview(null);
      setMediaType(null);
      setUploadProgress(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Excerpt generator helper (plain text, safe HTML strip)
  const extractExcerpt = (html) => {
    if (!html) return '';
    const plainText = html.replace(/<[^>]*>/g, ' '); // simple tag stripping
    const cleanText = plainText.replace(/\s+/g, ' ').trim();
    if (cleanText.length <= 160) return cleanText;
    return cleanText.substring(0, 157) + '...';
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      const isVideo = file.type.startsWith('video/');
      setMediaType(isVideo ? 'video' : 'image');

      const reader = new FileReader();
      reader.onloadend = () => {
        setMediaPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadMedia = async (file) => {
    if (!file) return null;
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}_${Math.random()}.${fileExt}`;
    const filePath = `uploads/${fileName}`;

    setUploadProgress(true);
    try {
      console.log('DEBUG: Unified upload to storage bucket...', filePath);
      const { data, error } = await supabase.storage
        .from('logbook-media')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) {
        console.error('Storage Upload Error:', error);
        alert('Failed to upload attachment: ' + error.message);
        return null;
      }
      return data.path;
    } catch (err) {
      console.error('Upload failure:', err);
      alert('Error during upload: ' + err.message);
      return null;
    } finally {
      setUploadProgress(false);
    }
  };

  const handleClose = () => {
    const hasUnsavedChanges = 
      (postMode === 'quick' && (content.trim() !== '' || selectedFile !== null)) ||
      (postMode === 'article' && (articleTitle.trim() !== '' || articleContent.trim() !== '' || selectedFile !== null));

    if (hasUnsavedChanges) {
      const confirmClose = window.confirm('Are you sure you want to close? Your unsaved changes will be lost.');
      if (!confirmClose) return;
    }

    onClose();
  };

  const isFormValid = () => {
    if (postMode === 'quick') {
      return content.trim() !== '' || selectedFile !== null;
    } else {
      return articleTitle.trim() !== '' && articleContent.trim() !== '' && articleContent.trim() !== '<p><br></p>';
    }
  };

  const handlePost = async (e) => {
    if (e) e.preventDefault();

    if (!isFormValid()) return;

    setSubmitting(true);
    let mediaPath = null;

    try {
      if (selectedFile) {
        mediaPath = await uploadMedia(selectedFile);
      }

      const cleanExcerpt = postMode === 'article'
        ? extractExcerpt(articleContent)
        : content.trim().substring(0, 150);

      const postPayload = {
        user_id: userId,
        author_id: userId,
        posted_as_company_id: isCompany ? currentIdentity.id : null,
        title: postMode === 'article' ? articleTitle.trim() : null,
        content: postMode === 'article' ? articleContent.trim() : content.trim(),
        media_url: postMode === 'quick' ? mediaPath : null,
        cover_media_url: postMode === 'article' ? mediaPath : null,
        media_type: mediaType || null,
        post_type: postMode,
        excerpt: cleanExcerpt || null,
        video_url: null,
        embedded_media: null
      };

      // Force-inject the current user's session data
      const { data: { user } } = await supabase.auth.getUser();
      if (user) { 
        postPayload.user_id = user.id;
        postPayload.author_id = user.id;
      }

      console.log('DEBUG: Publishing post payload:', postPayload);
      const { data, error: insertError } = await supabase
        .from('logbook_posts')
        .insert([postPayload])
        .select(`
          id,
          title,
          content,
          media_url,
          media_type,
          video_url,
          post_type,
          excerpt,
          cover_media_url,
          embedded_media,
          author_id,
          created_at,
          user_id,
          posted_as_company_id,
          author:profiles!user_id (id, name, avatar_url, headline),
          likes ( id ),
          comments ( id )
        `)
        .maybeSingle();

      if (insertError) {
        console.error('--- FULL ERROR FORENSICS ---');
        console.error('Error Message:', insertError.message);
        console.error('Error Code:', insertError.code);
        console.error('Error Details:', insertError.details);
        console.error('Error Hint:', insertError.hint);
        console.error('Full Error Object Stringify:', JSON.stringify(insertError, null, 2));
        alert('Failed to save post: ' + (insertError.message || 'Unknown error occurred'));
        return;
      }

      console.log('SUCCESS: Post published cleanly');

      const postWithAuthor = {
        ...data,
        author: data?.author || {
          id: userId || user?.id,
          name: profile?.name || 'Maritime Professional',
          avatar_url: profile?.profilePic || null,
          headline: profile?.currentRole || 'MarComn Member'
        },
        company: isCompany ? {
          id: currentIdentity.id,
          name: currentIdentity.data?.name,
          logo_url: currentIdentity.data?.logo_url,
          industry: currentIdentity.data?.industry
        } : null
      };

      // Dispatch custom event for real-time prepending in feeds
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('logbook-post-created', { detail: postWithAuthor }));
        window.dispatchEvent(new Event('post-created'));
      }

      if (onPostCreated && data) {
        onPostCreated(postWithAuthor);
      }
      
      onClose();
    } catch (err) {
      console.error('Critical submission failure:', err);
      alert('An error occurred while publishing: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div 
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm transition-all duration-300 animate-fadeIn"
    >
      {/* Modal Container */}
      <div className={`bg-white rounded-2xl shadow-xl w-full mx-auto overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col h-auto max-h-[65vh] transition-all duration-300 ${
        postMode === 'article' ? 'max-w-3xl md:max-h-[60vh]' : 'max-w-2xl md:max-h-[60vh]'
      }`}>
        
        {/* Scoped CSS Style to lock Rich-Text Editor height and styles */}
        <style>{`
          .article-editor-wrapper .ql-container {
            min-height: 220px !important;
            max-height: none !important;
          }
          .article-editor-wrapper .ql-editor {
            min-height: 220px !important;
          }
          .ql-toolbar.ql-snow {
            border-top: none !important;
            border-left: none !important;
            border-right: none !important;
            border-bottom: 1px solid #f3f4f6 !important;
            padding: 8px 12px !important;
          }
          .ql-container.ql-snow {
            border: none !important;
          }
        `}</style>

        {/* Navy Header Shell */}
        <div className="modal-header h-14 bg-navy-900 text-white flex items-center justify-between px-6 flex-shrink-0 border-b border-[#0b223e] relative pr-4 max-sm:relative max-sm:bg-[#1e3a8a] max-sm:text-white max-sm:justify-center max-sm:border-b-0 max-sm:h-[60px]" style={{ position: "relative", paddingRight: "1rem" }}>
          <h3 className="absolute left-1/2 -translate-x-1/2 font-semibold text-lg font-sans max-sm:text-white max-sm:absolute max-sm:left-1/2 max-sm:-translate-x-1/2" style={{ position: "absolute", left: "50%", transform: "translateX(-50%)" }}>Create a Post</h3>
          <button
            type="button"
            onClick={handleClose}
            className="text-white/80 hover:text-white hover:scale-105 transition-all p-1.5 rounded-full hover:bg-white/10 flex items-center justify-center outline-none focus:outline-none cursor-pointer absolute right-4 top-1/2 -translate-y-1/2 max-sm:absolute max-sm:right-5 max-sm:text-white max-sm:hover:bg-blue-800/40"
            style={{ position: "absolute", right: "1rem", top: "50%", transform: "translateY(-50%)" }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Form using flex-col h-full */}
        <form onSubmit={handlePost} className="flex flex-col flex-1 min-h-0 bg-white">
          
          {/* Content Row: Avatar on Left, Input Container on Right */}
          <div className="user-profile-row flex items-start gap-4 p-4 flex-1 min-h-0 overflow-y-auto max-sm:pl-6">
            
            {/* User-Avatar Alignment */}
            <div className="flex-shrink-0">
              {identityImage ? (
                <img
                  src={identityImage}
                  alt={identityName}
                  className="w-11 h-11 object-cover border border-gray-100 shadow-xs"
                  style={{ borderRadius: isCompany ? '8px' : '50%' }}
                />
              ) : (
                <div className="w-11 h-11 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center shadow-inner">
                  <span className="text-sm font-extrabold text-blue-900 font-sans">
                    {identityName.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
            </div>

            {/* Input Container */}
            <div className="flex-1 max-w-2xl flex flex-col min-h-0">
              
              {/* User Audience Picker (Visibility selector UI is hidden) */}
              <div className="flex items-center gap-1.5 mb-4 text-xs text-gray-500 font-medium select-none">
                <span className="font-semibold text-gray-800 font-sans">{identityName}</span>
              </div>

              {/* Content Switcher Area */}
              <div className="flex-1 flex flex-col min-h-0 animate-fadeIn transition-all duration-300">
                <div className="article-editor-wrapper min-h-[220px] border border-gray-150 rounded-xl overflow-hidden bg-white flex-1 flex flex-col min-h-0 shadow-3xs">
                  <RichTextEditor
                    value={content}
                    onChange={setContent}
                    placeholder="What's on your mind? You can also include @mentions."
                    className="article-body-quill border-0 flex-1"
                  />
                </div>

                {/* Attachment Preview */}
                {mediaPreview && (
                  <div className="relative mt-4 rounded-xl overflow-hidden bg-gray-50 border border-gray-100 max-h-[220px] flex items-center justify-center flex-shrink-0">
                    {mediaType === 'video' ? (
                      <video src={mediaPreview} controls className="max-h-[220px] w-auto" />
                    ) : (
                      <img src={mediaPreview} alt="Selected attachment" className="max-h-[220px] w-auto object-contain" />
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedFile(null);
                        setMediaPreview(null);
                        setMediaType(null);
                      }}
                      className="absolute top-2.5 right-2.5 p-1.5 bg-black/60 hover:bg-black/85 text-white rounded-full transition-colors cursor-pointer"
                    >
                      <X size={14} />
                    </button>
                  </div>
                )}
              </div>

              {uploadProgress && (
                <div className="mt-4 flex items-center gap-2 justify-center text-xs font-semibold text-blue-600 bg-blue-50 py-2.5 rounded-lg border border-blue-100 flex-shrink-0 animate-pulse">
                  <Loader2 size={14} className="animate-spin" />
                  <span>Uploading attachment...</span>
                </div>
              )}
            </div>

          </div>

          {/* Action Bar / Footer */}
          <div className="modal-footer px-6 py-4 flex justify-between items-center bg-white border-t border-gray-200 flex-shrink-0 pr-6 max-sm:pr-6" style={{ paddingRight: "1.5rem" }}>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  if (fileInputRef.current) {
                    fileInputRef.current.accept = 'image/*,video/mp4';
                    fileInputRef.current.click();
                  }
                }}
                className="flex items-center gap-2 px-4 py-2 hover:bg-gray-50 rounded-lg text-gray-500 hover:text-gray-800 font-bold text-xs transition-all cursor-pointer active:scale-95 border border-gray-200 select-none bg-white shadow-3xs outline-none focus:outline-none font-sans ml-4 mb-2"
                style={{ marginLeft: "1rem", marginBottom: "0.5rem" }}
              >
                <ImageIcon size={18} className="text-navy-900" />
                <span>Media</span>
              </button>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleClose}
                className="px-5 py-2 text-sm font-semibold text-gray-600 hover:text-gray-800 transition-colors cursor-pointer select-none outline-none focus:outline-none font-sans"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || uploadProgress || !isFormValid()}
                className="post-button bg-navy-900 hover:bg-navy-800 text-white px-10 py-2 rounded-full font-semibold text-sm transition-all active:scale-95 disabled:bg-gray-200 disabled:text-gray-400 disabled:pointer-events-none transition-colors select-none cursor-pointer outline-none focus:outline-none shadow-3xs font-sans max-sm:px-10 max-sm:min-w-[120px]"
                style={{ paddingLeft: "2.5rem", paddingRight: "2.5rem" }}
              >
                {submitting ? (
                  <div className="flex items-center gap-1.5 font-sans">
                    <Loader2 size={14} className="animate-spin" />
                    <span>Posting...</span>
                  </div>
                ) : (
                  <span className="font-sans">Post</span>
                )}
              </button>
            </div>
          </div>

        </form>

      </div>
    </div>
  );
}
