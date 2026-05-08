'use client';
import { useRef, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ProfessionalCard from '../connections/ProfessionalCard';
import { createClient } from '@/lib/supabase';
import { Camera, Briefcase, MapPin, Edit3, X, Check, ArrowLeft, Ship } from 'lucide-react';

export default function Profile({ profile, setProfile, userId }) {
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editForm, setEditForm] = useState(profile);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('success');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('basic'); // 'basic' or 'professional'

  const profilePicInputRef = useRef(null);
  const coverPhotoInputRef = useRef(null);
  const avatarUploadRef = useRef(null);

  const showToast = (msg, type = 'success') => {
    setToastMessage(msg);
    setToastType(type);
    setTimeout(() => setToastMessage(''), 3500);
  };

  // Sync skills_input when editForm changes or modal opens
  useEffect(() => {
    if (profile.skills && Array.isArray(profile.skills)) {
      setEditForm(prev => ({ ...prev, skills_input: profile.skills.join(', ') }));
    }
  }, [profile.skills]);

  const handleOpenModal = () => {
    setEditForm({
      ...profile,
      headline: profile.headline || '',
      bio: profile.bio || '',
      skills_input: Array.isArray(profile.skills) ? profile.skills.join(', ') : ''
    });
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setActiveTab('basic');
  };

  // Upload avatar to Supabase Storage and return the public URL
  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !userId) return;

    setUploading(true);
    const supabase = createClient();
    const ext = file.name.split('.').pop();
    const path = `${userId}/avatar.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true });

    if (uploadError) {
      showToast('Upload failed: ' + uploadError.message, 'error');
      setUploading(false);
      return;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('avatars')
      .getPublicUrl(path);

    // Persist the URL immediately in the DB
    await supabase.from('profiles').upsert({ id: userId, avatar_url: publicUrl });

    setEditForm(prev => ({ ...prev, profilePic: publicUrl }));
    setProfile({ profilePic: publicUrl });
    showToast('Avatar updated!');
    setUploading(false);
  };

  const handleSaveModal = async () => {
    if (!userId) {
      setProfile(editForm);
      setIsModalOpen(false);
      return;
    }

    setSaving(true);
    const supabase = createClient();
    
    // Decouple data and ensure type safety
    const profileUpdate = {
      id: userId,
      full_name: editForm.fullName || profile.fullName,
      headline: editForm.headline || '', // Distinct headline column
      location: editForm.location || '',
      about: editForm.about || '',
      bio: editForm.bio || '',
      current_position: editForm.currentPosition || '',
      current_company: editForm.currentCompany || '',
      previous_role: editForm.previous_role || '',
      skills: editForm.skills_input ? getSkillsArray(editForm.skills_input) : (Array.isArray(editForm.skills) ? editForm.skills : []),
      is_sailing: !!editForm.is_sailing,
      vessel_name: editForm.is_sailing ? (editForm.vessel_name || '') : '', // Logic: vessel only if sailing
      open_to_work: !!editForm.open_to_work,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from('profiles').upsert(profileUpdate);

    if (!error) {
      const updatedProfile = {
        ...editForm,
        headline: profileUpdate.headline,
        bio: profileUpdate.bio,
        skills: profileUpdate.skills,
        is_sailing: profileUpdate.is_sailing,
        vessel_name: profileUpdate.vessel_name
      };
      setProfile(updatedProfile);
      
      // Dispatch event to refresh DiscoveryGrid
      window.dispatchEvent(new CustomEvent('marcomn-profile-updated', { 
        detail: updatedProfile 
      }));

      setIsModalOpen(false);
      showToast('Profile updated successfully!');
    } else {
      console.error('Update Error:', error);
      showToast('Error: ' + error.message, 'error');
    }
    setSaving(false);
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setEditForm(prev => ({ 
      ...prev, 
      [name]: type === 'checkbox' ? checked : value 
    }));
  };

  const handleSkillsChange = (e) => {
    const val = e.target.value;
    // Don't split on every character, just keep the string while typing
    // We will parse it into an array on save or use a local string state
    setEditForm(prev => ({ ...prev, skills_input: val }));
  };

  // Helper to get skills as an array for the preview/save
  const getSkillsArray = (input) => {
    if (!input) return [];
    return input.split(',').map(s => s.trim()).filter(s => s !== '').slice(0, 5);
  };

  const currentSkills = Array.isArray(editForm.skills) ? editForm.skills : (Array.isArray(profile.skills) ? profile.skills : []);
  const currentIsSailing = editForm.is_sailing !== undefined ? editForm.is_sailing : profile.is_sailing;
  const currentVessel = editForm.vessel_name !== undefined ? editForm.vessel_name : profile.vessel_name;

  const handleCoverUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfile(prev => ({ ...prev, coverPhoto: reader.result }));
        setEditForm(prev => ({ ...prev, coverPhoto: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="profile-page-wrapper">
      <div className="profile-layout-container">
        {/* ── Profile Card ── */}
        <section className="profile-card">
          <div className="cover-photo-container" onClick={() => coverPhotoInputRef.current.click()}>
            <img src={profile.coverPhoto || '/cover_photo.png'} alt="Cover" />
            <div className="edit-overlay">Click to change cover</div>
            <input type="file" accept="image/*" ref={coverPhotoInputRef} style={{ display: 'none' }} onChange={handleCoverUpload} />
          </div>

          <div className="profile-info">
            <div className="profile-header-top">
              {/* Avatar with real upload */}
              <div className="profile-pic-container" style={{ position: 'relative' }}>
                <img src={profile.profilePic || '/profile_pic.png'} alt={profile.fullName} className="profile-pic" />
                <button
                  onClick={() => avatarUploadRef.current.click()}
                  disabled={uploading}
                  style={{
                    position: 'absolute', bottom: 4, right: 4,
                    background: '#0e2a4d', border: '2px solid white', borderRadius: '50%',
                    width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', color: 'white'
                  }}
                  title="Change avatar"
                >
                  {uploading ? '…' : <Camera size={14} />}
                </button>
                <input type="file" accept="image/*" ref={avatarUploadRef} style={{ display: 'none' }} onChange={handleAvatarUpload} />
              </div>

              <button className="btn-edit-profile" onClick={handleOpenModal} aria-label="Edit Profile">
                <Edit3 size={18} />
              </button>
            </div>

            <h1 className="profile-name">{profile.fullName}</h1>
            <h2 className="profile-headline">{profile.headline}</h2>

            {(profile.currentPosition || profile.currentCompany) && (
              <p className="profile-location" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Briefcase size={14} />
                {profile.currentPosition}{profile.currentPosition && profile.currentCompany ? ' at ' : ''}{profile.currentCompany}
              </p>
            )}

            {profile.location && (
              <p className="profile-location" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <MapPin size={14} /> {profile.location}
              </p>
            )}

            <div className="action-buttons">
              <button className="btn-primary">Connect</button>
              <button className="btn-secondary">Message</button>
            </div>
          </div>
        </section>

        {/* ── About Card ── */}
        {(profile.bio || profile.about) && (
          <section className="profile-card about-card" style={{ marginTop: '16px' }}>
            <h2 className="section-title">About</h2>
            <p className="about-text">{profile.bio || profile.about}</p>
          </section>
        )}
      </div>

      {/* ── Edit Modal ── */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header" style={{ borderBottom: 'none', paddingBottom: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                <h2 className="text-xl font-bold text-[#002b4e]">Edit profile</h2>
                <button className="btn-close" onClick={handleCloseModal}><X size={20} /></button>
              </div>
              <div className="flex gap-4 mt-4 border-b">
                <button 
                  onClick={() => setActiveTab('basic')}
                  className={`pb-2 px-1 text-sm font-medium transition-all ${activeTab === 'basic' ? 'border-b-2 border-[#002b4e] text-[#002b4e]' : 'text-gray-500 border-transparent'}`}
                >
                  Basic Info
                </button>
                <button 
                  onClick={() => setActiveTab('professional')}
                  className={`pb-2 px-1 text-sm font-medium transition-all ${activeTab === 'professional' ? 'border-b-2 border-[#002b4e] text-[#002b4e]' : 'text-gray-500 border-transparent'}`}
                >
                  Professional Details
                </button>
              </div>
            </div>

            <div className="modal-body" style={{ padding: '20px', textAlign: 'left', maxHeight: '70vh', overflowY: 'auto' }}>
              {activeTab === 'basic' ? (
                <div className="flex flex-col gap-4">
                  <div className="form-group">
                    <label className="text-sm font-semibold mb-1 block">Full Name</label>
                    <input
                      type="text"
                      name="fullName"
                      className="form-input w-full p-2 border rounded"
                      value={editForm.fullName || ''}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="form-group">
                    <label className="text-sm font-semibold mb-1 block">Headline</label>
                    <input
                      type="text"
                      name="headline"
                      className="form-input w-full p-2 border rounded"
                      value={editForm.headline || ''}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="form-group">
                    <label className="text-sm font-semibold mb-1 block">Location</label>
                    <input
                      type="text"
                      name="location"
                      className="form-input w-full p-2 border rounded"
                      value={editForm.location || ''}
                      onChange={handleInputChange}
                    />
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  <div className="form-group">
                    <label className="text-sm font-semibold mb-1 block">Professional Bio</label>
                    <textarea
                      name="bio"
                      className="form-textarea w-full p-2 border rounded"
                      rows={3}
                      value={editForm.bio || ''}
                      onChange={handleInputChange}
                      placeholder="Brief summary of your professional background..."
                    />
                  </div>

                  <div className="form-group">
                    <label className="text-sm font-semibold mb-1 block">Skills (Max 5, comma separated)</label>
                    <input
                      type="text"
                      className="form-input w-full p-2 border rounded"
                      placeholder="e.g. Navigation, Safety, Marine Engineering"
                      value={editForm.skills_input !== undefined ? editForm.skills_input : (Array.isArray(profile.skills) ? profile.skills.join(', ') : '')}
                      onChange={handleSkillsChange}
                    />
                    <div className="flex flex-wrap gap-2 mt-2">
                      {(editForm.skills_input !== undefined ? getSkillsArray(editForm.skills_input) : (Array.isArray(profile.skills) ? profile.skills : [])).map((skill, i) => (
                        <span key={i} className="px-2 py-1 bg-slate-100 text-xs rounded-full border border-slate-200 text-gray-700">
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                    <div>
                      <p className="text-sm font-semibold">Are you currently sailing?</p>
                      <p className="text-xs text-gray-500">Enable this if you are active at sea</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        name="is_sailing" 
                        className="sr-only peer"
                        checked={currentIsSailing || false}
                        onChange={handleInputChange}
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#002b4e]"></div>
                    </label>
                  </div>

                  {currentIsSailing && (
                    <div className="form-group animate-in fade-in slide-in-from-top-2 duration-300">
                      <label className="text-sm font-semibold mb-1 block">Current Vessel</label>
                      <input
                        type="text"
                        name="vessel_name"
                        className="form-input w-full p-2 border rounded"
                        placeholder="e.g. MV MarComn Explorer"
                        value={currentVessel || ''}
                        onChange={handleInputChange}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn-secondary" onClick={handleCloseModal}>Cancel</button>
              <button className="btn-primary" onClick={handleSaveModal} disabled={saving}>
                {saving ? 'Saving...' : <><Check size={16} style={{ marginRight: 6 }} /> Save Changes</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Toast ── */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed', bottom: 88, right: 20,
            background: toastType === 'error' ? '#cc0000' : '#0e2a4d',
            color: 'white', padding: '12px 20px', borderRadius: 10,
            boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
            display: 'flex', alignItems: 'center', gap: 10, zIndex: 9999,
            fontSize: 14, fontWeight: 500
          }}
        >
          {toastType === 'success'
            ? <Check size={18} style={{ color: '#4ade80' }} />
            : <X size={18} style={{ color: '#fca5a5' }} />}
          {toastMessage}
        </div>
      )}
    </div>
  );
}
