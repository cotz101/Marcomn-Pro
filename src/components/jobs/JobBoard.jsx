'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase';
import { Briefcase, MapPin, DollarSign, Clock, Building2, Search, Filter } from 'lucide-react';
import Link from 'next/link';

export default function JobBoard() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const supabase = createClient();

  useEffect(() => {
    async function fetchJobs() {
      const { data, error } = await supabase
        .from('jobs')
        .select(`
          *,
          company:companies(name, logo_url, industry)
        `)
        .eq('status', 'Open')
        .order('created_at', { ascending: false });

      if (!error && data) {
        setJobs(data);
      }
      setLoading(false);
    }

    fetchJobs();
  }, [supabase]);

  const filteredJobs = jobs.filter(job => 
    job.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (job.company?.name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="job-board-container">
      <header className="job-board-header">
        <div className="header-content">
          <h1>Maritime Job Marketplace</h1>
          <p>Find your next mission in the global maritime industry.</p>
        </div>
        
        <div className="search-bar-container">
          <div className="search-input-wrapper">
            <Search size={20} className="search-icon" />
            <input 
              type="text" 
              placeholder="Search by job title or company..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button className="btn-filter">
            <Filter size={18} /> Filters
          </button>
        </div>
      </header>

      {loading ? (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Scanning the horizon for opportunities...</p>
        </div>
      ) : filteredJobs.length > 0 ? (
        <div className="jobs-grid">
          {filteredJobs.map(job => (
            <div key={job.id} className="job-card card">
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

              <p className="job-description">
                {job.description.length > 150 ? job.description.substring(0, 150) + '...' : job.description}
              </p>

              <div className="job-card-footer">
                <span className="post-date">Posted {new Date(job.created_at).toLocaleDateString()}</span>
                <button className="btn-apply">View Details</button>
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
          max-width: 1200px;
          margin: 0 auto;
          padding: 20px;
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
        .search-bar-container {
          margin-top: 30px;
          display: flex;
          gap: 12px;
          max-width: 700px;
          margin-left: auto;
          margin-right: auto;
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
