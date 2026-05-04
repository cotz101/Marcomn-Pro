import { Link, useLocation } from 'react-router-dom';
import { Home, Users, Briefcase, UserPlus, Ship, Moon, Sun, ChevronDown, Network } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

export default function Header({ darkMode, setDarkMode, profile }) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mnetworkOpen, setMnetworkOpen] = useState(false);

  const mnetworkRef = useRef(null);
  const avatarRef = useRef(null);

  // Close dropdowns if clicked outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (mnetworkRef.current && !mnetworkRef.current.contains(event.target)) {
        setMnetworkOpen(false);
      }
      if (avatarRef.current && !avatarRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header className="header">
      <div className="header-container">
        <Link to="/" className="brand-logo">
          <Ship size={28} />
          Marcomn
        </Link>
        
        <nav className="nav-links" style={{ position: 'relative' }} ref={mnetworkRef}>
          <div 
            className="nav-link" 
            onClick={() => setMnetworkOpen(!mnetworkOpen)}
            style={{ cursor: 'pointer' }}
          >
            <Network size={24} />
            <span>MNetwork <ChevronDown size={14} style={{display: 'inline', verticalAlign: 'middle'}}/></span>
          </div>

          {mnetworkOpen && (
            <div className="dropdown-menu" style={{ top: '48px', left: '-50px', right: 'auto', width: '200px' }} onClick={() => setMnetworkOpen(false)}>
              <Link to="/" className="dropdown-item">
                <Home size={18} /> Logbook
              </Link>
              <Link to="/groups" className="dropdown-item">
                <Users size={18} /> Groups
              </Link>
              <Link to="/talent" className="dropdown-item">
                <Briefcase size={18} /> Talent
              </Link>
              <Link to="/connections" className="dropdown-item">
                <UserPlus size={18} /> Connections
              </Link>
            </div>
          )}
        </nav>

        <div className="header-right" ref={avatarRef}>
          <div className="avatar-dropdown" onClick={() => setDropdownOpen(!dropdownOpen)}>
            <img src={profile.profilePic || '/profile_pic.png'} alt="Me" className="avatar-img" />
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)'}}>Me <ChevronDown size={14} style={{display: 'inline', verticalAlign: 'middle'}}/></span>
            
            {dropdownOpen && (
              <div className="dropdown-menu" onClick={() => setDropdownOpen(false)}>
                <div className="dropdown-item" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setDarkMode(!darkMode); }}>
                  {darkMode ? <Sun size={18} /> : <Moon size={18} />}
                  {darkMode ? 'Light Mode' : 'Dark Mode'}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
