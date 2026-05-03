'use client';
import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase';
import { Briefcase, MapPin, Search, User, ExternalLink } from 'lucide-react';
import Link from 'next/link';

export default function TalentDirectory() {
  const [profiles, setProfiles] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  const fetchProfiles = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, headline, avatar_url, current_position, current_company, location')
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
        (p.headline || '').toLowerCase().includes(q) ||
        (p.current_position || '').toLowerCase().includes(q) ||
        (p.current_company || '').toLowerCase().includes(q) ||
        (p.location || '').toLowerCase().includes(q)
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
        <div className="talent-grid">
          {filtered.map(profile => (
            <div key={profile.id} className="card group-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 10 }}>
              {/* Avatar */}
              <div style={{ position: 'relative' }}>
                {profile.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt={profile.full_name || 'User'}
                    style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--border)' }}
                  />
                ) : (
                  <div style={{
                    width: 80, height: 80, borderRadius: '50%',
                    background: 'linear-gradient(135deg, #0e2a4d, #00B4D8)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                    <User size={36} color="white" />
                  </div>
                )}
              </div>

              {/* Name & Headline */}
              <div style={{ flex: 1, width: '100%' }}>
                <div className="group-name" style={{ fontSize: 16, fontWeight: 700 }}>
                  {profile.full_name || 'MarComn User'}
                </div>
                {profile.headline && (
                  <div className="group-members" style={{ marginTop: 4, fontSize: 13, lineHeight: 1.4 }}>
                    {profile.headline}
                  </div>
                )}
                {(profile.current_position || profile.current_company) && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: 6, fontSize: 12, color: 'var(--text-secondary)' }}>
                    <Briefcase size={12} />
                    <span>
                      {profile.current_position}
                      {profile.current_position && profile.current_company ? ' at ' : ''}
                      {profile.current_company}
                    </span>
                  </div>
                )}
                {profile.location && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: 4, fontSize: 12, color: 'var(--text-secondary)' }}>
                    <MapPin size={12} />
                    <span>{profile.location}</span>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 8, width: '100%', marginTop: 4 }}>
                <button className="btn-secondary" style={{ flex: 1, fontSize: 13 }}>Connect</button>
                <Link
                  href={`/profile/${profile.id}`}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: '0 12px', borderRadius: 8, border: '1px solid var(--border)',
                    color: 'var(--text-secondary)', textDecoration: 'none',
                    fontSize: 13, background: 'transparent', cursor: 'pointer'
                  }}
                  title="View profile"
                >
                  <ExternalLink size={15} />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
