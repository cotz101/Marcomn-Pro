import { Settings, ShieldCheck, HelpCircle, LogOut, Plus, Check, Building2 } from 'lucide-react';
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
    router.push('/');
    onClose();
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
            <img src={profile.profilePic || '/profile_pic.png'} alt={profile.fullName} className="identity-avatar" />
          </div>
          <div className="identity-info">
            <div className="identity-name">{profile.fullName}</div>
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

      <div className="switcher-links">
        <div className="switcher-link">
          <Settings size={18} />
          Settings
        </div>
        <div className="switcher-link">
          <ShieldCheck size={18} />
          Privacy
        </div>
        <div className="switcher-link">
          <HelpCircle size={18} />
          Help Center
        </div>
      </div>

      <div className="switcher-footer">
        <div className="sign-out-link" onClick={handleSignOut} style={{ color: 'var(--error)', fontWeight: 600 }}>
          <LogOut size={18} />
          Sign Out
        </div>
      </div>
    </div>
  );
}
