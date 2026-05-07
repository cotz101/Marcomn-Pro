'use client';

import { useState, useEffect, useRef } from 'react';
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
  Settings as Wheel
} from 'lucide-react';
import { useProfile } from '@/app/context/ProfileContext';
import OnboardingModal from '@/src/components/onboarding/OnboardingModal';
import CreateCompanyModal from '@/src/components/company/CreateCompanyModal';
import PostJobModal from '@/src/components/jobs/PostJobModal';
import IdentitySwitcher from '@/src/components/layout/IdentitySwitcher';
import SidebarLeft from '@/src/components/layout/SidebarLeft';
import SidebarRight from '@/src/components/layout/SidebarRight';
import { createClient } from '@/lib/supabase';

export default function AppShell({ children, userEmail, userId }) {
  const router = useRouter();
  const pathname = usePathname();
  const { 
    profile, setProfile, onboardingCompleted, setOnboardingCompleted,
    companies, refreshCompanies, currentIdentity, setCurrentIdentity 
  } = useProfile();
  
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mnetworkOpen, setMnetworkOpen] = useState(false);
  const [showCreateCompany, setShowCreateCompany] = useState(false);
  const [showPostJob, setShowPostJob] = useState(false);
  const [isFabExpanded, setIsFabExpanded] = useState(false);
  const [fabAnimating, setFabAnimating] = useState(false);
  
  const avatarRef = useRef(null);

  // FAB Transition logic
  useEffect(() => {
    setFabAnimating(true);
    const timer = setTimeout(() => setFabAnimating(false), 600);
    return () => clearTimeout(timer);
  }, [pathname]);

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
    setShowPostJob(false);
    router.push('/jobs');
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
          onClose={() => setShowPostJob(false)}
          onComplete={handleJobPosted}
        />
      )}

      <header className="header" style={{ borderTop: isCompany ? '4px solid var(--primary)' : 'none' }}>
        <div className="app-container">
          {/* Desktop Header Content */}
          <div className="header-content hidden sm:grid">
            <div className="header-left">
              <Link href="/" className="logo">
                Mar<span>Comn</span>
              </Link>
            </div>

            <div className="header-nav-center">
              <Link href="/logbook" className={`nav-link ${pathname === '/logbook' ? 'active' : ''}`}>
                <Ship size={24} />
                <span>MNetwork</span>
              </Link>
              <Link href="/services" className={`nav-link ${pathname === '/services' ? 'active' : ''}`}>
                <LayoutGrid size={24} />
                <span>MServices</span>
              </Link>
              <Link href="/blog" className={`nav-link ${pathname === '/blog' ? 'active' : ''}`}>
                <Newspaper size={24} />
                <span>MBlog</span>
              </Link>
            </div>

            <div className="header-right" ref={avatarRef}>
              <div className="header-actions-desktop flex items-center">
                <button className="header-icon-btn"><MessageSquare size={22} /></button>
                <button className="header-icon-btn"><Bell size={22} /></button>
                <button 
                   className="btn-primary-pill px-4 py-1.5 ml-2"
                   style={{ backgroundColor: 'var(--primary-container)' }}
                   onClick={() => setShowPostJob(true)}
                >
                  <Briefcase size={16} className="mr-1" />
                  <span className="font-bold text-sm">Post a Job</span>
                </button>
              </div>

              <div className="avatar-dropdown ml-2 flex" onClick={() => setDropdownOpen(!dropdownOpen)} style={{ position: 'relative', cursor: 'pointer' }}>
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
                <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, zIndex: 1000 }}>
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

          {/* Mobile Notch-Safe Header */}
          <div className="mobile-header sm:hidden">
            <div className="mobile-header-inner">
              <div className="mobile-search-bar" onClick={() => router.push('/search')}>
                <Search size={18} />
                <span>Search</span>
              </div>
              <div className="flex items-center gap-3">
                <button className="header-icon-btn" onClick={() => router.push('/messages')}>
                  <MessageSquare size={22} />
                </button>
                <div className="mobile-avatar" onClick={() => setDropdownOpen(!dropdownOpen)} style={{ cursor: 'pointer', position: 'relative' }}>
                  <img 
                    src={identityImage} 
                    alt="Me" 
                    className="mobile-avatar-img" 
                    style={{ borderRadius: isCompany ? '4px' : '50%' }}
                  />
                  {dropdownOpen && (
                    <div style={{ position: 'absolute', top: 'calc(100% + 12px)', right: 0, zIndex: 1000 }}>
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
        </div>
      </header>

      {/* Sub-Navigation removed for Shell Refinement Stage 1 */}

      {/* Luminous Bottom Navigation (Fixed 4 Icons) */}
      <nav className="mobile-bottom-nav sm:hidden">
        <Link 
          href="/logbook" 
          className={`mobile-nav-item ${(pathname?.includes('/logbook') || pathname?.includes('/connections') || pathname?.includes('/groups') || pathname?.includes('/talent')) ? 'active' : ''}`}
          style={{ '--active-color': '#002b4e' }}
        >
          <Ship size={24} className="mobile-nav-icon" />
          <span className="mobile-nav-label">Network</span>
        </Link>
        <Link 
          href="/services" 
          className={`mobile-nav-item ${pathname?.includes('/services') || pathname?.includes('/partners') || pathname?.includes('/jobs') ? 'active' : ''}`}
          style={{ '--active-color': '#002b4e' }}
        >
          <LayoutGrid size={24} className="mobile-nav-icon" />
          <span className="mobile-nav-label">Services</span>
        </Link>
        <Link 
          href="/blog" 
          className={`mobile-nav-item ${pathname?.includes('/blog') ? 'active' : ''}`}
          style={{ '--active-color': '#002b4e' }}
        >
          <Newspaper size={24} className="mobile-nav-icon" />
          <span className="mobile-nav-label">Blog</span>
        </Link>
        <Link 
          href="/notifications" 
          className={`mobile-nav-item ${pathname === '/notifications' ? 'active' : ''}`}
          style={{ '--active-color': '#002b4e' }}
        >
          <Bell size={24} className="mobile-nav-icon" />
          <span className="mobile-nav-label">Alerts</span>
        </Link>
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
                <Link href="/connections" className="nav-grid-item" onClick={() => setMnetworkOpen(false)}>
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
      <div className={`mobile-fab-container sm:hidden ${isFabExpanded ? 'open' : ''}`}>
        {isFabExpanded && (
          <div className="speed-dial-menu">
            {/* Contextual Sub-Nav Shortcuts (Top Layer) */}
            <div className="speed-dial-shortcuts">
              {(pathname?.includes('/logbook') || pathname?.includes('/connections') || pathname?.includes('/groups') || pathname?.includes('/talent')) && (
                <>
                  <div className="speed-dial-shortcut-item" onClick={() => { setIsFabExpanded(false); router.push('/logbook'); }}>
                    <span className="shortcut-label">Logbook</span>
                    <div className="shortcut-icon-wrapper"><Ship size={18} /></div>
                  </div>
                  <div className="speed-dial-shortcut-item" onClick={() => { setIsFabExpanded(false); router.push('/groups'); }}>
                    <span className="shortcut-label">Groups</span>
                    <div className="shortcut-icon-wrapper"><Users size={18} /></div>
                  </div>
                  <div className="speed-dial-shortcut-item" onClick={() => { setIsFabExpanded(false); router.push('/connections'); }}>
                    <span className="shortcut-label">Connections</span>
                    <div className="shortcut-icon-wrapper"><UserPlus size={18} /></div>
                  </div>
                  <div className="speed-dial-shortcut-item" onClick={() => { setIsFabExpanded(false); router.push('/talent'); }}>
                    <span className="shortcut-label">Talents</span>
                    <div className="shortcut-icon-wrapper"><Search size={18} /></div>
                  </div>
                </>
              )}
              {(pathname?.includes('/services') || pathname?.includes('/partners') || pathname?.includes('/jobs')) && (
                <>
                  <div className="speed-dial-shortcut-item" onClick={() => { setIsFabExpanded(false); router.push('/services'); }}>
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
              {pathname?.includes('/blog') && (
                <div className="speed-dial-shortcut-item" onClick={() => { setIsFabExpanded(false); router.push('/blog/my-blogs'); }}>
                  <span className="shortcut-label">My Blog</span>
                  <div className="shortcut-icon-wrapper"><Library size={18} /></div>
                </div>
              )}
            </div>

            {/* Primary Action (Navy Theme) */}
            <div className="speed-dial-primary-btn" style={{ backgroundColor: 'var(--primary-container)', color: 'white' }}>
              {(pathname?.includes('/logbook') || pathname?.includes('/connections') || pathname?.includes('/groups') || pathname?.includes('/talent')) && (
                <button className="w-full text-center" onClick={() => { setIsFabExpanded(false); router.push('/logbook?create=true'); }}>
                  Post to Logbook
                </button>
              )}
              {(pathname?.includes('/services') || pathname?.includes('/partners') || pathname?.includes('/jobs')) && (
                <button className="w-full text-center" onClick={() => { setIsFabExpanded(false); setShowPostJob(true); }}>
                  Post a Job
                </button>
              )}
              {pathname?.includes('/blog') && (
                <button className="w-full text-center" onClick={() => { setIsFabExpanded(false); router.push('/blog/create'); }}>
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
          {isFabExpanded ? <X size={28} /> : <Wheel size={28} />}
        </button>
      </div>

      <main className="flex-1">
        <div className="app-container">
          <div className="main-grid">
            <SidebarLeft />
            <div className="center-feed">
              {children}
            </div>
            <SidebarRight />
          </div>
        </div>
      </main>
    </div>
  );
}
