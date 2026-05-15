import { Link, useLocation } from 'react-router-dom';
import { Network, Briefcase, SquarePen, User } from 'lucide-react';

export default function BottomNav() {
  const location = useLocation();
  
  const navItems = [
    { label: 'Network', path: '/', icon: Network, color: 'var(--glow-network)' },
    { label: 'Services', path: '/services', icon: Briefcase, color: 'var(--glow-services)' },
    { label: 'Blog', path: '/mblog', icon: SquarePen, color: 'var(--primary)' },
    { label: 'Profile', path: '/profile', icon: User, color: 'var(--primary)' },
  ];

  return (
    <nav className="mobile-bottom-nav">
      {navItems.map((item) => {
        const isActive = location.pathname === item.path;
        const Icon = item.icon;
        
        return (
          <Link 
            key={item.label} 
            to={item.path} 
            className={`mobile-nav-item ${isActive ? 'active' : ''}`}
            style={{ '--active-color': item.color }}
          >
            <Icon size={22} className="mobile-nav-icon" />
            <span className="mobile-nav-label">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
