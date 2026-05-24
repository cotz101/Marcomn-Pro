'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase';
import { Search, Loader2, Briefcase } from 'lucide-react';
import TalentCard from './TalentCard';

export default function TalentDirectory() {
  const [profiles, setProfiles] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');

  const [availabilityFilter, setAvailabilityFilter] = useState(false);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  // Debounce effect
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  const fetchTalent = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('profiles')
        .select('id, name, currentRole, yearsExperience, skills, openToWork, location, avatar_url')
        .order('updated_at', { ascending: false });

      if (debouncedSearchTerm.trim() !== '') {
        query = query.or(`name.ilike.%${debouncedSearchTerm}%,currentRole.ilike.%${debouncedSearchTerm}%,location.ilike.%${debouncedSearchTerm}%,skills.cs.{${debouncedSearchTerm}}`);
      }

      const { data, error } = await query;

      if (error) throw error;
      if (data) setProfiles(data);
    } catch (err) {
      console.error('Error fetching talent:', err.message || err);
    } finally {
      setLoading(false);
    }
  }, [supabase, debouncedSearchTerm]);

  useEffect(() => {
    fetchTalent();
  }, [fetchTalent]);

  const filteredTalent = profiles.filter(profile => {
    const isAvailable = profile.openToWork === true;
    const matchesAvailability = availabilityFilter ? isAvailable : true;

    return matchesAvailability;
  });

  return (
    <div className="talent-directory mx-auto max-w-[1128px] px-4 py-8">
      {/* Unified Dashboard Header Container */}
      <div className="flex flex-col gap-6 p-6 bg-white rounded-lg shadow-sm border border-slate-100 mb-6">
        
        {/* Header Row: Title & Chip */}
        <div className="flex flex-col gap-1 px-4">
          <div className="flex items-center justify-between w-full">
            <h1 className="text-2xl font-bold text-[#002b4e]">Talent Pool</h1>
            {/* Professionals Chip */}
            <div className="bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 border border-blue-100 shadow-sm select-none">
              <Briefcase size={14} className="flex-shrink-0" />
              <span>{filteredTalent.length} {filteredTalent.length === 1 ? 'Professional' : 'Professionals'}</span>
            </div>
          </div>
          <p className="text-slate-500 text-sm">Discover and recruit elite maritime professionals worldwide.</p>
        </div>

        {/* Search and Filters Section */}
        <div className="flex flex-col gap-4 w-full px-4">
          {/* Row 1: Search Input (Full Width with margins) */}
          <div className="mx-auto w-full flex-grow flex items-center bg-slate-50 border border-slate-200 rounded-md px-3 py-2">
            <Search size={18} className="text-slate-400 mr-2 flex-shrink-0" />
            <input 
              type="text" 
              placeholder="Search by name or keywords..." 
              className="bg-transparent border-none outline-none w-full text-sm text-slate-700 focus:ring-0"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Row 2: Availability Checkbox */}
          <div className="flex justify-start w-full mb-6">
            <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer hover:text-slate-800 select-none">
              <input 
                type="checkbox" 
                className="rounded border-slate-300 text-[#002b4e] focus:ring-[#002b4e] cursor-pointer h-4 w-4 flex-shrink-0"
                checked={availabilityFilter}
                onChange={(e) => setAvailabilityFilter(e.target.checked)}
              />
              <span className="font-medium">Immediate Availability</span>
            </label>
          </div>
        </div>
      </div>

      {/* Full-Width Main Content - Grid */}
      <main className="talent-grid-container w-full">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 text-slate-400">
            <Loader2 className="animate-spin mb-4" size={40} />
            <p className="font-medium">Curating Talent Pool...</p>
          </div>
        ) : filteredTalent.length === 0 ? (
          <div className="card p-16 text-center bg-white border-dashed border-2 border-slate-100">
            <Briefcase size={48} className="text-slate-200 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-slate-800 mb-2">No Talent Found</h3>
            <p className="text-slate-500 max-w-xs mx-auto">
              {searchTerm ? 'No professionals found matching your search.' : 'We couldn\'t find any professionals matching the current criteria.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTalent.map(profile => (
              <TalentCard key={profile.id} profile={profile} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
