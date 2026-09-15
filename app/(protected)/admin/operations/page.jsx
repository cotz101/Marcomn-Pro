'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useProfile } from '@/app/context/ProfileContext';
import { 
  ArrowLeft, 
  BookOpen, 
  Download, 
  ExternalLink, 
  ShieldCheck, 
  ShieldAlert, 
  FileText, 
  HelpCircle, 
  CreditCard, 
  Rocket, 
  AlertTriangle, 
  RotateCcw, 
  Database, 
  CheckSquare, 
  Users, 
  FileSpreadsheet,
  Loader2
} from 'lucide-react';
import { verifySuperAdminOperationsAccess } from '@/app/actions/adminOperationsActions';

export default function OperationsHandoverPage() {
  const router = useRouter();
  const { profile } = useProfile();
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    async function checkAccess() {
      try {
        const res = await verifySuperAdminOperationsAccess();
        setAuthorized(res.authorized);
      } catch (err) {
        console.error('Failed to verify access:', err);
        setAuthorized(false);
      } finally {
        setLoading(false);
      }
    }

    checkAccess();
  }, []);

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 flex flex-col items-center justify-center space-y-4 font-sans">
        <Loader2 size={36} className="animate-spin text-blue-900" />
        <span className="text-sm text-gray-500 font-semibold">Verifying Super Admin clearance...</span>
      </div>
    );
  }

  if (!authorized) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center font-sans">
        <div className="bg-white border border-gray-100 rounded-3xl p-8 shadow-md flex flex-col items-center space-y-6">
          <div className="p-4 bg-red-50 text-red-600 rounded-full">
            <ShieldAlert size={36} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Access Restricted</h1>
            <p className="text-sm text-gray-500 mt-2">
              Operations & Handover documents are restricted exclusively to Super Administrators.
            </p>
          </div>
          <button 
            onClick={() => router.push('/admin')}
            className="w-full bg-[#002b4e] hover:bg-[#001c33] text-white text-sm font-bold py-3 rounded-xl transition-all shadow-sm cursor-pointer border-none"
          >
            Back to Platform Admin
          </button>
        </div>
      </div>
    );
  }

  const sections = [
    {
      number: '1',
      title: 'Platform Admin Quick Start Guide',
      icon: <BookOpen size={22} className="text-blue-600" />,
      description: 'Orientation, access controls, dashboard navigation, and core administrative workflows.'
    },
    {
      number: '2',
      title: 'Support Troubleshooting Runbook',
      icon: <HelpCircle size={22} className="text-teal-600" />,
      description: 'Standard diagnostics, user account troubleshooting, and issue remediation protocols.'
    },
    {
      number: '3',
      title: 'MCredits & Finance Operations Guide',
      icon: <CreditCard size={22} className="text-purple-600" />,
      description: 'Ledger monitoring, Stripe reconciliation, manual adjustments, and refund reviews.'
    },
    {
      number: '4',
      title: 'Launch-Day Cutover Runbook',
      icon: <Rocket size={22} className="text-amber-600" />,
      description: 'Step-by-step production cutover sequences, validation checkpoints, and sign-offs.'
    },
    {
      number: '5',
      title: 'Incident Escalation Matrix',
      icon: <AlertTriangle size={22} className="text-rose-600" />,
      description: 'Severity classification, operational contact chains, and management escalation paths.'
    },
    {
      number: '6',
      title: 'Deployment & Rollback Quick Reference',
      icon: <RotateCcw size={22} className="text-indigo-600" />,
      description: 'Standard deployment procedures, health verification, and rollback decision guides.'
    },
    {
      number: '7',
      title: 'Backup & Recovery Verification Checklist',
      icon: <Database size={22} className="text-emerald-600" />,
      description: 'Database snapshot verification, retention policies, and disaster recovery procedures.'
    },
    {
      number: '8',
      title: 'UAT Data Cleanup Approval Sheet',
      icon: <FileSpreadsheet size={22} className="text-cyan-600" />,
      description: 'Controlled pre-launch test data sanitization criteria and formal sign-off sheet.'
    },
    {
      number: '9',
      title: 'Launch Responsibility Assignment Sheet',
      icon: <Users size={22} className="text-violet-600" />,
      description: 'Operational role assignments, duty schedules, and management ownership matrix.'
    },
    {
      number: '10',
      title: 'Remaining Pre-Launch Actions / Approval Status',
      icon: <CheckSquare size={22} className="text-blue-700" />,
      description: 'Tracked launch readiness checklist, open dependencies, and executive approval registry.'
    }
  ];

  return (
    /*
     * Outer page container:
     * Aligns all components (Back button, Summary card, Navy card, Heading, 10 Cards, Notice)
     * to the exact same left/right content bounds with comfortable page gutters.
     */
    <div className="max-w-[1080px] mx-auto w-full px-4 sm:px-6 md:px-8 py-6 pb-28 md:pb-16 font-sans">

      {/* ── Back to Admin Dashboard ── */}
      <button
        onClick={() => router.push('/admin')}
        className="inline-flex items-center gap-2 text-slate-600 hover:text-[#002b4e] transition-colors mb-4 text-sm font-semibold cursor-pointer bg-transparent border-none p-0 outline-none"
      >
        <ArrowLeft size={16} /> Back to Admin Dashboard
      </button>

      {/* ── 1. Document Summary Card (White) ── */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm relative !p-6 sm:!p-8 !pb-7 sm:!pb-8 mb-6">
        {/* Decorative open book outline on the right half — visible sm+, never overlaps text or metadata */}
        <div className="absolute right-8 top-6 lg:right-12 lg:top-7 pointer-events-none select-none text-slate-200/70 hidden sm:block">
          <BookOpen size={110} strokeWidth={1.2} />
        </div>

        {/* Content Area */}
        <div className="relative z-10">
          {/* Badge */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50/80 border border-blue-100 text-[#002b4e] text-xs font-bold uppercase tracking-wider mb-3">
            <ShieldCheck size={14} className="text-blue-600 shrink-0" />
            <span>INTERNAL MANAGEMENT DOCUMENTATION</span>
          </div>

          {/* Page Heading */}
          <h1 className="text-2xl sm:text-[28px] font-extrabold text-[#002b4e] leading-tight tracking-tight mb-2">
            MarComn Launch &amp; Operations Handover Pack
          </h1>

          {/* Description */}
          <p className="text-slate-500 text-sm sm:text-[15px] leading-relaxed max-w-2xl">
            Formal operational and management handover documentation for MarComn&apos;s October 2026 launch.
          </p>

          {/* Metadata Row with vertical dividers on desktop */}
          <div className="mt-6 pt-5 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 lg:gap-0 lg:divide-x lg:divide-slate-200/80">
            <div className="flex flex-col lg:pr-6">
              <span className="text-slate-400 text-[11px] font-bold uppercase tracking-wider block mb-1">Document Version</span>
              <span className="text-slate-900 font-bold text-sm sm:text-base">1.0 Production</span>
            </div>
            <div className="flex flex-col lg:px-6">
              <span className="text-slate-400 text-[11px] font-bold uppercase tracking-wider block mb-1">Target Release</span>
              <span className="text-slate-900 font-bold text-sm sm:text-base">October 2026</span>
            </div>
            <div className="flex flex-col lg:px-6">
              <span className="text-slate-400 text-[11px] font-bold uppercase tracking-wider block mb-1">Access Clearance</span>
              <span className="text-emerald-600 font-bold text-sm sm:text-base">Super Admin Restricted</span>
            </div>
            <div className="flex flex-col lg:pl-6">
              <span className="text-slate-400 text-[11px] font-bold uppercase tracking-wider block mb-1">Classification</span>
              <span className="text-slate-900 font-bold text-sm sm:text-base">Internal Management</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── 2. Master Handover Pack (Navy PDF Card) ── */}
      <div className="bg-[#002b4e] rounded-2xl shadow-sm !p-6 sm:!p-7 text-white mb-8">
        {/* Title & Description */}
        <div className="flex items-center gap-2.5">
          <FileText size={22} className="!text-white shrink-0" />
          <h2 className="text-lg sm:text-xl font-bold !text-white tracking-tight">
            Master Handover Pack (PDF)
          </h2>
        </div>
        <p className="text-xs sm:text-sm text-slate-300 font-normal leading-relaxed mt-2 mb-6 max-w-3xl">
          Direct authenticated stream of the formal handover documentation pack. Protected behind Super Admin role validation.
        </p>

        {/* Action Buttons — 2 columns on sm+, side-by-side, high contrast white text */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
          <a
            href="/api/admin/operations/handover?disposition=inline"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 bg-[#1a73e8] hover:bg-blue-600 !text-white text-sm font-semibold py-3 px-6 rounded-xl transition-all shadow-sm cursor-pointer no-underline h-[46px]"
          >
            <ExternalLink size={18} className="!text-white shrink-0" />
            <span className="!text-white font-semibold">View Document</span>
          </a>
          <a
            href="/api/admin/operations/handover?disposition=attachment"
            className="flex items-center justify-center gap-2 bg-transparent hover:bg-white/10 !text-white text-sm font-semibold py-3 px-6 rounded-xl transition-all border border-white/40 hover:border-white/70 cursor-pointer no-underline h-[46px]"
          >
            <Download size={18} className="!text-white shrink-0" />
            <span className="!text-white font-semibold">Download PDF</span>
          </a>
        </div>
      </div>

      {/* ── 3. Included Handover Sections Heading ── */}
      <div className="mb-4 sm:mb-5 flex items-center gap-2.5">
        <BookOpen size={20} className="text-[#002b4e] shrink-0" />
        <h2 className="text-base sm:text-[17px] font-bold text-[#002b4e] tracking-tight">
          Included Handover Sections &amp; Operations Runbooks
        </h2>
      </div>

      {/* ── 4. Ten Handover Cards (2 columns on desktop) ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        {sections.map((sec, idx) => (
          <div
            key={idx}
            className="bg-white border border-slate-200/80 rounded-2xl !p-5 sm:!p-6 shadow-sm hover:border-blue-200 transition-all flex items-start gap-4"
          >
            <div className="shrink-0 mt-0.5">
              {sec.icon}
            </div>
            <div className="space-y-1 min-w-0 flex-1">
              <h3 className="font-bold text-slate-900 text-sm sm:text-[15px] leading-snug">
                {sec.number}. {sec.title}
              </h3>
              <p className="text-xs sm:text-[13px] text-slate-500 leading-relaxed">
                {sec.description}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* ── 5. Super Admin Restricted Access Notice ── */}
      <div className="bg-[#eef5ff] border border-[#d2e3fc] rounded-2xl !p-5 sm:!p-6 flex items-start gap-4">
        <ShieldCheck size={24} className="text-blue-600 shrink-0 mt-0.5" />
        <div className="space-y-1 text-xs sm:text-[13px] text-slate-700 leading-relaxed min-w-0 flex-1">
          <span className="font-bold text-[#002b4e] block text-sm">Super Admin Restricted Access</span>
          This documentation contains official operational procedures, incident response matrices, and launch handover protocols. Intended strictly for authorized MarComn platform management and Super Administrators.
        </div>
      </div>

    </div>
  );
}
