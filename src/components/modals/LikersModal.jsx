'use client';

import React, { useState, useEffect } from 'react';
import { X, Search, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function LikersModal({
  isOpen,
  onClose,
  postId,
  tableName = 'likes',
  foreignKey = 'post_id'
}) {
  const [likers, setLikers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      if (postId) fetchLikers();
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, postId]);

  const fetchLikers = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from(tableName)
        .select(`user_id, profiles(name, avatar_url)`)
        .eq(foreignKey, postId);

      if (error) throw error;
      setLikers(data || []);
    } catch (err) {
      console.error('Error fetching likers:', err);
      setLikers([]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const displayedLikers = searchTerm.trim() !== ''
    ? likers.filter(like => {
        const name = like.profiles?.name || '';
        return name.toLowerCase().includes(searchTerm.toLowerCase());
      })
    : likers;

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200"
      style={{ boxSizing: 'border-box' }}
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-2xl shadow-2xl w-full max-w-xl mx-auto overflow-hidden flex flex-col animate-in zoom-in-95 duration-200 border border-gray-100"
        style={{ boxSizing: 'border-box' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Navy Header */}
        <div className="h-14 bg-[#0e2a4d] flex items-center justify-between px-4 relative flex-shrink-0 w-full">
          <div className="flex-1 text-center">
            <h3 className="text-white text-base font-bold tracking-wide font-sans select-none">
              Likes
            </h3>
          </div>
          <button 
            onClick={onClose}
            className="absolute right-3 p-1.5 rounded-full text-white/80 hover:text-white hover:bg-white/10 active:scale-95 transition-all outline-none focus:outline-none"
          >
            <X size={18} />
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative border-b border-gray-100 bg-gray-50/50 flex-shrink-0 flex items-center px-3 w-full block">
          <Search size={14} className="text-gray-400 mr-2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search who liked..."
            className="w-full py-3 bg-transparent placeholder-gray-400 text-sm text-gray-800 focus:outline-none outline-none font-sans"
          />
          {searchTerm && (
            <button 
              onClick={() => setSearchTerm('')}
              className="text-gray-400 hover:text-gray-600 p-0.5 rounded-full"
            >
              <X size={12} />
            </button>
          )}
        </div>

        {/* List & Avatar Row */}
        <div className="px-4 py-3 max-h-[320px] overflow-y-auto min-h-[120px] flex-1 space-y-2 w-full block">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-10 space-y-3">
              <Loader2 className="w-6 h-6 animate-spin text-[#0e2a4d]" />
              <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Loading...</span>
            </div>
          ) : displayedLikers.length > 0 ? (
            displayedLikers.map((like, index) => {
              const avatar = like.profiles?.avatar_url;
              const name = like.profiles?.name || 'Anonymous';
              const uniqueKey = like.user_id || index;

              return (
                <div 
                  key={uniqueKey}
                  className="rounded-lg hover:bg-gray-50 p-3 flex items-center justify-between gap-3 transition-colors font-sans w-full"
                >
                  <div className="flex items-center gap-3">
                    {avatar ? (
                      <img
                        src={avatar}
                        alt={name}
                        className="w-10 h-10 rounded-full border border-gray-200 object-cover flex-shrink-0 shadow-sm"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center shadow-inner text-blue-900 font-extrabold text-sm flex-shrink-0">
                        {name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span className="text-sm font-bold text-gray-900 truncate">
                      {name}
                    </span>
                  </div>
                  
                  <button 
                    onClick={() => {
                      onClose();
                      router.push(`/profile/${like.user_id}`);
                    }}
                    className="text-[10px] text-blue-600 font-bold uppercase tracking-wide hover:bg-blue-50 px-3 py-1.5 rounded-full transition-colors whitespace-nowrap"
                  >
                    View Profile
                  </button>
                </div>
              );
            })
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-gray-400 text-xs font-semibold font-sans">
              No likes match your search.
            </div>
          )}
        </div>

        {/* Footer CTA */}
        <div className="flex justify-center w-full mt-4 pb-2 pt-4 border-t border-gray-100 bg-gray-50/30 flex-shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-bold transition-all cursor-pointer font-sans active:scale-95 outline-none focus:outline-none"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
