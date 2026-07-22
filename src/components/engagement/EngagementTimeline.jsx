'use client';

import React from 'react';
import { 
  CheckCircle2, 
  Circle, 
  Calendar, 
  MessageSquare, 
  User, 
  Building, 
  Briefcase,
  DollarSign,
  FileCheck,
  ClipboardCheck,
  ShieldCheck
} from 'lucide-react';

/**
 * Builds chronological timeline events from jobOrder and optional application objects.
 */
export function buildEngagementTimeline(jobOrder, application = null) {
  const events = [];
  const app = application || jobOrder?.application;

  // 1. Applied
  const appliedAt = app?.applied_at || jobOrder?.created_at;
  if (appliedAt) {
    events.push({
      id: 'applied',
      title: 'Application Submitted',
      actor: 'Applicant',
      timestamp: appliedAt,
      icon: Briefcase,
      color: 'text-blue-500 bg-blue-50 border-blue-200',
      description: 'The applicant submitted their application for this opportunity.'
    });
  }

  // 2. Shortlisted
  const statusLower = (app?.status || '').toLowerCase();
  const orderStatusLower = (jobOrder?.status || '').toLowerCase();
  const isShortlisted = statusLower === 'shortlisted' || 
                        statusLower === 'offered' || 
                        statusLower === 'accepted' || 
                        statusLower === 'completed' || 
                        orderStatusLower !== '';

  if (isShortlisted) {
    events.push({
      id: 'shortlisted',
      title: 'Applicant Shortlisted',
      actor: 'Company',
      timestamp: app?.updated_at || null,
      icon: FileCheck,
      color: 'text-indigo-500 bg-indigo-50 border-indigo-200',
      description: 'The company shortlisted the applicant for this opportunity.'
    });
  }

  // 3. Job Offer Sent
  const offerSentAt = app?.offer_sent_at;
  const isOffered = statusLower === 'offered' || 
                    statusLower === 'accepted' || 
                    statusLower === 'completed' || 
                    orderStatusLower !== '';

  if (offerSentAt || isOffered) {
    events.push({
      id: 'offered',
      title: 'Job Offer Sent',
      actor: 'Company',
      timestamp: offerSentAt || null,
      icon: Calendar,
      color: 'text-amber-500 bg-amber-50 border-amber-200',
      description: 'The company extended a formal job offer.'
    });
  }

  // 4. Offer Accepted / Work Started
  const acceptedAt = jobOrder?.accepted_at || jobOrder?.created_at;
  const isAccepted = statusLower === 'accepted' || 
                     statusLower === 'completed' || 
                     orderStatusLower !== '';

  if (acceptedAt || isAccepted) {
    events.push({
      id: 'accepted',
      title: 'Offer Accepted / Work Started',
      actor: 'Applicant',
      timestamp: acceptedAt || null,
      icon: CheckCircle2,
      color: 'text-emerald-500 bg-emerald-50 border-emerald-200',
      description: 'The applicant accepted the job offer, and the engagement has officially started.'
    });
  }

  // 5. Applicant Marked Work Completed
  const workCompletedAt = jobOrder?.work_completed_by_applicant_at;
  const isWorkCompleted = workCompletedAt || 
                           orderStatusLower === 'work completed by applicant' || 
                           orderStatusLower === 'completion confirmed by company' || 
                           orderStatusLower === 'payment confirmed by applicant' || 
                           orderStatusLower === 'completed';

  if (isWorkCompleted) {
    events.push({
      id: 'work_completed',
      title: 'Applicant Marked Work Completed',
      actor: 'Applicant',
      timestamp: workCompletedAt || null,
      icon: ClipboardCheck,
      color: 'text-emerald-600 bg-emerald-50 border-emerald-200',
      note: jobOrder?.work_completion_note,
      description: 'The applicant completed the assigned tasks and requested company review.'
    });
  }

  // 6. Company Confirmed Work Completion
  const companyConfirmedAt = jobOrder?.completion_confirmed_by_company_at;
  const isCompanyConfirmed = companyConfirmedAt || 
                             orderStatusLower === 'completion confirmed by company' || 
                             orderStatusLower === 'payment confirmed by applicant' || 
                             orderStatusLower === 'completed';

  if (isCompanyConfirmed) {
    events.push({
      id: 'company_confirmed',
      title: 'Company Confirmed Completion',
      actor: 'Company',
      timestamp: companyConfirmedAt || null,
      icon: ShieldCheck,
      color: 'text-blue-600 bg-blue-50 border-blue-200',
      note: jobOrder?.company_completion_note,
      description: 'The company confirmed work completion.'
    });
  }

  // 7. Applicant Confirmed Payment
  const paymentConfirmedAt = jobOrder?.payment_confirmed_by_applicant_at;
  const isPaymentConfirmed = paymentConfirmedAt || 
                             orderStatusLower === 'payment confirmed by applicant' || 
                             orderStatusLower === 'completed';

  if (isPaymentConfirmed) {
    events.push({
      id: 'payment_confirmed',
      title: 'Applicant Confirmed Payment',
      actor: 'Applicant',
      timestamp: paymentConfirmedAt || null,
      icon: DollarSign,
      color: 'text-green-600 bg-green-50 border-green-200',
      note: jobOrder?.payment_confirmation_note,
      description: 'The applicant confirmed receipt of payment.'
    });
  }

  // 8. Company Closed Engagement
  const closedAt = jobOrder?.engagement_closed_at;
  const isClosed = closedAt || orderStatusLower === 'completed';

  if (isClosed) {
    events.push({
      id: 'completed',
      title: 'Engagement Closed',
      actor: 'Company',
      timestamp: closedAt || null,
      icon: CheckCircle2,
      color: 'text-slate-600 bg-slate-100 border-slate-200',
      description: 'The engagement was officially completed and closed.'
    });
  }

  return events;
}

export default function EngagementTimeline({ jobOrder, application = null }) {
  const events = buildEngagementTimeline(jobOrder, application);

  const formatTimestamp = (ts) => {
    if (!ts) return 'Pending timestamp';
    try {
      const date = new Date(ts);
      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    } catch (e) {
      return '';
    }
  };

  if (events.length === 0) {
    return (
      <div className="text-center py-4 text-xs text-gray-400 font-medium">
        No timeline events available yet.
      </div>
    );
  }

  return (
    <div className="flow-root mt-4 w-full">
      <ul role="list" className="-mb-8">
        {events.map((event, eventIdx) => {
          const IconComponent = event.icon || Circle;
          const isLast = eventIdx === events.length - 1;

          return (
            <li key={event.id || eventIdx}>
              <div className="relative pb-8">
                {/* Connector Line */}
                {!isLast && (
                  <span 
                    className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-gray-200 transition-colors" 
                    aria-hidden="true" 
                  />
                )}

                <div className="relative flex space-x-3 items-start">
                  {/* Icon Circle */}
                  <div className="shrink-0">
                    <span className={`h-8 w-8 rounded-full flex items-center justify-center ring-8 ring-white border ${event.color || 'bg-gray-50 text-gray-500 border-gray-200'}`}>
                      <IconComponent className="h-4 w-4" aria-hidden="true" />
                    </span>
                  </div>

                  {/* Event Content Card */}
                  <div className="flex-1 min-w-0 bg-slate-50/70 border border-slate-100/80 rounded-xl p-3 shadow-xs">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                      <div className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
                        {event.title}
                      </div>
                      <div className="text-[11px] text-gray-400 whitespace-nowrap font-medium font-mono">
                        {formatTimestamp(event.timestamp)}
                      </div>
                    </div>

                    <div className="mt-1 flex items-center gap-1.5">
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        event.actor === 'Applicant' 
                          ? 'bg-blue-50 text-blue-700' 
                          : 'bg-emerald-50 text-emerald-700'
                      }`}>
                        {event.actor}
                      </span>
                      <p className="text-xs text-gray-500">
                        {event.description}
                      </p>
                    </div>

                    {/* Note if available */}
                    {event.note && event.note.trim() && (
                      <div className="mt-2.5 p-2 bg-white rounded-lg border border-slate-100/90 text-xs text-gray-600 shadow-3xs">
                        <div className="font-semibold text-slate-700 mb-1 flex items-center gap-1">
                          <MessageSquare size={12} className="text-gray-400" />
                          <span>Note from {event.actor}:</span>
                        </div>
                        <p className="whitespace-pre-wrap leading-relaxed text-gray-600 italic">
                          "{event.note}"
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
