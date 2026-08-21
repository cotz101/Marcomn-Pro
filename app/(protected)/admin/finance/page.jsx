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
  ClipboardList,
  ChevronLeft,
  ChevronRight,
  ArrowDown,
  ArrowUp,
  X
} from 'lucide-react';
import { 
  getFinanceDashboardSummary, 
  getFinanceTransactions, 
  getTopupReport 
} from '@/app/actions/adminFinance';
import { getAdminReceipts } from '@/app/actions/mcreditReceipts';
import { 
  getAdminRefundRequests, 
  rejectRefundRequest, 
  approveRefundRequest 
} from '@/app/actions/mcreditRefunds';
import { getAdminAdvanceRequests, closeDisputeAdmin } from '@/app/actions/advances';

export default function AdminFinancePage() {
  const router = useRouter();
  const { profile, showToast } = useProfile();

  const isLegacyAdmin = profile && ['super_admin', 'admin', 'brand_manager'].includes(profile.global_role);
  
  const hasFinanceView = profile && (profile.admin_permissions?.includes('can_view_finance_reports') || isLegacyAdmin);
  const hasRefundView = profile && (
    profile.admin_permissions?.includes('can_view_wallet_summary') || 
    profile.admin_permissions?.includes('can_manage_refund_reviews') || 
    isLegacyAdmin
  );
  const isAuthorized = hasFinanceView || hasRefundView;

  // States
  const [activeTab, setActiveTab] = useState('overview'); // overview, transactions, topups, revenue, receipts, refunds
  const [showFilters, setShowFilters] = useState(false);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [topupReport, setTopupReport] = useState(null);
  const [receipts, setReceipts] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [dateSortOrder, setDateSortOrder] = useState('desc');
  const itemsPerPage = 10;

  // Refund states
  const [refundRequests, setRefundRequests] = useState([]);
  const [enableStripeRefunds, setEnableStripeRefunds] = useState(false);
  const [selectedRefundRequest, setSelectedRefundRequest] = useState(null);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [adminNote, setAdminNote] = useState('');
  const [approvedAmount, setApprovedAmount] = useState('');
  const [submittingAction, setSubmittingAction] = useState(false);

  // Advance Payment states
  const [advanceRequests, setAdvanceRequests] = useState([]);
  const [selectedAdvanceRequest, setSelectedAdvanceRequest] = useState(null);
  const [isAdvanceReviewModalOpen, setIsAdvanceReviewModalOpen] = useState(false);
  const [adminAdvanceNote, setAdminAdvanceNote] = useState('');
  const [isClosingDispute, setIsClosingDispute] = useState(false);

  // Set default tab once profile loads
  useEffect(() => {
    if (profile) {
      const hasFinance = profile.admin_permissions?.includes('can_view_finance_reports') || isLegacyAdmin;
      if (!hasFinance && (profile.admin_permissions?.includes('can_view_wallet_summary') || profile.admin_permissions?.includes('can_manage_refund_reviews'))) {
        setActiveTab('refunds');
      }
    }
  }, [profile, isLegacyAdmin]);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setCurrentPage(1);
    setDateSortOrder('desc');
  };

  const toggleDateSort = () => {
    setDateSortOrder(prev => prev === 'desc' ? 'asc' : 'desc');
    setCurrentPage(1);
  };

  const sortArrayByDate = (arr, dateField = 'created_at') => {
    return [...arr].sort((a, b) => {
      const timeA = new Date(a[dateField]).getTime();
      const timeB = new Date(b[dateField]).getTime();
      return dateSortOrder === 'desc' ? timeB - timeA : timeA - timeB;
    });
  };

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
      const promises = [];
      
      // Only fetch finance metrics if authorized
      if (hasFinanceView) {
        promises.push(getFinanceDashboardSummary(activeFilters));
        promises.push(getFinanceTransactions(activeFilters));
        promises.push(getTopupReport(activeFilters));
        promises.push(getAdminReceipts());
      } else {
        promises.push(Promise.resolve({ success: true, summary: null }));
        promises.push(Promise.resolve({ success: true, transactions: [] }));
        promises.push(Promise.resolve({ success: true, report: null }));
        promises.push(Promise.resolve([]));
      }

      // Always fetch refunds if authorized to view them
      if (hasRefundView) {
        promises.push(getAdminRefundRequests());
      } else {
        promises.push(Promise.resolve({ success: true, requests: [], enableStripeRefunds: false }));
      }

      // Always fetch advance requests for admin review
      promises.push(getAdminAdvanceRequests());

      const [summaryRes, txsRes, topupRes, receiptsData, refundRes, advRes] = await Promise.all(promises);

      if (hasFinanceView) {
        if (summaryRes.success) setSummary(summaryRes.summary);
        if (txsRes.success) setTransactions(txsRes.transactions);
        if (topupRes.success) setTopupReport(topupRes.report);
        setReceipts(receiptsData || []);
      }

      if (hasRefundView) {
        if (refundRes.success) {
          setRefundRequests(refundRes.requests || []);
          setEnableStripeRefunds(refundRes.enableStripeRefunds || false);
        } else {
          showToast('Error loading refund requests: ' + refundRes.error, 'error');
        }
      }

      if (advRes) {
        if (advRes.success) {
          setAdvanceRequests(advRes.requests || []);
        } else {
          showToast('Error loading advance requests: ' + advRes.error, 'error');
        }
      }

      if (hasFinanceView && (!summaryRes.success || !txsRes.success || !topupRes.success)) {
        showToast('Error loading some reporting data', 'error');
      }
    } catch (err) {
      console.error('Failed to load dashboard metrics:', err);
      showToast('Internal error loading finance dashboard metrics', 'error');
    } finally {
      setLoading(false);
    }
  }, [isAuthorized, hasFinanceView, hasRefundView, activeFilters, showToast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleApproveRefund = async () => {
    if (!selectedRefundRequest || submittingAction) return;

    if (!approvedAmount || Number(approvedAmount) <= 0) {
      showToast('Approved amount must be greater than 0', 'error');
      return;
    }

    if (Number(approvedAmount) > Number(selectedRefundRequest.max_refundable_mcredits_snapshot)) {
      showToast(`Approved amount cannot exceed max refundable snapshot of ${Number(selectedRefundRequest.max_refundable_mcredits_snapshot).toFixed(2)} MC`, 'error');
      return;
    }

    setSubmittingAction(true);
    try {
      const response = await fetch(`/api/admin/mcredits/refund-requests/${selectedRefundRequest.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          approvedMcredits: Number(approvedAmount),
          adminNote: adminNote || null
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        let parsedError;
        try {
          parsedError = JSON.parse(errText);
        } catch (_) {}
        throw new Error(parsedError?.error || errText || 'Failed to approve refund request');
      }

      showToast('Refund request approved and processed successfully', 'success');
      setIsReviewModalOpen(false);
      setSelectedRefundRequest(null);
      fetchData(); // Reload requests list
    } catch (err) {
      console.error('Approve refund error:', err);
      showToast(err.message || 'Failed to approve refund request', 'error');
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleRejectRefund = async () => {
    if (!selectedRefundRequest || submittingAction) return;

    setSubmittingAction(true);
    try {
      const response = await fetch(`/api/admin/mcredits/refund-requests/${selectedRefundRequest.id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminNote: adminNote || null
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        let parsedError;
        try {
          parsedError = JSON.parse(errText);
        } catch (_) {}
        throw new Error(parsedError?.error || errText || 'Failed to reject refund request');
      }

      showToast('Refund request rejected successfully', 'success');
      setIsReviewModalOpen(false);
      setSelectedRefundRequest(null);
      fetchData(); // Reload requests list
    } catch (err) {
      console.error('Reject refund error:', err);
      showToast(err.message || 'Failed to reject refund request', 'error');
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleCloseDispute = async () => {
    if (!selectedAdvanceRequest || isClosingDispute) return;
    setIsClosingDispute(true);
    try {
      const res = await closeDisputeAdmin({
        requestId: selectedAdvanceRequest.id,
        adminNotes: adminAdvanceNote
      });
      if (!res.success) throw new Error(res.error || 'Failed to close dispute');
      
      showToast('Dispute investigation closed successfully.', 'success');
      setIsAdvanceReviewModalOpen(false);
      setSelectedAdvanceRequest(null);
      await fetchData();
    } catch (err) {
      console.error(err);
      showToast(err.message || 'An error occurred', 'error');
    } finally {
      setIsClosingDispute(false);
    }
  };

  const handleApplyFilters = (e) => {
    e.preventDefault();
    setCurrentPage(1);
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
    setCurrentPage(1);
    setActiveFilters({
      dateFrom: '',
      dateTo: '',
      ownerType: 'all',
      transactionType: 'all'
    });
  };

  const renderPagination = (totalItems, isTop = false) => {
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    if (totalPages <= 1) return null;
    return (
      <div className={`flex flex-col sm:flex-row items-center justify-between px-4 md:px-6 py-4 bg-white/50 gap-4 ${!isTop ? 'border-t border-gray-100' : 'border-b border-gray-100'}`}>
        <span className="text-sm text-gray-500 font-semibold order-2 sm:order-1">
          Page {currentPage} of {totalPages}
        </span>
        <div className="flex items-center gap-2 order-1 sm:order-2 w-full sm:w-auto justify-between sm:justify-end">
          <div className="flex gap-1.5">
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(1)}
              className="px-3 py-1.5 rounded-full text-xs font-bold bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-[#0e2a4d] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              First
            </button>
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              className="px-4 py-1.5 rounded-full text-sm font-bold bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-[#0e2a4d] disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
            >
              <ChevronLeft size={16} /> Prev
            </button>
          </div>
          <div className="flex gap-1.5">
            <button
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              className="px-4 py-1.5 rounded-full text-sm font-bold bg-[#0e2a4d] text-white hover:bg-blue-900 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
            >
              Next <ChevronRight size={16} />
            </button>
            <button
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(totalPages)}
              className="px-3 py-1.5 rounded-full text-xs font-bold bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-[#0e2a4d] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Last
            </button>
          </div>
        </div>
      </div>
    );
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
    <div className="max-w-[1280px] mx-auto px-4 py-8 pb-[calc(var(--mobile-nav-height,72px)+env(safe-area-inset-bottom)+32px)] md:pb-8 font-sans w-full">
      {/* Navigation */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => router.push('/admin')}
          className="flex items-center gap-2 text-gray-500 hover:text-[#002b4e] transition-colors text-sm font-bold cursor-pointer bg-none border-none outline-none"
        >
          <ArrowLeft size={16} />
          <span>Back to Admin Dashboard</span>
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
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none hidden md:block">
            <Coins size={120} />
          </div>
          <div className="relative z-10 px-4 py-4 md:px-6 md:py-5 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex flex-col items-start max-w-2xl w-full">
              <h1 className="text-xl md:text-2xl font-extrabold text-[#0e2a4d] inline-flex items-center gap-3 bg-[#e0f2fe] px-4 py-1.5 rounded-md w-fit">
                Platform Finance Dashboard
              </h1>
              <p className="text-sm text-gray-500 mt-3 font-medium px-1">
                Review MCredits movement, top-ups, platform revenue, refunds, and wallet activity.
              </p>
              <div className="mt-2 ml-1 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-100">
                <AlertTriangle size={10} />
                <span>MCredits reporting includes Stripe top-ups, wallet movements, platform fees, refunds, and related transaction records. Payment-provider settlement remains subject to Stripe records and availability.</span>
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
        </div>

        {/* Filter Bar (Row 2) */}
        <div className="bg-white border border-gray-100 rounded-2xl px-4 py-4 md:px-6 md:py-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Filter size={16} className="text-[#0e2a4d]" />
              <h2 className="text-sm font-bold text-[#0e2a4d]">Filter Reports</h2>
            </div>
            <button
              type="button"
              onClick={() => setShowFilters(!showFilters)}
              className="md:hidden text-xs font-bold text-gray-500 hover:text-[#0e2a4d] border border-gray-200 px-3 py-1.5 rounded-lg"
            >
              {showFilters ? 'Hide Filters' : 'Show Filters'}
            </button>
          </div>
          <form onSubmit={handleApplyFilters} className={`grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 items-end ${showFilters ? 'grid' : 'hidden md:grid'}`}>
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
        <div className="flex bg-gray-100/70 p-1.5 rounded-full gap-2 overflow-x-auto w-full flex-nowrap hide-scrollbar mb-2">
          {hasFinanceView && (
            <>
              <button
                onClick={() => handleTabChange('overview')}
                className={`min-h-[36px] px-4 text-sm md:text-[15px] font-semibold transition-all rounded-full outline-none focus:outline-none whitespace-nowrap cursor-pointer flex-shrink-0 md:flex-1 text-center ${
                  activeTab === 'overview'
                    ? 'bg-[#0e2a4d] text-white shadow-md'
                    : 'bg-transparent text-gray-600 hover:text-[#0e2a4d] hover:bg-white/60'
                }`}
              >
                Overview
              </button>
              <button
                onClick={() => handleTabChange('transactions')}
                className={`min-h-[36px] px-4 text-sm md:text-[15px] font-semibold transition-all rounded-full outline-none focus:outline-none whitespace-nowrap cursor-pointer flex-shrink-0 md:flex-1 text-center ${
                  activeTab === 'transactions'
                    ? 'bg-[#0e2a4d] text-white shadow-md'
                    : 'bg-transparent text-gray-600 hover:text-[#0e2a4d] hover:bg-white/60'
                }`}
              >
                Transactions
              </button>
              <button
                onClick={() => handleTabChange('topups')}
                className={`min-h-[36px] px-4 text-sm md:text-[15px] font-semibold transition-all rounded-full outline-none focus:outline-none whitespace-nowrap cursor-pointer flex-shrink-0 md:flex-1 text-center ${
                  activeTab === 'topups'
                    ? 'bg-[#0e2a4d] text-white shadow-md'
                    : 'bg-transparent text-gray-600 hover:text-[#0e2a4d] hover:bg-white/60'
                }`}
              >
                Top-Up Report
              </button>
              <button
                onClick={() => handleTabChange('revenue')}
                className={`min-h-[36px] px-4 text-sm md:text-[15px] font-semibold transition-all rounded-full outline-none focus:outline-none whitespace-nowrap cursor-pointer flex-shrink-0 md:flex-1 text-center ${
                  activeTab === 'revenue'
                    ? 'bg-[#0e2a4d] text-white shadow-md'
                    : 'bg-transparent text-gray-600 hover:text-[#0e2a4d] hover:bg-white/60'
                }`}
              >
                Platform Revenue
              </button>
              <button
                onClick={() => handleTabChange('receipts')}
                className={`min-h-[36px] px-4 text-sm md:text-[15px] font-semibold transition-all rounded-full outline-none focus:outline-none whitespace-nowrap cursor-pointer flex-shrink-0 md:flex-1 text-center ${
                  activeTab === 'receipts'
                    ? 'bg-[#0e2a4d] text-white shadow-md'
                    : 'bg-transparent text-gray-600 hover:text-[#0e2a4d] hover:bg-white/60'
                }`}
              >
                Receipts
              </button>
            </>
          )}
          {hasRefundView && (
            <button
              onClick={() => handleTabChange('refunds')}
              className={`min-h-[36px] px-4 text-sm md:text-[15px] font-semibold transition-all rounded-full outline-none focus:outline-none whitespace-nowrap cursor-pointer flex-shrink-0 md:flex-1 text-center ${
                activeTab === 'refunds'
                  ? 'bg-[#0e2a4d] text-white shadow-md'
                  : 'bg-transparent text-gray-600 hover:text-[#0e2a4d] hover:bg-white/60'
              }`}
            >
              Refund Requests
            </button>
          )}
          {isAuthorized && (
            <button
              onClick={() => handleTabChange('advances')}
              className={`min-h-[36px] px-4 text-sm md:text-[15px] font-semibold transition-all rounded-full outline-none focus:outline-none whitespace-nowrap cursor-pointer flex-shrink-0 md:flex-1 text-center ${
                activeTab === 'advances'
                  ? 'bg-[#0e2a4d] text-white shadow-md'
                  : 'bg-transparent text-gray-600 hover:text-[#0e2a4d] hover:bg-white/60'
              }`}
            >
              Advance Disputes
            </button>
          )}
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
                  <div className="grid grid-rows-2 grid-flow-col auto-cols-[280px] lg:grid-rows-none lg:grid-flow-row lg:grid-cols-3 lg:auto-cols-auto gap-4 lg:gap-6 overflow-x-auto max-w-full pb-4 lg:pb-0 snap-x hide-scrollbar">
                    {/* Card 1: Total Credits In */}
                    <div className="bg-white border border-gray-100 rounded-2xl px-4 py-4 md:px-5 md:py-5 shadow-sm flex items-start gap-4 snap-start">
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
                    <div className="bg-white border border-gray-100 rounded-2xl px-4 py-4 md:px-5 md:py-5 shadow-sm flex items-start gap-4 snap-start">
                      <div className="p-3 bg-red-50 text-red-600 rounded-xl">
                        <TrendingDown size={20} />
                      </div>
                      <div className="min-w-0">
                        <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">Total Credits Out</span>
                        <span className="block text-lg font-extrabold text-red-700 mt-1">-{summary.totalCreditsOut.toFixed(2)} MC</span>
                        <span className="block text-[10px] text-gray-400 mt-0.5">Total spent/deducted</span>
                      </div>
                    </div>

                    {/* Card 4: Top-Up Volume */}
                    <div className="bg-white border border-gray-100 rounded-2xl px-4 py-4 md:px-5 md:py-5 shadow-sm flex items-start gap-4 snap-start">
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

                    {/* Card 6a: Approved Stripe Top-Ups */}
                    <div className="bg-white border border-gray-100 rounded-2xl px-4 py-4 md:px-5 md:py-5 shadow-sm flex items-start gap-4 snap-start">
                      <div className="p-3 bg-indigo-50 text-indigo-900 rounded-xl">
                        <CreditCard size={20} />
                      </div>
                      <div className="min-w-0">
                        <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">Stripe Top-Ups</span>
                        <span className="block text-lg font-extrabold text-[#0e2a4d] mt-1">{(summary.stripeTopupsAmount || 0).toFixed(2)} MC</span>
                        <span className="block text-[10px] text-gray-400 mt-0.5">{(summary.stripeTopupsCount || 0)} payments completed</span>
                      </div>
                    </div>

                    {/* Card 6b: Approved Manual Top-Ups */}
                    <div className="bg-white border border-gray-100 rounded-2xl px-4 py-4 md:px-5 md:py-5 shadow-sm flex items-start gap-4 snap-start">
                      <div className="p-3 bg-blue-50 text-blue-950 rounded-xl">
                        <Coins size={20} className="text-blue-900" />
                      </div>
                      <div className="min-w-0">
                        <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">Manual Top-Ups</span>
                        <span className="block text-lg font-extrabold text-[#0e2a4d] mt-1">{(summary.manualTopupsAmount || 0).toFixed(2)} MC</span>
                        <span className="block text-[10px] text-gray-400 mt-0.5">{(summary.manualTopupsCount || 0)} requests approved</span>
                      </div>
                    </div>

                    {/* Card 5: Pending Top-Ups */}
                    <div className="bg-white border border-gray-100 rounded-2xl px-4 py-4 md:px-5 md:py-5 shadow-sm flex items-start gap-4 min-w-[260px] lg:min-w-0 snap-start shrink-0">
                      <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
                        <Clock size={20} />
                      </div>
                      <div className="min-w-0">
                        <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">Pending Top-Ups</span>
                        <span className="block text-lg font-extrabold text-[#0e2a4d] mt-1">{summary.totalPendingTopups} Pending</span>
                        <span className="block text-[10px] text-gray-400 mt-0.5">Awaiting admin review</span>
                      </div>
                    </div>

                    {/* Card 3: Platform MC Balance */}
                    <div className="bg-white border border-gray-100 rounded-2xl px-4 py-4 md:px-5 md:py-5 shadow-sm flex items-start gap-4 snap-start">
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
                    <div className="bg-white border border-gray-100 rounded-2xl px-4 py-4 md:px-5 md:py-5 shadow-sm flex items-start gap-4 snap-start">
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
                    <div className="bg-white border border-gray-100 rounded-2xl px-4 py-4 md:px-5 md:py-5 shadow-sm flex items-start gap-4 snap-start">
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
                    <div className="bg-white border border-gray-100 rounded-2xl px-4 py-4 md:px-5 md:py-5 shadow-sm flex items-start gap-4 snap-start">
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
                  <div className="bg-white border border-gray-100 rounded-2xl px-4 py-4 md:px-6 md:py-5 shadow-sm overflow-hidden">
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-2">
                        <History size={18} className="text-[#0e2a4d]" />
                        <h2 className="text-base font-bold text-[#0e2a4d]">Recent Activity</h2>
                      </div>
                      <button
                        onClick={() => handleTabChange('transactions')}
                        className="text-xs font-bold text-blue-900 hover:underline cursor-pointer"
                      >
                        View All Transactions
                      </button>
                    </div>

                    {transactions.length > 0 ? (
                      <>
                        {renderPagination(transactions.length, true)}
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs border-collapse min-w-[700px]">
                          <thead>
                            <tr className="border-b border-gray-100 text-gray-400 uppercase tracking-wider font-bold">
                              <th 
                                className="pb-3 font-semibold cursor-pointer hover:text-gray-600 transition-colors"
                                onClick={toggleDateSort}
                              >
                                <div className="flex items-center gap-1">
                                  Date
                                  {dateSortOrder === 'desc' ? <ArrowDown size={14} /> : <ArrowUp size={14} />}
                                </div>
                              </th>
                              <th className="pb-3 font-semibold">Owner</th>
                              <th className="pb-3 font-semibold">Owner Type</th>
                              <th className="pb-3 font-semibold">Type</th>
                              <th className="pb-3 pr-4 font-semibold text-right">Amount</th>
                              <th className="pb-3 pl-4 font-semibold">Description</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 text-gray-600 font-medium">
                            {sortArrayByDate(transactions).slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((tx) => {
                              const isCredit = tx.direction === 'credit';
                              return (
                                <tr key={tx.id} className="hover:bg-slate-50/30">
                                  <td className="py-3 whitespace-nowrap text-gray-500 font-mono">
                                    <div className="hidden sm:block">{new Date(tx.created_at).toLocaleString()}</div>
                                    <div className="flex flex-col sm:hidden">
                                      <span className="font-bold text-gray-700 font-sans">{new Date(tx.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }).replace(/ /g, '-')}</span>
                                      <span className="text-[10px] text-gray-400 font-sans mt-0.5">{new Date(tx.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                    </div>
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
                                  <td className={`py-3 pr-4 text-right font-bold ${isCredit ? 'text-emerald-700' : 'text-red-700'}`}>
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
                      {renderPagination(transactions.length)}
                    </>
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
                <div className="bg-white border border-gray-100 rounded-2xl px-4 py-4 md:px-6 md:py-5 shadow-sm overflow-hidden animate-fadeIn">
                  <div className="flex items-center gap-2 mb-6">
                    <History size={18} className="text-[#0e2a4d]" />
                    <h2 className="text-base font-bold text-[#0e2a4d]">Wallet Transactions</h2>
                  </div>

                  {transactions.length > 0 ? (
                    <>
                      {renderPagination(transactions.length, true)}
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse min-w-[900px]">
                        <thead>
                          <tr className="border-b border-gray-100 text-gray-400 uppercase tracking-wider font-bold">
                            <th 
                              className="pb-3 font-semibold cursor-pointer hover:text-gray-600 transition-colors"
                              onClick={toggleDateSort}
                            >
                              <div className="flex items-center gap-1">
                                Date
                                {dateSortOrder === 'desc' ? <ArrowDown size={14} /> : <ArrowUp size={14} />}
                              </div>
                            </th>
                            <th className="pb-3 font-semibold">Owner</th>
                            <th className="pb-3 font-semibold">Owner Type</th>
                            <th className="pb-3 font-semibold">Type</th>
                            <th className="pb-3 pr-4 font-semibold text-right">Amount</th>
                            <th className="pb-3 pr-4 font-semibold text-right">Balance After</th>
                            <th className="pb-3 pl-4 font-semibold">Description</th>
                            <th className="pb-3 font-semibold">Reference</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 text-gray-600 font-medium">
                          {sortArrayByDate(transactions).slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((tx) => {
                            const isCredit = tx.direction === 'credit';
                            return (
                              <tr key={tx.id} className="hover:bg-slate-50/30">
                                <td className="py-3 whitespace-nowrap text-gray-500 font-mono">
                                  <div className="hidden sm:block">{new Date(tx.created_at).toLocaleString()}</div>
                                  <div className="flex flex-col sm:hidden">
                                    <span className="font-bold text-gray-700 font-sans">{new Date(tx.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }).replace(/ /g, '-')}</span>
                                    <span className="text-[10px] text-gray-400 font-sans mt-0.5">{new Date(tx.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                  </div>
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
                                <td className={`py-3 pr-4 text-right font-bold ${isCredit ? 'text-emerald-700' : 'text-red-700'}`}>
                                  {isCredit ? '+' : '-'}{Number(tx.amount).toFixed(2)} MC
                                </td>
                                <td className="py-3 pr-4 text-right font-mono text-gray-500">
                                  {tx.balance_after !== null && tx.balance_after !== undefined ? `${Number(tx.balance_after).toFixed(2)} MC` : '—'}
                                </td>
                                <td className="py-3 pl-4 max-w-xs text-gray-500 truncate" title={tx.description}>
                                  {tx.description || '—'}
                                </td>
                                <td className="py-3 text-gray-400 font-mono text-[10px]">
                                  {tx.reference_type ? (
                                    <div title={`${tx.reference_type}: ${tx.reference_id}`}>
                                      {tx.job_title ? (
                                        <span className="capitalize block text-[#0e2a4d] font-bold">
                                          {tx.reference_type === 'job_posting' ? 'Job posting fee' : 'Applicant acceptance fee'} <br/> <span className="text-gray-600 font-medium">{tx.job_title}</span>
                                        </span>
                                      ) : (
                                        <>
                                          <span className="capitalize block text-gray-600 font-bold">{tx.reference_type.replace('_', ' ')}</span>
                                          <span className="block mt-0.5">{tx.reference_id?.substring(0, 8)}...</span>
                                        </>
                                      )}
                                    </div>
                                  ) : '—'}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    {renderPagination(transactions.length)}
                  </>
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
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
                    <div className="bg-white border border-gray-100 rounded-2xl px-4 py-4 md:px-5 md:py-5 shadow-sm">
                      <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">Approved Amount</span>
                      <span className="block text-lg font-extrabold text-[#0e2a4d] mt-1">{topupReport.approvedAmount.toFixed(2)} MC</span>
                      <span className="block text-[10px] text-gray-400 mt-0.5">{topupReport.totalApproved} approved requests</span>
                    </div>
                    
                    <div className="bg-white border border-gray-100 rounded-2xl px-4 py-4 md:px-5 md:py-5 shadow-sm">
                      <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">Pending Amount</span>
                      <span className="block text-lg font-extrabold text-amber-600 mt-1">{topupReport.pendingAmount.toFixed(2)} MC</span>
                      <span className="block text-[10px] text-gray-400 mt-0.5">{topupReport.totalPending} requests awaiting review</span>
                    </div>

                    <div className="bg-white border border-gray-100 rounded-2xl px-4 py-4 md:px-5 md:py-5 shadow-sm">
                      <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">Personal Top-Ups</span>
                      <span className="block text-lg font-extrabold text-[#0e2a4d] mt-1">{topupReport.userApprovedAmount.toFixed(2)} MC</span>
                      <span className="block text-[10px] text-gray-400 mt-0.5">{topupReport.userApprovedCount} instant user requests</span>
                    </div>

                    <div className="bg-white border border-gray-100 rounded-2xl px-4 py-4 md:px-5 md:py-5 shadow-sm">
                      <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">Company Approved</span>
                      <span className="block text-lg font-extrabold text-[#0e2a4d] mt-1">{topupReport.companyApprovedAmount.toFixed(2)} MC</span>
                      <span className="block text-[10px] text-gray-400 mt-0.5">{topupReport.companyApprovedCount} approved corporate requests</span>
                    </div>
                  </div>

                  {/* Requests Table */}
                  <div className="bg-white border border-gray-100 rounded-2xl px-4 py-4 md:px-6 md:py-5 shadow-sm overflow-hidden">
                    <div className="flex items-center gap-2 mb-6">
                      <CreditCard size={18} className="text-[#0e2a4d]" />
                      <h2 className="text-base font-bold text-[#0e2a4d]">Top-Up Requests List</h2>
                    </div>

                    {topupReport.requests.length > 0 ? (
                      <>
                        {renderPagination(topupReport.requests.length, true)}
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs border-collapse min-w-[800px]">
                          <thead>
                            <tr className="border-b border-gray-100 text-gray-400 uppercase tracking-wider font-bold">
                              <th 
                                className="pb-3 font-semibold cursor-pointer hover:text-gray-600 transition-colors"
                                onClick={toggleDateSort}
                              >
                                <div className="flex items-center gap-1">
                                  Date
                                  {dateSortOrder === 'desc' ? <ArrowDown size={14} /> : <ArrowUp size={14} />}
                                </div>
                              </th>
                              <th className="pb-3 font-semibold">Owner</th>
                               <th className="pb-3 font-semibold">Owner Type</th>
                               <th className="pb-3 font-semibold">Method</th>
                               <th className="pb-3 pr-4 font-semibold text-right">Amount</th>
                               <th className="pb-3 font-semibold">Status</th>
                               <th className="pb-3 pl-4 font-semibold">Remarks / Reference</th>
                               <th className="pb-3 font-semibold">Requested By</th>
                             </tr>
                           </thead>
                           <tbody className="divide-y divide-gray-100 text-gray-600 font-medium">
                             {sortArrayByDate(topupReport.requests).slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((req) => {
                               return (
                                 <tr key={req.id} className="hover:bg-slate-50/30">
                                   <td className="py-3 whitespace-nowrap text-gray-500 font-mono">
                                     <div className="hidden sm:block">{new Date(req.created_at).toLocaleString()}</div>
                                     <div className="flex flex-col sm:hidden">
                                       <span className="font-bold text-gray-700 font-sans">{new Date(req.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }).replace(/ /g, '-')}</span>
                                       <span className="text-[10px] text-gray-400 font-sans mt-0.5">{new Date(req.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                     </div>
                                   </td>
                                   <td className="py-3">
                                     <span className="font-bold text-[#0e2a4d]">{req.owner_name}</span>
                                   </td>
                                   <td className="py-3 capitalize">
                                     <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-50 border border-gray-100 text-slate-700">
                                       {req.owner_type}
                                     </span>
                                   </td>
                                   <td className="py-3">
                                     <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                       req.payment_method === 'stripe'
                                         ? 'bg-indigo-50 text-indigo-700 border-indigo-100'
                                         : 'bg-slate-50 text-slate-600 border-slate-100'
                                     }`}>
                                       {req.payment_method === 'stripe' ? 'Stripe' : 'Manual'}
                                     </span>
                                   </td>
                                   <td className="py-3 pr-4 text-right font-bold text-[#0e2a4d]">
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
                                   <td className="py-3 pl-4 max-w-xs text-gray-500 truncate" title={req.payment_method === 'stripe' ? req.payment_reference : req.remarks}>
                                     {req.payment_method === 'stripe' ? (
                                       <span className="font-mono text-[10px] bg-slate-50 px-1 py-0.5 rounded border border-slate-100 block truncate max-w-[200px]" title={req.payment_reference}>
                                         {req.payment_reference || 'Pending Checkout'}
                                       </span>
                                    ) : (
                                      req.remarks || '—'
                                    )}
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
                      {renderPagination(topupReport.requests.length)}
                    </>
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
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
                    <div className="bg-white border border-gray-100 rounded-2xl px-4 py-4 md:px-5 md:py-5 shadow-sm">
                      <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">Total Revenue</span>
                      <span className="block text-lg font-extrabold text-[#0e2a4d] mt-1">
                        {(summary.totalJobPostingFees + summary.totalApplicantAcceptanceFees + summary.totalPlatformRevenue).toFixed(2)} MC
                      </span>
                      <span className="block text-[10px] text-gray-400 mt-0.5">Fees & cancellation revenue</span>
                    </div>

                    <div className="bg-white border border-gray-100 rounded-2xl px-4 py-4 md:px-5 md:py-5 shadow-sm">
                      <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">Job Posting Fees</span>
                      <span className="block text-lg font-extrabold text-indigo-700 mt-1">
                        {summary.totalJobPostingFees.toFixed(2)} MC
                      </span>
                      <span className="block text-[10px] text-gray-400 mt-0.5">Paid by corporate profiles</span>
                    </div>

                    <div className="bg-white border border-gray-100 rounded-2xl px-4 py-4 md:px-5 md:py-5 shadow-sm">
                      <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">Acceptance Fees</span>
                      <span className="block text-lg font-extrabold text-violet-700 mt-1">
                        {summary.totalApplicantAcceptanceFees.toFixed(2)} MC
                      </span>
                      <span className="block text-[10px] text-gray-400 mt-0.5">Paid by job applicants</span>
                    </div>

                    <div className="bg-white border border-gray-100 rounded-2xl px-4 py-4 md:px-5 md:py-5 shadow-sm">
                      <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">Cancellation Share</span>
                      <span className="block text-lg font-extrabold text-blue-700 mt-1">
                        {summary.totalPlatformRevenue.toFixed(2)} MC
                      </span>
                      <span className="block text-[10px] text-gray-400 mt-0.5">Candidate cancellation platform cut</span>
                    </div>
                  </div>

                  {/* Revenue Transactions List */}
                  <div className="bg-white border border-gray-100 rounded-2xl px-4 py-4 md:px-6 md:py-5 shadow-sm overflow-hidden">
                    <div className="flex items-center gap-2 mb-6">
                      <DollarSign size={18} className="text-[#0e2a4d]" />
                      <h2 className="text-base font-bold text-[#0e2a4d]">Fee & Platform Revenue Log</h2>
                    </div>

                    {transactions.filter(t => 
                      t.transaction_type === 'platform_revenue' || 
                      (t.transaction_type === 'spend' && (t.reference_type === 'job_posting' || t.reference_type === 'job_application'))
                    ).length > 0 ? (
                      <>
                        {renderPagination(
                          transactions.filter(t => 
                            t.transaction_type === 'platform_revenue' || 
                            (t.transaction_type === 'spend' && (t.reference_type === 'job_posting' || t.reference_type === 'job_application'))
                          ).length, true
                        )}
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs border-collapse min-w-[800px]">
                            <thead>
                              <tr className="border-b border-gray-100 text-gray-400 uppercase tracking-wider font-bold">
                                <th 
                                  className="pb-3 font-semibold cursor-pointer hover:text-gray-600 transition-colors"
                                  onClick={toggleDateSort}
                                >
                                  <div className="flex items-center gap-1">
                                    Date
                                    {dateSortOrder === 'desc' ? <ArrowDown size={14} /> : <ArrowUp size={14} />}
                                  </div>
                                </th>
                                <th className="pb-3 font-semibold">From Account</th>
                                <th className="pb-3 font-semibold">Account Type</th>
                                <th className="pb-3 font-semibold">Revenue Stream</th>
                                <th className="pb-3 pr-4 text-right font-semibold">Amount</th>
                                <th className="pb-3 pl-4 font-semibold">Details</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 text-gray-600 font-medium">
                              {sortArrayByDate(transactions)
                                .filter(t => 
                                  t.transaction_type === 'platform_revenue' || 
                                  (t.transaction_type === 'spend' && (t.reference_type === 'job_posting' || t.reference_type === 'job_application'))
                                )
                                .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
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
                                        <div className="hidden sm:block">{new Date(tx.created_at).toLocaleString()}</div>
                                        <div className="flex flex-col sm:hidden">
                                          <span className="font-bold text-gray-700 font-sans">{new Date(tx.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }).replace(/ /g, '-')}</span>
                                          <span className="text-[10px] text-gray-400 font-sans mt-0.5">{new Date(tx.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                        </div>
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
                                      <td className="py-3 pr-4 text-right font-extrabold text-indigo-700">
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
                        {renderPagination(
                          transactions.filter(t => 
                            t.transaction_type === 'platform_revenue' || 
                            (t.transaction_type === 'spend' && (t.reference_type === 'job_posting' || t.reference_type === 'job_application'))
                          ).length
                        )}
                      </>
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
                <div className="bg-white border border-gray-100 rounded-2xl px-4 py-4 md:px-6 md:py-5 shadow-sm space-y-6 animate-fadeIn">
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
                    <>
                      {renderPagination(receipts.length, true)}
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse min-w-[700px]">
                        <thead>
                          <tr className="border-b border-gray-100 text-gray-400 uppercase tracking-wider font-bold">
                            <th 
                              className="pb-3 font-semibold cursor-pointer hover:text-gray-600 transition-colors"
                              onClick={toggleDateSort}
                            >
                              <div className="flex items-center gap-1">
                                Issued Date
                                {dateSortOrder === 'desc' ? <ArrowDown size={14} /> : <ArrowUp size={14} />}
                              </div>
                            </th>
                            <th className="pb-3 font-semibold">Receipt No.</th>
                            <th className="pb-3 font-semibold">Issued To</th>
                            <th className="pb-3 pr-4 font-semibold text-right">Amount</th>
                            <th className="pb-3 pl-4 font-semibold">Method</th>
                            <th className="pb-3 font-semibold">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 text-gray-600 font-medium">
                          {sortArrayByDate(receipts, 'issued_at').slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((rec) => (
                            <tr key={rec.id} className="hover:bg-slate-50/30">
                              <td className="py-3 whitespace-nowrap text-gray-500 font-mono">
                                <div className="hidden sm:block">{new Date(rec.issued_at).toLocaleString()}</div>
                                <div className="flex flex-col sm:hidden">
                                  <span className="font-bold text-gray-700 font-sans">{new Date(rec.issued_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }).replace(/ /g, '-')}</span>
                                  <span className="text-[10px] text-gray-400 font-sans mt-0.5">{new Date(rec.issued_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                </div>
                              </td>
                              <td className="py-3 font-mono font-bold text-[#0e2a4d]">
                                {rec.receipt_number}
                              </td>
                              <td className="py-3">
                                <span className="block font-bold text-slate-800">{rec.issued_to_company_name || rec.issued_to_name}</span>
                                <span className="block text-[10px] text-gray-400 capitalize">{rec.owner_type}</span>
                              </td>
                              <td className="py-3 pr-4 text-right font-extrabold text-emerald-700">
                                {Number(rec.amount).toFixed(2)} MC
                              </td>
                              <td className="py-3 pl-4 uppercase text-[10px] font-bold text-gray-500">
                                {rec.payment_method === 'dummy_manual' ? 'Internal Record' : rec.payment_method.replace('_', ' ')}
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
                    {renderPagination(receipts.length)}
                  </>
                ) : (
                    <div className="text-center py-12 text-sm text-gray-400 font-medium border border-dashed border-gray-150 rounded-xl bg-slate-50/20">
                      <FileText className="mx-auto mb-2 text-gray-300" size={32} />
                      <span>No receipts generated yet.</span>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 6: REFUND REQUESTS */}
              {/* TAB 6: REFUND REQUESTS */}
              {activeTab === 'refunds' && (
                <div className="bg-white border border-gray-100 rounded-2xl px-4 py-4 md:px-6 md:py-5 shadow-sm overflow-hidden animate-fadeIn">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                      <ClipboardList size={18} className="text-[#0e2a4d]" />
                      <h2 className="text-base font-bold text-[#0e2a4d]">MCredit Refund Requests</h2>
                    </div>
                  </div>

                  {refundRequests.length > 0 ? (
                    <>
                      {renderPagination(refundRequests.length, true)}
                      
                      {/* Desktop Table View */}
                      <div className="hidden md:block overflow-x-auto pb-4 custom-scrollbar">
                        <table className="w-full text-left text-xs border-collapse min-w-[900px]">
                          <thead>
                            <tr className="border-b border-gray-100 text-gray-400 uppercase tracking-wider font-bold">
                              <th 
                                className="pb-3 px-4 font-semibold cursor-pointer hover:text-gray-600 transition-colors"
                                onClick={toggleDateSort}
                              >
                                <div className="flex items-center gap-1">
                                  Date Requested
                                  {dateSortOrder === 'desc' ? <ArrowDown size={14} /> : <ArrowUp size={14} />}
                                </div>
                              </th>
                              <th className="pb-3 px-4 font-semibold">Requester</th>
                              <th className="pb-3 px-4 font-semibold">Wallet Type</th>
                              <th className="pb-3 pr-4 pl-2 font-semibold text-right">Requested MC</th>
                              <th className="pb-3 pr-4 pl-2 font-semibold text-right">Max Refundable</th>
                              <th className="pb-3 px-4 font-semibold">Reason</th>
                              <th className="pb-3 px-4 text-center font-semibold">Status</th>
                              <th className="pb-3 px-4 text-center font-semibold">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 text-gray-600 font-medium">
                            {sortArrayByDate(refundRequests).slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((req) => {
                              return (
                                <tr key={req.id} className="hover:bg-slate-50/50 transition-colors">
                                  <td className="py-4 px-4 whitespace-nowrap text-gray-500 font-mono">
                                    {new Date(req.created_at).toLocaleString()}
                                  </td>
                                  <td className="py-4 px-4">
                                    <div className="flex items-center gap-2">
                                      {req.profile?.avatar_url ? (
                                        <img 
                                          src={req.profile.avatar_url} 
                                          alt="" 
                                          className="w-6 h-6 rounded-full object-cover border border-gray-150"
                                        />
                                      ) : (
                                        <div className="w-6 h-6 rounded-full bg-[#e0f2fe] text-[#0369a1] flex items-center justify-center text-[10px] font-bold">
                                          {req.profile?.name?.charAt(0).toUpperCase() || 'U'}
                                        </div>
                                      )}
                                      <span className="font-bold text-[#0e2a4d]">{req.profile?.name || 'Unknown'}</span>
                                    </div>
                                  </td>
                                  <td className="py-4 px-4">
                                    {req.company_id ? (
                                      <span className="inline-flex flex-col">
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 border border-purple-100 text-purple-700 w-fit">Company</span>
                                        {req.company && <span className="text-[10px] text-gray-400 mt-0.5 max-w-[120px] truncate">{req.company.name}</span>}
                                      </span>
                                    ) : (
                                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 border border-blue-100 text-blue-700 w-fit">Personal</span>
                                    )}
                                  </td>
                                  <td className="py-4 pr-4 pl-2 text-right font-bold text-slate-800">
                                    {Number(req.requested_mcredits).toFixed(2)} MC
                                  </td>
                                  <td className="py-4 pr-4 pl-2 text-right font-semibold text-gray-500">
                                    {Number(req.max_refundable_mcredits_snapshot).toFixed(2)} MC
                                  </td>
                                  <td className="py-4 px-4 text-gray-500 capitalize">
                                    {req.reason.replace(/_/g, ' ')}
                                  </td>
                                  <td className="py-4 px-4 text-center whitespace-nowrap">
                                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                                      req.status === 'refunded' ? 'bg-emerald-50 border-emerald-100 text-emerald-700' :
                                      req.status === 'pending_review' ? 'bg-amber-50 border-amber-100 text-amber-700' :
                                      req.status === 'rejected' ? 'bg-red-50 border-red-100 text-red-700' :
                                      req.status === 'processing' ? 'bg-blue-50 border-blue-100 text-blue-700 animate-pulse' :
                                      'bg-gray-50 border-gray-100 text-gray-600'
                                    }`}>
                                      {req.status.replace(/_/g, ' ')}
                                    </span>
                                  </td>
                                  <td className="py-4 px-4 text-center">
                                    <button
                                      onClick={() => {
                                        setSelectedRefundRequest(req);
                                        setAdminNote(req.admin_note || '');
                                        setApprovedAmount(req.requested_mcredits.toString());
                                        setIsReviewModalOpen(true);
                                      }}
                                      className="px-3.5 py-1.5 bg-[#0e2a4d] hover:bg-blue-900 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer shadow-sm"
                                    >
                                      Review
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {/* Mobile Cards View */}
                      <div className="block md:hidden space-y-4">
                        {sortArrayByDate(refundRequests).slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((req) => (
                          <div key={req.id} className="bg-slate-50/50 hover:bg-slate-50 rounded-2xl p-5 border border-slate-100 shadow-sm space-y-4 transition-all">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] text-gray-400 font-mono font-semibold">{new Date(req.created_at).toLocaleDateString()}</span>
                              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                                req.status === 'refunded' ? 'bg-emerald-50 border-emerald-100 text-emerald-700' :
                                req.status === 'pending_review' ? 'bg-amber-50 border-amber-100 text-amber-700' :
                                req.status === 'rejected' ? 'bg-red-50 border-red-100 text-red-700' :
                                req.status === 'processing' ? 'bg-blue-50 border-blue-100 text-blue-700' :
                                'bg-gray-50 border-gray-100 text-gray-600'
                              }`}>
                                {req.status.replace(/_/g, ' ')}
                              </span>
                            </div>
                            <div className="flex items-center gap-3">
                              {req.profile?.avatar_url ? (
                                <img 
                                  src={req.profile.avatar_url} 
                                  alt="" 
                                  className="w-8 h-8 rounded-full object-cover border border-gray-200"
                                />
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-[#e0f2fe] text-[#0369a1] flex items-center justify-center text-xs font-bold border border-gray-100">
                                  {req.profile?.name?.charAt(0).toUpperCase() || 'U'}
                                </div>
                              )}
                              <div>
                                <div className="text-xs font-bold text-gray-800">{req.profile?.name || 'Unknown'}</div>
                                {req.company_id && req.company && (
                                  <div className="text-[10px] text-purple-700 font-semibold">{req.company.name} (Company)</div>
                                )}
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3 pt-3 border-t border-gray-100/80 text-xs text-gray-500">
                              <div>
                                <span className="block text-[10px] text-gray-400 uppercase font-bold mb-0.5">Requested</span>
                                <span className="font-extrabold text-blue-900">{Number(req.requested_mcredits).toFixed(2)} MC</span>
                              </div>
                              <div>
                                <span className="block text-[10px] text-gray-400 uppercase font-bold mb-0.5">Max Refundable</span>
                                <span className="font-bold text-slate-700">{Number(req.max_refundable_mcredits_snapshot).toFixed(2)} MC</span>
                              </div>
                              <div className="col-span-2">
                                <span className="block text-[10px] text-gray-400 uppercase font-bold mb-0.5">Reason</span>
                                <span className="capitalize font-semibold text-slate-600">{req.reason.replace(/_/g, ' ')}</span>
                              </div>
                            </div>
                            <div className="pt-2">
                              <button
                                onClick={() => {
                                  setSelectedRefundRequest(req);
                                  setAdminNote(req.admin_note || '');
                                  setApprovedAmount(req.requested_mcredits.toString());
                                  setIsReviewModalOpen(true);
                                }}
                                className="w-full py-2.5 bg-[#0e2a4d] hover:bg-blue-900 text-white text-xs font-bold rounded-xl transition-all cursor-pointer text-center shadow-sm"
                              >
                                Review Request
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>

                      {renderPagination(refundRequests.length)}
                    </>
                  ) : (
                    <div className="text-center py-8 text-sm text-gray-400 font-medium border border-dashed border-gray-150 rounded-xl bg-slate-50/20">
                      <span>No refund requests found.</span>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 7: ADVANCE DISPUTES */}
              {activeTab === 'advances' && (
                <div className="bg-white border border-gray-100 rounded-2xl px-4 py-4 md:px-6 md:py-5 shadow-sm overflow-hidden animate-fadeIn font-sans">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                      <Coins size={18} className="text-[#0e2a4d]" />
                      <h2 className="text-base font-bold text-[#0e2a4d]">Advance Payment Disputes</h2>
                    </div>
                  </div>

                  {advanceRequests.length > 0 ? (
                    <>
                      {renderPagination(advanceRequests.length, true)}
                      
                      {/* Desktop Table View */}
                      <div className="hidden md:block overflow-x-auto pb-4 custom-scrollbar">
                        <table className="w-full text-left text-xs border-collapse min-w-[900px]">
                          <thead>
                            <tr className="border-b border-gray-100 text-gray-400 uppercase tracking-wider font-bold">
                              <th className="pb-3 px-4 font-semibold">Date Requested</th>
                              <th className="pb-3 px-4 font-semibold">Applicant</th>
                              <th className="pb-3 px-4 font-semibold">Job Listing</th>
                              <th className="pb-3 pr-4 pl-2 font-semibold text-right">Approved / Requested</th>
                              <th className="pb-3 px-4 text-center font-semibold">Status</th>
                              <th className="pb-3 px-4 text-center font-semibold">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 text-gray-600 font-medium">
                            {sortArrayByDate(advanceRequests).slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((req) => {
                              const displayAmount = Number(req.approved_amount || req.counter_amount || req.requested_amount).toFixed(2);
                              let statusBg = "bg-gray-50 text-gray-600 border-gray-200";
                              if (req.status === 'pending') statusBg = "bg-amber-50 border-amber-100 text-amber-700";
                              else if (req.status === 'countered') statusBg = "bg-blue-50 border-blue-100 text-blue-700";
                              else if (req.status === 'approved') statusBg = "bg-green-50 border-green-100 text-green-700";
                              else if (req.status === 'transfer_recorded') statusBg = "bg-purple-50 border-purple-100 text-purple-700";
                              else if (req.status === 'confirmed') statusBg = "bg-emerald-50 border-emerald-100 text-emerald-700";
                              else if (req.status === 'rejected') statusBg = "bg-rose-50 border-rose-100 text-rose-700";
                              else if (req.status === 'disputed') statusBg = "bg-red-50 border-red-155 text-red-800 animate-pulse";
                              else if (req.status === 'review_closed') statusBg = "bg-slate-50 border-slate-200 text-slate-700";

                              return (
                                <tr key={req.id} className="hover:bg-slate-50/50 transition-colors">
                                  <td className="py-4 px-4 whitespace-nowrap text-gray-500 font-mono">
                                    {new Date(req.created_at).toLocaleString()}
                                  </td>
                                  <td className="py-4 px-4">
                                    <div className="flex items-center gap-2">
                                      {req.profile?.avatar_url ? (
                                        <img 
                                          src={req.profile.avatar_url} 
                                          alt="" 
                                          className="w-6 h-6 rounded-full object-cover border border-gray-150"
                                        />
                                      ) : (
                                        <div className="w-6 h-6 rounded-full bg-[#e0f2fe] text-[#0369a1] flex items-center justify-center text-[10px] font-bold">
                                          {req.profile?.name?.charAt(0).toUpperCase() || 'U'}
                                        </div>
                                      )}
                                      <span className="font-bold text-[#0e2a4d]">{req.profile?.name || 'Unknown'}</span>
                                    </div>
                                  </td>
                                  <td className="py-4 px-4 text-gray-700 font-bold max-w-[200px] truncate">
                                    {req.job?.title || 'Job Listing'}
                                  </td>
                                  <td className="py-4 pr-4 pl-2 text-right font-bold text-slate-800">
                                    ${displayAmount} {req.currency}
                                  </td>
                                  <td className="py-4 px-4 text-center whitespace-nowrap">
                                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${statusBg}`}>
                                      {req.status.replace(/_/g, ' ')}
                                    </span>
                                  </td>
                                  <td className="py-4 px-4 text-center">
                                    <button
                                      onClick={() => {
                                        setSelectedAdvanceRequest(req);
                                        setAdminAdvanceNote('');
                                        setIsAdvanceReviewModalOpen(true);
                                      }}
                                      className="px-3.5 py-1.5 bg-[#0e2a4d] hover:bg-blue-900 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer shadow-sm border-0"
                                    >
                                      {req.status === 'disputed' ? 'Review Dispute' : 'View Audit'}
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {/* Mobile Cards View */}
                      <div className="block md:hidden space-y-4">
                        {sortArrayByDate(advanceRequests).slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((req) => {
                          const displayAmount = Number(req.approved_amount || req.counter_amount || req.requested_amount).toFixed(2);
                          let statusBg = "bg-gray-50 text-gray-600 border-gray-200";
                          if (req.status === 'pending') statusBg = "bg-amber-50 border-amber-100 text-amber-700";
                          else if (req.status === 'countered') statusBg = "bg-blue-50 border-blue-100 text-blue-700";
                          else if (req.status === 'approved') statusBg = "bg-green-50 border-green-100 text-green-700";
                          else if (req.status === 'transfer_recorded') statusBg = "bg-purple-50 border-purple-100 text-purple-700";
                          else if (req.status === 'confirmed') statusBg = "bg-emerald-50 border-emerald-100 text-emerald-700";
                          else if (req.status === 'rejected') statusBg = "bg-rose-50 border-rose-100 text-rose-700";
                          else if (req.status === 'disputed') statusBg = "bg-red-50 border-red-155 text-red-800";
                          else if (req.status === 'review_closed') statusBg = "bg-slate-50 border-slate-200 text-slate-700";

                          return (
                            <div key={req.id} className="bg-slate-50/50 hover:bg-slate-50 rounded-2xl p-5 border border-slate-100 shadow-sm space-y-4 transition-all">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] text-gray-400 font-mono font-semibold">{new Date(req.created_at).toLocaleDateString()}</span>
                                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${statusBg}`}>
                                  {req.status.replace(/_/g, ' ')}
                                </span>
                              </div>
                              <div className="flex items-center gap-3">
                                {req.profile?.avatar_url ? (
                                  <img 
                                    src={req.profile.avatar_url} 
                                    alt="" 
                                    className="w-8 h-8 rounded-full object-cover border border-gray-200"
                                  />
                                ) : (
                                  <div className="w-8 h-8 rounded-full bg-[#e0f2fe] text-[#0369a1] flex items-center justify-center text-xs font-bold border border-gray-100">
                                    {req.profile?.name?.charAt(0).toUpperCase() || 'U'}
                                  </div>
                                )}
                                <div>
                                  <div className="text-xs font-bold text-gray-800">{req.profile?.name || 'Unknown'}</div>
                                  <div className="text-[10px] text-gray-400 font-semibold">{req.job?.title || 'Job Listing'}</div>
                                </div>
                              </div>
                              <div className="flex items-center justify-between pt-3 border-t border-gray-100/80 text-xs">
                                <div>
                                  <span className="block text-[10px] text-gray-400 uppercase font-bold mb-0.5">Amount</span>
                                  <span className="font-extrabold text-blue-900">${displayAmount} {req.currency}</span>
                                </div>
                                <button
                                  onClick={() => {
                                    setSelectedAdvanceRequest(req);
                                    setAdminAdvanceNote('');
                                    setIsAdvanceReviewModalOpen(true);
                                  }}
                                  className="px-3.5 py-1.5 bg-[#0e2a4d] hover:bg-blue-900 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer shadow-sm border-0"
                                >
                                  {req.status === 'disputed' ? 'Review Dispute' : 'View Audit'}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {renderPagination(advanceRequests.length)}
                    </>
                  ) : (
                    <div className="text-center py-12 text-sm text-gray-400 font-medium border border-dashed border-gray-150 rounded-xl bg-slate-50/20">
                      <span>No advance requests or disputes found.</span>
                    </div>
                  )}
                </div>
              )}

            </div>
          )}
        </div>
      </div>

      {/* Review Refund Request Modal */}
      {isReviewModalOpen && selectedRefundRequest && (

        <div className="modal-overlay-glass" onClick={() => { setIsReviewModalOpen(false); setSelectedRefundRequest(null); }}>
          <div 
            className="modal-content-standard max-w-lg" 
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '512px' }}
          >
            {/* Modal Header */}
            <div className="modal-header-navy">
              <h3 className="modal-title-white flex items-center gap-2">
                <ClipboardList size={20} />
                <span>Review Refund Request</span>
              </h3>
              <button
                type="button"
                onClick={() => {
                  setIsReviewModalOpen(false);
                  setSelectedRefundRequest(null);
                }}
                className="modal-close-btn-white"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6 overflow-y-auto max-h-[60vh] md:max-h-[70vh]">
              {/* Requester Information Card */}
              <div className="flex items-center gap-3 bg-slate-50/50 p-5 rounded-2xl border border-slate-100/80 shadow-sm">
                {selectedRefundRequest.profile?.avatar_url ? (
                  <img
                    src={selectedRefundRequest.profile.avatar_url}
                    alt=""
                    className="w-10 h-10 rounded-full object-cover border border-gray-200"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-[#e0f2fe] text-[#0369a1] flex items-center justify-center font-bold text-sm border border-gray-100">
                    {selectedRefundRequest.profile?.name?.charAt(0).toUpperCase() || 'U'}
                  </div>
                )}
                <div>
                  <div className="text-sm font-bold text-gray-800">{selectedRefundRequest.profile?.name || 'Unknown User'}</div>
                  <div className="text-[10px] text-gray-400 font-mono mt-0.5 select-all">User ID: {selectedRefundRequest.user_id}</div>
                  {selectedRefundRequest.company_id && (
                    <div className="text-[11px] text-purple-700 font-semibold mt-1">
                      Company: {selectedRefundRequest.company?.name || 'Unknown Company'}
                    </div>
                  )}
                </div>
              </div>

              {/* Transaction Context Card */}
              <div className="bg-slate-50/50 p-5 rounded-2xl border border-slate-100/80 shadow-sm space-y-3">
                <h4 className="text-[10px] font-extrabold text-[#0e2a4d] uppercase tracking-wider border-b border-gray-100 pb-1.5">References & IDs</h4>
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="block text-[10px] text-gray-400 uppercase font-bold mb-1">Wallet ID</span>
                    <span className="font-mono text-gray-600 block select-all break-all" title={selectedRefundRequest.wallet_id}>
                      {selectedRefundRequest.wallet_id}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-gray-400 uppercase font-bold mb-1">Top-up Request ID</span>
                    <span className="font-mono text-gray-600 block select-all break-all" title={selectedRefundRequest.topup_request_id}>
                      {selectedRefundRequest.topup_request_id || '—'}
                    </span>
                  </div>
                  {selectedRefundRequest.stripe_payment_intent_id && (
                    <div className="col-span-2">
                      <span className="block text-[10px] text-gray-400 uppercase font-bold mb-1">Stripe PaymentIntent ID</span>
                      <span className="font-mono text-[11px] text-slate-700 bg-white px-3 py-2 rounded-xl border border-slate-100 shadow-sm block break-all select-all font-semibold">
                        {selectedRefundRequest.stripe_payment_intent_id}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Amounts & Reason Card */}
              <div className="grid grid-cols-2 gap-4 p-5 bg-blue-50/40 rounded-2xl border border-blue-100/40 shadow-sm text-xs">
                <div>
                  <span className="block text-[10px] text-blue-800/60 uppercase font-bold mb-1">Requested Refund</span>
                  <span className="text-lg font-extrabold text-blue-900">{Number(selectedRefundRequest.requested_mcredits).toFixed(2)} MC</span>
                </div>
                <div>
                  <span className="block text-[10px] text-slate-500 uppercase font-bold mb-1">Max Refundable snapshot</span>
                  <span className="text-lg font-extrabold text-slate-700">{Number(selectedRefundRequest.max_refundable_mcredits_snapshot).toFixed(2)} MC</span>
                </div>
                <div className="col-span-2 pt-2 border-t border-blue-100/20">
                  <span className="block text-[10px] text-slate-500 uppercase font-bold mb-1">Reason</span>
                  <span className="font-semibold text-slate-700 capitalize">{selectedRefundRequest.reason.replace(/_/g, ' ')}</span>
                </div>
                {selectedRefundRequest.user_note && (
                  <div className="col-span-2 pt-2 border-t border-blue-100/20">
                    <span className="block text-[10px] text-slate-500 uppercase font-bold mb-1">User Note</span>
                    <p className="text-gray-600 leading-relaxed whitespace-pre-line mt-1.5 bg-white p-3.5 text-xs rounded-xl border border-gray-150 shadow-sm font-medium select-text">
                      {selectedRefundRequest.user_note}
                    </p>
                  </div>
                )}
              </div>

              {/* Status details if already processed */}
              {selectedRefundRequest.status !== 'pending_review' && (
                <div className="p-5 bg-slate-50/60 rounded-2xl border border-slate-100/80 shadow-sm text-xs space-y-3">
                  <div className="flex justify-between border-b border-gray-150/40 pb-2">
                    <span className="text-gray-400 font-bold uppercase text-[10px]">Status</span>
                    <span className={`font-extrabold capitalize ${
                      selectedRefundRequest.status === 'refunded' ? 'text-emerald-600' :
                      selectedRefundRequest.status === 'rejected' ? 'text-rose-600' :
                      'text-slate-800'
                    }`}>{selectedRefundRequest.status}</span>
                  </div>
                  {selectedRefundRequest.stripe_refund_id && (
                    <div className="flex flex-col gap-1 border-b border-gray-150/40 pb-2 font-mono text-[11px]">
                      <span className="text-gray-400 uppercase font-bold font-sans text-[10px]">Stripe Refund ID</span>
                      <span className="text-gray-600 select-all break-all">{selectedRefundRequest.stripe_refund_id}</span>
                    </div>
                  )}
                  {selectedRefundRequest.admin_note && (
                    <div>
                      <span className="text-gray-400 font-bold uppercase text-[10px] block mb-1">Previous Admin Note</span>
                      <p className="text-gray-600 italic font-medium bg-white p-3 rounded-xl border border-slate-100">{selectedRefundRequest.admin_note}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Input for approved amount & admin note (only if pending) */}
              {selectedRefundRequest.status === 'pending_review' && (
                <div className="space-y-4">
                  {/* Permission warning/error for view-only users */}
                  {!profile.admin_permissions?.includes('can_manage_refund_reviews') && (
                    <div className="p-3 bg-amber-50 text-amber-800 rounded-xl border border-amber-150 text-xs font-semibold flex items-center gap-2">
                      <ShieldAlert size={16} className="shrink-0" />
                      <span>View-Only Mode: You do not have permissions to approve or reject requests.</span>
                    </div>
                  )}

                  {profile.admin_permissions?.includes('can_manage_refund_reviews') && (
                    <div className="bg-slate-50/50 p-5 rounded-2xl border border-slate-100/80 shadow-sm space-y-4">
                      <h4 className="text-[10px] font-extrabold text-[#0e2a4d] uppercase tracking-wider border-b border-gray-100 pb-1.5">Review Decision</h4>
                      <div>
                        <label className="block text-[10px] font-extrabold text-gray-500 uppercase mb-1">
                          Approve Amount (MCredits)
                        </label>
                        <input
                          type="number"
                          step="any"
                          max={selectedRefundRequest.max_refundable_mcredits_snapshot}
                          value={approvedAmount}
                          onChange={(e) => setApprovedAmount(e.target.value)}
                          className="w-full bg-white border border-gray-200 rounded-xl px-4.5 py-3 text-sm font-semibold text-gray-700 outline-none focus:border-blue-900 transition-colors font-sans shadow-sm"
                          placeholder="Approved MCredits"
                        />
                        <span className="text-[10px] text-gray-400 font-medium mt-1.5 block">
                          Cannot exceed max refundable snapshot: {Number(selectedRefundRequest.max_refundable_mcredits_snapshot).toFixed(2)} MC
                        </span>
                      </div>

                      <div>
                        <label className="block text-[10px] font-extrabold text-gray-500 uppercase mb-1">
                          Admin Review Note
                        </label>
                        <textarea
                          rows={3}
                          value={adminNote}
                          onChange={(e) => setAdminNote(e.target.value)}
                          className="w-full bg-white border border-gray-200 rounded-xl px-4.5 py-3 text-xs font-medium text-gray-700 outline-none focus:border-blue-900 transition-colors resize-none font-sans shadow-sm"
                          placeholder="Provide audit notes for this review decision..."
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            {selectedRefundRequest.status === 'pending_review' && profile.admin_permissions?.includes('can_manage_refund_reviews') && (
              <div className="bg-slate-50 px-6 py-4.5 border-t border-gray-150/40 flex flex-col gap-3.5 font-sans">
                {/* Safety flag indicator */}
                {!enableStripeRefunds && (
                  <div className="p-4 bg-red-50 text-red-950 rounded-2xl border border-red-100 text-[11px] leading-relaxed font-semibold flex items-start gap-3 select-text shadow-sm">
                    <AlertTriangle size={18} className="shrink-0 text-red-600 mt-0.5 animate-pulse" />
                    <div>
                      <span className="font-bold block text-red-900 mb-0.5">Automated Stripe Refund Processing Unavailable</span>
                      <span>Automated Stripe refund processing is currently unavailable. This does not determine legal refund eligibility. Approved refunds must be handled through the available payment-provider workflow or another authorized administrative process, with the outcome recorded in MarComn.</span>
                    </div>
                  </div>
                )}

                <div className="flex gap-3 justify-end">
                  <button
                    type="button"
                    disabled={submittingAction}
                    onClick={handleRejectRefund}
                    className="flex-1 sm:flex-initial px-6 py-3 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-sm disabled:opacity-50"
                  >
                    {submittingAction ? 'Processing...' : 'Reject Request'}
                  </button>
                  <button
                    type="button"
                    disabled={submittingAction || !enableStripeRefunds}
                    onClick={handleApproveRefund}
                    className="flex-1 sm:flex-initial px-6 py-3 bg-[#00B4D8] hover:bg-[#0096B4] text-[#0e2a4d] disabled:bg-gray-100 disabled:text-gray-400 text-xs font-bold rounded-xl transition-all cursor-pointer shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {submittingAction ? 'Processing...' : 'Approve & Refund'}
                  </button>
                </div>
              </div>
            )}

            {/* Modal Footer for non-pending / closed requests */}
            {(selectedRefundRequest.status !== 'pending_review' || !profile.admin_permissions?.includes('can_manage_refund_reviews')) && (
              <div className="bg-slate-50 px-6 py-4 border-t border-gray-150/40 flex justify-end font-sans">
                <button
                  type="button"
                  onClick={() => {
                    setIsReviewModalOpen(false);
                    setSelectedRefundRequest(null);
                  }}
                  className="px-6 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer shadow-sm"
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      {/* Review Advance Payment Dispute Modal */}
      {isAdvanceReviewModalOpen && selectedAdvanceRequest && (() => {
        const req = selectedAdvanceRequest;
        const displayAmount = Number(req.approved_amount || req.counter_amount || req.requested_amount).toFixed(2);
        const currency = req.currency || 'USD';
        const maskReference = (val) => {
          if (!val) return '—';
          if (val.length <= 4) return '****';
          return '*'.repeat(val.length - 4) + val.slice(-4);
        };
        
        return (
          <div className="modal-overlay-glass font-sans" onClick={() => { setIsAdvanceReviewModalOpen(false); setSelectedAdvanceRequest(null); }}>
            <div 
              className="modal-content-standard max-w-lg text-left bg-white rounded-2xl shadow-2xl relative overflow-hidden" 
              onClick={(e) => e.stopPropagation()}
              style={{ maxWidth: '512px', margin: 'auto' }}
            >
              {/* Modal Header */}
              <div className="modal-header-navy bg-slate-900 text-white p-4 flex items-center justify-between rounded-t-2xl">
                <h3 className="modal-title-white flex items-center gap-2 text-base font-bold text-white">
                  <Coins size={20} />
                  <span>Review Advance Request Audit</span>
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    setIsAdvanceReviewModalOpen(false);
                    setSelectedAdvanceRequest(null);
                  }}
                  className="modal-close-btn-white text-white hover:text-gray-200 bg-transparent border-0 cursor-pointer font-bold text-lg"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-6 overflow-y-auto max-h-[60vh] md:max-h-[70vh] text-sm text-gray-700 bg-white">
                {/* Applicant Info */}
                <div className="flex items-center gap-3 bg-slate-50 p-4 rounded-xl border border-slate-100">
                  {req.profile?.avatar_url ? (
                    <img
                      src={req.profile.avatar_url}
                      alt=""
                      className="w-10 h-10 rounded-full object-cover border border-gray-200"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-[#e0f2fe] text-[#0369a1] flex items-center justify-center font-bold border border-gray-150">
                      {req.profile?.name?.charAt(0).toUpperCase() || 'U'}
                    </div>
                  )}
                  <div>
                    <div className="font-bold text-gray-800">{req.profile?.name || 'Unknown'}</div>
                    <div className="text-[10px] text-gray-400 font-mono">Applicant ID: {req.applicant_id}</div>
                    <div className="text-xs text-blue-900 font-semibold mt-0.5">{req.job?.title || 'Job Listing'}</div>
                  </div>
                </div>

                {/* Dispute / Details */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-3">
                  <h4 className="text-[10px] font-extrabold text-[#0e2a4d] uppercase tracking-wider border-b border-gray-100 pb-1.5">Offline Transfer Details</h4>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="block text-[10px] text-gray-400 font-bold mb-0.5">Approved Amount</span>
                      <span className="font-bold text-gray-800">${displayAmount} {currency}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-gray-400 font-bold mb-0.5">Payment Method</span>
                      <span className="font-semibold text-gray-800 capitalize">{(req.payment_method || '—').replace('_', ' ')}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-gray-400 font-bold mb-0.5">Transfer Date</span>
                      <span className="font-semibold text-gray-800">{req.transfer_date || '—'}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-gray-400 font-bold mb-0.5">Reference Number (Masked)</span>
                      <span className="font-mono font-semibold text-slate-800 bg-white/80 px-1.5 py-0.5 border border-slate-200 rounded">{maskReference(req.reference_number)}</span>
                    </div>
                    {req.proof_url && (
                      <div className="col-span-2 pt-1">
                        <span className="block text-[10px] text-gray-400 font-bold mb-1">Payment Proof</span>
                        <a 
                          href={`/api/advance-proofs/signed-url?requestId=${encodeURIComponent(req.id)}`}
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs text-blue-900 font-bold hover:underline"
                        >
                          View Uploaded Payment Proof
                        </a>
                      </div>
                    )}
                  </div>
                </div>

                {/* Audit Logs Notes */}
                <div className="space-y-3">
                  {req.applicant_notes && (
                    <div>
                      <span className="text-[10px] text-gray-400 font-bold uppercase block mb-1">Applicant's Justification Notes</span>
                      <p className="p-3 bg-white border border-slate-150 rounded-lg text-xs leading-relaxed italic">{req.applicant_notes}</p>
                    </div>
                  )}

                  {req.company_notes && (
                    <div>
                      <span className="text-[10px] text-gray-400 font-bold uppercase block mb-1">Company Notes / Offline Terms</span>
                      <p className="p-3 bg-white border border-slate-150 rounded-lg text-xs leading-relaxed italic">{req.company_notes}</p>
                    </div>
                  )}

                  {req.status === 'disputed' && req.dispute_reason && (
                    <div className="p-3.5 bg-rose-50 border border-rose-150 rounded-xl text-rose-900 leading-normal">
                      <span className="text-[10px] text-rose-600 font-extrabold uppercase block mb-1">Disputed Reason reported by Candidate</span>
                      <p className="text-xs font-semibold">{req.dispute_reason}</p>
                    </div>
                  )}
                </div>

                {/* Action Form */}
                {req.status === 'disputed' && (
                  <div className="space-y-4 pt-2">
                    <div className="p-3.5 bg-amber-50 border border-amber-150 rounded-xl text-[11px] leading-relaxed text-amber-900 font-semibold shadow-sm">
                      <strong>Neutral Observer Boundary:</strong> Platform administrators do not act as financial participants. Resolving/closing the dispute will transition the request to <code>review_closed</code>. This state does NOT count as confirmed.
                    </div>
                    <div>
                      <label className="block text-[10px] font-extrabold text-gray-500 uppercase mb-1">
                        Internal Administrative Review Notes *
                      </label>
                      <textarea
                        rows={3}
                        value={adminAdvanceNote}
                        onChange={(e) => setAdminAdvanceNote(e.target.value)}
                        className="w-full bg-white border border-gray-200 rounded-xl px-4.5 py-3 text-xs font-medium text-gray-700 outline-none focus:border-blue-900 transition-colors resize-none font-sans shadow-sm"
                        placeholder="Provide details about admin investigation and closure notes..."
                        required
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="bg-slate-50 px-6 py-4.5 border-t border-gray-150/40 flex justify-end gap-3 rounded-b-2xl">
                <button
                  type="button"
                  onClick={() => {
                    setIsAdvanceReviewModalOpen(false);
                    setSelectedAdvanceRequest(null);
                  }}
                  className="px-5 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer shadow-sm border-0"
                >
                  Cancel
                </button>
                {req.status === 'disputed' && (
                  <button
                    type="button"
                    disabled={isClosingDispute || !adminAdvanceNote.trim()}
                    onClick={handleCloseDispute}
                    className="px-6 py-2.5 bg-blue-900 hover:bg-blue-800 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-sm disabled:opacity-40 border-0"
                  >
                    {isClosingDispute ? 'Closing Dispute...' : 'Close Dispute'}
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
