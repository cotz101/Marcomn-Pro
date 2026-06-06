'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { useProfile } from '@/app/context/ProfileContext';
import { 
  ArrowLeft, 
  Loader2, 
  ShieldAlert, 
  ShieldCheck, 
  Coins, 
  Plus, 
  Minus, 
  FileText, 
  History, 
  TrendingUp, 
  TrendingDown, 
  Settings,
  CreditCard,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { 
  getPendingTopupRequests, 
  approveTopupRequest, 
  rejectTopupRequest 
} from '@/app/actions/mcreditTopups';
import { 
  getUserWallet, 
  getCompanyWallet, 
  grantCredits, 
  deductCredits
} from '@/app/actions/mcredits';

export default function AdminMCreditsPage() {
  const router = useRouter();
  const { profile, userId, showToast } = useProfile();
  const supabase = createClient();

  const isAuthorized = profile && ['super_admin', 'admin', 'brand_manager'].includes(profile.global_role);

  // Lists
  const [profilesList, setProfilesList] = useState([]);
  const [companiesList, setCompaniesList] = useState([]);
  
  // Selection
  const [ownerType, setOwnerType] = useState('user'); // user, company, platform
  const [selectedOwnerId, setSelectedOwnerId] = useState('');
  const [selectedWallet, setSelectedWallet] = useState(null);
  const [loadingWallet, setLoadingWallet] = useState(false);
  const [transactions, setTransactions] = useState([]);
  
  // Form fields
  const [adjustType, setAdjustType] = useState('credit'); // credit, debit
  const [amount, setAmount] = useState('');
  const [justification, setJustification] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Settings state
  const [postingFeePercent, setPostingFeePercent] = useState('1');
  const [acceptanceFeePercent, setAcceptanceFeePercent] = useState('5');
  const [offerExpiryOptions, setOfferExpiryOptions] = useState('24, 48, 72');
  const [defaultOfferExpiry, setDefaultOfferExpiry] = useState('48');
  const [savingSettings, setSavingSettings] = useState(false);

  // Calculations test fields
  const [testSalary, setTestSalary] = useState('100000');
  const [companyFeePreview, setCompanyFeePreview] = useState(0);
  const [candidateFeePreview, setCandidateFeePreview] = useState(0);

  // Top-Up Admin State
  const [pendingTopups, setPendingTopups] = useState([]);
  const [actionTopupId, setActionTopupId] = useState(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [isApproveModalOpen, setIsApproveModalOpen] = useState(false);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [actionSubmitting, setActionSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState('fees'); // 'fees', 'ledger', 'topups'

  // Fetch initial option lists and settings
  useEffect(() => {
    if (!isAuthorized) return;

    async function loadInitialData() {
      try {
        // Fetch profiles
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, name, username')
          .order('name');
        setProfilesList(profiles || []);

        // Fetch companies
        const { data: companies } = await supabase
          .from('companies')
          .select('id, name')
          .order('name');
        setCompaniesList(companies || []);

        // Fetch settings
        const { data: settings } = await supabase
          .from('platform_settings')
          .select('key, value');
        
        if (settings) {
          const postFee = settings.find(s => s.key === 'company_job_posting_fee_percent');
          const accFee = settings.find(s => s.key === 'candidate_acceptance_fee_percent');
          const expiryOpts = settings.find(s => s.key === 'job_offer_expiry_options_hours');
          const defaultExpiry = settings.find(s => s.key === 'default_job_offer_expiry_hours');

          if (postFee) setPostingFeePercent(postFee.value);
          if (accFee) setAcceptanceFeePercent(accFee.value);
          if (expiryOpts) setOfferExpiryOptions(expiryOpts.value);
          if (defaultExpiry) setDefaultOfferExpiry(defaultExpiry.value);
        }

        // Fetch pending topups
        const topups = await getPendingTopupRequests();
        setPendingTopups(topups || []);
      } catch (err) {
        console.error('Error loading admin lists:', err);
      }
    }

    loadInitialData();
  }, [isAuthorized, supabase]);

  // Handle preview calculations
  useEffect(() => {
    const salary = Number(testSalary || 0);
    const postPct = Number(postingFeePercent || 0);
    const accPct = Number(acceptanceFeePercent || 0);
    setCompanyFeePreview(Number((salary * postPct / 100).toFixed(2)));
    setCandidateFeePreview(Number((salary * accPct / 100).toFixed(2)));
  }, [testSalary, postingFeePercent, acceptanceFeePercent]);

  // Load wallet for selected owner
  const loadWallet = useCallback(async () => {
    if (ownerType !== 'platform' && !selectedOwnerId) {
      setSelectedWallet(null);
      setTransactions([]);
      return;
    }

    setLoadingWallet(true);
    try {
      let wallet = null;

      if (ownerType === 'platform') {
        const { data } = await supabase
          .from('mcredit_wallets')
          .select('*')
          .eq('owner_type', 'platform')
          .single();
        wallet = data;
      } else if (ownerType === 'user') {
        wallet = await getUserWallet(selectedOwnerId);
      } else if (ownerType === 'company') {
        wallet = await getCompanyWallet(selectedOwnerId);
      }

      setSelectedWallet(wallet);

      // Load transaction history
      if (wallet) {
        const { data: txsData, error: txsError } = await supabase
          .from('mcredit_transactions')
          .select('*')
          .eq('wallet_id', wallet.id)
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
          return enriched;
        });

        setTransactions(enrichedTxs);
      }
    } catch (err) {
      console.error('Error loading wallet details:', err);
      showToast('Error loading wallet details', 'error');
    } finally {
      setLoadingWallet(false);
    }
  }, [ownerType, selectedOwnerId, supabase, showToast]);

  useEffect(() => {
    loadWallet();
  }, [loadWallet]);

  // Save Settings Changes
  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      const { error: postErr } = await supabase
        .from('platform_settings')
        .upsert({
          key: 'company_job_posting_fee_percent',
          value: postingFeePercent.toString(),
          updated_by: userId,
          updated_at: new Date().toISOString()
        });

      const { error: accErr } = await supabase
        .from('platform_settings')
        .upsert({
          key: 'candidate_acceptance_fee_percent',
          value: acceptanceFeePercent.toString(),
          updated_by: userId,
          updated_at: new Date().toISOString()
        });

      const { error: optsErr } = await supabase
        .from('platform_settings')
        .upsert({
          key: 'job_offer_expiry_options_hours',
          value: offerExpiryOptions.toString(),
          updated_by: userId,
          updated_at: new Date().toISOString()
        });

      const { error: defErr } = await supabase
        .from('platform_settings')
        .upsert({
          key: 'default_job_offer_expiry_hours',
          value: defaultOfferExpiry.toString(),
          updated_by: userId,
          updated_at: new Date().toISOString()
        });

      if (postErr || accErr || optsErr || defErr) throw (postErr || accErr || optsErr || defErr);

      showToast('Platform fee configuration updated successfully!', 'success');
    } catch (err) {
      console.error('Error saving settings:', err);
      showToast(err.message || 'Failed to update settings', 'error');
    } finally {
      setSavingSettings(false);
    }
  };

  // Perform Grant/Deduct
  const handleAdjustmentSubmit = async (e) => {
    e.preventDefault();
    if (!selectedWallet) return;
    if (!amount || Number(amount) <= 0) {
      showToast('Please enter a positive numeric amount', 'error');
      return;
    }
    if (!justification || !justification.trim()) {
      showToast('Justification note is required for manual adjustments', 'error');
      return;
    }

    setSubmitting(true);
    try {
      if (adjustType === 'credit') {
        await grantCredits(selectedWallet.id, Number(amount), justification, userId);
        showToast(`Granted ${amount} MCredits successfully!`, 'success');
      } else {
        await deductCredits(selectedWallet.id, Number(amount), justification, userId);
        showToast(`Deducted ${amount} MCredits successfully!`, 'success');
      }
      
      // Reset form
      setAmount('');
      setJustification('');
      
      // Reload wallet details and transactions
      await loadWallet();
    } catch (err) {
      console.error('Adjustment failed:', err);
      showToast(err.message || 'Transaction failed. Check balance.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleApproveTopup = async (e) => {
    e.preventDefault();
    if (!actionTopupId) return;
    setActionSubmitting(true);
    try {
      const res = await approveTopupRequest(actionTopupId, adminNotes);
      if (!res.success) throw new Error(res.error);
      showToast('Top-up request approved and wallet credited.', 'success');
      setIsApproveModalOpen(false);
      setAdminNotes('');
      const topups = await getPendingTopupRequests();
      setPendingTopups(topups || []);
      // If the currently viewed wallet matches the topup, refresh it
      await loadWallet();
    } catch (err) {
      console.error('Approve failed:', err);
      showToast(err.message || 'Failed to approve top-up', 'error');
    } finally {
      setActionSubmitting(false);
    }
  };

  const handleRejectTopup = async (e) => {
    e.preventDefault();
    if (!actionTopupId) return;
    setActionSubmitting(true);
    try {
      const res = await rejectTopupRequest(actionTopupId, adminNotes);
      if (!res.success) throw new Error(res.error);
      showToast('Top-up request rejected.', 'success');
      setIsRejectModalOpen(false);
      setAdminNotes('');
      const topups = await getPendingTopupRequests();
      setPendingTopups(topups || []);
    } catch (err) {
      console.error('Reject failed:', err);
      showToast(err.message || 'Failed to reject top-up', 'error');
    } finally {
      setActionSubmitting(false);
    }
  };

  // Auth check render
  if (!profile) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 flex flex-col items-center justify-center space-y-4">
        <Loader2 size={36} className="animate-spin text-blue-900" />
        <span className="text-sm text-gray-500 font-semibold">Validating session permissions...</span>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center font-sans">
        <div className="bg-white border border-gray-100 rounded-3xl p-8 shadow-md flex flex-col items-center space-y-6">
          <div className="p-4 bg-red-50 text-red-600 rounded-full">
            <ShieldAlert size={48} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Access Denied</h1>
            <p className="text-sm text-gray-500 mt-2">
              You do not have the required administrative permissions to access the MCredits Platform Ledger.
            </p>
          </div>
          <button
            onClick={() => router.push('/')}
            className="w-full bg-[#002b4e] hover:bg-[#001c33] text-white text-sm font-bold py-3 rounded-xl transition-all shadow-sm cursor-pointer"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1280px] mx-auto px-4 py-8 font-sans w-full">
      {/* Navigation */}
      <button
        onClick={() => router.push('/profile')}
        className="flex items-center gap-2 text-gray-500 hover:text-[#002b4e] transition-colors mb-6 text-sm font-bold cursor-pointer bg-none border-none outline-none"
      >
        <ArrowLeft size={16} />
        <span>Back to Profile</span>
      </button>

      {/* Main Grid: Responsive layout (stacked on mobile, side-by-side on desktop) */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-6 lg:gap-7 items-start mb-8">
        
        {/* Header Info (Left Column Row 1) */}
        <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 lg:col-start-1 lg:row-start-1">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-blue-50 text-blue-950 rounded-xl flex items-center justify-center shrink-0">
              <Coins size={24} className="text-blue-900" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-[#0e2a4d] leading-tight">MCredits Stage 1 Platform Ledger</h1>
              <p className="text-sm text-gray-500 mt-1 font-medium">
                Grant or deduct credits for user applicants and company profiles, view transaction history, and configure dynamic percentage fees.
              </p>
            </div>
          </div>
          <div className="shrink-0">
            <button
              onClick={() => router.push('/admin/finance')}
              className="border border-[#002b4e] text-[#002b4e] hover:bg-slate-50 text-xs font-bold py-2.5 px-4 rounded-xl transition-all select-none cursor-pointer whitespace-nowrap"
            >
              Open Finance Dashboard
            </button>
          </div>
        </div>

        {/* Top-Up Queue Widget (Right Column Rows 1-3, stacks below header on mobile) */}
        <div className="lg:col-start-2 lg:row-start-1 lg:row-span-3 lg:sticky lg:top-24 w-full space-y-6">
          <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <CreditCard size={18} className="text-[#0e2a4d]" />
                <h2 className="text-sm font-bold text-[#0e2a4d]">Top-Up Queue</h2>
              </div>
              {pendingTopups.length > 0 && (
                <span className="bg-amber-50 border border-amber-100 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {pendingTopups.length} Pending
                </span>
              )}
            </div>

            {pendingTopups.length > 0 ? (
              <div className="space-y-3 flex-1">
                {pendingTopups.slice(0, 3).map((req) => (
                  <div key={req.id} className="p-3 bg-slate-50/50 border border-gray-100 rounded-xl flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      {req.owner_type === 'company' ? (
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-md bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0 overflow-hidden text-[10px] font-bold text-blue-600">
                            {req.company_logo_url ? (
                              <img src={req.company_logo_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              (req.company_name || 'C').charAt(0).toUpperCase()
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold text-[#0e2a4d] truncate">{req.company_name || 'Company'}</p>
                            <p className="text-[9px] text-gray-400 truncate">By {req.requester_name || 'User'}</p>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0 overflow-hidden text-[10px] font-bold text-slate-500">
                            {req.requester_avatar_url ? (
                              <img src={req.requester_avatar_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              (req.requester_name || 'U').charAt(0).toUpperCase()
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold text-[#0e2a4d] truncate">{req.requester_name || 'User'}</p>
                            <p className="text-[9px] text-gray-400">Personal Account</p>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-bold text-[#0e2a4d]">{Number(req.amount).toFixed(2)} MC</p>
                      <span className="inline-block text-[8px] font-bold bg-amber-50 text-amber-700 px-1.5 py-0.2 rounded-md mt-0.5">
                        Pending
                      </span>
                    </div>
                  </div>
                ))}
                {pendingTopups.length > 3 && (
                  <p className="text-[10px] text-gray-400 text-center mt-1 font-medium">
                    + {pendingTopups.length - 3} more pending requests
                  </p>
                )}
                <button
                  onClick={() => setActiveTab('topups')}
                  className="w-full mt-3 bg-blue-50 hover:bg-blue-100 text-[#002b4e] text-xs font-bold py-2.5 rounded-xl transition-all text-center select-none cursor-pointer"
                >
                  Manage Top-Up Queue
                </button>
              </div>
            ) : (
              <div className="text-center py-8 text-xs text-gray-400 font-medium border border-dashed border-gray-150 rounded-xl bg-slate-50/20">
                <span>No pending top-up requests.</span>
              </div>
            )}
          </div>
        </div>

        {/* Top-level Tabs (Left Column Row 2) */}
        <div className="flex border-b border-gray-200 gap-2 md:gap-6 overflow-x-auto md:overflow-x-visible pb-px w-full lg:col-start-1 lg:row-start-2 mt-4 lg:mt-0">
          <button
            onClick={() => setActiveTab('fees')}
            className={`pb-3 text-xs md:text-sm font-bold transition-all border-b-2 outline-none focus:outline-none whitespace-nowrap cursor-pointer flex-shrink-0 md:flex-1 text-center ${
              activeTab === 'fees'
                ? 'border-[#002b4e] text-[#002b4e]'
                : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            Platform Fee Configuration
          </button>
          <button
            onClick={() => setActiveTab('ledger')}
            className={`pb-3 text-xs md:text-sm font-bold transition-all border-b-2 outline-none focus:outline-none whitespace-nowrap cursor-pointer flex-shrink-0 md:flex-1 text-center ${
              activeTab === 'ledger'
                ? 'border-[#002b4e] text-[#002b4e]'
                : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            Wallet & Ledger Adjustment
          </button>
          <button
            onClick={() => setActiveTab('topups')}
            className={`pb-3 text-xs md:text-sm font-bold transition-all border-b-2 outline-none focus:outline-none whitespace-nowrap cursor-pointer flex-shrink-0 md:flex-1 text-center flex items-center justify-center gap-1.5 ${
              activeTab === 'topups'
                ? 'border-[#002b4e] text-[#002b4e]'
                : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            <span>Pending Top-Up Requests</span>
            {pendingTopups.length > 0 && (
              <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {pendingTopups.length}
              </span>
            )}
          </button>
        </div>

        {/* Active Tab Content (Left Column Row 3) */}
        <div className="lg:col-start-1 lg:row-start-3 mt-6 w-full">
          {/* TAB 1: Platform Fee Configuration */}
          {activeTab === 'fees' && (
            <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm space-y-6 animate-fadeIn">
              <div className="flex items-center gap-2 mb-2">
                <Settings size={18} className="text-[#0e2a4d]" />
                <h2 className="text-base font-bold text-[#0e2a4d]">Platform Fee Configuration</h2>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">Company Posting Fee (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={postingFeePercent}
                    onChange={(e) => setPostingFeePercent(e.target.value)}
                    className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 outline-none focus:border-blue-900 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">Candidate Acceptance Fee (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={acceptanceFeePercent}
                    onChange={(e) => setAcceptanceFeePercent(e.target.value)}
                    className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 outline-none focus:border-blue-900 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">Offer Expiry Options (Hours)</label>
                  <input
                    type="text"
                    placeholder="e.g. 24, 48, 72"
                    value={offerExpiryOptions}
                    onChange={(e) => setOfferExpiryOptions(e.target.value)}
                    className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 outline-none focus:border-blue-900 transition-colors"
                  />
                  <p className="text-[10px] text-gray-500 mt-1 font-medium">Comma separated list of hours.</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">Default Offer Expiry (Hours)</label>
                  <input
                    type="number"
                    min="1"
                    value={defaultOfferExpiry}
                    onChange={(e) => setDefaultOfferExpiry(e.target.value)}
                    className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 outline-none focus:border-blue-900 transition-colors"
                  />
                </div>
              </div>

              <div className="bg-slate-50/50 border border-gray-100 rounded-xl p-4 mt-6">
                <span className="block text-xs font-bold text-gray-700 mb-2">Dynamic Fee Preview (Salary calculation test)</span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Salary Input</label>
                    <input
                      type="number"
                      value={testSalary}
                      onChange={(e) => setTestSalary(e.target.value)}
                      className="w-full bg-white border border-gray-200 rounded-lg px-2 py-1 text-xs text-gray-700 outline-none"
                    />
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold text-gray-400 uppercase">Posting Fee (Company)</span>
                    <span className="text-xs font-bold text-[#0e2a4d]">{companyFeePreview.toFixed(2)} MC</span>
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold text-gray-400 uppercase">Acceptance Fee (Candidate)</span>
                    <span className="text-xs font-bold text-[#0e2a4d]">{candidateFeePreview.toFixed(2)} MC</span>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  type="button"
                  onClick={handleSaveSettings}
                  disabled={savingSettings}
                  className="bg-[#002b4e] hover:bg-[#001c33] disabled:bg-slate-300 text-white font-bold text-xs py-2.5 px-6 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 select-none"
                >
                  {savingSettings && <Loader2 size={14} className="animate-spin" />}
                  <span>Save Settings Configuration</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: Wallet & Ledger Adjustment */}
          {activeTab === 'ledger' && (
            <div className="space-y-6 animate-fadeIn">
              
              {/* Stack Selector and Action Side-by-side */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Select Wallet block */}
                <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
                  <div>
                    <h2 className="text-base font-bold text-[#0e2a4d] mb-4">Select Wallet</h2>
                    
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">Owner Type</label>
                        <select
                          value={ownerType}
                          onChange={(e) => {
                            setOwnerType(e.target.value);
                            setSelectedOwnerId('');
                            setSelectedWallet(null);
                            setTransactions([]);
                          }}
                          className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 outline-none focus:border-blue-900 transition-colors"
                        >
                          <option value="user">Personal / User Wallet</option>
                          <option value="company">Company Wallet</option>
                          <option value="platform">MarComn Platform Wallet</option>
                        </select>
                      </div>

                      {ownerType !== 'platform' && (
                        <div>
                          <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">
                            {ownerType === 'user' ? 'Select User Account' : 'Select Company'}
                          </label>
                          <select
                            value={selectedOwnerId}
                            onChange={(e) => setSelectedOwnerId(e.target.value)}
                            className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 outline-none focus:border-blue-900 transition-colors"
                          >
                            <option value="">-- Choose Option --</option>
                            {ownerType === 'user' 
                              ? profilesList.map(p => (
                                  <option key={p.id} value={p.id}>{p.name} (@{p.username || 'unknown'})</option>
                                ))
                              : companiesList.map(c => (
                                  <option key={c.id} value={c.id}>{c.name}</option>
                                ))
                            }
                          </select>
                        </div>
                      )}
                    </div>
                  </div>

                  {loadingWallet ? (
                    <div className="flex items-center justify-center py-8 space-x-2 text-gray-400">
                      <Loader2 size={20} className="animate-spin text-blue-900" />
                      <span className="text-sm font-semibold">Retrieving wallet data...</span>
                    </div>
                  ) : selectedWallet ? (
                    <div className="bg-slate-50/50 border border-gray-100 rounded-xl p-4 mt-6 space-y-2">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-gray-400 font-bold uppercase tracking-wider">Wallet ID</span>
                        <span className="font-mono text-gray-600 truncate max-w-[140px]" title={selectedWallet.id}>{selectedWallet.id}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-gray-400 font-bold uppercase tracking-wider">Status</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100 capitalize">
                          {selectedWallet.status}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-xs pt-2 border-t border-gray-200">
                        <span className="text-gray-400 font-bold uppercase tracking-wider">Current Balance</span>
                        <span className="text-sm font-extrabold text-[#0e2a4d]">{Number(selectedWallet.balance).toFixed(2)} MC</span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-6 text-sm text-gray-400 font-medium mt-6">
                      {ownerType === 'platform' ? 'Click selection to load' : 'Select owner to check balance.'}
                    </div>
                  )}
                </div>

                {/* Ledger Adjustment Actions block */}
                <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
                  <h2 className="text-base font-bold text-[#0e2a4d] mb-4">Ledger Adjustment</h2>

                  <form onSubmit={handleAdjustmentSubmit} className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">Adjustment Type</label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setAdjustType('credit')}
                          className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer select-none ${
                            adjustType === 'credit'
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-700 shadow-3xs'
                              : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                          }`}
                        >
                          <Plus size={14} />
                          <span>Grant (Credit)</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setAdjustType('debit')}
                          className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer select-none ${
                            adjustType === 'debit'
                              ? 'bg-red-50 border-red-200 text-red-700 shadow-3xs'
                              : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                          }`}
                        >
                          <Minus size={14} />
                          <span>Deduct (Debit)</span>
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">Amount (MCredits)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        required
                        placeholder="0.00"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 outline-none focus:border-blue-900 transition-colors"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">Justification Note</label>
                      <textarea
                        required
                        rows={2}
                        placeholder="Reason for adjustment..."
                        value={justification}
                        onChange={(e) => setJustification(e.target.value)}
                        className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 outline-none focus:border-blue-900 transition-colors resize-none"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={submitting || !selectedWallet}
                      className="w-full bg-[#002b4e] hover:bg-[#001c33] disabled:bg-slate-300 disabled:text-gray-400 text-white font-bold text-xs py-2.5 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 select-none shadow-sm"
                    >
                      {submitting && <Loader2 size={14} className="animate-spin" />}
                      <span>Apply Wallet Change</span>
                    </button>
                  </form>
                </div>
              </div>

              {/* Wallet Transaction Audit Trail under adjusts */}
              <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm overflow-hidden">
                <div className="flex items-center gap-2 mb-6">
                  <History size={18} className="text-[#0e2a4d]" />
                  <h2 className="text-base font-bold text-[#0e2a4d]">Wallet Transaction Audit Trail</h2>
                </div>

                {transactions.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-gray-100 text-gray-400 uppercase tracking-wider font-bold">
                          <th className="pb-3 font-semibold">Date</th>
                          <th className="pb-3 font-semibold">Type</th>
                          <th className="pb-3 font-semibold">Direction</th>
                          <th className="pb-3 font-semibold text-right">Amount</th>
                          <th className="pb-3 font-semibold text-right">Before</th>
                          <th className="pb-3 font-semibold text-right">After</th>
                          <th className="pb-3 font-semibold pl-4">Justification Note</th>
                          <th className="pb-3 font-semibold">Performed By</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 text-gray-600 font-medium">
                        {transactions.map((tx) => {
                          const isCredit = tx.direction === 'credit';
                          return (
                            <tr key={tx.id} className="hover:bg-slate-50/30">
                              <td className="py-3 whitespace-nowrap text-gray-500 font-mono">
                                {new Date(tx.created_at).toLocaleString()}
                              </td>
                              <td className="py-3 capitalize whitespace-nowrap">
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-50 border border-gray-100 text-slate-700">
                                  {tx.transaction_type.replace('_', ' ')}
                                </span>
                              </td>
                              <td className="py-3 whitespace-nowrap">
                                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  isCredit 
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' 
                                    : 'bg-red-50 text-red-700 border border-red-100'
                                }`}>
                                  {isCredit ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                                  <span className="capitalize">{tx.direction}</span>
                                </span>
                              </td>
                              <td className={`py-3 text-right font-bold ${isCredit ? 'text-emerald-700' : 'text-red-700'}`}>
                                {isCredit ? '+' : '-'}{Number(tx.amount).toFixed(2)} MC
                              </td>
                              <td className="py-3 text-right font-mono text-gray-500">{Number(tx.balance_before).toFixed(2)} MC</td>
                              <td className="py-3 text-right font-bold font-mono text-slate-800">{Number(tx.balance_after).toFixed(2)} MC</td>
                              <td className="py-3 pl-4 max-w-xs text-gray-500 font-medium" title={
                                tx.cancellationDetails 
                                  ? `${tx.justification_note || tx.description || ''} (Job: ${tx.cancellationDetails.jobTitle || ''}, Candidate: ${tx.cancellationDetails.candidateName || ''})`
                                  : tx.jobDetails
                                  ? `${tx.justification_note || tx.description || ''} (Job: ${tx.jobDetails.title})`
                                  : tx.justification_note || tx.description || ''
                              }>
                                {tx.cancellationDetails ? (
                                  <div className="flex flex-col">
                                    <span className="truncate block">
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
                                    {tx.cancellationDetails.jobTitle && (
                                      <span className="text-[10px] text-gray-400 block mt-0.5 truncate">
                                        Job: {tx.cancellationDetails.jobTitle}
                                      </span>
                                    )}
                                  </div>
                                ) : tx.jobDetails ? (
                                  <div className="flex flex-col">
                                    <span className="truncate block">Job Posting Fee: {tx.jobDetails.title}</span>
                                    <span className="text-[10px] text-gray-400 block mt-0.5 truncate">
                                      {(() => {
                                        const note = tx.justification_note || tx.description || '';
                                        const match = note.match(/\(([^)]+)\)/);
                                        return match ? `Posting fee: ${match[1]}` : note;
                                      })()}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="truncate block">{tx.justification_note || tx.description || '-'}</span>
                                )}
                              </td>
                              <td className="py-3 whitespace-nowrap font-semibold text-[#0e2a4d]">
                                {tx.created_by ? (
                                  <div title={tx.created_by}>
                                    <span>Admin action</span>
                                    <span className="block text-[10px] text-gray-400 font-mono mt-0.5">
                                      {tx.created_by.substring(0, 8)}...
                                    </span>
                                  </div>
                                ) : (
                                  'System / Automated'
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-12 text-sm text-gray-400 font-medium bg-slate-50/20 border border-dashed border-gray-150 rounded-xl">
                    <FileText className="mx-auto mb-2 text-gray-300" size={32} />
                    <span>No transactions found for this wallet.</span>
                  </div>
                )}
              </div>

            </div>
          )}

          {/* TAB 3: Pending Top-Up Requests */}
          {activeTab === 'topups' && (
            <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm overflow-hidden animate-fadeIn">
              <div className="flex flex-col gap-1 mb-6">
                <div className="flex items-center gap-2">
                  <CreditCard size={18} className="text-[#0e2a4d]" />
                  <h2 className="text-base font-bold text-[#0e2a4d]">Pending Top-Up Requests</h2>
                </div>
                <p className="text-xs text-gray-500 font-medium ml-6">
                  Pending Top-Up Requests require admin review.
                </p>
              </div>

              {pendingTopups.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-gray-100 text-gray-400 uppercase tracking-wider font-bold">
                        <th className="pb-3 pr-4 font-semibold">Date</th>
                        <th className="pb-3 font-semibold">Identity</th>
                        <th className="pb-3 font-semibold text-right">Amount</th>
                        <th className="pb-3 pl-4 font-semibold">Remarks</th>
                        <th className="pb-3 font-semibold text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-gray-600 font-medium">
                      {pendingTopups.map((req) => (
                        <tr key={req.id} className="hover:bg-slate-50/30">
                          <td className="py-3 pr-4 whitespace-nowrap text-gray-500 font-mono">
                            {new Date(req.created_at).toLocaleString()}
                          </td>
                          <td className="py-3">
                            {req.owner_type === 'company' ? (
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0 overflow-hidden">
                                  {req.company_logo_url ? (
                                    <img src={req.company_logo_url} alt={req.company_name} className="w-full h-full object-cover" />
                                  ) : (
                                    <span className="text-blue-600 font-bold text-xs">
                                      {(req.company_name || 'C').charAt(0).toUpperCase()}
                                    </span>
                                  )}
                                </div>
                                <div className="flex flex-col">
                                  <span className="font-bold text-[#0e2a4d] text-xs">{req.company_name || 'Unknown Company'}</span>
                                  <span className="text-[10px] text-gray-400 font-normal mt-0.5">
                                    Requested by: {req.requester_name || 'Unknown'}
                                  </span>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0 overflow-hidden">
                                  {req.requester_avatar_url ? (
                                    <img src={req.requester_avatar_url} alt={req.requester_name} className="w-full h-full object-cover" />
                                  ) : (
                                    <span className="text-slate-500 font-bold text-xs">
                                      {(req.requester_name || 'U').charAt(0).toUpperCase()}
                                    </span>
                                  )}
                                </div>
                                <span className="font-bold text-[#0e2a4d] text-xs">{req.requester_name || 'Unknown'}</span>
                              </div>
                            )}
                          </td>
                          <td className="py-3 text-right font-bold text-[#0e2a4d] whitespace-nowrap">
                            {Number(req.amount).toFixed(2)} MC
                          </td>
                          <td className="py-3 pl-4 max-w-xs text-gray-500 truncate" title={req.remarks}>
                            {req.remarks || '—'}
                          </td>
                          <td className="py-3 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => {
                                  setActionTopupId(req.id);
                                  setIsApproveModalOpen(true);
                                }}
                                className="text-emerald-600 hover:text-emerald-800 p-1 bg-emerald-50 hover:bg-emerald-100 rounded transition-colors"
                                title="Approve Request"
                              >
                                <CheckCircle size={16} />
                              </button>
                              <button
                                onClick={() => {
                                  setActionTopupId(req.id);
                                  setIsRejectModalOpen(true);
                                }}
                                className="text-red-600 hover:text-red-800 p-1 bg-red-50 hover:bg-red-100 rounded transition-colors"
                                title="Reject Request"
                              >
                                <XCircle size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-12 text-sm text-gray-400 font-medium bg-slate-50/20 border border-dashed border-gray-150 rounded-xl">
                  <span>No pending top-up requests found.</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Approve Modal */}
      {isApproveModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <h2 className="text-lg font-bold text-emerald-700 mb-2 flex items-center gap-2">
              <CheckCircle size={20} /> Approve Top-Up
            </h2>
            <p className="text-xs text-gray-500 mb-6 font-medium">
              Approving this request will immediately credit the target wallet.
            </p>
            <form onSubmit={handleApproveTopup}>
              <div className="mb-6">
                <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase">Admin Notes (Optional)</label>
                <textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-emerald-700 resize-none h-20"
                  placeholder="Internal notes for audit"
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsApproveModalOpen(false);
                    setAdminNotes('');
                  }}
                  disabled={actionSubmitting}
                  className="px-4 py-2 text-sm font-bold text-gray-500 hover:bg-gray-100 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionSubmitting}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 text-sm font-bold rounded-xl flex items-center gap-2 cursor-pointer"
                >
                  {actionSubmitting && <Loader2 size={14} className="animate-spin" />}
                  Confirm Approval
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {isRejectModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <h2 className="text-lg font-bold text-red-700 mb-2 flex items-center gap-2">
              <XCircle size={20} /> Reject Top-Up
            </h2>
            <p className="text-xs text-gray-500 mb-6 font-medium">
              Rejecting this request will mark it as rejected with no wallet movement.
            </p>
            <form onSubmit={handleRejectTopup}>
              <div className="mb-6">
                <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase">Reason for Rejection (Recommended)</label>
                <textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-red-700 resize-none h-20"
                  placeholder="Tell the user why it was rejected"
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsRejectModalOpen(false);
                    setAdminNotes('');
                  }}
                  disabled={actionSubmitting}
                  className="px-4 py-2 text-sm font-bold text-gray-500 hover:bg-gray-100 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionSubmitting}
                  className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 text-sm font-bold rounded-xl flex items-center gap-2 cursor-pointer"
                >
                  {actionSubmitting && <Loader2 size={14} className="animate-spin" />}
                  Confirm Rejection
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
