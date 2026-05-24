'use client';

import { useState, useRef } from 'react';
import { createClient } from '@/lib/supabase';
import { useProfile } from '@/app/context/ProfileContext';
import { Image as ImageIcon, Video as VideoIcon, X, Loader2, Globe } from 'lucide-react';
import RichTextEditor from '@/src/components/common/RichTextEditor';

export default function CreatePost({ onPostCreated }) {
  const { userId, profile } = useProfile();
  const supabase = createClient();

  // Unified Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
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

    // Reset everything
    setContent('');
    setArticleTitle('');
    setArticleContent('');
    setSelectedFile(null);
    setMediaPreview(null);
    setMediaType(null);
    setIsModalOpen(false);
  };

  const isFormValid = () => {
    if (postMode === 'quick') {
      return content.trim() !== '' || selectedFile !== null;
    } else {
      return articleTitle.trim() !== '' && articleContent.trim() !== '' && articleContent.trim() !== '<p><br></p>';
    }
  };

  const handleSubmit = async (e) => {
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
          author:profiles!user_id (name, avatar_url, headline),
          likes ( id ),
          comments ( id )
        `)
        .maybeSingle();

      if (insertError) {
        console.error('Database Insert Error:', insertError);
        alert('Failed to save post: ' + insertError.message);
        return;
      }

      console.log('SUCCESS: Post published cleanly');

      // Reset states
      setContent('');
      setArticleTitle('');
      setArticleContent('');
      setSelectedFile(null);
      setMediaPreview(null);
      setMediaType(null);
      setIsModalOpen(false);

      if (onPostCreated && data) {
        onPostCreated(data);
      }
    } catch (err) {
      console.error('Critical submission failure:', err);
      alert('An error occurred while publishing: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div 
      className="bg-white rounded-xl border border-gray-100 px-2 sm:px-4 py-5 mb-6 shadow-sm flex flex-col gap-3 w-full max-w-3xl mx-auto"
      style={{ paddingTop: '20px', paddingBottom: '20px' }}
    >
      {/* Avatar + Rounded Trigger Button */}
      <div className="flex items-center gap-3 w-full">
        {profile?.profilePic ? (
          <img
            src={profile.profilePic}
            alt={profile.name || 'User'}
            className="w-10 h-10 rounded-full object-cover border border-gray-100 shadow-xs flex-shrink-0"
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center shadow-inner flex-shrink-0">
            <span className="text-sm font-extrabold text-blue-900">
              {profile?.name?.charAt(0)?.toUpperCase() || 'M'}
            </span>
          </div>
        )}

        <button
          type="button"
          onClick={() => {
            setPostMode('quick'); // Open modal and default to quick log
            setIsModalOpen(true);
          }}
          className="bg-gray-50 hover:bg-gray-100/80 border border-gray-200 font-sans font-medium text-sm text-gray-500 rounded-full transition-all cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-100 active:scale-[0.99] select-none flex items-center justify-center w-full text-center px-4 py-3"
        >
          Start a post as {profile?.name || 'member'}...
        </button>
      </div>

      {/* Unified Modal Overlay */}
      {isModalOpen && (
        <div 
          onClick={(e) => {
            if (e.target === e.currentTarget) handleClose();
          }}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm transition-all duration-300 animate-fadeIn"
        >
          
          {/* Modal Container */}
          <div className={`bg-white rounded-2xl shadow-xl w-full mx-auto overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col h-full max-h-[85vh] transition-all duration-300 ${
            postMode === 'article' ? 'max-w-3xl md:max-h-[80vh]' : 'max-w-2xl md:max-h-[75vh]'
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
            <div className="h-14 bg-navy-900 text-white flex items-center justify-between px-6 flex-shrink-0 border-b border-[#0b223e] relative pr-4" style={{ position: "relative", paddingRight: "1rem" }}>
              <div className="absolute left-1/2 -translate-x-1/2 font-semibold text-lg font-sans" style={{ position: "absolute", left: "50%", transform: "translateX(-50%)" }}>Create a Post</div>
              <button
                type="button"
                onClick={handleClose}
                className="text-white/80 hover:text-white hover:scale-105 transition-all p-1.5 rounded-full hover:bg-white/10 flex items-center justify-center outline-none focus:outline-none cursor-pointer absolute right-4 top-1/2 -translate-y-1/2"
                style={{ position: "absolute", right: "1rem", top: "50%", transform: "translateY(-50%)" }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Tabbed Posting Gate integrated into the top bar */}
            <div className="flex border-b border-gray-150 gap-6 bg-gray-50 flex-shrink-0 justify-center px-0" style={{ justifyContent: "center", paddingLeft: "0", paddingRight: "0" }}>
              <button
                type="button"
                onClick={() => setPostMode('quick')}
                className={`py-3 px-1 text-sm font-bold transition-all select-none cursor-pointer border-b-2 outline-none focus:outline-none ${
                  postMode === 'quick'
                    ? 'border-navy-900 text-navy-900'
                    : 'border-transparent text-gray-400 hover:text-gray-600'
                }`}
              >
                Quick Post
              </button>
              <button
                type="button"
                onClick={() => setPostMode('article')}
                className={`py-3 px-1 text-sm font-bold transition-all select-none cursor-pointer border-b-2 outline-none focus:outline-none ${
                  postMode === 'article'
                    ? 'border-navy-900 text-navy-900'
                    : 'border-transparent text-gray-400 hover:text-gray-600'
                }`}
              >
                Write Article
              </button>
            </div>

            {/* Form using flex-col h-full */}
            <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 bg-white">
              
              {/* Content Row: Avatar on Left, Input Container on Right */}
              <div className="flex items-start gap-4 p-4 flex-1 min-h-0 overflow-y-auto">
                
                {/* User-Avatar Alignment */}
                <div className="flex-shrink-0">
                  {profile?.profilePic ? (
                    <img
                      src={profile.profilePic}
                      alt={profile.name || 'User'}
                      className="w-11 h-11 rounded-full object-cover border border-gray-100 shadow-xs"
                    />
                  ) : (
                    <div className="w-11 h-11 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center shadow-inner">
                      <span className="text-sm font-extrabold text-blue-900 font-sans">
                        {profile?.name?.charAt(0)?.toUpperCase() || 'M'}
                      </span>
                    </div>
                  )}
                </div>

                {/* Input Container (occupying remaining horizontal space with max-w-2xl constraint) */}
                <div className="flex-1 max-w-2xl flex flex-col min-h-0">
                  
                  {/* User Audience Dropdown Picker */}
                  <div className="flex items-center gap-1.5 mb-4 text-xs text-gray-500 font-medium select-none">
                    <span className="font-semibold text-gray-800 font-sans">{profile?.name || 'Maritime Professional'}</span>
                    <span className="text-gray-300">•</span>
                    <div className="flex items-center gap-1 px-2.5 py-0.5 bg-gray-50 border border-gray-200 rounded-full text-[10px] font-bold text-gray-600 hover:bg-gray-100 cursor-pointer transition-colors">
                      <span className="font-sans">Post to Anyone</span>
                      <span className="text-[7px] font-extrabold text-gray-500">▼</span>
                    </div>
                  </div>

                  {/* Content Switcher Area */}
                  {postMode === 'quick' ? (
                    /* QUICK POST CONTAINER */
                    <div className="flex-1 flex flex-col min-h-0 animate-fadeIn transition-all duration-300">
                      <textarea
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        placeholder="What's on your mind?"
                        className="w-full text-base placeholder-gray-400 placeholder:font-sans placeholder:font-normal font-sans font-normal resize-none border-0 focus:ring-0 focus:outline-none outline-none leading-relaxed flex-1 text-gray-800 bg-transparent min-h-[200px]"
                      />

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
                  ) : (
                    /* WRITE ARTICLE CONTAINER */
                    <div className="flex-1 flex flex-col min-h-0 animate-fadeIn">
                      {/* Title & Cover Thumbnail Row */}
                      <div className="flex gap-4 items-start border-b border-gray-100 pb-2 mb-4 flex-shrink-0">
                        <div className="flex-1">
                          <input
                            type="text"
                            value={articleTitle}
                            onChange={(e) => setArticleTitle(e.target.value)}
                            placeholder="Title"
                            className="w-full text-2xl font-bold border-none focus:ring-0 focus:outline-none outline-none bg-transparent placeholder-gray-400"
                          />
                        </div>

                        {/* Inline Cover Media Thumbnail */}
                        {mediaPreview && (
                          <div className="h-16 w-16 flex-shrink-0 rounded border border-gray-200 overflow-hidden relative bg-gray-50 flex items-center justify-center group animate-fadeIn">
                            {mediaType === 'video' ? (
                              <video
                                src={mediaPreview}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <img
                                src={mediaPreview}
                                alt="Article Cover"
                                className="w-full h-full object-cover"
                              />
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedFile(null);
                                setMediaPreview(null);
                                setMediaType(null);
                              }}
                              className="absolute inset-0 bg-black/40 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer animate-fadeIn"
                            >
                              <X size={16} />
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Rich Text Editor */}
                      <div className="article-editor-wrapper min-h-[220px] border border-gray-150 rounded-xl overflow-hidden bg-white flex-1 flex flex-col min-h-0 shadow-3xs">
                        <RichTextEditor
                          value={articleContent}
                          onChange={setArticleContent}
                          placeholder="Write here. You can also include @mentions."
                          className="article-body-quill border-0 flex-1"
                        />
                      </div>
                    </div>
                  )}

                  {uploadProgress && (
                    <div className="mt-4 flex items-center gap-2 justify-center text-xs font-semibold text-blue-600 bg-blue-50 py-2.5 rounded-lg border border-blue-100 flex-shrink-0 animate-pulse">
                      <Loader2 size={14} className="animate-spin" />
                      <span>Uploading attachment...</span>
                    </div>
                  )}
                </div>

              </div>

              {/* Action Bar / Footer */}
              <div className="px-6 py-4 flex justify-between items-center bg-white border-t border-gray-200 flex-shrink-0 pr-6" style={{ paddingRight: "1.5rem" }}>
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
                    className="bg-navy-900 hover:bg-navy-800 text-white px-10 py-2 rounded-full font-semibold text-sm transition-all active:scale-95 disabled:bg-gray-200 disabled:text-gray-400 disabled:pointer-events-none transition-colors select-none cursor-pointer outline-none focus:outline-none shadow-3xs font-sans"
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
      )}
    </div>
  );
}
