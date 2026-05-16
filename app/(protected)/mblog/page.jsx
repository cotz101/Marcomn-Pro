'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import MBlogFeed from '@/src/components/mblog/MBlogFeed';
import MBlogComposer from '@/src/components/mblog/MBlogComposer';
import { SquarePen } from 'lucide-react';

function MBlogPageContent() {
  const [view, setView] = useState('all'); // 'all' or 'my'
  const [showComposer, setShowComposer] = useState(false);
  const [editingArticle, setEditingArticle] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [toast, setToast] = useState(null);
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
    setView('all'); // Redirect to 'All Articles' as requested
    showToast(editingArticle ? 'Article updated successfully!' : 'Article published successfully!');
  };

  const handleEdit = (article) => {
    setEditingArticle(article);
    setShowComposer(true);
  };

  return (
    <div className="mblog-shell w-full max-w-full min-h-screen">
      {/* Header Area */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex flex-col">
          <h1 className="text-2xl font-bold text-[#0e2a4d]">Maritime Blog</h1>
          <p className="text-sm text-gray-500 font-medium">Professional insights and technical articles from the industry</p>
        </div>
        <button 
          onClick={() => setShowComposer(true)}
          className="text-[#002b4e] hover:text-[#004173] transition-all active:scale-95 p-2"
          title="Post a Blog"
        >
          <SquarePen size={28} />
        </button>
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="tabs-header !mb-0 !rounded-b-none !border-b-0">
        <button 
          onClick={() => setView('all')}
          className={`tab-btn ${view === 'all' ? 'active' : ''}`}
        >
          All Articles
        </button>
        <button 
          onClick={() => setView('my')}
          className={`tab-btn ${view === 'my' ? 'active' : ''}`}
        >
          My Articles
        </button>
      </div>

      {/* Feed Content */}
      <div className="tabs-content !p-0 !bg-transparent !border-none">
        <MBlogFeed 
          key={`${view}-${refreshKey}`} 
          view={view} 
          onEdit={handleEdit}
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
