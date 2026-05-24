'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { 
  Ship, 
  LayoutGrid, 
  Newspaper, 
  MessageSquare, 
  Bell, 
  Briefcase, 
  Plus, 
  Menu, 
  ChevronDown,
  UserPlus,
  Users,
  Search,
  Pencil,
  X,
  Library,
  Handshake,
  FileText,
  Send,
  Zap,
  Target,
  Lightbulb,
  Anchor,
  BookOpen,
  ArrowLeft
} from 'lucide-react';
import { useProfile } from '@/app/context/ProfileContext';
import OnboardingModal from '@/src/components/onboarding/OnboardingModal';
import CreateCompanyModal from '@/src/components/company/CreateCompanyModal';
import PostJobModal from '@/src/components/jobs/PostJobModal';
import PostComposerModal from '@/src/components/logbook/PostComposerModal';
import IdentitySwitcher from '@/src/components/layout/IdentitySwitcher';
import NotificationDropdown from '@/src/components/layout/NotificationDropdown';
import SidebarLeft from '@/src/components/layout/SidebarLeft';
import SidebarRight from '@/src/components/layout/SidebarRight';
import { createClient } from '@/lib/supabase';

export default function AppShell({ children, userEmail, userId }) {
  const router = useRouter();
  const pathname = usePathname();
  const { 
    profile, setProfile, onboardingCompleted, setOnboardingCompleted,
    companies, refreshCompanies, currentIdentity, setCurrentIdentity,
    toast, setToast,
    showPostJob, jobToEdit, openPostJobModal, closePostJobModal
  } = useProfile();
  
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileDropdownOpen, setMobileDropdownOpen] = useState(false);
  const [mnetworkOpen, setMnetworkOpen] = useState(false);
  const [showCreateCompany, setShowCreateCompany] = useState(false);
  const [showPostModal, setShowPostModal] = useState(false);
  const [isFabExpanded, setIsFabExpanded] = useState(false);
  const [fabAnimating, setFabAnimating] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [loadingNotifications, setLoadingNotifications] = useState(true);
  const unreadCount = notifications.filter(n => !n.is_read).length;
  
  const avatarRef = useRef(null);
  const notificationsRef = useRef(null);
  const bellButtonRef = useRef(null);

  // Function to fetch notifications, defined using useCallback
  const fetchNotifications = useCallback(async () => {
    if (!userId) return;
    const supabase = createClient();
    setLoadingNotifications(true);
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*, sender:profiles(id, name, avatar_url)')
        .eq('recipient_id', userId)
        .order('created_at', { ascending: false });
      
      if (!error && data) {
        setNotifications(data);
      }
    } catch (err) {
      console.error('Error fetching notifications:', err);
    } finally {
      setLoadingNotifications(false);
    }
  }, [userId]);

  // FAB Transition logic
  useEffect(() => {
    setFabAnimating(true);
    setIsFabExpanded(false); // Auto-close FAB on route/module change
    setShowNotifications(false); // Auto-close Notifications dropdown on route change
    const timer = setTimeout(() => setFabAnimating(false), 600);
    return () => clearTimeout(timer);
  }, [pathname]);

  useEffect(() => {
    if (!userId) return;

    fetchNotifications();

    console.log('📡 [Notif Channel] Auth Status:', { 
      hasUser: !!userId, 
      userId: userId,
      timestamp: new Date().toISOString() 
    });
    console.log('📡 [Notif Channel] Initializing Supabase Realtime Subscription...');

    // Bulletproof Realtime Subscription with de-duplication
    const processedIds = new Set();
    const supabase = createClient();
    const channel = supabase.channel(`notifications:${userId}`);

    channel
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `recipient_id=eq.${userId}`
      }, (payload) => {
        const newNotif = payload.new;
        if (processedIds.has(newNotif.id)) return; // Skip if already processed
        processedIds.add(newNotif.id);

        console.log('📡 [Notif Channel] Received new alert:', newNotif);
        setNotifications(prev => [newNotif, ...prev]);
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'notifications',
        filter: `recipient_id=eq.${userId}`
      }, (payload) => {
        // If a notification was marked as 'read', update local state instead of removing
        if (payload.new.is_read === true) {
          console.log('📡 [Notif Channel] Notification marked read remotely, updating:', payload.new.id);
          setNotifications(prev => prev.map(n => n.id === payload.new.id ? { ...n, is_read: true } : n));
        }
      })
      .subscribe((status) => {
        console.log('📡 [Notif Channel] Connection Status:', status);
        if (status === 'CHANNEL_ERROR') {
           console.error('CRITICAL: Realtime connection rejected! Check RLS policies.');
        }
      });

    // Cleanup to prevent duplicate listeners
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, fetchNotifications]);

  const handleMarkAllAsRead = async () => {
    if (!userId) return;
    const supabase = createClient();
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('recipient_id', userId)
        .eq('is_read', false);
      
      if (!error) {
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      }
    } catch (err) {
      console.error('Error marking all notifications as read:', err);
    }
  };

  useEffect(() => {
    document.documentElement.classList.remove('dark');
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(registrations => {
        for (let registration of registrations) {
          registration.unregister();
        }
      });
    }
  }, []);

  useEffect(() => {
    function handleOutside(e) {
      if (avatarRef.current && !avatarRef.current.contains(e.target)) setDropdownOpen(false);
      
      // Close notifications dropdown on click outside, unless clicking the bell icon itself (desktop only)
      if (typeof window !== 'undefined' && window.innerWidth >= 640) {
        if (
          notificationsRef.current && 
          !notificationsRef.current.contains(e.target) &&
          bellButtonRef.current &&
          !bellButtonRef.current.contains(e.target)
        ) {
          setShowNotifications(false);
        }
      }
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const handleCompanyCreated = (company) => {
    refreshCompanies();
    setShowCreateCompany(false);
    setCurrentIdentity({ type: 'company', id: company.id, data: company });
  };

  const handleJobPosted = () => {
    closePostJobModal();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('job-posted'));
    }
    router.refresh();
  };

  const handlePostSubmit = async (postData) => {
    const supabase = createClient();
    const { error } = await supabase.from('posts').insert({
      user_id: userId,
      content: postData.content,
      title: postData.title || null,
      media_url: postData.media || null,
      media_type: postData.mediaType || 'image',
      posted_as_company_id: currentIdentity?.type === 'company' ? currentIdentity.id : null
    });

    if (!error) {
      setShowPostModal(false);
    } else {
      alert('Error posting: ' + error.message);
    }
  };

  const isCompany = currentIdentity?.type === 'company';
  const identityImage = isCompany ? (currentIdentity.data?.logo_url || '/company_placeholder.png') : (profile?.profilePic || '/profile_pic.png');

  return (
    <div className="flex flex-col min-h-screen bg-[#F4F4F4]">
      {!onboardingCompleted && (
        <OnboardingModal 
          userId={userId} 
          userEmail={userEmail} 
          onComplete={(data) => { setProfile(data); setOnboardingCompleted(true); }} 
        />
      )}

      {showCreateCompany && (
        <CreateCompanyModal 
          userId={userId}
          onComplete={handleCompanyCreated}
          onClose={() => setShowCreateCompany(false)}
        />
      )}

      {showPostJob && (
        <PostJobModal 
          isOpen={showPostJob}
          onClose={closePostJobModal}
          onComplete={handleJobPosted}
          jobToEdit={jobToEdit}
        />
      )}

      {showPostModal && (
        <PostComposerModal
          isOpen={showPostModal}
          onClose={() => setShowPostModal(false)}
          onPostSubmit={handlePostSubmit}
          profile={profile}
        />
      )}

      <header className="header" style={{ borderTop: isCompany ? '4px solid var(--primary)' : 'none' }}>
        <div className="app-container">
          {/* Desktop Header Content */}
          <div className="header-content hidden sm:grid items-center py-1">
            <div className="header-left flex items-center gap-3">
              {pathname === '/profile' ? (
                <button 
                  onClick={() => router.push('/network/connections')}
                  className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                  title="Back to Network"
                >
                  <ArrowLeft size={22} className="text-[#002b4e]" />
                </button>
              ) : (
                <Link href="/" className="logo">
                  Mar<span>Comn</span>
                </Link>
              )}
            </div>

            <div className="header-nav-center flex items-center justify-center !pt-[6px]">
              {pathname === '/profile' ? (
                <span className="font-bold text-xl text-[#002b4e]">Profile</span>
              ) : (
                <>
                  <Link href="/logbook" className={`nav-link ${(pathname === '/logbook' || pathname?.includes('/network')) ? 'active' : ''}`}>
                    <Ship size={24} />
                    <span>MNetwork</span>
                  </Link>
                  <Link href="/mservices" className={`nav-link ${pathname?.startsWith('/mservices') ? 'active' : ''}`}>
                    <LayoutGrid size={24} />
                    <span>MServices</span>
                  </Link>
                  <Link href="/mblog" className={`nav-link ${pathname === '/mblog' ? 'active' : ''}`}>
                    <Newspaper size={24} />
                    <span>MBlog</span>
                  </Link>
                </>
              )}
            </div>
            <div className="header-right">
              <div className="header-actions-desktop flex items-center">
                <button className="header-icon-btn" onClick={() => router.push('/messages')}><MessageSquare size={22} /></button>
                <div className="relative" ref={notificationsRef} style={{ position: 'relative' }}>
                  <button 
                    ref={bellButtonRef}
                    className={`header-icon-btn relative ${showNotifications ? 'text-indigo-600 bg-indigo-50/50' : ''}`}
                    onClick={() => setShowNotifications(!showNotifications)}
                  >
                    <Bell size={22} />
                    {unreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center border border-white shadow-sm animate-pulse">
                        {unreadCount}
                      </span>
                    )}
                  </button>

                  {showNotifications && (
                    <NotificationDropdown 
                      notifications={notifications}
                      loading={loadingNotifications}
                      onMarkAllAsRead={handleMarkAllAsRead}
                      onClose={() => setShowNotifications(false)} 
                      setNotifications={setNotifications}
                      fetchNotifications={fetchNotifications}
                    />
                  )}
                </div>
                <button 
                   className="btn-primary-pill px-4 py-1.5 ml-2"
                   style={{ backgroundColor: 'var(--primary-container)' }}
                   onClick={() => openPostJobModal()}
                >
                  <Briefcase size={16} className="mr-1" />
                  <span className="font-bold text-sm">Post a Job</span>
                </button>
              </div>

              <div className="avatar-dropdown-container ml-2" style={{ position: 'relative' }} ref={avatarRef}>
                <div className="avatar-dropdown flex" onClick={() => setDropdownOpen(!dropdownOpen)} style={{ cursor: 'pointer' }}>
                  <div className="flex items-center gap-1">
                    <img 
                       src={identityImage} 
                       alt="Me" 
                       className="avatar-img" 
                       style={{ width: '34px', height: '34px', objectFit: 'cover', borderRadius: isCompany ? '8px' : '50%' }}
                    />
                    <ChevronDown size={14} />
                  </div>
                </div>

                {dropdownOpen && (
                  <div className="identity-dropdown-anchor" style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, zIndex: 1000 }}>
                    <div className="card shadow-xl p-2 min-w-[200px] bg-white">
                      <IdentitySwitcher 
                        onClose={() => setDropdownOpen(false)} 
                        onCreateCompany={() => { setDropdownOpen(false); setShowCreateCompany(true); }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Mobile Notch-Safe Header */}
          <div className="mobile-header sm:hidden">
            <div className="mobile-header-inner">
              {pathname === '/profile' ? (
                <div className="flex items-center gap-3 flex-1">
                  <button 
                    onClick={() => router.push('/network/connections')}
                    className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                  >
                    <ArrowLeft size={22} className="text-[#002b4e]" />
                  </button>
                  <div className="flex-1 flex justify-center mr-8">
                    <span className="font-bold text-lg text-[#002b4e]">Profile</span>
                  </div>
                </div>
              ) : (
                <div className="mobile-search-bar" onClick={() => router.push('/search')}>
                  <Search size={18} />
                  <span>Search</span>
                </div>
              )}
              <div className="flex items-center gap-3">
                <button className="header-icon-btn" onClick={() => router.push('/messages')}>
                  <MessageSquare size={22} />
                </button>
                <div className="mobile-avatar-container" style={{ position: 'relative' }}>
                  <button 
                    className="mobile-avatar" 
                    onClick={(e) => {
                      e.preventDefault();
                      setMobileDropdownOpen(!mobileDropdownOpen);
                    }}
                    style={{ cursor: 'pointer', background: 'none', border: 'none', padding: 0 }}
                  >
                    <img 
                      src={identityImage} 
                      alt="Me" 
                      className="mobile-avatar-img" 
                      style={{ borderRadius: isCompany ? '4px' : '50%' }}
                    />
                  </button>
                  {mobileDropdownOpen && (
                    <div style={{ position: 'absolute', top: 'calc(100% + 12px)', right: 0, zIndex: 1000 }}>
                      <div className="card shadow-xl p-2 min-w-[240px] bg-white">
                        <IdentitySwitcher 
                          onClose={() => setMobileDropdownOpen(false)} 
                          onCreateCompany={() => { setMobileDropdownOpen(false); setShowCreateCompany(true); }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Sub-Navigation removed for Shell Refinement Stage 1 */}

      {/* Luminous Bottom Navigation (Fixed 4 Icons) */}
      <nav className="mobile-bottom-nav sm:hidden" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 8px)' }}>
        <Link 
          href="/logbook" 
          className={`mobile-nav-item ${(pathname?.includes('/logbook') || pathname?.includes('/network') || pathname?.includes('/connections') || pathname?.includes('/groups') || pathname?.includes('/talent')) ? 'active' : ''}`}
          style={{ '--active-color': '#002b4e' }}
        >
          <Ship size={24} className="mobile-nav-icon" />
          <span className="mobile-nav-label">MNetwork</span>
        </Link>
        <Link 
          href="/mservices" 
          className={`mobile-nav-item ${pathname?.startsWith('/mservices') || pathname?.includes('/partners') || pathname?.includes('/jobs') ? 'active' : ''}`}
          style={{ '--active-color': '#002b4e' }}
        >
          <LayoutGrid size={24} className="mobile-nav-icon" />
          <span className="mobile-nav-label">MServices</span>
        </Link>
        <Link 
          href="/mblog" 
          className={`mobile-nav-item ${pathname?.includes('/mblog') ? 'active' : ''}`}
          style={{ '--active-color': '#002b4e' }}
        >
          <Newspaper size={24} className="mobile-nav-icon" />
          <span className="mobile-nav-label">MBlog</span>
        </Link>
        <button 
          onClick={(e) => {
            e.preventDefault();
            setShowNotifications(!showNotifications);
          }}
          className={`mobile-nav-item relative ${showNotifications ? 'active' : ''}`}
          style={{ '--active-color': '#002b4e', background: 'none', border: 'none', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}
        >
          <Bell size={24} className="mobile-nav-icon" />
          <span className="mobile-nav-label">Alerts</span>
          {unreadCount > 0 && (
            <span className="absolute top-1 right-[calc(50%-14px)] min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center border-2 border-white shadow-sm animate-pulse">
              {unreadCount}
            </span>
          )}
        </button>
      </nav>

      {/* Mobile Bottom Sheet (High Fidelity) */}
      {mnetworkOpen && (
        <div className="bottom-sheet-overlay show" onClick={() => setMnetworkOpen(false)}>
          <div className="bottom-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="bottom-sheet-handle"></div>
            <div className="p-4">
              <h3 className="font-bold text-lg mb-4 text-[#1b1c1c]">Navigation</h3>
              <div className="grid grid-cols-2 gap-4">
                <Link href="/logbook" className="nav-grid-item" onClick={() => setMnetworkOpen(false)}>
                  <div className="nav-grid-icon-box">
                    <Ship size={24} />
                  </div>
                  <span className="nav-grid-label">Logbook</span>
                </Link>
                <Link href="/network/connections" className="nav-grid-item" onClick={() => setMnetworkOpen(false)}>
                  <div className="nav-grid-icon-box">
                    <UserPlus size={24} />
                  </div>
                  <span className="nav-grid-label">Connections</span>
                </Link>
                <Link href="/groups" className="nav-grid-item" onClick={() => setMnetworkOpen(false)}>
                  <div className="nav-grid-icon-box">
                    <Users size={24} />
                  </div>
                  <span className="nav-grid-label">Groups</span>
                </Link>
                <Link href="/talent" className="nav-grid-item" onClick={() => setMnetworkOpen(false)}>
                  <div className="nav-grid-icon-box">
                    <Search size={24} />
                  </div>
                  <span className="nav-grid-label">Talent</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Contextual Speed Dial FAB */}
      {!pathname?.startsWith('/messages') && (
        <>
          {isFabExpanded && (
            <div className="fab-overlay show" onClick={() => setIsFabExpanded(false)}></div>
          )}
          <div className={`mobile-fab-container sm:hidden ${isFabExpanded ? 'open' : ''}`}>
            {isFabExpanded && (
              <div className="speed-dial-menu">
                {/* Contextual Sub-Nav Shortcuts (Top Layer) */}
                <div className="speed-dial-shortcuts">
                  {(pathname?.includes('/logbook') || pathname?.includes('/network') || pathname?.includes('/connections') || pathname?.includes('/groups') || pathname?.includes('/talent')) && (
                    <>
                      <div className="speed-dial-shortcut-item" onClick={() => { setIsFabExpanded(false); router.push('/logbook'); }}>
                        <span className="shortcut-label">Logbook</span>
                        <div className="shortcut-icon-wrapper"><Ship size={18} /></div>
                      </div>
                      <div className="speed-dial-shortcut-item" onClick={() => { setIsFabExpanded(false); router.push('/groups'); }}>
                        <span className="shortcut-label">Groups</span>
                        <div className="shortcut-icon-wrapper"><Users size={18} /></div>
                      </div>
                      <div className="speed-dial-shortcut-item" onClick={() => { setIsFabExpanded(false); router.push('/network/connections'); }}>
                        <span className="shortcut-label">Connections</span>
                        <div className="shortcut-icon-wrapper"><UserPlus size={18} /></div>
                      </div>
                      <div className="speed-dial-shortcut-item" onClick={() => { setIsFabExpanded(false); router.push('/talent'); }}>
                        <span className="shortcut-label">Talents</span>
                        <div className="shortcut-icon-wrapper"><Search size={18} /></div>
                      </div>
                    </>
                  )}
                  {(pathname?.startsWith('/mservices') || pathname?.includes('/partners') || pathname?.includes('/jobs')) && (
                    <>
                      <div className="speed-dial-shortcut-item" onClick={() => { setIsFabExpanded(false); router.push('/mservices'); }}>
                        <span className="shortcut-label">Opportunity</span>
                        <div className="shortcut-icon-wrapper"><Lightbulb size={18} /></div>
                      </div>
                      <div className="speed-dial-shortcut-item" onClick={() => { setIsFabExpanded(false); router.push('/partners'); }}>
                        <span className="shortcut-label">Partners</span>
                        <div className="shortcut-icon-wrapper"><Handshake size={18} /></div>
                      </div>
                      <div className="speed-dial-shortcut-item" onClick={() => { setIsFabExpanded(false); router.push('/jobs/my-postings'); }}>
                        <span className="shortcut-label">My Job Posting</span>
                        <div className="shortcut-icon-wrapper"><FileText size={18} /></div>
                      </div>
                      <div className="speed-dial-shortcut-item" onClick={() => { setIsFabExpanded(false); router.push('/jobs/my-applications'); }}>
                        <span className="shortcut-label">My Job Application</span>
                        <div className="shortcut-icon-wrapper"><Send size={18} /></div>
                      </div>
                    </>
                  )}
                  {pathname?.includes('/mblog') && (
                    <>
                      <div className="speed-dial-shortcut-item" onClick={() => { setIsFabExpanded(false); router.push('/mblog?view=my'); }}>
                        <span className="shortcut-label">My Articles</span>
                        <div className="shortcut-icon-wrapper"><BookOpen size={18} /></div>
                      </div>
                    </>
                  )}
                </div>

                {/* Primary Action (Navy Theme) - RESTORED SOLID NAVY BLUE */}
                <div className="speed-dial-primary-btn" style={{ backgroundColor: '#002b4e', color: 'white', zIndex: 9999 }}>
                  {(pathname?.includes('/logbook') || pathname?.includes('/network') || pathname?.includes('/connections') || pathname?.includes('/groups') || pathname?.includes('/talent')) && (
                    <button className="w-full text-center" style={{ color: 'white' }} onClick={() => { setIsFabExpanded(false); setShowPostModal(true); }}>
                      Post to Logbook
                    </button>
                  )}
                  {(pathname?.startsWith('/mservices') || pathname?.includes('/partners') || pathname?.includes('/jobs')) && (
                    <button className="w-full text-center" style={{ color: 'white' }} onClick={() => { setIsFabExpanded(false); openPostJobModal(); }}>
                      Post a Job
                    </button>
                  )}
                  {pathname?.includes('/mblog') && (
                    <button className="w-full text-center" style={{ color: 'white' }} onClick={() => { setIsFabExpanded(false); router.push('/mblog?compose=true'); }}>
                      Post a Blog
                    </button>
                  )}
                </div>
              </div>
            )}
            
            <button 
              className={`main-fab ${isFabExpanded ? 'active' : ''} ${fabAnimating ? 'animating' : ''}`} 
              onClick={() => setIsFabExpanded(!isFabExpanded)}
              style={{ 
                '--fab-color': '#002b4e' 
              }}
              aria-label="Speed Dial"
            >
              {/* Always Ship Anchor - White inside Navy Circle */}
              <Anchor size={28} style={{ color: 'white' }} />
            </button>
          </div>
        </>
      )}

      <main className="flex-1 flex flex-col">
        <div className={pathname === '/messages' ? 'w-full flex-1 flex flex-col' : 'app-container'}>
          {pathname === '/messages' ? (
            <div className="w-full flex-1 flex flex-col">
              {children}
            </div>
          ) : (
            <div className="main-grid">
              <SidebarLeft />
              <div className="center-feed">
                {children}
              </div>
              <SidebarRight />
            </div>
          )}
        </div>
      </main>
      {showNotifications && (
        <div className="sm:hidden">
          <NotificationDropdown 
            notifications={notifications}
            loading={loadingNotifications}
            onMarkAllAsRead={handleMarkAllAsRead}
            onClose={() => setShowNotifications(false)} 
          />
        </div>
      )}

      {toast && (
        <div className={`fixed bottom-24 right-4 z-[9999] transition-all duration-300 animate-in slide-in-from-right-full ${
          toast.type === 'success' ? 'bg-[#002b4e] text-white' : 'bg-red-600 text-white'
        } px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3 border border-white/10`}>
          <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
          <span className="font-bold text-sm uppercase tracking-wider">{toast.message}</span>
          <button onClick={() => setToast(null)} className="ml-2 hover:bg-white/10 p-1 rounded">
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
