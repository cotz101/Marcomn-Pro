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
  const { userId, showToast, currentIdentity } = useProfile();
  const router = useRouter();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState(null);
  const [jobToEdit, setJobToEdit] = useState(null);
  const [isPostJobModalOpen, setIsPostJobModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('published');

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
    if (!userId || !currentIdentity) return;
    setLoading(true);
    try {
      const supabase = createClient();
      let query = supabase
        .from('jobs_search_view')
        .select('*')
        .order('created_at', { ascending: false });

      if (currentIdentity.type === 'company') {
        query = query.eq('company_id', currentIdentity.id);
      } else {
        query = query.eq('poster_id', userId).is('company_id', null);
      }

      const { data, error } = await query;

      if (error) throw error;
      
      if (data) {
        const enriched = data.map(job => {
          const filled = job.filled_positions || 0;
          const total = job.number_of_positions || 1;
          return {
            ...job,
            filled_positions: filled,
            available_positions: Math.max(0, total - filled),
            is_position_filled: filled >= total
          };
        });
        setJobs(enriched);
      } else {
        setJobs([]);
      }
    } catch (err) {
      console.error('Error fetching employer postings:', err.message || err);
    } finally {
      setLoading(false);
    }
  }, [userId, currentIdentity]);

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

  const activeJobsList = activeTab === 'published' ? publishedJobs 
                       : activeTab === 'closed' ? closedJobs 
                       : draftJobs;

  const renderJobRow = (job) => (
    <div 
      key={job.id} 
      onClick={() => setSelectedJob(job)}
      className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer"
    >
      {/* Left: Job Title (bold) and Location (gray text) */}
      <div className="flex-1 min-w-0 pl-2">
        <h3 className="text-[17px] sm:text-[20px] font-bold text-blue-900 leading-snug break-words">
          {job.title}
        </h3>
        <div className="mt-2.5 flex flex-wrap items-center gap-2 sm:gap-3">
          <span className="inline-flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1 rounded-full text-slate-600 text-xs font-semibold max-w-full">
            <MapPin size={14} className="text-slate-400 flex-shrink-0" />
            <span className="truncate">{job.location || 'Location unspecified'}</span>
          </span>
          <span className="text-xs text-gray-400 font-medium">
            Created {getFormattedDate(job.created_at)}
          </span>
          {(job.status || '').toLowerCase() === 'draft' ? (
            <span className="inline-flex items-center rounded-full bg-amber-50 border border-amber-200 px-2.5 py-1 text-xs font-semibold text-amber-700">
              Private Draft — Only you can see this job.
            </span>
          ) : (
            <>
              <span className="inline-flex items-center rounded-full bg-emerald-50 border border-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                {job.applications?.length || 0} {job.applications?.length === 1 ? 'Applicant' : 'Applicants'}
              </span>
              <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
                job.is_position_filled 
                  ? 'bg-amber-100 border border-amber-200 text-amber-800' 
                  : 'bg-blue-50 border border-blue-100 text-blue-800'
              }`}>
                {job.is_position_filled ? 'Position Filled' : `${job.filled_positions || 0} / ${job.number_of_positions || 1} Filled (${job.available_positions ?? Math.max(0, (job.number_of_positions || 1) - (job.filled_positions || 0))} Available)`}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Right: Actions Container */}
      <div className="flex flex-wrap items-center gap-3 w-full md:w-auto mt-2 md:-mt-[5px] justify-end md:justify-start mb-1.5">
        {((job.status || '').toLowerCase() === 'published' || (job.status || '').toLowerCase() === 'open' || (job.status || '').toLowerCase() === 'active') && (
          <button 
            onClick={(e) => {
              e.stopPropagation();
              handleCloseJob(job);
            }}
            className="flex-1 md:flex-initial text-center text-sm font-semibold text-red-600 hover:text-red-800 bg-red-50 border border-red-100 px-4 py-2 rounded-lg transition-colors whitespace-nowrap"
          >
            <span className="block max-[440px]:hidden">Close Job</span>
            <span className="hidden max-[440px]:block">Close</span>
          </button>
        )}

        {(job.status || '').toLowerCase() !== 'draft' && (
          <button 
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/jobs/my-postings/${job.id}/applicants`);
            }}
            className="flex-1 md:flex-initial text-center px-4 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 text-sm font-semibold rounded-lg border border-blue-100 transition-colors whitespace-nowrap"
          >
            <span className="block max-[440px]:hidden">View Applicants</span>
            <span className="hidden max-[440px]:block">Applicants</span>
          </button>
        )}
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
    <main className="max-w-5xl mx-auto p-4 sm:p-6 pb-24">
      {/* 2-Column layout style override inside index.css grid structure */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media (min-width: 768px) {
          .main-grid.hide-sidebar-right {
            grid-template-columns: 240px 1fr !important;
          }
        }

        /* Width 441px to 767px Overrides (Containers) */
        @media (min-width: 441px) and (max-width: 767px) {
          .max-w-5xl {
            padding-left: 20px !important;
            padding-right: 20px !important;
          }
          .max-w-5xl header {
            margin-bottom: 15px !important;
            padding-bottom: 22px !important;
          }
          .max-w-5xl .space-y-4 {
            margin-top: 15px !important;
          }
        }

        /* 441px and Above - Job List Card Style Base */
        @media (min-width: 441px) {
          .max-w-5xl .space-y-4 > div {
            flex-direction: row !important;
            align-items: center !important;
            justify-content: space-between !important;
            padding: 20px !important;
          }
          .max-w-5xl .space-y-4 > div > div:last-child {
            flex-direction: column !important;
            align-items: flex-end !important;
            justify-content: center !important;
            width: auto !important;
            margin-top: 0 !important;
            gap: 8px !important;
            flex-shrink: 0 !important;
          }
          .max-w-5xl .space-y-4 > div > div:last-child button {
            width: 160px !important;
            flex: none !important;
          }
        }

        /* Width 440px and Below Overrides */
        @media (max-width: 440px) {
          .max-w-5xl {
            padding-left: 20px !important;
            padding-right: 20px !important;
          }
          .max-w-5xl header {
            margin-bottom: 15px !important;
            padding-bottom: 22px !important;
          }
          .max-w-5xl .space-y-4 {
            margin-top: 15px !important;
          }
          .max-w-5xl .space-y-4 > div {
            padding-top: 25px !important;
            padding-bottom: 25px !important;
          }
          .max-w-5xl .space-y-4 > div + div {
            margin-top: 10px !important;
          }
          .max-w-5xl .space-y-4 > div h3 {
            padding-left: 10px !important;
          }
          .max-w-5xl .space-y-4 > div p {
            padding-left: 10px !important;
          }
        }
      `}} />

      {/* Standard premium Page Header with Tabs inside */}
      <header className="mb-8 flex flex-col bg-white border border-slate-200 p-5 md:px-6 md:py-10 rounded-2xl shadow-sm">
        <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-6 px-2 md:px-4 mb-6">
          <div className="flex-1">
            <h1 className="text-3xl font-extrabold tracking-tight leading-none mb-3 text-[#000050]">
              My Job Postings
            </h1>
            <p className="text-slate-500 text-sm leading-relaxed max-w-xl">
              Manage your published, draft, and closed job postings.
            </p>
          </div>
        </div>

        {/* Status Tabs inside header container */}
        <div className="w-full flex items-center gap-2 border-t border-slate-100 pt-4 mb-1.5 px-2 md:px-4 overflow-x-auto no-scrollbar">
          {[
            { id: 'published', label: 'Published', count: publishedJobs.length },
            { id: 'draft', label: 'Draft', count: draftJobs.length },
            { id: 'closed', label: 'Closed', count: closedJobs.length }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-full text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                activeTab === tab.id
                  ? 'bg-[#002b4e] text-white shadow-sm'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <span>{tab.label}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'}`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      </header>

      {/* Main List panel */}
      {loading ? (
        <div className="space-y-3 md:mt-[20px]">
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </div>
      ) : jobs.length === 0 ? (
        <div className="text-center p-10 bg-white border border-gray-200 rounded-lg md:mt-[20px]">
          <div className="text-gray-400 mb-3 flex justify-center">
            <Briefcase size={40} />
          </div>
          <h3 className="text-lg font-bold text-gray-900">No Job Postings Yet</h3>
          <p className="text-gray-500 mb-5">Create your first opportunity to find top maritime talent.</p>
        </div>
      ) : (
        <div className="space-y-4 mt-[20px]">
          {activeJobsList.length > 0 ? (
            activeJobsList.map(renderJobRow)
          ) : (
            <div className="p-12 bg-white rounded-xl text-center text-sm text-gray-500 border border-slate-200 shadow-sm flex flex-col items-center justify-center">
              <Briefcase size={36} className="text-slate-350 mb-3" />
              <p className="font-semibold text-slate-700">No postings available</p>
              <p className="text-xs text-slate-400 mt-1">There are no jobs currently listed under the "{activeTab}" status.</p>
            </div>
          )}
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
    </main>
  );
}
