'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase';

const ProfileContext = createContext();

export const DEFAULT_PROFILE = {
  fullName: 'MarComn User',
  headline: 'Maritime Professional',
  bio: '',
  about: '',
  location: 'Global',
  currentPosition: '',
  currentCompany: '',
  profilePic: '/profile_pic.png',
  coverPhoto: '/cover_photo.png',
};

export function ProfileProvider({ children, userId, userEmail }) {
  const [profile, setProfileState] = useState({ 
    ...DEFAULT_PROFILE, 
    fullName: userEmail?.split('@')[0] || 'User' 
  });
  const [loading, setLoading] = useState(true);
  const [onboardingCompleted, setOnboardingCompleted] = useState(true); // default true to avoid flash
  const [companies, setCompanies] = useState([]);
  const [currentIdentity, setCurrentIdentity] = useState({ type: 'user', id: userId }); // { type: 'user' | 'company', id: string, data: object }

  const fetchProfile = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }
    
    const supabase = createClient();
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (data && !error) {
      setOnboardingCompleted(data.onboarding_completed ?? false);
      setProfileState({
        fullName: data.full_name || userEmail?.split('@')[0] || 'User',
        headline: data.headline || DEFAULT_PROFILE.headline,
        bio: data.bio || '',
        about: data.about || '',
        location: data.location || '',
        currentPosition: data.current_position || '',
        currentCompany: data.current_company || '',
        profilePic: data.avatar_url || DEFAULT_PROFILE.profilePic,
        coverPhoto: data.cover_photo_url || DEFAULT_PROFILE.coverPhoto,
      });
    } else {
      // New user with no profile row yet
      setOnboardingCompleted(false);
    }
    setLoading(false);
  }, [userId, userEmail]);

  const fetchCompanies = useCallback(async () => {
    if (!userId) return;
    const supabase = createClient();
    const { data, error } = await supabase
      .from('company_members')
      .select('role, companies (*)')
      .eq('profile_id', userId);

    if (data && !error) {
      // Ensure unique company IDs
      const uniqueCompanies = [];
      const seenIds = new Set();
      
      data.forEach(m => {
        if (m.companies && !seenIds.has(m.companies.id)) {
          uniqueCompanies.push({ ...m.companies, role: m.role });
          seenIds.add(m.companies.id);
        }
      });
      
      setCompanies(uniqueCompanies);
    }
  }, [userId]);

  useEffect(() => {
    fetchProfile();
    fetchCompanies();
  }, [fetchProfile, fetchCompanies]);

  const setProfile = (newProfile) => {
    setProfileState(prev => ({ ...prev, ...newProfile }));
  };

  return (
    <ProfileContext.Provider value={{ 
      profile, setProfile, loading, refreshProfile: fetchProfile, userId, 
      onboardingCompleted, setOnboardingCompleted,
      companies, setCompanies, refreshCompanies: fetchCompanies,
      currentIdentity, setCurrentIdentity
    }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  const context = useContext(ProfileContext);
  if (context === undefined) {
    throw new Error('useProfile must be used within a ProfileProvider');
  }
  return context;
}
