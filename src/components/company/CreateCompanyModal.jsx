import { useState } from 'react';
import { createClient } from '@/lib/supabase';
import { X, Building2, Globe, MapPin, Briefcase, Check, Loader } from 'lucide-react';
import BaseModal from '../layout/BaseModal';

export default function CreateCompanyModal({ userId, onComplete, onClose }) {
  const [form, setForm] = useState({
    name: '',
    industry: '',
    website: '',
    location: '',
    bio: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return setError('Company name is required');

    setSaving(true);
    setError(null);
    const supabase = createClient();

    try {
      // 1. Create the company
      const { data: company, error: companyError } = await supabase
        .from('companies')
        .insert({
          name: form.name.trim(),
          industry: form.industry.trim(),
          website: form.website.trim(),
          location: form.location.trim(),
          bio: form.bio.trim(),
        })
        .select()
        .maybeSingle();

      if (companyError) throw companyError;

      // 2. Link the user as Owner
      const { error: memberError } = await supabase
        .from('company_members')
        .insert({
          company_id: company.id,
          profile_id: userId,
          role: 'Owner',
        });

      if (memberError) throw memberError;

      onComplete(company);
    } catch (err) {
      console.error('Error creating company:', err);
      setError(err.message || 'Failed to create company profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <BaseModal 
      isOpen={true} 
      onClose={onClose} 
      title="Create Company Profile"
      maxWidth="500px"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm border border-red-100">
            {error}
          </div>
        )}

        <div className="form-group">
          <label className="block text-sm font-semibold mb-2">Company Name *</label>
          <input 
            name="name"
            className="w-full p-2.5 border rounded-lg outline-none focus:border-[var(--primary)]" 
            placeholder="e.g. Marcomn Shipping Ltd" 
            value={form.name}
            onChange={handleChange}
            required
          />
        </div>

        <div className="form-group">
          <label className="block text-sm font-semibold mb-2">Industry</label>
          <div className="relative">
            <Briefcase size={16} className="absolute left-3 top-3 text-slate-400" />
            <input 
              name="industry"
              className="w-full p-2.5 pl-10 border rounded-lg outline-none focus:border-[var(--primary)]" 
              placeholder="e.g. Logistics & Supply Chain" 
              value={form.industry}
              onChange={handleChange}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="form-group">
            <label className="block text-sm font-semibold mb-2">Website</label>
            <div className="relative">
              <Globe size={16} className="absolute left-3 top-3 text-slate-400" />
              <input 
                name="website"
                className="w-full p-2.5 pl-10 border rounded-lg outline-none focus:border-[var(--primary)]" 
                placeholder="https://..." 
                value={form.website}
                onChange={handleChange}
              />
            </div>
          </div>
          <div className="form-group">
            <label className="block text-sm font-semibold mb-2">Location</label>
            <div className="relative">
              <MapPin size={16} className="absolute left-3 top-3 text-slate-400" />
              <input 
                name="location"
                className="w-full p-2.5 pl-10 border rounded-lg outline-none focus:border-[var(--primary)]" 
                placeholder="e.g. London, UK" 
                value={form.location}
                onChange={handleChange}
              />
            </div>
          </div>
        </div>

        <div className="form-group">
          <label className="block text-sm font-semibold mb-2">About Company</label>
          <textarea 
            name="bio"
            className="w-full p-2.5 border rounded-lg outline-none focus:border-[var(--primary)]" 
            placeholder="Tell us about your company's mission and services..." 
            value={form.bio}
            onChange={handleChange}
            rows={4}
          />
        </div>

        <div className="pt-4">
          <button 
            type="submit" 
            className="btn-primary-pill w-full h-12 flex items-center justify-center" 
            disabled={saving}
          >
            {saving ? <Loader size={20} className="animate-spin" /> : 'Establish Company Profile'}
          </button>
        </div>
      </form>
    </BaseModal>
  );
}
