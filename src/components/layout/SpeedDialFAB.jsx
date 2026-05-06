import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Plus, X, BookOpen, Users, UserPlus, Star, Lightbulb, Handshake, FileText, Send, Library } from 'lucide-react';

export default function SpeedDialFAB() {
  const [isOpen, setIsOpen] = useState(false);
  const [animating, setAnimating] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setAnimating(true);
    const timer = setTimeout(() => setAnimating(false), 600);
    return () => clearTimeout(timer);
  }, [location.pathname]);

  const getModuleConfig = () => {
    switch (location.pathname) {
      case '/services':
        return {
          color: 'var(--glow-services)',
          primaryAction: 'Post a Job',
          shortcuts: [
            { label: 'Opportunity', icon: Lightbulb },
            { label: 'Partners', icon: Handshake },
            { label: 'My Job Posting', icon: FileText },
            { label: 'My Job Application', icon: Send },
          ]
        };
      case '/blog':
        return {
          color: 'var(--primary)',
          primaryAction: 'Post a Blog',
          shortcuts: [
            { label: 'My Blog', icon: Library },
          ]
        };
      default: // MNetwork
        return {
          color: 'var(--glow-network)',
          primaryAction: 'Post to Logbook',
          shortcuts: [
            { label: 'Logbook', icon: BookOpen },
            { label: 'Group', icon: Users },
            { label: 'Connection', icon: UserPlus },
            { label: 'Talents', icon: Star },
          ]
        };
    }
  };

  const config = getModuleConfig();

  return (
    <>
      <div className={`mobile-fab-container ${isOpen ? 'open' : ''}`}>
        {/* Speed Dial Menu */}
        <div className="speed-dial-menu">
          <div className="speed-dial-primary-btn">
            {config.primaryAction}
          </div>
          <div className="speed-dial-shortcuts">
            {config.shortcuts.map((s, idx) => (
              <div key={idx} className="speed-dial-shortcut-item">
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
          className={`main-fab ${animating ? 'animating' : ''}`}
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
