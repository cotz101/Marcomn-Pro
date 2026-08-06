import { MapPin, Clock, Bookmark, Ship, Compass, Anchor, Briefcase } from 'lucide-react';
import { formatCompensation } from '@/lib/compensation';

const statusColors = {
  'pending': 'bg-slate-100 text-slate-600 border-slate-200',      // Neutral
  'under review': 'bg-blue-50 text-blue-700 border-blue-200',    // Active/Progress
  'shortlisted': 'bg-purple-50 text-purple-700 border-purple-200',// Milestone
  'accepted': 'bg-green-50 text-green-700 border-green-200',     // Success
  'withdrawn': 'bg-rose-50 text-rose-600 border-rose-200'       // Inactive
};

export default function JobCard({ job, application, onClick }) {
  // Determine display name
  const companyName = job.company?.name || (typeof job.company === 'string' ? job.company : null) || job.poster?.name || 'Private Poster';

  // Helper to select logo icon matching company name
  const getCompanyIcon = (company) => {
    if (!company) return <Briefcase size={24} className="text-blue-900" />;
    const name = typeof company === 'string' ? company.toLowerCase() : (company.name || '').toLowerCase();
    if (name.includes('wave')) {
      return <Ship size={24} className="text-blue-900" />;
    }
    if (name.includes('meridian')) {
      return <Compass size={24} className="text-blue-900" />;
    }
    if (name.includes('oceanic')) {
      return <Anchor size={24} className="text-blue-900" />;
    }
    return <Briefcase size={24} className="text-blue-900" />;
  };

  // Format dates beautifully
  const getFormattedDate = (dateStr) => {
    if (!dateStr) return 'Recently';
    if (dateStr.includes('ago')) return dateStr;
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffMs = now - date;
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      const diffDays = Math.floor(diffHours / 24);
      if (diffDays === 1) return 'Yesterday';
      if (diffDays < 7) return `${diffDays} days ago`;
      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return 'Recently';
    }
  };

  const formattedDate = getFormattedDate(job.created_at || job.postedAt);
  const isPriority = job.priority || job.status === 'Priority' || job.status === 'Priority Badge';
  const tags = job.required_skills || job.tags || [];

  return (
    <>
      <div className="job-card cursor-pointer shadow-sm hover:shadow-md transition-shadow" onClick={onClick}>
        
        {application?.status && (() => {
          const statusKey = application.status.toLowerCase();
          const displayStatus = statusKey === 'pending' ? 'Applied' : application.status;
          const colorClass = statusColors[statusKey] || statusColors.pending;
          const cleanedColorClass = colorClass.replace(/border-[a-z]+-\d+/g, '').replace('border', '').trim();
          
          return (
            <span className={`status-bookmark uppercase ${cleanedColorClass}`}>
              {displayStatus}
            </span>
          );
        })()}

        {/* Left Column: Company Logo */}
        <div className="job-logo w-16 h-16 bg-gray-50 border border-gray-100 rounded-md flex-shrink-0 flex items-center justify-center">
          {getCompanyIcon(job.company)}
        </div>

        {/* Details Wrapper */}
        <div className="job-details">
          <div className="job-title-row">
            <h3 className="text-xl font-bold text-blue-900 leading-tight">{job.title}</h3>
          </div>
          
          <div className="job-info-row flex flex-col mt-1">
            <p className="text-sm font-semibold text-gray-800">
              {companyName}
            </p>
            {(job.salary_range || job.salary || job.compensation) && (() => {
              const comp = formatCompensation(job);
              return (
                <p className="text-sm font-semibold text-emerald-600 mt-0.5">
                  {comp.displayRate}
                </p>
              );
            })()}
            
            {/* Display Positions Counters */}
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <span className="text-xs font-semibold text-blue-900 bg-blue-50 px-2.5 py-0.5 rounded border border-blue-100">
                {job.filled_positions || 0} / {job.number_of_positions || 1} Filled &bull; {job.available_positions ?? Math.max(0, (job.number_of_positions || 1) - (job.filled_positions || 0))} Available
              </span>
              {job.is_position_filled && (
                <span className="text-xs font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 uppercase tracking-wide">
                  Position Filled
                </span>
              )}
            </div>
          </div>
          
          <div className="job-meta-row text-xs text-gray-500 mt-2 flex flex-wrap items-center gap-2">
            <MapPin size={12} className="text-gray-400 flex-shrink-0" />
            <span>{job.location}</span>
            <span>&bull;</span>
            <Clock size={12} className="text-gray-400 flex-shrink-0" />
            <span>{job.employment_type || job.type || 'Full-time'}</span>
            <span>&bull;</span>
            <span>Posted {formattedDate}</span>
            {isPriority && (
              <>
                <span>&bull;</span>
                <span className="bg-green-500 text-white font-medium px-2 py-0.5 rounded-md">High Priority</span>
              </>
            )}
          </div>
          
          {/* Experience and Skill Tags */}
          {(job.experience_level || tags.length > 0) && (
            <div className="flex flex-wrap gap-2 mt-3 items-center">
              {job.experience_level && (
                <span className="bg-indigo-50 text-indigo-700 border border-indigo-100 px-2.5 py-1 rounded-md text-xs font-bold whitespace-nowrap">
                  {job.experience_level}
                </span>
              )}
              {tags.map((tag, index) => (
                <span 
                  key={index} 
                  className="bg-blue-50 text-blue-700 border border-blue-100 px-2.5 py-1 rounded-md text-xs font-medium"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .job-card {
          position: relative;
          display: flex;
          align-items: center;
          padding: 20px 20px 20px 15px; 
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          min-height: 140px;
          width: 100%;
        }

        .status-bookmark {
          position: absolute;
          top: 0;
          right: 20px;
          padding: 8px 6px 14px 6px;
          min-width: 50px;
          text-align: center;
          font-weight: 800;
          font-size: 10px;
          clip-path: polygon(0 0, 100% 0, 100% 100%, 50% 85%, 0 100%);
          z-index: 10;
        }

        .job-details {
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: center;
          height: 100%;
          padding-top: 12px; 
          margin-left: 20px; 
        }

        .job-title-row h3 {
          margin: 0;
          padding-right: 60px; 
        }

        @media (max-width: 440px) {
          .job-card {
            padding-top: 50px !important;
            padding-bottom: 20px !important;
            flex-direction: row !important;
            align-items: center !important;
          }
          
          .status-bookmark {
            right: auto !important;
            left: 15px !important; 
            top: 0 !important;
          }
          
          .job-details {
            padding-top: 0 !important;
            gap: 8px !important;
            justify-content: center !important;
          }
          .job-title-row h3 {
            padding-right: 0; 
          }
        }

        @media (max-width: 323px) {
          .job-card {
            flex-direction: column !important;
            align-items: flex-start !important;
            padding: 40px 10px 15px 10px !important;
          }
          .job-details {
            margin-left: 0 !important;
            padding-top: 10px !important;
          }
        }
      `}</style>
    </>
  );
}
