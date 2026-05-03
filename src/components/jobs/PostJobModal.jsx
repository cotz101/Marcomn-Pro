'use client';
import { X, Briefcase, MapPin, DollarSign, Clock, Check, ChevronRight, ChevronLeft } from 'lucide-react';
import { useState } from 'react';
import { createClient } from '@/lib/supabase';
import { useProfile } from '@/app/context/ProfileContext';

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
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: 600 }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 8, background: '#e0f2fe', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#00B4D8' }}>
              <Briefcase size={20} />
            </div>
            <div>
              <h2 style={{ margin: 0 }}>Post a Job</h2>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)' }}>Step {step} of 2</p>
            </div>
          </div>
          <button className="btn-close" onClick={onClose}><X size={20} /></button>
        </div>

        <div className="modal-body" style={{ minHeight: 300 }}>
          {step === 1 && (
            <div className="fade-in">
              <div className="form-group">
                <label>Job Title</label>
                <input 
                  type="text" 
                  name="title" 
                  className="form-input" 
                  placeholder="e.g. Master Mariner, Chief Engineer"
                  value={formData.title}
                  onChange={handleInputChange}
                />
              </div>
              <div className="form-group">
                <label>Employment Type</label>
                <select 
                  name="employment_type" 
                  className="form-input" 
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
                <label>Job Description</label>
                <textarea 
                  name="description" 
                  className="form-textarea" 
                  rows={6}
                  placeholder="Describe the role, responsibilities, and requirements..."
                  value={formData.description}
                  onChange={handleInputChange}
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="fade-in">
              <div className="form-group">
                <label><MapPin size={14} inline /> Location</label>
                <input 
                  type="text" 
                  name="location" 
                  className="form-input" 
                  placeholder="e.g. London, Remote, Singapore"
                  value={formData.location}
                  onChange={handleInputChange}
                />
              </div>
              <div className="form-group">
                <label><DollarSign size={14} inline /> Salary Range (Optional)</label>
                <input 
                  type="text" 
                  name="salary_range" 
                  className="form-input" 
                  placeholder="e.g. $80k - $120k, Competitive"
                  value={formData.salary_range}
                  onChange={handleInputChange}
                />
              </div>
              <div style={{ background: '#f8fafc', padding: 16, borderRadius: 8, marginTop: 20 }}>
                <h4 style={{ margin: '0 0 8px 0', fontSize: 14 }}>Posting as:</h4>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <img 
                    src={isCompany ? (currentIdentity.data.logo_url || '/favicon.svg') : (profile?.profilePic || '/profile_pic.png')} 
                    style={{ width: 32, height: 32, borderRadius: isCompany ? 4 : '50%', objectFit: 'cover' }} 
                    alt="" 
                  />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{identityName}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{isCompany ? 'Company Profile' : 'Individual Profile'}</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          {step > 1 && (
            <button className="btn-secondary" onClick={() => setStep(step - 1)}>
              <ChevronLeft size={18} /> Back
            </button>
          )}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 12 }}>
            <button className="btn-secondary" onClick={onClose}>Cancel</button>
            {step < 2 ? (
              <button 
                className="btn-primary" 
                onClick={() => setStep(step + 1)}
                disabled={!formData.title || !formData.description}
              >
                Next <ChevronRight size={18} />
              </button>
            ) : (
              <button 
                className="btn-primary" 
                onClick={handleSubmit}
                disabled={loading || !formData.location}
              >
                {loading ? 'Posting...' : 'Post Job Now'}
              </button>
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0,0,0,0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 2000;
          backdrop-filter: blur(4px);
        }
        .modal-content {
          background: white;
          width: 90%;
          border-radius: 12px;
          display: flex;
          flex-col: column;
          box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1);
        }
        .modal-header {
          padding: 20px;
          border-bottom: 1px solid #f1f5f9;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .modal-body {
          padding: 20px;
          max-height: 70vh;
          overflow-y: auto;
        }
        .modal-footer {
          padding: 20px;
          border-top: 1px solid #f1f5f9;
          display: flex;
          align-items: center;
        }
        .btn-close {
          background: none;
          border: none;
          cursor: pointer;
          color: #94a3b8;
          padding: 4px;
        }
        .form-group {
          margin-bottom: 20px;
        }
        .form-group label {
          display: block;
          font-size: 14px;
          font-weight: 600;
          margin-bottom: 8px;
          color: #334155;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .form-input {
          width: 100%;
          padding: 10px 12px;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          font-size: 14px;
          outline: none;
          transition: border-color 0.2s;
        }
        .form-input:focus {
          border-color: #00B4D8;
        }
        .form-textarea {
          width: 100%;
          padding: 10px 12px;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          font-size: 14px;
          outline: none;
          resize: vertical;
          min-height: 120px;
        }
        .form-textarea:focus {
          border-color: #00B4D8;
        }
        .fade-in {
          animation: fadeIn 0.3s ease-in-out;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
