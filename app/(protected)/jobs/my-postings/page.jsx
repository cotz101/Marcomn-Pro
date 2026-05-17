'use client';

import { useState, useEffect, useCallback } from 'react';
import { useProfile } from '@/app/context/ProfileContext';
import { createClient } from '@/lib/supabase';
import { Briefcase, MapPin, Loader2 } from 'lucide-react';
import JobDetailsModal from '@/src/components/jobs/JobDetailsModal';

const SkeletonRow = () => (
  <div className="bg-white border border-gray-100 rounded-lg p-5 mb-3 shadow-sm animate-pulse flex items-center justify-between gap-4">
    <div className="flex-1 space-y-2">
      <div className="h-5 bg-gray-200 rounded w-1/3"></div>
      <div className="h-4 bg-gray-200 rounded w-1/4"></div>
    </div>
    <div className="w-20 h-6 bg-gray-200 rounded-full"></div>
    <div className="flex items-center gap-4">
      <div className="h-8 bg-gray-100 rounded w-24"></div>
    </div>
  </div>
);

export default function EmployerDashboardPage() {
  const { userId } = useProfile();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState(null);

  const fetchUserJobs = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('jobs')
        .select('*')
        .eq('poster_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setJobs(data || []);
    } catch (err) {
      console.error('Error fetching employer postings:', err.message || err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (userId) {
      fetchUserJobs();
    }
  }, [userId, fetchUserJobs]);

  const getStatusBadge = (status) => {
    const s = (status || '').toLowerCase();
    if (s === 'open' || s === 'published') {
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
          Published
        </span>
      );
    } else if (s === 'closed' || s === 'inactive') {
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-100">
          Closed
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-50 text-gray-700 border border-gray-100">
          Draft
        </span>
      );
    }
  };

  const getFormattedDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch (e) {
      return dateStr;
    }
  };

  if (!userId && loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-gray-500">
        <Loader2 className="animate-spin mb-3 text-blue-900" size={28} />
        <p className="text-sm font-medium">Verifying authorization credentials...</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-6">
      {/* Header bar */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-blue-900">Employer Dashboard</h1>
        <p className="text-sm text-gray-600 mt-1">
          Manage your maritime job postings, draft new listings, and review applicant details.
        </p>
      </div>

      {/* Main List panel */}
      {loading ? (
        <div className="space-y-3">
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </div>
      ) : jobs.length === 0 ? (
        <div className="text-center p-10 bg-white border border-gray-200 rounded-lg">
          <div className="text-gray-400 mb-3 flex justify-center">
            <Briefcase size={40} />
          </div>
          <h3 className="text-lg font-bold text-gray-900">No Job Postings Yet</h3>
          <p className="text-gray-500 mb-5">Create your first opportunity to find top maritime talent.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {jobs.map((job) => (
            <div 
              key={job.id} 
              onClick={() => setSelectedJob(job)}
              className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm hover:shadow-md transition-shadow flex items-center justify-between gap-4 cursor-pointer"
            >
              {/* Left: Job Title (bold) and Location (gray text) */}
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-bold text-blue-900 truncate">
                  {job.title}
                </h3>
                <p className="text-sm text-gray-500 mt-1 flex items-center gap-1.5">
                  <MapPin size={14} className="text-gray-400 flex-shrink-0" />
                  <span className="truncate">{job.location || 'Location unspecified'}</span>
                </p>
              </div>

              {/* Center: Posting Status (Render as a badge: Draft = Gray, Published = Green, Closed = Red) */}
              <div className="flex-shrink-0">
                {getStatusBadge(job.status)}
              </div>

              {/* Right: Created Date (No inline Edit button) */}
              <div className="flex items-center gap-5 flex-shrink-0">
                <div className="text-right hidden sm:block">
                  <p className="text-xs text-gray-400 font-medium">Created Date</p>
                  <p className="text-sm font-semibold text-gray-700 mt-0.5">
                    {getFormattedDate(job.created_at)}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Click-to-view Details Modal */}
      {selectedJob && (
        <JobDetailsModal 
          job={selectedJob}
          onClose={() => setSelectedJob(null)}
        />
      )}
    </div>
  );
}
