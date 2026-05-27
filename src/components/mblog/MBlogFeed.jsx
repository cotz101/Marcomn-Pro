'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase';
import { useProfile } from '@/app/context/ProfileContext';
import { BookOpen, Calendar, User, ExternalLink, FileText, Play } from 'lucide-react';
import MBlogCard from './MBlogCard';

export default function MBlogFeed({ view, onEdit, searchTerm }) {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();
  const { userId } = useProfile();

  useEffect(() => {
    fetchArticles();
  }, [view, userId]);

  const fetchArticles = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('mblog_articles')
        .select(`
          *,
          author:profiles(name, avatar_url, headline)
        `)
        .order('created_at', { ascending: false });

      if (view === 'my' && userId) {
        query = query.eq('author_id', userId);
      }

      const { data, error } = await query;
      if (error) throw error;
      setArticles(data || []);
    } catch (err) {
      console.error('Error fetching articles:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-6 mt-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="card p-6 animate-pulse border border-gray-100 bg-white">
            <div className="h-8 bg-gray-200 rounded w-3/4 mb-4" />
            <div className="h-4 bg-gray-200 rounded w-1/2 mb-6" />
            <div className="h-48 bg-gray-100 rounded-xl w-full mb-4" />
            <div className="space-y-2">
              <div className="h-3 bg-gray-100 rounded w-full" />
              <div className="h-3 bg-gray-100 rounded w-5/6" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  const filteredArticles = articles.filter(article => {
    if (!searchTerm || !searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    const titleMatch = (article.title || '').toLowerCase().includes(term);
    const contentMatch = (article.content_html || '').toLowerCase().includes(term);
    const authorMatch = (article.author?.name || '').toLowerCase().includes(term);
    return titleMatch || contentMatch || authorMatch;
  });

  if (filteredArticles.length === 0) {
    return (
      <div className="text-center py-20 bg-white border border-gray-100 rounded-xl shadow-sm mt-4">
        <div className="flex justify-center mb-4">
          <BookOpen size={48} className="text-gray-200" />
        </div>
        <h3 className="text-xl font-bold text-[#0e2a4d]">No articles found</h3>
        <p className="text-gray-500 mt-2 max-w-xs mx-auto font-medium">
          {searchTerm ? `No articles matched your search query: "${searchTerm}"` : (view === 'my' ? "You haven't written any articles yet." : "Be the first to share professional insights with the MarComn community.")}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 mt-4 w-full">
      {filteredArticles.map(article => (
        <MBlogCard 
          key={article.id} 
          article={article} 
          userId={userId} 
          isEditable={view === 'my'}
          onEdit={onEdit}
          onDelete={(id) => setArticles(prev => prev.filter(a => a.id !== id))}
        />
      ))}
    </div>
  );
}
