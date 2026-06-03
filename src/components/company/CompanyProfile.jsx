'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { Globe, Briefcase, MapPin, Edit3, X, Check, Trash2, AlertTriangle, Camera, ArrowLeft, Coins } from 'lucide-react';
import { useProfile } from '@/app/context/ProfileContext';
import { useRef } from 'react';

export default function CompanyProfile({ company, role, onUpdate }) {
  const router = useRouter();
  const { refreshCompanies, setCurrentIdentity, userId } = useProfile();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [editForm, setEditForm] = useState(company);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [toast, setToast] = useState(null);

  const logoUploadRef = useRef(null);

  const isOwner = role === 'Owner';

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const handleBack = (e) => {
    e.stopPropagation();
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push('/mservices/partners');
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setEditForm(prev => ({ ...prev, [name]: value }));
  };

  const handleUpdate = async () => {
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from('companies')
      .update({
        name: editForm.name,
        website: editForm.website,
        industry: editForm.industry,
        location: editForm.location,
        bio: editForm.bio
      })
      .eq('id', company.id);

    if (!error) {
      onUpdate(editForm);
      setIsEditModalOpen(false);
      showToast('Company updated successfully');
      refreshCompanies();
    } else {
      showToast(error.message, 'error');
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    setDeleting(true);
    const supabase = createClient();
    
    // Membership deletion usually handled by FK or manual
    const { error: memberError } = await supabase
      .from('company_members')
      .delete()
      .eq('company_id', company.id);

    if (memberError) {
      showToast(memberError.message, 'error');
      setDeleting(false);
      return;
    }

    const { error } = await supabase
      .from('companies')
      .delete()
      .eq('id', company.id);

    if (!error) {
      refreshCompanies();
      setCurrentIdentity({ type: 'user', id: userId });
      router.push('/logbook');
    } else {
      showToast(error.message, 'error');
      setDeleting(false);
    }
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !userId) return;

    setUploadingLogo(true);
    const supabase = createClient();
    const ext = file.name.split('.').pop();
    const path = `${company.id}/logo.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('company-logos')
      .upload(path, file, { upsert: true });

    if (uploadError) {
      showToast('Upload failed: ' + uploadError.message, 'error');
      setUploadingLogo(false);
      return;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('company-logos')
      .getPublicUrl(path);

    const bustedUrl = `${publicUrl}?t=${Date.now()}`;

    // Update DB
    const { error: dbError } = await supabase
      .from('companies')
      .update({ logo_url: bustedUrl })
      .eq('id', company.id);

    if (!dbError) {
      // "State Reset" - Force UI to see a change by briefly setting to null if needed, 
      // but the bustedUrl change itself usually triggers it. 
      // To strictly follow the request:
      onUpdate({ ...company, logo_url: null }); 
      
      setTimeout(() => {
        onUpdate({ ...company, logo_url: bustedUrl });
        // Also update identity in context if it's the current one
        setCurrentIdentity(prev => {
          if (prev.type === 'company' && prev.id === company.id) {
            return { ...prev, data: { ...prev.data, logo_url: bustedUrl } };
          }
          return prev;
        });
        refreshCompanies();
        showToast('Logo updated!');
      }, 50);
    } else {
      showToast('Error updating database: ' + dbError.message, 'error');
    }
    setUploadingLogo(false);
  };

  return (
    <div className="company-profile-container">
      {/* Hero Section */}
      <section className="profile-card">
        <div className="cover-photo-container">
          <img src="/cover_photo.png" alt="Cover" />
        </div>

        <div className="profile-info">
          <div className="profile-header-top">
            <div 
              className="profile-pic-container" 
              style={{ position: 'relative', cursor: isOwner ? 'pointer' : 'default' }}
              onClick={() => isOwner && logoUploadRef.current.click()}
            >
              {company.logo_url ? (
                <img src={company.logo_url} alt={company.name} className="company-logo-img" />
              ) : (
                <div className="company-logo-placeholder">
                  {company.name?.[0] || 'C'}
                </div>
              )}
              
              {isOwner && (
                <>
                  <div 
                    className="logo-upload-btn"
                    title="Upload logo"
                  >
                    {uploadingLogo ? '...' : <Camera size={14} />}
                  </div>
                  <input 
                    type="file" 
                    accept="image/*" 
                    ref={logoUploadRef} 
                    style={{ display: 'none' }} 
                    onChange={handleLogoUpload} 
                    onClick={(e) => e.stopPropagation()}
                  />
                </>
              )}
            </div>

            {isOwner && (
              <div style={{ display: 'flex', gap: 8 }}>
                <button 
                  className="btn-edit-profile" 
                  onClick={() => router.push('/company/wallet')} 
                  style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: 6, padding: '0 12px', fontSize: 13, fontWeight: 'bold' }}
                  title="Company Wallet"
                >
                  <Coins size={16} /> <span className="hidden sm:inline">Wallet</span>
                </button>
                <button className="btn-edit-profile" onClick={() => setIsEditModalOpen(true)} style={{ color: '#00B4D8' }}>
                  <Edit3 size={18} />
                </button>
                <button className="btn-edit-profile" style={{ color: '#ef4444' }} onClick={() => setIsDeleteModalOpen(true)}>
                  <Trash2 size={18} />
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between w-full gap-4">
            <h1 className="profile-name m-0 leading-tight">{company.name}</h1>
            <button 
              onClick={handleBack} 
              className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-[#002b4e] bg-slate-100/80 hover:bg-slate-200/80 px-2.5 py-1 rounded-md transition-all shadow-sm active:scale-[0.97]"
              title="Back"
            >
              <ArrowLeft size={14} strokeWidth={2.5} /> <span>Back</span>
            </button>
          </div>
          <h2 className="profile-headline">{company.industry}</h2>

          <div className="company-meta">
            {company.location && (
              <p className="profile-location" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <MapPin size={14} style={{ flexShrink: 0 }} /> <span>{company.location}</span>
              </p>
            )}
            {company.website && (
              <p className="profile-location" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <Globe size={14} style={{ flexShrink: 0 }} /> 
                <a href={company.website} target="_blank" rel="noopener noreferrer" style={{ color: '#00B4D8' }}>
                  {company.website.replace(/^https?:\/\//, '')}
                </a>
              </p>
            )}
          </div>
        </div>
      </section>

      {/* About Section */}
      <section className="profile-card about-card" style={{ marginTop: 20 }}>
        <h2 className="section-title">About</h2>
        <p className="about-text">{company.bio || 'No bio provided.'}</p>
      </section>

      {/* Edit Modal */}
      {isEditModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>Edit Company</h2>
              <button className="btn-close" onClick={() => setIsEditModalOpen(false)}><X size={20} /></button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Company Name</label>
                <input type="text" name="name" className="form-input" value={editForm.name || ''} onChange={handleInputChange} />
              </div>
              <div className="form-group">
                <label>Industry</label>
                <input type="text" name="industry" className="form-input" value={editForm.industry || ''} onChange={handleInputChange} />
              </div>
              <div className="form-group">
                <label>Website</label>
                <input type="text" name="website" className="form-input" value={editForm.website || ''} onChange={handleInputChange} />
              </div>
              <div className="form-group">
                <label>Location</label>
                <input type="text" name="location" className="form-input" value={editForm.location || ''} onChange={handleInputChange} />
              </div>
              <div className="form-group">
                <label>Bio</label>
                <textarea name="bio" className="form-textarea" rows={4} value={editForm.bio || ''} onChange={handleInputChange} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setIsEditModalOpen(false)}>Cancel</button>
              <button className="btn-primary" onClick={handleUpdate} disabled={saving}>
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 400 }}>
            <div className="modal-header" style={{ borderBottom: 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: '#ef4444' }}>
                <AlertTriangle size={24} />
                <h2 style={{ margin: 0 }}>Delete Company?</h2>
              </div>
            </div>
            <div className="modal-body">
              <p>Are you sure you want to delete <strong>{company.name}</strong>? This will also remove any associated job postings and cannot be undone.</p>
            </div>
            <div className="modal-footer" style={{ borderTop: 'none' }}>
              <button className="btn-secondary" onClick={() => setIsDeleteModalOpen(false)}>Cancel</button>
              <button className="btn-primary" style={{ background: '#ef4444' }} onClick={handleDelete} disabled={deleting}>
                {deleting ? 'Deleting...' : 'Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`toast toast-${toast.type}`}>
          {toast.type === 'success' ? <Check size={18} /> : <X size={18} />}
          {toast.msg}
        </div>
      )}

      <style jsx>{`
        .company-logo-img {
          width: 100%;
          height: 100%;
          object-fit: contain;
          border-radius: 12px;
          border: 4px solid white;
          background: white;
          padding: 4px;
        }
        .company-logo-placeholder {
          width: 100%;
          height: 100%;
          background: linear-gradient(135deg, #0e2a4d 0%, #1e4d8a 100%);
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 48px;
          font-weight: 700;
          border-radius: 12px;
          border: 4px solid white;
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        .logo-upload-btn {
          position: absolute;
          bottom: -4px;
          right: -4px;
          background: #00B4D8;
          border: 2px solid white;
          border-radius: 50%;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          color: white;
          box-shadow: 0 2px 8px rgba(0,0,0,0.2);
          transition: transform 0.2s;
        }
        .logo-upload-btn:hover {
          transform: scale(1.1);
        }
        .company-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 16px;
          margin-top: 8px;
        }
        .toast {
          position: fixed;
          bottom: 24px;
          right: 24px;
          padding: 12px 20px;
          border-radius: 8px;
          color: white;
          display: flex;
          align-items: center;
          gap: 10px;
          z-index: 1000;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        }
        .toast-success { background: #0e2a4d; }
        .toast-error { background: #ef4444; }
      `}</style>
    </div>
  );
}
