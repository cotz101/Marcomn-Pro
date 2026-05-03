'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase';
import { Briefcase, MapPin, User, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

function formatDate(dateStr) {
  if (!dateStr) return 'Present';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

export default function PublicProfilePage({ params }) {
  const [id, setId] = useState(null);
  const [profile, setProfile] = useState(null);
  const [experience, setExperience] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.resolve(params).then(resolved => setId(resolved.id));
  }, [params]);

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      const supabase = createClient();
      const [{ data: p }, { data: exp }] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', id).single(),
        supabase.from('experience').select('*').eq('user_id', id).order('start_date', { ascending: false }),
      ]);
      setProfile(p);
      setExperience(exp || []);
      setLoading(false);
    };
    load();
  }, [id]);

  if (loading) return (
    <div style={{ textAlign: 'center', padding: 80, color: 'var(--text-secondary)' }}>Loading profile…</div>
  );

  if (!profile) return (
    <div style={{ textAlign: 'center', padding: 80, color: 'var(--text-secondary)' }}>
      Profile not found.
      <br />
      <Link href="/talent" style={{ color: 'var(--primary)', marginTop: 12, display: 'inline-block' }}>← Back to Talent</Link>
    </div>
  );

  return (
    <>
      {/* Back nav */}
      <div style={{ marginBottom: 16 }}>
        <Link href="/talent" style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          color: 'var(--text-secondary)', textDecoration: 'none', fontSize: 14
        }}>
          <ArrowLeft size={16} /> Back to Talent Directory
        </Link>
      </div>

      {/* Profile Card */}
      <section className="profile-card">
        <div className="cover-photo-container" style={{ pointerEvents: 'none' }}>
          <img src={profile.cover_photo_url || '/cover_photo.png'} alt="Cover" />
        </div>
        <div className="profile-info">
          <div className="profile-header-top">
            <div className="profile-pic-container" style={{ pointerEvents: 'none' }}>
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt={profile.full_name} className="profile-pic" />
              ) : (
                <div className="profile-pic" style={{
                  background: 'linear-gradient(135deg, #0e2a4d, #00B4D8)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <User size={40} color="white" />
                </div>
              )}
            </div>
          </div>

          <h1 className="profile-name">{profile.full_name || 'MarComn User'}</h1>
          <h2 className="profile-headline">{profile.headline || ''}</h2>

          {(profile.current_position || profile.current_company) && (
            <p className="profile-location" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Briefcase size={14} />
              {profile.current_position}
              {profile.current_position && profile.current_company ? ' at ' : ''}
              {profile.current_company}
            </p>
          )}

          {profile.location && (
            <p className="profile-location" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <MapPin size={14} /> {profile.location}
            </p>
          )}

          <div className="action-buttons">
            <button className="btn-primary">Connect</button>
            <button className="btn-secondary">Message</button>
          </div>
        </div>
      </section>

      {/* About */}
      {(profile.bio || profile.about) && (
        <section className="profile-card about-card">
          <h2 className="section-title">About</h2>
          <p className="about-text">{profile.bio || profile.about}</p>
        </section>
      )}

      {/* Experience */}
      {experience.length > 0 && (
        <section className="profile-card about-card">
          <h2 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Briefcase size={18} /> Experience
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {experience.map((job, idx) => (
              <div key={job.id} style={{
                display: 'flex', gap: 16, padding: '16px 0',
                borderBottom: idx < experience.length - 1 ? '1px solid var(--border)' : 'none',
              }}>
                <div style={{
                  width: 48, height: 48, flexShrink: 0,
                  background: 'linear-gradient(135deg, #0e2a4d, #00B4D8)',
                  borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <Briefcase size={20} color="white" />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{job.title}</div>
                  <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 2 }}>
                    {job.company}{job.location ? ` · ${job.location}` : ''}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                    {formatDate(job.start_date)} – {formatDate(job.end_date)}
                  </div>
                  {job.description && (
                    <p style={{ fontSize: 13, marginTop: 8, lineHeight: 1.65 }}>{job.description}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
