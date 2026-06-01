import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Plus, X, BookOpen, Users, UserPlus, Star, Lightbulb, Handshake, FileText, Send, Library, SquarePen } from 'lucide-react';

export default function SpeedDialFAB() {
  const [isOpen, setIsOpen] = useState(false);
  const [animating, setAnimating] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    setAnimating(true);
    const timer = setTimeout(() => setAnimating(false), 600);
    return () => clearTimeout(timer);
  }, [pathname]);

  const getModuleConfig = () => {
    switch (pathname) {
      case '/services':
        return {
          color: 'var(--glow-services)',
          primaryAction: 'Post a Job',
          primaryPath: '/services?post=true',
          shortcuts: [
            { label: 'Opportunity', icon: Lightbulb, path: '/services/opportunities' },
            { label: 'Partners', icon: Handshake, path: '/services/partners' },
            { label: 'My Job Posting', icon: FileText, path: '/services/my-postings' },
            { label: 'My Job Application', icon: Send, path: '/services/my-applications' },
          ]
        };
      case '/mblog':
        return {
          color: 'var(--primary)',
          primaryAction: 'Post a Blog',
          primaryPath: '/mblog?compose=true',
          shortcuts: [
            { label: 'MBlogs', icon: BookOpen, path: '/mblog?view=my' },
          ]
        };
      default: // MNetwork
        return {
          color: 'var(--glow-network)',
          primaryAction: 'Post to Logbook',
          primaryPath: '/logbook',
          shortcuts: [
            { label: 'Logbook', icon: BookOpen, path: '/logbook' },
            { label: 'Connection', icon: UserPlus, path: '/connections' },
            { label: 'Group', icon: Users, path: '/groups' },
            { label: 'Talents', icon: Star, path: '/talent' },
          ]
        };
    }
  };

  const config = getModuleConfig();

  const handleNavigation = (path) => {
    router.push(path);
    setIsOpen(false);
  };

  return (
    <>
      <div className={`mobile-fab-container ${isOpen ? 'open' : ''}`}>
        {/* Speed Dial Menu */}
        <div className="speed-dial-menu">
          <div 
            className="speed-dial-primary-btn"
            onClick={() => handleNavigation(config.primaryPath)}
          >
            {config.primaryAction}
          </div>
          <div className="speed-dial-shortcuts">
            {config.shortcuts.map((s, idx) => (
              <div 
                key={idx} 
                className="speed-dial-shortcut-item"
                onClick={() => handleNavigation(s.path)}
              >
                <span className="shortcut-label">{s.label}</span>
                <div className="shortcut-icon-wrapper">
                  <s.icon size={18} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Main FAB */}
        <button 
          className={`main-fab transition-all duration-200 ease-in-out active:scale-95 ${isOpen ? 'active scale-110' : ''} ${animating ? 'animating' : ''}`}
          onClick={() => setIsOpen(!isOpen)}
          style={{ '--fab-color': config.color }}
        >
          {isOpen ? <X size={28} /> : <Plus size={28} />}
        </button>
      </div>
      
      {/* Overlay */}
      {isOpen && <div className="fab-overlay" onClick={() => setIsOpen(false)} />}
    </>
  );
}
