import { MapPin, Clock, Bookmark, Ship, Compass, Anchor, Briefcase } from 'lucide-react';

export default function JobCard({ job, onClick }) {
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
    <div 
      onClick={onClick}
      className="bg-white border border-gray-200 rounded-lg p-7 mb-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer flex gap-5 items-start"
    >
      {/* Left Column: Company Logo */}
      <div className="w-16 h-16 bg-gray-55 border border-gray-100 rounded-md flex-shrink-0 flex items-center justify-center mt-1">
        {getCompanyIcon(job.company)}
      </div>

      {/* Right Column: Content Stack */}
      <div className="flex-1">
        {/* Row 1: Job Title */}
        <div className="flex justify-between items-start gap-4">
          <h3 className="text-xl font-bold text-blue-900 leading-tight">{job.title}</h3>
          <button 
            onClick={(e) => e.stopPropagation()}
            className="text-gray-400 hover:text-blue-900 transition-colors flex-shrink-0"
          >
            <Bookmark size={18} />
          </button>
        </div>

        {/* Row 2: Company Name */}
        <p className="text-sm font-semibold text-gray-800 mt-1">
          {companyName}
        </p>

        {/* Row 3: Meta String */}
        <div className="text-xs text-gray-500 mt-1.5 flex flex-wrap items-center gap-2">
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
              <span className="bg-green-500 text-white font-medium px-2 py-0.5 rounded-md border border-green-600">High Priority</span>
            </>
          )}
        </div>

        {/* Row 4: Skill Tags */}
        <div className="flex flex-wrap gap-2 mt-3 mb-1">
          {tags.map((tag, index) => (
            <span 
              key={index} 
              className="bg-blue-50 text-blue-700 px-2.5 py-1 rounded-md text-xs font-medium"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
