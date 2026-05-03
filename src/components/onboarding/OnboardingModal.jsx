'use client';
import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase';
import { MapPin, User, Briefcase, Check, Loader, Anchor } from 'lucide-react';

const STEPS = ['welcome', 'form', 'success'];

export default function OnboardingModal({ userId, userEmail, onComplete }) {
  const [step, setStep] = useState('welcome');
  const [form, setForm] = useState({
    fullName: '',
    headline: '',
    location: '',
  });
  const [saving, setSaving] = useState(false);
  const [locLoading, setLocLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const nameRef = useRef(null);

  // Auto-focus first field when form step opens
  useEffect(() => {
    if (step === 'form') setTimeout(() => nameRef.current?.focus(), 100);
  }, [step]);

  // ── Geolocation auto-suggest ──────────────────────────────────────────────
  const suggestLocation = () => {
    if (!navigator.geolocation) return;
    setLocLoading(true);
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${coords.latitude}&lon=${coords.longitude}&format=json`
          );
          const data = await res.json();
          const city   = data.address?.city || data.address?.town || data.address?.village || '';
          const country = data.address?.country || '';
          setForm(prev => ({ ...prev, location: [city, country].filter(Boolean).join(', ') }));
        } catch {
          // silently fall through — user can type manually
        }
        setLocLoading(false);
      },
      () => setLocLoading(false),
      { timeout: 8000 }
    );
  };

  // ── Validation ─────────────────────────────────────────────────────────────
  const validate = () => {
    const errs = {};
    if (!form.fullName.trim()) errs.fullName = 'Your name is required.';
    if (!form.headline.trim()) errs.headline = 'A short headline helps others find you.';
    return errs;
  };

  // ── Save to Supabase ───────────────────────────────────────────────────────
  const handleComplete = async () => {
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from('profiles').upsert({
      id: userId,
      full_name: form.fullName.trim(),
      headline: form.headline.trim(),
      location: form.location.trim() || null,
      onboarding_completed: true,
    });

    if (error) {
      setErrors({ global: 'Could not save. Please try again.' });
      setSaving(false);
      return;
    }

    setSaving(false);
    setStep('success');
    setTimeout(() => onComplete({
      fullName: form.fullName.trim(),
      headline: form.headline.trim(),
      location: form.location.trim(),
    }), 1800);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: undefined }));
  };

  // ── Shared overlay styles ─────────────────────────────────────────────────
  const overlayStyle = {
    position: 'fixed', inset: 0, zIndex: 9999,
    background: 'rgba(10, 20, 40, 0.75)',
    backdropFilter: 'blur(6px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 20,
  };

  const cardStyle = {
    background: 'var(--bg-primary, #fff)',
    borderRadius: 20,
    maxWidth: 480, width: '100%',
    boxShadow: '0 24px 60px rgba(0,0,0,0.35)',
    overflow: 'hidden',
    animation: 'fadeSlideUp 0.35s ease',
  };

  // ── STEP: Welcome ─────────────────────────────────────────────────────────
  if (step === 'welcome') return (
    <div style={overlayStyle}>
      <style>{`
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse-anchor {
          0%, 100% { transform: scale(1); }
          50%       { transform: scale(1.08); }
        }
      `}</style>
      <div style={cardStyle}>
        {/* Header gradient */}
        <div style={{
          background: 'linear-gradient(135deg, #0e2a4d 0%, #00B4D8 100%)',
          padding: '40px 40px 32px',
          textAlign: 'center',
        }}>
          <div style={{
            width: 72, height: 72, borderRadius: '50%',
            background: 'rgba(255,255,255,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px',
            animation: 'pulse-anchor 2.5s ease-in-out infinite',
          }}>
            <Anchor size={36} color="white" />
          </div>
          <h1 style={{ color: 'white', fontSize: 26, fontWeight: 800, margin: 0 }}>
            Welcome to MarComn!
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: 14, marginTop: 10, lineHeight: 1.6 }}>
            The professional network for maritime professionals.<br />
            Let's set up your profile in under a minute.
          </p>
        </div>

        <div style={{ padding: '28px 40px 36px' }}>
          {/* Feature bullets */}
          {[
            ['🚢', 'Connect with mariners worldwide'],
            ['📋', 'Share your sea-service experience'],
            ['📡', 'Get discovered by shipping companies'],
          ].map(([icon, text]) => (
            <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
              <span style={{ fontSize: 20 }}>{icon}</span>
              <span style={{ fontSize: 14, color: 'var(--text-primary, #1a2942)' }}>{text}</span>
            </div>
          ))}

          <button
            onClick={() => setStep('form')}
            style={{
              width: '100%', marginTop: 8,
              background: 'linear-gradient(135deg, #0e2a4d, #00B4D8)',
              color: 'white', border: 'none', borderRadius: 12,
              padding: '15px 0', fontSize: 16, fontWeight: 700,
              cursor: 'pointer', letterSpacing: 0.3,
            }}
          >
            Get Started →
          </button>
        </div>
      </div>
    </div>
  );

  // ── STEP: Form ────────────────────────────────────────────────────────────
  if (step === 'form') return (
    <div style={overlayStyle}>
      <div style={cardStyle}>
        {/* Progress bar */}
        <div style={{ height: 4, background: '#e2e8f0' }}>
          <div style={{ height: '100%', width: '60%', background: 'linear-gradient(90deg, #0e2a4d, #00B4D8)', borderRadius: 4, transition: 'width 0.4s' }} />
        </div>

        <div style={{ padding: '32px 36px 36px' }}>
          <h2 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 6px', color: 'var(--text-primary, #1a2942)' }}>
            Your professional identity
          </h2>
          <p style={{ fontSize: 14, color: 'var(--text-secondary, #64748b)', marginBottom: 24 }}>
            This is how the maritime community will know you.
          </p>

          {errors.global && (
            <div style={{ background: '#fee2e2', color: '#cc0000', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 16 }}>
              {errors.global}
            </div>
          )}

          {/* Full Name */}
          <div style={{ marginBottom: 18 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: 'var(--text-secondary, #64748b)', marginBottom: 6 }}>
              <User size={14} /> Full Name <span style={{ color: '#e53e3e' }}>*</span>
            </label>
            <input
              ref={nameRef}
              name="fullName"
              value={form.fullName}
              onChange={handleChange}
              placeholder="e.g. Efren Jr. Tiangco Vergara"
              className="form-input"
              style={{ borderColor: errors.fullName ? '#e53e3e' : undefined }}
            />
            {errors.fullName && <p style={{ color: '#e53e3e', fontSize: 12, marginTop: 4 }}>{errors.fullName}</p>}
          </div>

          {/* Headline */}
          <div style={{ marginBottom: 18 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: 'var(--text-secondary, #64748b)', marginBottom: 6 }}>
              <Briefcase size={14} /> Professional Headline <span style={{ color: '#e53e3e' }}>*</span>
            </label>
            <input
              name="headline"
              value={form.headline}
              onChange={handleChange}
              placeholder="e.g. Chief Officer | Master Mariner"
              className="form-input"
              style={{ borderColor: errors.headline ? '#e53e3e' : undefined }}
            />
            {errors.headline && <p style={{ color: '#e53e3e', fontSize: 12, marginTop: 4 }}>{errors.headline}</p>}
          </div>

          {/* Location with auto-suggest */}
          <div style={{ marginBottom: 28 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: 'var(--text-secondary, #64748b)', marginBottom: 6 }}>
              <MapPin size={14} /> Location <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-secondary, #94a3b8)' }}>(optional)</span>
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                name="location"
                value={form.location}
                onChange={handleChange}
                placeholder="e.g. Singapore"
                className="form-input"
                style={{ flex: 1 }}
              />
              <button
                onClick={suggestLocation}
                disabled={locLoading}
                title="Detect my location"
                style={{
                  padding: '0 14px', borderRadius: 10, border: '1px solid var(--border, #e2e8f0)',
                  background: 'var(--surface, #f8fafc)', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 6, fontSize: 13,
                  color: 'var(--text-secondary, #64748b)', whiteSpace: 'nowrap', flexShrink: 0,
                }}
              >
                {locLoading ? <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <MapPin size={14} />}
                {locLoading ? 'Detecting…' : 'Auto-detect'}
              </button>
            </div>
          </div>

          <button
            onClick={handleComplete}
            disabled={saving}
            style={{
              width: '100%',
              background: saving ? '#94a3b8' : 'linear-gradient(135deg, #0e2a4d, #00B4D8)',
              color: 'white', border: 'none', borderRadius: 12,
              padding: '15px 0', fontSize: 16, fontWeight: 700,
              cursor: saving ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            {saving
              ? <><Loader size={18} style={{ animation: 'spin 1s linear infinite' }} /> Saving…</>
              : <>Complete Profile <Check size={18} /></>}
          </button>
        </div>
      </div>
    </div>
  );

  // ── STEP: Success ─────────────────────────────────────────────────────────
  if (step === 'success') return (
    <div style={overlayStyle}>
      <div style={{ ...cardStyle, textAlign: 'center', padding: '52px 40px' }}>
        <div style={{
          width: 80, height: 80, borderRadius: '50%',
          background: 'linear-gradient(135deg, #0e2a4d, #00B4D8)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 20px',
        }}>
          <Check size={40} color="white" />
        </div>
        <h2 style={{ fontSize: 24, fontWeight: 800, margin: '0 0 10px' }}>You're all set!</h2>
        <p style={{ fontSize: 15, color: 'var(--text-secondary, #64748b)', lineHeight: 1.7 }}>
          Welcome aboard, <strong>{form.fullName}</strong>.<br />
          Your profile is live. Taking you to the Logbook…
        </p>
      </div>
    </div>
  );
}
