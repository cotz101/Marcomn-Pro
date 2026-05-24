'use client';

import { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/lib/supabase';
import ProfessionalCard from './ProfessionalCard';
import ProfessionalCardSkeleton from './ProfessionalCardSkeleton';
import { ChevronDown, Loader2, Search, Users } from 'lucide-react';

export default function DiscoveryGrid({ activeTab = 'discovery', searchTerm = '' }) {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  
  const PAGE_SIZE = 6;
  const LOAD_MORE_SIZE = 6;
  const supabase = createClient();

  useEffect(() => {
    async function fetchInitialProfiles() {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id;
      setCurrentUserId(userId);
      setCurrentUser(user);

      let query = supabase.from('profiles').select('*');

      if (activeTab === 'following') {
        if (!userId) {
          setProfiles([]);
          setLoading(false);
          return;
        }

        const { data: followData } = await supabase
          .from('follows')
          .select('following_id')
          .eq('follower_id', userId);

        const followingIds = followData?.map(f => f.following_id) || [];
        
        if (followingIds.length === 0) {
          setProfiles([]);
          setHasMore(false);
          setLoading(false);
          return;
        }
        
        query = query.in('id', followingIds);
      } else {
        // Discovery mode: exclude current user
        if (userId) {
          query = query.neq('id', userId);
        }
      }

      const { data, error } = await query
        .range(0, PAGE_SIZE - 1)
        .order('updated_at', { ascending: false });
      
      if (!error && data) {
        setProfiles(data);
        setOffset(data.length);
        setHasMore(data.length >= PAGE_SIZE);
      }
      setLoading(false);
    }

    fetchInitialProfiles();

    // Listen for profile updates
    const handleProfileUpdate = (event) => {
      const updatedProfile = event.detail;
      setProfiles(prev => prev.map(p => 
        p.id === updatedProfile.id ? { ...p, ...updatedProfile } : p
      ));
    };

    window.addEventListener('marcomn-profile-updated', handleProfileUpdate);
    return () => window.removeEventListener('marcomn-profile-updated', handleProfileUpdate);
  }, [activeTab]);

  const handleFollowState = (profileId, isNowFollowing) => {
    if (activeTab === 'following' && !isNowFollowing) {
      setProfiles(prev => prev.filter(p => p.id !== profileId));
    }
  };

  const handleShowMore = async () => {
    setLoadingMore(true);
    const nextLimit = offset + LOAD_MORE_SIZE - 1;
    
    let query = supabase.from('profiles').select('*');

    if (activeTab === 'following') {
      const { data: followData } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', currentUserId);

      const followingIds = followData?.map(f => f.following_id) || [];
      query = query.in('id', followingIds);
    } else {
      if (currentUserId) {
        query = query.neq('id', currentUserId);
      }
    }

    const { data, error } = await query
      .range(offset, nextLimit)
      .order('updated_at', { ascending: false });

    if (!error && data) {
      if (data.length > 0) {
        setProfiles(prev => [...prev, ...data]);
        setOffset(prev => prev + data.length);
      }
      
      if (data.length < LOAD_MORE_SIZE) {
        setHasMore(false);
      }
    }
    setLoadingMore(false);
  };

  const filteredProfiles = useMemo(() => {
    if (!searchTerm.trim()) return profiles;
    return profiles.filter(profile => {
      const searchLower = searchTerm.toLowerCase();
      const nameMatch = (profile.name || profile.full_name || '').toLowerCase().includes(searchLower);
      const roleMatch = (profile.currentRole || profile.role || '').toLowerCase().includes(searchLower);
      return nameMatch || roleMatch;
    });
  }, [profiles, searchTerm]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 min-[471px]:grid-cols-2 lg:grid-cols-2 gap-4 mb-24" style={{ paddingBottom: '100px' }}>
        {[1, 2, 3, 4, 5, 6].map(i => (
          <ProfessionalCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  console.log('Search:', searchTerm, 'Results:', filteredProfiles.length);

  return (
    <div className="pb-32">
      <div className="grid grid-cols-1 min-[471px]:grid-cols-2 lg:grid-cols-2 gap-4">
        {filteredProfiles.map(profile => (
          <ProfessionalCard 
            key={profile.id} 
            profile={profile} 
            currentUser={currentUser}
            onFollow={handleFollowState}
          />
        ))}
      </div>
      
      {hasMore && !searchTerm && (
        <div className="flex justify-center" style={{ marginTop: '32px', marginBottom: '32px' }}>
          <button 
            className="btn-ghost-navy" 
            onClick={handleShowMore}
            disabled={loadingMore}
          >
            {loadingMore ? (
              <>
                <Loader2 className="animate-spin" size={18} />
                <span>Loading...</span>
              </>
            ) : (
              <>
                <ChevronDown size={18} />
                <span>Show More</span>
              </>
            )}
          </button>
        </div>
      )}

      {searchTerm && filteredProfiles.length === 0 && (
        <div className="card p-12 text-center text-gray-500 mt-8">
          <Search size={48} className="text-gray-300 mx-auto mb-4" />
          <p>No maritime professionals found matching "{searchTerm}"</p>
        </div>
      )}

      {activeTab === 'following' && !loading && profiles.length === 0 && !searchTerm && (
        <div className="card p-16 text-center text-gray-500 mt-8 border-dashed border-2 border-slate-100 bg-slate-50/50">
          <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm">
            <Users size={32} className="text-slate-300" />
          </div>
          <h3 className="text-xl font-bold text-slate-800 mb-2">Following</h3>
          <p className="max-w-xs mx-auto text-slate-500">You aren't following anyone yet. People you follow will appear here.</p>
        </div>
      )}

      {!hasMore && !searchTerm && profiles.length > 0 && (
        <p className="text-center text-gray-500 mt-8 mb-12">No more professionals to discover.</p>
      )}
    </div>
  );
}
