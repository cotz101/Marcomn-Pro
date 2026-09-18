'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { useProfile } from '@/app/context/ProfileContext';
import { Bell, Newspaper, Users, Briefcase, Mail, MessageSquare, Globe, ArrowLeft, Loader2, Check, Coins } from 'lucide-react';

export default function NotificationsFeedPage() {
  const router = useRouter();
  const { userId, showToast } = useProfile();
  const supabase = createClient();

  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState('All');

  const fetchNotifications = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*, sender:profiles!sender_id(id, name, avatar_url)')
        .eq('recipient_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setNotifications(data || []);
    } catch (err) {
      console.error('Error loading notifications:', {
        message: err?.message,
        details: err?.details,
        hint: err?.hint,
        code: err?.code,
        error: err
      });
      showToast('Error loading notifications', 'error');
    } finally {
      setLoading(false);
    }
  }, [userId, supabase, showToast]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const markAllAsRead = async () => {
    if (!userId) return;
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('recipient_id', userId)
        .eq('is_read', false);

      if (error) throw error;
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      showToast('All notifications marked as read', 'success');
    } catch (err) {
      console.error('Error marking notifications as read:', err);
      showToast('Failed to mark all as read', 'error');
    }
  };

  const handleNotificationClick = async (notification) => {
    // Optimistic Update
    setNotifications(prev => prev.map(n => 
      n.id === notification.id ? { ...n, is_read: true } : n
    ));

    try {
      await supabase.from('notifications').update({ is_read: true }).eq('id', notification.id);
    } catch (err) {
      console.error('Error syncing read status to DB:', err);
    }

    if (notification.link) {
      let targetUrl = notification.link;
      
      // If link points to a logbook post, route to feed with focus for highlighting
      if (targetUrl.startsWith('/logbook/')) {
        const parts = targetUrl.replace('/logbook/', '').split('?');
        const postId = parts[0];
        targetUrl = `/logbook?focus=${postId}`;
        if (parts[1]) {
           targetUrl += `&${parts[1]}`;
        }
      }

      router.push(targetUrl);
    }
  };

  // Resilient type mapper
  const mapNotificationType = (type) => {
    const t = (type || '').toLowerCase();
    
    if (['application', 'job_application', 'application_status', 'application_received', 'application_submitted', 'application_status_changed', 'shortlisted', 'rejected'].includes(t)) {
      return 'Applications';
    }
    if (['job_offer', 'offer_sent', 'offer_received', 'offer_accepted', 'offer_expired'].includes(t)) {
      return 'Offers';
    }
    if (['job', 'job_posting', 'job_status', 'active_engagement', 'candidate_cancelled', 'company_cancelled', 'engagement_completed', 'feedback_received'].includes(t)) {
      return 'Engagements';
    }
    if (['mcredit_grant', 'mcredit_deduct', 'wallet_credit', 'wallet_debit', 'refund', 'penalty', 'platform_revenue', 'compensation'].includes(t)) {
      return 'Wallet';
    }
    if (['mention', 'post_mention', 'comment_mention', 'group_mention'].includes(t)) {
      return 'Mentions';
    }
    if (['group', 'group_invite', 'group_join_request', 'group_thread_reply', 'group_thread', 'group_like', 'group_join_accept', 'group_post'].includes(t)) {
      return 'Groups';
    }
    if (['message', 'direct_message', 'group_message', 'message_received'].includes(t)) {
      return 'Messages';
    }
    return 'System';
  };

  const getMappedCategory = (notification) => {
    return mapNotificationType(notification.type);
  };

  // Compute category counts
  const categoriesWithCounts = useMemo(() => {
    const counts = { All: notifications.length };
    notifications.forEach(n => {
      const cat = getMappedCategory(n);
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return counts;
  }, [notifications]);

  // Filters to render (All is always shown, others only if count > 0)
  const activeFilters = useMemo(() => {
    const order = ['All', 'Applications', 'Offers', 'Engagements', 'Wallet', 'Mentions', 'Groups', 'Messages', 'System'];
    return order.filter(f => f === 'All' || (categoriesWithCounts[f] && categoriesWithCounts[f] > 0));
  }, [categoriesWithCounts]);

  // Filtered notifications
  const filteredNotifications = useMemo(() => {
    if (selectedFilter === 'All') return notifications;
    return notifications.filter(n => getMappedCategory(n) === selectedFilter);
  }, [notifications, selectedFilter]);

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
    // Check if it's a platform/wallet related top-up or credits notification
    const isTopup = ['wallet_credit', 'wallet_debit', 'wallet_topup', 'mcredit_grant', 'mcredit_deduct', 'refund', 'penalty', 'platform_revenue', 'compensation'].includes((notification.type || '').toLowerCase()) || 
                    (notification.title && notification.title.toLowerCase().includes('top-up'));
    
    if (isTopup) {
      return (
        <div className="w-11 h-11 rounded-full bg-amber-50 border border-amber-100 text-amber-600 flex items-center justify-center shadow-xs shrink-0">
          <Coins size={20} />
        </div>
      );
    }

    const isAppMsgCompany = notification.type === 'application_message' && notification.metadata?.sender_display_type === 'company';
    const hasCompanyContext = notification.metadata?.actor_type === 'company' || notification.metadata?.actor_company_id || isAppMsgCompany;
    
    if (hasCompanyContext) {
      const companyLogo = notification.metadata.actor_company_logo_url || notification.metadata.sender_avatar_url;
      const companyName = notification.metadata.actor_company_name || notification.metadata.sender_display_name || 'Company';
      
      if (companyLogo) {
        return (
          <>
            <img 
              src={companyLogo} 
              alt={companyName} 
              className="w-11 h-11 rounded-full object-cover border border-gray-150 shadow-xs"
              onError={(e) => {
                e.target.style.display = 'none';
                e.target.nextSibling.style.display = 'flex';
              }}
            />
            <div className="w-11 h-11 rounded-full items-center justify-center shadow-xs border font-bold text-base shrink-0 bg-blue-50 border-blue-100 text-blue-600 hidden">
              {companyName.charAt(0).toUpperCase()}
            </div>
          </>
        );
      }
      return (
        <div className="w-11 h-11 rounded-full flex items-center justify-center shadow-xs border font-bold text-base shrink-0 bg-blue-50 border-blue-100 text-blue-600">
          {companyName.charAt(0).toUpperCase()}
        </div>
      );
    }

    const hasAvatar = notification.sender && notification.sender.avatar_url;
    if (hasAvatar) {
      return (
        <img 
          src={notification.sender.avatar_url} 
          alt="" 
          className="w-11 h-11 rounded-full object-cover border border-gray-150 shadow-xs"
          onError={(e) => {
            e.target.style.display = 'none';
            e.target.nextSibling.style.display = 'flex';
          }}
        />
      );
    }

    const char = notification.sender?.name 
      ? notification.sender.name.charAt(0).toUpperCase() 
      : (notification.title ? notification.title.charAt(0).toUpperCase() : 'N');

    return (
      <div className={`w-11 h-11 rounded-full flex items-center justify-center shadow-xs border font-bold text-base shrink-0 ${
        notification.type === 'mblog' ? 'bg-emerald-50 border-emerald-100 text-emerald-600' :
        notification.type === 'group' ? 'bg-amber-50 border-amber-100 text-amber-600' :
        'bg-blue-50 border-blue-100 text-blue-600'
      }`}>
        {notification.type === 'message' ? char : (
          notification.type === 'mblog' ? <Newspaper size={20} /> :
          notification.type === 'group' ? <Users size={20} /> :
          notification.type === 'milestone' ? <Briefcase size={20} /> :
          char
        )}
      </div>
    );
  };

  return (
    <div className="w-full max-w-3xl mx-auto px-4 sm:px-6 md:px-8 py-6 sm:py-8 font-sans">
      
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-[#0e2a4d] leading-tight">Notifications</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">Keep track of your network activity, mentions, and updates.</p>
        </div>
        {notifications.filter(n => !n.is_read).length > 0 && (
          <button
            onClick={markAllAsRead}
            className="flex items-center gap-1.5 px-3.5 py-1.5 sm:px-4 sm:py-2 border border-gray-200 text-gray-600 hover:text-[#0e2a4d] hover:border-gray-300 rounded-full text-xs font-bold transition-all shadow-3xs cursor-pointer select-none bg-white hover:bg-slate-50 outline-none focus:outline-none shrink-0 self-start sm:self-center"
          >
            <Check size={14} />
            <span>Mark all as read</span>
          </button>
        )}
      </div>

      {/* Pill Filters */}
      {activeFilters.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-6 scrollbar-none scroll-smooth select-none -mx-1 px-1">
          {activeFilters.map(filter => {
            const isSelected = selectedFilter === filter;
            const count = categoriesWithCounts[filter] || 0;
            return (
              <button
                key={filter}
                onClick={() => setSelectedFilter(filter)}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer whitespace-nowrap outline-none focus:outline-none shrink-0 ${
                  isSelected 
                    ? 'bg-[#002b4e] text-white shadow-3xs'
                    : 'bg-white border border-gray-200 hover:bg-gray-50 text-slate-600'
                }`}
              >
                <span>{filter}</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                  isSelected ? 'bg-white/20 text-white' : 'bg-gray-100 text-slate-500'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Notifications List */}
      {loading ? (
        <div className="bg-white border border-gray-100 rounded-2xl p-16 shadow-xs flex flex-col items-center justify-center space-y-4">
          <Loader2 size={36} className="animate-spin text-blue-900" />
          <span className="text-sm text-gray-500 font-semibold">Loading notifications...</span>
        </div>
      ) : filteredNotifications.length > 0 ? (
        <div className="bg-white border border-gray-150 rounded-2xl shadow-sm overflow-hidden divide-y divide-gray-100">
          {filteredNotifications.map((notification) => {
            const isRead = notification.is_read;
            const isMilestone = notification.type === 'milestone';

            return (
              <div
                key={notification.id}
                onClick={() => handleNotificationClick(notification)}
                className={`p-4 sm:p-5 transition-all duration-150 flex gap-3.5 sm:gap-4 items-start cursor-pointer hover:bg-slate-50/70 relative ${
                  !isRead ? 'bg-blue-50/20' : ''
                } ${isMilestone && !isRead ? 'border-l-4 border-blue-500' : ''}`}
              >
                {/* Avatar Icon */}
                <div className="relative shrink-0">
                  {renderAvatar(notification)}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 pr-1">
                  <div className="flex items-baseline justify-between gap-3 mb-1">
                    <h3 className={`text-sm font-bold truncate ${isRead ? 'text-gray-700' : 'text-gray-900 font-extrabold'}`}>
                      {notification.title}
                    </h3>
                    <span className={`text-[11px] font-semibold whitespace-nowrap shrink-0 ${isRead ? 'text-gray-400' : 'text-blue-600 font-bold'}`}>
                      {formatTimeAgo(notification.created_at)}
                    </span>
                  </div>
                  <p className={`text-xs sm:text-sm leading-relaxed break-words ${isRead ? 'text-gray-500' : 'text-gray-700 font-medium'}`}>
                    {notification.body}
                  </p>
                </div>

                {/* Unread Indicator Slot - always maintains consistent right gutter */}
                <div className="w-2.5 shrink-0 flex items-center justify-center pt-2">
                  {!isRead && (
                    <div
                      className="w-2 h-2 rounded-full bg-[#002b4e] animate-pulse"
                      title="Unread"
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-20 bg-white border border-gray-100 rounded-2xl shadow-sm">
          <div className="flex justify-center mb-4">
            <Bell size={48} className="text-gray-300 animate-pulse" />
          </div>
          <h3 className="text-lg font-bold text-navy-900">No Notifications</h3>
          <p className="text-gray-500 mt-1 max-w-xs mx-auto text-sm">
            {selectedFilter === 'All' 
              ? "You're all caught up! There are no new alerts." 
              : `There are no notifications matching the "${selectedFilter}" filter.`}
          </p>
        </div>
      )}
    </div>
  );
}
