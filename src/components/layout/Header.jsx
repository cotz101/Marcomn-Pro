import { Link, useLocation } from 'react-router-dom';
import { Ship, ChevronDown, Search, MessageSquare, Bell, Plus } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useIdentity } from './IdentityContext';
import IdentitySwitcher from './IdentitySwitcher';
import { createClient } from '@/lib/supabase';

export default function Header() {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const location = useLocation();
  const { activeIdentity } = useIdentity();
  const dropdownRef = useRef(null);
  const supabase = createClient();
  const [groupName, setGroupName] = useState('');
  const [brandLogoDesktop, setBrandLogoDesktop] = useState('');
  const [brandLogoMobile, setBrandLogoMobile] = useState('');

  const groupIdMatch = location.pathname.match(/\/groups\/([^\/]+)/);
  const groupId = groupIdMatch ? groupIdMatch[1] : null;

  useEffect(() => {
    const fetchLogos = async () => {
      try {
        const { data } = await supabase
          .from('platform_settings')
          .select('*')
          .in('key', ['brand_logo_desktop', 'brand_logo_mobile']);
        if (data) {
          const desktop = data.find(item => item.key === 'brand_logo_desktop')?.value || '';
          const mobile = data.find(item => item.key === 'brand_logo_mobile')?.value || '';
          setBrandLogoDesktop(desktop);
          setBrandLogoMobile(mobile);
        }
      } catch (err) {
        console.error('Failed to fetch logos in Header:', err);
      }
    };
    fetchLogos();
  }, [supabase]);

  useEffect(() => {
    if (groupId) {
      const fetchGroupName = async () => {
        const { data } = await supabase
          .from('groups')
          .select('name')
          .eq('id', groupId)
          .maybeSingle();
        if (data) setGroupName(data.name);
      };
      fetchGroupName();
    } else {
      setGroupName('');
    }
  }, [groupId, supabase]);

  // Close dropdown if clicked outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const navItems = [
    { label: 'MNetwork', path: '/', icon: null },
    { label: 'MServices', path: '/services', icon: null },
    { label: 'MBlogs', path: '/mblog', icon: null },
  ];

  return (
    <header className="header">
      <div className="header-container">
        <div className="header-left">
          <Link to="/" className="brand-logo">
            {brandLogoDesktop ? (
              <img 
                src={brandLogoDesktop} 
                alt={groupName || 'MarComn'} 
                className="hidden md:block h-7 w-auto object-contain max-w-[140px]" 
              />
            ) : (
              <>
                <Ship size={28} />
                <span className="hidden md:inline">{groupName || 'MarComn'}</span>
              </>
            )}
            {brandLogoMobile ? (
              <img 
                src={brandLogoMobile} 
                alt={groupName || 'MarComn'} 
                className="block md:hidden h-7 w-auto object-contain max-w-[90px]" 
              />
            ) : (
              <span className="block md:hidden font-bold">{groupName || 'MarComn'}</span>
            )}
          </Link>
          <div className="search-bar">
            <Search size={18} className="search-icon" />
            <input type="text" placeholder="Search" className="search-input" />
          </div>
        </div>
        
        <nav className="nav-links">
          {navItems.map((item) => (
            <Link 
              key={item.label}
              to={item.path} 
              className={`nav-link ${location.pathname === item.path ? 'active' : ''}`}
            >
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className="header-right" ref={dropdownRef}>
          <button className="header-icon-btn">
            <MessageSquare size={22} />
          </button>
          <button className="header-icon-btn">
            <Bell size={22} />
          </button>
          
          <button className="btn-post-job">
            Post a Job
          </button>

          <div className="avatar-dropdown" onClick={() => setDropdownOpen(!dropdownOpen)}>
            {activeIdentity.type === 'company' ? (
              <div className="identity-avatar-container" style={{ width: '34px', height: '34px', borderRadius: '50%' }}>
                <div className="company-initials" style={{ fontSize: '14px' }}>
                  {activeIdentity.name.split(' ').map(n => n[0]).join('')}
                </div>
              </div>
            ) : (
              <img src={activeIdentity.avatar} alt="Me" className="header-avatar-img" />
            )}
            {dropdownOpen && <IdentitySwitcher onClose={() => setDropdownOpen(false)} />}
          </div>
        </div>
      </div>
    </header>
  );
}
