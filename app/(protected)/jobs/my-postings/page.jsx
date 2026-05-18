'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useProfile } from '@/app/context/ProfileContext';
import { createClient } from '@/lib/supabase';
import { Briefcase, MapPin, Loader2 } from 'lucide-react';
import JobDetailsModal from '@/src/components/jobs/JobDetailsModal';
import PostJobModal from '@/src/components/jobs/PostJobModal';

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
  const { userId, showToast } = useProfile();
  const router = useRouter();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState(null);
  const [jobToEdit, setJobToEdit] = useState(null);
  const [isPostJobModalOpen, setIsPostJobModalOpen] = useState(false);

  // The cascade close logic
  const handleCloseJob = async (job) => {
    if (!window.confirm('Are you sure you want to close this job? All unaccepted applications will automatically be marked as Closed.')) return;

    try {
      const supabase = createClient();
      
      // Database Step 1: Update Job to Closed
      const { error: jobError } = await supabase
        .from('jobs')
        .update({ status: 'Closed' })
        .eq('id', job.id);

      if (jobError) throw jobError;

      // Database Step 2: Update Applications (except Accepted or Withdrawn)
      const { error: appError } = await supabase
        .from('applications')
        .update({ status: 'Closed' })
        .eq('job_id', job.id)
        .neq('status', 'Accepted')
        .neq('status', 'Withdrawn');

      if (appError) throw appError;

      // UI State Sync: instantly move from Active array to Closed array
      setJobs(prevJobs =>
        prevJobs.map(j => (j.id === job.id ? { ...j, status: 'Closed' } : j))
      );

      // Trigger a success toast
      if (showToast) {
        showToast('Job closed successfully. Applicants have been updated.', 'success');
      }
    } catch (err) {
      console.error('Error closing job:', err.message || err);
      if (showToast) {
        showToast('Error closing job: ' + err.message, 'error');
      }
    }
  };

  // The crucial three-action bridge for Edit
  const handleEditJob = (job) => {
    setSelectedJob(null);          // 1. Close details modal
    setJobToEdit(job);             // 2. Set job to edit
    setIsPostJobModalOpen(true);   // 3. Open PostJobModal
  };

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

    const handleJobUpdate = () => {
      fetchUserJobs();
    };

    window.addEventListener('job-posted', handleJobUpdate);
    return () => {
      window.removeEventListener('job-posted', handleJobUpdate);
    };
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

  const publishedJobs = jobs.filter(j => {
    const s = (j.status || '').toLowerCase();
    return s === 'published' || s === 'open';
  });
  
  const closedJobs = jobs.filter(j => {
    const s = (j.status || '').toLowerCase();
    return s === 'closed' || s === 'inactive';
  });
  
  const draftJobs = jobs.filter(j => {
    const s = (j.status || '').toLowerCase();
    return s !== 'published' && s !== 'open' && s !== 'closed' && s !== 'inactive';
  });

  const renderJobRow = (job) => (
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

      {/* Center: Posting Status badge */}
      <div className="flex-shrink-0">
        {getStatusBadge(job.status)}
      </div>

      {/* Right: Created Date & Applicants CTA */}
      <div className="flex items-center gap-5 flex-shrink-0">
        <div className="text-right hidden sm:block">
          <p className="text-xs text-gray-400 font-medium">Created Date</p>
          <p className="text-sm font-semibold text-gray-700 mt-0.5">
            {getFormattedDate(job.created_at)}
          </p>
        </div>

        {((job.status || '').toLowerCase() === 'published' || (job.status || '').toLowerCase() === 'open' || (job.status || '').toLowerCase() === 'active') && (
          <button 
            onClick={(e) => {
              e.stopPropagation();
              handleCloseJob(job);
            }}
            className="text-sm font-semibold text-red-600 hover:text-red-800 bg-red-50 px-4 py-2 rounded-md transition-colors"
          >
            Close Job
          </button>
        )}

        <button 
          onClick={(e) => {
            e.stopPropagation();
            router.push(`/jobs/my-postings/${job.id}/applicants`);
          }}
          className="px-4 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 text-sm font-semibold rounded-lg transition-colors"
        >
          View Applicants
        </button>
      </div>
    </div>
  );

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
        <div className="space-y-10">
          {/* Active / Published */}
          <div>
            <h3 className="text-lg font-bold text-gray-900 mb-4 mt-8">Active Postings</h3>
            {publishedJobs.length > 0 ? (
              <div className="space-y-3">
                {publishedJobs.map(renderJobRow)}
              </div>
            ) : (
              <div className="p-6 bg-gray-50 rounded-lg text-center text-sm text-gray-500 border border-gray-100">
                No active postings available
              </div>
            )}
          </div>

          {/* Drafts */}
          <div>
            <h3 className="text-lg font-bold text-gray-900 mb-4 mt-8">Drafts</h3>
            {draftJobs.length > 0 ? (
              <div className="space-y-3">
                {draftJobs.map(renderJobRow)}
              </div>
            ) : (
              <div className="p-6 bg-gray-50 rounded-lg text-center text-sm text-gray-500 border border-gray-100">
                No drafts available
              </div>
            )}
          </div>

          {/* Closed */}
          <div>
            <h3 className="text-lg font-bold text-gray-900 mb-4 mt-8">Closed Postings</h3>
            {closedJobs.length > 0 ? (
              <div className="space-y-3">
                {closedJobs.map(renderJobRow)}
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Click-to-view Details Modal */}
      {selectedJob && (
        <JobDetailsModal 
          job={selectedJob}
          onClose={() => setSelectedJob(null)}
          onEdit={handleEditJob}
        />
      )}

      {isPostJobModalOpen && (
        <PostJobModal
          isOpen={isPostJobModalOpen}
          jobToEdit={jobToEdit}
          onClose={() => {
            setIsPostJobModalOpen(false);
            setJobToEdit(null);
          }}
          onComplete={() => {
            setIsPostJobModalOpen(false);
            setJobToEdit(null);
            fetchUserJobs();
          }}
        />
      )}
    </div>
  );
}
