'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Users, Briefcase, UserPlus, Ship, Moon, Sun, ChevronDown, Network } from 'lucide-react';
import { createClient } from '@/lib/supabase';
import { useRef } from 'react';

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
  const [darkMode, setDarkMode] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mnetworkOpen, setMnetworkOpen] = useState(false);
  const mnetworkRef = useRef(null);
  const avatarRef = useRef(null);

  const [profile, setProfile] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('profileData');
      if (saved) return JSON.parse(saved);
    }
    return { ...DEFAULT_PROFILE, fullName: userEmail?.split('@')[0] || 'User' };
  });

  useEffect(() => {
    if (darkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [darkMode]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('profileData', JSON.stringify(profile));
    }
  }, [profile]);

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

  return (
    <>
      <header className="header">
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
                <Link href="/groups" className="dropdown-item"><Users size={18} /> Groups</Link>
                <Link href="/talent" className="dropdown-item"><Briefcase size={18} /> Talent</Link>
                <Link href="/connections" className="dropdown-item"><UserPlus size={18} /> Connections</Link>
              </div>
            )}
          </nav>

          <div className="header-right" ref={avatarRef}>
            <div className="avatar-dropdown" onClick={() => setDropdownOpen(!dropdownOpen)}>
              <img src={profile.profilePic || '/profile_pic.png'} alt="Me" className="avatar-img" />
              <span className="hidden md:inline" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Me <ChevronDown size={14} style={{ display: 'inline', verticalAlign: 'middle' }} />
              </span>

              {dropdownOpen && (
                <div className="dropdown-menu" onClick={() => setDropdownOpen(false)}>
                  <Link href="/profile" className="dropdown-item">View Profile</Link>
                  <div
                    className="dropdown-item"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setDarkMode(!darkMode); }}
                  >
                    {darkMode ? <Sun size={18} /> : <Moon size={18} />}
                    {darkMode ? 'Light Mode' : 'Dark Mode'}
                  </div>
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
        <Link href="/talent" className={`flex flex-col items-center gap-1 ${pathname === '/talent' ? 'text-blue-600' : 'text-gray-500'} dark:text-gray-400`}>
          <Briefcase size={20} />
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
    </>
  );
}
