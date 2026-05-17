import { X, MapPin, Clock, Briefcase, DollarSign, Award, Ship, Compass, Anchor } from 'lucide-react';
import { useProfile } from '@/app/context/ProfileContext';

export default function JobDetailsModal({ job, onClose, onApply }) {
  const { userId } = useProfile();
  if (!job) return null;

  const isPoster = userId && (
    userId === job.poster_id || 
    userId === job.user_id || 
    userId === job.creator_id || 
    userId === job.poster?.id
  );

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs transition-opacity duration-300">
      {/* Backdrop Closer */}
      <div className="absolute inset-0 cursor-default" onClick={onClose}></div>

      {/* Modal Container */}
      <div className="relative z-10 max-w-3xl w-full bg-white rounded-xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col transform transition-all duration-300 scale-100">
        
        {/* Sticky Header */}
        <div className="border-b border-gray-100 p-6 flex justify-between items-start gap-4 sticky top-0 bg-white z-10">
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
              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Required Skills</h4>
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
              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Job Description</h4>
              <div className="bg-white border border-gray-100 rounded-lg p-4">
                <p className="whitespace-pre-wrap text-gray-700 text-sm leading-relaxed">
                  {job.description}
                </p>
              </div>
            </div>
          )}

          {/* Responsibilities */}
          {job.responsibilities && (
            <div>
              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Key Responsibilities</h4>
              <div className="bg-white border border-gray-100 rounded-lg p-4">
                <p className="whitespace-pre-wrap text-gray-700 text-sm leading-relaxed">
                  {job.responsibilities}
                </p>
              </div>
            </div>
          )}
          
        </div>

        {/* Sticky Footer */}
        <div className="border-t border-gray-100 p-5 bg-gray-50 flex justify-end gap-3 sticky bottom-0 z-10">
          <button 
            onClick={onClose}
            className="px-5 py-3 border border-gray-200 bg-white rounded-lg text-sm font-semibold text-gray-600 hover:bg-gray-100 transition-colors shadow-2xs"
          >
            Cancel
          </button>
          {isPoster ? (
            <button 
              className="bg-gray-100 hover:bg-gray-200 border border-gray-300 text-[#42474f] font-bold py-3 px-8 rounded-lg transition-colors shadow-sm text-sm"
              onClick={() => console.log('Edit Job clicked:', job.id)}
            >
              Edit Job
            </button>
          ) : (
            <button 
              onClick={handleApplyClick}
              className="bg-blue-900 text-white font-bold py-3 px-8 rounded-lg hover:bg-blue-800 transition-colors shadow-sm text-sm"
            >
              Quick Apply
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
