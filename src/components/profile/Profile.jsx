'use client';
import { useRef, useState } from 'react';
import { createClient } from '@/lib/supabase';
import { Camera, Briefcase, MapPin, Edit3, X, Check } from 'lucide-react';

export default function Profile({ profile, setProfile, userId }) {
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

  const handleOpenModal = () => {
    setEditForm(profile);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => setIsModalOpen(false);

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
    const { error } = await supabase.from('profiles').upsert({
      id: userId,
      full_name: editForm.fullName,
      headline: editForm.headline,
      location: editForm.location,
      about: editForm.about,
      bio: editForm.bio,
      current_position: editForm.currentPosition,
      current_company: editForm.currentCompany,
      previous_role: editForm.previous_role,
      skills: editForm.skills,
      is_sailing: editForm.is_sailing,
      vessel_name: editForm.vessel_name,
      open_to_work: editForm.open_to_work,
    });

    if (!error) {
      setProfile(editForm);
      setIsModalOpen(false);
      showToast('Profile updated successfully!');
    } else {
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
    const skillsArray = e.target.value.split(',').map(s => s.trim()).filter(s => s !== '');
    setEditForm(prev => ({ ...prev, skills: skillsArray.slice(0, 5) }));
  };

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
    <>
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
        <section className="profile-card about-card">
          <h2 className="section-title">About</h2>
          <p className="about-text">{profile.bio || profile.about}</p>
        </section>
      )}

      {/* ── Edit Modal ── */}
      {isModalOpen && (
        <div className="modal-overlay">
            <div className="modal-header" style={{ borderBottom: 'none', paddingBottom: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                <h2>Edit profile</h2>
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

            <div className="modal-body">
              {activeTab === 'basic' ? (
                <>
                  {/* Avatar preview in modal */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
                    <img
                      src={editForm.profilePic || '/profile_pic.png'}
                      alt="Avatar preview"
                      style={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'cover', border: '3px solid #e2e8f0' }}
                    />
                    <div>
                      <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>Profile photo</p>
                      <button
                        className="btn-secondary"
                        style={{ fontSize: 13, padding: '6px 14px' }}
                        onClick={() => avatarUploadRef.current.click()}
                        disabled={uploading}
                      >
                        {uploading ? 'Uploading…' : 'Change photo'}
                      </button>
                    </div>
                  </div>

                  {[
                    { label: 'Full Name', name: 'fullName' },
                    { label: 'Headline', name: 'headline' },
                    { label: 'Current Position', name: 'currentPosition' },
                    { label: 'Current Company', name: 'currentCompany' },
                    { label: 'Location', name: 'location' },
                  ].map(({ label, name }) => (
                    <div className="form-group" key={name}>
                      <label>{label}</label>
                      <input
                        type="text"
                        name={name}
                        className="form-input"
                        value={editForm[name] || ''}
                        onChange={handleInputChange}
                      />
                    </div>
                  ))}
                </>
              ) : (
                <>
                  <div className="form-group">
                    <label>Professional Bio (Max 120 chars)</label>
                    <textarea
                      name="bio"
                      className="form-textarea"
                      rows={3}
                      maxLength={120}
                      placeholder="Brief professional summary..."
                      value={editForm.bio || ''}
                      onChange={handleInputChange}
                    />
                    <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
                      {(editForm.bio || '').length}/120 characters
                    </p>
                  </div>

                  <div className="form-group">
                    <label>Previous Role</label>
                    <input
                      type="text"
                      name="previous_role"
                      className="form-input"
                      placeholder="e.g. Second Officer"
                      value={editForm.previous_role || ''}
                      onChange={handleInputChange}
                    />
                  </div>

                  <div className="form-group">
                    <label>Skills (Comma separated, max 5)</label>
                    <input
                      type="text"
                      name="skills_input"
                      className="form-input"
                      placeholder="Navigation, Engineering, Safety..."
                      defaultValue={(editForm.skills || []).join(', ')}
                      onBlur={handleSkillsChange}
                    />
                    <div className="flex flex-wrap gap-2 mt-2">
                      {(editForm.skills || []).map((skill, i) => (
                        <span key={i} className="skill-pill" style={{ margin: 0 }}>{skill}</span>
                      ))}
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 8 }}>
                    <div className="flex items-center justify-between">
                      <div>
                        <label style={{ margin: 0, cursor: 'pointer' }} htmlFor="is_sailing">Are you currently sailing?</label>
                        <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Toggle ON if you are active at sea</p>
                      </div>
                      <input 
                        id="is_sailing"
                        type="checkbox" 
                        name="is_sailing" 
                        checked={editForm.is_sailing || false}
                        onChange={handleInputChange}
                        style={{ width: 20, height: 20, cursor: 'pointer' }}
                      />
                    </div>

                    {editForm.is_sailing && (
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label>Current Vessel Name</label>
                        <input
                          type="text"
                          name="vessel_name"
                          className="form-input"
                          placeholder="e.g. MV Maersk Explorer"
                          value={editForm.vessel_name || ''}
                          onChange={handleInputChange}
                        />
                      </div>
                    )}

                    <div className="flex items-center justify-between border-t pt-4">
                      <div>
                        <label style={{ margin: 0, cursor: 'pointer' }} htmlFor="open_to_work">Open to New Opportunities?</label>
                        <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Display "Available" status on your card</p>
                      </div>
                      <input 
                        id="open_to_work"
                        type="checkbox" 
                        name="open_to_work" 
                        checked={editForm.open_to_work || false}
                        onChange={handleInputChange}
                        style={{ width: 20, height: 20, cursor: 'pointer' }}
                      />
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="modal-footer">
              <div className="form-group mb-0">
                <textarea
                  name="about"
                  style={{ display: 'none' }}
                  value={editForm.about || ''}
                  readOnly
                />
              </div>
              <button className="btn-secondary" onClick={handleCloseModal}>Cancel</button>
              <button className="btn-primary" onClick={handleSaveModal} disabled={saving}>
                {saving ? 'Saving…' : <><Check size={16} style={{ marginRight: 6 }} />Save</>}
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
    </>
  );
}
