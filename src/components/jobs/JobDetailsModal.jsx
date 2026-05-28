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
    if (!company) return <Briefcase size={22} className="text-white" />;
    const name = typeof company === 'string' ? company.toLowerCase() : (company.name || '').toLowerCase();
    if (name.includes('wave')) {
      return <Ship size={22} className="text-white" />;
    }
    if (name.includes('meridian')) {
      return <Compass size={22} className="text-white" />;
    }
    if (name.includes('oceanic')) {
      return <Anchor size={22} className="text-white" />;
    }
    return <Briefcase size={22} className="text-white" />;
  };

  // Safe parsing of meta columns
  const payAmount = job.payAmount || job.pay_rate_amount || '';
  const currency = job.currency || 'USD';
  const payRate = job.payRate || job.pay_rate_period || 'Hour';
  const salaryRange = job.salary_range || (payAmount ? `${currency} ${payAmount}/${payRate}` : 'Competitive');
  
  const location = job.location || 'N/A';
  const jobType = job.employment_type || job.jobType || job.job_type || 'Full-time';
  const experienceLevel = job.experienceLevel || job.experience_level || 'Mid';
  const requiredSkills = job.required_skills || [];
  const jobTags = job.tags || [];

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
        
        {/* Dark Navy Sticky Header */}
        <div className="bg-[#002b4e] text-white py-5 px-8 flex justify-between items-center gap-4 sticky top-0 z-10 shadow-sm">
          <div className="flex gap-4 items-center">
            {/* Logo box */}
            <div className="w-12 h-12 bg-white/10 rounded-lg flex items-center justify-center flex-shrink-0 border border-white/20">
              {getCompanyIcon(job.company)}
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-extrabold leading-tight text-white">{job.title}</h3>
              <p className="text-xs sm:text-sm font-semibold text-slate-200 mt-0.5">{companyName}</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="text-white/70 hover:text-white hover:bg-white/10 p-2 rounded-full transition-all flex-shrink-0 active:scale-95 cursor-pointer"
            aria-label="Close Modal"
          >
            <X size={20} strokeWidth={2.5} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="overflow-y-auto p-6 sm:p-8 flex-1 space-y-6">
          
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

          {/* Skills and Tags Columns Grid */}
          {(requiredSkills.length > 0 || jobTags.length > 0) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Required Skills Column */}
              {requiredSkills.length > 0 && (
                <div>
                  <label className="text-sm font-semibold text-gray-700 block mb-1.5 pl-4">Required Skills</label>
                  <div className="bg-white border border-gray-100 rounded-lg p-4 flex flex-wrap gap-2.5 min-h-[60px] items-center">
                    {requiredSkills.map((tag, index) => (
                      <span 
                        key={index} 
                        className="bg-blue-50 text-blue-700 px-3.5 py-1.5 rounded-md text-xs font-semibold border border-blue-100 shadow-2xs"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Job Tags Column */}
              {jobTags.length > 0 && (
                <div>
                  <label className="text-sm font-semibold text-gray-700 block mb-1.5 pl-4">Job Tags</label>
                  <div className="bg-white border border-gray-100 rounded-lg p-4 flex flex-wrap gap-2.5 min-h-[60px] items-center">
                    {jobTags.map((tag, index) => (
                      <span 
                        key={index} 
                        className="bg-emerald-50 text-emerald-700 px-3.5 py-1.5 rounded-full text-xs font-semibold border border-emerald-100 shadow-2xs"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Job Description */}
          {job.description && (
            <div>
              <label className="text-sm font-semibold text-gray-700 block mb-1.5 pl-4">Job Description</label>
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
              <label className="text-sm font-semibold text-gray-700 block mb-1.5 pl-4">Responsibilities</label>
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
          <div className="max-w-md w-full bg-white rounded-xl shadow-2xl flex flex-col relative z-10 overflow-hidden animate-in fade-in zoom-in duration-200">
            {/* Header Area with Navy Blue background */}
            <div className="bg-[#002b4e] text-white py-4 px-6 text-center">
              <h3 className="text-lg font-bold">Delete Job Posting?</h3>
            </div>
            
            {/* Body Area */}
            <div className="p-8 text-center flex flex-col items-center">
              <p className="text-sm text-gray-600 leading-relaxed mb-6 max-w-sm">
                Are you sure you want to permanently delete this opportunity? This action cannot be undone.
              </p>
              
              {/* Buttons Row with centering and clear margins */}
              <div className="flex items-center justify-center gap-4 w-full mt-2">
                <button 
                  onClick={() => setIsDeleteConfirmOpen(false)}
                  className="px-5 py-2.5 border border-gray-300 hover:bg-gray-50 rounded-lg text-sm font-semibold text-gray-700 transition-colors cursor-pointer w-1/2"
                  disabled={isDeleting}
                >
                  Cancel
                </button>
                <button 
                  onClick={handleDeleteJob}
                  className="bg-red-600 hover:bg-red-700 text-white px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors cursor-pointer w-1/2 flex items-center justify-center"
                  disabled={isDeleting}
                >
                  {isDeleting ? 'Deleting...' : 'Confirm Delete'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
