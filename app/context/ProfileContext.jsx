'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase';

const ProfileContext = createContext();

export const DEFAULT_PROFILE = {
  name: 'MarComn User',
  currentRole: '',
  bio: '',
  location: 'Global',
  profilePic: '/avatar_placeholder.png',
  coverPhoto: '/cover_photo.png',
  isSailing: false,
  vesselName: '',
  skills: [],
  previousRole: '',
  yearsExperience: 0,
  openToWork: 'Not Available',
};

export function ProfileProvider({ children, userId, userEmail }) {
  const [profile, setProfileState] = useState({ 
    ...DEFAULT_PROFILE, 
    name: userEmail?.split('@')[0] || 'User' 
  });
  const [loading, setLoading] = useState(true);
  const [onboardingCompleted, setOnboardingCompleted] = useState(true); // default true to avoid flash
  const [companies, setCompanies] = useState([]);
  const [currentIdentity, setCurrentIdentityState] = useState({ type: 'user', id: userId }); // { type: 'user' | 'company', id: string, data: object }
  const [toast, setToast] = useState(null);

  const [showPostJob, setShowPostJob] = useState(false);
  const [jobToEdit, setJobToEdit] = useState(null);
  const [showCreatePost, setShowCreatePost] = useState(false);

  const openPostJobModal = (job = null) => {
    setJobToEdit(job);
    setShowPostJob(true);
  };

  const closePostJobModal = () => {
    setJobToEdit(null);
    setShowPostJob(false);
  };

  // ... (localStorage logic kept) ...
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('marcomn_identity');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed && parsed.id) {
            setCurrentIdentityState(parsed);
          }
        } catch (e) {
          console.error('Error parsing saved identity:', e);
        }
      }
    }
  }, []);

  const setCurrentIdentity = (identity) => {
    setCurrentIdentityState(identity);
    if (typeof window !== 'undefined') {
      localStorage.setItem('marcomn_identity', JSON.stringify(identity));
    }
  };

  const [brandLogoDesktop, setBrandLogoDesktop] = useState('');
  const [brandLogoMobile, setBrandLogoMobile] = useState('');

  const fetchGlobalSettings = useCallback(async () => {
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
  }, []);

  const fetchProfile = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }
    
    const supabase = createClient();
    
    // Fetch active platform admin roles and permissions to augment client-side profile
    const { data: userPerms } = await supabase
      .from('platform_admin_user_roles')
      .select(`
        platform_admin_roles (
          role_key,
          platform_admin_role_permissions (
            platform_admin_permissions ( permission_key )
          )
        )
      `)
      .eq('user_id', userId)
      .eq('is_active', true);
      
    const activeRoles = userPerms?.map(r => r.platform_admin_roles?.role_key).filter(Boolean) || [];
    
    const permissionsSet = new Set();
    userPerms?.forEach(ur => {
      const rolePerms = ur.platform_admin_roles?.platform_admin_role_permissions || [];
      rolePerms.forEach(rp => {
        if (rp.platform_admin_permissions?.permission_key) {
          permissionsSet.add(rp.platform_admin_permissions.permission_key);
        }
      });
    });
    const activePermissions = Array.from(permissionsSet);

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    
    if (data && !error) {
      setOnboardingCompleted(data.onboarding_completed ?? false);
      setProfileState({
        id: data.id,
        name: data.name || userEmail?.split('@')[0] || 'User',
        currentRole: data.currentRole || '',
        bio: data.bio || '',
        location: data.location || '',
        profilePic: data.avatar_url || data.profile_pic_url || DEFAULT_PROFILE.profilePic,
        coverPhoto: data.cover_photo_url || DEFAULT_PROFILE.coverPhoto,
        isSailing: data.isSailing || false,
        vesselName: data.vesselName || '',
        skills: data.skills || [],
        previousRole: data.previousRole || '',
        yearsExperience: data.yearsExperience || 0,
        openToWork: data.openToWork || 'Not Available',
        message_privacy: data.message_privacy || 'connections',
        global_role: data.global_role || 'guest_user',
        admin_permissions: activePermissions,
        is_platform_admin: activeRoles.length > 0 || ['super_admin', 'admin', 'brand_manager'].includes(data.global_role || 'guest_user'),
      });
    } else {
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
    fetchGlobalSettings();
  }, [fetchProfile, fetchCompanies, fetchGlobalSettings]);

  const setProfile = (newProfile) => {
    setProfileState(prev => ({ ...prev, ...newProfile }));
  };

  return (
    <ProfileContext.Provider value={{ 
      profile, setProfile, loading, refreshProfile: fetchProfile, userId, userEmail,
      onboardingCompleted, setOnboardingCompleted,
      companies, setCompanies, refreshCompanies: fetchCompanies,
      currentIdentity, setCurrentIdentity,
      toast, setToast,
      showPostJob, setShowPostJob,
      jobToEdit, setJobToEdit,
      openPostJobModal, closePostJobModal,
      showCreatePost, setShowCreatePost,
      showToast: (message, type = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
      },
      brandLogoDesktop,
      brandLogoMobile,
      refreshGlobalSettings: fetchGlobalSettings
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
