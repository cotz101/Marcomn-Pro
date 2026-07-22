'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import MBlogFeed from '@/src/components/mblog/MBlogFeed';
import MBlogComposer from '@/src/components/mblog/MBlogComposer';
import { SquarePen, Search, Plus } from 'lucide-react';

function MBlogPageContent() {
  const [view, setView] = useState('all'); // 'all' or 'my'
  const [showComposer, setShowComposer] = useState(false);
  const [editingArticle, setEditingArticle] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [toast, setToast] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const searchParams = useSearchParams();

  useEffect(() => {
    const viewParam = searchParams.get('view');
    if (viewParam === 'all' || viewParam === 'my') {
      setView(viewParam);
    } else if (viewParam) {
      // Gracefully default back to 'all' if invalid or removed view (like drafts) is requested
      setView('all');
    }

    if (searchParams.get('compose') === 'true') {
      setShowComposer(true);
    }
  }, [searchParams]);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleArticleCreated = () => {
    setRefreshKey(prev => prev + 1);
    setEditingArticle(null);
    setView('all'); // Redirect to 'All MBlogs' as requested
    showToast(editingArticle ? 'MBlog updated successfully!' : 'MBlog published successfully!');
  };

  const handleEdit = (article) => {
    setEditingArticle(article);
    setShowComposer(true);
  };

  return (
    <div className="mblog-shell w-full max-w-full min-h-screen">
      {/* Header Container Wrapper */}
      <div className="mblog-header-container">
        {/* Header Area */}
        <div className="mblog-header flex justify-between items-center w-full">
          <div className="flex flex-col flex-1 min-w-0 mr-4">
            <h1 className="text-2xl font-bold text-[#0e2a4d] m-0">MBlogs</h1>
            <p className="text-sm text-gray-500 font-medium mblog-header-sub">Maritime industry MBlogs and updates</p>
          </div>
          <button 
            onClick={() => setShowComposer(true)}
            className="mblog-header-post-btn flex items-center gap-2 px-4 py-2 bg-[#002b4e] text-white rounded-lg font-bold text-sm hover:bg-[#001f38] transition-all shadow-sm border-none cursor-pointer whitespace-nowrap"
          >
            <Plus size={18} />
            <span>Post a MBlog</span>
          </button>
        </div>
      </div>

      {/* MBlog Search Bar Container (Sibling to Header for perfect independent sticky behavior) */}
      <div className="mblog-search-container flex items-center justify-between gap-4 w-full relative">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-5 top-[50%] -translate-y-1/2 text-[#9ca3af] pointer-events-none flex items-center justify-center h-5 w-5" size={20} />
          <input 
            type="text" 
            placeholder="Search MBlogs by title, content, or author..." 
            className="search-input w-full pl-12 pr-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm outline-none bg-white"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="tabs-header !mb-0 !rounded-b-none !border-b-0">
        <button 
          onClick={() => setView('all')}
          className={`tab-btn ${view === 'all' ? 'active' : ''}`}
        >
          All MBlogs
        </button>
        <button 
          onClick={() => setView('my')}
          className={`tab-btn ${view === 'my' ? 'active' : ''}`}
        >
          My MBlogs
        </button>
      </div>

      {/* Feed Content */}
      <div className="tabs-content !p-0 !bg-transparent !border-none">
        <MBlogFeed 
          key={`${view}-${refreshKey}`} 
          view={view} 
          onEdit={handleEdit}
          searchTerm={searchTerm}
        />
      </div>

      {/* Composer Modal */}
      {showComposer && (
        <MBlogComposer 
          onClose={() => {
            setShowComposer(false);
            setEditingArticle(null);
          }} 
          onArticleCreated={handleArticleCreated}
          initialData={editingArticle}
        />
      )}

      {/* Toast Notification */}
      {toast && (
        <div className={`fixed bottom-24 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-6 py-3 rounded-xl shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-300 ${
          toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-[#0e2a4d] text-white'
        }`}>
          <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center">
            <span className="text-xs">✓</span>
          </div>
          <span className="font-bold text-sm tracking-wide">{toast.message}</span>
        </div>
      )}
    </div>
  );
}

export default function MBlogPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <MBlogPageContent />
    </Suspense>
  );
}
