'use client';

import { useState, useRef, useEffect } from 'react';
import { createClient } from '@/lib/supabase';
import { useProfile } from '@/app/context/ProfileContext';
import { X, Image as ImageIcon, FileText, Play, Upload, CheckCircle, Paperclip } from 'lucide-react';
import RichTextEditor from '@/src/components/common/RichTextEditor';
import { extractYouTubeId } from '@/src/lib/youtubeUtils';


export default function MBlogComposer({ onClose, onArticleCreated, initialData }) {
  const [title, setTitle] = useState('');
  const [contentHtml, setContentHtml] = useState('');
  const [youtubeId, setYoutubeId] = useState('');
  const [mediaFile, setMediaFile] = useState(null);
  const [mediaPreview, setMediaPreview] = useState(null);
  const [pdfFile, setPdfFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);

  const mediaInputRef = useRef(null);
  const pdfInputRef = useRef(null);
  const { userId } = useProfile();
  const supabase = createClient();

  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title || '');
      setContentHtml(initialData.content_html || '');
      setYoutubeId(extractYouTubeId(initialData.youtube_id) || initialData.youtube_id || '');
      if (initialData.media_url) {
        setMediaPreview(initialData.media_url);
      }
    }
  }, [initialData]);

  const handleMediaChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setMediaFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setMediaPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePdfChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setPdfFile(file);
    }
  };

  const uploadFile = async (file, folder) => {
    if (!file) return null;
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
    const filePath = `${folder}/${userId}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('mblog')
      .upload(filePath, file);

    if (uploadError) {
      console.error(`Storage Upload Error (Bucket: mblog, Path: ${filePath}):`, uploadError);
      throw uploadError;
    }

    const { data } = supabase.storage.from('mblog').getPublicUrl(filePath);
    return data.publicUrl;
  };

  const isContentEmpty = (html) => {
    if (!html) return true;
    const div = document.createElement('div');
    div.innerHTML = html;
    return !div.textContent.trim();
  };

  const handleSubmit = async () => {
    if (!title.trim() || isContentEmpty(contentHtml) || submitting) return;

    setSubmitting(true);
    setUploadProgress('Uploading assets...');

    try {
      let mediaUrl = null;
      let pdfUrl = null;

      if (mediaFile) {
        mediaUrl = await uploadFile(mediaFile, 'images');
      }

      if (pdfFile) {
        pdfUrl = await uploadFile(pdfFile, 'pdfs');
      }

      let result;
      if (initialData?.id) {
        // UPDATE Existing
        result = await supabase
          .from('mblog_articles')
          .update({
            title: title.trim(),
            content_html: contentHtml,
            media_url: mediaUrl || initialData.media_url,
            pdf_url: pdfUrl || initialData.pdf_url,
            youtube_id: youtubeId.trim() || null
          })
          .eq('id', initialData.id)
          .select(`
            *,
            author:profiles(name, avatar_url, headline)
          `)
          .single();
      } else {
        // CREATE New
        result = await supabase
          .from('mblog_articles')
          .insert({
            author_id: userId,
            title: title.trim(),
            content_html: contentHtml,
            media_url: mediaUrl,
            pdf_url: pdfUrl,
            youtube_id: youtubeId.trim() || null
          })
          .select(`
            *,
            author:profiles(name, avatar_url, headline)
          `)
          .single();
      }

      const { data, error } = result;

      if (error) throw error;

      if (onArticleCreated) {
        onArticleCreated(data);
      }
      onClose();
    } catch (err) {
      console.error('Submission Error:', err);
      alert(`Failed to ${initialData ? 'update' : 'publish'} article: ` + err.message);
    } finally {
      setSubmitting(false);
      setUploadProgress(null);
    }
  };

    const canPublish = title.trim() && !isContentEmpty(contentHtml) && !submitting;

    return (
      <div className="article-editor-overlay w-full overflow-x-hidden" onClick={onClose}>
        <div className="article-editor-container" onClick={e => e.stopPropagation()}>
          <div className="article-editor-header flex-wrap px-3 sm:px-6">
            <div className="flex items-center gap-4">
              <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors" onClick={onClose}>
                <X size={24} />
              </button>
              <h2 className="font-bold text-xl text-[#0e2a4d]">
                {initialData ? 'Edit Article' : 'Create New Article'}
              </h2>
            </div>
  
            <div className="flex items-center flex-wrap gap-2 sm:gap-4">
              {uploadProgress && (
                <span className="text-sm text-blue-600 font-medium animate-pulse mr-2">{uploadProgress}</span>
              )}
              <button 
                className="px-8 py-2 rounded-lg font-bold text-gray-500 hover:bg-gray-50 transition-all active:scale-95 border border-gray-200"
                onClick={onClose}
              >
                Cancel
              </button>
              <button 
                className="bg-[#002b4e] text-white px-8 py-2 rounded-lg font-bold shrink-0 disabled:opacity-50 transition-all active:scale-95 shadow-lg shadow-blue-900/10"
                onClick={handleSubmit}
                disabled={!canPublish}
              >
                {submitting 
                  ? (initialData ? 'Updating...' : 'Publishing...') 
                  : (initialData ? 'Save Changes' : 'Publish Article')
                }
              </button>
            </div>
          </div>

        <div className="article-editor-content">
          {/* Cover Media Section */}
          <div className="article-cover-upload group" onClick={() => mediaInputRef.current.click()}>
            {mediaPreview ? (
              <div className="relative w-full h-full">
                <img src={mediaPreview} alt="Preview" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                  <span className="text-white font-bold flex items-center gap-2">
                    <Upload size={20} /> Change Cover
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center text-gray-400">
                <ImageIcon size={48} strokeWidth={1.5} />
                <p className="mt-4 font-medium">Add a featured image or video cover</p>
                <p className="text-xs mt-1">Recommended: 1200x630px</p>
              </div>
            )}
            <input 
              type="file" 
              ref={mediaInputRef} 
              className="hidden" 
              accept="image/*,video/*"
              onChange={handleMediaChange}
            />
          </div>

          {/* Title Section */}
          <input 
            type="text" 
            className="article-title-input" 
            placeholder="Article Title"
            value={title}
            onChange={e => setTitle(e.target.value)}
          />

          {/* Editor Section */}
          <div className="quill-wrapper mb-8">
            <RichTextEditor 
              value={contentHtml}
              onChange={setContentHtml}
              placeholder="Write your professional insights here..."
              className="article-body-editor"
            />
          </div>

          {/* Meta Inputs Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-8 border-t border-gray-100">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-gray-500 tracking-wider flex items-center gap-2">
                <Paperclip size={14} /> Document Attachment
              </label>
              <div 
                className={`p-4 border-2 border-dashed rounded-xl flex items-center justify-between cursor-pointer transition-colors ${pdfFile ? 'border-green-200 bg-green-50' : 'border-gray-200 hover:border-blue-300'}`}
                onClick={() => pdfInputRef.current.click()}
              >
                <div className="flex items-center gap-3">
                  {pdfFile ? <CheckCircle size={20} className="text-green-500" /> : <Upload size={20} className="text-gray-400" />}
                  <span className="text-sm font-medium text-gray-700 truncate max-w-[150px]">
                    {pdfFile ? pdfFile.name : (initialData?.pdf_url ? 'Change Document' : 'Upload Document')}
                  </span>
                </div>
                <button type="button" className="text-xs font-bold text-blue-600">Browse</button>
              </div>
              <input 
                type="file" 
                ref={pdfInputRef} 
                className="hidden" 
                accept=".pdf"
                onChange={handlePdfChange}
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-gray-500 tracking-wider block">
                Video Integration
              </label>
                <input 
                  type="text" 
                  placeholder="Paste video URL here (YouTube, Vimeo, etc.)"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  value={youtubeId || ""}
                  onChange={e => setYoutubeId(extractYouTubeId(e.target.value))}
                />
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .article-body-editor :global(.ql-editor) {
          min-height: 400px;
          font-size: 18px;
          line-height: 1.8;
          color: #2d3748;
        }
      `}</style>
    </div>
  );
}
