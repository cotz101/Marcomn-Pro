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
  Info
} from 'lucide-react';

export default function CompanyWalletPage() {
  const router = useRouter();
  const { profile, userId, companies } = useProfile();
  
  const [loading, setLoading] = useState(true);
  const [wallet, setWallet] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [error, setError] = useState(null);

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
          return enriched;
        });

        setTransactions(enrichedTxs);
      }
    } catch (err) {
      console.error('Error fetching company wallet:', err);
      setError('Unable to load wallet details at this time.');
    } finally {
      setLoading(false);
    }
  }, [myCompany]);

  useEffect(() => {
    if (userId !== undefined && companies !== undefined) {
      fetchWalletData();
    }
  }, [userId, companies, fetchWalletData]);

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

      {/* Header Info */}
      <div className="bg-white border border-gray-100 rounded-2xl p-6 lg:p-8 shadow-sm mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
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
            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100 uppercase tracking-wider mt-2">
              {wallet.status}
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Left Column: Transactions */}
        <div className="lg:col-span-2">
          <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm overflow-hidden min-h-[400px]">
            <div className="flex items-center gap-2 mb-6">
              <History size={18} className="text-[#0e2a4d]" />
              <h2 className="text-base font-bold text-[#0e2a4d]">Wallet Transaction History</h2>
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
        </div>

        {/* Right Column: Info & Settings Summary */}
        <div className="space-y-6">
          <div className="bg-[#002b4e] rounded-2xl p-6 text-white shadow-sm relative overflow-hidden">
            {/* Decorative background element */}
            <div className="absolute -right-6 -top-6 text-blue-800/30">
              <Coins size={120} />
            </div>
            
            <div className="relative z-10">
              <h3 className="text-base font-bold mb-3 flex items-center gap-2">
                <Info size={18} className="text-blue-300" />
                About MCredits
              </h3>
              <p className="text-sm text-blue-100 leading-relaxed mb-4">
                MCredits are used to power transactions on MarComn, including job postings, premium promotions, and future marketplace services.
              </p>
              
              <div className="bg-blue-950/40 border border-blue-800/50 rounded-xl p-4 mt-6">
                <h4 className="text-xs font-bold text-blue-200 uppercase tracking-wider mb-2">Need more credits?</h4>
                <p className="text-xs text-blue-100/80">
                  Direct top-ups are coming soon. To add credits for now, please contact the platform administrator.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
