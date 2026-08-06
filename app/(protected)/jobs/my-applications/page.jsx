'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useProfile } from '@/app/context/ProfileContext';
import { createClient } from '@/lib/supabase';
import { Briefcase, MapPin, Calendar, Building2, Loader2, ExternalLink, Building, AlertTriangle, Coins } from 'lucide-react';
import { getCandidateAcceptanceFeePreview, getUserWalletBalance, deductCandidateAcceptanceFee } from '@/app/actions/mcreditsJobs';
import { createJobOrderFromAcceptedApplication, cancelJobOrderByCandidate } from '@/app/actions/jobOrders';
import { markWorkCompletedByApplicant, confirmPaymentReceivedByApplicant } from '@/app/actions/engagementLifecycle';
import { requestAdvancePayment, cancelAdvanceRequest, acceptCounterOffer, declineCounterOffer, confirmReceipt, disputeReceipt } from '@/app/actions/advances';
import { calculateAdvanceLedger } from '@/lib/advancesLedger';
import { formatCompensation } from '@/lib/compensation';
import BaseModal from '@/src/components/layout/BaseModal';
import ApplicationStatusTabs, { getApplicationCategory } from '@/src/components/jobs/ApplicationStatusTabs';
import EngagementTimeline from '@/src/components/engagement/EngagementTimeline';

const SkeletonRow = () => (
  <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm animate-pulse flex items-center justify-between gap-4">
    <div className="flex-1 space-y-2">
      <div className="h-5 bg-gray-200 rounded w-1/3"></div>
      <div className="h-4 bg-gray-200 rounded w-1/4"></div>
      <div className="h-3 bg-gray-100 rounded w-1/5"></div>
    </div>
    <div className="w-24 h-6 bg-gray-200 rounded-full"></div>
    <div className="w-24 h-9 bg-gray-250 rounded-lg"></div>
  </div>
);

const isThresholdSatisfied = (currentStatus, threshold) => {
  const status = (currentStatus || '').toLowerCase();
  const th = (threshold || 'shortlisted').toLowerCase();
  if (th === 'shortlisted') {
    return ['shortlisted', 'offered', 'accepted'].includes(status);
  }
  if (th === 'offered') {
    return ['offered', 'accepted'].includes(status);
  }
  if (th === 'accepted') {
    return ['accepted'].includes(status);
  }
  return false;
};

const getAdvanceEligibility = (job, requests = []) => {
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
  let hasActiveOrConfirmed = false;

  for (const r of requests) {
    const isExpiredOrCancelled = ['rejected', 'cancelled', 'expired', 'review_closed'].includes(r.status);
    if (r.status === 'confirmed') {
      totalConfirmed += Number(r.approved_amount || r.requested_amount || 0);
      hasActiveOrConfirmed = true;
    } else if (!isExpiredOrCancelled) {
      totalActive += Number(r.counter_amount !== null ? r.counter_amount : r.requested_amount);
      hasActiveOrConfirmed = true;
    }
  }

  const remaining = Math.max(0, maxEligible - totalConfirmed - totalActive);
  return {
    maxEligible,
    totalConfirmed,
    totalActive,
    remaining,
    hasActiveOrConfirmed
  };
};

export default function MyApplicationsPage() {
  const { userId, currentIdentity } = useProfile();
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selectedStatus, setSelectedStatus] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');

  const [isAcceptModalOpen, setIsAcceptModalOpen] = useState(false);
  const [appToAccept, setAppToAccept] = useState(null);
  const [feePreview, setFeePreview] = useState(null);
  const [walletBalance, setWalletBalance] = useState(null);
  const [acceptingError, setAcceptingError] = useState('');
  const [isAccepting, setIsAccepting] = useState(false);

  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [appToCancel, setAppToCancel] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelRemarks, setCancelRemarks] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);

  const [isWorkCompletedModalOpen, setIsWorkCompletedModalOpen] = useState(false);
  const [isConfirmPaymentModalOpen, setIsConfirmPaymentModalOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [workCompletedNote, setWorkCompletedNote] = useState('');
  const [paymentConfirmationNote, setPaymentConfirmationNote] = useState('');
  const [submittingLifecycle, setSubmittingLifecycle] = useState(false);

  // Advance Payment states
  const [isAdvanceModalOpen, setIsAdvanceModalOpen] = useState(false);
  const [selectedAppForAdvance, setSelectedAppForAdvance] = useState(null);
  const [advanceAmountInput, setAdvanceAmountInput] = useState('');
  const [advanceNotesInput, setAdvanceNotesInput] = useState('');
  const [isSubmittingAdvance, setIsSubmittingAdvance] = useState(false);
  const [advanceRequestError, setAdvanceRequestError] = useState('');

  // Dispute states
  const [isDisputeModalOpen, setIsDisputeModalOpen] = useState(false);
  const [requestToDispute, setRequestToDispute] = useState(null);
  const [disputeReasonInput, setDisputeReasonInput] = useState('');
  const [isSubmittingDispute, setIsSubmittingDispute] = useState(false);
  const [disputeError, setDisputeError] = useState('');

  const handleOpenAdvanceModal = (app) => {
    setSelectedAppForAdvance(app);
    setAdvanceAmountInput('');
    setAdvanceNotesInput('');
    setAdvanceRequestError('');
    setIsAdvanceModalOpen(true);
  };

  const handleSubmitAdvanceRequest = async () => {
    if (!selectedAppForAdvance) return;
    const amount = parseFloat(advanceAmountInput);
    if (isNaN(amount) || amount <= 0) {
      setAdvanceRequestError('Please enter a positive amount.');
      return;
    }
    
    setIsSubmittingAdvance(true);
    setAdvanceRequestError('');
    
    try {
      const res = await requestAdvancePayment({
        applicationId: selectedAppForAdvance.id,
        amount,
        applicantNotes: advanceNotesInput
      });
      if (!res.success) {
        throw new Error(res.error || 'Failed to submit advance request.');
      }
      setIsAdvanceModalOpen(false);
      setSelectedAppForAdvance(null);
      await fetchApplications();
      alert('Advance payment request submitted successfully!');
    } catch (err) {
      console.error(err);
      setAdvanceRequestError(err.message || 'An error occurred.');
    } finally {
      setIsSubmittingAdvance(false);
    }
  };

  const handleCancelAdvance = async (requestId) => {
    if (!confirm('Are you sure you want to cancel this request?')) return;
    try {
      const res = await cancelAdvanceRequest({ requestId });
      if (!res.success) {
        throw new Error(res.error || 'Failed to cancel request.');
      }
      await fetchApplications();
      alert('Request cancelled successfully.');
    } catch (err) {
      console.error(err);
      alert(err.message || 'An error occurred.');
    }
  };

  const handleAcceptCounter = async (requestId) => {
    if (!confirm('Are you sure you want to accept this counter offer?')) return;
    try {
      const res = await acceptCounterOffer({ requestId });
      if (!res.success) {
        throw new Error(res.error || 'Failed to accept counter offer.');
      }
      await fetchApplications();
      alert('Counter offer accepted successfully!');
    } catch (err) {
      console.error(err);
      alert(err.message || 'An error occurred.');
    }
  };

  const handleDeclineCounter = async (requestId) => {
    if (!confirm('Are you sure you want to decline this counter offer?')) return;
    try {
      const res = await declineCounterOffer({ requestId });
      if (!res.success) {
        throw new Error(res.error || 'Failed to decline counter offer.');
      }
      await fetchApplications();
      alert('Counter offer declined.');
    } catch (err) {
      console.error(err);
      alert(err.message || 'An error occurred.');
    }
  };

  const handleConfirmReceipt = async (requestId) => {
    if (!confirm('Are you sure you want to confirm receipt of the advance payment? This will finalize the request as CONFIRMED.')) return;
    try {
      const res = await confirmReceipt({ requestId });
      if (!res.success) {
        throw new Error(res.error || 'Failed to confirm receipt.');
      }
      await fetchApplications();
      alert('Advance payment receipt confirmed!');
    } catch (err) {
      console.error(err);
      alert(err.message || 'An error occurred.');
    }
  };

  const handleOpenDisputeModal = (req) => {
    setRequestToDispute(req);
    setDisputeReasonInput('');
    setDisputeError('');
    setIsDisputeModalOpen(true);
  };

  const handleSubmitDispute = async () => {
    if (!requestToDispute) return;
    if (!disputeReasonInput.trim()) {
      setDisputeError('Dispute reason is required.');
      return;
    }
    
    setIsSubmittingDispute(true);
    setDisputeError('');
    
    try {
      const res = await disputeReceipt({
        requestId: requestToDispute.id,
        disputeReason: disputeReasonInput
      });
      if (!res.success) {
        throw new Error(res.error || 'Failed to dispute request.');
      }
      setIsDisputeModalOpen(false);
      setRequestToDispute(null);
      await fetchApplications();
      alert('Issue reported. The platform administration has been notified.');
    } catch (err) {
      console.error(err);
      setDisputeError(err.message || 'An error occurred.');
    } finally {
      setIsSubmittingDispute(false);
    }
  };

  const handleOpenWorkCompletedModal = (orderId) => {
    setSelectedOrderId(orderId);
    setWorkCompletedNote('');
    setIsWorkCompletedModalOpen(true);
  };

  const handleOpenConfirmPaymentModal = (orderId) => {
    setSelectedOrderId(orderId);
    setPaymentConfirmationNote('');
    setIsConfirmPaymentModalOpen(true);
  };

  const handleConfirmWorkCompleted = async () => {
    if (!selectedOrderId) return;
    setSubmittingLifecycle(true);
    try {
      const res = await markWorkCompletedByApplicant(selectedOrderId, workCompletedNote);
      if (!res.success) {
        throw new Error(res.error || 'Failed to mark work completed');
      }
      setIsWorkCompletedModalOpen(false);
      setSelectedOrderId(null);
      await fetchApplications(); // Reload data
      alert('Work marked as completed successfully!');
    } catch (err) {
      console.error(err);
      alert(err.message || 'An error occurred.');
    } finally {
      setSubmittingLifecycle(false);
    }
  };

  const handleConfirmPaymentReceived = async () => {
    if (!selectedOrderId) return;
    setSubmittingLifecycle(true);
    try {
      const res = await confirmPaymentReceivedByApplicant(selectedOrderId, paymentConfirmationNote);
      if (!res.success) {
        throw new Error(res.error || 'Failed to confirm payment received');
      }
      setIsConfirmPaymentModalOpen(false);
      setSelectedOrderId(null);
      await fetchApplications(); // Reload data
      alert('Payment received confirmed!');
    } catch (err) {
      console.error(err);
      alert(err.message || 'An error occurred.');
    } finally {
      setSubmittingLifecycle(false);
    }
  };

  const fetchApplications = useCallback(async () => {
    if (!userId || currentIdentity?.type === 'company') {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const supabase = createClient();
      const { data: appsData, error } = await supabase
        .from('applications')
        .select('*, job:jobs(*, company:companies(*), poster:profiles(*))')
        .eq('applicant_id', userId)
        .order('applied_at', { ascending: false });

      if (error) throw error;
      
      let applications = appsData || [];
      
      if (applications.length > 0) {
        const appIds = applications.map(a => a.id);
        
        // 2. Fetch job_orders for application IDs
        const { data: jobOrders, error: ordersError } = await supabase
          .from('job_orders')
          .select('*')
          .in('application_id', appIds);
          
        let fetchedOrders = (!ordersError && jobOrders) ? jobOrders : [];
        let orderIds = fetchedOrders.map(o => o.id);
        
        // 3. Fetch job_advance_requests for application IDs
        const { data: advanceRequests, error: advanceError } = await supabase
          .from('job_advance_requests')
          .select('*, job_advance_audit_logs(*)')
          .in('application_id', appIds)
          .order('created_at', { ascending: false });

        const fetchedAdvanceReqs = (!advanceError && advanceRequests) ? advanceRequests : [];

        // 4. Fetch job_cancellations for job_order IDs
        let fetchedCancellations = [];
        if (orderIds.length > 0) {
          const { data: jobCancellations, error: cancelError } = await supabase
            .from('job_cancellations')
            .select('*')
            .in('job_order_id', orderIds);
          if (!cancelError && jobCancellations) {
            fetchedCancellations = jobCancellations;
          }
        }
        
        // 5. Manually attach the latest cancellation record and advance requests to each application object
        applications = applications.map(app => {
          // Find orders for this app
          const appOrders = fetchedOrders.filter(o => o.application_id === app.id);
          
          // Get the latest order (or only order)
          const latestOrder = appOrders.length > 0 ? appOrders[0] : null;
          
          // Find cancellations for this order
          let appCancellation = null;
          if (latestOrder) {
            const orderCancellations = fetchedCancellations.filter(c => c.job_order_id === latestOrder.id);
            // Get the latest cancellation
            if (orderCancellations.length > 0) {
              orderCancellations.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
              appCancellation = orderCancellations[0];
            }
          }

          // Filter advance requests for this app
          const appAdvanceRequests = fetchedAdvanceReqs.filter(r => r.application_id === app.id);
          
          return {
            ...app,
            job_orders: appOrders,
            job_cancellation: appCancellation,
            advance_requests: appAdvanceRequests
          };
        });
      }

      setApplications(applications);
    } catch (err) {
      console.error('Error fetching applications:', err.message || err);
    } finally {
      setLoading(false);
    }
  }, [userId, currentIdentity]);

  useEffect(() => {
    if (userId) {
      fetchApplications();
    }
  }, [userId, fetchApplications]);

  const handleOpenAcceptModal = async (app) => {
    setAppToAccept(app);
    setIsAcceptModalOpen(true);
    setFeePreview(null);
    setWalletBalance(null);
    setAcceptingError('');

    try {
      const salaryNumeric = app.job?.salary_numeric || 0;
      const [preview, wallet] = await Promise.all([
        getCandidateAcceptanceFeePreview(salaryNumeric),
        getUserWalletBalance(userId)
      ]);
      setFeePreview(preview);
      setWalletBalance(wallet.balance);
      if (wallet.balance < preview.fee) {
        setAcceptingError(`Insufficient MCredits. Required: ${preview.fee.toFixed(2)} MC, Available: ${wallet.balance.toFixed(2)} MC.`);
      }
    } catch (err) {
      console.error('Error fetching preview:', err);
      setAcceptingError('Failed to load MCredit balance details.');
    }
  };

  const handleConfirmAcceptance = async () => {
    if (!appToAccept) return;
    setIsAccepting(true);
    setAcceptingError('');

    try {
      const salaryNumeric = appToAccept.job?.salary_numeric || 0;
      await deductCandidateAcceptanceFee(userId, appToAccept.id, salaryNumeric);
      
      const orderRes = await createJobOrderFromAcceptedApplication(appToAccept.id);
      let newOrders = [];
      if (orderRes.success && orderRes.order) {
        newOrders = [orderRes.order];
      } else {
        console.error('Failed to create job order:', orderRes.error);
      }

      setApplications(prev => prev.map(a => a.id === appToAccept.id ? { ...a, status: 'Accepted', job_orders: newOrders } : a));
      setIsAcceptModalOpen(false);
      setAppToAccept(null);
      alert('Offer accepted successfully!');
    } catch (err) {
      console.error('Acceptance error:', err);
      setAcceptingError(err.message || 'Failed to accept offer. Check your balance or try again.');
      
      if (err.message && err.message.toLowerCase().includes('expired')) {
         setApplications(prev => prev.map(a => a.id === appToAccept.id ? { ...a, status: 'Expired' } : a));
      }
    } finally {
      setIsAccepting(false);
    }
  };

  const handleOpenCancelModal = (app) => {
    setAppToCancel(app);
    setCancelReason('');
    setCancelRemarks('');
    setIsCancelModalOpen(true);
  };

  const handleConfirmCancellation = async () => {
    if (!appToCancel || !cancelReason) {
      alert('Please select a reason for cancellation.');
      return;
    }
    const order = Array.isArray(appToCancel.job_orders) ? appToCancel.job_orders[0] : appToCancel.job_orders;
    if (!order) return;

    setIsCancelling(true);
    try {
      const res = await cancelJobOrderByCandidate({
        jobOrderId: order.id,
        reason: cancelReason,
        remarks: cancelRemarks
      });

      if (!res.success) {
        throw new Error(res.error || 'Failed to cancel engagement.');
      }

      setApplications(prev => prev.map(a => 
        a.id === appToCancel.id 
          ? { 
              ...a, 
              status: 'Candidate Cancelled', 
              job_orders: Array.isArray(a.job_orders) ? [{ ...order, status: 'Candidate Cancelled' }] : { ...order, status: 'Candidate Cancelled' } 
            } 
          : a
      ));
      setIsCancelModalOpen(false);
      setAppToCancel(null);
      alert('Engagement cancelled.');
    } catch (err) {
      console.error(err);
      alert(err.message || 'An error occurred during cancellation.');
    } finally {
      setIsCancelling(false);
    }
  };

  const renderStepper = (appStatus, orderStatus = null) => {
    const steps = ['Applied', 'Review', 'Shortlist', 'Accepted', 'Active', 'Done'];
    
    let currentIndex = 0;
    let isFailed = false;
    let failedLabel = appStatus;
    
    if (appStatus === 'Pending') currentIndex = 0;
    else if (appStatus === 'Under Review') currentIndex = 1;
    else if (appStatus === 'Shortlisted' || appStatus === 'Offered') currentIndex = 2;
    else if (appStatus === 'Accepted') {
      currentIndex = 3;
      if (orderStatus === 'Active') currentIndex = 4;
      if (orderStatus === 'Work Completed by Applicant' || orderStatus === 'Completion Confirmed by Company' || orderStatus === 'Payment Confirmed by Applicant') currentIndex = 4;
      if (orderStatus === 'Completed') currentIndex = 5;
    }
    else if (appStatus === 'Completed') currentIndex = 5;
    else {
      isFailed = true;
      if (appStatus === 'Withdrawn') currentIndex = 0;
      else if (appStatus === 'Rejected') currentIndex = 1;
      else if (appStatus === 'Expired') currentIndex = 2;
      else if (appStatus.includes('Cancelled')) currentIndex = 4;
      else currentIndex = 0;
    }

    return (
      <div className="flex w-full overflow-hidden rounded-lg border border-gray-200 mt-5 bg-gray-50 h-9 sm:h-10">
        {steps.map((step, idx) => {
          let displayLabel = step;
          const isActive = idx === currentIndex && !isFailed;
          const isPast = idx < currentIndex;
          const isFailedStep = idx === currentIndex && isFailed;
          
          let bgClass = "bg-gray-100 text-gray-400";
          if (isActive) {
             bgClass = "bg-blue-600 text-white font-semibold";
          } else if (isPast && !isFailed) {
             bgClass = "bg-slate-100 text-slate-500 font-medium";
          } else if (isFailedStep) {
             bgClass = "bg-red-500 text-white font-semibold";
             if (appStatus === 'Expired') bgClass = "bg-amber-500 text-white font-semibold";
             if (appStatus === 'Withdrawn' || appStatus === 'Position Filled') bgClass = "bg-gray-400 text-white font-semibold";
             displayLabel = failedLabel;
          } else if (isPast && isFailed) {
             bgClass = "bg-gray-50 text-gray-400 font-medium";
          }
          
          let clipPath = 'polygon(0 0, calc(100% - 10px) 0, 100% 50%, calc(100% - 10px) 100%, 0 100%, 10px 50%)';
          if (idx === 0) clipPath = 'polygon(0 0, calc(100% - 10px) 0, 100% 50%, calc(100% - 10px) 100%, 0 100%)';
          if (idx === steps.length - 1) clipPath = 'polygon(0 0, 100% 0, 100% 100%, 0 100%, 10px 50%)';

          return (
            <div 
              key={idx} 
              className={`flex-1 flex items-center justify-center relative ${bgClass} transition-colors -ml-[10px] first:ml-0`}
              style={{ clipPath, paddingLeft: idx === 0 ? '0' : '10px', zIndex: steps.length - idx }}
            >
              <span className="text-[9px] sm:text-[11px] uppercase tracking-wider text-center px-1 truncate w-full">
                {displayLabel}
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  const getFormattedDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch (e) {
      return dateStr;
    }
  };

  if (!userId && loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-gray-500 min-h-[400px]">
        <Loader2 className="animate-spin mb-3 text-blue-900" size={28} />
        <p className="text-sm font-medium">Verifying authorization credentials...</p>
      </div>
    );
  }

  const filteredApplications = applications.filter((app) => {
    if (selectedStatus !== 'All') {
      const category = getApplicationCategory(app);
      if (category !== selectedStatus) return false;
    }

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      const jobTitle = (app.job?.title || '').toLowerCase();
      const companyName = (
        typeof app.job?.company === 'string'
          ? app.job?.company
          : app.job?.company?.name || app.job?.company_name || ''
      ).toLowerCase();
      const location = (app.job?.location || '').toLowerCase();
      return jobTitle.includes(term) || companyName.includes(term) || location.includes(term);
    }

    return true;
  });

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
      <div className="mt-4 border border-slate-150 rounded-xl bg-white p-4 space-y-4 font-sans text-xs">
        {/* Contract Summary & Advance Summary (Ledger) */}
        <div>
          <h4 className="text-[11px] font-bold text-[#0e2a4d] uppercase tracking-wider mb-3">Advance Payment Ledger</h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
              <span className="text-gray-400 font-bold block text-[9px] uppercase">Contract Value</span>
              <span className="text-xs font-extrabold text-[#0e2a4d]">${ledger.contractValue.toFixed(2)} {currency}</span>
              <span className="block text-[9px] text-gray-500 truncate mt-0.5" title={comp.displayRate}>{comp.displayRate}</span>
            </div>
            <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
              <span className="text-gray-400 font-bold block text-[9px] uppercase">Max Eligible Limit</span>
              <span className="text-xs font-extrabold text-[#0e2a4d]">${ledger.maxEligible.toFixed(2)} {currency}</span>
            </div>
            <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
              <span className="text-gray-400 font-bold block text-[9px] uppercase">Total Requested</span>
              <span className="text-xs font-bold text-gray-800">${ledger.totalRequested.toFixed(2)} {currency}</span>
            </div>
            <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
              <span className="text-gray-400 font-bold block text-[9px] uppercase">Total Approved</span>
              <span className="text-xs font-bold text-green-700">${ledger.totalApproved.toFixed(2)} {currency}</span>
            </div>
            <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
              <span className="text-gray-400 font-bold block text-[9px] uppercase">Total Transferred</span>
              <span className="text-xs font-bold text-purple-700">${ledger.totalTransferred.toFixed(2)} {currency}</span>
            </div>
            <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
              <span className="text-gray-400 font-bold block text-[9px] uppercase">Total Confirmed</span>
              <span className="text-xs font-bold text-emerald-700">${ledger.totalConfirmed.toFixed(2)} {currency}</span>
            </div>
            <div className="bg-blue-50/50 p-2.5 rounded-lg border border-blue-100/50 col-span-2 sm:col-span-1">
              <span className="text-[#0e2a4d]/70 font-extrabold block text-[9px] uppercase">Remaining Eligible Cap</span>
              <span className="text-xs font-extrabold text-blue-900">${ledger.remainingEligibility.toFixed(2)} {currency}</span>
            </div>
            <div className="bg-amber-50/50 p-2.5 rounded-lg border border-amber-100/50 col-span-2 sm:col-span-1">
              <span className="text-amber-800/70 font-extrabold block text-[9px] uppercase">Remaining Payout Salary</span>
              <span className="text-xs font-extrabold text-amber-900">${ledger.remainingSalary.toFixed(2)} {currency}</span>
            </div>
          </div>
        </div>

        {/* Timeline Summary */}
        {activeRequest && (
          <div className="pt-3 border-t border-slate-100">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-[11px] font-bold text-[#0e2a4d] uppercase tracking-wider">Workflow Progress Timeline</h4>
              <span className="text-[9px] bg-slate-100 text-[#0e2a4d] font-bold px-2 py-0.5 rounded-full uppercase border border-slate-200">
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
                          <p className="mt-1 text-gray-500 italic bg-slate-50 px-2.5 py-1 rounded border border-slate-100 leading-snug">
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

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 sm:px-6">
      {/* Header bar */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-blue-900">My Job Applications</h1>
        <p className="text-sm text-gray-600 mt-1">
          Review and track the real-time status of your maritime career applications.
        </p>
      </div>

      {/* Modern Status Filter & Search Tabs */}
      {!loading && currentIdentity?.type !== 'company' && applications.length > 0 && (
        <ApplicationStatusTabs
          selectedStatus={selectedStatus}
          onSelectStatus={setSelectedStatus}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          applications={applications}
        />
      )}

      {/* Main List panel */}
      {loading ? (
        <div className="space-y-4">
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </div>
      ) : currentIdentity?.type === 'company' ? (
        <div className="text-center p-14 bg-white border border-gray-100 rounded-xl shadow-sm">
          <div className="text-gray-300 mb-4 flex justify-center">
            <Building2 size={52} />
          </div>
          <h3 className="text-lg font-bold text-gray-800">Company profiles do not submit job applications.</h3>
          <p className="text-gray-500 mt-1 mb-6 text-sm max-w-sm mx-auto">
            Switch to your personal profile to view your applications.
          </p>
        </div>
      ) : applications.length === 0 ? (
        <div className="text-center p-14 bg-white border border-gray-100 rounded-xl shadow-sm">
          <div className="text-gray-300 mb-4 flex justify-center">
            <Briefcase size={52} />
          </div>
          <h3 className="text-lg font-bold text-gray-800">You haven't applied to any jobs yet</h3>
          <p className="text-gray-500 mt-1 mb-6 text-sm max-w-sm mx-auto">
            Visit the Opportunity board to find your next role and launch your application!
          </p>
          <Link
            href="/mservices"
            className="inline-flex items-center justify-center px-5 py-2.5 bg-blue-600 text-white hover:bg-blue-700 text-sm font-semibold rounded-lg transition-colors shadow-sm"
          >
            Browse Opportunities
          </Link>
        </div>
      ) : filteredApplications.length === 0 ? (
        <div className="text-center p-12 bg-white border border-gray-100 rounded-xl shadow-sm">
          <div className="text-gray-300 mb-3 flex justify-center">
            <Briefcase size={44} />
          </div>
          <h3 className="text-base font-bold text-gray-800">No applications match your filter</h3>
          <p className="text-gray-500 mt-1 mb-4 text-xs max-w-xs mx-auto">
            There are no applications with status "{selectedStatus}"{searchTerm ? ` and keyword "${searchTerm}"` : ''}.
          </p>
          <button
            type="button"
            onClick={() => { setSelectedStatus('All'); setSearchTerm(''); }}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer font-sans"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredApplications.map((app) => {
            const job = app.job || {};
            return (
              <div
                key={app.id}
                className="flex flex-col p-6 mb-4 bg-white border border-gray-100 rounded-xl shadow-sm hover:shadow-md transition-shadow gap-0"
              >
                {/* Top Section: Job Info & Status Badge */}
                <div className="flex flex-row justify-between items-start gap-3 w-full">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    {/* Logo Container */}
                    <div className="shrink-0">
                      {(() => {
                        const posterCompany = typeof job.company === 'object' ? job.company : null;
                        
                        // Detect if poster is a company based on joined data or legacy strings
                        const isCompanyPoster = !!posterCompany || (typeof job.company === 'string') || !!job.company_name;
                        
                        // Only use logo if it's a company post. Personal avatars are explicitly ignored.
                        const displayLogoUrl = isCompanyPoster ? (posterCompany?.logo_url || job.company_logo) : null;
                        const shouldUseGenericIcon = !displayLogoUrl;
                        
                        if (!shouldUseGenericIcon) {
                          const displayName = typeof job.company === 'string' 
                            ? job.company 
                            : posterCompany?.name || job.company_name || 'Company';
                          return (
                            <img
                              src={displayLogoUrl}
                              alt={displayName}
                              className="w-10 h-10 sm:w-12 sm:h-12 rounded-md object-cover border border-gray-200"
                            />
                          );
                        } else {
                          return (
                            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-md bg-blue-50 text-blue-900 flex items-center justify-center border border-blue-100">
                              <Building size={20} className="sm:w-6 sm:h-6" />
                            </div>
                          );
                        }
                      })()}
                    </div>

                    {/* Text Block */}
                    <div className="min-w-0">
                      <h3 className="text-base sm:text-lg font-bold text-blue-900 truncate">
                        {job.title || 'Position Unspecified'}
                      </h3>
                      
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-0.5 text-xs sm:text-sm font-medium text-gray-600">
                        {(() => {
                          const displayName = typeof job.company === 'string' 
                            ? job.company 
                            : job.company?.name || job.poster?.name || job.company_name || 'Unknown Company';
                          
                          return (
                            <span className="flex items-center gap-1">
                              <Building2 size={12} className="text-gray-400 shrink-0 sm:w-3.5 sm:h-3.5" />
                              {displayName}
                            </span>
                          );
                        })()}
                        {job.location && (
                          <span className="flex items-center gap-1">
                            <MapPin size={12} className="text-gray-400 shrink-0 sm:w-3.5 sm:h-3.5" />
                            {job.location}
                          </span>
                        )}
                      </div>

                      <p className="text-[11px] sm:text-xs text-gray-400 mt-1 flex items-center gap-1">
                        <Calendar size={12} />
                        Applied {getFormattedDate(app.applied_at)}
                      </p>
                    </div>
                  </div>

                  {/* Top Right Badge */}
                  {(() => {
                    const orderArray = Array.isArray(app.job_orders) ? app.job_orders : [app.job_orders].filter(Boolean);
                    const order = orderArray[0];
                    if (app.status === 'Accepted' && order) {
                      switch (order.status) {
                        case 'Active':
                          return (
                            <span className="shrink-0 inline-block text-[10px] sm:text-xs font-semibold text-green-700 bg-green-50 border border-green-200 px-2.5 py-1 rounded-full whitespace-nowrap">
                              Active Engagement
                            </span>
                          );
                        case 'Work Completed by Applicant':
                          return (
                            <span className="shrink-0 inline-block text-[10px] sm:text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-full whitespace-nowrap">
                              Waiting for Company
                            </span>
                          );
                        case 'Completion Confirmed by Company':
                          return (
                            <span className="shrink-0 inline-block text-[10px] sm:text-xs font-semibold text-green-700 bg-green-50 border border-green-200 px-2.5 py-1 rounded-full whitespace-nowrap">
                              Completion Confirmed
                            </span>
                          );
                        case 'Payment Confirmed by Applicant':
                          return (
                            <span className="shrink-0 inline-block text-[10px] sm:text-xs font-semibold text-green-700 bg-green-50 border border-green-200 px-2.5 py-1 rounded-full whitespace-nowrap">
                              Payment Confirmed
                            </span>
                          );
                        case 'Completed':
                          return (
                            <span className="shrink-0 inline-block text-[10px] sm:text-xs font-semibold text-emerald-800 bg-emerald-100 border border-emerald-300 px-2.5 py-1 rounded-full whitespace-nowrap">
                              Completed
                            </span>
                          );
                        default:
                          return null;
                      }
                    }
                    return null;
                  })()}
                </div>

                {/* Horizontal Stepper */}
                {(() => {
                  const orderArray = Array.isArray(app.job_orders) ? app.job_orders : [app.job_orders].filter(Boolean);
                  const order = orderArray[0];
                  return renderStepper(app.status, order?.status);
                })()}

                {/* Advance Payment requests */}
                {job.advance_payment_enabled && (
                  <div className="mt-6 pt-6 border-t border-slate-100 text-left">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1.5 font-sans">
                        <Coins size={14} className="text-blue-900" />
                        Advance Payment Requests
                      </h4>
                      {(() => {
                        const thresholdMet = isThresholdSatisfied(app.status, job.advance_payment_availability);
                        const ledger = getAdvanceEligibility(job, app.advance_requests || []);
                        const canRequest = thresholdMet && (!job.advance_payment_allow_multiple ? !ledger.hasActiveOrConfirmed : ledger.remaining > 0);
                        if (canRequest) {
                          return (
                            <button
                              type="button"
                              onClick={() => handleOpenAdvanceModal(app)}
                              className="text-xs font-semibold text-blue-900 hover:text-blue-800 flex items-center gap-1 cursor-pointer focus:outline-none bg-transparent border-0 p-0"
                            >
                              + Request Advance
                            </button>
                          );
                        }
                        return null;
                      })()}
                    </div>

                    {/* Request List */}
                    {Array.isArray(app.advance_requests) && app.advance_requests.length > 0 ? (
                      <>
                        <div className="space-y-2 mb-3">
                          {app.advance_requests.map((req) => {
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
                              <div key={req.id} className="p-3.5 border border-slate-100 rounded-xl bg-slate-50/30 text-sm space-y-2.5">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <span className="font-bold text-gray-800">${displayAmount} {req.currency}</span>
                                    {req.counter_amount !== null && (
                                      <span className="text-xs text-amber-650 ml-1.5 font-semibold">(Counter Offer)</span>
                                    )}
                                    {req.expires_at && ['pending', 'countered'].includes(req.status) && (
                                      <p className="text-[10px] text-gray-400 mt-0.5 font-sans">
                                        Expires: {new Date(req.expires_at).toLocaleDateString()}
                                      </p>
                                    )}
                                  </div>
                                  <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 border rounded-full ${statusBg}`}>
                                    {displayStatus}
                                  </span>
                                </div>

                                {/* Rich Details for recorded transfers / confirmed / disputed */}
                                {['transfer_recorded', 'confirmed', 'disputed', 'review_closed'].includes(req.status) && (
                                  <div className="text-xs text-gray-600 bg-white border border-slate-100 rounded-lg p-3 space-y-1.5 font-sans">
                                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                                      <div>
                                        <span className="text-gray-400 font-bold block">Method</span>
                                        <span className="font-semibold text-gray-700 capitalize">{(req.payment_method || '—').replace('_', ' ')}</span>
                                      </div>
                                      <div>
                                        <span className="text-gray-400 font-bold block">Date</span>
                                        <span className="font-semibold text-gray-700">{req.transfer_date || '—'}</span>
                                      </div>
                                      <div className="col-span-2">
                                        <span className="text-gray-400 font-bold block">Reference Number</span>
                                        <span className="font-mono font-semibold text-gray-800">{req.reference_number || '—'}</span>
                                      </div>
                                    </div>
                                    
                                    {req.company_notes && (
                                      <div className="pt-1.5 border-t border-slate-50 text-[11px]">
                                        <span className="text-gray-400 font-bold block">Company Note</span>
                                        <p className="text-gray-600 italic mt-0.5 leading-snug">{req.company_notes}</p>
                                      </div>
                                    )}
                                    
                                    {req.proof_url && (
                                      <div className="pt-1 text-[11px]">
                                        <a 
                                          href={req.proof_url} 
                                          target="_blank" 
                                          rel="noopener noreferrer" 
                                          className="inline-flex items-center gap-1 text-[#004173] font-bold hover:underline"
                                        >
                                          Download Payment Proof
                                        </a>
                                      </div>
                                    )}
                                  </div>
                                )}

                                {/* Dispute reason if disputed */}
                                {req.status === 'disputed' && req.dispute_reason && (
                                  <div className="text-xs text-rose-800 bg-rose-50 border border-rose-100 rounded-lg p-2.5 font-sans font-semibold">
                                    Disputed Reason: {req.dispute_reason}
                                  </div>
                                )}

                                {/* Action buttons */}
                                <div className="flex items-center justify-end gap-2 pt-1">
                                  {req.status === 'pending' && (
                                    <button
                                      type="button"
                                      onClick={() => handleCancelAdvance(req.id)}
                                      className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-100 font-semibold text-xs rounded-lg transition-colors cursor-pointer"
                                    >
                                      Cancel Request
                                    </button>
                                  )}
                                  
                                  {req.status === 'countered' && (
                                    <div className="flex items-center gap-2">
                                      <button
                                        type="button"
                                        onClick={() => handleAcceptCounter(req.id)}
                                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-lg transition-colors cursor-pointer border-0"
                                      >
                                        Accept Counter
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleDeclineCounter(req.id)}
                                        className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-100 font-semibold text-xs rounded-lg transition-colors cursor-pointer"
                                      >
                                        Decline
                                      </button>
                                    </div>
                                  )}

                                  {req.status === 'transfer_recorded' && (
                                    <div className="flex items-center gap-2">
                                      <button
                                        type="button"
                                        onClick={() => handleConfirmReceipt(req.id)}
                                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-lg transition-colors cursor-pointer border-0"
                                      >
                                        Confirm Receipt
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleOpenDisputeModal(req)}
                                        className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-100 font-semibold text-xs rounded-lg transition-colors cursor-pointer"
                                      >
                                        Report Issue
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        {renderAdvancePaymentLedgerAndTimeline(job, app.advance_requests)}
                      </>
                    ) : (
                      <p className="text-xs text-gray-400 italic mb-2">No advance payment requests created yet.</p>
                    )}

                    {/* Eligibility Status Banner */}
                    {(() => {
                      const thresholdMet = isThresholdSatisfied(app.status, job.advance_payment_availability);
                      const ledger = getAdvanceEligibility(job, app.advance_requests || []);
                      if (!thresholdMet) {
                        return (
                          <div className="p-2.5 bg-slate-50 border border-slate-150 rounded-lg text-xs text-slate-500 leading-normal font-sans">
                            Advance requests will be available when application reaches status: <span className="font-bold capitalize">{job.advance_payment_availability}</span>.
                          </div>
                        );
                      }
                      if (!job.advance_payment_allow_multiple && ledger.hasActiveOrConfirmed) {
                        return (
                          <div className="p-2.5 bg-amber-50/50 border border-amber-100 rounded-lg text-xs text-amber-700 font-sans">
                            Maximum request limit reached (only one advance request permitted).
                          </div>
                        );
                      }
                      if (ledger.remaining <= 0) {
                        return (
                          <div className="p-2.5 bg-amber-50/50 border border-amber-100 rounded-lg text-xs text-amber-700 font-sans">
                            No remaining advance eligibility ($0.00 left of ${ledger.maxEligible.toFixed(2)} cap).
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </div>
                )}

                {/* Engagement Timeline */}
                <div className="mt-6 pt-6 border-t border-slate-100 text-left">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">Engagement Timeline</h4>
                  <EngagementTimeline 
                    jobOrder={Array.isArray(app.job_orders) ? app.job_orders[0] : app.job_orders} 
                    application={app} 
                  />
                </div>

                {/* Dynamic Status Badges / Cancellation Infos / Action Buttons */}
                <div className="mt-5 flex flex-col gap-3">
                  {(app.status === 'Company Cancelled' || app.status === 'Candidate Cancelled') && (() => {
                    let cancellation = app.job_cancellation;
                    if (!cancellation && app.job_cancellations?.length > 0) {
                      cancellation = app.job_cancellations[0];
                    }
                    if (!cancellation) {
                      const order = Array.isArray(app.job_orders) ? app.job_orders[0] : app.job_orders;
                      cancellation = order?.job_cancellations ? (Array.isArray(order.job_cancellations) ? order.job_cancellations[0] : order.job_cancellations) : null;
                    }
                    if (cancellation) {
                      const prefix = app.status === 'Company Cancelled' ? 'Company' : 'Candidate';
                      const refundStatus = cancellation.refund_status;

                      // Determine refund label for display
                      let refundLabel = null;
                      if (app.status === 'Company Cancelled') {
                        if (refundStatus === 'auto_refunded') {
                          refundLabel = { text: 'Acceptance fee refunded to your wallet.', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' };
                        } else if (refundStatus === 'no_refund') {
                          refundLabel = { text: 'No refund due to applicant-related cancellation reason.', color: 'text-gray-600 bg-gray-50 border-gray-200' };
                        }
                      }

                      return (
                        <div className="p-4 bg-red-50 border border-red-100 rounded-lg text-sm text-red-800 text-left w-full">
                          <p className="font-bold text-red-900 mb-1">{prefix} Cancellation Reason:</p>
                          <p className="mb-3">{cancellation.cancellation_reason}</p>
                          
                          {cancellation.cancellation_remarks && (
                            <>
                              <p className="font-bold text-red-900 mb-1">Remarks:</p>
                              <p className="mb-3">{cancellation.cancellation_remarks}</p>
                            </>
                          )}

                          {refundLabel && (
                            <p className={`text-xs font-semibold mt-1 px-2 py-1 rounded border inline-block ${refundLabel.color}`}>
                              {refundLabel.text}
                            </p>
                          )}
                        </div>
                      );
                    }
                    return null;
                  })()}

                  <div className="flex flex-row flex-wrap items-center justify-end gap-2 w-full mt-1">
                    {app.status === 'Offered' && (
                      <div className="flex flex-col items-center gap-1 w-full sm:w-auto">
                        <button
                          onClick={() => handleOpenAcceptModal(app)}
                          className="px-4 py-2 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors w-full text-center"
                        >
                          Click to Accept the Offer
                        </button>
                        {app.offer_expires_at && (
                          <p className="text-[10px] text-rose-500 font-semibold uppercase tracking-wider text-center">
                            Expires: {new Date(app.offer_expires_at).toLocaleString()}
                          </p>
                        )}
                      </div>
                    )}

                    {app.status === 'Accepted' && (() => {
                      const orderArray = Array.isArray(app.job_orders) ? app.job_orders : [app.job_orders].filter(Boolean);
                      const order = orderArray[0];
                      if (!order) return null;

                      switch (order.status) {
                        case 'Active':
                          return (
                            <>
                              <button
                                onClick={() => handleOpenWorkCompletedModal(order.id)}
                                className="px-4 py-2 text-sm font-semibold bg-green-50 text-green-700 border border-green-200 rounded-lg hover:bg-green-100 transition-colors flex-1 min-w-[140px] text-center"
                              >
                                Mark Work Completed
                              </button>
                              <button
                                onClick={() => handleOpenCancelModal(app)}
                                className="px-4 py-2 text-sm font-semibold bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100 transition-colors flex-1 min-w-[140px] text-center"
                              >
                                Cancel Engagement
                              </button>
                            </>
                          );
                        case 'Work Completed by Applicant':
                          return null; // Top badge handles this visually
                        case 'Completion Confirmed by Company':
                          return (
                            <button
                              onClick={() => handleOpenConfirmPaymentModal(order.id)}
                              className="px-4 py-2 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex-1 min-w-[140px] text-center"
                            >
                              Press to Confirm Payment Received
                            </button>
                          );
                        case 'Payment Confirmed by Applicant':
                          return (
                            <p className="text-xs text-gray-500 text-center sm:text-right w-full mb-2">
                              Waiting for company to close engagement
                            </p>
                          );
                        case 'Completed':
                          return null;
                        default:
                          return null;
                      }
                    })()}

                    <Link
                      href={`/mservices/opportunity/${app.job_id}?source=my-applications`}
                      className="px-4 py-2 text-sm font-semibold text-blue-900 bg-white border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors flex-1 min-w-[140px] text-center"
                    >
                      View Job
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Accept Offer Modal */}
      <BaseModal
        isOpen={isAcceptModalOpen && appToAccept !== null}
        onClose={() => { setIsAcceptModalOpen(false); setAppToAccept(null); }}
        title="Accept Job Offer"
        maxWidth="600px"
        disableBackdropClick={isAccepting}
      >
        <div className="flex flex-col space-y-4">
          <p className="text-sm text-gray-600">
            You are accepting the offer for <span className="font-semibold text-gray-800">{appToAccept?.job?.title}</span> from <span className="font-semibold text-gray-800">{appToAccept?.job?.company_id && appToAccept?.job?.company?.name ? appToAccept.job.company.name : (appToAccept?.job?.poster?.name || 'the poster')}</span>.
          </p>

          {!feePreview ? (
            <div className="flex justify-center py-4">
              <Loader2 className="animate-spin text-blue-900" size={24} />
            </div>
          ) : (
            <div className={`rounded-xl px-4 py-4 border ${
              acceptingError && acceptingError.includes('Insufficient')
                ? 'bg-red-50 border-red-200' 
                : 'bg-emerald-50 border-emerald-200'
            }`}>
              <div className="flex items-start gap-3">
                {acceptingError && acceptingError.includes('Insufficient') ? (
                  <AlertTriangle size={18} className="text-red-600 shrink-0 mt-0.5" />
                ) : (
                  <Coins size={18} className="text-emerald-700 shrink-0 mt-0.5" />
                )}
                <div className="text-sm w-full">
                  <p className="font-semibold text-gray-800">
                    Acceptance Fee: <span className="font-bold">{feePreview.fee.toFixed(2)} MC</span>
                  </p>
                  {walletBalance !== null && (
                    <p className="text-gray-600 mt-0.5">
                      Your Wallet: <span className="font-bold">{walletBalance.toFixed(2)} MC</span>
                    </p>
                  )}
                  {acceptingError && (
                    <div className="mt-1.5 space-y-2">
                      <p className="text-red-700 font-semibold leading-tight">{acceptingError}</p>
                      {acceptingError.includes('Insufficient') && (
                        <div className="pt-0.5">
                          <Link
                            href="/profile/wallet"
                            className="inline-flex items-center justify-center rounded-md border border-[#004173]/20 bg-[#eaf3fb] px-4 py-2 text-sm font-semibold text-[#004173] hover:bg-[#dcecf8] transition-colors"
                          >
                            Top up your wallet
                          </Link>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="pt-4 flex flex-col-reverse sm:flex-row justify-end gap-3">
            <button 
              onClick={() => { setIsAcceptModalOpen(false); setAppToAccept(null); }}
              className="w-full sm:w-auto px-5 py-2.5 text-sm font-bold text-gray-600 hover:bg-gray-100 rounded-xl transition-colors text-center shrink-0"
              disabled={isAccepting}
            >
              Cancel
            </button>
            <button 
              onClick={handleConfirmAcceptance}
              className="w-full sm:w-auto bg-[#004173] hover:bg-blue-800 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-colors shadow-sm disabled:opacity-50 text-center shrink-0"
              disabled={isAccepting || feePreview === null || walletBalance === null || walletBalance < feePreview.fee}
            >
              {isAccepting ? 'Confirming...' : 'Confirm Acceptance'}
            </button>
          </div>
        </div>
      </BaseModal>

      {/* Cancel Engagement Modal */}
      {isCancelModalOpen && appToCancel && (
        <div className="fixed inset-0 bg-slate-900/40 z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl">
            <h3 className="text-lg font-bold text-red-600 mb-2">Cancel Accepted Job</h3>
            <p className="text-sm text-gray-600 mb-4">
              Cancelling an accepted job may affect your trust and reputation score. Please provide a reason.
            </p>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Reason (Required)</label>
                <select 
                  className="w-full border border-gray-200 rounded-lg p-2.5 text-sm outline-none focus:border-blue-500"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                >
                  <option value="">Select a reason...</option>
                  <option value="Medical / Health Issue">Medical / Health Issue</option>
                  <option value="Family Emergency">Family Emergency</option>
                  <option value="Accepted Another Opportunity">Accepted Another Opportunity</option>
                  <option value="Schedule Conflict">Schedule Conflict</option>
                  <option value="Location / Travel Issue">Location / Travel Issue</option>
                  <option value="Salary or Terms Concern">Salary or Terms Concern</option>
                  <option value="Unable to Meet Requirements">Unable to Meet Requirements</option>
                  <option value="Personal Reason">Personal Reason</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Remarks (Optional)</label>
                <textarea 
                  className="w-full border border-gray-200 rounded-lg p-2.5 text-sm outline-none focus:border-blue-500 min-h-[80px]"
                  placeholder="Provide additional details..."
                  value={cancelRemarks}
                  onChange={(e) => setCancelRemarks(e.target.value)}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setIsCancelModalOpen(false)}
                className="px-5 py-2 text-sm font-bold text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
                disabled={isCancelling}
              >
                Close
              </button>
              <button 
                onClick={handleConfirmCancellation}
                className="bg-red-600 hover:bg-red-700 text-white px-5 py-2 rounded-xl text-sm font-bold transition-colors shadow-sm disabled:opacity-50"
                disabled={isCancelling || !cancelReason}
              >
                {isCancelling ? 'Submitting...' : 'Submit Cancellation'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Mark Work Completed Modal */}
      {isWorkCompletedModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl">
            <h3 className="text-lg font-bold text-blue-900 mb-2">Mark Work Completed</h3>
            <p className="text-sm text-gray-600 mb-4">
              Confirm that you have completed the work for this opportunity. You can add an optional note for the company.
            </p>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Completion Note (Optional)</label>
                <textarea 
                  className="w-full border border-gray-200 rounded-lg p-2.5 text-sm outline-none focus:border-blue-500 min-h-[80px]"
                  placeholder="Describe completed work or add details..."
                  value={workCompletedNote}
                  onChange={(e) => setWorkCompletedNote(e.target.value)}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button 
                onClick={() => { setIsWorkCompletedModalOpen(false); setSelectedOrderId(null); }}
                className="px-5 py-2 text-sm font-bold text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
                disabled={submittingLifecycle}
              >
                Cancel
              </button>
              <button 
                onClick={handleConfirmWorkCompleted}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-xl text-sm font-bold transition-colors shadow-sm disabled:opacity-50"
                disabled={submittingLifecycle}
              >
                {submittingLifecycle ? 'Submitting...' : 'Confirm Work Completed'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Payment Received Modal */}
      {isConfirmPaymentModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl">
            <h3 className="text-lg font-bold text-blue-900 mb-2">Confirm Payment Received</h3>
            <p className="text-sm text-gray-600 mb-4">
              Confirm that you have received payment directly from the company. This will allow the company to finalize and close the engagement.
            </p>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Confirmation Note (Optional)</label>
                <textarea 
                  className="w-full border border-gray-200 rounded-lg p-2.5 text-sm outline-none focus:border-blue-500 min-h-[80px]"
                  placeholder="Payment receipt details or remarks..."
                  value={paymentConfirmationNote}
                  onChange={(e) => setPaymentConfirmationNote(e.target.value)}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button 
                onClick={() => { setIsConfirmPaymentModalOpen(false); setSelectedOrderId(null); }}
                className="px-5 py-2 text-sm font-bold text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
                disabled={submittingLifecycle}
              >
                Cancel
              </button>
              <button 
                onClick={handleConfirmPaymentReceived}
                className="bg-[#004173] hover:bg-blue-800 text-white px-5 py-2 rounded-xl text-sm font-bold transition-colors shadow-sm disabled:opacity-50"
                disabled={submittingLifecycle}
              >
                {submittingLifecycle ? 'Confirming...' : 'Press to Confirm Payment Received'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Request Advance Modal */}
      <BaseModal
        isOpen={isAdvanceModalOpen && selectedAppForAdvance !== null}
        onClose={() => { setIsAdvanceModalOpen(false); setSelectedAppForAdvance(null); }}
        title="Request Advance Payment"
        maxWidth="600px"
        disableBackdropClick={isSubmittingAdvance}
      >
        {selectedAppForAdvance && (() => {
          const job = selectedAppForAdvance.job || {};
          const ledger = getAdvanceEligibility(job, selectedAppForAdvance.advance_requests || []);
          const currency = job.salary_range ? job.salary_range.split(' ')[0] : 'USD';
          
          return (
            <div className="flex flex-col space-y-4 text-left">
              <p className="text-sm text-gray-600 font-sans">
                You are requesting an advance payment for the job: <span className="font-semibold text-gray-800">{job.title}</span>.
              </p>

              {/* Company Terms */}
              {job.advance_payment_notes && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-sans">
                  <p className="font-bold text-slate-700 mb-1">Company Advance Terms & Instructions:</p>
                  <p className="text-slate-600 whitespace-pre-wrap">{job.advance_payment_notes}</p>
                </div>
              )}

              {/* Eligibility Stats */}
              <div className="grid grid-cols-2 gap-4 p-3 bg-blue-50/50 border border-blue-100 rounded-lg text-xs font-sans">
                <div>
                  <p className="text-gray-500 font-medium">Maximum Eligible Cap</p>
                  <p className="text-sm font-bold text-blue-900">${ledger.maxEligible.toFixed(2)} {currency}</p>
                </div>
                <div>
                  <p className="text-gray-500 font-medium">Remaining Eligibility Limit</p>
                  <p className="text-sm font-bold text-blue-900">${ledger.remaining.toFixed(2)} {currency}</p>
                </div>
              </div>

              {/* Form Input fields */}
              <div className="space-y-4 font-sans">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Requested Amount ({currency})</label>
                  <input
                    type="number"
                    value={advanceAmountInput}
                    onChange={(e) => setAdvanceAmountInput(e.target.value)}
                    placeholder={`e.g. 250`}
                    className="w-full border border-gray-250 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-900"
                    min="1"
                    max={ledger.remaining}
                    step="any"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Justification / Notes for Company</label>
                  <textarea
                    value={advanceNotesInput}
                    onChange={(e) => setAdvanceNotesInput(e.target.value)}
                    placeholder="Provide details about why you need this advance (e.g. travel fees, equipment)..."
                    className="w-full border border-gray-250 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-900 min-h-[90px]"
                  />
                </div>
              </div>

              {advanceRequestError && (
                <div className="p-3 bg-rose-50 border border-rose-250 rounded-lg text-xs text-rose-700 font-semibold font-sans">
                  {advanceRequestError}
                </div>
              )}

              {/* Action Buttons */}
              <div className="pt-4 flex flex-col-reverse sm:flex-row justify-end gap-3 border-t border-slate-100 font-sans">
                <button
                  type="button"
                  onClick={() => { setIsAdvanceModalOpen(false); setSelectedAppForAdvance(null); }}
                  className="w-full sm:w-auto px-5 py-2.5 text-sm font-bold text-gray-600 hover:bg-gray-100 rounded-xl transition-colors text-center cursor-pointer bg-transparent border-0"
                  disabled={isSubmittingAdvance}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSubmitAdvanceRequest}
                  className="w-full sm:w-auto bg-[#004173] hover:bg-blue-800 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-colors shadow-sm disabled:opacity-50 text-center cursor-pointer border-0"
                  disabled={isSubmittingAdvance || !advanceAmountInput || parseFloat(advanceAmountInput) <= 0 || parseFloat(advanceAmountInput) > ledger.remaining}
                >
                  {isSubmittingAdvance ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </div>
          );
        })()}
      </BaseModal>
      {/* Dispute Advance Payment Transfer Modal */}
      {isDisputeModalOpen && requestToDispute && (
        <div className="fixed inset-0 bg-slate-900/40 z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl text-left font-sans">
            <h3 className="text-lg font-bold text-red-650 mb-2">Report Issue / Dispute Transfer</h3>
            <p className="text-sm text-gray-600 mb-4">
              If you did not receive the funds, or the amount does not match, please report the issue. Platform administrators will be notified to review the offline audit trail.
            </p>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">Specify Issue / Reason *</label>
                <textarea 
                  value={disputeReasonInput}
                  onChange={(e) => setDisputeReasonInput(e.target.value)}
                  placeholder="Explain the issue in detail (e.g. money not received after 3 days, incorrect amount received)..."
                  className="w-full border border-gray-250 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-900 min-h-[100px]"
                  required
                />
              </div>
            </div>

            {disputeError && (
              <div className="p-3 bg-rose-50 border border-rose-250 rounded-lg text-xs text-rose-700 font-semibold mb-4">
                {disputeError}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
              <button 
                onClick={() => { setIsDisputeModalOpen(false); setRequestToDispute(null); }}
                className="px-5 py-2 text-sm font-bold text-gray-600 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer bg-transparent border-0"
                disabled={isSubmittingDispute}
              >
                Cancel
              </button>
              <button 
                onClick={handleSubmitDispute}
                className="bg-red-650 hover:bg-red-700 text-white px-5 py-2 rounded-xl text-sm font-bold transition-colors shadow-sm disabled:opacity-50 cursor-pointer border-0"
                disabled={isSubmittingDispute || !disputeReasonInput.trim()}
              >
                {isSubmittingDispute ? 'Submitting...' : 'Report Issue'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
