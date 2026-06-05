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

export default function PersonalWalletPage() {
  const router = useRouter();
  const { profile, userId } = useProfile();
  
  const [loading, setLoading] = useState(true);
  const [wallet, setWallet] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [topupRequests, setTopupRequests] = useState([]);
  const [error, setError] = useState(null);

  // Top-Up Modal State
  const [isTopupModalOpen, setIsTopupModalOpen] = useState(false);
  const [topupAmount, setTopupAmount] = useState('');
  const [topupRemarks, setTopupRemarks] = useState('');
  const [submittingTopup, setSubmittingTopup] = useState(false);
  const [topupMessage, setTopupMessage] = useState(null);  // { type: 'success'|'error', text: string }

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
          if (tx.reference_type === 'job_posting' && tx.reference_id && jobMap[tx.reference_id]) {
            return { ...tx, jobDetails: jobMap[tx.reference_id] };
          }
          return tx;
        });

        setTransactions(enrichedTxs);

        // Fetch Top-Up Requests
        const topups = await getMyTopupRequests('user', userId);
        setTopupRequests(topups || []);
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
      setTopupMessage({ type: 'success', text: `${Number(topupAmount).toFixed(2)} MCredits credited to your wallet instantly.` });
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

      {/* Header Info */}
      <div className="bg-white border border-gray-100 rounded-2xl p-6 lg:p-8 shadow-sm mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Left Column: Transactions */}
        <div className="lg:col-span-2">
          <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm overflow-hidden min-h-[400px]">
            <div className="flex flex-col gap-1 mb-6">
              <div className="flex items-center gap-2">
                <History size={18} className="text-[#0e2a4d]" />
                <h2 className="text-base font-bold text-[#0e2a4d]">Wallet Transaction History</h2>
              </div>
              <p className="text-xs text-gray-500 font-medium ml-6">
                Wallet Transaction History shows actual MCredit movements (credits, debits, posting fees, refunds, and approved top-ups).
              </p>
            </div>

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

          {/* Top-Up History Section */}
          <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm overflow-hidden mt-6">
            <div className="flex flex-col gap-1 mb-6">
              <div className="flex items-center gap-2">
                <CreditCard size={18} className="text-[#0e2a4d]" />
                <h2 className="text-base font-bold text-[#0e2a4d]">Top-Up History</h2>
              </div>
              <p className="text-xs text-gray-500 font-medium ml-6">
                Top-Up History shows your submitted top-up records (audit log of requests).
              </p>
            </div>
            {topupRequests.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-gray-100 text-gray-400 uppercase tracking-wider text-[11px] font-bold">
                      <th className="pb-3 pr-4">Date</th>
                      <th className="pb-3 px-2">Amount</th>
                      <th className="pb-3 px-2">Status</th>
                      <th className="pb-3 pl-2">Remarks</th>
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
        </div>

        {/* Right Column: Info */}
        <div className="space-y-6">
          <div className="bg-[#002b4e] rounded-2xl p-6 text-white shadow-sm relative overflow-hidden">
            <div className="absolute -right-6 -top-6 text-blue-800/30">
              <Coins size={120} />
            </div>
            
            <div className="relative z-10">
              <h3 className="text-base font-bold mb-3 flex items-center gap-2">
                <Info size={18} className="text-blue-300" />
                About MCredits
              </h3>
              <p className="text-sm text-blue-100 leading-relaxed mb-4">
                MCredits are used to accept job offers and for future MarComn services.
              </p>
              
              <div className="bg-blue-950/40 border border-blue-800/50 rounded-xl p-4 mt-6">
                <h4 className="text-xs font-bold text-blue-200 uppercase tracking-wider mb-2">Need more credits?</h4>
                <p className="text-xs text-blue-100/80">
                  Personal instant top-ups are credited immediately in dummy mode. Use the <strong>Request Top-Up</strong> button above.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Top-Up Modal */}
      {isTopupModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <h2 className="text-lg font-bold text-[#0e2a4d] mb-2">Request MCredits Top-Up</h2>
            <p className="text-xs text-gray-500 mb-4">
              Personal instant top-ups are credited immediately in dummy mode.
            </p>
            {topupMessage && (
              <div className={`mb-4 px-4 py-3 rounded-xl text-sm font-semibold ${
                topupMessage.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-red-50 text-red-800 border border-red-200'
              }`}>
                {topupMessage.text}
              </div>
            )}
            <form onSubmit={handleTopupSubmit}>
              <div className="mb-4">
                <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase">Amount</label>
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
                <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase">Remarks (Optional)</label>
                <textarea
                  value={topupRemarks}
                  onChange={(e) => setTopupRemarks(e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-900 resize-none h-20"
                  placeholder="Payment reference or note"
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
          </div>
        </div>
      )}
    </div>
  );
}
