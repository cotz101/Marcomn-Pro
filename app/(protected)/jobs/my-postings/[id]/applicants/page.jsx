'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useProfile } from '@/app/context/ProfileContext';
import { createClient } from '@/lib/supabase';
import { cancelJobOrderByCompany } from '@/app/actions/jobOrders';
import { markJobOrderCompleted } from '@/app/actions/reputation';
import {
  ArrowLeft,
  Briefcase,
  Loader2,
  MapPin,
  Users,
  ExternalLink,
  Calendar,
  Building2,
  FileText,
} from 'lucide-react';

const SkeletonCard = () => (
  <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm animate-pulse flex items-center justify-between gap-4">
    <div className="flex items-center gap-4 flex-1">
      <div className="w-14 h-14 rounded-full bg-gray-200 shrink-0" />
      <div className="space-y-2 flex-1">
        <div className="h-4 bg-gray-200 rounded w-1/3" />
        <div className="h-3 bg-gray-200 rounded w-1/2" />
        <div className="h-3 bg-gray-100 rounded w-1/4" />
      </div>
    </div>
    <div className="h-9 bg-gray-100 rounded-lg w-36 shrink-0" />
  </div>
);

export default function ApplicantsPage() {
  const { id } = useParams();
  const router = useRouter();
  const { userId, showToast } = useProfile();

  const [job, setJob] = useState(null);
  const [applicants, setApplicants] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedApplicant, setSelectedApplicant] = useState(null);
  const [mobilePreviewOpen, setMobilePreviewOpen] = useState(false);

  const [offerExpiryOptions, setOfferExpiryOptions] = useState([24, 48, 72]);
  const [defaultOfferExpiry, setDefaultOfferExpiry] = useState(48);
  const [isOfferModalOpen, setIsOfferModalOpen] = useState(false);
  const [appToOffer, setAppToOffer] = useState(null);
  const [selectedExpiryHours, setSelectedExpiryHours] = useState(48);

  const [isCompanyCancelModalOpen, setIsCompanyCancelModalOpen] = useState(false);
  const [appToCancel, setAppToCancel] = useState(null);
  const [companyCancelReason, setCompanyCancelReason] = useState('');
  const [companyCancelRemarks, setCompanyCancelRemarks] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);

  const [isMarkCompleteModalOpen, setIsMarkCompleteModalOpen] = useState(false);
  const [appToComplete, setAppToComplete] = useState(null);
  const [feedbackSentiment, setFeedbackSentiment] = useState('');
  const [feedbackTags, setFeedbackTags] = useState([]);
  const [feedbackComment, setFeedbackComment] = useState('');
  const [isCompleting, setIsCompleting] = useState(false);

  const fetchData = useCallback(async () => {
    if (!userId || !id) return;

    setIsLoading(true);
    setError(null);

    try {
      const supabase = createClient();

      // ── 1. Fetch the job row ──────────────────────────────────────────────
      const { data: jobData, error: jobError } = await supabase
        .from('jobs')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (jobError) throw jobError;

      if (!jobData) {
        setError('This job posting could not be found.');
        return;
      }

      // ── 2. Ownership guard ────────────────────────────────────────────────
      const posterId = jobData.poster_id || jobData.user_id;
      if (posterId !== userId) {
        router.replace('/jobs/my-postings');
        return;
      }

      setJob(jobData);

      // ── 3. Step One: Fetch applications for this job ──────────────────────
      const { data: apps, error: appsError } = await supabase
        .from('applications')
        .select('*, job_cancellations(*), job_orders(*)')
        .eq('job_id', id)
        .order('applied_at', { ascending: false });

      if (appsError) throw appsError;

      if (!apps || apps.length === 0) {
        setApplicants([]);
        return;
      }

      // ── 4. Step Two: Fetch public profiles ───────────────────────────────
      const applicantIds = apps.map((app) => app.applicant_id);
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .in('id', applicantIds);

      if (profilesError) throw profilesError;

      // ── 5. Step Three: Merge data ─────────────────────────────────────────
      const merged = apps.map((app) => {
        const profile = profilesData?.find((p) => p.id === app.applicant_id) || {};
        
        // Derive correct status from job_orders if a completed order exists
        const orderArray = Array.isArray(app.job_orders) ? app.job_orders : [app.job_orders].filter(Boolean);
        const hasCompletedOrder = orderArray.some(o => o.status === 'Completed');
        const effectiveStatus = hasCompletedOrder ? 'Completed' : app.status;

        return { ...app, status: effectiveStatus, profile };
      });

      // ── 6. Fetch platform settings for offer expiry ────────────────────────
      const { data: settingsData } = await supabase
        .from('platform_settings')
        .select('key, value')
        .in('key', ['job_offer_expiry_options_hours', 'default_job_offer_expiry_hours']);
        
      if (settingsData) {
        const opts = settingsData.find(s => s.key === 'job_offer_expiry_options_hours');
        const def = settingsData.find(s => s.key === 'default_job_offer_expiry_hours');
        if (opts && opts.value) setOfferExpiryOptions(opts.value.split(',').map(n => parseInt(n.trim(), 10)));
        if (def && def.value) {
            const defVal = parseInt(def.value, 10);
            setDefaultOfferExpiry(defVal);
            setSelectedExpiryHours(defVal);
        }
      }

      setApplicants(merged);
      if (merged.length > 0) setSelectedApplicant(merged[0]);
    } catch (err) {
      console.error('Error loading applicants page:', err.message || err);
      setError('Something went wrong while loading applicants. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [userId, id, router]);

  const handleStatusChange = async (applicationId, newStatus) => {
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('applications')
        .update({ status: newStatus })
        .eq('id', applicationId);

      if (error) throw error;

      setApplicants((prev) =>
        prev.map((app) => (app.id === applicationId ? { ...app, status: newStatus } : app))
      );

      if (showToast) {
        showToast(`Application status updated to "${newStatus}"`, 'success');
      }
    } catch (err) {
      console.error('Error updating application status:', err);
      if (showToast) {
        showToast('Failed to update application status: ' + (err.message || err), 'error');
      }
    }
  };

  const handleSendOffer = async () => {
    if (!appToOffer) return;
    try {
      const supabase = createClient();
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + selectedExpiryHours);

      const { error } = await supabase
        .from('applications')
        .update({ 
          status: 'Offered',
          offer_sent_at: new Date().toISOString(),
          offer_expires_at: expiresAt.toISOString(),
          offer_expiry_hours: selectedExpiryHours
        })
        .eq('id', appToOffer.id);

      if (error) throw error;

      setApplicants((prev) =>
        prev.map((app) => (app.id === appToOffer.id ? { 
          ...app, 
          status: 'Offered',
          offer_sent_at: new Date().toISOString(),
          offer_expires_at: expiresAt.toISOString()
        } : app))
      );

      setIsOfferModalOpen(false);
      setAppToOffer(null);
      if (showToast) showToast('Job offer sent successfully!', 'success');
    } catch (err) {
      console.error('Error sending offer:', err);
      if (showToast) showToast('Failed to send offer: ' + (err.message || err), 'error');
    }
  };

  const handleConfirmCompanyCancellation = async () => {
    if (!appToCancel || !companyCancelReason) {
      if (showToast) showToast('Please select a cancellation reason.', 'error');
      return;
    }
    
    // Safely extract job_orders correctly handling object or array
    const orderArray = Array.isArray(appToCancel.job_orders) ? appToCancel.job_orders : [appToCancel.job_orders].filter(Boolean);
    const order = orderArray.find(o => o.status === 'Active');
    if (!order) {
      if (showToast) showToast('Active engagement not found.', 'error');
      return;
    }

    setIsCancelling(true);
    try {
      const res = await cancelJobOrderByCompany({
        jobOrderId: order.id,
        reason: companyCancelReason,
        remarks: companyCancelRemarks
      });

      if (!res.success) throw new Error(res.error || 'Failed to cancel engagement.');

      setApplicants((prev) =>
        prev.map((app) => (app.id === appToCancel.id ? { 
          ...app, 
          status: 'Company Cancelled',
          job_cancellations: [{ cancellation_reason: companyCancelReason, cancellation_remarks: companyCancelRemarks }]
        } : app))
      );

      setIsCompanyCancelModalOpen(false);
      setAppToCancel(null);
      if (showToast) showToast('Engagement successfully cancelled.', 'success');
    } catch (err) {
      console.error('Error cancelling engagement:', err);
      if (showToast) showToast('Failed to cancel engagement: ' + (err.message || err), 'error');
    } finally {
      setIsCancelling(false);
    }
  };

  const handleConfirmCompletion = async () => {
    if (!appToComplete || !feedbackSentiment) {
      if (showToast) showToast('Please select a feedback sentiment.', 'error');
      return;
    }

    const orderArray = Array.isArray(appToComplete.job_orders) ? appToComplete.job_orders : [appToComplete.job_orders].filter(Boolean);
    const order = orderArray.find(o => o.status === 'Active');
    if (!order) {
      if (showToast) showToast('Active engagement not found.', 'error');
      return;
    }

    setIsCompleting(true);
    try {
      const res = await markJobOrderCompleted({
        jobOrderId: order.id,
        feedbackData: {
          sentiment: feedbackSentiment,
          tags: feedbackTags,
          comment: feedbackComment,
          submittedByUserId: userId
        }
      });

      if (!res.success) throw new Error(res.error || 'Failed to mark engagement as completed.');

      setApplicants((prev) =>
        prev.map((app) => (app.id === appToComplete.id ? { 
          ...app, 
          status: 'Completed'
        } : app))
      );

      setIsMarkCompleteModalOpen(false);
      setAppToComplete(null);
      if (showToast) showToast('Engagement marked as completed!', 'success');
    } catch (err) {
      console.error('Error marking completion:', err);
      if (showToast) showToast('Failed to mark as completed: ' + (err.message || err), 'error');
    } finally {
      setIsCompleting(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getFormattedDate = (dateStr) => {
    if (!dateStr) return 'Recently';
    try {
      return new Date(dateStr).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const getStatusStyles = (status) => {
    switch (status) {
      case 'Accepted':
        return 'border-emerald-200 bg-emerald-50 text-emerald-700 focus:ring-emerald-500 focus:border-emerald-500';
      case 'Offered':
        return 'border-blue-200 bg-blue-50 text-blue-700 focus:ring-blue-500 focus:border-blue-500';
      case 'Expired':
        return 'border-rose-200 bg-rose-50 text-rose-700 focus:ring-rose-500 focus:border-rose-500';
      case 'Candidate Cancelled':
        return 'border-red-200 bg-red-50 text-red-700 focus:ring-red-500 focus:border-red-500';
      case 'Company Cancelled':
        return 'border-red-200 bg-red-50 text-red-700 focus:ring-red-500 focus:border-red-500';
      case 'Completed':
        return 'border-emerald-300 bg-emerald-100 text-emerald-800 focus:ring-emerald-500 focus:border-emerald-500';
      case 'Shortlisted':
        return 'border-indigo-200 bg-indigo-50 text-indigo-700 focus:ring-indigo-500 focus:border-indigo-500';
      case 'Under Review':
        return 'border-sky-200 bg-sky-50 text-sky-700 focus:ring-sky-500 focus:border-sky-500';
      case 'Rejected':
        return 'border-rose-200 bg-rose-50 text-rose-700 focus:ring-rose-500 focus:border-rose-500';
      default: // 'Pending'
        return 'border-amber-200 bg-amber-50 text-amber-700 focus:ring-amber-500 focus:border-amber-500';
    }
  };

  // ── Loading state ──────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto py-8 px-6">
        {/* Back nav skeleton */}
        <div className="h-4 bg-gray-200 rounded w-40 mb-8 animate-pulse" />
        {/* Header skeleton */}
        <div className="mb-8 space-y-2">
          <div className="h-7 bg-gray-200 rounded w-1/2 animate-pulse" />
          <div className="h-4 bg-gray-100 rounded w-1/3 animate-pulse" />
        </div>
        <div className="space-y-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    );
  }

  // ── Error state ────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="max-w-5xl mx-auto py-8 px-6">
        <Link
          href="/jobs/my-postings"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-blue-700 font-medium transition-colors mb-8"
        >
          <ArrowLeft size={15} />
          Back to Job Postings
        </Link>
        <div className="bg-rose-50 border border-rose-100 rounded-xl p-8 text-center">
          <Briefcase className="mx-auto text-rose-300 mb-3" size={40} />
          <h2 className="text-lg font-bold text-rose-800 mb-1">Access Denied</h2>
          <p className="text-sm text-rose-600">{error}</p>
        </div>
      </div>
    );
  }

  const stripHtml = (value = '') => value.replace(/<[^>]*>/g, '').trim();
  const rawDescription = job?.description || job?.requirements || '';
  const cleanDescription = stripHtml(rawDescription);

  // ── Main render ────────────────────────────────────────────────────────────
  return (
    <div className="w-full max-w-7xl mx-auto py-4 px-4 lg:py-8 lg:px-8">
      <div className={`grid grid-cols-1 ${applicants.length > 0 ? 'lg:grid-cols-[minmax(420px,0.95fr)_minmax(360px,1.05fr)]' : 'lg:grid-cols-1 max-w-4xl mx-auto'} gap-6 lg:gap-8 items-start`}>
        
        {/* Left Column: Header + Applicants Roster */}
        <div className="flex flex-col gap-6 lg:gap-8 w-full min-w-0">
          
          {/* Universal Header (Mobile & Desktop) */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4 sm:p-5 lg:p-6 flex flex-col gap-6">
            <Link
              href="/jobs/my-postings"
              className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-blue-700 font-medium transition-colors w-fit -mb-2 lg:mb-0"
            >
              <ArrowLeft size={15} />
              Back to Job Postings
            </Link>
            
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
              <div className="flex flex-col gap-2.5 text-left min-w-0 flex-1">
                <p className="text-[11px] lg:text-xs font-bold text-gray-400 uppercase tracking-[0.15em] lg:tracking-wide">
                  Applicants for
                </p>
                <h1 className="text-3xl lg:text-[24px] font-bold text-blue-900 leading-tight">
                  {job?.title}
                </h1>
                
                <div className="flex flex-wrap items-center gap-2 mt-2 lg:mt-1">
                  {job?.location && (
                    <span className="inline-flex items-center px-3 py-1.5 lg:px-2.5 lg:py-1 rounded-full text-[11px] lg:text-[10px] font-bold bg-slate-100 text-slate-700 tracking-wide uppercase">
                      {job.location}
                    </span>
                  )}
                  {job?.company && (
                    <span className="inline-flex items-center px-3 py-1.5 lg:px-2.5 lg:py-1 rounded-full text-[11px] lg:text-[10px] font-bold bg-slate-100 text-slate-700 tracking-wide uppercase">
                      {job.company}
                    </span>
                  )}
                  
                  {/* Tags / Skills compact display */}
                  {(job?.skills?.length > 0 || job?.tags?.length > 0) && (
                    <>
                      {[...(job?.skills || []), ...(job?.tags || [])].slice(0, 3).map((item, i) => (
                        <span key={i} className="inline-flex items-center px-3 py-1.5 lg:px-2.5 lg:py-1 rounded-full text-[11px] lg:text-[10px] font-bold bg-blue-100 text-blue-800 tracking-wide uppercase">
                          {item}
                        </span>
                      ))}
                      {([...(job?.skills || []), ...(job?.tags || [])].length > 3) && (
                        <span className="inline-flex items-center px-3 py-1.5 lg:px-2.5 lg:py-1 rounded-full text-[11px] lg:text-[10px] font-bold bg-slate-200 text-slate-700 tracking-wide uppercase">
                          +{([...(job?.skills || []), ...(job?.tags || [])].length - 3)}
                        </span>
                      )}
                    </>
                  )}
                </div>
                
                {/* Job Description Preview (1025px+) */}
                {cleanDescription && (
                  <p className="hidden lg:block text-sm text-slate-600 leading-relaxed mt-3 line-clamp-2 pr-4">
                    {cleanDescription}
                  </p>
                )}
              </div>
              
              {/* Applicant Count Card */}
              <div className="bg-slate-50 border border-slate-100 rounded-xl py-5 px-8 lg:px-3 lg:py-3 lg:w-[96px] flex flex-col items-center justify-center gap-2 shrink-0 lg:self-start lg:ml-auto">
                <span className="text-5xl lg:text-3xl font-bold text-blue-700 leading-none">{applicants.length}</span>
                <span className="text-sm lg:text-[10px] font-bold text-blue-700 uppercase tracking-wide mt-1 lg:mt-0">
                  {applicants.length === 1 ? 'Applicant' : 'Applicants'}
                </span>
              </div>
            </div>
          </div>

          {/* Applicants Roster */}
          {applicants.length === 0 ? (
            <div className="bg-white border border-gray-100 rounded-xl p-14 text-center shadow-sm">
              <Users className="mx-auto text-gray-200 mb-4" size={52} />
              <h3 className="text-lg font-bold text-gray-800 mb-1">No applications received yet</h3>
              <p className="text-sm text-gray-500 max-w-sm mx-auto leading-relaxed">
                Once candidates click the Quick Apply action on your listing, their profiles will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
            {applicants.map((app) => {
              const profile = app.profile || {};
              const name = profile.name || profile.full_name || 'Anonymous Applicant';
              const headline = profile.currentRole || profile.headline || profile.bio || 'Maritime Professional';
              const avatar = profile.avatar_url || null;
              const appliedDate = getFormattedDate(app.applied_at);
              const initials = name.split(' ').map((n) => n[0]).slice(0, 2).join('');
              const isSelected = selectedApplicant?.id === app.id;
              
              return (
                <div 
                  className={`flex flex-col border rounded-2xl cursor-pointer transition-all relative overflow-hidden ${isSelected ? 'border-l-4 border-l-blue-800 border-y-slate-100 border-r-slate-100 bg-slate-50 lg:border-l lg:border-blue-500 lg:bg-blue-50/20 lg:shadow-md lg:ring-1 lg:ring-blue-500/10' : 'border-slate-100 bg-slate-50 lg:bg-white shadow-sm hover:border-blue-300 hover:shadow-md'}`} 
                  key={app.id}
                  onClick={() => {
                    setSelectedApplicant(app);
                    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
                      setMobilePreviewOpen(true);
                    }
                  }}
                >
                  <div className="flex flex-col w-full p-4 sm:p-5 pt-6">
                    {/* Top Row: Avatar + Info */}
                    <div className="flex items-start gap-3 w-full pr-12">
                      <div className="shrink-0 relative">
                        {avatar ? (
                          <img src={avatar} alt={name} className="w-14 h-14 rounded-xl object-cover border border-slate-200 shadow-sm" />
                        ) : (
                          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-100 to-blue-200 border border-blue-100 shadow-sm flex items-center justify-center text-blue-700 font-bold text-base">
                            {initials || '?'}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1 pt-0.5">
                        <h3 className="text-[17px] font-bold text-slate-900 truncate">{name}</h3>
                        <p className="text-[13px] text-slate-600 leading-snug mt-0.5 line-clamp-2">{headline}</p>
                        
                        {/* Location and Date directly below headline */}
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1.5 text-[11px] text-slate-500 font-medium uppercase tracking-wide">
                          {profile?.location ? (
                            <span>{profile.location}</span>
                          ) : (
                            <span>Global</span>
                          )}
                          <span className="text-slate-300">•</span>
                          <span>{appliedDate}</span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Status Bookmark */}
                    <div className="absolute top-0 right-0" onClick={(e) => e.stopPropagation()}>
                      {['Withdrawn', 'Accepted', 'Offered', 'Expired', 'Candidate Cancelled', 'Company Cancelled', 'Completed'].includes(app.status) ? (
                        <span className={`inline-flex items-center px-3 py-1.5 rounded-bl-xl text-[10px] font-bold uppercase tracking-widest shadow-sm border-b border-l ${
                          app.status === 'Accepted' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                          (app.status === 'Candidate Cancelled' || app.status === 'Company Cancelled') ? 'bg-red-50 text-red-700 border-red-200' :
                          app.status === 'Completed' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' :
                          app.status === 'Offered' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                          app.status === 'Expired' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                          'bg-slate-100 text-slate-500 border-slate-200'
                        }`}>
                          {app.status}
                        </span>
                      ) : (
                        <select value={app.status || 'Pending'} onChange={(e) => handleStatusChange(app.id, e.target.value)} className={`appearance-none text-center rounded-bl-xl text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 border-b border-l focus:outline-none cursor-pointer shadow-sm ${getStatusStyles(app.status || 'Pending')}`}>
                          <option value="Pending">Pending</option>
                          <option value="Under Review">Under Review</option>
                          <option value="Shortlisted">Shortlisted</option>
                          <option value="Rejected">Rejected</option>
                        </select>
                      )}
                    </div>

                    {/* Bottom Row: Skills */}
                    {profile?.skills?.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-5 pt-4 border-t border-slate-200/70">
                        {profile.skills.slice(0, 3).map((skill, idx) => (
                          <span key={idx} className="px-3 py-1 rounded-full bg-[#EAF3FA] border border-blue-100 text-[10px] font-bold text-[#004173] uppercase tracking-wide">
                            {skill}
                          </span>
                        ))}
                        {profile.skills.length > 3 && (
                          <span className="px-3 py-1 rounded-full bg-[#EAF3FA] border border-blue-100 text-[10px] font-bold text-[#004173] uppercase tracking-wide">
                            +{profile.skills.length - 3}
                          </span>
                        )}
                      </div>
                    )}

                    {(app.status === 'Candidate Cancelled' || app.status === 'Company Cancelled') && app.job_cancellations?.[0] && (
                      <div className="mt-4 p-3 bg-red-50 border border-red-100 rounded-lg text-sm text-red-800">
                        <strong>Cancellation Reason:</strong> {app.job_cancellations[0].cancellation_reason}
                        {app.job_cancellations[0].cancellation_remarks && (
                          <p className="mt-1 text-red-700 text-xs">{app.job_cancellations[0].cancellation_remarks}</p>
                        )}
                      </div>
                    )}
                    
                    {/* Action buttons */}
                    {app.status === 'Accepted' && (() => {
                      const orderArray = Array.isArray(app.job_orders) ? app.job_orders : [app.job_orders].filter(Boolean);
                      const order = orderArray.find(o => o.status === 'Active');
                      return order ? (
                        <div className="mt-4 flex flex-col sm:flex-row flex-wrap gap-2 justify-end">
                          <button 
                            onClick={(e) => { e.stopPropagation(); router.push(`/profile/${app.applicant_id}`); }}
                            className="px-4 py-1.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-bold rounded-lg transition-colors shadow-sm flex-1 sm:flex-none text-center"
                          >
                            View Profile
                          </button>
                          <button 
                            onClick={(e) => { e.stopPropagation(); router.push(`/messages?user=${app.applicant_id}`); }}
                            className="px-4 py-1.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-bold rounded-lg transition-colors shadow-sm flex-1 sm:flex-none text-center"
                          >
                            Message
                          </button>
                          <button 
                            onClick={(e) => { e.stopPropagation(); setAppToComplete(app); setFeedbackSentiment(''); setFeedbackComment(''); setFeedbackTags([]); setIsMarkCompleteModalOpen(true); }}
                            className="px-4 py-1.5 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 text-emerald-700 text-xs font-bold rounded-lg transition-colors shadow-sm w-full sm:w-auto text-center"
                          >
                            Mark Completed
                          </button>
                          <button 
                            onClick={(e) => { e.stopPropagation(); setAppToCancel(app); setCompanyCancelReason(''); setCompanyCancelRemarks(''); setIsCompanyCancelModalOpen(true); }}
                            className="px-4 py-1.5 bg-red-50 border border-red-200 hover:bg-red-100 text-red-700 text-xs font-bold rounded-lg transition-colors shadow-sm w-full sm:w-auto text-center"
                          >
                            Cancel Engagement
                          </button>
                        </div>
                      ) : null;
                    })()}

                    {app.status === 'Completed' && (
                      <div className="mt-4 flex flex-col sm:flex-row flex-wrap gap-2 justify-end">
                        <button 
                          onClick={(e) => { e.stopPropagation(); router.push(`/profile/${app.applicant_id}`); }}
                          className="px-4 py-1.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-bold rounded-lg transition-colors shadow-sm flex-1 sm:flex-none text-center"
                        >
                          View Profile
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); router.push(`/messages?user=${app.applicant_id}`); }}
                          className="px-4 py-1.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-bold rounded-lg transition-colors shadow-sm flex-1 sm:flex-none text-center"
                        >
                          Message
                        </button>
                      </div>
                    )}

                    {app.status === 'Shortlisted' && (
                      <div className="mt-4 flex justify-end">
                        <button 
                          onClick={(e) => { e.stopPropagation(); setAppToOffer(app); setIsOfferModalOpen(true); }}
                          className="px-4 py-1.5 bg-[#004173] hover:bg-blue-800 text-white text-xs font-bold rounded-lg transition-colors shadow-sm"
                        >
                          Send Job Offer
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          )}
        </div>

        {/* Right Column: Desktop preview (lg+) */}
        {applicants.length > 0 && (
          <aside className="hidden lg:block w-full">
            <div className="sticky top-[90px] min-h-[calc(100vh-120px)] max-h-[calc(100vh-120px)] overflow-y-auto border border-gray-100 rounded-xl p-6 bg-white shadow-sm flex flex-col">
              {selectedApplicant ? (
                <div>
                  <div className="flex flex-col items-center text-center gap-3 mb-5 pb-5 border-b border-gray-100">
                    <div className="shrink-0 relative pt-2.5">
                      {selectedApplicant.profile?.avatar_url ? (
                        <img src={selectedApplicant.profile.avatar_url} alt={selectedApplicant.profile?.name || 'Applicant'} className="w-20 h-20 rounded-full object-cover border-2 border-white shadow-md" />
                      ) : (
                        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 border-2 border-white shadow-md flex items-center justify-center text-blue-700 font-bold text-2xl">
                          {(selectedApplicant.profile?.name || '').split(' ').map(n=>n[0]).slice(0,2).join('').toUpperCase() || '?'}
                        </div>
                      )}
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-blue-950">{selectedApplicant.profile?.name || selectedApplicant.profile?.full_name || 'Anonymous Applicant'}</h3>
                      <p className="text-sm text-gray-500 mt-1">{selectedApplicant.profile?.currentRole || selectedApplicant.profile?.headline || selectedApplicant.profile?.bio}</p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <p className="text-[14px] text-[#004173] font-medium flex items-center justify-center gap-1.5"><Calendar size={14} /> Applied {getFormattedDate(selectedApplicant.applied_at)}</p>
                    </div>

                    {(selectedApplicant.application_message || selectedApplicant.message || selectedApplicant.cover_letter || selectedApplicant.intent) && (
                      <div className="pl-[10px] pt-1">
                        <h4 className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-2.5">Application Message</h4>
                        <p className="text-[13px] text-gray-700 leading-relaxed bg-slate-50 border border-gray-100 p-4 rounded-xl">
                          {selectedApplicant.application_message || selectedApplicant.message || selectedApplicant.cover_letter || selectedApplicant.intent}
                        </p>
                      </div>
                    )}

                    {Array.isArray(selectedApplicant.documents) && selectedApplicant.documents.length > 0 && (
                      <div className="pl-[10px] mt-8">
                        <h4 className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-2.5">Documents</h4>
                        <div className="flex flex-col gap-2.5">
                          {selectedApplicant.documents.map((doc, i) => (
                            <a key={i} href={doc.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 px-4 py-3 bg-gray-50 border border-gray-100 text-gray-700 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-100 text-sm font-medium rounded-xl transition-colors group" title={doc.name}>
                              <FileText size={20} className="text-gray-400 group-hover:text-blue-500 shrink-0" />
                              <span className="truncate">{doc.name}</span>
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="flex justify-center mt-6">
                      <button onClick={() => router.push(`/profile/${selectedApplicant.applicant_id}`)} className="inline-flex items-center justify-center gap-2 bg-white text-[#004173] border border-[#004173]/30 hover:bg-blue-50 px-6 py-3 min-h-[44px] rounded-xl font-semibold shadow-sm w-[calc(100%-10px)] transition-all duration-200">
                        View Full Profile<ExternalLink size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-400">
                  <p className="text-sm">Select an applicant to preview</p>
                </div>
              )}
            </div>
          </aside>
        )}
      </div>

      {/* Mobile preview modal */}
      {mobilePreviewOpen && selectedApplicant && (
            <div className="lg:hidden fixed inset-0 bg-white z-[9999] overflow-y-auto pt-[env(safe-area-inset-top)] flex flex-col">
              <div className="sticky top-0 bg-white border-b border-gray-100 p-4 flex items-center justify-between shadow-sm z-10">
                <h2 className="font-bold text-blue-950">Applicant Preview</h2>
                <button onClick={() => setMobilePreviewOpen(false)} className="p-2 text-gray-400 hover:bg-gray-100 rounded-full transition-colors font-bold text-lg">✕</button>
              </div>
              <div className="pt-6 pb-[calc(env(safe-area-inset-bottom)+120px)] flex-1">
                <div className="flex items-start gap-4 mb-6 px-4 sm:px-5 pl-6 sm:pl-7">
                  <div className="shrink-0 relative mt-1">
                    {selectedApplicant.profile?.avatar_url ? (
                      <img src={selectedApplicant.profile.avatar_url} alt={selectedApplicant.profile?.name || 'Applicant'} className="w-16 h-16 rounded-full object-cover border border-gray-100 shadow-sm" />
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 border border-blue-100 shadow-sm flex items-center justify-center text-blue-700 font-bold text-xl">
                        {(selectedApplicant.profile?.name || '').split(' ').map(n=>n[0]).slice(0,2).join('').toUpperCase() || '?'}
                      </div>
                    )}
                  </div>
                  <div>
                    <h3 className="text-[17px] font-bold text-blue-950 leading-snug">{selectedApplicant.profile?.name || selectedApplicant.profile?.full_name || 'Anonymous Applicant'}</h3>
                    <p className="text-[15px] text-gray-600 mt-1">{selectedApplicant.profile?.currentRole || selectedApplicant.profile?.headline || selectedApplicant.profile?.bio}</p>
                    {selectedApplicant.profile?.location && (
                      <p className="text-sm text-gray-500 mt-1.5 flex items-center gap-1.5"><MapPin size={14} className="shrink-0" /> {selectedApplicant.profile.location}</p>
                    )}
                  </div>
                </div>
                
                <div className="px-4 sm:px-5">
                  <div className="flex items-center justify-between bg-gray-50/50 border border-gray-100 rounded-xl p-4 mb-6">
                    <div>
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Applied Date</p>
                      <p className="text-[13px] font-semibold text-gray-700 flex items-center gap-1.5"><Calendar size={14} /> {getFormattedDate(selectedApplicant.applied_at)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Status</p>
                      {['Withdrawn', 'Accepted', 'Offered', 'Expired', 'Completed'].includes(selectedApplicant.status) ? (
                        <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-bold uppercase tracking-wide ${
                          selectedApplicant.status === 'Accepted' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                          selectedApplicant.status === 'Completed' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' :
                          selectedApplicant.status === 'Offered' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                          selectedApplicant.status === 'Expired' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                          'bg-slate-100 text-slate-500 border border-slate-200'
                        }`}>
                          {selectedApplicant.status}
                        </span>
                      ) : (
                        <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-bold uppercase tracking-wide ${getStatusStyles(selectedApplicant.status || 'Pending')}`}>
                          {selectedApplicant.status || 'Pending'}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {selectedApplicant.profile?.skills?.length > 0 && (
                    <div className="mb-6">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">Skills</h4>
                      <div className="flex flex-wrap gap-2">
                        {selectedApplicant.profile.skills.map((skill, i) => (
                          <span key={i} className="px-3 py-1 rounded-full border border-blue-100 bg-[#EAF3FA] text-xs font-semibold text-[#004173] tracking-wide uppercase">
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {selectedApplicant.profile?.bio && (
                    <div className="mb-6">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">About</h4>
                      <p className="text-[15px] text-gray-700 leading-relaxed bg-white border border-gray-100 shadow-sm p-4 rounded-2xl">{selectedApplicant.profile.bio}</p>
                    </div>
                  )}

                  {(selectedApplicant.application_message || selectedApplicant.message || selectedApplicant.cover_letter) && (
                    <div className="mb-6">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">Application Message</h4>
                      <p className="text-[15px] text-gray-700 leading-relaxed bg-white border border-gray-100 shadow-sm p-4 rounded-2xl">
                        {selectedApplicant.application_message || selectedApplicant.message || selectedApplicant.cover_letter}
                      </p>
                    </div>
                  )}
                  
                  {Array.isArray(selectedApplicant.documents) && selectedApplicant.documents.length > 0 && (
                    <div className="mb-8 text-center">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3 text-left">Documents</h4>
                      <div className="flex flex-wrap justify-center gap-3">
                        {selectedApplicant.documents.map((doc, i) => (
                          <a key={i} href={doc.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2.5 px-6 py-3 bg-[#EAF3FA] text-[#004173] active:bg-blue-100 text-[14px] font-semibold rounded-xl transition-colors" title={doc.name}>
                            <FileText size={20} className="shrink-0" />
                            <span className="truncate max-w-[160px]">{doc.name}</span>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  <div className="flex justify-center mt-12 mb-6">
                    <button onClick={() => router.push(`/profile/${selectedApplicant.applicant_id}`)} className="inline-flex items-center justify-center gap-2 px-8 py-3 min-h-[44px] bg-white text-[#004173] border border-[#004173]/30 hover:bg-[#EAF3FA] active:bg-blue-100 text-[15px] font-bold rounded-xl shadow-sm transition-colors w-fit">
                      View Full Profile<ExternalLink size={16} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

      {/* Company Cancel Engagement Modal */}
      {isCompanyCancelModalOpen && appToCancel && (
        <div className="fixed inset-0 bg-slate-900/40 z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl">
            <h3 className="text-lg font-bold text-red-700 mb-2">Cancel Engagement</h3>
            <p className="text-sm text-gray-600 mb-6">
              You are about to cancel this active engagement with <span className="font-semibold text-gray-800">{appToCancel.profile?.name || 'this applicant'}</span>. 
              The candidate will be notified. This action cannot be undone.
            </p>
            
            <div className="mb-4">
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Cancellation Reason *</label>
              <select 
                value={companyCancelReason}
                onChange={(e) => setCompanyCancelReason(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-700 outline-none focus:border-red-500 bg-gray-50"
              >
                <option value="" disabled>Select a reason...</option>
                <optgroup label="── Company / Business Reasons">
                  <option value="Position Cancelled">Position Cancelled</option>
                  <option value="Project Cancelled">Project Cancelled</option>
                  <option value="Vessel Schedule Changed">Vessel Schedule Changed</option>
                  <option value="Client Requirement Changed">Client Requirement Changed</option>
                  <option value="Role No Longer Needed">Role No Longer Needed</option>
                  <option value="Budget Issue">Budget Issue</option>
                  <option value="Company Internal Reason">Company Internal Reason</option>
                </optgroup>
                <optgroup label="── Applicant-Related Reasons">
                  <option value="Candidate No Show">Candidate No Show</option>
                  <option value="Candidate No Response">Candidate No Response</option>
                  <option value="Candidate Unreachable">Candidate Unreachable</option>
                  <option value="Candidate Failed Requirement">Candidate Failed Requirement</option>
                  <option value="Candidate Misrepresented Information">Candidate Misrepresented Information</option>
                  <option value="Candidate Declined After Confirmation">Candidate Declined After Confirmation</option>
                  <option value="Other Candidate Issue">Other Candidate Issue</option>
                </optgroup>
              </select>
              <p className="text-[10px] text-gray-400 mt-1.5 leading-snug">
                <span className="font-semibold text-amber-600">Note:</span> Company/Business reasons will automatically refund the candidate. Applicant-related reasons will be reviewed by MarComn before any refund decision.
              </p>
            </div>

            <div className="mb-6">
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Remarks (Optional)</label>
              <textarea 
                value={companyCancelRemarks}
                onChange={(e) => setCompanyCancelRemarks(e.target.value)}
                placeholder="Provide additional details..."
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-700 outline-none focus:border-red-500 bg-gray-50 resize-none h-24"
              />
            </div>
            
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => { setIsCompanyCancelModalOpen(false); setAppToCancel(null); }}
                disabled={isCancelling}
                className="px-5 py-2 text-sm font-bold text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
              >
                Go Back
              </button>
              <button 
                onClick={handleConfirmCompanyCancellation}
                disabled={isCancelling}
                className="px-5 py-2 text-sm font-bold bg-red-600 text-white hover:bg-red-700 rounded-xl transition-colors shadow-sm disabled:opacity-50"
              >
                {isCancelling ? 'Cancelling...' : 'Confirm Cancellation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mark Completed & Feedback Modal */}
      {isMarkCompleteModalOpen && appToComplete && (
        <div className="fixed inset-0 bg-slate-900/40 z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl">
            <h3 className="text-lg font-bold text-emerald-700 mb-2">Mark Engagement Completed</h3>
            <p className="text-sm text-gray-600 mb-6">
              You are about to mark this engagement with <span className="font-semibold text-gray-800">{appToComplete.profile?.name || 'this applicant'}</span> as completed. Please provide feedback on their performance.
            </p>
            
            <div className="mb-4">
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Overall Experience *</label>
              <div className="flex gap-2">
                {['positive', 'neutral', 'negative'].map((sentiment) => (
                  <button
                    key={sentiment}
                    onClick={() => setFeedbackSentiment(sentiment)}
                    className={`flex-1 py-2 px-3 rounded-lg text-sm font-semibold capitalize border transition-colors ${
                      feedbackSentiment === sentiment
                        ? sentiment === 'positive' ? 'bg-emerald-50 border-emerald-500 text-emerald-700' :
                          sentiment === 'neutral' ? 'bg-amber-50 border-amber-500 text-amber-700' :
                          'bg-red-50 border-red-500 text-red-700'
                        : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {sentiment}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Tags (Optional)</label>
              <div className="flex flex-wrap gap-2">
                {['Professional', 'Punctual', 'Skilled', 'Needs Improvement', 'Great Communication'].map(tag => {
                  const isSelected = feedbackTags.includes(tag);
                  return (
                    <button
                      key={tag}
                      onClick={() => setFeedbackTags(prev => isSelected ? prev.filter(t => t !== tag) : [...prev, tag])}
                      className={`px-3 py-1.5 rounded-full text-[11px] font-bold tracking-wide transition-colors border ${
                        isSelected 
                          ? 'bg-blue-50 border-blue-300 text-blue-700' 
                          : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Comment (Optional)</label>
              <textarea 
                value={feedbackComment}
                onChange={(e) => setFeedbackComment(e.target.value)}
                placeholder="Leave a comment for this candidate's profile..."
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-700 outline-none focus:border-emerald-500 bg-gray-50 resize-none h-24"
              />
            </div>
            
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => { setIsMarkCompleteModalOpen(false); setAppToComplete(null); }}
                disabled={isCompleting}
                className="px-5 py-2 text-sm font-bold text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
              >
                Go Back
              </button>
              <button 
                onClick={handleConfirmCompletion}
                disabled={isCompleting || !feedbackSentiment}
                className="px-5 py-2 text-sm font-bold bg-emerald-600 text-white hover:bg-emerald-700 rounded-xl transition-colors shadow-sm disabled:opacity-50"
              >
                {isCompleting ? 'Completing...' : 'Submit & Complete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Offer Expiry Modal */}
      {isOfferModalOpen && appToOffer && (
        <div className="fixed inset-0 bg-slate-900/40 z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl">
            <h3 className="text-lg font-bold text-[#004173] mb-2">Send Job Offer</h3>
            <p className="text-sm text-gray-600 mb-6">
              You are sending an offer to <span className="font-semibold text-gray-800">{appToOffer.profile?.name || 'this applicant'}</span>. 
              The applicant will be notified and will have a limited time to accept the offer before it expires.
            </p>
            
            <div className="mb-6">
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Offer Validity Period</label>
              <select 
                value={selectedExpiryHours}
                onChange={(e) => setSelectedExpiryHours(parseInt(e.target.value, 10))}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-700 outline-none focus:border-blue-500 bg-gray-50"
              >
                {offerExpiryOptions.map(hours => (
                  <option key={hours} value={hours}>{hours} Hours</option>
                ))}
              </select>
            </div>
            
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => { setIsOfferModalOpen(false); setAppToOffer(null); }}
                className="px-5 py-2 text-sm font-bold text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleSendOffer}
                className="px-5 py-2 text-sm font-bold bg-[#004173] text-white hover:bg-blue-800 rounded-xl transition-colors shadow-sm"
              >
                Send Offer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
