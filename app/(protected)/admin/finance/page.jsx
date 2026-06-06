'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useProfile } from '@/app/context/ProfileContext';
import { 
  ArrowLeft, 
  Loader2, 
  ShieldAlert, 
  Coins, 
  Calendar, 
  Filter, 
  RotateCcw, 
  TrendingUp, 
  TrendingDown, 
  CreditCard, 
  DollarSign, 
  FileText, 
  Settings, 
  History,
  CheckCircle,
  Clock,
  Briefcase,
  AlertTriangle,
  ClipboardList
} from 'lucide-react';
import { 
  getFinanceDashboardSummary, 
  getFinanceTransactions, 
  getTopupReport 
} from '@/app/actions/adminFinance';
import { getAdminReceipts } from '@/app/actions/mcreditReceipts';

export default function AdminFinancePage() {
  const router = useRouter();
  const { profile, showToast } = useProfile();

  const isAuthorized = profile && ['super_admin', 'admin', 'brand_manager'].includes(profile.global_role);

  // States
  const [activeTab, setActiveTab] = useState('overview'); // overview, transactions, topups, revenue, receipts
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [topupReport, setTopupReport] = useState(null);
  const [receipts, setReceipts] = useState([]);

  // Filter values
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [ownerType, setOwnerType] = useState('all');
  const [transactionType, setTransactionType] = useState('all');
  const [activeFilters, setActiveFilters] = useState({
    dateFrom: '',
    dateTo: '',
    ownerType: 'all',
    transactionType: 'all'
  });

  // Fetch data with active filters
  const fetchData = useCallback(async () => {
    if (!isAuthorized) return;
    setLoading(true);
    try {
      const [summaryRes, txsRes, topupRes, receiptsData] = await Promise.all([
        getFinanceDashboardSummary(activeFilters),
        getFinanceTransactions(activeFilters),
        getTopupReport(activeFilters),
        getAdminReceipts()
      ]);

      if (summaryRes.success) setSummary(summaryRes.summary);
      if (txsRes.success) setTransactions(txsRes.transactions);
      if (topupRes.success) setTopupReport(topupRes.report);
      setReceipts(receiptsData || []);

      if (!summaryRes.success || !txsRes.success || !topupRes.success) {
        showToast('Error loading some reporting data', 'error');
      }
    } catch (err) {
      console.error('Failed to load dashboard metrics:', err);
      showToast('Internal error loading finance dashboard metrics', 'error');
    } finally {
      setLoading(false);
    }
  }, [isAuthorized, activeFilters, showToast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleApplyFilters = (e) => {
    e.preventDefault();
    setActiveFilters({
      dateFrom,
      dateTo,
      ownerType,
      transactionType
    });
  };

  const handleResetFilters = () => {
    setDateFrom('');
    setDateTo('');
    setOwnerType('all');
    setTransactionType('all');
    setActiveFilters({
      dateFrom: '',
      dateTo: '',
      ownerType: 'all',
      transactionType: 'all'
    });
  };

  // Auth block
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
              You do not have the required administrative permissions to access the Platform Finance Dashboard.
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
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => router.push('/admin/mcredits')}
          className="flex items-center gap-2 text-gray-500 hover:text-[#002b4e] transition-colors text-sm font-bold cursor-pointer bg-none border-none outline-none"
        >
          <ArrowLeft size={16} />
          <span>Back to MCredits Wallet Control</span>
        </button>
        <span className="text-gray-300">|</span>
        <button
          onClick={() => router.push('/profile')}
          className="flex items-center gap-2 text-gray-500 hover:text-[#002b4e] transition-colors text-sm font-bold cursor-pointer bg-none border-none outline-none"
        >
          <span>Back to Profile</span>
        </button>
      </div>

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 gap-6 lg:gap-7 items-start mb-8">
        
        {/* Header Card (Row 1) */}
        <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-blue-50 text-blue-950 rounded-xl flex items-center justify-center shrink-0">
              <Coins size={24} className="text-blue-900" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-[#0e2a4d] leading-tight">Platform Finance Dashboard</h1>
              <p className="text-sm text-gray-500 mt-1 font-medium">
                Review MCredits movement, top-ups, platform revenue, refunds, and wallet activity.
              </p>
              <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-100">
                <AlertTriangle size={10} />
                <span>MCredits reporting only. Real payment gateway settlement is not connected yet.</span>
              </div>
            </div>
          </div>
          <div className="shrink-0 flex gap-2">
            <button
              onClick={() => router.push('/admin/mcredits')}
              className="border border-[#002b4e] text-[#002b4e] hover:bg-slate-50 text-xs font-bold py-2.5 px-4 rounded-xl transition-all select-none cursor-pointer"
            >
              Manage Wallets & Top-Ups
            </button>
          </div>
        </div>

        {/* Filter Bar (Row 2) */}
        <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Filter size={16} className="text-[#0e2a4d]" />
            <h2 className="text-sm font-bold text-[#0e2a4d]">Filter Reports</h2>
          </div>
          <form onSubmit={handleApplyFilters} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 items-end">
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Date From</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-700 outline-none focus:border-blue-900 transition-colors"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Date To</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-700 outline-none focus:border-blue-900 transition-colors"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Owner Type</label>
              <select
                value={ownerType}
                onChange={(e) => setOwnerType(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-700 outline-none focus:border-blue-900 transition-colors"
              >
                <option value="all">All Owners</option>
                <option value="user">Personal / User</option>
                <option value="company">Company</option>
                <option value="platform">Platform</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Transaction Type</label>
              <select
                value={transactionType}
                onChange={(e) => setTransactionType(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-700 outline-none focus:border-blue-900 transition-colors"
              >
                <option value="all">All Types</option>
                <option value="top_up">Top-up</option>
                <option value="job_posting_fee">Job Posting Fee</option>
                <option value="acceptance_fee">Applicant Acceptance Fee</option>
                <option value="refund">Refund</option>
                <option value="penalty">Penalty</option>
                <option value="platform_revenue">Platform Revenue</option>
                <option value="admin_grant">Admin Grant</option>
                <option value="admin_deduct">Admin Deduct</option>
              </select>
            </div>
            <div className="sm:col-span-2 md:col-span-4 flex justify-end gap-2 mt-2">
              <button
                type="button"
                onClick={handleResetFilters}
                className="flex items-center gap-1.5 px-4 py-2 bg-slate-50 hover:bg-slate-100 text-gray-600 text-xs font-bold rounded-xl transition-colors cursor-pointer border border-slate-150"
              >
                <RotateCcw size={12} />
                <span>Reset</span>
              </button>
              <button
                type="submit"
                className="flex items-center gap-1.5 px-6 py-2 bg-[#002b4e] hover:bg-[#001c33] text-white text-xs font-bold rounded-xl transition-colors cursor-pointer shadow-sm"
              >
                <Filter size={12} />
                <span>Apply Filters</span>
              </button>
            </div>
          </form>
        </div>

        {/* Tab Row (Row 3) */}
        <div className="flex border-b border-gray-200 gap-2 md:gap-6 overflow-x-auto md:overflow-x-visible pb-px w-full flex-nowrap md:flex-wrap lg:flex-nowrap">
          <button
            onClick={() => setActiveTab('overview')}
            className={`pb-3 text-xs md:text-sm font-bold transition-all border-b-2 outline-none focus:outline-none whitespace-nowrap cursor-pointer flex-shrink-0 md:flex-1 text-center ${
              activeTab === 'overview'
                ? 'border-[#002b4e] text-[#002b4e]'
                : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('transactions')}
            className={`pb-3 text-xs md:text-sm font-bold transition-all border-b-2 outline-none focus:outline-none whitespace-nowrap cursor-pointer flex-shrink-0 md:flex-1 text-center ${
              activeTab === 'transactions'
                ? 'border-[#002b4e] text-[#002b4e]'
                : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            Transactions
          </button>
          <button
            onClick={() => setActiveTab('topups')}
            className={`pb-3 text-xs md:text-sm font-bold transition-all border-b-2 outline-none focus:outline-none whitespace-nowrap cursor-pointer flex-shrink-0 md:flex-1 text-center ${
              activeTab === 'topups'
                ? 'border-[#002b4e] text-[#002b4e]'
                : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            Top-Up Report
          </button>
          <button
            onClick={() => setActiveTab('revenue')}
            className={`pb-3 text-xs md:text-sm font-bold transition-all border-b-2 outline-none focus:outline-none whitespace-nowrap cursor-pointer flex-shrink-0 md:flex-1 text-center ${
              activeTab === 'revenue'
                ? 'border-[#002b4e] text-[#002b4e]'
                : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            Platform Revenue
          </button>
          <button
            onClick={() => setActiveTab('receipts')}
            className={`pb-3 text-xs md:text-sm font-bold transition-all border-b-2 outline-none focus:outline-none whitespace-nowrap cursor-pointer flex-shrink-0 md:flex-1 text-center ${
              activeTab === 'receipts'
                ? 'border-[#002b4e] text-[#002b4e]'
                : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            Receipts
          </button>
        </div>

        {/* Tab Content (Row 4) */}
        <div className="w-full">
          {loading ? (
            <div className="bg-white border border-gray-100 rounded-2xl p-16 flex flex-col items-center justify-center space-y-4 shadow-sm">
              <Loader2 size={32} className="animate-spin text-blue-900" />
              <span className="text-xs text-gray-400 font-bold uppercase tracking-wider">Compiling dashboard data...</span>
            </div>
          ) : (
            <div className="space-y-6">
              
              {/* TAB 1: OVERVIEW */}
              {activeTab === 'overview' && summary && (
                <div className="space-y-6 animate-fadeIn">
                  
                  {/* Summary Cards Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-6">
                    {/* Card 1: Total Credits In */}
                    <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm flex items-start gap-4">
                      <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                        <TrendingUp size={20} />
                      </div>
                      <div className="min-w-0">
                        <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">Total Credits In</span>
                        <span className="block text-lg font-extrabold text-emerald-700 mt-1">+{summary.totalCreditsIn.toFixed(2)} MC</span>
                        <span className="block text-[10px] text-gray-400 mt-0.5">Total added to wallets</span>
                      </div>
                    </div>

                    {/* Card 2: Total Credits Out */}
                    <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm flex items-start gap-4">
                      <div className="p-3 bg-red-50 text-red-600 rounded-xl">
                        <TrendingDown size={20} />
                      </div>
                      <div className="min-w-0">
                        <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">Total Credits Out</span>
                        <span className="block text-lg font-extrabold text-red-700 mt-1">-{summary.totalCreditsOut.toFixed(2)} MC</span>
                        <span className="block text-[10px] text-gray-400 mt-0.5">Total spent/deducted</span>
                      </div>
                    </div>

                    {/* Card 3: Net Movement */}
                    <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm flex items-start gap-4">
                      <div className="p-3 bg-blue-50 text-blue-900 rounded-xl">
                        <Coins size={20} />
                      </div>
                      <div className="min-w-0">
                        <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">Net Movement</span>
                        <span className={`block text-lg font-extrabold mt-1 ${summary.netMovement >= 0 ? 'text-[#002b4e]' : 'text-red-700'}`}>
                          {summary.netMovement >= 0 ? '+' : ''}{summary.netMovement.toFixed(2)} MC
                        </span>
                        <span className="block text-[10px] text-gray-400 mt-0.5">Net change in circulation</span>
                      </div>
                    </div>

                    {/* Card 4: Approved Top-Ups */}
                    <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm flex items-start gap-4">
                      <div className="p-3 bg-blue-50 text-blue-950 rounded-xl">
                        <CheckCircle size={20} className="text-blue-900" />
                      </div>
                      <div className="min-w-0">
                        <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">Approved Top-Ups</span>
                        <span className="block text-lg font-extrabold text-[#0e2a4d] mt-1">{summary.totalTopupAmount.toFixed(2)} MC</span>
                        <span className="block text-[10px] text-gray-400 mt-0.5">{summary.totalTopupsApproved} requests completed</span>
                      </div>
                    </div>

                    {/* Card 5: Pending Top-Ups */}
                    <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm flex items-start gap-4">
                      <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
                        <Clock size={20} />
                      </div>
                      <div className="min-w-0">
                        <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">Pending Top-Ups</span>
                        <span className="block text-lg font-extrabold text-[#0e2a4d] mt-1">{summary.totalPendingTopups} Pending</span>
                        <span className="block text-[10px] text-gray-400 mt-0.5">Awaiting admin review</span>
                      </div>
                    </div>

                    {/* Card 6: Platform Revenue / Fees */}
                    <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm flex items-start gap-4">
                      <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
                        <DollarSign size={20} />
                      </div>
                      <div className="min-w-0">
                        <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">Platform Revenue</span>
                        <span className="block text-lg font-extrabold text-[#0e2a4d] mt-1">{(summary.totalJobPostingFees + summary.totalApplicantAcceptanceFees + summary.totalPlatformRevenue).toFixed(2)} MC</span>
                        <span className="block text-[10px] text-gray-400 mt-0.5">Posting fees, acceptance fees, etc.</span>
                      </div>
                    </div>

                    {/* Card 7: Refunds */}
                    <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm flex items-start gap-4">
                      <div className="p-3 bg-slate-50 text-slate-600 rounded-xl">
                        <RotateCcw size={20} />
                      </div>
                      <div className="min-w-0">
                        <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">Refunds</span>
                        <span className="block text-lg font-extrabold text-slate-800 mt-1">{summary.totalRefunds.toFixed(2)} MC</span>
                        <span className="block text-[10px] text-gray-400 mt-0.5">Returned credits</span>
                      </div>
                    </div>

                    {/* Card 8: Penalties / Compensation */}
                    <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm flex items-start gap-4">
                      <div className="p-3 bg-amber-50 text-amber-700 rounded-xl">
                        <AlertTriangle size={20} />
                      </div>
                      <div className="min-w-0">
                        <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">Penalties / Compensation</span>
                        <span className="block text-lg font-extrabold text-amber-800 mt-1">{summary.totalPenalties.toFixed(2)} MC</span>
                        <span className="block text-[10px] text-gray-400 mt-0.5">Cancellation compensations</span>
                      </div>
                    </div>

                    {/* Card 9: Admin Adjustments */}
                    <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm flex items-start gap-4">
                      <div className="p-3 bg-slate-50 text-gray-600 rounded-xl">
                        <Settings size={20} />
                      </div>
                      <div className="min-w-0">
                        <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">Admin Adjustments</span>
                        <span className="block text-xs font-bold text-gray-600 mt-1">
                          Grants: <span className="font-extrabold text-emerald-700">+{summary.totalAdminGrants.toFixed(0)} MC</span>
                        </span>
                        <span className="block text-[10px] text-gray-400 mt-0.5">
                          Deducts: <span className="font-extrabold text-red-700">-{summary.totalAdminDeductions.toFixed(0)} MC</span>
                        </span>
                      </div>
                    </div>

                  </div>

                  {/* Recent Activity Table Preview */}
                  <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm overflow-hidden">
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-2">
                        <History size={18} className="text-[#0e2a4d]" />
                        <h2 className="text-base font-bold text-[#0e2a4d]">Recent Activity</h2>
                      </div>
                      <button
                        onClick={() => setActiveTab('transactions')}
                        className="text-xs font-bold text-blue-900 hover:underline cursor-pointer"
                      >
                        View All Transactions
                      </button>
                    </div>

                    {transactions.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="border-b border-gray-100 text-gray-400 uppercase tracking-wider font-bold">
                              <th className="pb-3 font-semibold">Date</th>
                              <th className="pb-3 font-semibold">Owner</th>
                              <th className="pb-3 font-semibold">Owner Type</th>
                              <th className="pb-3 font-semibold">Type</th>
                              <th className="pb-3 font-semibold text-right">Amount</th>
                              <th className="pb-3 pl-4 font-semibold">Description</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 text-gray-600 font-medium">
                            {transactions.slice(0, 5).map((tx) => {
                              const isCredit = tx.direction === 'credit';
                              return (
                                <tr key={tx.id} className="hover:bg-slate-50/30">
                                  <td className="py-3 whitespace-nowrap text-gray-500 font-mono">
                                    {new Date(tx.created_at).toLocaleString()}
                                  </td>
                                  <td className="py-3">
                                    <span className="font-bold text-[#0e2a4d]">{tx.owner_name}</span>
                                  </td>
                                  <td className="py-3 capitalize">
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-50 border border-gray-100 text-slate-700">
                                      {tx.owner_type}
                                    </span>
                                  </td>
                                  <td className="py-3 capitalize whitespace-nowrap">
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-50 border border-gray-100 text-slate-700">
                                      {tx.transaction_type.replace('_', ' ')}
                                    </span>
                                  </td>
                                  <td className={`py-3 text-right font-bold ${isCredit ? 'text-emerald-700' : 'text-red-700'}`}>
                                    {isCredit ? '+' : '-'}{Number(tx.amount).toFixed(2)} MC
                                  </td>
                                  <td className="py-3 pl-4 max-w-xs text-gray-500 truncate" title={tx.description}>
                                    {tx.description || '—'}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="text-center py-8 text-sm text-gray-400 font-medium border border-dashed border-gray-150 rounded-xl bg-slate-50/20">
                        <span>No recent transactions found.</span>
                      </div>
                    )}
                  </div>

                </div>
              )}

              {/* TAB 2: TRANSACTIONS */}
              {activeTab === 'transactions' && (
                <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm overflow-hidden animate-fadeIn">
                  <div className="flex items-center gap-2 mb-6">
                    <History size={18} className="text-[#0e2a4d]" />
                    <h2 className="text-base font-bold text-[#0e2a4d]">Wallet Transactions</h2>
                  </div>

                  {transactions.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-gray-100 text-gray-400 uppercase tracking-wider font-bold">
                            <th className="pb-3 font-semibold">Date</th>
                            <th className="pb-3 font-semibold">Owner</th>
                            <th className="pb-3 font-semibold">Owner Type</th>
                            <th className="pb-3 font-semibold">Type</th>
                            <th className="pb-3 font-semibold text-right">Amount</th>
                            <th className="pb-3 font-semibold text-right">Balance After</th>
                            <th className="pb-3 pl-4 font-semibold">Description</th>
                            <th className="pb-3 font-semibold">Reference</th>
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
                                <td className="py-3">
                                  <span className="font-bold text-[#0e2a4d]">{tx.owner_name}</span>
                                </td>
                                <td className="py-3 capitalize">
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-50 border border-gray-100 text-slate-700">
                                    {tx.owner_type}
                                  </span>
                                </td>
                                <td className="py-3 capitalize whitespace-nowrap">
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-50 border border-gray-100 text-slate-700">
                                    {tx.transaction_type.replace('_', ' ')}
                                  </span>
                                </td>
                                <td className={`py-3 text-right font-bold ${isCredit ? 'text-emerald-700' : 'text-red-700'}`}>
                                  {isCredit ? '+' : '-'}{Number(tx.amount).toFixed(2)} MC
                                </td>
                                <td className="py-3 text-right font-mono text-gray-500">
                                  {tx.balance_after !== null && tx.balance_after !== undefined ? `${Number(tx.balance_after).toFixed(2)} MC` : '—'}
                                </td>
                                <td className="py-3 pl-4 max-w-xs text-gray-500 truncate" title={tx.description}>
                                  {tx.description || '—'}
                                </td>
                                <td className="py-3 text-gray-400 font-mono text-[10px]">
                                  {tx.reference_type ? (
                                    <div title={`${tx.reference_type}: ${tx.reference_id}`}>
                                      <span className="capitalize block text-gray-600 font-bold">{tx.reference_type.replace('_', ' ')}</span>
                                      <span className="block mt-0.5">{tx.reference_id?.substring(0, 8)}...</span>
                                    </div>
                                  ) : '—'}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-center py-12 text-sm text-gray-400 font-medium border border-dashed border-gray-150 rounded-xl bg-slate-50/20">
                      <FileText className="mx-auto mb-2 text-gray-300" size={32} />
                      <span>No transactions found matching the filters.</span>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: TOP-UP REPORT */}
              {activeTab === 'topups' && topupReport && (
                <div className="space-y-6 animate-fadeIn">
                  
                  {/* Stats card grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                      <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">Approved Amount</span>
                      <span className="block text-lg font-extrabold text-[#0e2a4d] mt-1">{topupReport.approvedAmount.toFixed(2)} MC</span>
                      <span className="block text-[10px] text-gray-400 mt-0.5">{topupReport.totalApproved} approved requests</span>
                    </div>
                    
                    <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                      <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">Pending Amount</span>
                      <span className="block text-lg font-extrabold text-amber-600 mt-1">{topupReport.pendingAmount.toFixed(2)} MC</span>
                      <span className="block text-[10px] text-gray-400 mt-0.5">{topupReport.totalPending} requests awaiting review</span>
                    </div>

                    <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                      <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">Personal Top-Ups</span>
                      <span className="block text-lg font-extrabold text-[#0e2a4d] mt-1">{topupReport.userApprovedAmount.toFixed(2)} MC</span>
                      <span className="block text-[10px] text-gray-400 mt-0.5">{topupReport.userApprovedCount} instant user requests</span>
                    </div>

                    <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                      <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">Company Approved</span>
                      <span className="block text-lg font-extrabold text-[#0e2a4d] mt-1">{topupReport.companyApprovedAmount.toFixed(2)} MC</span>
                      <span className="block text-[10px] text-gray-400 mt-0.5">{topupReport.companyApprovedCount} approved corporate requests</span>
                    </div>
                  </div>

                  {/* Requests Table */}
                  <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm overflow-hidden">
                    <div className="flex items-center gap-2 mb-6">
                      <CreditCard size={18} className="text-[#0e2a4d]" />
                      <h2 className="text-base font-bold text-[#0e2a4d]">Top-Up Requests List</h2>
                    </div>

                    {topupReport.requests.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="border-b border-gray-100 text-gray-400 uppercase tracking-wider font-bold">
                              <th className="pb-3 font-semibold">Date</th>
                              <th className="pb-3 font-semibold">Owner</th>
                              <th className="pb-3 font-semibold">Owner Type</th>
                              <th className="pb-3 font-semibold text-right">Amount</th>
                              <th className="pb-3 font-semibold">Status</th>
                              <th className="pb-3 pl-4 font-semibold">Remarks</th>
                              <th className="pb-3 font-semibold">Requested By</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 text-gray-600 font-medium">
                            {topupReport.requests.map((req) => {
                              return (
                                <tr key={req.id} className="hover:bg-slate-50/30">
                                  <td className="py-3 whitespace-nowrap text-gray-500 font-mono">
                                    {new Date(req.created_at).toLocaleString()}
                                  </td>
                                  <td className="py-3">
                                    <span className="font-bold text-[#0e2a4d]">{req.owner_name}</span>
                                  </td>
                                  <td className="py-3 capitalize">
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-50 border border-gray-100 text-slate-700">
                                      {req.owner_type}
                                    </span>
                                  </td>
                                  <td className="py-3 text-right font-bold text-[#0e2a4d]">
                                    {Number(req.amount).toFixed(2)} MC
                                  </td>
                                  <td className="py-3">
                                    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                      req.status === 'Approved'
                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                        : req.status === 'Pending'
                                        ? 'bg-amber-50 text-amber-700 border-amber-100'
                                        : req.status === 'Rejected'
                                        ? 'bg-red-50 text-red-700 border-red-100'
                                        : 'bg-slate-50 text-slate-600 border-slate-100'
                                    }`}>
                                      {req.status}
                                    </span>
                                  </td>
                                  <td className="py-3 pl-4 max-w-xs text-gray-500 truncate" title={req.remarks}>
                                    {req.remarks || '—'}
                                  </td>
                                  <td className="py-3 text-[#0e2a4d] font-semibold">
                                    {req.requester_name}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="text-center py-12 text-sm text-gray-400 font-medium border border-dashed border-gray-150 rounded-xl bg-slate-50/20">
                        <span>No top-up requests found.</span>
                      </div>
                    )}
                  </div>

                </div>
              )}

              {/* TAB 4: PLATFORM REVENUE */}
              {activeTab === 'revenue' && summary && (
                <div className="space-y-6 animate-fadeIn">
                  
                  {/* Revenue metrics cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                      <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">Total Revenue</span>
                      <span className="block text-lg font-extrabold text-[#0e2a4d] mt-1">
                        {(summary.totalJobPostingFees + summary.totalApplicantAcceptanceFees + summary.totalPlatformRevenue).toFixed(2)} MC
                      </span>
                      <span className="block text-[10px] text-gray-400 mt-0.5">Fees & cancellation revenue</span>
                    </div>

                    <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                      <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">Job Posting Fees</span>
                      <span className="block text-lg font-extrabold text-indigo-700 mt-1">
                        {summary.totalJobPostingFees.toFixed(2)} MC
                      </span>
                      <span className="block text-[10px] text-gray-400 mt-0.5">Paid by corporate profiles</span>
                    </div>

                    <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                      <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">Acceptance Fees</span>
                      <span className="block text-lg font-extrabold text-violet-700 mt-1">
                        {summary.totalApplicantAcceptanceFees.toFixed(2)} MC
                      </span>
                      <span className="block text-[10px] text-gray-400 mt-0.5">Paid by job applicants</span>
                    </div>

                    <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                      <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">Cancellation Share</span>
                      <span className="block text-lg font-extrabold text-blue-700 mt-1">
                        {summary.totalPlatformRevenue.toFixed(2)} MC
                      </span>
                      <span className="block text-[10px] text-gray-400 mt-0.5">Candidate cancellation platform cut</span>
                    </div>
                  </div>

                  {/* Revenue Transactions List */}
                  <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm overflow-hidden">
                    <div className="flex items-center gap-2 mb-6">
                      <DollarSign size={18} className="text-[#0e2a4d]" />
                      <h2 className="text-base font-bold text-[#0e2a4d]">Fee & Platform Revenue Log</h2>
                    </div>

                    {transactions.filter(t => 
                      t.transaction_type === 'platform_revenue' || 
                      (t.transaction_type === 'spend' && (t.reference_type === 'job_posting' || t.reference_type === 'job_application'))
                    ).length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="border-b border-gray-100 text-gray-400 uppercase tracking-wider font-bold">
                              <th className="pb-3 font-semibold">Date</th>
                              <th className="pb-3 font-semibold">From Account</th>
                              <th className="pb-3 font-semibold">Account Type</th>
                              <th className="pb-3 font-semibold">Revenue Stream</th>
                              <th className="pb-3 text-right font-semibold">Amount</th>
                              <th className="pb-3 pl-4 font-semibold">Details</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 text-gray-600 font-medium">
                            {transactions
                              .filter(t => 
                                t.transaction_type === 'platform_revenue' || 
                                (t.transaction_type === 'spend' && (t.reference_type === 'job_posting' || t.reference_type === 'job_application'))
                              )
                              .map((tx) => {
                                let stream = 'Other';
                                if (tx.reference_type === 'job_posting') {
                                  stream = 'Job Posting Fee';
                                } else if (tx.reference_type === 'job_application') {
                                  stream = 'Applicant Acceptance Fee';
                                } else if (tx.transaction_type === 'platform_revenue') {
                                  stream = 'Cancellation Platform Share';
                                }

                                return (
                                  <tr key={tx.id} className="hover:bg-slate-50/30">
                                    <td className="py-3 whitespace-nowrap text-gray-500 font-mono">
                                      {new Date(tx.created_at).toLocaleString()}
                                    </td>
                                    <td className="py-3 font-bold text-[#0e2a4d]">
                                      {tx.owner_name}
                                    </td>
                                    <td className="py-3 capitalize">
                                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-50 border border-gray-100 text-slate-700">
                                        {tx.owner_type}
                                      </span>
                                    </td>
                                    <td className="py-3 whitespace-nowrap font-bold text-[#0e2a4d]">
                                      {stream}
                                    </td>
                                    <td className="py-3 text-right font-extrabold text-indigo-700">
                                      {Number(tx.amount).toFixed(2)} MC
                                    </td>
                                    <td className="py-3 pl-4 text-gray-500 max-w-xs truncate" title={tx.description}>
                                      {tx.description || '—'}
                                    </td>
                                  </tr>
                                );
                              })}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="text-center py-12 text-sm text-gray-400 font-medium border border-dashed border-gray-150 rounded-xl bg-slate-50/20">
                        <span>No revenue-generating transactions found in this period.</span>
                      </div>
                    )}
                  </div>

                </div>
              )}

              {/* TAB 5: RECEIPTS */}
              {activeTab === 'receipts' && (
                <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm space-y-6 animate-fadeIn">
                  <div className="flex items-center gap-2 mb-2">
                    <ClipboardList size={18} className="text-[#0e2a4d]" />
                    <h2 className="text-base font-bold text-[#0e2a4d]">E-Receipt Records</h2>
                  </div>

                  <div className="p-4 bg-slate-50 rounded-xl border border-gray-100 space-y-2 max-w-3xl mb-6">
                    <h3 className="text-sm font-bold text-[#0e2a4d]">Digital Receipts Active</h3>
                    <p className="text-xs text-gray-600 leading-relaxed font-medium">
                      In-app digital receipts are now automatically generated for personal instant top-ups and approved company top-ups.
                    </p>
                    <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-bold bg-blue-50 text-blue-900 border border-blue-150">
                      <Clock size={12} />
                      <span>PDF download functionality is planned for a future update.</span>
                    </div>
                  </div>

                  {receipts.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-gray-100 text-gray-400 uppercase tracking-wider font-bold">
                            <th className="pb-3 font-semibold">Issued Date</th>
                            <th className="pb-3 font-semibold">Receipt No.</th>
                            <th className="pb-3 font-semibold">Issued To</th>
                            <th className="pb-3 font-semibold text-right">Amount</th>
                            <th className="pb-3 pl-4 font-semibold">Method</th>
                            <th className="pb-3 font-semibold">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 text-gray-600 font-medium">
                          {receipts.map((rec) => (
                            <tr key={rec.id} className="hover:bg-slate-50/30">
                              <td className="py-3 whitespace-nowrap text-gray-500 font-mono">
                                {new Date(rec.issued_at).toLocaleString()}
                              </td>
                              <td className="py-3 font-mono font-bold text-[#0e2a4d]">
                                {rec.receipt_number}
                              </td>
                              <td className="py-3">
                                <span className="block font-bold text-slate-800">{rec.issued_to_company_name || rec.issued_to_name}</span>
                                <span className="block text-[10px] text-gray-400 capitalize">{rec.owner_type}</span>
                              </td>
                              <td className="py-3 text-right font-extrabold text-emerald-700">
                                {Number(rec.amount).toFixed(2)} MC
                              </td>
                              <td className="py-3 pl-4 uppercase text-[10px] font-bold text-gray-500">
                                {rec.payment_method.replace('_', ' ')}
                              </td>
                              <td className="py-3">
                                <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
                                  {rec.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-center py-12 text-sm text-gray-400 font-medium border border-dashed border-gray-150 rounded-xl bg-slate-50/20">
                      <FileText className="mx-auto mb-2 text-gray-300" size={32} />
                      <span>No receipts generated yet.</span>
                    </div>
                  )}
                </div>
              )}

            </div>
          )}
        </div>

      </div>
    </div>
  );
}
