'use client';
import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { Briefcase, MapPin, DollarSign, Clock, Building2, Search, Filter, Ship } from 'lucide-react';
import Link from 'next/link';

export default function JobBoard() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('recent');
  const supabase = createClient();
  const searchParams = useSearchParams();
  const router = useRouter();
  const jobIdFromUrl = searchParams.get('jobId');

  const fetchJobs = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('jobs')
        .select(`
          *,
          company:companies(name, logo_url, industry)
        `)
        .in('status', ['Published', 'published', 'Open', 'open'])
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Supabase error fetching jobs:', error.message || error);
        throw error;
      }
      
      if (data) {
        setJobs(data);
      }
    } catch (err) {
      console.error('Error in fetchJobs:', err);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchJobs();

    const handleJobUpdate = () => {
      fetchJobs();
    };

    window.addEventListener('job-posted', handleJobUpdate);
    return () => {
      window.removeEventListener('job-posted', handleJobUpdate);
    };
  }, [fetchJobs]);

  useEffect(() => {
    if (jobIdFromUrl) {
      router.push(`/mservices/opportunity/${jobIdFromUrl}`);
    }
  }, [jobIdFromUrl, router]);

  const filteredJobs = jobs.filter(job => {
    const matchesTitle = job.title.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCompany = (job.company?.name || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTag = job.tags && job.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesTitle || matchesCompany || matchesTag;
  });

  const sortedJobs = [...filteredJobs].sort((a, b) => {
    if (sortBy === 'recent') {
      return new Date(b.created_at) - new Date(a.created_at);
    }
    if (sortBy === 'title') {
      return a.title.localeCompare(b.title);
    }
    return 0;
  });

  return (
    <div className="job-board-container">
      <header className="job-board-header">
        <div className="relative overflow-hidden bg-gradient-to-r from-blue-900 to-indigo-800 rounded-xl py-10 px-6 md:px-12 mb-8 shadow-sm flex items-center justify-center text-center">
          <div className="relative z-10 w-full max-w-2xl text-center mx-auto">
            <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">Maritime Job Marketplace</h1>
            <p className="text-blue-100 text-sm md:text-base">Find your next maritime opportunity or recruit top talent.</p>
          </div>
          <Ship className="absolute -right-4 top-1/2 -translate-y-1/2 text-white opacity-10" size={160} />
        </div>
        
        <div className="command-bar-container">
          <div className="search-input-wrapper w-full max-w-lg">
            <Search size={20} className="search-icon" />
            <input 
              type="text" 
              placeholder="Search jobs, companies, or tags..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="sort-controls">
            <span className="text-sm text-gray-500 font-medium whitespace-nowrap">Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-gray-50 border border-gray-200 text-gray-700 text-sm font-medium rounded-xl focus:ring-2 focus:ring-blue-100 focus:border-blue-500 block p-2.5 outline-none shadow-sm cursor-pointer hover:bg-gray-100/50 transition-colors"
            >
              <option value="recent">Most Recent</option>
              <option value="title">Alphabetical</option>
            </select>
          </div>
        </div>
      </header>

      {loading ? (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Scanning the horizon for opportunities...</p>
        </div>
      ) : sortedJobs.length > 0 ? (
        <div className="jobs-grid">
          {sortedJobs.map(job => (
            <div key={job.id} className="job-card card cursor-pointer" onClick={() => router.push(`/mservices/opportunity/${job.id}`)}>
              <div className="job-card-header">
                <div className="company-logo-wrapper">
                  {job.company?.logo_url ? (
                    <img src={job.company.logo_url} alt={job.company.name} />
                  ) : (
                    <div className="company-placeholder">
                      {job.company?.name?.[0] || <Building2 size={24} />}
                    </div>
                  )}
                </div>
                <div className="job-title-group">
                  <h3 className="job-title">{job.title}</h3>
                  <p className="company-name">{job.company?.name || 'Private Poster'}</p>
                </div>
              </div>

              <div className="job-details">
                <div className="detail-item">
                  <MapPin size={14} /> <span>{job.location || 'Not specified'}</span>
                </div>
                <div className="detail-item">
                  <Clock size={14} /> <span>{job.employment_type}</span>
                </div>
                {job.salary_range && (
                  <div className="detail-item">
                    <DollarSign size={14} /> <span>{job.salary_range}</span>
                  </div>
                )}
              </div>

              {/* Job Tag Container */}
              {job.tags && job.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {job.tags.slice(0, 4).map((tag, index) => (
                    <span key={index} className="px-2.5 py-1 bg-blue-50 text-blue-700 text-xs font-semibold rounded-md border border-blue-100 uppercase tracking-wide">
                      {tag}
                    </span>
                  ))}
                  {job.tags.length > 4 && (
                    <span className="px-2.5 py-1 text-gray-500 text-xs font-medium">
                      +{job.tags.length - 4} more
                    </span>
                  )}
                </div>
              )}

              {job.required_skills && job.required_skills.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2 mb-4">
                  {job.required_skills.map((skill, index) => (
                    <span 
                      key={index} 
                      className="bg-blue-50 text-blue-700 px-2.5 py-1 rounded-md text-xs font-medium"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              )}

              <div className="job-card-footer">
                <span className="post-date">Posted {new Date(job.created_at).toLocaleDateString()}</span>
                <button className="btn-apply" onClick={(e) => { e.stopPropagation(); router.push(`/mservices/opportunity/${job.id}`); }}>View Details</button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <Briefcase size={48} />
          <h3>No jobs found</h3>
          <p>Try adjusting your search terms or check back later.</p>
        </div>
      )}

      <style jsx>{`
        .job-board-container {
          width: 100%;
        }
        .job-board-header {
          margin-bottom: 40px;
          text-align: center;
        }
        .header-content h1 {
          font-size: 32px;
          font-weight: 800;
          color: #0e2a4d;
          margin-bottom: 8px;
        }
        .header-content p {
          color: #64748b;
          font-size: 16px;
        }
        .command-bar-container {
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 16px 24px;
          box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px 0 rgba(0, 0, 0, 0.06);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 24px;
        }
        @media (max-width: 640px) {
          .command-bar-container {
            flex-direction: column;
            align-items: stretch;
          }
        }
        .sort-controls {
          display: flex;
          align-items: center;
          gap: 8px;
          justify-content: flex-end;
        }
        .search-input-wrapper {
          flex: 1;
          position: relative;
        }
        .search-icon {
          position: absolute;
          left: 14px;
          top: 50%;
          transform: translateY(-50%);
          color: #94a3b8;
        }
        .search-input-wrapper input {
          width: 100%;
          padding: 12px 12px 12px 44px;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          outline: none;
          font-size: 15px;
          transition: all 0.2s;
          box-shadow: 0 1px 2px rgba(0,0,0,0.05);
        }
        .search-input-wrapper input:focus {
          border-color: #00B4D8;
          box-shadow: 0 0 0 3px rgba(0, 180, 216, 0.1);
        }
        .btn-filter {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 0 20px;
          border: 1px solid #e2e8f0;
          background: white;
          border-radius: 12px;
          font-weight: 600;
          color: #475569;
          cursor: pointer;
        }
        .jobs-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
          gap: 24px;
        }
        .job-card {
          padding: 24px;
          display: flex;
          flex-direction: column;
          transition: transform 0.2s, box-shadow 0.2s;
        }
        .job-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 20px -5px rgba(0,0,0,0.1);
        }
        .job-card-header {
          display: flex;
          gap: 16px;
          margin-bottom: 20px;
        }
        .company-logo-wrapper {
          width: 48px;
          height: 48px;
          flex-shrink: 0;
        }
        .company-logo-wrapper img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          border-radius: 8px;
        }
        .company-placeholder {
          width: 100%;
          height: 100%;
          background: #0e2a4d;
          color: white;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
        }
        .job-title {
          font-size: 18px;
          font-weight: 700;
          color: #1e293b;
          margin: 0 0 4px 0;
        }
        .company-name {
          font-size: 14px;
          color: #00B4D8;
          font-weight: 600;
          margin: 0;
        }
        .job-details {
          display: flex;
          flex-wrap: wrap;
          gap: 16px;
          margin-bottom: 16px;
        }
        .detail-item {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 13px;
          color: #64748b;
          background: #f8fafc;
          padding: 4px 10px;
          border-radius: 6px;
        }
        .job-description {
          font-size: 14px;
          line-height: 1.6;
          color: #475569;
          margin-bottom: 24px;
          flex-grow: 1;
        }
        .job-card-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-top: 16px;
          border-top: 1px solid #f1f5f9;
        }
        .post-date {
          font-size: 12px;
          color: #94a3b8;
        }
        .btn-apply {
          background: #0e2a4d;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 8px;
          font-weight: 600;
          font-size: 13px;
          cursor: pointer;
          transition: background 0.2s;
        }
        .btn-apply:hover {
          background: #1e4d8a;
        }
        .loading-state, .empty-state {
          text-align: center;
          padding: 100px 20px;
          color: #94a3b8;
        }
        .spinner {
          width: 40px;
          height: 40px;
          border: 3px solid #f3f3f3;
          border-top: 3px solid #00B4D8;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin: 0 auto 20px;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
