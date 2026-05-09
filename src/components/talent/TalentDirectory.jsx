'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase';
import { Search, Loader2, Briefcase } from 'lucide-react';
import TalentCard from './TalentCard';

export default function TalentDirectory() {
  const [profiles, setProfiles] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [availabilityFilter, setAvailabilityFilter] = useState(false);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const fetchTalent = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch profiles using only safe, existing columns
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, currentRole, location, avatar_url')
        // Not filtering by openToWork or yearsExperience here yet to prevent fetch errors
        .order('updated_at', { ascending: false });

      if (error) throw error;
      
      // Mocking availability locally if needed can be done here. 
      // For now, we'll just pass the data through.
      if (data) setProfiles(data);
    } catch (err) {
      console.error('Error fetching talent:', err.message || err);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchTalent();
  }, [fetchTalent]);

  const filteredTalent = profiles.filter(profile => {
    const matchesSearch = (profile.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (profile.currentRole || profile.current_role || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    const roleStr = (profile.currentRole || profile.current_role || '').toLowerCase();
    let matchesRole = true;
    if (roleFilter === 'deck') {
      matchesRole = roleStr.includes('deck') || roleStr.includes('master') || roleStr.includes('officer') || roleStr.includes('captain') || roleStr.includes('chief mate');
    } else if (roleFilter === 'engineering') {
      matchesRole = roleStr.includes('engine') || roleStr.includes('technical') || roleStr.includes('eto') || roleStr.includes('electrician');
    } else if (roleFilter === 'ratings') {
      matchesRole = roleStr.includes('rating') || roleStr.includes('able') || roleStr.includes('bosun') || roleStr.includes('wiper') || roleStr.includes('oiler') || roleStr.includes('cook') || roleStr.includes('steward');
    } else if (roleFilter === 'offshore') {
      matchesRole = roleStr.includes('offshore') || roleStr.includes('dp') || roleStr.includes('rov') || roleStr.includes('subsea');
    }

    const isAvailable = profile.open_to_work === true;
    const matchesAvailability = availabilityFilter ? isAvailable : true;

    return matchesSearch && matchesRole && matchesAvailability;
  });

  return (
    <div className="talent-directory mx-auto max-w-[1128px] px-4 py-8">
      {/* Module Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#002b4e]">Talent Pool</h1>
          <p className="text-slate-500 text-sm">Discover and recruit elite maritime professionals worldwide.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="bg-blue-50 text-blue-700 px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2">
            <Briefcase size={16} />
            <span>{filteredTalent.length} Professionals Found</span>
          </div>
        </div>
      </div>

      {/* Horizontal Filter Bar */}
      <div className="flex flex-row flex-wrap items-center gap-4 w-full bg-white p-4 rounded-lg shadow-sm mb-6 border border-slate-100">
        {/* Search Input */}
        <div className="flex-grow flex items-center bg-slate-50 border border-slate-200 rounded-md px-3 py-2 min-w-[200px]">
          <Search size={18} className="text-slate-400 mr-2" />
          <input 
            type="text" 
            placeholder="Search by name or keywords..." 
            className="bg-transparent border-none outline-none w-full text-sm text-slate-700"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Compact Dropdown for Rank/Role */}
        <select 
          className="border border-slate-200 rounded-md px-3 py-2 text-sm text-slate-600 bg-white outline-none min-w-[160px] cursor-pointer hover:border-slate-300"
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
        >
          <option value="">All Ranks / Roles</option>
          <option value="deck">Deck Officers</option>
          <option value="engineering">Engineering</option>
          <option value="ratings">Ratings</option>
          <option value="offshore">Offshore</option>
        </select>

        {/* Toggle/Checkbox for Immediate Availability */}
        <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer hover:text-slate-800">
          <input 
            type="checkbox" 
            className="rounded border-slate-300 text-[#002b4e] focus:ring-[#002b4e] cursor-pointer"
            checked={availabilityFilter}
            onChange={(e) => setAvailabilityFilter(e.target.checked)}
          />
          <span className="font-medium">Immediate Availability</span>
        </label>
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
