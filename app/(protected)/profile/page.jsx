'use client';

import { useState, useEffect } from 'react';
import Profile from '@/src/components/profile/Profile';

const DEFAULT_PROFILE = {
  fullName: 'MarComn User',
  headline: 'Maritime Professional',
  about: '',
  location: 'Global',
  profilePic: '/profile_pic.png',
  coverPhoto: '/cover_photo.png',
};

export default function ProfilePage() {
  const [profile, setProfile] = useState(DEFAULT_PROFILE);

  useEffect(() => {
    const saved = localStorage.getItem('profileData');
    if (saved) setProfile(JSON.parse(saved));
  }, []);

  const handleSetProfile = (updated) => {
    const newProfile = typeof updated === 'function' ? updated(profile) : updated;
    setProfile(newProfile);
    localStorage.setItem('profileData', JSON.stringify(newProfile));
  };

  return <Profile profile={profile} setProfile={handleSetProfile} />;
}
