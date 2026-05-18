'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useProfile } from '@/app/context/ProfileContext';
import { createClient } from '@/lib/supabase';
import {
  ArrowLeft,
  Briefcase,
  Loader2,
  MapPin,
  Users,
  ExternalLink,
  Calendar,
  Building2,
  FileText,
} from 'lucide-react';

const SkeletonCard = () => (
  <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm animate-pulse flex items-center justify-between gap-4">
    <div className="flex items-center gap-4 flex-1">
      <div className="w-14 h-14 rounded-full bg-gray-200 shrink-0" />
      <div className="space-y-2 flex-1">
        <div className="h-4 bg-gray-200 rounded w-1/3" />
        <div className="h-3 bg-gray-200 rounded w-1/2" />
        <div className="h-3 bg-gray-100 rounded w-1/4" />
      </div>
    </div>
    <div className="h-9 bg-gray-100 rounded-lg w-36 shrink-0" />
  </div>
);

export default function ApplicantsPage() {
  const { id } = useParams();
  const router = useRouter();
  const { userId, showToast } = useProfile();

  const [job, setJob] = useState(null);
  const [applicants, setApplicants] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    if (!userId || !id) return;

    setIsLoading(true);
    setError(null);

    try {
      const supabase = createClient();

      // ── 1. Fetch the job row ──────────────────────────────────────────────
      const { data: jobData, error: jobError } = await supabase
        .from('jobs')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (jobError) throw jobError;

      if (!jobData) {
        setError('This job posting could not be found.');
        return;
      }

      // ── 2. Ownership guard ────────────────────────────────────────────────
      const posterId = jobData.poster_id || jobData.user_id;
      if (posterId !== userId) {
        router.replace('/jobs/my-postings');
        return;
      }

      setJob(jobData);

      // ── 3. Step One: Fetch applications for this job ──────────────────────
      const { data: apps, error: appsError } = await supabase
        .from('applications')
        .select('*')
        .eq('job_id', id)
        .order('applied_at', { ascending: false });

      if (appsError) throw appsError;

      if (!apps || apps.length === 0) {
        setApplicants([]);
        return;
      }

      // ── 4. Step Two: Fetch public profiles ───────────────────────────────
      const applicantIds = apps.map((app) => app.applicant_id);
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .in('id', applicantIds);

      if (profilesError) throw profilesError;

      // ── 5. Step Three: Merge data ─────────────────────────────────────────
      const merged = apps.map((app) => {
        const profile = profilesData?.find((p) => p.id === app.applicant_id) || {};
        return { ...app, profile };
      });

      setApplicants(merged);
    } catch (err) {
      console.error('Error loading applicants page:', err.message || err);
      setError('Something went wrong while loading applicants. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [userId, id, router]);

  const handleStatusChange = async (applicationId, newStatus) => {
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('applications')
        .update({ status: newStatus })
        .eq('id', applicationId);

      if (error) throw error;

      setApplicants((prev) =>
        prev.map((app) => (app.id === applicationId ? { ...app, status: newStatus } : app))
      );

      if (showToast) {
        showToast(`Application status updated to "${newStatus}"`, 'success');
      }
    } catch (err) {
      console.error('Error updating application status:', err);
      if (showToast) {
        showToast('Failed to update application status: ' + (err.message || err), 'error');
      }
    }
  };

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getFormattedDate = (dateStr) => {
    if (!dateStr) return 'Recently';
    try {
      return new Date(dateStr).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const getStatusStyles = (status) => {
    switch (status) {
      case 'Accepted':
        return 'border-emerald-300 bg-emerald-50 text-emerald-700 focus:ring-emerald-500 focus:border-emerald-500';
      case 'Shortlisted':
        return 'border-amber-300 bg-amber-50 text-amber-700 focus:ring-amber-500 focus:border-amber-500';
      case 'Under Review':
        return 'border-blue-300 bg-blue-50 text-blue-700 focus:ring-blue-500 focus:border-blue-500';
      case 'Rejected':
        return 'border-rose-300 bg-rose-50 text-rose-700 focus:ring-rose-500 focus:border-rose-500';
      default: // 'Pending'
        return 'border-gray-300 bg-gray-50 text-gray-700 focus:ring-gray-500 focus:border-gray-500';
    }
  };

  // ── Loading state ──────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto py-8 px-6">
        {/* Back nav skeleton */}
        <div className="h-4 bg-gray-200 rounded w-40 mb-8 animate-pulse" />
        {/* Header skeleton */}
        <div className="mb-8 space-y-2">
          <div className="h-7 bg-gray-200 rounded w-1/2 animate-pulse" />
          <div className="h-4 bg-gray-100 rounded w-1/3 animate-pulse" />
        </div>
        <div className="space-y-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    );
  }

  // ── Error state ────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="max-w-5xl mx-auto py-8 px-6">
        <Link
          href="/jobs/my-postings"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-blue-700 font-medium transition-colors mb-8"
        >
          <ArrowLeft size={15} />
          Back to Job Postings
        </Link>
        <div className="bg-rose-50 border border-rose-100 rounded-xl p-8 text-center">
          <Briefcase className="mx-auto text-rose-300 mb-3" size={40} />
          <h2 className="text-lg font-bold text-rose-800 mb-1">Access Denied</h2>
          <p className="text-sm text-rose-600">{error}</p>
        </div>
      </div>
    );
  }

  // ── Main render ────────────────────────────────────────────────────────────
  return (
    <div className="max-w-5xl mx-auto py-8 px-6">
      {/* Back nav */}
      <Link
        href="/jobs/my-postings"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-blue-700 font-medium transition-colors mb-8 group"
      >
        <ArrowLeft size={15} className="group-hover:-translate-x-0.5 transition-transform" />
        Back to Job Postings
      </Link>

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-blue-900">
              Applicants for{' '}
              <span className="text-blue-700">{job?.title}</span>
            </h1>
            <div className="flex items-center gap-4 mt-2 flex-wrap">
              {job?.company && (
                <span className="inline-flex items-center gap-1.5 text-sm text-gray-500">
                  <Building2 size={13} className="text-gray-400" />
                  {job.company}
                </span>
              )}
              {job?.location && (
                <span className="inline-flex items-center gap-1.5 text-sm text-gray-500">
                  <MapPin size={13} className="text-gray-400" />
                  {job.location}
                </span>
              )}
            </div>
          </div>
          <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-2.5 text-center shrink-0">
            <p className="text-2xl font-bold text-blue-700">{applicants.length}</p>
            <p className="text-xs text-blue-500 font-medium mt-0.5">
              {applicants.length === 1 ? 'Applicant' : 'Applicants'}
            </p>
          </div>
        </div>
        <div className="mt-4 h-px bg-gray-100" />
      </div>

      {/* Applicants Roster */}
      {applicants.length === 0 ? (
        <div className="bg-white border border-gray-100 rounded-xl p-14 text-center shadow-sm">
          <Users className="mx-auto text-gray-200 mb-4" size={52} />
          <h3 className="text-lg font-bold text-gray-800 mb-1">No applications received yet</h3>
          <p className="text-sm text-gray-500 max-w-sm mx-auto leading-relaxed">
            Once candidates click the Quick Apply action on your listing, their profiles will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {applicants.map((app) => {
            const profile = app.profile || {};
            const name = profile.name || profile.full_name || 'Anonymous Applicant';
            const headline =
              profile.currentRole || profile.headline || profile.bio || 'Maritime Professional';
            const avatar = profile.avatar_url || null;
            const appliedDate = getFormattedDate(app.applied_at);
            const initials = name
              .split(' ')
              .map((n) => n[0])
              .slice(0, 2)
              .join('')
              .toUpperCase();

            return (
              <div
                key={app.id}
                className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm hover:shadow-md hover:border-blue-100 transition-all duration-200 flex items-center justify-between gap-4"
              >
                {/* Left: Avatar + Info */}
                <div className="flex items-center gap-4 min-w-0">
                  {/* Avatar */}
                  <div className="shrink-0 relative">
                    {avatar ? (
                      <img
                        src={avatar}
                        alt={name}
                        onError={(e) => {
                          e.target.style.display = 'none';
                          e.target.nextSibling.style.display = 'flex';
                        }}
                        className="w-14 h-14 rounded-full object-cover border border-gray-100 shadow-sm"
                      />
                    ) : null}
                    <div
                      className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 border border-blue-100 shadow-sm flex items-center justify-center text-blue-700 font-bold text-base"
                      style={{ display: avatar ? 'none' : 'flex' }}
                    >
                      {initials || '?'}
                    </div>
                  </div>

                  {/* Info */}
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-blue-950 truncate">{name}</h3>
                    <p className="text-xs text-gray-500 truncate mt-0.5 font-medium">{headline}</p>
                    <p className="inline-flex items-center gap-1 text-[11px] text-gray-400 mt-1.5">
                      <Calendar size={10} />
                      Applied {appliedDate}
                    </p>
                  </div>
                </div>

                {/* Right: Status + Actions */}
                <div className="flex flex-col items-end gap-2.5 shrink-0">

                  {/* Status badge / select */}
                  {app.status === 'Withdrawn' ? (
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-100 self-end">
                      Withdrawn
                    </span>
                  ) : (
                    <select
                      value={app.status || 'Pending'}
                      onChange={(e) => handleStatusChange(app.id, e.target.value)}
                      className={`bg-white border text-xs font-semibold rounded-md px-3 py-1 focus:outline-none transition-all duration-200 self-end ${getStatusStyles(
                        app.status || 'Pending'
                      )}`}
                    >
                      <option value="Pending">Pending</option>
                      <option value="Under Review">Under Review</option>
                      <option value="Shortlisted">Shortlisted</option>
                      <option value="Accepted">Accepted</option>
                      <option value="Rejected">Rejected</option>
                    </select>
                  )}

                  {/* Document pills */}
                  {Array.isArray(app.documents) && app.documents.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 justify-end max-w-xs">
                      {app.documents.map((doc, i) => (
                        <a
                          key={i}
                          href={doc.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-gray-100 text-gray-700 hover:bg-gray-200 text-xs font-semibold rounded-full transition-colors"
                          title={doc.name}
                        >
                          <FileText size={11} />
                          <span className="max-w-[100px] truncate">{doc.name}</span>
                        </a>
                      ))}
                    </div>
                  )}

                  {/* Profile CTA */}
                  <button
                    onClick={() => router.push(`/profile/${app.applicant_id}`)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold rounded-lg transition-colors shadow-sm"
                  >
                    View Full Profile
                    <ExternalLink size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
