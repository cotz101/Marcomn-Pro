'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useProfile } from '@/app/context/ProfileContext';
import { createClient } from '@/lib/supabase';
import { Briefcase, MapPin, Calendar, Building2, Loader2, ExternalLink, Building, AlertTriangle, Coins } from 'lucide-react';
import { getCandidateAcceptanceFeePreview, getUserWalletBalance, deductCandidateAcceptanceFee } from '@/app/actions/mcreditsJobs';

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
  const { userId } = useProfile();
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);

  const [isAcceptModalOpen, setIsAcceptModalOpen] = useState(false);
  const [appToAccept, setAppToAccept] = useState(null);
  const [feePreview, setFeePreview] = useState(null);
  const [walletBalance, setWalletBalance] = useState(null);
  const [acceptingError, setAcceptingError] = useState('');
  const [isAccepting, setIsAccepting] = useState(false);

  const fetchApplications = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('applications')
        .select('*, job:jobs(*)')
        .eq('applicant_id', userId)
        .order('applied_at', { ascending: false });

      if (error) throw error;
      setApplications(data || []);
    } catch (err) {
      console.error('Error fetching applications:', err.message || err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

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
      
      setApplications(prev => prev.map(a => a.id === appToAccept.id ? { ...a, status: 'Accepted' } : a));
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

  const getStatusBadge = (status) => {
    const baseClass = "inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider";
    switch (status) {
      case 'Accepted':
        return (
          <span className={`${baseClass} bg-green-100 text-green-700`}>
            Accepted
          </span>
        );
      case 'Offered':
        return (
          <span className={`${baseClass} bg-blue-100 text-blue-700`}>
            Offer Received
          </span>
        );
      case 'Expired':
        return (
          <span className={`${baseClass} bg-rose-100 text-rose-700`}>
            Offer Expired
          </span>
        );
      case 'Shortlisted':
        return (
          <span className={`${baseClass} bg-yellow-100 text-yellow-800`}>
            Shortlisted
          </span>
        );
      case 'Under Review':
        return (
          <span className={`${baseClass} bg-blue-100 text-blue-700`}>
            Under Review
          </span>
        );
      case 'Rejected':
        return (
          <span className={`${baseClass} bg-red-100 text-red-700`}>
            Rejected
          </span>
        );
      case 'Withdrawn':
        return (
          <span className={`${baseClass} bg-red-100 text-red-700`}>
            Withdrawn
          </span>
        );
      default:
        return (
          <span className={`${baseClass} bg-gray-100 text-gray-700`}>
            {status || 'Pending'}
          </span>
        );
    }
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
                className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-6 mb-4 bg-white border border-gray-100 rounded-xl shadow-sm hover:shadow-md transition-shadow gap-4"
              >
                {/* Left Side: Logo and Text block wrapped in a flex container */}
                <div className="flex items-center gap-4 min-w-0 flex-1">
                  {/* Logo Container */}
                  <div className="shrink-0">
                    {job.company_logo ? (
                      <img
                        src={job.company_logo}
                        alt={job.company}
                        className="w-12 h-12 rounded-md object-cover border border-gray-200"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-md bg-blue-50 text-blue-900 flex items-center justify-center border border-blue-100">
                        <Building size={24} />
                      </div>
                    )}
                  </div>

                  {/* Text Block */}
                  <div className="min-w-0">
                    <h3 className="text-lg font-bold text-blue-900 truncate">
                      {job.title || 'Position Unspecified'}
                    </h3>
                    
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-sm font-medium text-gray-600">
                      {job.company && (
                        <span className="flex items-center gap-1.5">
                          <Building2 size={14} className="text-gray-400 shrink-0" />
                          {job.company}
                        </span>
                      )}
                      {job.location && (
                        <span className="flex items-center gap-1.5">
                          <MapPin size={14} className="text-gray-400 shrink-0" />
                          {job.location}
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                      <Calendar size={12} />
                      Applied {getFormattedDate(app.applied_at)}
                    </p>
                  </div>
                </div>

                {/* Right Side: Actions & Badges */}
                <div className="flex flex-row sm:flex-col items-center sm:items-end gap-3 w-full sm:w-auto">
                  {getStatusBadge(app.status)}

                  {app.status === 'Offered' && (
                    <div className="flex flex-col items-center gap-1.5 w-full">
                      <button
                        onClick={() => handleOpenAcceptModal(app)}
                        className="px-4 py-1.5 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors w-full sm:w-auto text-center"
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

                  <Link
                    href={`/mservices/opportunity/${app.job_id}?source=my-applications`}
                    className="px-4 py-2 text-sm font-semibold text-blue-900 border border-blue-900 rounded-lg hover:bg-blue-50 transition-colors w-full sm:w-auto text-center mt-1"
                  >
                    View Job
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Accept Offer Modal */}
      {isAcceptModalOpen && appToAccept && (
        <div className="fixed inset-0 bg-slate-900/40 z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl">
            <h3 className="text-lg font-bold text-[#004173] mb-2">Accept Job Offer</h3>
            <p className="text-sm text-gray-600 mb-4">
              You are accepting the offer for <span className="font-semibold text-gray-800">{appToAccept.job?.title}</span> at <span className="font-semibold text-gray-800">{appToAccept.job?.company}</span>.
            </p>

            {!feePreview ? (
              <div className="flex justify-center py-6">
                <Loader2 className="animate-spin text-blue-900" size={24} />
              </div>
            ) : (
              <div className={`rounded-xl p-4 mb-6 border ${
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
                  <div className="text-sm">
                    <p className="font-semibold text-gray-800">
                      Acceptance Fee: <span className="font-bold">{feePreview.fee.toFixed(2)} MC</span>
                    </p>
                    {walletBalance !== null && (
                      <p className="text-gray-600 mt-0.5">
                        Your Wallet: <span className="font-bold">{walletBalance.toFixed(2)} MC</span>
                      </p>
                    )}
                    {acceptingError && (
                      <p className="text-red-700 font-semibold mt-1">{acceptingError}</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3">
              <button 
                onClick={() => { setIsAcceptModalOpen(false); setAppToAccept(null); }}
                className="px-5 py-2 text-sm font-bold text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
                disabled={isAccepting}
              >
                Cancel
              </button>
              <button 
                onClick={handleConfirmAcceptance}
                disabled={isAccepting || !feePreview || (acceptingError && acceptingError.includes('Insufficient'))}
                className="px-5 py-2 text-sm font-bold bg-[#004173] text-white hover:bg-blue-800 rounded-xl transition-colors shadow-sm disabled:bg-slate-300 disabled:text-gray-500"
              >
                {isAccepting ? 'Processing...' : 'Confirm Acceptance'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
