'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Users, Briefcase, UserPlus, Ship, Moon, Sun, ChevronDown, Network, Check, Building2 } from 'lucide-react';
import { useRef } from 'react';
import { useProfile } from '@/app/context/ProfileContext';
import OnboardingModal from '@/src/components/onboarding/OnboardingModal';
import CreateCompanyModal from '@/src/components/company/CreateCompanyModal';
import PostJobModal from '@/src/components/jobs/PostJobModal';
import { createClient } from '@/lib/supabase';

const DEFAULT_PROFILE = {
  fullName: 'MarComn User',
  headline: 'Maritime Professional',
  about: '',
  location: 'Global',
  profilePic: '/profile_pic.png',
  coverPhoto: '/cover_photo.png',
};

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
  const mnetworkRef = useRef(null);
  const avatarRef = useRef(null);

  useEffect(() => {
    // Dark mode disabled as requested
    document.documentElement.classList.remove('dark');
  }, []);

  useEffect(() => {
    function handleOutside(e) {
      if (mnetworkRef.current && !mnetworkRef.current.contains(e.target)) setMnetworkOpen(false);
      if (avatarRef.current && !avatarRef.current.contains(e.target)) setDropdownOpen(false);
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/');
  };

  const handleOnboardingComplete = (data) => {
    setProfile(data);
    setOnboardingCompleted(true);
  };

  const handleCompanyCreated = (company) => {
    refreshCompanies();
    setShowCreateCompany(false);
    // Automatically switch to the new company context
    setCurrentIdentity({ type: 'company', id: company.id, data: company });
  };

  const handleJobPosted = (job) => {
    setShowPostJob(false);
    router.push('/jobs');
  };

  // UI state based on current identity
  const isCompany = currentIdentity.type === 'company';
  const identityName = isCompany ? currentIdentity.data.name : profile.fullName;
  const identityImage = isCompany ? (currentIdentity.data.logo_url || '/company_placeholder.png') : (profile.profilePic || '/profile_pic.png');

  return (
    <>
      {!onboardingCompleted && (
        <OnboardingModal 
          userId={userId} 
          userEmail={userEmail} 
          onComplete={handleOnboardingComplete} 
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

      <header className="header" style={{
        borderTop: isCompany ? '4px solid #00B4D8' : 'none' // Visual cue for company mode
      }}>
        <div className="header-container">
          <Link href="/logbook" className="brand-logo">
            <Ship size={28} />
            Marcomn
          </Link>

          <nav className="nav-links hidden md:flex" style={{ position: 'relative' }} ref={mnetworkRef}>
            <div
              className="nav-link"
              onClick={() => setMnetworkOpen(!mnetworkOpen)}
              style={{ cursor: 'pointer' }}
            >
              <Network size={24} />
              <span>MNetwork <ChevronDown size={14} style={{ display: 'inline', verticalAlign: 'middle' }} /></span>
            </div>

            {mnetworkOpen && (
              <div className="dropdown-menu" style={{ top: '48px', left: '-50px', right: 'auto', width: '200px' }} onClick={() => setMnetworkOpen(false)}>
                <Link href="/logbook" className="dropdown-item"><Home size={18} /> Logbook</Link>
                <Link href="/jobs" className="dropdown-item"><Briefcase size={18} /> Jobs</Link>
                <Link href="/groups" className="dropdown-item"><Users size={18} /> Groups</Link>
                <Link href="/talent" className="dropdown-item"><Users size={18} /> Talent</Link>
                <Link href="/connections" className="dropdown-item"><UserPlus size={18} /> Connections</Link>
              </div>
            )}
          </nav>

          <div className="header-right" ref={avatarRef}>
            {onboardingCompleted && (
              <button 
                className="btn-post-job hidden md:flex" 
                onClick={() => setShowPostJob(true)}
              >
                <Briefcase size={16} />
                <span>Post a Job</span>
              </button>
            )}
            
            <div className="avatar-dropdown" onClick={() => setDropdownOpen(!dropdownOpen)}>
              <div style={{ position: 'relative' }}>
                {isCompany && !currentIdentity.data.logo_url ? (
                  <div style={{ 
                    width: 32, height: 32, borderRadius: '8px', background: '#0e2a4d', 
                    color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 
                  }}>
                    {currentIdentity.data.name?.[0] || 'C'}
                  </div>
                ) : (
                  <img 
                    src={identityImage} 
                    alt="Me" 
                    className="avatar-img" 
                    style={{ borderRadius: isCompany ? '8px' : '50%' }}
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = isCompany ? '/favicon.svg' : '/profile_pic.png';
                    }}
                  />
                )}
              </div>
              <span className="hidden md:inline" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                {identityName} {isCompany && <span style={{ color: '#00B4D8', marginLeft: 4 }}>[Company]</span>} <ChevronDown size={14} style={{ display: 'inline', verticalAlign: 'middle' }} />
              </span>

              {dropdownOpen && (
                <div className="dropdown-menu" onClick={(e) => e.stopPropagation()}>
                  <div style={{ padding: '8px 16px', fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Switch Identity
                  </div>
                  
                  {/* User Identity */}
                  <div 
                    className="dropdown-item" 
                    style={{ background: !isCompany ? '#f1f5f9' : 'transparent', cursor: 'pointer' }}
                    onClick={() => { 
                      setCurrentIdentity({ type: 'user', id: userId }); 
                      setDropdownOpen(false);
                      router.push('/profile');
                    }}
                  >
                    <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10 }}>U</div>
                    <span>Personal: {profile.fullName}</span>
                    {!isCompany && <Check size={14} style={{ marginLeft: 'auto', color: '#00B4D8' }} />}
                  </div>

                  {/* Company Identities */}
                  {companies.map(company => (
                    <div 
                      key={company.id}
                      className="dropdown-item" 
                      style={{ background: isCompany && currentIdentity.id === company.id ? '#f1f5f9' : 'transparent', cursor: 'pointer' }}
                      onClick={() => { 
                        setCurrentIdentity({ type: 'company', id: company.id, data: company }); 
                        setDropdownOpen(false);
                        router.push(`/company/${company.id}`);
                      }}
                    >
                      {company.logo_url ? (
                        <img src={company.logo_url} style={{ width: 24, height: 24, borderRadius: 4, objectFit: 'cover' }} alt="" />
                      ) : (
                        <div style={{ width: 24, height: 24, borderRadius: '4px', background: '#0e2a4d', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700 }}>
                          {company.name?.[0] || 'C'}
                        </div>
                      )}
                      <span>{company.name}</span>
                      {isCompany && currentIdentity.id === company.id && <Check size={14} style={{ marginLeft: 'auto', color: '#00B4D8' }} />}
                    </div>
                  ))}

                  <div style={{ borderTop: '1px solid var(--border-color)', margin: '4px 0' }} />
                  
                  <div className="dropdown-item" style={{ cursor: 'pointer', color: '#00B4D8' }} onClick={() => { setShowCreateCompany(true); setDropdownOpen(false); }}>
                    <Building2 size={16} /> Create Company
                  </div>

                  <div style={{ borderTop: '1px solid var(--border-color)', margin: '4px 0' }} />
                  <Link href="/profile" className="dropdown-item" onClick={() => setDropdownOpen(false)}>View Profile</Link>
                  <div className="dropdown-item" onClick={handleSignOut} style={{ color: '#cc0000', cursor: 'pointer' }}>
                    Sign out
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Bottom Tab Bar */}
      <nav className="fixed bottom-0 w-full bg-white border-t border-gray-200 flex justify-around items-center h-16 md:hidden z-50 dark:bg-[#1d2226] dark:border-gray-700">
        <Link href="/logbook" className={`flex flex-col items-center gap-1 ${pathname === '/logbook' ? 'text-blue-600' : 'text-gray-500'} dark:text-gray-400`}>
          <Home size={20} />
          <span className="text-[10px] font-medium">Logbook</span>
        </Link>
        <Link href="/groups" className={`flex flex-col items-center gap-1 ${pathname === '/groups' ? 'text-blue-600' : 'text-gray-500'} dark:text-gray-400`}>
          <Users size={20} />
          <span className="text-[10px] font-medium">Groups</span>
        </Link>
        <Link href="/jobs" className={`flex flex-col items-center gap-1 ${pathname === '/jobs' ? 'text-blue-600' : 'text-gray-500'} dark:text-gray-400`}>
          <Briefcase size={20} />
          <span className="text-[10px] font-medium">Jobs</span>
        </Link>
        <Link href="/talent" className={`flex flex-col items-center gap-1 ${pathname === '/talent' ? 'text-blue-600' : 'text-gray-500'} dark:text-gray-400`}>
          <Users size={20} />
          <span className="text-[10px] font-medium">Talent</span>
        </Link>
        <Link href="/connections" className={`flex flex-col items-center gap-1 ${pathname === '/connections' ? 'text-blue-600' : 'text-gray-500'} dark:text-gray-400`}>
          <UserPlus size={20} />
          <span className="text-[10px] font-medium">Connect</span>
        </Link>
      </nav>

      <main className="app-layout">
        {typeof children === 'function' ? children({ profile, setProfile, userId }) : children}
      </main>
      <style jsx>{`
        .btn-post-job {
          background: #e0f2fe;
          color: #00B4D8;
          border: none;
          padding: 8px 16px;
          border-radius: 20px;
          font-size: 13px;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          transition: all 0.2s;
          margin-right: 12px;
        }
        .btn-post-job:hover {
          background: #00B4D8;
          color: white;
          transform: translateY(-1px);
        }
      `}</style>
    </>
  );
}
