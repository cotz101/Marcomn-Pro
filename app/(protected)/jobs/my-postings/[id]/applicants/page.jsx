'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useProfile } from '@/app/context/ProfileContext';
import { createClient } from '@/lib/supabase';
import { cancelJobOrderByCompany } from '@/app/actions/jobOrders';
import { markJobOrderCompleted } from '@/app/actions/reputation';
import { confirmWorkCompletedByCompany, closeCompletedEngagementByCompany } from '@/app/actions/engagementLifecycle';
import EngagementTimeline from '@/src/components/engagement/EngagementTimeline';
import { approveAdvance, rejectAdvance, recordTransfer } from '@/app/actions/advances';
import { calculateAdvanceLedger } from '@/lib/advancesLedger';
import { formatCompensation } from '@/lib/compensation';
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
  Coins,
  ChevronDown,
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

const getAdvanceEligibility = (job, requests = []) => {
  if (!job) return { maxEligible: 0, totalConfirmed: 0, totalActive: 0, remaining: 0 };
  const salary = Number(job.salary_numeric || 0);
  let maxEligible = 0;
  if (job.advance_payment_type === 'percentage') {
    maxEligible = (salary * Number(job.advance_payment_value || 0)) / 100;
  } else {
    maxEligible = Number(job.advance_payment_value || 0);
  }
  if (job.advance_payment_max !== null) {
    maxEligible = Math.min(maxEligible, Number(job.advance_payment_max));
  }

  let totalConfirmed = 0;
  let totalActive = 0;

  for (const r of requests) {
    const isExpiredOrCancelled = ['rejected', 'cancelled', 'expired', 'review_closed'].includes(r.status);
    if (r.status === 'confirmed') {
      totalConfirmed += Number(r.approved_amount || r.requested_amount || 0);
    } else if (!isExpiredOrCancelled) {
      totalActive += Number(r.counter_amount !== null ? r.counter_amount : r.requested_amount);
    }
  }

  const remaining = Math.max(0, maxEligible - totalConfirmed - totalActive);
  return {
    maxEligible,
    totalConfirmed,
    totalActive,
    remaining
  };
};

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

  const [isConfirmWorkModalOpen, setIsConfirmWorkModalOpen] = useState(false);
  const [appToConfirmWork, setAppToConfirmWork] = useState(null);
  const [confirmWorkNote, setConfirmWorkNote] = useState('');
  const [isConfirmingWork, setIsConfirmingWork] = useState(false);



  // Record Transfer states
  const [isRecordTransferModalOpen, setIsRecordTransferModalOpen] = useState(false);
  const [requestToRecordTransfer, setRequestToRecordTransfer] = useState(null);
  const [paymentMethodInput, setPaymentMethodInput] = useState('bank_transfer');
  const [amountTransferredInput, setAmountTransferredInput] = useState('');
  const [transferDateInput, setTransferDateInput] = useState('');
  const [referenceNumberInput, setReferenceNumberInput] = useState('');
  const [recordTransferNotesInput, setRecordTransferNotesInput] = useState('');
  const [proofFileInput, setProofFileInput] = useState(null);
  const [isSubmittingRecordTransfer, setIsSubmittingRecordTransfer] = useState(false);
  const [recordTransferError, setRecordTransferError] = useState('');

  const handleOpenRecordTransferModal = (req) => {
    setRequestToRecordTransfer(req);
    setPaymentMethodInput('bank_transfer');
    setAmountTransferredInput(Number(req.approved_amount || req.counter_amount || req.requested_amount).toString());
    setTransferDateInput(new Date().toISOString().split('T')[0]);
    setReferenceNumberInput('');
    setRecordTransferNotesInput('');
    setProofFileInput(null);
    setRecordTransferError('');
    setIsRecordTransferModalOpen(true);
  };

  const handleSubmitRecordTransfer = async () => {
    if (!requestToRecordTransfer) return;
    if (paymentMethodInput !== 'cash' && !referenceNumberInput.trim()) {
      setRecordTransferError('Reference number is required.');
      return;
    }

    setIsSubmittingRecordTransfer(true);
    setRecordTransferError('');

    try {
      const supabase = createClient();
      let proofUrl = null;

      // Handle proof upload if selected
      if (proofFileInput) {
        const file = proofFileInput;
        const fileExt = file.name.split('.').pop();
        const fileName = `${requestToRecordTransfer.id}_${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = `advance_proofs/${fileName}`;
        const { error: uploadError } = await supabase.storage.from('resumes').upload(filePath, file);
        if (uploadError) throw uploadError;
        const { data: pubData } = supabase.storage.from('resumes').getPublicUrl(filePath);
        proofUrl = pubData?.publicUrl || null;
      }

      const res = await recordTransfer({
        requestId: requestToRecordTransfer.id,
        paymentMethod: paymentMethodInput,
        amountTransferred: parseFloat(amountTransferredInput),
        transferDate: transferDateInput,
        referenceNumber: paymentMethodInput === 'cash' ? (referenceNumberInput || 'CASH') : referenceNumberInput,
        companyNotes: recordTransferNotesInput,
        proofUrl
      });

      if (!res.success) throw new Error(res.error || 'Failed to record offline transfer.');

      setIsRecordTransferModalOpen(false);
      setRequestToRecordTransfer(null);
      if (showToast) showToast('Offline transfer recorded successfully!', 'success');
      await fetchData();
    } catch (err) {
      console.error(err);
      setRecordTransferError(err.message || 'An error occurred.');
    } finally {
      setIsSubmittingRecordTransfer(false);
    }
  };

  const handleApproveAdvance = async (requestId) => {
    if (!confirm('Are you sure you want to approve this request?')) return;
    try {
      const res = await approveAdvance({ requestId });
      if (!res.success) throw new Error(res.error || 'Failed to approve request');
      if (showToast) showToast('Advance request approved successfully!', 'success');
      await fetchData();
    } catch (err) {
      console.error(err);
      if (showToast) showToast(err.message || 'An error occurred', 'error');
    }
  };

  const handleRejectAdvance = async (requestId) => {
    const notes = prompt('Please enter optional rejection notes:');
    if (notes === null) return; // User cancelled prompt
    
    try {
      const res = await rejectAdvance({ requestId, companyNotes: notes });
      if (!res.success) throw new Error(res.error || 'Failed to reject request');
      if (showToast) showToast('Advance request rejected.', 'success');
      await fetchData();
    } catch (err) {
      console.error(err);
      if (showToast) showToast(err.message || 'An error occurred', 'error');
    }
  };



  const renderAdvancePaymentSectionForCompany = (app) => {
    if (!job || !job.advance_payment_enabled) return null;
    const reqs = app.advance_requests || [];
    if (reqs.length === 0) return null;

    const ledger = getAdvanceEligibility(job, reqs);
    const currency = job.salary_range ? job.salary_range.split(' ')[0] : 'USD';

    return (
      <div className="mt-5 pt-4 border-t border-slate-200/70 text-left font-sans animate-fade-in" onClick={(e) => e.stopPropagation()}>
        <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1.5 mb-2.5">
          <Coins size={14} className="text-blue-900" />
          Advance Payment Requests
        </h4>
        <div className="space-y-3">
          {reqs.map((req) => {
            let statusBg = "bg-gray-50 text-gray-600 border-gray-200";
            let displayStatus = req.status.replace('_', ' ');
            if (req.status === 'pending') statusBg = "bg-amber-50 text-amber-700 border-amber-200";
            else if (req.status === 'countered') statusBg = "bg-blue-50 text-blue-700 border-blue-200";
            else if (req.status === 'approved') statusBg = "bg-green-50 text-green-700 border-green-200";
            else if (req.status === 'transfer_recorded') statusBg = "bg-purple-50 text-purple-700 border-purple-200";
            else if (req.status === 'confirmed') statusBg = "bg-emerald-50 text-emerald-700 border-emerald-200";
            else if (req.status === 'rejected') statusBg = "bg-rose-50 text-rose-700 border-rose-200";
            else if (req.status === 'disputed') statusBg = "bg-red-50 text-red-800 border-red-200";
            else if (req.status === 'review_closed') statusBg = "bg-slate-50 text-slate-700 border-slate-250";

            const displayAmount = Number(req.counter_amount !== null ? req.counter_amount : req.requested_amount).toFixed(2);

            return (
              <div key={req.id} className="min-w-0 p-3 border border-slate-100 rounded-xl bg-slate-50/50 space-y-2">
                <div className="flex min-w-0 flex-col items-start gap-2 min-[375px]:flex-row min-[375px]:justify-between">
                  <div className="min-w-0">
                    <span className="block break-words font-bold text-gray-800 text-sm">${displayAmount} {req.currency}</span>
                    {req.status === 'countered' && (
                      <span className="text-xs font-semibold text-blue-600 ml-1.5">(Counter Offer)</span>
                    )}
                    <span className="text-xs text-gray-400 block mt-0.5">
                      Requested: {new Date(req.created_at).toLocaleDateString()}
                      {req.expires_at && ` | Expires: ${new Date(req.expires_at).toLocaleDateString()}`}
                    </span>
                  </div>
                  <span className={`max-w-full self-start break-words text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 border rounded-full ${statusBg}`}>
                    {displayStatus}
                  </span>
                </div>

                {/* Justification Notes */}
                {req.applicant_notes && (
                  <div className="min-w-0 whitespace-pre-wrap break-words text-xs text-gray-600 bg-white p-2 rounded border border-slate-100">
                    <span className="font-semibold text-gray-700">Justification: </span>
                    {req.applicant_notes}
                  </div>
                )}

                {/* Counter Notes */}
                {req.company_notes && (
                  <div className="min-w-0 whitespace-pre-wrap break-words text-xs text-gray-600 bg-blue-50/20 p-2 rounded border border-blue-100/50">
                    <span className="font-semibold text-blue-700">Company Notes: </span>
                    {req.company_notes}
                  </div>
                )}

                {/* Eligibility display */}
                {['pending', 'countered'].includes(req.status) && (
                  <div className="text-[11px] text-slate-500 bg-slate-100/50 p-1.5 rounded border border-slate-150 leading-tight">
                    Remaining Cap: <span className="font-bold">${ledger.remaining.toFixed(2)} {currency}</span> (of ${ledger.maxEligible.toFixed(2)})
                  </div>
                )}

                {/* Action Buttons */}
                {['pending', 'countered'].includes(req.status) && (
                  <div className="flex flex-col min-[375px]:flex-row min-[375px]:flex-wrap gap-2 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => handleApproveAdvance(req.id)}
                      className="w-full min-[375px]:w-auto px-3 py-1.5 bg-[#004173] hover:bg-blue-800 text-white font-semibold text-xs rounded-lg transition-colors shadow-sm cursor-pointer border-0"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRejectAdvance(req.id)}
                      className="w-full min-[375px]:w-auto px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 font-semibold text-xs rounded-lg transition-colors cursor-pointer"
                    >
                      Reject
                    </button>

                  </div>
                )}
                {req.status === 'approved' && (
                  <div className="flex flex-col min-[375px]:flex-row min-[375px]:flex-wrap gap-2 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => handleOpenRecordTransferModal(req)}
                      className="w-full min-[375px]:w-auto px-3 py-1.5 bg-[#004173] hover:bg-[#003153] text-white font-semibold text-xs rounded-lg transition-colors shadow-sm cursor-pointer border-0"
                    >
                      Record Offline Transfer
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {renderAdvancePaymentLedgerAndTimeline(job, reqs)}
      </div>
    );
  };

  const renderAdvancePaymentLedgerAndTimeline = (job, requests = []) => {
    const ledger = calculateAdvanceLedger(job, requests);
    const currency = job?.salary_range ? job.salary_range.split(' ')[0] : 'USD';
    const comp = formatCompensation(job);

    // Active requests (for checking status/timeline)
    const nonIgnoredRequests = requests.filter(r => !['rejected', 'cancelled', 'expired'].includes(r.status));
    const activeRequest = nonIgnoredRequests[0] || null; // Render details/timeline for the latest active request

    // Build the audit timeline events from the active request audit logs
    let timelineEvents = [];
    if (activeRequest && Array.isArray(activeRequest.job_advance_audit_logs)) {
      timelineEvents = [...activeRequest.job_advance_audit_logs].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
    }

    return (
      <div className="mt-4 min-w-0 border border-slate-150 rounded-xl bg-white p-3 min-[375px]:p-4 space-y-4 font-sans text-xs">
        {/* Contract Summary & Advance Summary (Ledger) */}
        <div>
          <h4 className="text-[11px] font-bold text-[#0e2a4d] uppercase tracking-wider mb-3">Advance Payment Ledger</h4>
          <div className="grid grid-cols-1 min-[375px]:grid-cols-2 sm:grid-cols-4 gap-2.5 min-[375px]:gap-3">
            <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
              <span className="text-gray-400 font-bold block text-[9px] uppercase">Contract Value</span>
              <span className="break-words text-xs font-extrabold text-[#0e2a4d]">${ledger.contractValue.toFixed(2)} {currency}</span>
              <span className="block text-[9px] text-gray-500 truncate mt-0.5" title={comp.displayRate}>{comp.displayRate}</span>
            </div>
            <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
              <span className="text-gray-400 font-bold block text-[9px] uppercase">Max Eligible Limit</span>
              <span className="break-words text-xs font-extrabold text-[#0e2a4d]">${ledger.maxEligible.toFixed(2)} {currency}</span>
            </div>
            <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
              <span className="text-gray-400 font-bold block text-[9px] uppercase">Total Requested</span>
              <span className="break-words text-xs font-bold text-gray-800">${ledger.totalRequested.toFixed(2)} {currency}</span>
            </div>
            <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
              <span className="text-gray-400 font-bold block text-[9px] uppercase">Total Approved</span>
              <span className="break-words text-xs font-bold text-green-700">${ledger.totalApproved.toFixed(2)} {currency}</span>
            </div>
            <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
              <span className="text-gray-400 font-bold block text-[9px] uppercase">Total Transferred</span>
              <span className="break-words text-xs font-bold text-purple-700">${ledger.totalTransferred.toFixed(2)} {currency}</span>
            </div>
            <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
              <span className="text-gray-400 font-bold block text-[9px] uppercase">Total Confirmed</span>
              <span className="break-words text-xs font-bold text-emerald-700">${ledger.totalConfirmed.toFixed(2)} {currency}</span>
            </div>
            <div className="bg-blue-50/50 p-2.5 rounded-lg border border-blue-100/50 min-[375px]:col-span-2 sm:col-span-1">
              <span className="text-[#0e2a4d]/70 font-extrabold block text-[9px] uppercase">Remaining Eligible Cap</span>
              <span className="break-words text-xs font-extrabold text-blue-900">${ledger.remainingEligibility.toFixed(2)} {currency}</span>
            </div>
            <div className="bg-amber-50/50 p-2.5 rounded-lg border border-amber-100/50 min-[375px]:col-span-2 sm:col-span-1">
              <span className="text-amber-800/70 font-extrabold block text-[9px] uppercase">Remaining Payout Salary</span>
              <span className="break-words text-xs font-extrabold text-amber-900">${ledger.remainingSalary.toFixed(2)} {currency}</span>
            </div>
          </div>
        </div>

        {/* Timeline Summary */}
        {activeRequest && (
          <div className="pt-3 border-t border-slate-100">
            <div className="flex min-w-0 flex-col items-start gap-2 min-[375px]:flex-row min-[375px]:items-center min-[375px]:justify-between mb-3">
              <h4 className="text-[11px] font-bold text-[#0e2a4d] uppercase tracking-wider">Workflow Progress Timeline</h4>
              <span className="max-w-full self-start break-words text-[9px] bg-slate-100 text-[#0e2a4d] font-bold px-2 py-0.5 rounded-full uppercase border border-slate-200">
                Status: {activeRequest.status.replace(/_/g, ' ')}
              </span>
            </div>

            {timelineEvents.length > 0 ? (
              <div className="relative pl-4 border-l border-slate-200 space-y-4">
                {timelineEvents.map((evt, idx) => {
                  const dateStr = new Date(evt.created_at).toLocaleString();
                  const displayAction = evt.action.replace(/_/g, ' ');
                  const actorRole = evt.actor_id === activeRequest.applicant_id ? 'Applicant' : 'Company';
                  const note = evt.payload?.company_notes || evt.payload?.admin_notes || evt.payload?.dispute_reason || evt.payload?.counter_notes || evt.payload?.applicant_notes || '';

                  return (
                    <div key={evt.id || idx} className="relative text-left">
                      {/* Timeline Dot */}
                      <div className="absolute -left-[21.5px] top-1 w-2.5 h-2.5 bg-[#004173] rounded-full border border-white" />
                      <div>
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                          <span className="font-bold text-gray-800 capitalize text-[11px]">{displayAction} ({actorRole})</span>
                          <span className="text-[9px] text-gray-400 font-mono">{dateStr}</span>
                        </div>
                        {note && (
                          <p className="mt-1 whitespace-pre-wrap break-words text-gray-500 italic bg-slate-50 px-2.5 py-1 rounded border border-slate-100 leading-snug">
                            {note}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-2 text-gray-400 italic">
                No timeline records.
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const getJobOrder = (app) => {
    if (!app) return null;
    if (Array.isArray(app.job_orders)) return app.job_orders[0] || null;
    return app.job_orders || null;
  };

  const handleOpenConfirmWorkModal = (app) => {
    setAppToConfirmWork(app);
    setConfirmWorkNote('');
    setIsConfirmWorkModalOpen(true);
  };

  const handleConfirmWorkCompletedSubmit = async () => {
    if (!appToConfirmWork) return;
    const order = getJobOrder(appToConfirmWork);
    if (!order || !order.id) {
      if (showToast) showToast('Active job order could not be found for this applicant.', 'error');
      return;
    }

    setIsConfirmingWork(true);
    try {
      const res = await confirmWorkCompletedByCompany(order.id, confirmWorkNote);
      if (!res.success) throw new Error(res.error || 'Failed to confirm work completion.');

      setApplicants((prev) =>
        prev.map((app) => (app.id === appToConfirmWork.id ? { 
          ...app,
          job_orders: Array.isArray(app.job_orders)
            ? app.job_orders.map(o => o.id === order.id ? { ...o, status: 'Completion Confirmed by Company' } : o)
            : app.job_orders
              ? { ...app.job_orders, status: 'Completion Confirmed by Company' }
              : null
        } : app))
      );

      setIsConfirmWorkModalOpen(false);
      setAppToConfirmWork(null);
      if (showToast) showToast('Work completion confirmed!', 'success');
    } catch (err) {
      console.error('Error confirming work completion:', err);
      if (showToast) showToast('Failed to confirm completion: ' + (err.message || err), 'error');
    } finally {
      setIsConfirmingWork(false);
    }
  };

  const fetchData = useCallback(async () => {
    if (!userId || !id) return;

    setIsLoading(true);
    setError(null);

    try {
      const supabase = createClient();

      // ── 1. Fetch the job row ──────────────────────────────────────────────
      const { data: jobData, error: jobError } = await supabase
        .from('jobs_search_view')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (jobError) throw jobError;

      if (!jobData) {
        setError('This job posting could not be found.');
        return;
      }

      const filled = jobData.filled_positions || 0;
      const total = jobData.number_of_positions || 1;
      jobData.available_positions = Math.max(0, total - filled);
      jobData.is_position_filled = filled >= total;

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

      // ── 4. Fetch advance requests for this job ───────────────────────────
      const { data: advanceRequests, error: advError } = await supabase
        .from('job_advance_requests')
        .select('*, job_advance_audit_logs(*)')
        .eq('job_id', id)
        .order('created_at', { ascending: false });

      const fetchedAdvanceReqs = (!advError && advanceRequests) ? advanceRequests : [];

      // ── 5. Step Two: Fetch public profiles ───────────────────────────────
      const applicantIds = apps.map((app) => app.applicant_id);
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .in('id', applicantIds);

      if (profilesError) throw profilesError;

      // ── 6. Step Three: Merge data ─────────────────────────────────────────
      const merged = apps.map((app) => {
        const profile = profilesData?.find((p) => p.id === app.applicant_id) || {};
        
        // Derive correct status from job_orders if a completed order exists
        const order = getJobOrder(app);
        const effectiveStatus = (order && order.status === 'Completed') ? 'Completed' : app.status;

        const appAdvanceRequests = fetchedAdvanceReqs.filter(r => r.application_id === app.id);

        return { ...app, status: effectiveStatus, profile, advance_requests: appAdvanceRequests };
      });

      // ── 7. Fetch platform settings for offer expiry ────────────────────────
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
      if (merged.length > 0) {
        setSelectedApplicant(prev => {
          if (prev) {
            const updated = merged.find(a => a.id === prev.id);
            return updated || merged[0];
          }
          return merged[0];
        });
      }
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
        showToast(`Application status updated to "${newStatus === 'Rejected' ? 'Job Unsuccessful' : newStatus}"`, 'success');
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
    const order = getJobOrder(appToCancel);
    if (!order || !order.id) {
      if (showToast) showToast('Active job order could not be found for this applicant.', 'error');
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

    const order = getJobOrder(appToComplete);
    if (!order || !order.id) {
      if (showToast) showToast('Active job order could not be found for this applicant.', 'error');
      return;
    }

    setIsCompleting(true);
    try {
      let res;
      if (order.status === 'Payment Confirmed by Applicant') {
        res = await closeCompletedEngagementByCompany({
          jobOrderId: order.id,
          feedbackData: {
            sentiment: feedbackSentiment,
            tags: feedbackTags,
            comment: feedbackComment
          }
        });
      } else {
        // Fallback for legacy Active -> Completed
        res = await markJobOrderCompleted({
          jobOrderId: order.id,
          feedbackData: {
            sentiment: feedbackSentiment,
            tags: feedbackTags,
            comment: feedbackComment,
            submittedByUserId: userId
          }
        });
      }

      if (!res.success) throw new Error(res.error || 'Failed to close engagement.');

      setApplicants((prev) =>
        prev.map((app) => (app.id === appToComplete.id ? { 
          ...app, 
          status: 'Completed',
          job_orders: Array.isArray(app.job_orders)
            ? app.job_orders.map(o => o.id === order.id ? { ...o, status: 'Completed' } : o)
            : app.job_orders
              ? { ...app.job_orders, status: 'Completed' }
              : null
        } : app))
      );

      setIsMarkCompleteModalOpen(false);
      setAppToComplete(null);
      if (showToast) showToast('Engagement closed and completed!', 'success');
    } catch (err) {
      console.error('Error marking completion:', err);
      if (showToast) showToast('Failed to close engagement: ' + (err.message || err), 'error');
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
                  <span className={`inline-flex items-center px-3 py-1.5 lg:px-2.5 lg:py-1 rounded-full text-[11px] lg:text-[10px] font-bold uppercase tracking-wide ${
                    job?.is_position_filled 
                      ? 'bg-amber-100 text-amber-800 border border-amber-200' 
                      : 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                  }`}>
                    Positions: {job?.filled_positions || 0} / {job?.number_of_positions || 1} Filled
                  </span>
                  <span className="inline-flex items-center px-3 py-1.5 lg:px-2.5 lg:py-1 rounded-full text-[11px] lg:text-[10px] font-bold bg-slate-100 text-slate-700 tracking-wide uppercase">
                    {job?.available_positions ?? Math.max(0, (job?.number_of_positions || 1) - (job?.filled_positions || 0))} Available
                  </span>
                  {job?.is_position_filled && (
                    <span className="inline-flex items-center px-3 py-1.5 lg:px-2.5 lg:py-1 rounded-full text-[11px] lg:text-[10px] font-extrabold bg-amber-500 text-white tracking-wide uppercase">
                      Position Filled
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
              const activeAdvance = app.advance_requests?.find(r => ['pending', 'countered', 'approved', 'transfer_recorded', 'disputed'].includes(r.status));
              
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
                          {activeAdvance && (
                            <>
                              <span className="text-slate-300">•</span>
                              <span className="inline-flex items-center gap-1 text-blue-700 font-bold bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100/50 normal-case">
                                <Coins size={10} /> Advance {activeAdvance.status.replace('_', ' ')}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {/* Status Bookmark */}
                    <div className="absolute top-0 right-0" onClick={(e) => e.stopPropagation()}>
                      {['Withdrawn', 'Accepted', 'Offered', 'Expired', 'Candidate Cancelled', 'Company Cancelled', 'Completed'].includes(app.status) ? (() => {
                        let displayStatus = app.status;
                        let colorClass = 'bg-slate-100 text-slate-500 border-slate-200';
                        
                        if (app.status === 'Accepted') {
                          const order = getJobOrder(app);
                          
                          if (order && order.status !== 'Active') {
                            displayStatus = order.status;
                            colorClass = 'bg-blue-50 text-blue-700 border-blue-200';
                          } else {
                            displayStatus = 'Accepted';
                            colorClass = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                          }
                        } else if (app.status === 'Candidate Cancelled' || app.status === 'Company Cancelled') {
                          colorClass = 'bg-red-50 text-red-700 border-red-200';
                        } else if (app.status === 'Completed') {
                          colorClass = 'bg-emerald-100 text-emerald-800 border-emerald-300';
                        } else if (app.status === 'Offered') {
                          colorClass = 'bg-blue-50 text-blue-700 border-blue-200';
                        } else if (app.status === 'Expired') {
                          colorClass = 'bg-rose-50 text-rose-700 border-rose-200';
                        }
                        
                        return (
                          <span className={`inline-flex items-center px-3 py-1.5 rounded-bl-xl text-[10px] font-bold uppercase tracking-widest shadow-sm border-b border-l ${colorClass}`}>
                            {displayStatus}
                          </span>
                        );
                      })() : (
                        <div className={`relative inline-flex items-center rounded-bl-xl border-b border-l shadow-sm overflow-hidden min-w-[135px] max-w-[165px] justify-between cursor-pointer ${getStatusStyles(app.status || 'Pending')}`}>
                          <select 
                            value={app.status || 'Pending'} 
                            onChange={(e) => handleStatusChange(app.id, e.target.value)} 
                            className="absolute inset-0 opacity-0 cursor-pointer z-10 w-full h-full"
                          >
                            <option value="Pending">Pending</option>
                            <option value="Under Review">Under Review</option>
                            <option value="Shortlisted">Shortlisted</option>
                            <option value="Rejected">Job Unsuccessful</option>
                          </select>
                          <div className="flex items-center justify-between w-full pl-3 pr-2 py-1.5 pointer-events-none">
                            <span className="text-[10px] font-bold uppercase tracking-widest truncate mr-1.5">
                              {app.status === 'Rejected' ? 'Job Unsuccessful' : (app.status || 'Pending')}
                            </span>
                            <ChevronDown 
                              className="w-3 h-3 opacity-80 shrink-0" 
                            />
                          </div>
                        </div>
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
                      const order = getJobOrder(app);
                      if (!order) return null;

                      switch (order.status) {
                        case 'Active':
                          return (
                            <div className="mt-5 flex flex-col sm:flex-row flex-wrap gap-2.5 justify-end">
                              <button 
                                onClick={(e) => { e.stopPropagation(); router.push(`/profile/${app.applicant_id}`); }}
                                className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-semibold rounded-lg transition-colors shadow-sm flex-1 sm:flex-none text-center"
                              >
                                View Profile
                              </button>
                              <button 
                                onClick={(e) => { e.stopPropagation(); router.push(`/messages?application=${app.id}`); }}
                                className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-semibold rounded-lg transition-colors shadow-sm flex-1 sm:flex-none text-center"
                              >
                                Message
                              </button>
                              <button 
                                onClick={(e) => { e.stopPropagation(); setAppToCancel(app); setCompanyCancelReason(''); setCompanyCancelRemarks(''); setIsCompanyCancelModalOpen(true); }}
                                className="px-4 py-2 bg-white border border-red-200 hover:bg-red-50 text-red-600 text-sm font-semibold rounded-lg transition-colors shadow-sm w-full sm:w-auto text-center"
                              >
                                Cancel Engagement
                              </button>
                            </div>
                          );
                        case 'Work Completed by Applicant':
                          return (
                            <div className="mt-5 flex flex-col sm:flex-row flex-wrap gap-2.5 justify-end">
                              <button 
                                onClick={(e) => { e.stopPropagation(); router.push(`/profile/${app.applicant_id}`); }}
                                className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-semibold rounded-lg transition-colors shadow-sm flex-1 sm:flex-none text-center"
                              >
                                View Profile
                              </button>
                              <button 
                                onClick={(e) => { e.stopPropagation(); router.push(`/messages?application=${app.id}`); }}
                                className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-semibold rounded-lg transition-colors shadow-sm flex-1 sm:flex-none text-center"
                              >
                                Message
                              </button>
                              <button 
                                onClick={(e) => { e.stopPropagation(); handleOpenConfirmWorkModal(app); }}
                                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg transition-colors shadow-sm w-full sm:w-auto text-center"
                              >
                                Confirm Work Completed
                              </button>
                            </div>
                          );
                        case 'Completion Confirmed by Company':
                          return (
                            <div className="mt-5 flex flex-col sm:flex-row flex-wrap gap-2.5 justify-end items-center">
                              <span className="text-xs font-semibold text-slate-500 mr-auto w-full sm:w-auto text-center sm:text-left mb-2 sm:mb-0">
                                Waiting for applicant payment confirmation
                              </span>
                              <button 
                                onClick={(e) => { e.stopPropagation(); router.push(`/profile/${app.applicant_id}`); }}
                                className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-semibold rounded-lg transition-colors shadow-sm flex-1 sm:flex-none text-center"
                              >
                                View Profile
                              </button>
                              <button 
                                onClick={(e) => { e.stopPropagation(); router.push(`/messages?application=${app.id}`); }}
                                className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-semibold rounded-lg transition-colors shadow-sm flex-1 sm:flex-none text-center"
                              >
                                Message
                              </button>
                            </div>
                          );
                        case 'Payment Confirmed by Applicant':
                          return (
                            <div className="mt-5 flex flex-col sm:flex-row flex-wrap gap-2.5 justify-end">
                              <button 
                                onClick={(e) => { e.stopPropagation(); router.push(`/profile/${app.applicant_id}`); }}
                                className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-semibold rounded-lg transition-colors shadow-sm flex-1 sm:flex-none text-center"
                              >
                                View Profile
                              </button>
                              <button 
                                onClick={(e) => { e.stopPropagation(); router.push(`/messages?application=${app.id}`); }}
                                className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-semibold rounded-lg transition-colors shadow-sm flex-1 sm:flex-none text-center"
                              >
                                Message
                              </button>
                              <button 
                                onClick={(e) => { e.stopPropagation(); setAppToComplete(app); setFeedbackSentiment(''); setFeedbackComment(''); setFeedbackTags([]); setIsMarkCompleteModalOpen(true); }}
                                className="px-4 py-2 bg-[#004173] hover:bg-blue-800 text-white text-sm font-semibold rounded-lg transition-colors shadow-sm w-full sm:w-auto text-center"
                              >
                                Close Engagement
                              </button>
                            </div>
                          );
                        default:
                          return null;
                      }
                    })()}

                    {app.status === 'Completed' && (
                      <div className="mt-5 flex flex-col sm:flex-row flex-wrap gap-2.5 justify-end">
                        <button 
                          onClick={(e) => { e.stopPropagation(); router.push(`/profile/${app.applicant_id}`); }}
                          className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-semibold rounded-lg transition-colors shadow-sm flex-1 sm:flex-none text-center"
                        >
                          View Profile
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); router.push(`/messages?application=${app.id}`); }}
                          className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-semibold rounded-lg transition-colors shadow-sm flex-1 sm:flex-none text-center"
                        >
                          Message
                        </button>
                      </div>
                    )}

                    {app.status === 'Shortlisted' && (
                      <div className="mt-5 flex flex-col sm:flex-row justify-end">
                        {job?.is_position_filled ? (
                          <button 
                            disabled
                            className="px-4 py-2 bg-slate-100 border border-slate-200 text-slate-400 text-sm font-semibold rounded-lg cursor-not-allowed w-full sm:w-auto text-center"
                          >
                            Send Job Offer (Positions Filled)
                          </button>
                        ) : (
                          <button 
                            onClick={(e) => { e.stopPropagation(); setAppToOffer(app); setIsOfferModalOpen(true); }}
                            className="px-4 py-2 bg-[#004173] hover:bg-blue-800 text-white text-sm font-semibold rounded-lg transition-colors shadow-sm w-full sm:w-auto text-center"
                          >
                            Send Job Offer
                          </button>
                        )}
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

                    {/* Advance Payment requests */}
                    {renderAdvancePaymentSectionForCompany(selectedApplicant)}

                    {/* Engagement Timeline */}
                    <div className="pl-[10px] mt-6 pt-6 border-t border-slate-100">
                      <h4 className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-2.5">Engagement Timeline</h4>
                      <EngagementTimeline jobOrder={getJobOrder(selectedApplicant)} application={selectedApplicant} />
                    </div>

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
                    <div className="text-right flex flex-col items-end">
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Application Status</p>
                      {['Withdrawn', 'Accepted', 'Offered', 'Expired', 'Candidate Cancelled', 'Company Cancelled', 'Completed'].includes(selectedApplicant.status) ? (
                        <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-bold uppercase tracking-wide ${
                          selectedApplicant.status === 'Accepted' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                          selectedApplicant.status === 'Completed' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' :
                          selectedApplicant.status === 'Offered' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                          selectedApplicant.status === 'Expired' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                          selectedApplicant.status === 'Candidate Cancelled' || selectedApplicant.status === 'Company Cancelled' ? 'bg-red-50 text-red-700 border border-red-200' :
                          'bg-slate-100 text-slate-500 border border-slate-200'
                        }`}>
                          {selectedApplicant.status}
                        </span>
                      ) : (
                        <div className={`relative inline-flex items-center rounded-lg border shadow-2xs overflow-hidden min-w-[145px] max-w-[185px] justify-between cursor-pointer transition-all hover:bg-opacity-95 ${getStatusStyles(selectedApplicant.status || 'Pending')}`}>
                          <select 
                            value={selectedApplicant.status || 'Pending'} 
                            onChange={(e) => handleStatusChange(selectedApplicant.id, e.target.value)} 
                            className="absolute inset-0 opacity-0 cursor-pointer z-10 w-full h-full"
                          >
                            <option value="Pending">Pending</option>
                            <option value="Under Review">Under Review</option>
                            <option value="Shortlisted">Shortlisted</option>
                            <option value="Rejected">Job Unsuccessful</option>
                          </select>
                          <div className="flex items-center justify-between w-full pl-3 pr-2 py-1.5 pointer-events-none">
                            <span className="text-xs font-bold uppercase tracking-wider truncate mr-1.5">
                              {selectedApplicant.status === 'Rejected' ? 'Job Unsuccessful' : (selectedApplicant.status || 'Pending')}
                            </span>
                            <ChevronDown 
                              className="w-3.5 h-3.5 opacity-80 shrink-0" 
                            />
                          </div>
                        </div>
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

                  {/* Advance Payment requests */}
                  {renderAdvancePaymentSectionForCompany(selectedApplicant)}

                  {/* Engagement Timeline */}
                  <div className="mb-6 pt-6 border-t border-slate-100">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">Engagement Timeline</h4>
                    <EngagementTimeline jobOrder={getJobOrder(selectedApplicant)} application={selectedApplicant} />
                  </div>
                  
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
            <h3 className="text-lg font-bold text-blue-900 mb-2">
              {(() => {
                const order = getJobOrder(appToComplete);
                return (order && order.status === 'Payment Confirmed by Applicant') ? 'Close Completed Engagement' : 'Mark Engagement Completed';
              })()}
            </h3>
            <p className="text-sm text-gray-600 mb-6">
              {(() => {
                const order = getJobOrder(appToComplete);
                const name = appToComplete.profile?.name || 'this applicant';
                return (order && order.status === 'Payment Confirmed by Applicant')
                  ? `You are about to close this engagement with ${name} as completed. Please provide feedback on their performance.`
                  : `You are about to mark this engagement with ${name} as completed. Please provide feedback on their performance.`;
              })()}
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
                {isCompleting ? 'Completing...' : (() => {
                  const order = getJobOrder(appToComplete);
                  return (order && order.status === 'Payment Confirmed by Applicant') ? 'Submit & Close Engagement' : 'Submit & Complete';
                })()}
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
      {/* Confirm Work Completed Modal */}
      {isConfirmWorkModalOpen && appToConfirmWork && (
        <div className="fixed inset-0 bg-slate-900/40 z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl">
            <h3 className="text-lg font-bold text-blue-900 mb-2">Confirm Work Completed</h3>
            <p className="text-sm text-gray-600 mb-4">
              Confirm that the applicant <span className="font-semibold text-gray-800">{appToConfirmWork.profile?.name || 'this applicant'}</span> has successfully completed the work. You can add an optional note for the candidate.
            </p>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Confirmation Note (Optional)</label>
                <textarea 
                  className="w-full border border-gray-200 rounded-lg p-2.5 text-sm outline-none focus:border-blue-500 min-h-[80px]"
                  placeholder="Feedback on work completion or additional remarks..."
                  value={confirmWorkNote}
                  onChange={(e) => setConfirmWorkNote(e.target.value)}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button 
                onClick={() => { setIsConfirmWorkModalOpen(false); setAppToConfirmWork(null); }}
                className="px-5 py-2 text-sm font-bold text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
                disabled={isConfirmingWork}
              >
                Cancel
              </button>
              <button 
                onClick={handleConfirmWorkCompletedSubmit}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-xl text-sm font-bold transition-colors shadow-sm disabled:opacity-50"
                disabled={isConfirmingWork}
              >
                {isConfirmingWork ? 'Confirming...' : 'Confirm Work Completed'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Record Offline Transfer Modal */}
      {isRecordTransferModalOpen && requestToRecordTransfer && (() => {
        const currency = job?.salary_range ? job.salary_range.split(' ')[0] : 'USD';
        
        return (
          <div className="fixed inset-0 bg-slate-900/40 z-[9999] flex items-end min-[375px]:items-center justify-center p-2 min-[375px]:p-4">
            <div className="max-h-[calc(100dvh-1rem)] overflow-y-auto overscroll-contain bg-white rounded-2xl p-4 min-[375px]:p-6 max-w-md w-full shadow-xl text-left font-sans">
              <h3 className="text-lg font-bold text-blue-900 mb-2">Record Offline Transfer</h3>
              <p className="text-sm text-gray-600 mb-4">
                Record the details of the offline transaction sent directly to the applicant.
              </p>

              <div className="mb-6">
                <div className="mb-4">
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Approved Amount ({currency})</label>
                  <input 
                    type="text"
                    value={`$${Number(amountTransferredInput).toFixed(2)}`}
                    readOnly
                    disabled
                    className="w-full border border-gray-250 bg-gray-50 rounded-lg p-2.5 text-sm text-gray-500 font-bold select-none cursor-not-allowed"
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2 font-sans">Payment Method *</label>
                  <select 
                    value={paymentMethodInput}
                    onChange={(e) => setPaymentMethodInput(e.target.value)}
                    className="w-full border border-gray-250 rounded-lg p-2.5 text-sm text-gray-700 outline-none focus:ring-2 focus:ring-blue-900 bg-white cursor-pointer"
                  >
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="wise">Wise</option>
                    <option value="paypal">PayPal</option>
                    <option value="gcash">GCash</option>
                    <option value="paynow">PayNow</option>
                    <option value="cash">Cash</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div className="mb-4">
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Transfer Date *</label>
                  <input 
                    type="date"
                    value={transferDateInput}
                    onChange={(e) => setTransferDateInput(e.target.value)}
                    className="w-full border border-gray-250 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-900 bg-white"
                    required
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                    Reference Number {paymentMethodInput !== 'cash' && '*'}
                  </label>
                  <input 
                    type="text"
                    value={referenceNumberInput}
                    onChange={(e) => setReferenceNumberInput(e.target.value)}
                    placeholder={paymentMethodInput === 'cash' ? 'Optional (e.g. Cash Receipt ID)' : 'e.g. Transaction hash or bank reference'}
                    className="w-full border border-gray-250 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-900 bg-white"
                    required={paymentMethodInput !== 'cash'}
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Company Notes / Offline Terms</label>
                  <textarea 
                    value={recordTransferNotesInput}
                    onChange={(e) => setRecordTransferNotesInput(e.target.value)}
                    placeholder="Provide any details about the payment instructions, timing, etc..."
                    className="w-full border border-gray-250 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-900 min-h-[70px] bg-white"
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Proof of Payment (Optional, PDF, JPG, PNG)</label>
                  <input 
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg"
                    onChange={(e) => setProofFileInput(e.target.files?.[0] || null)}
                    className="block w-full min-w-0 text-xs text-slate-500 file:mr-2 min-[375px]:file:mr-4 file:py-2 file:px-3 min-[375px]:file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-[#004173] hover:file:bg-blue-100 cursor-pointer"
                  />
                </div>
              </div>

              {recordTransferError && (
                <div className="p-3 bg-rose-50 border border-rose-250 rounded-lg text-xs text-rose-700 font-semibold mb-4">
                  {recordTransferError}
                </div>
              )}

              <div className="flex flex-col-reverse min-[375px]:flex-row min-[375px]:justify-end gap-2 min-[375px]:gap-3 pt-3 border-t border-slate-100">
                <button 
                  onClick={() => { setIsRecordTransferModalOpen(false); setRequestToRecordTransfer(null); }}
                  className="w-full min-[375px]:w-auto px-5 py-2 text-sm font-bold text-gray-600 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer bg-transparent border-0"
                  disabled={isSubmittingRecordTransfer}
                >
                  Cancel
                </button>
                <button 
                  onClick={handleSubmitRecordTransfer}
                  className="w-full min-[375px]:w-auto bg-[#004173] hover:bg-blue-800 text-white px-5 py-2 rounded-xl text-sm font-bold transition-colors shadow-sm disabled:opacity-50 cursor-pointer border-0"
                  disabled={isSubmittingRecordTransfer || (paymentMethodInput !== 'cash' && !referenceNumberInput.trim())}
                >
                  {isSubmittingRecordTransfer ? 'Recording...' : 'Record Transfer'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
      {/* Shared calculation helper to display ledger details and audit timeline */}
      {(() => {
        // Embed the helper directly inside the component scope so it has access to states if needed
      })()}
    </div>
  );
}
