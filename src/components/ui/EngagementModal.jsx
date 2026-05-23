'use client';

import React, { useState, useEffect } from 'react';
import { X, Search } from 'lucide-react';

export default function EngagementModal({
  isOpen,
  onClose,
  title = 'Likes',
  data = [],
  searchPlaceholder = 'Search users...',
  emptyMessage = 'No users found.'
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [defaultItems, setDefaultItems] = useState([]);

  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  // Pick 5 random profiles once upon opening if list is long (> 5 items)
  useEffect(() => {
    if (isOpen && data.length > 5) {
      const shuffled = [...data].sort(() => 0.5 - Math.random());
      setDefaultItems(shuffled.slice(0, 5));
    } else {
      setDefaultItems(data || []);
    }
    // Reset search query on close or open
    setSearchTerm('');
  }, [isOpen, data]);

  if (!isOpen) return null;

  // Filter full dataset based on search term
  const displayedItems = searchTerm.trim() !== ''
    ? data.filter(item => {
        const name = item.profiles?.name || item.name || '';
        return name.toLowerCase().includes(searchTerm.toLowerCase());
      })
    : defaultItems;

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
        {/* 1. The Navy Header */}
        <div className="h-14 bg-[#0e2a4d] flex items-center justify-between px-4 relative flex-shrink-0 w-full">
          <div className="flex-1 text-center">
            <h3 className="text-white text-base font-bold tracking-wide font-sans select-none">
              {title}
            </h3>
          </div>
          <button 
            onClick={onClose}
            className="absolute right-3 p-1.5 rounded-full text-white/80 hover:text-white hover:bg-white/10 active:scale-95 transition-all outline-none focus:outline-none"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* 2. The Search Bar - Separate block row below the header */}
        <div className="relative border-b border-gray-100 bg-gray-50/50 flex-shrink-0 flex items-center px-3 w-full block">
          <Search size={14} className="text-gray-400 mr-2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={searchPlaceholder}
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

        {/* 3. The List & Avatar Row */}
        <div className="p-3 max-h-[320px] overflow-y-auto min-h-[120px] flex-1 space-y-1 w-full block">
          {displayedItems.length > 0 ? (
            displayedItems.map((like, index) => {
              const avatar = like.profiles?.avatar_url || like.avatar_url;
              const uniqueKey = like.user_id || like.id || index;

              return (
                <div 
                  key={uniqueKey}
                  className="rounded-lg hover:bg-gray-50 p-2 flex items-center gap-3 transition-colors font-sans w-full"
                >
                  {/* Avatar */}
                  {avatar ? (
                    <img
                      src={avatar}
                      alt={like.profiles?.name || 'User'}
                      className="w-10 h-10 rounded-full border border-gray-250 object-cover flex-shrink-0 shadow-xs"
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.nextSibling.style.display = 'flex';
                      }}
                    />
                  ) : null}
                  <div
                    className="w-10 h-10 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center shadow-inner text-blue-900 font-extrabold text-sm flex-shrink-0"
                    style={{ display: avatar ? 'none' : 'flex' }}
                  >
                    {(like.profiles?.name || 'Anonymous').charAt(0).toUpperCase()}
                  </div>

                  {/* Name */}
                  <div className="flex-1 min-w-0">
                    <span className="block text-sm font-bold text-gray-900 font-sans truncate">
                      {like.profiles?.name || 'Anonymous'}
                    </span>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-gray-400 text-xs font-semibold font-sans">
              <span>{emptyMessage}</span>
            </div>
          )}
        </div>

        {/* Footer CTA */}
        <div className="p-3 border-t border-gray-100 bg-gray-50/30 flex justify-end flex-shrink-0 w-full">
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
