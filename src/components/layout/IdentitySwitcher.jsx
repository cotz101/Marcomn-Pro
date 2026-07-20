import { User, LogOut, Plus, Check, Settings, Coins, ShieldCheck } from 'lucide-react';
import { useProfile } from '@/app/context/ProfileContext';
import { useRouter, usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase';

export default function IdentitySwitcher({ onClose, onCreateCompany }) {
  const { 
    profile, 
    userId, 
    companies, 
    currentIdentity, 
    setCurrentIdentity 
  } = useProfile();
  const router = useRouter();
  const pathname = usePathname();

  const handleSwitch = (identity) => {
    setCurrentIdentity(identity);
    onClose();
    
    let isInvalidRoute = false;
    
    if (identity.type === 'company') {
      // Routes invalid for company identities
      if (pathname.includes('/profile/wallet') || pathname.includes('/jobs/my-applications') || pathname.includes('/admin')) {
        isInvalidRoute = true;
      }
    } else {
      // Routes invalid for user identities
      if (pathname.includes('/company/wallet')) {
        isInvalidRoute = true;
      }
    }

    if (isInvalidRoute) {
      router.push('/logbook');
    } else {
      // Stay on the current page and update server components context
      router.refresh();
    }
  };

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    
    // Clear any local application state if necessary
    // localStorage.clear(); // Optional: depend on if you use localStorage for app state
    
    router.push('/');
    onClose();
    
    // Hard refresh to ensure all states are reset across the app
    window.location.href = '/';
  };

  return (
    <div className="identity-switcher-dropdown" onClick={(e) => e.stopPropagation()}>
      <div className="switcher-section-title">SWITCH IDENTITY</div>
      
      <div className="identities-list">
        {/* Personal Identity */}
        <div 
          className={`identity-item ${!currentIdentity?.isCompany ? 'active' : ''}`}
          onClick={() => handleSwitch({ type: 'personal', id: userId, isCompany: false, data: profile })}
        >
          <div className="identity-avatar-container" style={{ borderRadius: '50%' }}>
            <img src={profile.profilePic || '/profile_pic.png'} alt={profile.name} className="identity-avatar" />
          </div>
          <div className="identity-info">
            <div className="identity-name">{profile.name}</div>
            <div className="identity-role">Personal Profile</div>
          </div>
          {!currentIdentity?.isCompany && (
            <Check size={18} className="active-check" />
          )}
        </div>

        {/* Company Identities */}
        {companies.map((company) => (
          <div 
            key={company.id} 
            className={`identity-item ${currentIdentity?.isCompany && currentIdentity?.id === company.id ? 'active' : ''}`}
            onClick={() => handleSwitch({ type: 'company', id: company.id, isCompany: true, data: company })}
          >
            <div className="identity-avatar-container">
              {company.logo_url ? (
                <img src={company.logo_url} alt={company.name} className="identity-avatar" />
              ) : (
                <div className="company-initials">
                  {company.name.split(' ').map(n => n[0]).join('')}
                </div>
              )}
            </div>
            <div className="identity-info">
              <div className="identity-name">{company.name}</div>
              <div className="identity-role">Corporate Profile</div>
            </div>
            {currentIdentity?.isCompany && currentIdentity?.id === company.id && (
              <Check size={18} className="active-check" />
            )}
          </div>
        ))}
      </div>

      <div style={{ padding: '0 16px', marginBottom: '12px' }}>
        <button className="btn-primary-pill w-full" onClick={onCreateCompany}>
          <Plus size={18} />
          Create a Company
        </button>
      </div>

      <div className="switcher-footer-links" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '8px' }}>
        <div 
          className="footer-link-item" 
          onClick={() => { 
            if (currentIdentity?.type === 'company') {
              router.push(`/company/${currentIdentity.id}`);
            } else {
              router.push('/profile');
            }
            onClose(); 
          }}
        >
          <User size={18} />
          <span>View Profile</span>
        </div>
        {(() => {
          if (!profile) return null;
          const isLegacyAdmin = ['super_admin', 'admin', 'brand_manager'].includes(profile.global_role);
          const perms = profile.admin_permissions || [];
          const hasPerm = (key) => isLegacyAdmin || perms.includes(key);

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
          
          const isPlatformAdmin = isLegacyAdmin || hasGlobalSettings || hasWalletControl || hasFinance || hasRolesControl || hasAuditLogs;

          if (!isPlatformAdmin) return null;

          return (
            <>
              <div className="footer-link-item" onClick={() => { router.push('/admin'); onClose(); }}>
                <ShieldCheck size={18} className="text-[#002b4e]" />
                <span className="font-bold text-[#002b4e]">Platform Admin</span>
              </div>
              <div className="footer-link-item" onClick={() => { router.push('/settings/notifications'); onClose(); }}>
                <Settings size={18} />
                <span>Notification Settings</span>
              </div>
            </>
          );
        })()}
        <div className="footer-link-item sign-out-item" onClick={handleSignOut} style={{ color: '#ff4d4f', fontWeight: '600', cursor: 'pointer' }}>
          <LogOut size={18} />
          <span>Sign Out</span>
        </div>
      </div>

    </div>
  );
}
