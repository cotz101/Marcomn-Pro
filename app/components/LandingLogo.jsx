'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase';

const AnchorIcon = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="5" r="3"/>
    <line x1="12" y1="8" x2="12" y2="22"/>
    <path d="M5 12H2a10 10 0 0 0 20 0h-3"/>
  </svg>
);

export default function LandingLogo() {
  const [brandLogoDesktop, setBrandLogoDesktop] = useState('');
  const [brandLogoMobile, setBrandLogoMobile] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLogos = async () => {
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from('platform_settings')
          .select('*')
          .in('key', ['brand_logo_desktop', 'brand_logo_mobile']);
        if (data && !error) {
          const desktop = data.find(item => item.key === 'brand_logo_desktop')?.value || '';
          const mobile = data.find(item => item.key === 'brand_logo_mobile')?.value || '';
          setBrandLogoDesktop(desktop);
          setBrandLogoMobile(mobile);
        }
      } catch (err) {
        console.error('Failed to fetch logos in LandingLogo:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchLogos();
  }, []);

  if (loading) {
    // Return default fallback while loading to prevent layout shifts
    return (
      <div className="flex items-center gap-2 font-bold text-xl" style={{ color: '#0e2a4d' }}>
        <AnchorIcon />
        Marcomn
      </div>
    );
  }

  if (brandLogoDesktop || brandLogoMobile) {
    return (
      <div className="flex items-center gap-2">
        {brandLogoDesktop ? (
          <img 
            src={brandLogoDesktop} 
            alt="Marcomn"
            className="hidden md:block h-7 w-auto object-contain max-w-[140px]" 
          />
        ) : (
          <div className="hidden md:flex items-center gap-2 font-bold text-xl" style={{ color: '#0e2a4d' }}>
            <AnchorIcon />
            Marcomn
          </div>
        )}
        {brandLogoMobile ? (
          <img 
            src={brandLogoMobile} 
            alt="Marcomn"
            className="block md:hidden h-7 w-auto object-contain max-w-[90px]" 
          />
        ) : (
          <div className="block md:hidden flex items-center gap-2 font-bold text-xl" style={{ color: '#0e2a4d' }}>
            <AnchorIcon />
            Marcomn
          </div>
        )}
      </div>
    );
  }

  // Fallback if no logo uploaded
  return (
    <div className="flex items-center gap-2 font-bold text-xl" style={{ color: '#0e2a4d' }}>
      <AnchorIcon />
      Marcomn
    </div>
  );
}
