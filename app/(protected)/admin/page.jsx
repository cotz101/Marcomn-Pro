'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useProfile } from '@/app/context/ProfileContext';
import { 
  ShieldCheck, 
  Settings, 
  Wallet, 
  LineChart, 
  Users, 
  FileText,
  AlertTriangle,
  Gavel,
  RefreshCcw,
  Palette,
  Bell,
  ToggleRight,
  Receipt,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import Link from 'next/link';

export default function PlatformAdminDashboard() {
  const router = useRouter();
  const { profile } = useProfile();
  const [mounted, setMounted] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState({ 0: true });

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const isLegacyAdmin = profile && ['super_admin', 'admin', 'brand_manager'].includes(profile?.global_role);
  const perms = profile?.admin_permissions || [];
  const hasPerm = (key) => isLegacyAdmin || perms.includes(key);

  // Map permissions according to rules
  const hasGlobalSettings = hasPerm('can_manage_global_settings');
  const hasWalletControl = hasPerm('can_view_wallet_summary') || 
                           hasPerm('can_view_wallet_control') || 
                           hasPerm('can_grant_mcredits') || 
                           hasPerm('can_deduct_mcredits') || 
                           hasPerm('can_approve_topups') || 
                           hasPerm('can_reject_topups');
  const hasFinance = hasPerm('can_view_finance_reports') || 
                     hasPerm('can_view_platform_wallet') || 
                     hasPerm('can_view_finance_dashboard');
  const hasRolesControl = hasPerm('can_manage_admin_roles');
  const hasAuditLogs = hasPerm('can_view_admin_audit_logs');

  // Guard: User must have at least one valid mapped permission
  const isPlatformAdmin = isLegacyAdmin || hasGlobalSettings || hasWalletControl || hasFinance || hasRolesControl || hasAuditLogs;

  if (!profile) return null;

  if (!isPlatformAdmin) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center font-sans">
        <div className="bg-white border border-gray-100 rounded-3xl p-8 shadow-md flex flex-col items-center space-y-6">
          <div className="p-4 bg-red-50 text-red-600 rounded-full">
            <AlertTriangle size={36} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Access Denied</h1>
            <p className="text-sm text-gray-500 mt-2">
              You do not have platform administrator privileges.
            </p>
          </div>
          <button 
            onClick={() => router.push('/')}
            className="w-full bg-[#002b4e] hover:bg-[#001c33] text-white text-sm font-bold py-3 rounded-xl transition-all shadow-sm"
          >
            Return Home
          </button>
        </div>
      </div>
    );
  }

  const adminSectionsRaw = [
    {
      group: 'Global Settings',
      items: [
        {
          name: 'General Settings',
          description: 'Platform fees, commission rates, and global defaults.',
          icon: <Settings size={20} />,
          href: '/settings/global',
          active: hasGlobalSettings,
        },
        {
          name: 'Branding / Logo',
          description: 'Manage platform branding and visual assets.',
          icon: <Palette size={20} />,
          href: '#',
          active: false,
          comingSoon: true,
        },
        {
          name: 'Notification Settings',
          description: 'Configure automated emails and platform alerts.',
          icon: <Bell size={20} />,
          href: '#',
          active: false,
          comingSoon: true,
        },
        {
          name: 'Feature Toggles',
          description: 'Enable or disable beta features globally.',
          icon: <ToggleRight size={20} />,
          href: '#',
          active: false,
          comingSoon: true,
        }
      ]
    },
    {
      group: 'Financial Control',
      items: [
        {
          name: 'MCredits / Wallet',
          description: 'Manage top-ups, deduct MCredits, and user wallets.',
          icon: <Wallet size={20} />,
          href: '/admin/mcredits',
          active: hasWalletControl,
        },
        {
          name: 'Finance Dashboard',
          description: 'View platform revenue, top-up reports, and earnings.',
          icon: <LineChart size={20} />,
          href: '/admin/finance',
          active: hasFinance,
        },
        {
          name: 'Receipts / Invoices',
          description: 'Platform generated invoices and billing history.',
          icon: <Receipt size={20} />,
          href: '#',
          active: false,
          comingSoon: true,
        }
      ]
    },
    {
      group: 'Security & Access',
      items: [
        {
          name: 'Roles & Access Control',
          description: 'Assign admin roles and manage platform permissions.',
          icon: <Users size={20} />,
          href: '/admin/roles',
          active: hasRolesControl,
        },
        {
          name: 'Audit Logs',
          description: 'Secure chronological record of administrative actions.',
          icon: <FileText size={20} />,
          href: '/admin/audit-logs',
          active: hasAuditLogs,
        }
      ]
    },
    {
      group: 'Platform Operations',
      items: [
        {
          name: 'Content Moderation',
          description: 'Review reported posts, users, and content.',
          icon: <ShieldCheck size={20} />,
          href: '#',
          active: false,
          comingSoon: true,
        },
        {
          name: 'Refund / Dispute Review',
          description: 'Manage job applicant-fault reviews and refunds.',
          icon: <Gavel size={20} />,
          href: '#',
          active: false,
          comingSoon: true,
        }
      ]
    }
  ];

  // Filter sections to ONLY show items the user is permitted to see, or items marked as coming soon.
  const adminSections = adminSectionsRaw.map(section => {
    return {
      ...section,
      items: section.items.filter(item => item.active || item.comingSoon)
    };
  }).filter(section => section.items.length > 0);

  return (
    <div className="max-w-[1000px] mx-auto px-4 md:px-8 py-6 md:py-8 pb-[calc(var(--mobile-nav-height,72px)+env(safe-area-inset-bottom)+32px)] md:pb-8 font-sans w-full">
      <div className="bg-white border border-gray-100 rounded-3xl shadow-sm mb-6 md:mb-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
          <ShieldCheck size={120} />
        </div>
        <div className="relative z-10 px-4 py-4 md:px-6 md:py-5 pr-20 md:pr-28">
          <h1 className="text-xl md:text-2xl font-extrabold text-[#0e2a4d] inline-flex items-center gap-3 bg-[#e0f2fe] px-3 py-1.5 rounded-md w-fit">
            Platform Admin
          </h1>
          <p className="text-gray-500 mt-2 font-medium max-w-xl">
            Central dashboard for managing MarComn's administrative operations, platform configurations, and security controls.
          </p>
          <div className="mt-4 inline-block bg-blue-50 text-blue-800 text-xs font-bold px-3 py-1.5 rounded-lg border border-blue-100">
            Only sections available to your assigned permissions are shown.
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-8 md:gap-10">
        {adminSections.map((section, idx) => {
          // Only show group if there's at least one active item or if we're showing all (including coming soon)
          // For now, we show all so they see the planned structure.
          return (
            <div key={idx} className="flex flex-col gap-3 md:gap-4">
              <div 
                className="flex items-center justify-between cursor-pointer md:cursor-default py-1 md:py-0" 
                onClick={() => setExpandedGroups(prev => ({ ...prev, [idx]: !prev[idx] }))}
              >
                <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider pl-1 md:pl-2">
                  {section.group}
                </h2>
                <div className="md:hidden text-gray-400 pr-2">
                  {expandedGroups[idx] ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                </div>
              </div>
              <div className={`${expandedGroups[idx] ? 'grid' : 'hidden'} md:grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4`}>
                {section.items.map((item, itemIdx) => {
                  if (item.active) {
                    return (
                      <Link 
                        key={itemIdx} 
                        href={item.href}
                        className="bg-white border border-gray-100 hover:border-blue-200 hover:shadow-md rounded-2xl p-4 md:p-6 transition-all flex flex-col gap-3 group"
                      >
                        <div className="flex items-center justify-between">
                          <div className="p-2.5 bg-blue-50 text-blue-900 rounded-xl group-hover:bg-[#0e2a4d] group-hover:text-white transition-colors">
                            {item.icon}
                          </div>
                        </div>
                        <div>
                          <h3 className="text-[15px] font-bold text-gray-800 group-hover:text-blue-900 transition-colors">
                            {item.name}
                          </h3>
                          <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">
                            {item.description}
                          </p>
                        </div>
                      </Link>
                    );
                  } else {
                    return (
                      <div 
                        key={itemIdx} 
                        className="bg-gray-50 border border-gray-100 rounded-2xl p-4 md:p-6 flex flex-col gap-3 opacity-60"
                      >
                        <div className="flex items-center justify-between">
                          <div className="p-2.5 bg-gray-200 text-gray-500 rounded-xl">
                            {item.icon}
                          </div>
                          {item.comingSoon && (
                            <span className="text-[10px] font-bold uppercase tracking-wide text-gray-400 bg-gray-200 px-2 py-0.5 rounded-full">
                              Coming Soon
                            </span>
                          )}
                          {!item.comingSoon && (
                            <span className="text-[10px] font-bold uppercase tracking-wide text-red-400 bg-red-50 px-2 py-0.5 rounded-full border border-red-100">
                              Locked
                            </span>
                          )}
                        </div>
                        <div>
                          <h3 className="text-[15px] font-bold text-gray-500">
                            {item.name}
                          </h3>
                          <p className="text-xs text-gray-400 mt-1.5 leading-relaxed">
                            {item.description}
                          </p>
                        </div>
                      </div>
                    );
                  }
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
