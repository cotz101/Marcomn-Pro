import { X, MapPin, Clock, Briefcase, DollarSign, Award, Ship, Compass, Anchor } from 'lucide-react';
import { useProfile } from '@/app/context/ProfileContext';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';

export default function JobDetailsModal({ job, onClose, onApply, onEdit }) {
  const { userId, openPostJobModal } = useProfile();
  const router = useRouter();
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  if (!job) return null;

  // Check both user_id and poster_id — different views populate different columns
  const isOwner = userId && (userId === job?.user_id || userId === job?.poster_id);

  // Determine display name
  const companyName = job.company?.name || (typeof job.company === 'string' ? job.company : null) || job.poster?.name || 'Private Poster';

  // Helper to select logo icon matching company name
  const getCompanyIcon = (company) => {
    if (!company) return <Briefcase size={28} className="text-blue-900" />;
    const name = typeof company === 'string' ? company.toLowerCase() : (company.name || '').toLowerCase();
    if (name.includes('wave')) {
      return <Ship size={28} className="text-blue-900" />;
    }
    if (name.includes('meridian')) {
      return <Compass size={28} className="text-blue-900" />;
    }
    if (name.includes('oceanic')) {
      return <Anchor size={28} className="text-blue-900" />;
    }
    return <Briefcase size={28} className="text-blue-900" />;
  };

  // Safe parsing of meta columns
  const payAmount = job.payAmount || job.pay_rate_amount || '';
  const currency = job.currency || 'USD';
  const payRate = job.payRate || job.pay_rate_period || 'Hour';
  const salaryRange = job.salary_range || (payAmount ? `${currency} ${payAmount}/${payRate}` : 'Competitive');
  
  const location = job.location || 'N/A';
  const jobType = job.employment_type || job.jobType || job.job_type || 'Full-time';
  const experienceLevel = job.experienceLevel || job.experience_level || 'Mid';
  const tags = job.required_skills || job.tags || [];

  const handleApplyClick = () => {
    console.log('Applying for Job ID:', job.id);
    if (onApply) {
      onApply(job);
    }
  };

  const handleDeleteJob = async () => {
    setIsDeleting(true);
    const supabase = createClient();
    const { error } = await supabase.from('jobs').delete().eq('id', job.id);
    setIsDeleting(false);
    
    if (!error) {
      setIsDeleteConfirmOpen(false);
      onClose();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('job-posted'));
      }
      router.refresh();
    } else {
      console.error('Error deleting job:', error);
      alert('Error deleting job: ' + error.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs transition-opacity duration-300">
      {/* Backdrop Closer */}
      <div className="absolute inset-0 cursor-default" onClick={onClose}></div>

      {/* Modal Container */}
      <div className="relative z-10 max-w-3xl w-full bg-white rounded-xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col transform transition-all duration-300 scale-100">
        
        {/* Sticky Header */}
        <div className="border-b border-gray-100 py-6 px-8 flex justify-between items-start gap-4 sticky top-0 bg-white z-10">
          <div className="flex gap-4 items-center">
            {/* Logo box */}
            <div className="w-16 h-16 bg-gray-50 border border-gray-100 rounded-md flex items-center justify-center flex-shrink-0">
              {getCompanyIcon(job.company)}
            </div>
            <div>
              <h3 className="text-xl font-bold text-blue-900 leading-tight">{job.title}</h3>
              <p className="text-sm font-semibold text-gray-800 mt-1">{companyName}</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="text-gray-400 hover:text-gray-600 hover:bg-gray-50 p-2 rounded-full transition-all"
            aria-label="Close Modal"
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="overflow-y-auto p-6 flex-1 space-y-6">
          
          {/* Meta Grid */}
          <div className="bg-gray-50/50 rounded-lg p-5 border border-gray-100">
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Job Overview</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center text-blue-900 flex-shrink-0">
                  <DollarSign size={18} />
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-medium">Compensation</p>
                  <p className="text-sm font-bold text-gray-800">{salaryRange}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center text-blue-900 flex-shrink-0">
                  <MapPin size={18} />
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-medium">Location</p>
                  <p className="text-sm font-bold text-gray-800">{location}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center text-blue-900 flex-shrink-0">
                  <Clock size={18} />
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-medium">Job Type</p>
                  <p className="text-sm font-bold text-gray-800">{jobType}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center text-blue-900 flex-shrink-0">
                  <Award size={18} />
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-medium">Experience Level</p>
                  <p className="text-sm font-bold text-gray-800">{experienceLevel}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Required Skills Tags */}
          {tags.length > 0 && (
            <div>
              <label className="text-sm font-semibold text-gray-700 block mb-1.5">Required Skills</label>
              <div className="flex flex-wrap gap-2">
                {tags.map((tag, index) => (
                  <span 
                    key={index} 
                    className="bg-blue-50 text-blue-700 px-3 py-1.5 rounded-md text-xs font-semibold border border-blue-100 shadow-2xs"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Job Description */}
          {job.description && (
            <div>
              <label className="text-sm font-semibold text-gray-700 block mb-1.5">Job Description</label>
              <div className="bg-white border border-gray-100 rounded-lg p-4">
                <div 
                  className="prose prose-sm max-w-none text-gray-700 text-sm leading-relaxed rich-text-content"
                  dangerouslySetInnerHTML={{ __html: job.description }}
                />
              </div>
            </div>
          )}

          {/* Responsibilities */}
          {job.responsibilities && (
            <div>
              <label className="text-sm font-semibold text-gray-700 block mb-1.5">Responsibilities</label>
              <div className="bg-white border border-gray-100 rounded-lg p-4">
                <div 
                  className="prose prose-sm max-w-none text-gray-700 text-sm leading-relaxed rich-text-content"
                  dangerouslySetInnerHTML={{ __html: job.responsibilities }}
                />
              </div>
            </div>
          )}
          
        </div>

        {/* Sticky Footer */}
        <div className="flex items-center justify-end gap-3 pt-4 pb-6 px-6 border-t border-[var(--outline)] bg-gray-50 sticky bottom-0 z-10">
          {isOwner && (
            <button 
              className="px-6 py-2.5 bg-red-50 text-red-600 hover:bg-red-100 text-sm font-semibold rounded-lg transition-colors mr-auto"
              onClick={() => setIsDeleteConfirmOpen(true)}
            >
              Delete Posting
            </button>
          )}
          <button 
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium hover:bg-slate-100 rounded-lg text-gray-700"
          >
            Cancel
          </button>
          {isOwner ? (
            <button 
              className="btn-primary-pill px-6 bg-gray-100 hover:bg-gray-200 border border-gray-300 text-[#42474f]"
              style={{ backgroundColor: '#f3f4f6', color: '#42474f' }}
              onClick={() => {
                if (onEdit) {
                  // Parent's bridge: closes this modal + sets jobToEdit + opens PostJobModal
                  onEdit(job);
                } else {
                  // Fallback: use global context (closes modal manually first)
                  onClose();
                  openPostJobModal(job);
                }
              }}
            >
              Edit Job
            </button>
          ) : (
            <button 
              onClick={handleApplyClick}
              className="btn-primary-pill px-6"
            >
              Quick Apply
            </button>
          )}
        </div>

      </div>

      {/* Delete Confirmation Modal */}
      {isDeleteConfirmOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="max-w-md w-full bg-white rounded-xl p-6 shadow-2xl flex flex-col relative z-10">
            <h3 className="text-xl font-bold text-gray-900 mb-2">Delete Job Posting?</h3>
            <p className="text-sm text-gray-600 mb-6">
              Are you sure you want to permanently delete this opportunity? This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button 
                onClick={() => setIsDeleteConfirmOpen(false)}
                className="px-4 py-2 text-sm font-medium hover:bg-slate-100 rounded-lg text-gray-700"
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button 
                onClick={handleDeleteJob}
                className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg text-sm font-semibold transition-colors"
                disabled={isDeleting}
              >
                {isDeleting ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
