'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { User, Calendar, ExternalLink, FileText, Play, ChevronDown, ChevronUp, Pencil, Paperclip, Share2, X, Check, Trash2, AlertTriangle } from 'lucide-react';
import { useProfile } from '@/app/context/ProfileContext';
import { createClient } from '@/lib/supabase';
import DOMPurify from 'dompurify';

export default function MBlogCard({ article, userId, isEditable, onEdit, onDelete }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [showShareConfirm, setShowShareConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { showToast } = useProfile();
  const cardRef = useRef(null);
  const supabase = createClient();
  const searchParams = useSearchParams();

  useEffect(() => {
    const articleIdParam = searchParams.get('articleId');
    if (articleIdParam === article.id && cardRef.current) {
      setTimeout(() => {
        cardRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        cardRef.current.classList.add('ring-2', 'ring-blue-500', 'ring-offset-4');
        setTimeout(() => {
          cardRef.current.classList.remove('ring-2', 'ring-blue-500', 'ring-offset-4');
        }, 3000);
      }, 500);
    }
  }, [searchParams, article.id]);

  useEffect(() => {
    setMounted(true);
  }, []);

  const getRelativeTime = (dateString) => {
    const now = new Date();
    const past = new Date(dateString);
    const diffInMs = now - past;
    const diffInSecs = Math.floor(diffInMs / 1000);
    const diffInMins = Math.floor(diffInSecs / 60);
    const diffInHours = Math.floor(diffInMins / 60);
    const diffInDays = Math.floor(diffInHours / 24);

    if (diffInSecs < 60) return 'Just now';
    if (diffInMins < 60) return `${diffInMins}m ago`;
    if (diffInHours < 24) return `${diffInHours}h ago`;
    if (diffInDays < 7) return `${diffInDays}d ago`;
    return past.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const getPlainText = (html) => {
    if (!html) return '';
    if (typeof window === 'undefined') return '';
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    return tempDiv.textContent || tempDiv.innerText || '';
  };

  const truncateHtmlWithTags = (html, limit) => {
    if (!html) return '';
    if (typeof window === 'undefined') return html; // SSR Fallback
    
    // Create a temporary div to parse HTML
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    
    // Helper to find the first two paragraphs or hit a character limit
    const getSmartBreakpoint = (text, charLimit) => {
      // Find sentence endings
      const sentenceRegex = /[^.!?]+[.!?](\s|$)/g;
      let match;
      let lastIndex = 0;
      
      while ((match = sentenceRegex.exec(text)) !== null) {
        lastIndex = sentenceRegex.lastIndex;
        // Break at or around the character limit
        if (lastIndex >= charLimit) break;
      }
      
      // Fallback: find nearest word break around charLimit
      if (lastIndex === 0 || lastIndex < charLimit * 0.5) {
        const beforeLimit = text.lastIndexOf(' ', charLimit);
        return beforeLimit > 0 ? beforeLimit : charLimit;
      }
      
      return lastIndex;
    };

    const plainText = tempDiv.textContent || tempDiv.innerText || '';
    const smartLimit = getSmartBreakpoint(plainText, limit);

    if (plainText.length <= smartLimit) return html;

    let currentLength = 0;
    let resultHtml = '';
    let isTruncated = false;

    const traverse = (node) => {
      if (isTruncated) return;

      if (node.nodeType === 3) { // Node.TEXT_NODE
        const remaining = smartLimit - currentLength;
        if (node.textContent.length > remaining) {
          resultHtml += node.textContent.substring(0, remaining).trim();
          currentLength = smartLimit;
          isTruncated = true;
        } else {
          resultHtml += node.textContent;
          currentLength += node.textContent.length;
        }
      } else if (node.nodeType === 1) { // Node.ELEMENT_NODE
        const tagName = node.tagName.toLowerCase();
        resultHtml += `<${tagName}${Array.from(node.attributes).map(attr => ` ${attr.name}="${attr.value}"`).join('')}>`;
        
        for (const child of node.childNodes) {
          traverse(child);
          if (isTruncated) break;
        }
        
        resultHtml += `</${tagName}>`;
      }
    };

    for (const child of tempDiv.childNodes) {
      traverse(child);
      if (isTruncated) break;
    }
    return isTruncated ? resultHtml + '...' : resultHtml;
  };

  const handleShare = async () => {
    if (!userId || isSharing) return;
    
    setIsSharing(true);
    try {
      const { error } = await supabase
        .from('posts')
        .insert({
          user_id: userId,
          shared_article_id: article.id,
          content: `Check out this blog post: ${article.title}`,
          media_type: 'article_share'
        });

      if (error) throw error;
      showToast('Successfully shared to Logbook!', 'success');
      setShowShareConfirm(false);
    } catch (err) {
      console.error('Error sharing to Logbook:', err);
      showToast('Failed to share to Logbook.', 'error');
    } finally {
      setIsSharing(false);
    }
  };

  const handleDelete = async () => {
    if (!userId || isDeleting) return;
    
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('mblog_articles')
        .delete()
        .eq('id', article.id);

      if (error) throw error;
      
      showToast('Article deleted successfully', 'success');
      onDelete?.(article.id);
      setShowDeleteConfirm(false);
    } catch (err) {
      console.error('Error deleting article:', err);
      showToast('Failed to delete article.', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const contentLimit = 300;
  const plainText = getPlainText(article.content_html || '');
  const shouldTruncate = plainText.length > contentLimit;

  return (
    <div 
      className="card p-0 overflow-hidden hover:shadow-md transition-shadow border border-gray-100 bg-white" 
      ref={cardRef}
    >
      <div className="p-6 relative">
        {/* HIERARCHY: TITLE FIRST */}
        <div className="flex justify-between items-start gap-4 mb-3">
          <h2 className="text-2xl font-bold text-[#0e2a4d] leading-tight hover:text-[#004173] transition-colors flex-1">
            {article.title}
          </h2>
          
          {isEditable && (
            <div className="flex items-center gap-2">
              <button 
                onClick={() => onEdit?.(article)}
                className="p-2 bg-gray-50 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-all active:scale-90 border border-transparent hover:border-blue-100"
                title="Edit Article"
              >
                <Pencil size={18} />
              </button>
              <button 
                onClick={() => setShowDeleteConfirm(true)}
                className="p-2 bg-gray-50 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-all active:scale-90 border border-transparent hover:border-red-100"
                title="Delete Article"
              >
                <Trash2 size={18} />
              </button>
            </div>
          )}
        </div>

        {/* METADATA SECOND */}
        <div className="flex items-center gap-4 text-xs text-gray-500 mb-6">
          <div className="flex items-center gap-2">
            {article.author?.avatar_url ? (
              <img src={article.author.avatar_url} className="w-6 h-6 rounded-full object-cover border border-gray-100" alt="" />
            ) : (
              <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center border border-gray-100">
                <User size={12} className="text-gray-400" />
              </div>
            )}
            <span className="font-bold text-gray-700">{article.author?.name || 'Anonymous'}</span>
          </div>
          <div className="flex items-center gap-1.5 text-gray-400">
            <Calendar size={14} />
            <span className="font-medium">{getRelativeTime(article.created_at)}</span>
          </div>
        </div>

        {/* MEDIA THIRD - IMAGE FIRST IN CONTENT AREA */}
        {article.media_url && (
          <div className="mb-6 rounded-xl overflow-hidden bg-gray-50 border border-gray-50 shadow-inner">
            <img 
              src={article.media_url} 
              alt={article.title} 
              className="w-full max-h-[400px] object-cover hover:scale-[1.02] transition-transform duration-700" 
            />
          </div>
        )}

        {/* CONTENT FOURTH */}
        <div className="mblog-content-wrapper">
          <div 
            className="rich-text text-gray-600 leading-relaxed text-[15px]"
            dangerouslySetInnerHTML={{ 
              __html: DOMPurify.sanitize(
                isExpanded 
                  ? (article.content_html || '') 
                  : truncateHtmlWithTags(article.content_html || '', contentLimit)
              ) 
            }}
          />
          
          {shouldTruncate && (
            <button 
              onClick={() => setIsExpanded(!isExpanded)}
              className="mt-3 flex items-center gap-2 text-sm font-bold text-[#004173] hover:text-[#0e2a4d] transition-colors py-2 px-4 rounded-lg bg-blue-50 hover:bg-blue-100 w-fit"
            >
              {isExpanded ? (
                <>Show less <ChevronUp size={16} /></>
              ) : (
                <>Read full blog <ChevronDown size={16} /></>
              )}
            </button>
          )}
        </div>

        {/* FOOTER ACTIONS / BADGES */}
        <div className="flex items-center gap-3 mt-6 pt-4 border-t border-gray-50 empty:hidden">
          {article.pdf_url && (
            <a 
              href={article.pdf_url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-[10px] font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-100 hover:bg-blue-100 transition-colors"
            >
              <Paperclip size={12} />
              DOCUMENT
            </a>
          )}
          {article.youtube_id && (
            <a 
              href={`https://www.youtube.com/watch?v=${article.youtube_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-[10px] font-bold text-red-600 bg-red-50 px-2.5 py-1 rounded-full border border-red-100 hover:bg-red-100 transition-colors"
            >
              <Play size={12} />
              VIDEO
            </a>
          )}
          
          {isEditable && (
            <button 
              onClick={() => setShowShareConfirm(true)}
              disabled={isSharing}
              className={`ml-auto flex items-center gap-1.5 text-[10px] font-bold py-1 px-3 rounded-full border transition-all active:scale-95 ${
                isSharing 
                  ? 'bg-gray-50 text-gray-400 border-gray-100' 
                  : 'bg-green-50 text-green-600 border-green-100 hover:bg-green-100'
              }`}
            >
              <Share2 size={12} className={isSharing ? 'animate-pulse' : ''} />
              {isSharing ? 'SHARING...' : 'SHARE TO LOGBOOK'}
            </button>
          )}
        </div>
      </div>

      {/* Confirmation Dialog Overlay */}
      {showShareConfirm && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 animate-in zoom-in-95 duration-200">
            <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center mb-4 mx-auto">
              <Share2 size={24} className="text-[#002b4e]" />
            </div>
            <h3 className="text-lg font-bold text-center text-[#0e2a4d] mb-2">Share to Logbook?</h3>
            <p className="text-gray-500 text-center text-sm mb-6">
              This article will be posted to your Logbook feed for your connections to see.
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => setShowShareConfirm(false)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-bold text-sm hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleShare}
                disabled={isSharing}
                className="flex-1 py-2.5 rounded-xl bg-[#002b4e] text-white font-bold text-sm hover:bg-[#004173] transition-colors flex items-center justify-center gap-2"
              >
                {isSharing ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Check size={16} />
                )}
                Confirm Share
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Overlay */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 animate-in zoom-in-95 duration-200">
            <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mb-4 mx-auto">
              <AlertTriangle size={24} className="text-red-600" />
            </div>
            <h3 className="text-lg font-bold text-center text-[#0e2a4d] mb-2">Delete Article?</h3>
            <p className="text-gray-500 text-center text-sm mb-6">
              Are you sure you want to permanently delete this article? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-bold text-sm hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex-1 py-2.5 rounded-xl bg-red-600 text-white font-bold text-sm hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
              >
                {isDeleting ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Trash2 size={16} />
                )}
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
