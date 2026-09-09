'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase';
import { Globe, MapPin, Briefcase, Loader } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogFooter,
} from '@/src/components/ui/dialog';

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
      const { data: company, error: companyError } = await supabase
        .rpc('create_company_with_owner', {
          p_name: form.name.trim(),
          p_industry: form.industry.trim(),
          p_website: form.website.trim(),
          p_location: form.location.trim(),
          p_bio: form.bio.trim(),
        });

      if (companyError) throw companyError;

      onComplete(company);
    } catch (err) {
      console.error('Error creating company:', err);
      setError(err.message || 'Failed to create company profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      isOpen={true}
      onClose={saving ? undefined : onClose}
      disableBackdropClick={saving}
      disableEscapeKey={saving}
    >
      <DialogContent maxWidth="lg" className="sm:max-w-[520px]">
        <DialogHeader title="Create Company Profile" />
        <form id="create-company-form" onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <DialogBody className="space-y-4">
            {error && (
              <div className="bg-rose-50 text-rose-700 p-3.5 rounded-xl text-sm border border-rose-100 flex items-start gap-2.5">
                <span>{error}</span>
              </div>
            )}

            <div className="create-company-form-fields">
              <div className="create-company-field-group">
                <label htmlFor="company-name" className="text-sm font-semibold text-slate-800">
                  Company Name <span className="text-rose-500">*</span>
                </label>
                <input
                  id="company-name"
                  name="name"
                  type="text"
                  className="w-full h-11 px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#002b4e] focus:ring-1 focus:ring-[#002b4e] transition-colors"
                  placeholder="e.g. Marcomn Shipping Ltd"
                  value={form.name}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="create-company-field-group">
                <label htmlFor="company-industry" className="text-sm font-semibold text-slate-800">
                  Industry
                </label>
                <div className="relative flex items-center">
                  <Briefcase size={17} className="absolute left-3.5 text-slate-400 pointer-events-none" />
                  <input
                    id="company-industry"
                    name="industry"
                    type="text"
                    className="w-full h-11 pl-10 pr-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#002b4e] focus:ring-1 focus:ring-[#002b4e] transition-colors"
                    placeholder="e.g. Logistics & Supply Chain"
                    value={form.industry}
                    onChange={handleChange}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="create-company-field-group">
                  <label htmlFor="company-website" className="text-sm font-semibold text-slate-800">
                    Website
                  </label>
                  <div className="relative flex items-center">
                    <Globe size={17} className="absolute left-3.5 text-slate-400 pointer-events-none" />
                    <input
                      id="company-website"
                      name="website"
                      type="text"
                      className="w-full h-11 pl-10 pr-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#002b4e] focus:ring-1 focus:ring-[#002b4e] transition-colors"
                      placeholder="https://..."
                      value={form.website}
                      onChange={handleChange}
                    />
                  </div>
                </div>

                <div className="create-company-field-group">
                  <label htmlFor="company-location" className="text-sm font-semibold text-slate-800">
                    Location
                  </label>
                  <div className="relative flex items-center">
                    <MapPin size={17} className="absolute left-3.5 text-slate-400 pointer-events-none" />
                    <input
                      id="company-location"
                      name="location"
                      type="text"
                      className="w-full h-11 pl-10 pr-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#002b4e] focus:ring-1 focus:ring-[#002b4e] transition-colors"
                      placeholder="e.g. London, UK"
                      value={form.location}
                      onChange={handleChange}
                    />
                  </div>
                </div>
              </div>

              <div className="create-company-field-group">
                <label htmlFor="company-bio" className="text-sm font-semibold text-slate-800">
                  About Company
                </label>
                <textarea
                  id="company-bio"
                  name="bio"
                  className="w-full p-3.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#002b4e] focus:ring-1 focus:ring-[#002b4e] transition-colors resize-y leading-relaxed"
                  placeholder="Tell us about your company's mission and services..."
                  value={form.bio}
                  onChange={handleChange}
                  rows={4}
                />
              </div>
            </div>
          </DialogBody>

          <DialogFooter>
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="w-full sm:w-auto px-5 py-2.5 min-h-[44px] rounded-xl border border-slate-200 bg-white text-slate-700 text-sm font-semibold hover:bg-slate-50 active:bg-slate-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="w-full sm:w-auto px-6 py-2.5 min-h-[44px] rounded-xl bg-[#00B4D8] hover:bg-[#0096c7] text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer shadow-xs"
            >
              {saving ? (
                <>
                  <Loader size={18} className="animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>Establish Company Profile</span>
              )}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
