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
import CreatePostModal from '@/src/components/logbook/CreatePostModal';
import IdentitySwitcher from '@/src/components/layout/IdentitySwitcher';
import NotificationDropdown from '@/src/components/layout/NotificationDropdown';
import SidebarLeft from '@/src/components/layout/SidebarLeft';
import SidebarRight from '@/src/components/layout/SidebarRight';
import { createClient } from '@/lib/supabase';

export default function AppShell({ children, userEmail, userId }) {
  const router = useRouter();
  const pathname = usePathname();
  const isWideAdminRoute = pathname?.startsWith('/admin/mcredits');
  const { 
    profile, setProfile, onboardingCompleted, setOnboardingCompleted,
    companies, refreshCompanies, currentIdentity, setCurrentIdentity,
    toast, setToast,
    showPostJob, jobToEdit, openPostJobModal, closePostJobModal,
    showCreatePost, setShowCreatePost,
    brandLogoDesktop, brandLogoMobile
  } = useProfile();
  
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileDropdownOpen, setMobileDropdownOpen] = useState(false);
  const [mnetworkOpen, setMnetworkOpen] = useState(false);
  const [showCreateCompany, setShowCreateCompany] = useState(false);
  const [isFabExpanded, setIsFabExpanded] = useState(false);
  const [fabAnimating, setFabAnimating] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [loadingNotifications, setLoadingNotifications] = useState(true);
  const unreadCount = notifications.filter(n => !n.is_read).length;
  
  const avatarRef = useRef(null);
  const notificationsRef = useRef(null);
  const bellButtonRef = useRef(null);

  const fetchNotifications = useCallback(async () => {
    if (!userId) return;
    const supabase = createClient();
    setLoadingNotifications(true);
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*, sender:profiles!sender_id(id, name, avatar_url)')
        .eq('recipient_id', userId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      if (data) {
        setNotifications(data);
      }
    } catch (err) {
      console.error('Error fetching notifications:', {
        message: err?.message,
        details: err?.details,
        hint: err?.hint,
        code: err?.code,
        error: err
      });
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

    try {
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
        .subscribe((status, err) => {
          console.log('📡 [Notif Channel] Connection Status:', status, err ? `Error: ${JSON.stringify(err)}` : '');
          if (status === 'CHANNEL_ERROR') {
             console.error('CRITICAL: Realtime connection rejected! Check RLS policies.', err);
          }
        });
    } catch (err) {
      console.error('📡 [Notif Channel] Exception during subscription setup:', err);
    }

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


  const isCompany = currentIdentity?.type === 'company';
  const identityImage = isCompany ? (currentIdentity.data?.logo_url || '/company_placeholder.png') : (profile?.profilePic || '/avatar_placeholder.png');

  return (
    <div className={`flex flex-col ${pathname === '/messages' ? 'h-[100dvh] overflow-hidden' : 'min-h-screen'} bg-[#F4F4F4]`}>
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

      {showCreatePost && (
        <CreatePostModal
          isOpen={showCreatePost}
          onClose={() => setShowCreatePost(false)}
          onPostCreated={() => {
            setShowCreatePost(false);
            router.refresh();
          }}
        />
      )}

      <header className="header app-header" style={{ borderTop: isCompany ? '4px solid var(--primary)' : 'none' }}>
        <div className="app-container" style={{ maxWidth: isWideAdminRoute ? '1480px' : undefined }}>
          {/* Unified Responsive Header Content */}
          <div className="w-full flex items-center justify-between py-2 px-4 h-[calc(76px+env(safe-area-inset-top))] md:h-auto md:min-h-[64px] pt-[calc(env(safe-area-inset-top)+20px)] md:pt-1">
            
            {/* LEFT: Logo / Back Button */}
            <div className="flex items-center gap-3 flex-1 md:flex-none">
              {(pathname === '/profile' || pathname?.startsWith('/company/')) ? (
                <>
                  <button 
                    onClick={() => router.push('/network/connections')}
                    className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                    title="Back to Network"
                  >
                    <ArrowLeft size={22} className="text-[#002b4e]" />
                  </button>
                  <span className="font-bold text-lg text-[#002b4e] md:hidden ml-2">Profile</span>
                </>
              ) : (
                <Link href="/" className="logo font-semibold text-[#002b4e] flex items-center">
                  {brandLogoDesktop ? (
                    <img 
                      src={brandLogoDesktop} 
                      alt="MarComn Desktop Logo" 
                      className="hidden md:block h-8 w-auto object-contain max-h-[32px] max-w-[150px]" 
                    />
                  ) : (
                    <span className="hidden md:block">Mar<span>Comn</span></span>
                  )}
                  {brandLogoMobile ? (
                    <img 
                      src={brandLogoMobile} 
                      alt="MarComn Mobile Logo" 
                      className="block md:hidden h-8 w-auto object-contain max-h-[32px] max-w-[100px]" 
                    />
                  ) : (
                    <span className="block md:hidden">Mar<span>Comn</span></span>
                  )}
                </Link>
              )}
            </div>

            {/* CENTER: Main Navigation (Desktop Only) */}
            <div className="hidden md:flex items-center justify-center !mt-[10px] flex-1">
              {(pathname === '/profile' || pathname?.startsWith('/company/')) ? (
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
                    <span>MBlogs</span>
                  </Link>
                </>
              )}
            </div>

            {/* RIGHT: Actions & Avatar */}
            <div className="flex items-center gap-1.5 md:gap-3 flex-shrink-0">
              
              {/* Message Icon (Mobile + Desktop) */}
              <button className="header-icon-btn scale-110 md:scale-100 flex-shrink-0" onClick={() => router.push('/messages')}>
                <MessageSquare size={26} />
              </button>

              {/* Desktop-only Notifications */}
              <div className="relative hidden md:block flex-shrink-0" ref={notificationsRef}>
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

              {/* Responsive Post a Job */}
              <button 
                 className="btn-primary-pill px-2.5 py-1.5 md:px-5 ml-1.5 md:ml-3 flex items-center justify-center mr-1 md:mr-3 flex-shrink-0"
                 style={{ backgroundColor: 'var(--primary-container)' }}
                 onClick={() => openPostJobModal()}
              >
                <Briefcase size={16} className="md:mr-2" />
                <span className="font-bold text-sm hidden md:inline whitespace-nowrap">Post a Job</span>
              </button>

              {/* Avatar (Mobile + Desktop) */}
              <div className="relative ml-1 md:ml-2 pr-2 flex-shrink-0" ref={avatarRef}>
                <div className="flex items-center gap-1.5 cursor-pointer" onClick={() => setDropdownOpen(!dropdownOpen)}>
                  <img 
                     src={identityImage} 
                     alt="Me" 
                     className="header-avatar-img flex-shrink-0" 
                     style={{ width: '34px', height: '34px', objectFit: 'cover', borderRadius: isCompany ? '8px' : '50%' }}
                  />
                  <ChevronDown size={14} className="hidden md:block flex-shrink-0" />
                </div>

                {dropdownOpen && (
                  <div className="absolute right-0 top-[calc(100%+8px)] z-[1000]">
                    <div className="card shadow-xl p-2 min-w-[240px] bg-white">
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
        </div>
      </header>

      {/* Sub-Navigation removed for Shell Refinement Stage 1 */}

      {/* Luminous Bottom Navigation (Fixed 4 Icons) */}
      <nav className="mobile-bottom-nav md:hidden" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 8px)' }}>
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
          <span className="mobile-nav-label">MBlogs</span>
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
      {!pathname?.startsWith('/messages') && !pathname?.startsWith('/profile') && !pathname?.startsWith('/company/') && (
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
                      <div className="speed-dial-shortcut-item" onClick={() => { setIsFabExpanded(false); router.push('/network/connections'); }}>
                        <span className="shortcut-label">Connections</span>
                        <div className="shortcut-icon-wrapper"><UserPlus size={18} /></div>
                      </div>
                      <div className="speed-dial-shortcut-item" onClick={() => { setIsFabExpanded(false); router.push('/groups'); }}>
                        <span className="shortcut-label">Groups</span>
                        <div className="shortcut-icon-wrapper"><Users size={18} /></div>
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
                        <span className="shortcut-label">My MBlogs</span>
                        <div className="shortcut-icon-wrapper"><BookOpen size={18} /></div>
                      </div>
                    </>
                  )}
                </div>

                {/* Primary Action (Navy Theme) - RESTORED SOLID NAVY BLUE */}
                <div className="speed-dial-primary-btn" style={{ backgroundColor: '#002b4e', color: 'white', zIndex: 9999 }}>
                  {(pathname?.includes('/logbook') || pathname?.includes('/network') || pathname?.includes('/connections') || pathname?.includes('/groups') || pathname?.includes('/talent')) && (
                    <button className="w-full text-center" style={{ color: 'white' }} onClick={() => { setIsFabExpanded(false); setShowCreatePost(true); }}>
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
                      Post an MBlog
                    </button>
                  )}
                </div>
              </div>
            )}
            
            <button 
              className={`main-fab transition-all duration-200 ease-in-out active:scale-95 ${isFabExpanded ? 'active scale-110' : ''} ${fabAnimating ? 'animating' : ''}`} 
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

      <main className={`flex-1 flex flex-col ${pathname === '/messages' ? 'min-h-0 overflow-hidden' : ''}`}>
        <div 
          className={pathname === '/messages' ? 'w-full flex-1 flex flex-col overflow-hidden min-h-0' : 'app-container'}
          style={pathname === '/messages' ? undefined : { maxWidth: isWideAdminRoute ? '1480px' : undefined }}
        >
          {pathname === '/messages' ? (
            <div className="w-full flex-1 flex flex-col overflow-hidden min-h-0">
              {children}
            </div>
          ) : (
            <div className={`main-grid ${
              (pathname?.startsWith('/jobs/my-postings') || pathname?.endsWith('/wallet') || pathname?.startsWith('/admin/mcredits')) ? 'hide-sidebar-right' : ''
            }`}>
              <SidebarLeft />
              <div className="center-feed">
                {children}
              </div>
              {!(pathname?.startsWith('/jobs/my-postings') || pathname?.endsWith('/wallet') || pathname?.startsWith('/admin/mcredits')) && <SidebarRight />}
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
