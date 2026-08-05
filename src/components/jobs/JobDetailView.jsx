'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useProfile } from '@/app/context/ProfileContext';
import { createClient } from '@/lib/supabase';
import { 
  ArrowLeft, 
  MapPin, 
  Clock, 
  Briefcase, 
  DollarSign, 
  Award, 
  Ship, 
  Compass, 
  Anchor, 
  AlertCircle,
  AlertTriangle,
  Trash2,
  Edit3
} from 'lucide-react';

export default function OpportunityDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id;
  
  const { userId, openPostJobModal, showToast } = useProfile();
  
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [myApplication, setMyApplication] = useState(null);
  const [isApplying, setIsApplying] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);

  const fetchJob = useCallback(async () => {
    const jobId = params?.id || params?.jobId; // Ensure parameter name matches the folder
    if (!jobId) return;
    try {
      setLoading(true);
      const supabase = createClient();
      const { data: job, error } = await supabase
        .from('jobs_search_view')
        .select('*, company:companies(*), poster:profiles(*)')
        .eq('id', jobId)
        .maybeSingle();
 
      if (error) {
        console.error('Job Detail Fetch Error:', JSON.stringify(error, null, 2));
        // Temporarily comment out notFound() during debugging so we can read the error on screen if it fails
        // return notFound(); 
        setError(error.message || JSON.stringify(error));
      } else if (!job) {
        setError("This job opportunity is no longer available or you don't have permission to view it.");
      } else {
        const filled = job.filled_positions || 0;
        const total = job.number_of_positions || 1;
        job.available_positions = Math.max(0, total - filled);
        job.is_position_filled = filled >= total;
        setJob(job);
      }
    } catch (err) {
      console.error('Exception fetching job details:', err);
      setError('An unexpected error occurred while loading this opportunity.');
    } finally {
      setLoading(false);
    }
  }, [params]);

  useEffect(() => {
    fetchJob();
  }, [fetchJob]);

  // Set up listener for window 'job-posted' event to refresh detail view automatically on save edit
  useEffect(() => {
    const handleJobUpdate = () => {
      fetchJob();
    };

    window.addEventListener('job-posted', handleJobUpdate);
    return () => {
      window.removeEventListener('job-posted', handleJobUpdate);
    };
  }, [fetchJob]);

  const currentUser = userId ? { id: userId } : null;

  useEffect(() => {
    const checkApplication = async () => {
      if (!currentUser || !id) return;
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from('applications')
          .select('id, status, withdrawal_count, documents')
          .eq('job_id', id)
          .eq('applicant_id', currentUser.id)
          .maybeSingle();

        if (data && !error) {
          setMyApplication(data);
        }
      } catch (err) {
        console.error('Error checking application:', err);
      }
    };
    checkApplication();
  }, [currentUser, id]);

  if (loading) {
    return (
      <div className="max-w-4xl w-full mx-auto px-4 md:px-8 py-8 animate-pulse space-y-6">
        <div className="h-6 w-36 bg-gray-200 rounded-md mb-8"></div>
        <div className="flex gap-4 items-center">
          <div className="w-16 h-16 bg-gray-200 rounded-md"></div>
          <div className="space-y-2 flex-1">
            <div className="h-6 w-1/3 bg-gray-200 rounded-md"></div>
            <div className="h-4 w-1/4 bg-gray-200 rounded-md"></div>
          </div>
        </div>
        <div className="h-40 bg-gray-50 border border-gray-100 rounded-lg p-5"></div>
        <div className="h-32 bg-gray-200 rounded-md"></div>
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="max-w-4xl w-full mx-auto px-4 md:px-8 py-12 flex flex-col items-center justify-center text-center">
        <AlertCircle size={48} className="text-red-500 mb-4" />
        <h2 className="text-xl font-bold text-gray-900 mb-2">Opportunity Not Found</h2>
        <p className="text-sm text-gray-600 mb-6 max-w-md">
          {error || 'This job opportunity may have been removed, closed, or is temporarily unavailable.'}
        </p>
        <button 
          onClick={() => router.push('/mservices')}
          className="inline-flex items-center gap-2 bg-blue-900 hover:bg-blue-800 text-white px-5 py-2.5 rounded-lg text-sm font-semibold transition-all shadow-sm"
        >
          <ArrowLeft size={16} /> Back to Opportunity Feed
        </button>
      </div>
    );
  }

  const isOwner = userId && (userId === job?.user_id || userId === job?.poster_id);
  const companyName = job.company?.name || (typeof job.company === 'string' ? job.company : null) || job.poster?.name || 'Private Poster';

  const getCompanyIcon = (company) => {
    if (!company) return <Briefcase size={32} className="text-blue-900" />;
    const name = typeof company === 'string' ? company.toLowerCase() : (company.name || '').toLowerCase();
    if (name.includes('wave')) return <Ship size={32} className="text-blue-900" />;
    if (name.includes('meridian')) return <Compass size={32} className="text-blue-900" />;
    if (name.includes('oceanic')) return <Anchor size={32} className="text-blue-900" />;
    return <Briefcase size={32} className="text-blue-900" />;
  };

  const payAmount = job.payAmount || job.pay_rate_amount || '';
  const currency = job.currency || 'USD';
  const payRate = job.payRate || job.pay_rate_period || 'Hour';
  const salaryRange = job.salary_range || (payAmount ? `${currency} ${payAmount}/${payRate}` : 'Competitive');
  
  const location = job.location || 'N/A';
  const jobType = job.employment_type || job.jobType || job.job_type || 'Full-time';
  const experienceLevel = job.experienceLevel || job.experience_level || 'Mid';
  const tags = job.required_skills || job.tags || [];


  const handleApply = async () => {
    if (!currentUser) {
      if (showToast) showToast('You must be logged in to apply.', 'error');
      else alert('You must be logged in to apply.');
      router.push('/login');
      return;
    }

    setIsApplying(true);
    try {
      const supabase = createClient();
      const uploadedDocs = [];

      if (selectedFiles.length > 0) {
        for (const file of selectedFiles) {
          const fileExt = file.name.split('.').pop();
          const fileName = `${currentUser.id}-${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
          const { error: uploadError } = await supabase.storage.from('resumes').upload(fileName, file);
          if (uploadError) {
            if (showToast) showToast(`Upload failed for "${file.name}": ` + uploadError.message, 'error');
            setIsApplying(false);
            return;
          }
          const { data: pubData } = supabase.storage.from('resumes').getPublicUrl(fileName);
          uploadedDocs.push({ name: file.name, url: pubData?.publicUrl || '' });
        }
      }

      const { data: appData, error: applyError } = await supabase
        .from('applications')
        .insert({ job_id: job.id, applicant_id: currentUser.id, documents: uploadedDocs })
        .select('id, status, withdrawal_count, documents')
        .maybeSingle();

      if (applyError) {
        if (showToast) showToast('Failed to submit application: ' + applyError.message, 'error');
        else alert('Failed to submit application: ' + applyError.message);
      } else {
        setMyApplication(appData);
        setSelectedFiles([]);
        if (showToast) showToast('Application submitted successfully!', 'success');
        else alert('Application submitted successfully!');
      }
    } catch (err) {
      console.error('Exception in handleApply:', err);
    } finally {
      setIsApplying(false);
    }
  };

  const handleWithdraw = async () => {
    if (!myApplication) return;
    const remaining = (job?.withdrawal_limit ?? 3) - ((myApplication.withdrawal_count ?? 0) + 1);
    const confirmed = window.confirm(
      `Are you sure you want to withdraw your application?\n\nYou have ${
        remaining
      } withdrawal${remaining !== 1 ? 's' : ''} remaining after this.`
    );
    if (!confirmed) return;

    setIsWithdrawing(true);
    try {
      const supabase = createClient();
      const newCount = (myApplication.withdrawal_count ?? 0) + 1;
      const { data: updated, error } = await supabase
        .from('applications')
        .update({ status: 'Withdrawn', withdrawal_count: newCount })
        .eq('id', myApplication.id)
        .select('id, status, withdrawal_count, documents')
        .maybeSingle();

      if (error) {
        if (showToast) showToast('Failed to withdraw: ' + error.message, 'error');
      } else {
        if (updated) {
          setMyApplication(updated);
        }
        setSelectedFiles([]);
        if (showToast) showToast('Application withdrawn.', 'success');
      }
    } catch (err) {
      console.error('Exception in handleWithdraw:', err);
    } finally {
      setIsWithdrawing(false);
    }
  };

  const handleReApply = async () => {
    if (!currentUser || !myApplication) return;

    setIsApplying(true);
    try {
      const supabase = createClient();
      const uploadedDocs = [];

      if (selectedFiles.length > 0) {
        for (const file of selectedFiles) {
          const fileExt = file.name.split('.').pop();
          const fileName = `${currentUser.id}-${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
          const { error: uploadError } = await supabase.storage.from('resumes').upload(fileName, file);
          if (uploadError) {
            if (showToast) showToast(`Upload failed for "${file.name}": ` + uploadError.message, 'error');
            setIsApplying(false);
            return;
          }
          const { data: pubData } = supabase.storage.from('resumes').getPublicUrl(fileName);
          uploadedDocs.push({ name: file.name, url: pubData?.publicUrl || '' });
        }
      }

      const { data: updated, error } = await supabase
        .from('applications')
        .update({
          status: 'Pending',
          documents: uploadedDocs,
          applied_at: new Date().toISOString(),
        })
        .eq('id', myApplication.id)
        .select('id, status, withdrawal_count, documents')
        .maybeSingle();

      if (error) {
        if (showToast) showToast('Failed to re-apply: ' + error.message, 'error');
      } else {
        if (updated) {
          setMyApplication(updated);
        }
        setSelectedFiles([]);
        if (showToast) showToast('Re-application submitted!', 'success');
      }
    } catch (err) {
      console.error('Exception in handleReApply:', err);
    } finally {
      setIsApplying(false);
    }
  };

  const handleDeleteJob = async () => {
    setIsDeleting(true);
    const supabase = createClient();
    const { error: deleteError } = await supabase
      .from('jobs')
      .delete()
      .eq('id', job.id);
    
    setIsDeleting(false);
    
    if (!deleteError) {
      setIsDeleteConfirmOpen(false);
      if (showToast) {
        showToast('Opportunity posting deleted successfully.', 'success');
      }
      
      // Notify parent lists to update
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('job-posted'));
      }
      
      router.push('/mservices');
    } else {
      console.error('Error deleting job:', deleteError);
      alert('Error deleting job: ' + deleteError.message);
    }
  };

  return (
    <div className="max-w-4xl w-full mx-auto px-4 md:px-8 pt-8 pb-[calc(var(--mobile-nav-height,72px)+env(safe-area-inset-bottom)+32px)] md:pb-8 space-y-6">
      {/* Back button link */}
      <button 
        onClick={() => router.push('/mservices')}
        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-blue-900 transition-colors font-medium mb-2 group"
      >
        <ArrowLeft size={16} className="transform group-hover:-translate-x-1 transition-transform" /> 
        Back to Opportunity Feed
      </button>

      {/* Position Filled Alert Banner */}
      {job.is_position_filled && (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-lg p-4 flex gap-3 items-center">
          <AlertTriangle className="text-amber-600 flex-shrink-0" size={20} />
          <div>
            <p className="text-sm font-bold">Position Filled</p>
            <p className="text-xs text-amber-800">All available positions for this opportunity have been filled.</p>
          </div>
        </div>
      )}

      {/* Main Premium Card */}
      <div className="bg-white rounded-xl shadow-md border border-gray-100 sm:overflow-hidden flex flex-col">
        
        {/* Profile/Company Header Block */}
        <div className="border-b border-gray-100 py-6 px-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-50/30">
          <div className="flex gap-4 items-center">
            {/* Dynamic Logo Container */}
            <div className="w-16 h-16 bg-white border border-gray-100 rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm">
              {getCompanyIcon(job.company)}
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-blue-900 leading-tight tracking-tight">{job.title}</h1>
              <p className="text-sm font-semibold text-gray-700 mt-1">{companyName}</p>
            </div>
          </div>
          
          {/* Status Badge */}
          <span className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider ${
            job.status?.toLowerCase() === 'draft' 
              ? 'bg-amber-50 text-amber-700 border border-amber-100'
              : job.is_position_filled
                ? 'bg-amber-100 text-amber-800 border border-amber-200'
                : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
          }`}>
            {job.status?.toLowerCase() === 'draft' ? 'Draft' : job.is_position_filled ? 'Position Filled' : 'Open'}
          </span>
        </div>

        {/* Core Content Body */}
        <div className="p-8 space-y-8">
          
          {/* Overview Grid */}
          <div className="bg-gray-50/50 rounded-lg p-6 border border-gray-100">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Job Overview</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-900 flex-shrink-0">
                  <DollarSign size={20} />
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-semibold">Compensation</p>
                  <p className="text-sm font-bold text-gray-800">{salaryRange}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-900 flex-shrink-0">
                  <MapPin size={20} />
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-semibold">Location</p>
                  <p className="text-sm font-bold text-gray-800">{location}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-900 flex-shrink-0">
                  <Clock size={20} />
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-semibold">Employment Type</p>
                  <p className="text-sm font-bold text-gray-800">{jobType}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-900 flex-shrink-0">
                  <Briefcase size={20} />
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-semibold">Number of Positions</p>
                  <p className="text-sm font-bold text-gray-800">
                    {job.filled_positions || 0} / {job.number_of_positions || 1} Filled ({job.available_positions ?? Math.max(0, (job.number_of_positions || 1) - (job.filled_positions || 0))} Available)
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Skill Tag Pills */}
          {tags.length > 0 && (
            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700 block">Required Skills & Credentials</label>
              <div className="flex flex-wrap gap-2">
                {tags.map((tag, index) => (
                  <span 
                    key={index} 
                    className="bg-blue-50/80 text-blue-700 px-3.5 py-1.5 rounded-lg text-xs font-bold border border-blue-100 shadow-2xs"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Rich Description */}
          {job.description && (
            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700 block">Job Description</label>
              <div className="bg-white border border-gray-100 rounded-lg p-5 shadow-2xs">
                <div 
                  className="prose prose-sm max-w-none text-gray-700 text-sm leading-relaxed rich-text-content"
                  dangerouslySetInnerHTML={{ __html: job.description }}
                />
              </div>
            </div>
          )}

          {/* Rich Responsibilities */}
          {job.responsibilities && (
            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700 block">Responsibilities</label>
              <div className="bg-white border border-gray-100 rounded-lg p-5 shadow-2xs">
                <div 
                  className="prose prose-sm max-w-none text-gray-700 text-sm leading-relaxed rich-text-content"
                  dangerouslySetInnerHTML={{ __html: job.responsibilities }}
                />
              </div>
            </div>
          )}
          
        </div>

        {/* Premium Control Sticky Footer Action Bar */}
        <div className="flex items-center justify-end gap-3 py-5 px-8 border-t border-gray-100 bg-slate-50 job-detail-action-bar">
          {isOwner ? (
            <>
              <button 
                className="px-5 py-2.5 bg-red-50 text-red-600 hover:bg-red-100 text-sm font-bold rounded-lg transition-colors flex items-center gap-2 mr-auto"
                onClick={() => setIsDeleteConfirmOpen(true)}
              >
                <Trash2 size={16} /> Delete Posting
              </button>
              
              <button 
                className="px-6 py-2.5 bg-blue-900 hover:bg-blue-850 text-white text-sm font-bold rounded-lg transition-all shadow-sm flex items-center gap-2"
                onClick={() => openPostJobModal(job)}
              >
                <Edit3 size={16} /> Edit Opportunity
              </button>
            </>
          ) : (
            !(currentUser && (currentUser.id === job?.user_id || currentUser.id === job?.poster_id)) && (() => {
              // Derive state
              const isPending   = myApplication?.status === 'Pending';
              const isWithdrawn = myApplication?.status === 'Withdrawn';
              const isShortlisted = myApplication?.status === 'Shortlisted';
              const isOffered = myApplication?.status === 'Offered';
              const isAccepted = myApplication?.status === 'Accepted';
              const isRejected = myApplication?.status === 'Rejected';
              const isExpired = myApplication?.status === 'Expired';
              
              const withdrawCount = myApplication?.withdrawal_count ?? 0;
              const withdrawLimit = job?.withdrawal_limit ?? 3;
              const canReApply   = isWithdrawn && withdrawCount < withdrawLimit;
              const isLocked     = isWithdrawn && withdrawCount >= withdrawLimit;
              const needsUpload  = (!myApplication || canReApply) && !job?.is_position_filled;

              const getApplicantStatusBadge = () => null;

              return (
                <div className="flex flex-col items-end gap-3 w-full sm:w-auto">

                  {/* Document upload — shown for fresh apply AND re-apply */}
                  {needsUpload && (
                    <div className="w-full">
                      <label htmlFor="docs-upload" className="block text-xs font-semibold text-gray-500 mb-1.5">
                        Attach Documents{' '}
                        <span className="font-normal text-gray-400">(PDF, DOC, DOCX — optional)</span>
                      </label>
                      <input
                        id="docs-upload"
                        type="file"
                        accept=".pdf,.doc,.docx"
                        multiple
                        onChange={(e) => {
                          const incoming = Array.from(e.target.files || []);
                          setSelectedFiles((prev) => {
                            const names = new Set(prev.map((f) => f.name));
                            return [...prev, ...incoming.filter((f) => !names.has(f.name))];
                          });
                          e.target.value = '';
                        }}
                        className="block w-full text-sm text-gray-500
                          file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0
                          file:text-sm file:font-semibold file:bg-gray-100 file:text-gray-700
                          hover:file:bg-gray-200 file:cursor-pointer file:transition-colors cursor-pointer"
                      />
                      {selectedFiles.length > 0 && (
                        <ul className="mt-2 space-y-1">
                          {selectedFiles.map((file, idx) => (
                            <li key={idx} className="flex items-center justify-between gap-2 bg-gray-50 border border-gray-100 rounded-lg px-3 py-1.5">
                              <span className="text-[11px] text-gray-700 font-medium truncate flex items-center gap-1.5">📄 {file.name}</span>
                              <button
                                type="button"
                                onClick={() => setSelectedFiles((prev) => prev.filter((_, i) => i !== idx))}
                                className="text-gray-400 hover:text-red-500 transition-colors text-sm font-bold shrink-0"
                                aria-label={`Remove ${file.name}`}
                              >×</button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}

                  {/* State A — no application yet */}
                  {!myApplication && (
                    job?.is_position_filled ? (
                      <button
                        disabled
                        className="px-8 py-3 bg-amber-50 text-amber-800 border border-amber-200 cursor-not-allowed rounded-lg text-sm font-bold w-full sm:w-auto opacity-75"
                      >
                        Position Filled
                      </button>
                    ) : (
                      <button
                        onClick={handleApply}
                        disabled={isApplying}
                        className={
                          isApplying
                            ? 'px-8 py-3 bg-blue-900 opacity-70 text-white cursor-not-allowed rounded-lg text-sm font-bold w-full sm:w-auto'
                            : 'px-8 py-3 bg-blue-900 hover:bg-blue-800 text-white rounded-lg text-sm font-bold shadow-md hover:shadow-lg transition-all w-full sm:w-auto'
                        }
                      >
                        {isApplying ? (selectedFiles.length > 0 ? `Uploading ${selectedFiles.length} file${selectedFiles.length > 1 ? 's' : ''}...` : 'Applying...') : 'Quick Apply to Position'}
                      </button>
                    )
                  )}

                  {/* State B — Pending: Applied + Withdraw */}
                  {isPending && (
                    <div className="flex flex-col items-end gap-2 w-full sm:w-auto">
                      <button
                        onClick={handleWithdraw}
                        disabled={isWithdrawing}
                        className="text-xs font-semibold text-red-600 hover:text-red-800 transition-colors bg-transparent border-none cursor-pointer underline underline-offset-2 self-end"
                        style={{ outline: 'none' }}
                      >
                        {isWithdrawing ? 'Withdrawing...' : 'Withdraw Application'}
                      </button>
                    </div>
                  )}

                  {/* State C — Withdrawn & Locked */}
                  {isLocked && (
                    <div className="flex flex-col items-end gap-2 w-full sm:w-auto">
                      <button
                        disabled
                        className="px-8 py-2 bg-gray-200 text-gray-400 cursor-not-allowed rounded-lg text-xs font-bold w-full sm:w-auto"
                      >
                        Withdrawal Limit Reached
                      </button>
                    </div>
                  )}

                  {/* State D — Withdrawn & Can Re-Apply */}
                  {canReApply && (
                    <div className="flex flex-col items-end gap-2 w-full sm:w-auto">
                      {job?.is_position_filled ? (
                        <button
                          disabled
                          className="px-8 py-3 bg-amber-50 text-amber-800 border border-amber-200 cursor-not-allowed rounded-lg text-sm font-bold w-full sm:w-auto opacity-75"
                        >
                          Position Filled
                        </button>
                      ) : (
                        <button
                          onClick={handleReApply}
                          disabled={isApplying}
                          className={
                            isApplying
                              ? 'px-8 py-3 bg-blue-900 opacity-70 text-white cursor-not-allowed rounded-lg text-sm font-bold w-full sm:w-auto'
                              : 'px-8 py-3 bg-blue-900 hover:bg-blue-800 text-white rounded-lg text-sm font-bold shadow-md hover:shadow-lg transition-all w-full sm:w-auto'
                          }
                        >
                          {isApplying ? (selectedFiles.length > 0 ? `Uploading ${selectedFiles.length} file${selectedFiles.length > 1 ? 's' : ''}...` : 'Applying...') : 'Re-Apply to Position'}
                        </button>
                      )}
                    </div>
                  )}

                </div>
              );
            })()
          )}
        </div>

      </div>

      {/* Delete Confirmation Modal Overlay */}
      {isDeleteConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="max-w-md w-full bg-white rounded-xl p-6 shadow-2xl flex flex-col relative z-10 animate-in fade-in zoom-in duration-200">
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
                className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2"
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
