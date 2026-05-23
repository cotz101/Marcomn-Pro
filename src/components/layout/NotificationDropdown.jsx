'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { X, Newspaper, Users, Briefcase, Bell } from 'lucide-react';

const markAsRead = async (notificationId) => {
  try {
    const supabase = createClient();
    await supabase.from('notifications').update({ is_read: true }).eq('id', notificationId);
  } catch (err) {
    console.error('DEBUG: Mark as read error:', err);
  }
};

export default function NotificationDropdown({ 
  notifications = [], 
  loading = false, 
  onMarkAllAsRead, 
  onClose,
  setNotifications,
  fetchNotifications
}) {
  // Realtime subscription is handled by AppShell (parent) which owns the
  // notifications state and unreadCount for the bell badge.

  const router = useRouter();

  const unreadCount = notifications.filter(n => !n.is_read).length;

  // Feed-Centric Notification Handler
  // Instead of navigating to dead /logbook/[id] routes, we route to the
  // feed with a ?focus= query param so LogbookFeed can scroll-to-post.
  const handleNotificationAction = (notification) => {
    if (!notification.link) return;

    // Mention notifications: route to feed with focus param
    if (notification.type === 'mention' && notification.link.startsWith('/logbook/')) {
      const postId = notification.link.replace('/logbook/', '');
      router.push('/logbook?focus=' + postId);
      return;
    }

    // All other notification types: use link as-is (messages, connections, etc.)
    router.push(notification.link);
  };

  const formatTimeAgo = (dateString) => {
    if (!dateString) return '';
    try {
      const now = new Date();
      const date = new Date(dateString);
      const diffMs = now - date;
      const diffSec = Math.floor(diffMs / 1000);
      const diffMin = Math.floor(diffSec / 60);
      const diffHr = Math.floor(diffMin / 60);
      const diffDays = Math.floor(diffHr / 24);

      if (diffSec < 10) return 'just now';
      if (diffSec < 60) return `${diffSec}s ago`;
      if (diffMin < 60) return `${diffMin}m ago`;
      if (diffHr < 24) return `${diffHr}h ago`;
      return `${diffDays}d ago`;
    } catch (e) {
      return '';
    }
  };

  const renderAvatar = (notification) => {
    // Graceful default if sender profile reference is missing or null
    const hasAvatar = notification.sender && notification.sender.avatar_url;
    
    if (hasAvatar) {
      return (
        <img 
          src={notification.sender.avatar_url} 
          alt="" 
          className="w-10 h-10 rounded-full object-cover border border-gray-100 shadow-sm"
          onError={(e) => {
            // Fallback dynamically if the avatar image fails to load (broken link)
            e.target.style.display = 'none';
            const parent = e.target.parentElement;
            if (parent) {
              const fallback = document.createElement('div');
              fallback.className = "w-10 h-10 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center shadow-sm font-bold text-sm";
              fallback.innerText = notification.sender?.name ? notification.sender.name.charAt(0).toUpperCase() : (notification.title ? notification.title.charAt(0).toUpperCase() : 'N');
              parent.appendChild(fallback);
            }
          }}
        />
      );
    }

    // Default icon or placeholder character badge
    const char = notification.sender?.name 
      ? notification.sender.name.charAt(0).toUpperCase() 
      : (notification.title ? notification.title.charAt(0).toUpperCase() : 'N');

    return (
      <div className={`w-10 h-10 rounded-full flex items-center justify-center shadow-sm border font-bold text-sm shrink-0 ${
        notification.type === 'mblog' ? 'bg-emerald-50 border-emerald-100 text-emerald-600' :
        notification.type === 'group' ? 'bg-amber-50 border-amber-100 text-amber-600' :
        'bg-blue-50 border-blue-100 text-blue-600'
      }`}>
        {notification.type === 'message' ? char : (
          notification.type === 'mblog' ? <Newspaper size={18} /> :
          notification.type === 'group' ? <Users size={18} /> :
          notification.type === 'milestone' ? <Briefcase size={18} /> :
          char
        )}
      </div>
    );
  };

  const renderNotificationCards = () => {
    if (loading) {
      return (
        <div className="p-8 text-center text-gray-400 text-xs flex flex-col items-center gap-2 justify-center">
          <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <span>Loading notifications...</span>
        </div>
      );
    }

    if (notifications.length === 0) {
      return (
        <div className="p-8 text-center text-gray-400 text-xs">
          No notifications yet.
        </div>
      );
    }

    return notifications.map((notification) => {
      const isMilestone = notification.type === 'milestone';
      const isRead = notification.is_read;
      
      return (
        <div 
          key={notification.id}
          className={`p-4 transition-all duration-150 flex gap-3 items-start border-b border-gray-50 last:border-b-0 cursor-pointer ${
            isMilestone && !isRead ? 'bg-blue-50/40 hover:bg-blue-50/60 border-l-4 border-blue-500' : ''
          } ${isRead ? 'opacity-60 hover:opacity-80 bg-gray-50/40' : 'hover:bg-slate-50/80'}`}
          onClick={async (e) => {
            e.stopPropagation();
            
            // 1. Optimistic Update: Update the local state immediately
            if (setNotifications) {
              setNotifications(prev => prev.map(n => 
                n.id === notification.id ? { ...n, is_read: true } : n
              ));
            }

            // 2. Database Sync: Mark as read in Supabase
            await markAsRead(notification.id);

            // 3. Navigation: Move to the post/profile
            handleNotificationAction(notification);
            
            if (onClose) onClose();
          }}
        >
          {/* Left Side: Avatar or Icon */}
          <div className="relative shrink-0">
            {renderAvatar(notification)}
          </div>

          {/* Middle Content */}
          <div className="flex-1 min-w-0">
            <div className="flex justify-between items-start gap-2 mb-1">
              <span className={`text-xs font-semibold truncate ${isRead ? 'text-gray-500' : 'text-gray-900'}`}>
                {notification.title}
              </span>
              <span className={`text-[10px] font-medium whitespace-nowrap ${isRead ? 'text-gray-400' : 'text-blue-500'}`}>
                {formatTimeAgo(notification.created_at)}
              </span>
            </div>
            <p className={`text-xs font-medium leading-relaxed break-words line-clamp-2 ${isRead ? 'text-gray-400' : 'text-gray-600'}`}>
              {notification.body}
            </p>
          </div>

          {/* Right Side: Unread Dot Indicator */}
          {!isRead && (
            <div 
              className="w-2.5 h-2.5 rounded-full bg-indigo-600 shrink-0 mt-2 animate-pulse" 
              title="Unread notification"
            />
          )}
        </div>
      );
    });
  };

  return (
    <>
      {/* ========================================================================= */}
      {/* MOBILE SCREEN OVERLAY (PWA-safe, visible on mobile viewport only)          */}
      {/* ========================================================================= */}
      <div className="sm:hidden">
        {/* Backdrop overlay */}
        <div 
          className="fixed inset-0 bg-black/30 z-[9998]"
          onClick={onClose}
        />
        
        {/* Full screen panel */}
        <div className="fixed inset-0 w-full h-full bg-white z-[9999] flex flex-col animate-in fade-in slide-in-from-bottom-5 duration-200">
          {/* Header Row */}
          <div className="sticky top-0 bg-white border-b border-gray-100 px-4 py-4 flex items-center justify-between z-10">
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-gray-900">Notifications</span>
              {unreadCount > 0 && (
                <span className="bg-indigo-50 text-indigo-600 text-xs font-semibold px-2 py-0.5 rounded-full">
                  {unreadCount} New
                </span>
              )}
            </div>
            <div className="flex items-center gap-4">
              <button 
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors focus:outline-none"
                onClick={(e) => {
                  e.stopPropagation();
                  if (onMarkAllAsRead) onMarkAllAsRead();
                }}
              >
                Mark all as read
              </button>
              <button 
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-all"
                onClick={onClose}
                aria-label="Close notifications"
              >
                <X size={22} />
              </button>
            </div>
          </div>

          {/* Scrollable zone */}
          <div className="flex-1 overflow-y-auto divide-y divide-gray-50 pb-[80px]">
            {renderNotificationCards()}
          </div>

          {/* Sticky Bottom Footer */}
          <div className="sticky bottom-0 bg-gray-50/95 backdrop-blur-sm border-t border-gray-100 px-4 py-4 text-center z-10">
            <button 
              className="w-full py-3 bg-[#002b4e] hover:bg-[#001e36] text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2"
              onClick={(e) => {
                e.stopPropagation();
                router.push('/messages');
                if (onClose) onClose();
              }}
            >
              <Bell size={14} />
              View all notifications
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* DESKTOP DROPDOWN (Perfect absolute sizing, visible on desktop viewport)    */}
      {/* ========================================================================= */}
      <div className="hidden sm:flex absolute right-0 top-[calc(100%+8px)] w-96 bg-white border border-gray-100 rounded-2xl shadow-xl overflow-hidden z-50 flex-col animate-in fade-in zoom-in-95 origin-top-right">
        {/* Sticky Header Row */}
        <div className="sticky top-0 bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between z-10">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-bold text-gray-900">Notifications</span>
            {unreadCount > 0 && (
              <span className="bg-indigo-50 text-indigo-600 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {unreadCount} New
              </span>
            )}
          </div>
          <button 
            className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 transition-colors focus:outline-none focus:underline"
            onClick={(e) => {
              e.stopPropagation();
              if (onMarkAllAsRead) onMarkAllAsRead();
            }}
          >
            Mark all as read
          </button>
        </div>

        {/* Scrollable zone */}
        <div className="overflow-y-auto max-h-[360px] divide-y divide-gray-50">
          {renderNotificationCards()}
        </div>

        {/* Fixed Footer Row */}
        <div className="bg-gray-50/90 backdrop-blur-sm border-t border-gray-100 py-2.5 text-center">
          <button 
            className="text-[11px] font-bold text-gray-700 hover:text-indigo-600 transition-colors inline-flex items-center gap-1"
            onClick={(e) => {
              e.stopPropagation();
              router.push('/messages');
              if (onClose) onClose();
            }}
          >
            <Bell size={10} />
            View all notifications
          </button>
        </div>
      </div>
    </>
  );
}
