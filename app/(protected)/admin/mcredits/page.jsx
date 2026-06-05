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
  Settings 
} from 'lucide-react';
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
    <div className="max-w-5xl mx-auto px-4 py-8 font-sans">
      {/* Navigation */}
      <button
        onClick={() => router.push('/profile')}
        className="flex items-center gap-2 text-gray-500 hover:text-[#002b4e] transition-colors mb-6 text-sm font-bold cursor-pointer bg-none border-none outline-none"
      >
        <ArrowLeft size={16} />
        <span>Back to Profile</span>
      </button>

      {/* Header Info */}
      <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm mb-6 flex items-start gap-4">
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Left/Middle Columns: Settings & Wallet Selector */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Section: Select Wallet */}
          <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
            <h2 className="text-base font-bold text-[#0e2a4d] mb-4">Select Wallet</h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
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

            {loadingWallet ? (
              <div className="flex items-center justify-center py-8 space-x-2 text-gray-400">
                <Loader2 size={20} className="animate-spin text-blue-900" />
                <span className="text-sm font-semibold">Retrieving wallet data...</span>
              </div>
            ) : selectedWallet ? (
              <div className="bg-slate-50/50 border border-gray-100 rounded-xl p-4 mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <span className="block text-[10px] font-bold text-gray-400 uppercase">Wallet ID</span>
                  <span className="text-xs font-mono text-gray-600 truncate block">{selectedWallet.id}</span>
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-gray-400 uppercase">Wallet Status</span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100 capitalize mt-0.5">
                    {selectedWallet.status}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-gray-400 uppercase">Current Balance</span>
                  <span className="text-base font-extrabold text-[#0e2a4d]">{Number(selectedWallet.balance).toFixed(2)} MC</span>
                </div>
              </div>
            ) : (
              <div className="text-center py-6 text-sm text-gray-400 font-medium">
                {ownerType === 'platform' ? 'Click selection to load' : 'Please select an owner to load their wallet balance.'}
              </div>
            )}
          </div>

          {/* Section: Platform Settings Editor */}
          <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
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
                <p className="text-[10px] text-gray-500 mt-1">Comma separated list of hours.</p>
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

        </div>

        {/* Right Column: Ledger Adjustments Form */}
        <div>
          <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm h-full">
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
                  rows={4}
                  placeholder="Enter reason/justification for adjustment..."
                  value={justification}
                  onChange={(e) => setJustification(e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 outline-none focus:border-blue-900 transition-colors resize-none"
                />
                <span className="text-[10px] text-gray-400 block mt-1 font-medium">Justification is saved in audit logs.</span>
              </div>

              <button
                type="submit"
                disabled={submitting || !selectedWallet}
                className="w-full bg-[#002b4e] hover:bg-[#001c33] disabled:bg-slate-200 disabled:text-gray-400 text-white font-bold text-sm py-3 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 select-none shadow-sm mt-6"
              >
                {submitting && <Loader2 size={16} className="animate-spin" />}
                <span>Apply Wallet Balance Change</span>
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Transaction History Section */}
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
  );
}
