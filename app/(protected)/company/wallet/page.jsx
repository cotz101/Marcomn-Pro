'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useProfile } from '@/app/context/ProfileContext';
import { createClient } from '@/lib/supabase';
import { 
  ArrowLeft, 
  Loader2, 
  Coins, 
  History, 
  TrendingUp, 
  TrendingDown, 
  FileText,
  Building2,
  Info,
  Plus,
  CreditCard,
  XCircle,
  X
} from 'lucide-react';
import { createTopupRequest, cancelTopupRequest, getMyTopupRequests, cancelLatestPendingStripeTopup } from '@/app/actions/mcreditTopups';
import { getMyReceipts } from '@/app/actions/mcreditReceipts';

export default function CompanyWalletPage() {
  const router = useRouter();
  const { profile, userId, companies } = useProfile();
  
  const [loading, setLoading] = useState(true);
  const [wallet, setWallet] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [topupRequests, setTopupRequests] = useState([]);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('transactions');
  const [receipts, setReceipts] = useState([]);
  const [selectedReceipt, setSelectedReceipt] = useState(null);

  // Refund Modal State
  const [refundRequests, setRefundRequests] = useState([]);
  const [isRefundModalOpen, setIsRefundModalOpen] = useState(false);
  const [selectedTopupForRefund, setSelectedTopupForRefund] = useState(null);
  const [refundReason, setRefundReason] = useState('unused_credits');
  const [refundNote, setRefundNote] = useState('');
  const [refundAmount, setRefundAmount] = useState('');
  const [submittingRefund, setSubmittingRefund] = useState(false);
  const [refundSuccessMessage, setRefundSuccessMessage] = useState(null);
  const [refundErrorMessage, setRefundErrorMessage] = useState(null);

  // Top-Up Modal State
  const [isTopupModalOpen, setIsTopupModalOpen] = useState(false);
  const [topupAmount, setTopupAmount] = useState('');
  const [topupRemarks, setTopupRemarks] = useState('');
  const [submittingTopup, setSubmittingTopup] = useState(false);
  const [topupMessage, setTopupMessage] = useState(null);  // { type: 'success'|'error', text: string }

  const [modalTab, setModalTab] = useState('package'); // 'package' or 'custom'
  const [mcreditsPerUsd, setMcreditsPerUsd] = useState(1.0);
  const [stripePackages, setStripePackages] = useState([]);
  const [submittingStripe, setSubmittingStripe] = useState(false);
  const [pageMessage, setPageMessage] = useState(null);


  const myCompany = companies && companies.length > 0 ? companies[0] : null;

  const fetchWalletData = useCallback(async () => {
    if (!myCompany) {
      setLoading(false);
      return;
    }

    try {
      const supabase = createClient();
      
      // Fetch wallet
      const { data: walletData, error: walletError } = await supabase
        .from('mcredit_wallets')
        .select('*')
        .eq('owner_type', 'company')
        .eq('owner_id', myCompany.id)
        .maybeSingle();

      // Fetch exchange rate
      const { data: settingData } = await supabase
        .from('platform_settings')
        .select('value')
        .eq('key', 'mcredits_per_usd')
        .maybeSingle();

      if (settingData) {
        setMcreditsPerUsd(Number(settingData.value) || 1.0);
      }

      // Fetch top-up packages
      const { data: packagesData } = await supabase
        .from('platform_settings')
        .select('value')
        .eq('key', 'mcredit_topup_packages')
        .maybeSingle();

      if (packagesData) {
        try {
          const parsed = JSON.parse(packagesData.value);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const activeSorted = parsed
              .filter(pkg => pkg.isActive)
              .sort((a, b) => (Number(a.displayOrder) || 0) - (Number(b.displayOrder) || 0));
            setStripePackages(activeSorted);
          }
        } catch (e) {
          console.error('Failed to parse stripe packages:', e);
        }
      }

      if (walletError) throw walletError;

      if (walletData) {
        setWallet(walletData);
        
        // Fetch transactions
        const { data: txsData, error: txsError } = await supabase
          .from('mcredit_transactions')
          .select('*')
          .eq('wallet_id', walletData.id)
          .order('created_at', { ascending: false });
          
        if (txsError) throw txsError;
        const txs = txsData || [];

        const jobIds = txs.filter(t => t.reference_type === 'job_posting' && t.reference_id).map(t => t.reference_id);
        const uniqueJobIds = [...new Set(jobIds)];
        
        const jobMap = {};
        if (uniqueJobIds.length > 0) {
          const { data: jobsData } = await supabase
            .from('jobs')
            .select('id, title, salary_numeric')
            .in('id', uniqueJobIds);
          
          if (jobsData) {
            jobsData.forEach(job => {
              jobMap[job.id] = job;
            });
          }
        }

        // Fetch cancellation details if any penalty/refund transactions exist
        const cancellationTypes = ['candidate_cancellation', 'candidate_cancellation_platform', 'company_cancellation_refund'];
        const cancelIds = txs
          .filter(t => cancellationTypes.includes(t.reference_type) && t.reference_id)
          .map(t => t.reference_id);
        const uniqueCancelIds = [...new Set(cancelIds)];

        const cancelMap = {};
        if (uniqueCancelIds.length > 0) {
          const { data: cancelsData } = await supabase
            .from('job_cancellations')
            .select('id, job_id, application_id, cancelled_by, cancelled_by_type')
            .in('id', uniqueCancelIds);

          if (cancelsData) {
            const jobIdsToFetch = cancelsData.map(c => c.job_id).filter(Boolean);
            const appIdsToFetch = cancelsData.map(c => c.application_id).filter(Boolean);
            const uniqueJobIdsToFetch = [...new Set(jobIdsToFetch)];
            const uniqueAppIdsToFetch = [...new Set(appIdsToFetch)];

            const jobTitleMap = {};
            if (uniqueJobIdsToFetch.length > 0) {
              const { data: jobsData } = await supabase
                .from('jobs')
                .select('id, title')
                .in('id', uniqueJobIdsToFetch);
              if (jobsData) {
                jobsData.forEach(j => {
                  jobTitleMap[j.id] = j.title;
                });
              }
            }

            const appToApplicantMap = {};
            if (uniqueAppIdsToFetch.length > 0) {
              const { data: appsData } = await supabase
                .from('applications')
                .select('id, applicant_id')
                .in('id', uniqueAppIdsToFetch);
              if (appsData) {
                appsData.forEach(a => {
                  appToApplicantMap[a.id] = a.applicant_id;
                });
              }
            }

            const profileIdsToFetch = [
              ...cancelsData.map(c => c.cancelled_by).filter(Boolean),
              ...Object.values(appToApplicantMap)
            ];
            const uniqueProfileIdsToFetch = [...new Set(profileIdsToFetch)];

            const profileNameMap = {};
            if (uniqueProfileIdsToFetch.length > 0) {
              const { data: profilesData } = await supabase
                .from('profiles')
                .select('id, name')
                .in('id', uniqueProfileIdsToFetch);
              if (profilesData) {
                profilesData.forEach(p => {
                  profileNameMap[p.id] = p.name;
                });
              }
            }

            cancelsData.forEach(cancel => {
              const applicantId = appToApplicantMap[cancel.application_id];
              let candidateName = applicantId ? profileNameMap[applicantId] : null;
              if (!candidateName && cancel.cancelled_by_type === 'candidate') {
                candidateName = profileNameMap[cancel.cancelled_by];
              }

              cancelMap[cancel.id] = {
                jobTitle: jobTitleMap[cancel.job_id] || null,
                candidateName: candidateName || null
              };
            });
          }
        }

        const enrichedTxs = txs.map(tx => {
          let enriched = { ...tx };
          if (tx.reference_type === 'job_posting' && tx.reference_id && jobMap[tx.reference_id]) {
            enriched.jobDetails = jobMap[tx.reference_id];
          }
          if (cancellationTypes.includes(tx.reference_type) && tx.reference_id && cancelMap[tx.reference_id]) {
            enriched.cancellationDetails = cancelMap[tx.reference_id];
          }
          if (tx.transaction_type === 'purchase_completed') {
            if (tx.reference_type === 'stripe_checkout') {
              enriched.transaction_type = 'stripe_top_up';
            } else if (tx.reference_type === 'topup_request') {
              enriched.transaction_type = 'manual_top_up';
            }
          }
          return enriched;
        });

        setTransactions(enrichedTxs);

        // Fetch Top-Up Requests
        const topups = await getMyTopupRequests('company', myCompany.id);
        setTopupRequests(topups || []);

        // Fetch Receipts
        const userReceipts = await getMyReceipts('company', myCompany.id);
        setReceipts(userReceipts || []);

        // Fetch Refund Requests
        const { data: refundsData } = await supabase
          .from('mcredit_refund_requests')
          .select('*')
          .eq('wallet_id', walletData.id);
        setRefundRequests(refundsData || []);
      }
    } catch (err) {
      console.error('Error fetching company wallet:', err);
      setError('Unable to load wallet details at this time.');
    } finally {
      setLoading(false);
    }
  }, [myCompany]);

  useEffect(() => {
    if (typeof window !== 'undefined' && myCompany?.id) {
      const params = new URLSearchParams(window.location.search);
      if (params.get('cancelled') === 'true') {
        const sessionId = params.get('session_id') || null;
        setPageMessage({
          type: 'error',
          text: 'Payment checkout was cancelled.'
        });
        cancelLatestPendingStripeTopup({
          ownerType: 'company',
          ownerId: myCompany.id,
          sessionId
        }).then(() => {
          fetchWalletData();
          window.history.replaceState({}, document.title, window.location.pathname);
        });
      } else if (params.get('success') === 'true') {
        setPageMessage({
          type: 'success',
          text: 'Payment received. Your MCredit balance will update after confirmation.'
        });
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  }, [myCompany?.id, fetchWalletData]);

  useEffect(() => {
    if (userId !== undefined && companies !== undefined) {
      fetchWalletData();
    }
  }, [userId, companies, fetchWalletData]);

  const handleTopupSubmit = async (e) => {
    e.preventDefault();
    if (!topupAmount || Number(topupAmount) <= 0) return;
    setSubmittingTopup(true);
    setTopupMessage(null);
    try {
      const res = await createTopupRequest({
        ownerType: 'company',
        ownerId: myCompany.id,
        amount: topupAmount,
        remarks: topupRemarks
      });
      if (!res.success) throw new Error(res.error);
      setTopupMessage({ type: 'success', text: 'Top-up request submitted and pending admin approval.' });
      setTopupAmount('');
      setTopupRemarks('');
      await fetchWalletData();
      setTimeout(() => {
        setIsTopupModalOpen(false);
        setTopupMessage(null);
      }, 2000);
    } catch (err) {
      console.error('Topup request error:', err);
      setTopupMessage({ type: 'error', text: err.message || 'Failed to submit request' });
    } finally {
      setSubmittingTopup(false);
    }
  };

  const handleStripeCheckout = async (packageAmount, packageId, customAmount) => {
    setSubmittingStripe(true);
    setTopupMessage(null);
    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ownerType: 'company',
          ownerId: myCompany.id,
          packageAmount,
          packageId,
          customAmount
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText || 'Failed to initiate checkout session');
      }

      const { url } = await response.json();
      if (url) {
        window.location.href = url; // Redirect to Stripe Checkout
      } else {
        throw new Error('No redirect URL returned from checkout session');
      }
    } catch (err) {
      console.error('Stripe Checkout error:', err);
      setTopupMessage({ type: 'error', text: err.message || 'Failed to initiate checkout session' });
      setSubmittingStripe(false);
    }
  };

  const handleCancelTopup = async (requestId) => {
    if (!confirm('Are you sure you want to cancel this top-up request?')) return;
    try {
      const res = await cancelTopupRequest(requestId);
      if (!res.success) throw new Error(res.error);
      await fetchWalletData();
    } catch (err) {
      console.error('Cancel request error:', err);
      alert(err.message || 'Failed to cancel request');
    }
  };

  const displayPackages = stripePackages.length > 0 ? stripePackages : [10, 25, 50, 100, 250, 500].map(amount => ({
    id: `pkg_${amount}`,
    usdPrice: amount,
    mcreditAmount: amount * mcreditsPerUsd,
    isActive: true
  }));

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
        <Loader2 size={36} className="animate-spin text-blue-900" />
        <span className="text-sm text-gray-500 font-semibold">Loading company wallet...</span>
      </div>
    );
  }

  if (!myCompany) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 font-sans">
        <div className="bg-white border border-gray-100 rounded-3xl p-10 shadow-sm flex flex-col items-center text-center space-y-6">
          <div className="p-5 bg-slate-50 text-slate-400 rounded-full">
            <Building2 size={48} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">No Company Found</h1>
            <p className="text-base text-gray-500 mt-2 max-w-md mx-auto">
              You do not have a company wallet yet. Create a company profile first to start managing MCredits.
            </p>
          </div>
          <button
            onClick={() => router.push('/')}
            className="bg-[#002b4e] hover:bg-[#001c33] text-white text-sm font-bold px-8 py-3 rounded-xl transition-all shadow-sm"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 font-sans text-center">
        <p className="text-red-600 font-bold">{error}</p>
      </div>
    );
  }

  const handleRefundSubmit = async (e) => {
    e.preventDefault();
    if (!refundAmount || Number(refundAmount) <= 0) return;
    if (Number(refundAmount) > selectedTopupForRefund?.remainingRefundable) {
      setRefundErrorMessage(`Cannot exceed remaining refundable amount of ${selectedTopupForRefund.remainingRefundable} MC`);
      return;
    }

    setSubmittingRefund(true);
    setRefundErrorMessage(null);
    setRefundSuccessMessage(null);

    try {
      const response = await fetch('/api/mcredits/refund-requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          walletId: wallet.id,
          topupRequestId: selectedTopupForRefund.request.id,
          requestedMcredits: Number(refundAmount),
          reason: refundReason,
          userNote: refundNote
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText || 'Failed to submit refund request');
      }

      setRefundSuccessMessage("Your refund request has been submitted for review. You will be notified once it has been reviewed.");

      setTimeout(async () => {
        setIsRefundModalOpen(false);
        setSelectedTopupForRefund(null);
        setRefundReason('unused_credits');
        setRefundNote('');
        setRefundAmount('');
        setRefundSuccessMessage(null);
        await fetchWalletData();
      }, 3500);
    } catch (err) {
      console.error('Submit refund error:', err);
      setRefundErrorMessage(err.message || 'Failed to submit refund request');
    } finally {
      setSubmittingRefund(false);
    }
  };

  const renderRefundStatus = (topupId, topupAmount, isTransactionsTab = false) => {
    const allTopupRequests = refundRequests.filter(r => r.topup_request_id === topupId);
    const sortedRefunds = [...allTopupRequests].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    const latestRefund = sortedRefunds[0] || null;

    const topupRefunds = refundRequests.filter(r => r.topup_request_id === topupId && r.status !== 'rejected' && r.status !== 'cancelled' && r.status !== 'failed');
    const refundedMcredits = topupRefunds.reduce((acc, r) => acc + Number(r.approved_mcredits || r.requested_mcredits), 0);
    const remainingRefundable = Math.max(0, Number(topupAmount) - refundedMcredits);
    const hasActiveRequest = topupRefunds.some(r => ['pending_review', 'processing'].includes(r.status));

    let statusText = '';
    let statusColor = 'text-gray-500';

    if (latestRefund) {
      if (latestRefund.status === 'pending_review') {
        statusText = 'Refund Pending';
        statusColor = 'text-amber-600';
      } else if (latestRefund.status === 'processing') {
        statusText = 'Refund Processing';
        statusColor = 'text-amber-600';
      } else if (latestRefund.status === 'refunded') {
        statusText = remainingRefundable <= 0 ? 'Fully Refunded' : 'Refunded';
        statusColor = 'text-emerald-600';
      } else if (latestRefund.status === 'rejected') {
        statusText = 'Refund Rejected';
        statusColor = 'text-rose-600';
      } else if (latestRefund.status === 'failed') {
        statusText = 'Refund Failed';
        statusColor = 'text-rose-600';
      } else if (latestRefund.status === 'cancelled') {
        statusText = 'Refund Cancelled';
        statusColor = 'text-gray-500';
      }
    }

    const canRequestNew = remainingRefundable > 0 && !hasActiveRequest;

    return (
      <div className={`flex flex-col ${isTransactionsTab ? 'items-start' : 'items-end'} gap-1 mt-1`}>
        {statusText && (
          <span className={`text-[10px] font-bold select-none ${statusColor} px-2 py-0.5 bg-slate-50 rounded-md border border-gray-100`}>
            {statusText}
          </span>
        )}
        {canRequestNew && (
          <button
            onClick={() => {
              const topupReq = topupRequests.find(r => r.id === topupId);
              if (topupReq) {
                setSelectedTopupForRefund({
                  request: topupReq,
                  remainingRefundable,
                });
                setRefundAmount(remainingRefundable.toString());
                setIsRefundModalOpen(true);
              }
            }}
            className="text-[11px] text-[#00B4D8] hover:text-blue-800 font-bold hover:underline cursor-pointer block w-fit"
          >
            Request Refund
          </button>
        )}
        {canRequestNew && latestRefund && latestRefund.status === 'rejected' && (
          <span className={`text-[9px] text-gray-400 font-medium max-w-[150px] leading-tight ${isTransactionsTab ? 'text-left' : 'text-right'}`}>
            Previous refund request was rejected. You may submit a new request if eligible.
          </span>
        )}
        {!canRequestNew && remainingRefundable <= 0 && !latestRefund && (
          <span className="text-[10px] text-gray-400 font-semibold select-none">
            Fully Refunded
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 font-sans">
      {/* Navigation */}
      <Link
        href={`/company/${myCompany.id}`}
        className="inline-flex items-center gap-2 text-gray-500 hover:text-[#002b4e] transition-colors mb-6 text-sm font-bold"
      >
        <ArrowLeft size={16} />
        <span>Back to Company Profile</span>
      </Link>

      {pageMessage && (
        <div className={`mb-6 p-4 rounded-xl text-sm font-semibold border flex justify-between items-center ${
          pageMessage.type === 'success'
            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
            : 'bg-red-50 text-red-800 border-red-200'
        }`}>
          <span>{pageMessage.text}</span>
          <button onClick={() => setPageMessage(null)} className="text-xs font-bold hover:underline select-none cursor-pointer bg-none border-none outline-none">
            Dismiss
          </button>
        </div>
      )}

      {/* Top row: Wallet header & About MCredits side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6 items-stretch">
        {/* Left: Wallet Header Info */}
        <div className="lg:col-span-2">
          <div className="bg-white border border-gray-100 rounded-2xl p-6 lg:p-8 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 h-full">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-blue-50 text-blue-900 rounded-xl flex items-center justify-center shrink-0 border border-blue-100">
                {myCompany.logo_url ? (
                  <img src={myCompany.logo_url} alt={myCompany.name} className="w-full h-full object-cover rounded-xl" />
                ) : (
                  <Building2 size={24} />
                )}
              </div>
              <div>
                <h1 className="text-2xl font-bold text-[#0e2a4d] leading-tight">Company Wallet</h1>
                <p className="text-sm text-gray-500 mt-1 font-medium flex items-center gap-2">
                  <span>{myCompany.name}</span>
                </p>
              </div>
            </div>

            {/* Balance Card */}
            <div className="bg-slate-50 border border-slate-100 rounded-xl px-6 py-4 flex flex-col sm:items-end w-full sm:w-auto">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Current Balance</span>
              <div className="flex items-center gap-2 text-[#0e2a4d]">
                <Coins size={22} className="text-emerald-600" />
                <span className="text-3xl font-extrabold">{wallet ? Number(wallet.balance).toFixed(2) : '0.00'}</span>
                <span className="text-sm font-bold text-gray-500 mb-1">MC</span>
              </div>
              {wallet && (
                <div className="flex flex-col items-end gap-2 mt-2">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100 uppercase tracking-wider">
                    {wallet.status}
                  </span>
                  <button
                    onClick={() => { setTopupMessage(null); setIsTopupModalOpen(true); }}
                    className="mt-2 bg-[#002b4e] hover:bg-blue-800 text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors flex items-center gap-1.5"
                  >
                    <Plus size={14} />
                    <span>Request Company Top-Up</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: Info Widget */}
        <div>
          <div className="bg-[#002b4e] rounded-2xl px-6 py-5 text-white shadow-sm relative overflow-hidden h-full flex flex-col justify-center">
            {/* Decorative background element */}
            <div className="absolute -right-6 -top-6 text-blue-800/30">
              <Coins size={120} />
            </div>
            
            <div className="relative z-10">
              <h3 className="text-base font-bold mb-3 flex items-center gap-2">
                <Info size={18} className="text-blue-300" />
                <span>About MCredits</span>
              </h3>
              
              <div className="space-y-3 text-xs text-blue-100/90 leading-relaxed font-medium">
                <p>
                  Company MCredits are used for job posting and company-side platform services.
                </p>
                <p>
                  Top up your company wallet securely online via card through Stripe for instant credit.
                </p>
                <div className="pt-1 select-none">
                  <Link 
                    href="/credits" 
                    className="text-xs text-blue-300 hover:text-white underline font-bold transition-colors"
                  >
                    Learn how MCredits work →
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Second row: Full-width History Card with Tabs */}
      <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm overflow-hidden min-h-[400px] mb-8">
        {/* Tabs Header */}
        <div className="flex border-b border-gray-100 mb-6 gap-6">
          <button
            onClick={() => setActiveTab('transactions')}
            className={`pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-all ${
              activeTab === 'transactions'
                ? 'border-[#0e2a4d] text-[#0e2a4d]'
                : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            <History size={16} />
            <span>Wallet Transaction History</span>
          </button>
          <button
            onClick={() => setActiveTab('topups')}
            className={`pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-all ${
              activeTab === 'topups'
                ? 'border-[#0e2a4d] text-[#0e2a4d]'
                : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            <CreditCard size={16} />
            <span>Top-Up History</span>
          </button>
        </div>

        {/* Refund Helper Note */}
        <div className="mb-6 text-xs text-gray-500 bg-slate-50/60 p-3.5 rounded-xl border border-gray-100 flex flex-col gap-1 font-medium justify-center">
          <div className="flex items-center gap-2">
            <Info size={14} className="text-[#00B4D8] shrink-0" />
            <span>Refund requests are available for eligible unused Stripe top-ups.</span>
          </div>
          <div className="text-[10px] text-gray-400 font-medium pl-5.5">
            Top-up status and refund request status are tracked separately.
          </div>
        </div>

        {/* Tab content */}
        {activeTab === 'transactions' ? (
          <div>
            <p className="text-xs text-gray-500 font-medium mb-4">
              Wallet Transaction History shows approved credit/debit movements (actual MCredit balance changes).
            </p>

            {transactions.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-gray-100 text-gray-400 uppercase tracking-wider text-[11px] font-bold">
                      <th className="pb-3 pr-4">Date</th>
                      <th className="pb-3 px-2">Details</th>
                      <th className="pb-3 px-2 text-right">Amount</th>
                      <th className="pb-3 pl-4 text-right">Balance After</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-gray-700 font-medium">
                    {transactions.map((tx) => {
                      const isCredit = tx.direction === 'credit';
                      return (
                        <tr key={tx.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="py-4 pr-4 whitespace-nowrap text-xs text-gray-500 font-mono">
                            {new Date(tx.created_at).toLocaleDateString()}
                            <br/>
                            <span className="text-[10px] text-gray-400">{new Date(tx.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                          </td>
                          <td className="py-4 px-2">
                            <div className="flex flex-col gap-1">
                              {tx.jobDetails ? (
                                <>
                                  <span className="text-xs font-bold text-slate-800 capitalize truncate max-w-[200px]" title={`Job Posting Fee — ${tx.jobDetails.title}`}>
                                    Job Posting Fee — {tx.jobDetails.title}
                                  </span>
                                  <span className="text-[11px] text-gray-500 leading-snug max-w-xs">
                                    {(() => {
                                      const note = tx.justification_note || tx.description || '';
                                      const match = note.match(/\(([^)]+)\)/);
                                      return match ? `Posting fee: ${match[1]}` : note;
                                    })()}
                                    <span className="block text-[9px] text-gray-300 font-mono mt-0.5 truncate max-w-[150px]" title={tx.reference_id}>ID: {tx.reference_id}</span>
                                  </span>
                                </>
                              ) : tx.cancellationDetails ? (
                                <>
                                  <span className="text-xs font-bold text-slate-800" title={
                                    tx.reference_type === 'candidate_cancellation'
                                      ? `Candidate Cancellation Compensation — ${tx.cancellationDetails.candidateName || 'Unknown Candidate'}`
                                      : tx.reference_type === 'company_cancellation_refund'
                                      ? `Company Cancellation Refund — ${tx.cancellationDetails.candidateName || 'Unknown Candidate'}`
                                      : `Platform Share (Candidate Cancel) — ${tx.cancellationDetails.candidateName || 'Unknown Candidate'}`
                                  }>
                                    {tx.reference_type === 'candidate_cancellation' && (
                                      tx.cancellationDetails.candidateName
                                        ? `Candidate Cancellation Compensation — ${tx.cancellationDetails.candidateName}`
                                        : 'Candidate Cancellation Compensation'
                                    )}
                                    {tx.reference_type === 'company_cancellation_refund' && (
                                      tx.cancellationDetails.candidateName
                                        ? `Company Cancellation Refund — ${tx.cancellationDetails.candidateName}`
                                        : 'Company Cancellation Refund'
                                    )}
                                    {tx.reference_type === 'candidate_cancellation_platform' && (
                                      tx.cancellationDetails.candidateName
                                        ? `Platform Share (Candidate Cancel) — ${tx.cancellationDetails.candidateName}`
                                        : 'Platform Share (Candidate Cancel)'
                                    )}
                                  </span>
                                  <span className="text-[11px] text-gray-500 leading-snug max-w-xs">
                                    {tx.cancellationDetails.jobTitle ? (
                                      `For job: ${tx.cancellationDetails.jobTitle}`
                                    ) : (
                                      tx.justification_note || tx.description || 'No description provided'
                                    )}
                                    <span className="block text-[9px] text-gray-300 font-mono mt-0.5 truncate max-w-[150px]" title={tx.reference_id}>ID: {tx.reference_id}</span>
                                  </span>
                                </>
                              ) : (
                                <>
                                  <span className="text-xs font-bold text-slate-800 capitalize">
                                    {tx.transaction_type.replace('_', ' ')}
                                  </span>
                                  <span className="text-[11px] text-gray-500 leading-snug max-w-xs" title={tx.justification_note}>
                                    {tx.justification_note || tx.description || 'No description provided'}
                                  </span>
                                </>
                              )}
                              {(() => {
                                const isStripeTopup = tx.transaction_type === 'stripe_top_up' || 
                                  (tx.transaction_type === 'purchase_completed' && tx.reference_type === 'stripe_checkout');
                                
                                if (!isStripeTopup) return null;
                                
                                const topupReq = topupRequests.find(r => r.id === tx.reference_id);
                                if (!topupReq) return null;

                                return (
                                  <div className="mt-1">
                                    {renderRefundStatus(topupReq.id, topupReq.amount, true)}
                                  </div>
                                );
                              })()}
                            </div>
                          </td>
                          <td className="py-4 px-2 text-right whitespace-nowrap">
                            <span className={`inline-flex items-center justify-end gap-1 font-bold ${isCredit ? 'text-emerald-600' : 'text-red-600'}`}>
                              {isCredit ? '+' : '-'}{Number(tx.amount).toFixed(2)}
                            </span>
                          </td>
                          <td className="py-4 pl-4 text-right whitespace-nowrap font-bold text-[#0e2a4d]">
                            {Number(tx.balance_after).toFixed(2)} MC
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-16 text-sm text-gray-400 font-medium bg-slate-50/30 border border-dashed border-gray-200 rounded-xl">
                <FileText className="mx-auto mb-3 text-gray-300" size={32} />
                <span className="block text-gray-500 font-semibold mb-1">No wallet transactions yet.</span>
                <span className="text-xs text-gray-400">Your ledger will populate as you use MCredits.</span>
              </div>
            )}
          </div>
        ) : (
          <div>
            <p className="text-xs text-gray-500 font-medium mb-4">
              Top-Up History shows your submitted top-up records (audit log of requests).
            </p>

            {topupRequests.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-gray-100 text-gray-400 uppercase tracking-wider text-[11px] font-bold">
                      <th className="pb-3 pr-4">Date</th>
                      <th className="pb-3 px-2">Amount</th>
                      <th className="pb-3 px-2">Status</th>
                      <th className="pb-3 pl-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-gray-700 font-medium">
                    {topupRequests.map((req) => (
                      <tr key={req.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-4 pr-4 whitespace-nowrap text-xs text-gray-500 font-mono">
                          {new Date(req.created_at).toLocaleDateString()}
                        </td>
                        <td className="py-4 px-2 font-bold text-[#0e2a4d]">
                          {Number(req.amount).toFixed(2)} MC
                        </td>
                        <td className="py-4 px-2">
                          <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                            req.status === 'Approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                            req.status === 'Rejected' ? 'bg-red-50 text-red-700 border-red-200' :
                            req.status === 'Cancelled' ? 'bg-gray-50 text-gray-600 border-gray-200' :
                            'bg-blue-50 text-blue-700 border-blue-200'
                          }`}>
                            {req.status}
                          </span>
                        </td>
                        <td className="py-4 pl-4 text-xs">
                          {req.status === 'Pending' && (
                            <button
                              onClick={() => handleCancelTopup(req.id)}
                              className="text-red-500 hover:text-red-700 font-semibold mr-3"
                            >
                              Cancel
                            </button>
                          )}
                          {req.status === 'Approved' && (
                            <div className="flex flex-col items-end gap-1.5">
                              <button
                                onClick={() => {
                                  const receipt = receipts.find(r => r.topup_request_id === req.id);
                                  if (receipt) setSelectedReceipt(receipt);
                                  else alert('Receipt not generated yet.');
                                }}
                                className="text-blue-600 hover:text-blue-800 font-bold hover:underline"
                              >
                                View Receipt
                              </button>
                              {renderRefundStatus(req.id, req.amount, false)}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12 text-sm text-gray-400 font-medium bg-slate-50/30 border border-dashed border-gray-200 rounded-xl">
                <CreditCard className="mx-auto mb-3 text-gray-300" size={32} />
                <span className="block text-gray-500 font-semibold mb-1">No top-up requests found.</span>
                <span className="text-xs text-gray-400">Use the Request Company Top-Up button above to submit a request.</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Top-Up Modal */}
      {isTopupModalOpen && (
        <div className="modal-overlay-glass" onClick={() => { setIsTopupModalOpen(false); setTopupAmount(''); }}>
          <div 
            className="modal-content-standard max-w-md" 
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '448px' }}
          >
            {/* Header with Dark Navy bar */}
            <div className="modal-header-navy">
              <h2 className="modal-title-white">Buy MCredits</h2>
              <button 
                onClick={() => { setIsTopupModalOpen(false); setTopupAmount(''); }}
                className="modal-close-btn-white"
                disabled={submittingStripe}
              >
                <X size={20} />
              </button>
            </div>

            {/* Internal padded content wrapper */}
            <div className="px-5 sm:px-6 py-6 space-y-6">
              {/* Subtitle / Intro */}
              <p className="text-xs text-gray-500 leading-relaxed font-medium">
                Top up your company wallet securely via Stripe. Credits are applied automatically after payment.
              </p>

              {/* Message/Toast */}
              {topupMessage && (
                <div className={`px-4 py-3 rounded-xl text-sm font-semibold border ${
                  topupMessage.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-red-50 text-red-800 border-red-200'
                }`}>
                  {topupMessage.text}
                </div>
              )}

              {/* Tabs Header */}
              <div className="select-none">
                <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
                  <button
                    type="button"
                    onClick={() => setModalTab('package')}
                    className={`flex-1 py-2 text-xs font-bold text-center rounded-lg transition-all ${
                      modalTab === 'package'
                        ? 'bg-white text-[#0e2a4d] shadow-3xs'
                        : 'text-gray-400 hover:text-gray-600 hover:bg-slate-200/50'
                    }`}
                  >
                    Package Top-Up
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalTab('custom')}
                    className={`flex-1 py-2 text-xs font-bold text-center rounded-lg transition-all ${
                      modalTab === 'custom'
                        ? 'bg-white text-[#0e2a4d] shadow-3xs'
                        : 'text-gray-400 hover:text-gray-600 hover:bg-slate-200/50'
                    }`}
                  >
                    Custom Amount
                  </button>
                </div>
              </div>

              {/* Tab Content */}
              <div>
                {modalTab === 'package' && (
                  <div className="space-y-4">
                    <div>
                      <span className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2.5">Preset Packages</span>
                      <div className="grid grid-cols-2 gap-3">
                        {displayPackages.map((pkg) => {
                          return (
                            <button
                              key={pkg.id}
                              type="button"
                              disabled={submittingStripe}
                              onClick={() => handleStripeCheckout(pkg.usdPrice, pkg.id)}
                              className="border border-gray-200 hover:border-[#0e2a4d] hover:bg-slate-50 disabled:opacity-50 p-4 rounded-xl flex flex-col items-center justify-center transition-all cursor-pointer group"
                            >
                              <span className="text-sm font-extrabold text-[#0e2a4d]">${pkg.usdPrice} USD</span>
                              <span className="text-xs font-semibold text-emerald-600 mt-1 select-none">
                                +{pkg.mcreditAmount.toFixed(0)} MC
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {modalTab === 'custom' && (
                  <div className="space-y-4">
                    <p className="text-xs text-gray-500 leading-relaxed font-medium">
                      Enter a custom USD amount below. Paid securely online by card via Stripe and credited to your wallet automatically upon successful payment.
                    </p>
                    
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Custom Amount (USD)</label>
                        <div className="relative rounded-xl shadow-3xs">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <span className="text-gray-500 sm:text-sm">$</span>
                          </div>
                          <input
                            type="number"
                            step="0.01"
                            min="5"
                            max="10000"
                            value={topupAmount}
                            disabled={submittingStripe}
                            onChange={(e) => setTopupAmount(e.target.value)}
                            className="w-full bg-white border border-gray-200 rounded-xl pl-7 pr-3 py-2 text-sm outline-none focus:border-blue-900 font-medium"
                            placeholder="e.g. 150.00"
                          />
                        </div>
                        
                        {/* Real-time calculated MCredits preview */}
                        {topupAmount && !isNaN(Number(topupAmount)) && Number(topupAmount) > 0 && (
                          <div className="flex justify-between items-center mt-2 px-1 text-xs select-none">
                            <span className="text-gray-500 font-medium">Estimated MCredits:</span>
                            <span className="font-extrabold text-emerald-600 flex items-center gap-1">
                              <Coins size={12} />
                              <span>+{(Number(topupAmount) * mcreditsPerUsd).toFixed(2)} MC</span>
                            </span>
                          </div>
                        )}

                        {/* Validation Messages */}
                        {topupAmount !== '' && Number(topupAmount) < 5 && (
                          <p className="text-[11px] text-red-600 font-semibold mt-1.5 px-1">Minimum top-up is $5.00 USD.</p>
                        )}
                        {topupAmount !== '' && Number(topupAmount) > 10000 && (
                          <p className="text-[11px] text-red-600 font-semibold mt-1.5 px-1">Maximum top-up is $10,000.00 USD.</p>
                        )}
                        {topupAmount !== '' && Number(topupAmount) >= 5 && Number(topupAmount) <= 10000 && Number(Number(topupAmount).toFixed(2)) !== Number(topupAmount) && (
                          <p className="text-[11px] text-red-600 font-semibold mt-1.5 px-1">Maximum 2 decimal places allowed.</p>
                        )}
                      </div>

                      <button
                        type="button"
                        disabled={submittingStripe || !topupAmount || isNaN(Number(topupAmount)) || Number(topupAmount) < 5 || Number(topupAmount) > 10000 || Number(Number(topupAmount).toFixed(2)) !== Number(topupAmount)}
                        onClick={() => handleStripeCheckout(null, null, Number(topupAmount))}
                        className="w-full bg-[#0e2a4d] hover:bg-[#071c35] text-white py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-3xs disabled:bg-slate-200 disabled:text-gray-400 disabled:border-transparent"
                      >
                        {submittingStripe ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <CreditCard size={14} />
                        )}
                        <span>Checkout Custom Amount</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Terms disclaimer */}
              <div className="text-[11px] text-gray-400 text-center leading-normal mt-2 px-1 select-none font-medium">
                By purchasing MCredits, you agree to MarComn’s{' '}
                <Link href="/credits" className="text-blue-500 hover:underline font-semibold">How MCredits Work</Link>
                {' '}and{' '}
                <Link href="/legal/payments" className="text-blue-500 hover:underline font-semibold">Terms & Refund Policy</Link>.
              </div>

              {/* Footer */}
              <div className="flex justify-center pt-4 border-t border-gray-150">
                <button
                  type="button"
                  onClick={() => { setIsTopupModalOpen(false); setTopupAmount(''); }}
                  disabled={submittingStripe}
                  className="px-5 py-2 text-xs font-bold text-gray-500 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer select-none"
                >
                  Close
                </button>
              </div>
            </div>

            {submittingStripe && (
              <div className="absolute inset-0 bg-white/90 z-20 rounded-2xl flex flex-col items-center justify-center space-y-3">
                <Loader2 size={32} className="animate-spin text-[#0e2a4d]" />
                <span className="text-xs text-gray-500 font-bold">Redirecting to Stripe Checkout...</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Receipt Modal */}
      {selectedReceipt && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-xl border border-gray-100 relative">
            <button 
              onClick={() => setSelectedReceipt(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              <XCircle size={24} />
            </button>
            
            <div className="text-center mb-6 border-b border-dashed border-gray-200 pb-6">
              <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3">
                <FileText size={24} />
              </div>
              <h2 className="text-xl font-bold text-[#0e2a4d]">Payment Receipt</h2>
              <p className="text-xs text-gray-500 mt-1 font-mono">{selectedReceipt.receipt_number}</p>
            </div>
            
            <div className="space-y-4 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Date</span>
                <span className="font-bold text-gray-800">{new Date(selectedReceipt.issued_at).toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Issued To</span>
                <span className="font-bold text-gray-800">{selectedReceipt.issued_to_company_name || selectedReceipt.issued_to_name}</span>
              </div>
              {selectedReceipt.issued_to_email && (
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Email</span>
                  <span className="font-bold text-gray-800">{selectedReceipt.issued_to_email}</span>
                </div>
              )}
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Payment Method</span>
                <span className="font-bold text-gray-800 uppercase text-xs">{selectedReceipt.payment_method === 'dummy_manual' ? 'Internal Record' : selectedReceipt.payment_method.replace('_', ' ')}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Status</span>
                <span className="font-bold text-emerald-600 uppercase text-xs tracking-wider">{selectedReceipt.status}</span>
              </div>
            </div>
            
            <div className="mt-6 pt-6 border-t border-dashed border-gray-200 flex justify-between items-end">
              <span className="text-gray-500 font-bold">Total Amount</span>
              <div className="text-right">
                <span className="text-2xl font-extrabold text-[#0e2a4d]">{Number(selectedReceipt.amount).toFixed(2)}</span>
                <span className="text-sm text-gray-500 font-bold ml-1">MC</span>
              </div>
            </div>
            
            <div className="mt-8 text-center">
              <p className="text-[10px] text-gray-400 bg-gray-50 p-2 rounded-lg inline-block">
                PDF download functionality is planned for a future update.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Refund Modal */}
      {isRefundModalOpen && selectedTopupForRefund && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4" onClick={() => { if (!submittingRefund) setIsRefundModalOpen(false); }}>
          <div 
            className="bg-white rounded-2xl w-full max-w-lg shadow-xl border border-gray-100 relative overflow-hidden" 
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="bg-[#0e2a4d] px-6 py-4 flex justify-between items-center text-white">
              <h2 className="text-base font-bold">Request MCredit Refund</h2>
              <button 
                disabled={submittingRefund}
                onClick={() => setIsRefundModalOpen(false)}
                className="text-white/85 hover:text-white disabled:opacity-50"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleRefundSubmit} className="p-6 space-y-5">
              {/* Messages */}
              {refundSuccessMessage && (
                <div className="p-3 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-semibold animate-fadeIn">
                  {refundSuccessMessage}
                </div>
              )}
              {refundErrorMessage && (
                <div className="p-3 bg-red-50 text-red-800 border border-red-200 rounded-xl text-xs font-semibold animate-fadeIn">
                  {refundErrorMessage}
                </div>
              )}

              {/* Details info */}
              <div className="bg-slate-50 rounded-xl p-4 space-y-2 text-xs font-medium text-gray-600">
                <div className="flex justify-between">
                  <span>Original Purchase:</span>
                  <span className="font-bold text-gray-800">
                    +{Number(selectedTopupForRefund.request.amount).toFixed(2)} MC
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Current Wallet Balance:</span>
                  <span className="font-bold text-gray-800">
                    {wallet ? Number(wallet.balance).toFixed(2) : '0.00'} MC
                  </span>
                </div>
                <div className="flex justify-between text-emerald-700">
                  <span>Max Refundable remaining:</span>
                  <span className="font-bold">
                    {Number(selectedTopupForRefund.remainingRefundable).toFixed(2)} MC
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Refund Method:</span>
                  <span className="font-bold text-gray-800">Original Stripe payment method</span>
                </div>
              </div>

              {/* Amount input */}
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                  Refund Amount (MCredits)
                </label>
                <input 
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={selectedTopupForRefund.remainingRefundable}
                  required
                  disabled={submittingRefund}
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs text-gray-700 font-bold outline-none focus:border-blue-900 transition-colors"
                />
              </div>

              {/* Reason dropdown */}
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                  Reason for Refund
                </label>
                <select
                  required
                  disabled={submittingRefund}
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-xs text-gray-700 font-bold outline-none focus:border-blue-900 transition-colors"
                >
                  <option value="unused_credits">Unused Credits</option>
                  <option value="duplicate_payment">Duplicate Payment</option>
                  <option value="technical_payment_issue">Technical Payment Issue</option>
                  <option value="incorrect_crediting">Incorrect Crediting</option>
                  <option value="unauthorized_charge_concern">Unauthorized Charge Concern</option>
                  <option value="other">Other</option>
                </select>
              </div>

              {/* Optional note */}
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                  Additional Notes (Optional)
                </label>
                <textarea 
                  disabled={submittingRefund}
                  value={refundNote}
                  onChange={(e) => setRefundNote(e.target.value)}
                  rows={3}
                  className="w-full bg-white border border-gray-200 rounded-xl px-3.5 py-2 text-xs text-gray-700 outline-none focus:border-blue-900 transition-colors resize-none"
                  placeholder="Provide any additional details for review..."
                />
              </div>

              {/* Policy Wording */}
              <div className="bg-amber-50/50 border border-amber-100 rounded-xl p-3.5 text-[10px] text-amber-800 leading-relaxed font-medium">
                <p className="font-bold mb-1">MCredit Refund Policy:</p>
                <p className="mb-1">
                  MCredit purchases may be eligible for refund only for unused MCredit balance. Once MCredits have been used for job posting, job acceptance, platform services, fees, or completed transactions, those used credits are considered consumed and are non-refundable.
                </p>
                <p>
                  Approved refunds are processed back to the original Stripe payment method whenever possible. MarComn does not collect bank details for normal Stripe refunds. The refundable amount must not exceed the user’s current available unused MCredit balance.
                </p>
              </div>

              {/* Actions */}
              <div className="flex gap-3 justify-end pt-2">
                <button
                   type="button"
                   disabled={submittingRefund}
                   onClick={() => setIsRefundModalOpen(false)}
                   className="px-4 py-2.5 bg-slate-50 hover:bg-slate-100 text-gray-600 text-xs font-bold rounded-xl transition-colors cursor-pointer border border-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingRefund || !refundAmount || Number(refundAmount) <= 0}
                  className="px-6 py-2.5 bg-[#00B4D8] hover:bg-cyan-600 text-[#0e2a4d] text-xs font-bold rounded-xl transition-colors cursor-pointer shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                >
                  {submittingRefund ? (
                    <>
                      <Loader2 size={12} className="animate-spin" />
                      <span>Submitting...</span>
                    </>
                  ) : (
                    <span>Submit Refund Request</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
