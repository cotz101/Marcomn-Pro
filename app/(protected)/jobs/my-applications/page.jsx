'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useProfile } from '@/app/context/ProfileContext';
import { createClient } from '@/lib/supabase';
import { Briefcase, MapPin, Calendar, Building2, Loader2, ExternalLink, Building, AlertTriangle, Coins } from 'lucide-react';
import { getCandidateAcceptanceFeePreview, getUserWalletBalance, deductCandidateAcceptanceFee } from '@/app/actions/mcreditsJobs';
import { createJobOrderFromAcceptedApplication, cancelJobOrderByCandidate } from '@/app/actions/jobOrders';
import { markWorkCompletedByApplicant, confirmPaymentReceivedByApplicant } from '@/app/actions/engagementLifecycle';
import BaseModal from '@/src/components/layout/BaseModal';

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

export default function MyApplicationsPage() {
  const { userId, currentIdentity } = useProfile();
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);

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
        
        // 3. Fetch job_cancellations for job_order IDs
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
        
        // 4. Manually attach the latest cancellation record to each application object
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
              // Sort descending by created_at if possible, or just take first
              orderCancellations.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
              appCancellation = orderCancellations[0];
            }
          }
          
          return {
            ...app,
            job_orders: appOrders,
            job_cancellation: appCancellation
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

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 sm:px-6">
      {/* Header bar */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-blue-900">My Job Applications</h1>
        <p className="text-sm text-gray-600 mt-1">
          Review and track the real-time status of your maritime career applications.
        </p>
      </div>

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
      ) : (
        <div className="space-y-4">
          {applications.map((app) => {
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
            You are accepting the offer for <span className="font-semibold text-gray-800">{appToAccept?.job?.title}</span> at <span className="font-semibold text-gray-800">{typeof appToAccept?.job?.company === 'string' ? appToAccept.job.company : appToAccept?.job?.company?.name || appToAccept?.job?.company_name || 'Company'}</span>.
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
    </div>
  );
}
