'use client';

import { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/lib/supabase';
import ProfessionalCard from './ProfessionalCard';
import ProfessionalCardSkeleton from './ProfessionalCardSkeleton';
import { ChevronDown, Loader2, Search } from 'lucide-react';

export default function DiscoveryGrid() {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  
  const PAGE_SIZE = 6;
  const LOAD_MORE_SIZE = 6;
  const supabase = createClient();

  useEffect(() => {
    async function fetchInitialProfiles() {
      setLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .range(0, PAGE_SIZE - 1)
        .order('updated_at', { ascending: false });
      
      if (!error && data) {
        setProfiles(data);
        setOffset(data.length);
        if (data.length < PAGE_SIZE) setHasMore(false);
      }
      setLoading(false);
    }

    fetchInitialProfiles();

    // Listen for profile updates from Profile.jsx
    const handleProfileUpdate = (event) => {
      const updatedProfile = event.detail;
      setProfiles(prev => prev.map(p => 
        p.id === updatedProfile.id ? { ...p, ...updatedProfile } : p
      ));
    };

    window.addEventListener('marcomn-profile-updated', handleProfileUpdate);
    return () => window.removeEventListener('marcomn-profile-updated', handleProfileUpdate);
  }, []);

  const handleShowMore = async () => {
    setLoadingMore(true);
    const nextLimit = offset + LOAD_MORE_SIZE - 1;
    
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
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
    if (!searchQuery.trim()) return profiles;
    const query = searchQuery.toLowerCase();
    return profiles.filter(p => 
      (p.full_name?.toLowerCase().includes(query)) || 
      (p.headline?.toLowerCase().includes(query)) ||
      (p.bio?.toLowerCase().includes(query)) ||
      (p.skills?.some(skill => skill.toLowerCase().includes(query))) ||
      (p.current_position?.toLowerCase().includes(query))
    );
  }, [profiles, searchQuery]);

  if (loading) {
    return (
      <div className="discovery-grid mb-24" style={{ paddingBottom: '100px' }}>
        {[1, 2, 3, 4, 5, 6].map(i => (
          <ProfessionalCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  return (
    <div className="pb-32">
      <div className="search-container" style={{ paddingTop: '0' }}>
        <div className="search-bar-wrapper">
          <Search className="search-icon" size={20} />
          <input 
            type="text" 
            placeholder="Search by name, rank, or specialty..." 
            className="search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="discovery-grid">
        {filteredProfiles.map(profile => (
          <ProfessionalCard key={profile.id} profile={profile} />
        ))}
      </div>
      
      {hasMore && !searchQuery && (
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

      {searchQuery && filteredProfiles.length === 0 && (
        <div className="card p-12 text-center text-gray-500 mt-8">
          <Search size={48} className="text-gray-300 mx-auto mb-4" />
          <p>No maritime professionals found matching "{searchQuery}"</p>
        </div>
      )}

      {!hasMore && !searchQuery && profiles.length > 0 && (
        <p className="text-center text-gray-500 mt-8 mb-12">No more professionals to discover.</p>
      )}
    </div>
  );
}
