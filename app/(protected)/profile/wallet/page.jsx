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
  FileText,
  User,
  Info,
  Plus,
  XCircle,
  CreditCard
} from 'lucide-react';
import { createTopupRequest, cancelTopupRequest, getMyTopupRequests } from '@/app/actions/mcreditTopups';
import { getMyReceipts } from '@/app/actions/mcreditReceipts';

export default function PersonalWalletPage() {
  const router = useRouter();
  const { profile, userId } = useProfile();
  
  const [loading, setLoading] = useState(true);
  const [wallet, setWallet] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [topupRequests, setTopupRequests] = useState([]);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('transactions');
  const [receipts, setReceipts] = useState([]);
  const [selectedReceipt, setSelectedReceipt] = useState(null);

  // Top-Up Modal State
  const [isTopupModalOpen, setIsTopupModalOpen] = useState(false);
  const [topupAmount, setTopupAmount] = useState('');
  const [topupRemarks, setTopupRemarks] = useState('');
  const [submittingTopup, setSubmittingTopup] = useState(false);
  const [topupMessage, setTopupMessage] = useState(null);  // { type: 'success'|'error', text: string }

  const [modalTab, setModalTab] = useState('stripe'); // 'stripe' or 'manual'
  const [mcreditsPerUsd, setMcreditsPerUsd] = useState(1.0);
  const [stripePackages, setStripePackages] = useState([]);
  const [submittingStripe, setSubmittingStripe] = useState(false);
  const [pageMessage, setPageMessage] = useState(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('success') === 'true') {
        setPageMessage({
          type: 'success',
          text: 'Payment received. Your MCredit balance will update after confirmation.'
        });
        window.history.replaceState({}, document.title, window.location.pathname);
      } else if (params.get('cancelled') === 'true') {
        setPageMessage({
          type: 'error',
          text: 'Payment checkout was cancelled.'
        });
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  }, []);

  const fetchWalletData = useCallback(async () => {
    if (!userId || !profile) {
      setLoading(false);
      return;
    }

    try {
      const supabase = createClient();
      
      // Fetch personal wallet
      const { data: walletData, error: walletError } = await supabase
        .from('mcredit_wallets')
        .select('*')
        .eq('owner_type', 'user')
        .eq('owner_id', userId)
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

        const enrichedTxs = txs.map(tx => {
          const updatedTx = { ...tx };
          if (tx.reference_type === 'job_posting' && tx.reference_id && jobMap[tx.reference_id]) {
            updatedTx.jobDetails = jobMap[tx.reference_id];
          }
          if (tx.transaction_type === 'purchase_completed') {
            if (tx.reference_type === 'stripe_checkout') {
              updatedTx.transaction_type = 'stripe_top_up';
            } else if (tx.reference_type === 'topup_request') {
              updatedTx.transaction_type = 'manual_top_up';
            }
          }
          return updatedTx;
        });

        setTransactions(enrichedTxs);

        // Fetch Top-Up Requests
        const topups = await getMyTopupRequests('user', userId);
        setTopupRequests(topups || []);

        // Fetch Receipts
        const userReceipts = await getMyReceipts('user', userId);
        setReceipts(userReceipts || []);
      }
    } catch (err) {
      console.error('Error fetching personal wallet:', err);
      setError('Unable to load wallet details at this time.');
    } finally {
      setLoading(false);
    }
  }, [userId, profile]);

  useEffect(() => {
    if (userId !== undefined && profile !== undefined) {
      fetchWalletData();
    }
  }, [userId, profile, fetchWalletData]);

  const handleTopupSubmit = async (e) => {
    e.preventDefault();
    if (!topupAmount || Number(topupAmount) <= 0) return;
    setSubmittingTopup(true);
    setTopupMessage(null);
    try {
      const res = await createTopupRequest({
        ownerType: 'user',
        ownerId: userId,
        amount: topupAmount,
        remarks: topupRemarks
      });
      if (!res.success) throw new Error(res.error);
      setTopupMessage({ type: 'success', text: `Top-up request for ${Number(topupAmount).toFixed(2)} MC submitted and pending admin approval.` });
      setTopupAmount('');
      setTopupRemarks('');
      await fetchWalletData();
      // Auto-close after user reads the confirmation
      setTimeout(() => {
        setIsTopupModalOpen(false);
        setTopupMessage(null);
      }, 2500);
    } catch (err) {
      console.error('Topup request error:', err);
      setTopupMessage({ type: 'error', text: err.message || 'Failed to submit request' });
    } finally {
      setSubmittingTopup(false);
    }
  };

  const handleStripeCheckout = async (packageAmount, packageId) => {
    setSubmittingStripe(true);
    setTopupMessage(null);
    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ownerType: 'user',
          ownerId: userId,
          packageAmount,
          packageId
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
        <span className="text-sm text-gray-500 font-semibold">Loading personal wallet...</span>
      </div>
    );
  }

  if (!userId || !profile) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 font-sans">
        <div className="bg-white border border-gray-100 rounded-3xl p-10 shadow-sm flex flex-col items-center text-center space-y-6">
          <div className="p-5 bg-slate-50 text-slate-400 rounded-full">
            <User size={48} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">User Profile Not Found</h1>
            <p className="text-base text-gray-500 mt-2 max-w-md mx-auto">
              We could not load your profile details to access the wallet.
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

  const profilePic = profile?.avatar_url || profile?.profile_pic_url;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 font-sans">
      {/* Navigation */}
      <Link
        href="/profile"
        className="inline-flex items-center gap-2 text-gray-500 hover:text-[#002b4e] transition-colors mb-6 text-sm font-bold"
      >
        <ArrowLeft size={16} />
        <span>Back to Profile</span>
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
                {profilePic ? (
                  <img src={profilePic} alt={profile?.name || 'User'} className="w-full h-full object-cover rounded-xl" />
                ) : (
                  <User size={24} />
                )}
              </div>
              <div>
                <h1 className="text-2xl font-bold text-[#0e2a4d] leading-tight">Personal Wallet</h1>
                <p className="text-sm text-gray-500 mt-1 font-medium flex items-center gap-2">
                  <span>{profile?.name || 'User'}</span>
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
                    <span>Request Top-Up</span>
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
              
              <div className="space-y-3 text-xs text-blue-100/90 leading-relaxed">
                <p>
                  MCredits are used to accept job offers and access selected MarComn services.
                </p>
                <p>
                  Personal top-ups require platform admin approval.
                </p>
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

        {/* Tab content */}
        {activeTab === 'transactions' ? (
          <div>
            <p className="text-xs text-gray-500 font-medium mb-4">
              Wallet Transaction History shows actual MCredit movements (credits, debits, job posting fees, acceptance fees, refunds, penalties, and approved top-ups).
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
                      <th className="pb-3 pl-2">Remarks</th>
                      <th className="pb-3 pl-2 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-gray-700 font-medium">
                    {topupRequests.map((req) => (
                      <tr key={req.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-4 pr-4 whitespace-nowrap text-xs text-gray-500 font-mono">
                          {new Date(req.created_at).toLocaleDateString()}
                        </td>
                        <td className="py-4 px-2 font-bold text-[#0e2a4d]">
                          +{Number(req.amount).toFixed(2)} MC
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
                        <td className="py-4 pl-2 text-xs text-gray-500 max-w-[180px] truncate" title={req.remarks}>
                          {req.remarks || '—'}
                        </td>
                        <td className="py-4 pl-2 text-right">
                          {req.status === 'Approved' && (
                            <button
                              onClick={() => {
                                const receipt = receipts.find(r => r.topup_request_id === req.id);
                                if (receipt) setSelectedReceipt(receipt);
                                else alert('Receipt not generated yet.');
                              }}
                              className="text-xs text-blue-600 font-bold hover:underline"
                            >
                              View Receipt
                            </button>
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
                <span className="block text-gray-500 font-semibold mb-1">No top-up history yet.</span>
                <span className="text-xs text-gray-400">Use the Request Top-Up button above to add credits.</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Top-Up Modal */}
      {isTopupModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            <h2 className="text-lg font-bold text-[#0e2a4d] mb-2">Request MCredits Top-Up</h2>
            
            {/* Modal Tabs */}
            <div className="flex border-b border-gray-150 mb-4 mt-2">
              <button
                type="button"
                onClick={() => { setModalTab('stripe'); setTopupMessage(null); }}
                className={`flex-1 pb-2.5 text-xs font-bold text-center border-b-2 transition-all ${
                  modalTab === 'stripe'
                    ? 'border-[#0e2a4d] text-[#0e2a4d]'
                    : 'border-transparent text-gray-400 hover:text-gray-600'
                }`}
              >
                Instant Top-Up (Card)
              </button>
              <button
                type="button"
                onClick={() => { setModalTab('manual'); setTopupMessage(null); }}
                className={`flex-1 pb-2.5 text-xs font-bold text-center border-b-2 transition-all ${
                  modalTab === 'manual'
                    ? 'border-[#0e2a4d] text-[#0e2a4d]'
                    : 'border-transparent text-gray-400 hover:text-gray-600'
                }`}
              >
                Manual Top-Up
              </button>
            </div>

            {topupMessage && (
              <div className={`mb-4 px-4 py-3 rounded-xl text-sm font-semibold ${
                topupMessage.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-red-50 text-red-800 border border-red-200'
              }`}>
                {topupMessage.text}
              </div>
            )}

            {modalTab === 'stripe' ? (
              <div className="space-y-4">
                <p className="text-xs text-gray-500 leading-relaxed font-medium">
                  Select a package to top up your personal wallet instantly via Stripe Checkout.
                </p>
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
                
                <div className="flex justify-between items-center text-[10px] text-gray-400 font-bold bg-gray-50 p-2.5 rounded-lg select-none">
                  <span>Exchange Rate: 1 USD = {mcreditsPerUsd.toFixed(1)} MC</span>
                  <span>Instant Auto-Approval</span>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => setIsTopupModalOpen(false)}
                    disabled={submittingStripe}
                    className="px-5 py-2 text-xs font-bold text-gray-500 hover:bg-gray-150 rounded-xl transition-colors cursor-pointer select-none"
                  >
                    Close
                  </button>
                </div>

                {submittingStripe && (
                  <div className="absolute inset-0 bg-white/80 z-20 rounded-2xl flex flex-col items-center justify-center space-y-3">
                    <Loader2 size={32} className="animate-spin text-blue-900" />
                    <span className="text-xs text-gray-500 font-bold">Redirecting to Stripe Checkout...</span>
                  </div>
                )}
              </div>
            ) : (
              <form onSubmit={handleTopupSubmit}>
                <p className="text-xs text-gray-500 mb-4 leading-relaxed font-medium">
                  Submit a manual top-up request. It will remain pending until approved by a platform administrator.
                </p>
                <div className="mb-4">
                  <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase">Amount (MCredits)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={topupAmount}
                    onChange={(e) => setTopupAmount(e.target.value)}
                    className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-900"
                    placeholder="e.g. 500"
                  />
                </div>
                <div className="mb-6">
                  <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase">Remarks / Note (Optional)</label>
                  <textarea
                    value={topupRemarks}
                    onChange={(e) => setTopupRemarks(e.target.value)}
                    className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-900 resize-none h-20"
                    placeholder="Bank reference, deposit info, or other notes..."
                  />
                </div>
                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsTopupModalOpen(false)}
                    disabled={submittingTopup}
                    className="px-4 py-2 text-sm font-bold text-gray-500 hover:bg-gray-100 rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingTopup}
                    className="bg-[#0e2a4d] text-white px-4 py-2 text-sm font-bold rounded-xl flex items-center gap-2"
                  >
                    {submittingTopup && <Loader2 size={14} className="animate-spin" />}
                    Submit Request
                  </button>
                </div>
              </form>
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
                <span className="font-bold text-gray-800">{selectedReceipt.issued_to_name}</span>
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
    </div>
  );
}
