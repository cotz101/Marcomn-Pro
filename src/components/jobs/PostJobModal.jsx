import { X, Briefcase, MapPin, DollarSign, Clock, Check, ChevronRight, ChevronLeft } from 'lucide-react';
import { useState } from 'react';
import { createClient } from '@/lib/supabase';
import { useProfile } from '@/app/context/ProfileContext';
import BaseModal from '../layout/BaseModal';

export default function PostJobModal({ isOpen, onClose, onComplete }) {
  const { currentIdentity, userId, profile } = useProfile();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    location: '',
    salary_range: '',
    employment_type: 'Full-time'
  });

  if (!isOpen) return null;

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const isCompany = currentIdentity?.type === 'company';
  const identityName = isCompany ? currentIdentity.data.name : (profile?.fullName || 'Anonymous');

  const handleSubmit = async () => {
    setLoading(true);
    const supabase = createClient();

    // 1. Insert into jobs table
    const { data: jobData, error: jobError } = await supabase
      .from('jobs')
      .insert({
        title: formData.title,
        description: formData.description,
        location: formData.location,
        salary_range: formData.salary_range,
        employment_type: formData.employment_type,
        company_id: isCompany ? currentIdentity.id : null,
        poster_id: userId,
        status: 'Open'
      })
      .select()
      .single();

    if (jobError) {
      alert('Error creating job: ' + jobError.message);
      setLoading(false);
      return;
    }

    // 2. Create a post in the feed
    const postContent = `${identityName} is hiring for ${formData.title}! Check it out.`;
    const { error: postError } = await supabase
      .from('posts')
      .insert({
        user_id: userId,
        content: postContent,
        posted_as_company_id: isCompany ? currentIdentity.id : null,
        media_type: 'image' // Default
      });

    if (postError) {
      console.error('Error creating feed post:', postError.message);
    }

    setLoading(false);
    onComplete(jobData);
  };

  return (
    <BaseModal 
      isOpen={isOpen} 
      onClose={onClose} 
      title="Post a Job"
    >
      <div className="flex flex-col">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-500">
            <Briefcase size={20} />
          </div>
          <div>
            <p className="text-xs text-[var(--on-surface-variant)]">Step {step} of 2</p>
          </div>
        </div>

        <div className="min-h-[300px]">
          {step === 1 && (
            <div className="space-y-4">
              <div className="form-group">
                <label className="block text-sm font-semibold mb-2">Job Title</label>
                <input 
                  type="text" 
                  name="title" 
                  className="w-full p-2.5 border rounded-lg outline-none focus:border-[var(--primary)]" 
                  placeholder="e.g. Master Mariner, Chief Engineer"
                  value={formData.title}
                  onChange={handleInputChange}
                />
              </div>
              <div className="form-group">
                <label className="block text-sm font-semibold mb-2">Employment Type</label>
                <select 
                  name="employment_type" 
                  className="w-full p-2.5 border rounded-lg outline-none focus:border-[var(--primary)]" 
                  value={formData.employment_type}
                  onChange={handleInputChange}
                >
                  <option value="Full-time">Full-time</option>
                  <option value="Contract">Contract</option>
                  <option value="Part-time">Part-time</option>
                  <option value="Internship">Internship</option>
                </select>
              </div>
              <div className="form-group">
                <label className="block text-sm font-semibold mb-2">Job Description</label>
                <textarea 
                  name="description" 
                  className="w-full p-2.5 border rounded-lg outline-none focus:border-[var(--primary)] min-h-[150px]" 
                  rows={6}
                  placeholder="Describe the role, responsibilities, and requirements..."
                  value={formData.description}
                  onChange={handleInputChange}
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="form-group">
                <label className="flex items-center gap-2 text-sm font-semibold mb-2"><MapPin size={14} /> Location</label>
                <input 
                  type="text" 
                  name="location" 
                  className="w-full p-2.5 border rounded-lg outline-none focus:border-[var(--primary)]" 
                  placeholder="e.g. London, Remote, Singapore"
                  value={formData.location}
                  onChange={handleInputChange}
                />
              </div>
              <div className="form-group">
                <label className="flex items-center gap-2 text-sm font-semibold mb-2"><DollarSign size={14} /> Salary Range (Optional)</label>
                <input 
                  type="text" 
                  name="salary_range" 
                  className="w-full p-2.5 border rounded-lg outline-none focus:border-[var(--primary)]" 
                  placeholder="e.g. $80k - $120k, Competitive"
                  value={formData.salary_range}
                  onChange={handleInputChange}
                />
              </div>
              <div className="bg-slate-50 p-4 rounded-lg mt-5">
                <h4 className="text-sm font-semibold mb-2">Posting as:</h4>
                <div className="flex items-center gap-3">
                  <img 
                    src={isCompany ? (currentIdentity.data.logo_url || '/favicon.svg') : (profile?.profilePic || '/profile_pic.png')} 
                    className="w-8 h-8 object-cover"
                    style={{ borderRadius: isCompany ? '4px' : '50%' }} 
                    alt="" 
                  />
                  <div>
                    <div className="font-semibold text-sm">{identityName}</div>
                    <div className="text-xs text-[var(--on-surface-variant)]">{isCompany ? 'Company Profile' : 'Individual Profile'}</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between mt-8 pt-4 border-t border-[var(--outline)]">
          {step > 1 ? (
            <button className="flex items-center gap-2 text-sm font-medium hover:text-[var(--primary)]" onClick={() => setStep(step - 1)}>
              <ChevronLeft size={18} /> Back
            </button>
          ) : (
            <div></div>
          )}
          <div className="flex gap-3">
            <button className="px-4 py-2 text-sm font-medium hover:bg-slate-100 rounded-lg" onClick={onClose}>Cancel</button>
            {step < 2 ? (
              <button 
                className="btn-primary-pill px-6" 
                onClick={() => setStep(step + 1)}
                disabled={!formData.title || !formData.description}
              >
                Next <ChevronRight size={18} className="inline ml-1" />
              </button>
            ) : (
              <button 
                className="btn-primary-pill px-6" 
                onClick={handleSubmit}
                disabled={loading || !formData.location}
              >
                {loading ? 'Posting...' : 'Post Job Now'}
              </button>
            )}
          </div>
        </div>
      </div>
    </BaseModal>
  );
}
