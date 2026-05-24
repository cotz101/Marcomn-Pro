'use client';

/**
 * @deprecated Use CreatePostModal instead of this redundant mobile-only composer.
 */

import { useState, useRef, useEffect } from 'react';
import { createClient } from '@/lib/supabase';
import { X, Image as ImageIcon, Video as VideoIcon, Loader2, Globe } from 'lucide-react';

export default function PostComposerModal({ isOpen, onClose, userProfile, onPostCreated, initialFile }) {
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [mediaPreview, setMediaPreview] = useState(null);
  const [mediaType, setMediaType] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(false);

  const fileInputRef = useRef(null);
  const supabase = createClient();

  useEffect(() => {
    if (isOpen) {
      if (initialFile) {
        setSelectedFile(initialFile);
        const isVideo = initialFile.type.startsWith('video/');
        setMediaType(isVideo ? 'video' : 'image');

        const reader = new FileReader();
        reader.onloadend = () => {
          setMediaPreview(reader.result);
        };
        reader.readAsDataURL(initialFile);
      }
    } else {
      setContent('');
      setMediaPreview(null);
      setMediaType(null);
      setSelectedFile(null);
      setUploadProgress(false);
    }
  }, [isOpen, initialFile]);

  if (!isOpen) return null;

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
    const { data, error } = await supabase.storage
      .from('logbook-media')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });

    setUploadProgress(false);
    if (error) {
      console.error('Storage Upload Error:', error);
      throw error;
    }
    return data.path;
  };

  const handlePost = async (e) => {
    e.preventDefault();
    if (!content.trim() && !selectedFile) {
      alert('Post content or media is required.');
      return;
    }

    setSubmitting(true);
    let mediaPath = null;

    try {
      if (selectedFile) {
        mediaPath = await uploadMedia(selectedFile);
      }

      const postPayload = {
        user_id: userProfile?.id,
        author_id: userProfile?.id,
        content: content.trim(),
        media_url: mediaPath,
        media_type: mediaType || null,
        post_type: 'quick',
        title: null,
        video_url: null,
        excerpt: content.trim().substring(0, 150)
      };

      // Force-inject the current user's session data
      const { data: { user } } = await supabase.auth.getUser();
      if (user) { 
        postPayload.user_id = user.id;
        postPayload.author_id = user.id;
      }

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
        console.error('--- FULL ERROR FORENSICS ---');
        console.error('Error Message:', insertError.message);
        console.error('Error Code:', insertError.code);
        console.error('Error Details:', insertError.details);
        console.error('Error Hint:', insertError.hint);
        console.error('Full Error Object Stringify:', JSON.stringify(insertError, null, 2));
        alert('Failed to save post: ' + (insertError.message || 'Unknown error occurred'));
        return;
      }

      if (onPostCreated && data) {
        onPostCreated(data);
      }
      onClose();
    } catch (err) {
      console.error('Submission failure:', err);
      alert('An error occurred while posting: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm transition-opacity duration-300 animate-fadeIn"
    >
      {/* Modal Wrapper */}
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-auto overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="modal-header flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-white max-sm:relative max-sm:bg-[#1e3a8a] max-sm:text-white max-sm:justify-center max-sm:border-b-0">
          <h3 className="text-lg font-semibold text-gray-900 max-sm:text-white max-sm:absolute max-sm:left-1/2 max-sm:-translate-x-1/2">Create a post</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 transition-colors cursor-pointer max-sm:absolute max-sm:right-5 max-sm:text-white max-sm:hover:bg-blue-800/40"
          >
            <X size={20} />
          </button>
        </div>

        {/* Profile Info */}
        <div className="user-profile-row flex items-center gap-3 px-5 py-4 bg-white max-sm:pl-6">
          {userProfile?.avatar_url ? (
            <img
              src={userProfile.avatar_url}
              alt={userProfile.name}
              className="w-10 h-10 rounded-full object-cover border border-gray-100 shadow-xs"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center shadow-inner">
              <span className="text-xs font-bold text-blue-900">
                {userProfile?.name?.charAt(0) || 'M'}
              </span>
            </div>
          )}
          <div>
            <h4 className="font-semibold text-sm text-gray-800 leading-snug">
              {userProfile?.name || 'Maritime Professional'}
            </h4>
            <div className="flex items-center gap-1 mt-0.5 px-2 py-0.5 bg-gray-50 border border-gray-100 rounded-full text-[10px] font-bold text-gray-500 w-fit">
              <Globe size={10} />
              <span>Anyone</span>
            </div>
          </div>
        </div>

        {/* Input content */}
        <div className="flex-1 overflow-y-auto min-h-[160px] flex flex-col">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="What do you want to talk about?"
            className="w-full text-lg placeholder-gray-400 resize-none outline-none min-h-[150px] p-4 border-0 focus:ring-0 focus:outline-none leading-relaxed flex-1 text-gray-800"
          />

          {/* Media preview */}
          {mediaPreview && (
            <div className="relative mx-4 mb-4 rounded-xl overflow-hidden bg-gray-50 border border-gray-100 max-h-[220px] flex items-center justify-center">
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
                className="absolute top-2.5 right-2.5 p-1.5 bg-black/60 hover:bg-black/80 text-white rounded-full transition-colors cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>
          )}

          {uploadProgress && (
            <div className="mx-4 mb-4 flex items-center gap-2 justify-center text-xs font-semibold text-blue-600 bg-blue-50 py-2.5 rounded-lg border border-blue-100">
              <Loader2 size={14} className="animate-spin" />
              <span>Uploading media path...</span>
            </div>
          )}
        </div>

        {/* Footer Actions / Action Bar */}
        <div className="modal-footer px-4 py-3 flex justify-between items-center bg-gray-50 border-t border-gray-100 max-sm:pr-6">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                if (fileInputRef.current) {
                  fileInputRef.current.accept = 'image/*,video/mp4';
                  fileInputRef.current.click();
                }
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-gray-200/60 rounded-full text-gray-500 hover:text-gray-800 font-medium text-xs transition-all cursor-pointer active:scale-95"
            >
              <ImageIcon size={18} className="text-gray-400" />
              <span>Attach</span>
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          <button
            type="button"
            onClick={handlePost}
            disabled={submitting || uploadProgress || (!content.trim() && !selectedFile)}
            className="post-button bg-[#002b4e] hover:bg-[#003d6e] text-white px-6 py-2 rounded-full font-semibold text-sm transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none cursor-pointer max-sm:px-10 max-sm:min-w-[120px]"
          >
            {submitting ? (
              <div className="flex items-center gap-1.5">
                <Loader2 size={14} className="animate-spin" />
                <span>Posting...</span>
              </div>
            ) : (
              <span>Post</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
