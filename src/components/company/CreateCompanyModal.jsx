'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase';
import { X, Building2, Globe, MapPin, Briefcase, Check, Loader } from 'lucide-react';

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
        .single();

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
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: 500 }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ padding: 8, background: '#e0f2fe', borderRadius: 8, color: '#0369a1' }}>
              <Building2 size={20} />
            </div>
            <h2 style={{ margin: 0 }}>Create Company Profile</h2>
          </div>
          <button className="btn-close" onClick={onClose}><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body">
          {error && (
            <div style={{ background: '#fee2e2', color: '#b91c1c', padding: 12, borderRadius: 8, fontSize: 13 }}>
              {error}
            </div>
          )}

          <div className="form-group">
            <label>Company Name *</label>
            <input 
              name="name"
              className="form-input" 
              placeholder="e.g. Marcomn Shipping Ltd" 
              value={form.name}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label>Industry</label>
            <div style={{ position: 'relative' }}>
              <Briefcase size={16} style={{ position: 'absolute', left: 12, top: 10, color: '#94a3b8' }} />
              <input 
                name="industry"
                className="form-input" 
                style={{ paddingLeft: 38 }}
                placeholder="e.g. Logistics & Supply Chain" 
                value={form.industry}
                onChange={handleChange}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label>Website</label>
              <div style={{ position: 'relative' }}>
                <Globe size={16} style={{ position: 'absolute', left: 12, top: 10, color: '#94a3b8' }} />
                <input 
                  name="website"
                  className="form-input" 
                  style={{ paddingLeft: 38 }}
                  placeholder="https://..." 
                  value={form.website}
                  onChange={handleChange}
                />
              </div>
            </div>
            <div className="form-group">
              <label>Location</label>
              <div style={{ position: 'relative' }}>
                <MapPin size={16} style={{ position: 'absolute', left: 12, top: 10, color: '#94a3b8' }} />
                <input 
                  name="location"
                  className="form-input" 
                  style={{ paddingLeft: 38 }}
                  placeholder="e.g. London, UK" 
                  value={form.location}
                  onChange={handleChange}
                />
              </div>
            </div>
          </div>

          <div className="form-group">
            <label>About Company</label>
            <textarea 
              name="bio"
              className="form-textarea" 
              placeholder="Tell us about your company's mission and services..." 
              value={form.bio}
              onChange={handleChange}
              rows={4}
            />
          </div>

          <div style={{ marginTop: 8 }}>
            <button 
              type="submit" 
              className="btn-primary" 
              style={{ width: '100%', height: 44, borderRadius: 10 }}
              disabled={saving}
            >
              {saving ? <Loader size={20} className="animate-spin" /> : 'Establish Company Profile'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
