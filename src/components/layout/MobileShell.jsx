import BottomNav from './BottomNav';
import SpeedDialFAB from './SpeedDialFAB';
import { useState, useEffect } from 'react';

export default function MobileShell() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (!isMobile) return null;

  return (
    <div className="mobile-shell-ui">
      <BottomNav />
      <SpeedDialFAB />
    </div>
  );
}
