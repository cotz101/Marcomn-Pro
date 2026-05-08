'use client';
import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase';
import { Briefcase, MapPin, Search, User, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import ProfessionalCard from '@/components/connections/ProfessionalCard';

export default function TalentDirectory() {
  const [profiles, setProfiles] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  const fetchProfiles = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url, position, location, bio, skills, is_sailing, vessel_name, open_to_work')
      .order('full_name', { ascending: true });

    if (data && !error) {
      setProfiles(data);
      setFiltered(data);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchProfiles(); }, [fetchProfiles]);

  // Client-side search
  useEffect(() => {
    if (!query.trim()) {
      setFiltered(profiles);
      return;
    }
    const q = query.toLowerCase();
    setFiltered(
      profiles.filter(p =>
        (p.full_name || '').toLowerCase().includes(q) ||
        (p.position || '').toLowerCase().includes(q) ||
        (p.bio || '').toLowerCase().includes(q) ||
        (p.location || '').toLowerCase().includes(q) ||
        (p.skills || []).some(s => s.toLowerCase().includes(q))
      )
    );
  }, [query, profiles]);

  return (
    <div>
      {/* Search Bar */}
      <div className="card" style={{ padding: '14px 18px', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 10 }}>
        <Search size={20} color="var(--text-secondary)" />
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search by name, title, company, or location…"
          style={{
            border: 'none', background: 'transparent', outline: 'none',
            width: '100%', fontSize: 15, color: 'var(--text-primary)'
          }}
        />
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-secondary)' }}>Loading professionals…</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-secondary)' }}>
          {query ? `No results for "${query}"` : 'No professionals found.'}
        </div>
      ) : (
        <div className="discovery-grid">
          {filtered.map(profile => (
            <ProfessionalCard key={profile.id} profile={profile} />
          ))}
        </div>
      )}
    </div>
  );
}
