'use client';
import { useState, useEffect, useRef } from 'react';
import { Anchor, Check, MapPin, Loader2 as Loader, ArrowRight, User, Briefcase } from 'lucide-react';
import { createClient } from '@/lib/supabase';
import BaseModal from '../layout/BaseModal';

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

  useEffect(() => {
    if (step === 'form') setTimeout(() => nameRef.current?.focus(), 100);
  }, [step]);

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
        }
        setLocLoading(false);
      },
      () => setLocLoading(false),
      { timeout: 8000 }
    );
  };

  const validate = () => {
    const errs = {};
    if (!form.fullName.trim()) errs.fullName = 'Your name is required.';
    if (!form.headline.trim()) errs.headline = 'A short headline helps others find you.';
    return errs;
  };

  const handleComplete = async () => {
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from('profiles').upsert({
      id: userId,
      name: form.fullName.trim(),
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

  return (
    <BaseModal 
      isOpen={true} 
      onClose={() => {}} 
      title="Welcome to MarComn"
      hideCloseButton={true}
    >
      {step === 'welcome' && (
        <div className="flex flex-col">
          <div className="text-center mb-8">
            <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-[#004173] flex items-center justify-center">
              <Anchor size={32} color="white" />
            </div>
            <h2 className="text-2xl font-bold text-[var(--on-surface)]">A Professional Network for Mariners</h2>
            <p className="text-[var(--on-surface-variant)] text-sm mt-2">
              Let's set up your profile in under a minute.
            </p>
          </div>

          <div className="space-y-4 mb-8">
            {[
              ['🚢', 'Connect with mariners worldwide'],
              ['📋', 'Share your sea-service experience'],
              ['📡', 'Get discovered by shipping companies'],
            ].map(([icon, text]) => (
              <div key={text} className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 border border-slate-100">
                <span className="text-xl">{icon}</span>
                <span className="text-sm font-medium text-[var(--on-surface)]">{text}</span>
              </div>
            ))}
          </div>

          <button
            onClick={() => setStep('form')}
            className="btn-primary-pill h-12 w-full"
          >
            Get Started <ArrowRight size={18} />
          </button>
        </div>
      )}

      {step === 'form' && (
        <div className="flex flex-col">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-[var(--on-surface)]">Your professional identity</h2>
            <p className="text-sm text-[var(--on-surface-variant)]">
              This is how the maritime community will know you.
            </p>
          </div>

          {errors.global && (
            <div className="bg-red-50 text-red-600 p-3 rounded-lg text-xs mb-4">
              {errors.global}
            </div>
          )}

          <div className="space-y-4">
            <div className="form-group">
              <label className="block text-sm font-semibold mb-2">
                <User size={14} className="inline mr-1" /> Full Name *
              </label>
              <input
                ref={nameRef}
                name="fullName"
                value={form.fullName}
                onChange={handleChange}
                placeholder="e.g. Efren Jr. Tiangco Vergara"
                className="w-full p-2.5 border rounded-lg outline-none focus:border-[var(--primary)]"
                style={{ borderColor: errors.fullName ? 'var(--error)' : undefined }}
              />
              {errors.fullName && <p className="text-red-500 text-[10px] mt-1">{errors.fullName}</p>}
            </div>

            <div className="form-group">
              <label className="block text-sm font-semibold mb-2">
                <Briefcase size={14} className="inline mr-1" /> Professional Headline *
              </label>
              <input
                name="headline"
                value={form.headline}
                onChange={handleChange}
                placeholder="e.g. Chief Officer | Master Mariner"
                className="w-full p-2.5 border rounded-lg outline-none focus:border-[var(--primary)]"
                style={{ borderColor: errors.headline ? 'var(--error)' : undefined }}
              />
              {errors.headline && <p className="text-red-500 text-[10px] mt-1">{errors.headline}</p>}
            </div>

            <div className="form-group">
              <label className="block text-sm font-semibold mb-2">
                <MapPin size={14} className="inline mr-1" /> Location (optional)
              </label>
              <div className="flex gap-2">
                <input
                  name="location"
                  value={form.location}
                  onChange={handleChange}
                  placeholder="e.g. Singapore"
                  className="w-full p-2.5 border rounded-lg outline-none focus:border-[var(--primary)] flex-1"
                />
                <button
                  onClick={suggestLocation}
                  disabled={locLoading}
                  className="px-4 rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-low)] text-sm text-[var(--on-surface-variant)] flex items-center gap-2"
                >
                  {locLoading ? <Loader size={14} className="animate-spin" /> : <MapPin size={14} />}
                  {locLoading ? '...' : 'Auto'}
                </button>
              </div>
            </div>
          </div>

          <button
            onClick={handleComplete}
            disabled={saving}
            className="btn-primary-pill h-12 w-full mt-8"
          >
            {saving
              ? <><Loader size={18} className="animate-spin" /> Saving…</>
              : <>Complete Profile <Check size={18} /></>}
          </button>
        </div>
      )}

      {step === 'success' && (
        <div className="text-center py-12">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[var(--primary)] to-[#00B4D8] flex items-center justify-center mx-auto mb-6 shadow-lg">
            <Check size={40} color="white" />
          </div>
          <h2 className="text-2xl font-bold mb-2">You're all set!</h2>
          <p className="text-[var(--on-surface-variant)] leading-relaxed">
            Welcome aboard, <strong>{form.fullName}</strong>.<br />
            Your profile is live. Taking you to the Logbook…
          </p>
        </div>
      )}
    </BaseModal>
  );
}
