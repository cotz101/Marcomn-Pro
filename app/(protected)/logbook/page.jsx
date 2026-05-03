'use client';

import { useState, useEffect } from 'react';
import LogbookFeedInner from '@/src/components/logbook/LogbookFeed';

// Profile state lives in AppShell — we read it from localStorage here
const DEFAULT_PROFILE = {
  fullName: 'MarComn User',
  headline: 'Maritime Professional',
  about: '',
  location: 'Global',
  profilePic: '/profile_pic.png',
  coverPhoto: '/cover_photo.png',
};

export default function LogbookPage() {
  const [profile, setProfile] = useState(DEFAULT_PROFILE);

  useEffect(() => {
    const saved = localStorage.getItem('profileData');
    if (saved) setProfile(JSON.parse(saved));
  }, []);

  return <LogbookFeedInner profile={profile} />;
}
