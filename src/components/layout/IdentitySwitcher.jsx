import { User, LogOut, Plus, Check, Settings, Coins } from 'lucide-react';
import { useProfile } from '@/app/context/ProfileContext';
import { useRouter } from 'next/navigation';
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

  const handleSwitch = (identity) => {
    setCurrentIdentity(identity);
    onClose();
    if (identity.type === 'company') {
      router.push(`/company/${identity.id}`);
    } else {
      router.push('/profile');
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
          className={`identity-item ${currentIdentity.type === 'user' ? 'active' : ''}`}
          onClick={() => handleSwitch({ type: 'user', id: userId })}
        >
          <div className="identity-avatar-container" style={{ borderRadius: '50%' }}>
            <img src={profile.profilePic || '/profile_pic.png'} alt={profile.name} className="identity-avatar" />
          </div>
          <div className="identity-info">
            <div className="identity-name">{profile.name}</div>
            <div className="identity-role">Personal Profile</div>
          </div>
          {currentIdentity.type === 'user' && (
            <Check size={18} className="active-check" />
          )}
        </div>

        {/* Company Identities */}
        {companies.map((company) => (
          <div 
            key={company.id} 
            className={`identity-item ${currentIdentity.type === 'company' && currentIdentity.id === company.id ? 'active' : ''}`}
            onClick={() => handleSwitch({ type: 'company', id: company.id, data: company })}
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
            {currentIdentity.type === 'company' && currentIdentity.id === company.id && (
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
        {profile && ['super_admin', 'admin', 'brand_manager'].includes(profile.global_role) && (
          <>
            <div className="footer-link-item" onClick={() => { router.push('/settings/global'); onClose(); }}>
              <Settings size={18} className="text-[#002b4e]" />
              <span className="font-bold text-[#002b4e]">Global Settings</span>
            </div>
            <div className="footer-link-item" onClick={() => { router.push('/admin/mcredits'); onClose(); }}>
              <Coins size={18} className="text-[#002b4e]" />
              <span className="font-bold text-[#002b4e]">MCredits / Wallet Control</span>
            </div>
          </>
        )}
        <div className="footer-link-item" onClick={() => { router.push('/settings/notifications'); onClose(); }}>
          <Settings size={18} />
          <span>Notification Settings</span>
        </div>
        <div className="footer-link-item sign-out-item" onClick={handleSignOut} style={{ color: '#ff4d4f', fontWeight: '600', cursor: 'pointer' }}>
          <LogOut size={18} />
          <span>Sign Out</span>
        </div>
      </div>

    </div>
  );
}
