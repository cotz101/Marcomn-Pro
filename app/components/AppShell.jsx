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
  Pencil
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
  
  const avatarRef = useRef(null);

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
          <div className="header-content">
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
              {/* Desktop Actions (>1024px) */}
              <div className="header-actions-desktop">
                <button className="header-icon-btn"><MessageSquare size={22} /></button>
                <button className="header-icon-btn"><Bell size={22} /></button>
                <button 
                  className="btn-primary-pill px-4 py-1.5 ml-2"
                  onClick={() => setShowPostJob(true)}
                >
                  <Plus size={16} className="mr-1" />
                  <span className="font-bold text-sm">Post a Job</span>
                </button>
              </div>

              {/* Tablet Actions (768px - 1023px) */}
              <div className="header-actions-tablet">
                <button className="header-icon-btn"><MessageSquare size={22} /></button>
                <button className="header-icon-btn"><Bell size={22} /></button>
                <button 
                  className="header-icon-btn suitcase"
                  onClick={() => router.push('/jobs')}
                >
                  <Briefcase size={22} />
                </button>
              </div>
              
              <div className="avatar-dropdown ml-2" onClick={() => setDropdownOpen(!dropdownOpen)} style={{ position: 'relative', cursor: 'pointer' }}>
                <div className="flex items-center gap-1">
                  <img 
                    src={identityImage} 
                    alt="Me" 
                    className="avatar-img" 
                    style={{ width: '34px', height: '34px', objectFit: 'cover', borderRadius: isCompany ? '8px' : '50%' }}
                  />
                  <ChevronDown size={14} className="hidden md:block" />
                </div>

                {dropdownOpen && (
                  <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, zIndex: 1000 }}>
                    <IdentitySwitcher 
                      onClose={() => setDropdownOpen(false)} 
                      onCreateCompany={() => { setDropdownOpen(false); setShowCreateCompany(true); }}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Row 2: Sub-Navigation (Tablet & Desktop) */}
      <nav className="sub-nav">
        <div className="app-container h-full">
          <div className="sub-nav-content">
            <div className="sub-nav-links-wrapper">
              <Link href="/logbook" className={`sub-nav-link ${pathname === '/logbook' ? 'active' : ''}`}>Logbook</Link>
              <Link href="/connections" className={`sub-nav-link ${pathname === '/connections' ? 'active' : ''}`}>Connections</Link>
              <Link href="/groups" className={`sub-nav-link ${pathname === '/groups' ? 'active' : ''}`}>Groups</Link>
              <Link href="/talent" className={`sub-nav-link ${pathname === '/talent' ? 'active' : ''}`}>Talent</Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Bottom Tab Bar (Fixed 5 Icons) */}
      <nav className="bottom-nav-mobile md:hidden">
        <Link href="/logbook" className={`bottom-nav-link ${pathname === '/logbook' ? 'active' : ''}`}>
          <Ship size={24} />
          <span>MNetwork</span>
        </Link>
        <Link href="/services" className={`bottom-nav-link ${pathname === '/services' ? 'active' : ''}`}>
          <LayoutGrid size={24} />
          <span>MServices</span>
        </Link>
        <Link href="/blog" className={`bottom-nav-link ${pathname === '/blog' ? 'active' : ''}`}>
          <Newspaper size={24} />
          <span>MBlog</span>
        </Link>
        <Link href="/notifications" className={`bottom-nav-link ${pathname === '/notifications' ? 'active' : ''}`}>
          <Bell size={24} />
          <span>Alerts</span>
        </Link>
        <div className="bottom-nav-link" onClick={() => setMnetworkOpen(true)}>
          <Menu size={24} />
          <span>Menu</span>
        </div>
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

      {/* FAB for Mobile Post Creation */}
      <div className="fab-container md:hidden">
        {isFabExpanded && (
          <div className="fab-options">
            <button 
              className="fab-pill"
              onClick={() => {
                setIsFabExpanded(false);
                setShowPostJob(true);
              }}
            >
              <Briefcase size={18} />
              Post a Job
            </button>
            <button 
              className="fab-pill"
              onClick={() => {
                setIsFabExpanded(false);
                router.push('/logbook?create=true');
              }}
            >
              <Pencil size={18} />
              Post on Logbook
            </button>
          </div>
        )}
        <button 
          className={`fab-btn ${isFabExpanded ? 'expanded' : ''}`} 
          onClick={() => setIsFabExpanded(!isFabExpanded)}
          aria-label="Create Post"
        >
          <Plus size={32} color="white" />
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
