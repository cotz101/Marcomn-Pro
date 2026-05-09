'use client';
import { useRef, useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import ProfessionalCard from '../connections/ProfessionalCard';
import { createClient } from '@/lib/supabase';
import { Camera, Briefcase, MapPin, Edit3, X, Check, Plus, ArrowLeft, Ship, MessageSquare, UserPlus, UserCheck } from 'lucide-react';

export default function Profile({ profile: initialProfile, setProfile: setInitialProfile, userId: currentUserId }) {
  const router = useRouter();
  const params = useParams();
  const viewUid = params?.id;
  const isOwnProfile = !viewUid || viewUid === currentUserId;

  const [profile, setProfile] = useState(initialProfile || {});
  const [loading, setLoading] = useState(!isOwnProfile);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editName, setEditName] = useState(profile.name || '');
  const [editBio, setEditBio] = useState(profile.bio || '');
  const [editLocation, setEditLocation] = useState(profile.location || '');
  const [editCurrentRole, setEditCurrentRole] = useState(profile.currentRole || '');
  const [editPreviousRole, setEditPreviousRole] = useState(profile.previousRole || '');
  const [editSkillsInput, setEditSkillsInput] = useState('');
  const [editOpenToWork, setEditOpenToWork] = useState(profile.openToWork || 'Not Available');
  const [editYearsExperience, setEditYearsExperience] = useState(profile.yearsExperience || 0);
  const [editIsSailing, setEditIsSailing] = useState(profile.isSailing || false);
  const [editVesselName, setEditVesselName] = useState(profile.vesselName || '');
  
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('success');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const profilePicInputRef = useRef(null);
  const coverPhotoInputRef = useRef(null);
  const avatarUploadRef = useRef(null);

  const showToast = (msg, type = 'success') => {
    setToastMessage(msg);
    setToastType(type);
    setTimeout(() => setToastMessage(''), 3500);
  };

  // Fetch profile if viewing someone else
  useEffect(() => {
    if (!isOwnProfile && viewUid) {
      const fetchViewedProfile = async () => {
        setLoading(true);
        const supabase = createClient();
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', viewUid)
          .single();

        if (!error && data) {
          // Map DB keys to component keys
          setProfile({
            ...data,
            name: data.name,
            profilePic: data.avatar_url || data.profile_pic_url,
            coverPhoto: data.cover_photo_url,
          });
          
          // Check if following (actual fetch)
          const { data: followData } = await supabase
            .from('follows')
            .select('*')
            .eq('follower_id', currentUserId)
            .eq('following_id', viewUid)
            .maybeSingle();
          
          setIsFollowing(!!followData);
        }
        setLoading(false);
      };
      fetchViewedProfile();
    } else {
      setProfile(initialProfile);
    }
  }, [viewUid, isOwnProfile, initialProfile, currentUserId]);

  // Sync skills_input when profile changes
  useEffect(() => {
    if (profile?.skills && Array.isArray(profile.skills)) {
      setEditSkillsInput(profile.skills.join(', '));
    }
  }, [profile?.skills]);
 
  const handleOpenModal = () => {
    if (!isOwnProfile) return;
    setEditName(profile.name || '');
    setEditBio(profile.bio || '');
    setEditLocation(profile.location || '');
    setEditCurrentRole(profile.currentRole || '');
    setEditPreviousRole(profile.previousRole || '');
    setEditSkillsInput(Array.isArray(profile.skills) ? profile.skills.join(', ') : '');
    setEditOpenToWork(profile.openToWork || 'Not Available');
    setEditYearsExperience(profile.yearsExperience || 0);
    setEditIsSailing(profile.isSailing || false);
    setEditVesselName(profile.vesselName || '');
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  // Upload avatar to Supabase Storage and return the public URL
  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !currentUserId) return;

    setUploading(true);
    const supabase = createClient();
    const ext = file.name.split('.').pop();
    const path = `${currentUserId}/avatar.${ext}`;

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
    await supabase.from('profiles').upsert({ id: currentUserId, avatar_url: publicUrl });
 
    const newPic = { profilePic: publicUrl };
    setProfile(prev => ({ ...prev, ...newPic }));
    if (isOwnProfile && setInitialProfile) {
      setInitialProfile(newPic);
    }
    showToast('Avatar updated!');
    setUploading(false);
  };

  const handleSaveModal = async () => {
    if (!currentUserId) {
      setIsModalOpen(false);
      return;
    }
 
    setSaving(true);
    const supabase = createClient();
    
    // Decouple data and ensure type safety - No nulls sent
    const profileUpdate = {
      id: currentUserId,
      name: editName || '',
      bio: editBio || '',
      location: editLocation || '',
      currentRole: editCurrentRole || '',
      previousRole: editPreviousRole || '',
      skills: editSkillsInput ? getSkillsArray(editSkillsInput) : [],
      openToWork: editOpenToWork || 'Not Available',
      yearsExperience: parseInt(editYearsExperience) || 0,
      isSailing: !!editIsSailing,
      vesselName: editIsSailing ? (editVesselName || '') : '',
      updated_at: new Date().toISOString(),
    };
 
    const { error } = await supabase.from('profiles').upsert(profileUpdate);
 
    if (!error) {
      const updatedProfile = {
        ...profile,
        name: profileUpdate.name,
        currentRole: profileUpdate.currentRole,
        bio: profileUpdate.bio,
        location: profileUpdate.location,
        previousRole: profileUpdate.previousRole,
        skills: profileUpdate.skills,
        isSailing: profileUpdate.isSailing,
        vesselName: profileUpdate.vesselName,
        openToWork: profileUpdate.openToWork,
        yearsExperience: profileUpdate.yearsExperience,
        profilePic: profile.profilePic,
        coverPhoto: profile.coverPhoto
      };
      setProfile(updatedProfile);
      if (isOwnProfile && setInitialProfile) {
        setInitialProfile(updatedProfile);
      }
      
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

  // Helper to get skills as an array for the preview/save
  const getSkillsArray = (input) => {
    if (!input) return [];
    return input.split(',').map(s => s.trim()).filter(s => s !== '').slice(0, 5);
  };

  const handleFollow = async () => {
    if (!currentUserId || !viewUid) return;
    const supabase = createClient();
    
    if (isFollowing) {
      // Unfollow
      const { error } = await supabase
        .from('follows')
        .delete()
        .eq('follower_id', currentUserId)
        .eq('following_id', viewUid);
      
      if (!error) setIsFollowing(false);
    } else {
      // Follow
      const { error } = await supabase
        .from('follows')
        .insert({ follower_id: currentUserId, following_id: viewUid });
      
      if (!error) setIsFollowing(true);
    }
  };

  const handleCoverUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const newCover = { coverPhoto: reader.result };
        setProfile(prev => ({ ...prev, ...newCover }));
        if (isOwnProfile && setInitialProfile) {
          setInitialProfile(newCover);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  if (loading) {
    return <div className="p-20 text-center text-slate-500 font-medium">Loading profile...</div>;
  }

  return (
    <div className="profile-page-wrapper">
      <div className="profile-layout-container">
        {/* Navigation / Back Button */}
        <div className="mb-4">
          <button 
            onClick={() => router.back()} 
            className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-[#002b4e] transition-colors"
          >
            <ArrowLeft size={16} /> Back
          </button>
        </div>

        {/* ── Profile Card ── */}
        <section className="profile-card">
          <div 
            className={`cover-photo-container ${isOwnProfile ? 'cursor-pointer' : 'pointer-events-none'}`} 
            onClick={() => isOwnProfile && coverPhotoInputRef.current.click()}
            style={{ 
              backgroundImage: profile?.coverPhoto ? `url(${profile.coverPhoto})` : 'none',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundColor: '#004173' // Fallback blue
            }}
          >
            {isOwnProfile && <div className="edit-overlay">Click to change cover</div>}
            <input type="file" accept="image/*" ref={coverPhotoInputRef} style={{ display: 'none' }} onChange={handleCoverUpload} />
          </div>

          <div className="profile-info px-4 md:px-6 lg:px-8">
            <div className="profile-header-top">
              {/* Avatar with real upload */}
              <div className="profile-pic-container" style={{ position: 'relative' }}>
                <img src={profile.profilePic || 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y'} alt={profile.name} className="profile-pic" />
                {isOwnProfile && (
                  <>
                    <button
                      onClick={() => avatarUploadRef.current.click()}
                      disabled={uploading}
                      style={{
                        position: 'absolute', bottom: 4, right: 4,
                        background: '#0e2a4d', border: '2px solid white', borderRadius: '50%',
                        width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', color: 'white', zIndex: 20
                      }}
                      title="Change avatar"
                    >
                      {uploading ? '…' : <Camera size={14} />}
                    </button>
                    <input type="file" accept="image/*" ref={avatarUploadRef} style={{ display: 'none' }} onChange={handleAvatarUpload} />
                  </>
                )}
              </div>

              {isOwnProfile && (
                <button className="btn-edit-profile" onClick={handleOpenModal} aria-label="Edit Profile">
                  <Edit3 size={18} />
                </button>
              )}
            </div>

            <h1 className="profile-name">{profile.name}</h1>
            <h2 className="profile-headline">{profile.currentRole}</h2>


            <div className="flex flex-row flex-wrap items-center justify-between w-full mt-2">
              {profile.location && (
                <p className="profile-location flex items-center gap-1" style={{ color: 'var(--text-secondary)' }}>
                  <MapPin size={14} className="text-slate-400" /> 
                  <span className="text-sm font-medium">{profile.location}</span>
                </p>
              )}

              {isOwnProfile ? (
                <button 
                  className="btn-secondary w-auto px-4 py-1.5 text-sm inline-flex items-center gap-2 font-semibold" 
                  onClick={handleOpenModal}
                >
                  <Edit3 size={16} /> Edit Profile
                </button>
              ) : (
                <div className="flex flex-row gap-2">
                  <button 
                    className="w-auto px-4 py-1.5 text-sm inline-flex items-center gap-2 bg-blue-900 text-white font-bold rounded-lg transition-all shadow-sm active:scale-[0.98]"
                    onClick={handleFollow}
                  >
                    {isFollowing ? <Check size={16} /> : <Plus size={16} />}
                    {isFollowing ? 'Following' : 'Follow'}
                  </button>
                  <button className="w-auto px-4 py-1.5 text-sm inline-flex items-center gap-2 bg-white border-2 border-blue-900 text-blue-900 font-bold rounded-lg transition-all shadow-sm active:scale-[0.98]">
                    <MessageSquare size={16} />
                    Message
                  </button>
                </div>
              )}
            </div>

            {/* Professional Overview Section */}
            <div className="mt-6 pt-6 border-t border-slate-100">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">Professional Overview</h3>
              
              <div className="flex flex-col gap-4">
                {/* Skills Chips */}
                {profile.skills && Array.isArray(profile.skills) && profile.skills.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {profile.skills.map((skill, index) => (
                      <span 
                        key={index} 
                        className="px-3 py-1 bg-gray-100 text-[#002b4e] rounded-full text-sm font-medium border border-gray-200"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex flex-wrap gap-6 items-center">
                  {/* Years of Experience */}
                  <div className="flex items-center gap-2 text-slate-600">
                    <Briefcase size={16} className="text-slate-400" />
                    <span className="text-sm font-semibold">
                      {profile.yearsExperience > 0 ? `${profile.yearsExperience} Years of Experience` : 'Career Starting'}
                    </span>
                  </div>

                  {/* Sailing Status */}
                  {profile.isSailing && (
                    <div className="flex items-center gap-2 text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100">
                      <Ship size={16} />
                      <span className="text-sm font-bold">Currently Sailing: {profile.vesselName || 'Vessel'}</span>
                    </div>
                  )}
                </div>
              </div>
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
          <div className="modal-content max-w-2xl" onClick={e => e.stopPropagation()}>
            <div className="modal-header" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                <h2 className="text-xl font-bold text-[#002b4e]">Edit profile</h2>
                <button className="btn-close" onClick={handleCloseModal}><X size={20} /></button>
              </div>
            </div>
 
            <div className="modal-body" style={{ padding: '24px', textAlign: 'left', maxHeight: '75vh', overflowY: 'auto' }}>
                <div className="flex flex-col gap-8">
                  
                  {/* Photo & Media Section (Now at Top) */}
                  <div className="media-section flex flex-col items-center justify-center p-6 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                    <div className="relative group">
                      <img 
                        src={profile.profilePic || 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y'} 
                        alt="Preview" 
                        className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-lg" 
                      />
                      <div className="absolute inset-0 rounded-full bg-black/10 group-hover:bg-black/20 transition-all flex items-center justify-center">
                        <Camera size={24} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>
                    <div className="flex gap-3 mt-4">
                      <button 
                        className="btn-secondary text-xs py-2 px-4 bg-white border border-slate-200 shadow-sm hover:shadow-md transition-all font-semibold"
                        onClick={() => avatarUploadRef.current.click()}
                      >
                        Change Profile Photo
                      </button>
                    </div>
                  </div>

                  {/* Section A: Personal Details */}
                  <div className="section-a">
                    <h3 className="text-lg font-bold text-[#002b4e] mb-4 flex items-center gap-2 border-b pb-2">
                      Personal Details
                    </h3>
                    <div className="flex flex-col gap-4">
                      <div className="form-group">
                        <label className="text-sm font-semibold mb-1 block text-slate-600">Name</label>
                        <input
                          type="text"
                          className="form-input w-full p-2 border rounded border-slate-200 focus:ring-2 focus:ring-[#002b4e]/10 outline-none"
                          placeholder="Your full name"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                        />
                      </div>

                      <div className="form-group">
                        <label className="text-sm font-semibold mb-1 block text-slate-600">Personal Bio (Max 120 characters)</label>
                        <textarea
                          className="form-textarea w-full p-2 border rounded border-slate-200 focus:ring-2 focus:ring-[#002b4e]/10 outline-none"
                          rows={3}
                          maxLength={120}
                          value={editBio}
                          onChange={(e) => setEditBio(e.target.value)}
                          placeholder="Tell us about yourself..."
                        />
                        <div className="flex justify-between mt-1">
                          <p className="text-[10px] text-slate-400 italic">Maritime background summary</p>
                          <p className={`text-xs font-medium ${editBio.length >= 110 ? 'text-orange-500' : 'text-slate-400'}`}>
                            {editBio.length}/120
                          </p>
                        </div>
                      </div>

                      <div className="form-group">
                        <label className="text-sm font-semibold mb-1 block text-slate-600">Location</label>
                        <div className="relative">
                          <MapPin size={16} className="absolute left-2.5 top-2.5 text-slate-400" />
                          <input
                            type="text"
                            className="form-input w-full p-2 pl-9 border rounded border-slate-200 focus:ring-2 focus:ring-[#002b4e]/10 outline-none"
                            placeholder="City, Country"
                            value={editLocation}
                            onChange={(e) => setEditLocation(e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Section B: Professional Details */}
                  <div className="section-b p-5 bg-slate-50 rounded-xl border border-slate-200">
                    <h3 className="text-lg font-bold text-[#002b4e] mb-4 flex items-center gap-2">
                      <Briefcase size={20} className="text-[#0e2a4d]" />
                      Professional Details
                    </h3>
                    <div className="flex flex-col gap-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="form-group">
                          <label className="text-sm font-semibold mb-1 block text-slate-600">Current Role</label>
                          <input
                            type="text"
                            className="form-input w-full p-2 border rounded bg-white border-slate-200 focus:ring-2 focus:ring-[#002b4e]/10 outline-none"
                            placeholder="e.g. Chief Engineer"
                            value={editCurrentRole}
                            onChange={(e) => setEditCurrentRole(e.target.value)}
                          />
                        </div>
                        <div className="form-group">
                          <label className="text-sm font-semibold mb-1 block text-slate-600">Previous Job Role</label>
                          <input
                            type="text"
                            className="form-input w-full p-2 border rounded bg-white border-slate-200 focus:ring-2 focus:ring-[#002b4e]/10 outline-none"
                            placeholder="Previous rank or position"
                            value={editPreviousRole}
                            onChange={(e) => setEditPreviousRole(e.target.value)}
                          />
                        </div>
                      </div>

                      <div className="form-group">
                        <label className="text-sm font-semibold mb-1 block text-slate-600">Skills (Comma separated)</label>
                        <input
                          type="text"
                          className="form-input w-full p-2 border rounded bg-white border-slate-200 focus:ring-2 focus:ring-[#002b4e]/10 outline-none"
                          placeholder="e.g. Navigation, Safety, Engine Maintenance"
                          value={editSkillsInput}
                          onChange={(e) => setEditSkillsInput(e.target.value)}
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="form-group">
                          <label className="text-sm font-semibold mb-1 block text-slate-600">Open to Work</label>
                          <select 
                            className="form-input w-full p-2 border rounded bg-white border-slate-200 focus:ring-2 focus:ring-[#002b4e]/10 outline-none"
                            value={editOpenToWork}
                            onChange={(e) => setEditOpenToWork(e.target.value)}
                          >
                            <option value="Available">Available</option>
                            <option value="Not Available">Not Available</option>
                          </select>
                        </div>
                        <div className="form-group">
                          <label className="text-sm font-semibold mb-1 block text-slate-600">Years of Experience</label>
                          <input
                            type="number"
                            className="form-input w-full p-2 border rounded bg-white border-slate-200 focus:ring-2 focus:ring-[#002b4e]/10 outline-none"
                            value={editYearsExperience}
                            onChange={(e) => setEditYearsExperience(e.target.value)}
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-slate-100 mt-2 shadow-sm">
                        <div>
                          <p className="text-sm font-semibold flex items-center gap-2 text-slate-700">
                            <Ship size={16} className="text-[#002b4e]" />
                            Are you currently sailing?
                          </p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input 
                            type="checkbox" 
                            className="sr-only peer"
                            checked={editIsSailing}
                            onChange={(e) => setEditIsSailing(e.target.checked)}
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#002b4e]"></div>
                        </label>
                      </div>

                      {editIsSailing && (
                        <div className="form-group animate-in fade-in slide-in-from-top-2 duration-300">
                          <label className="text-sm font-semibold mb-1 block text-slate-600">Vessel Name</label>
                          <input
                            type="text"
                            className="form-input w-full p-2 border rounded bg-white border-slate-200 focus:ring-2 focus:ring-[#002b4e]/10 outline-none"
                            placeholder="e.g. MV MarComn Explorer"
                            value={editVesselName}
                            onChange={(e) => setEditVesselName(e.target.value)}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
            </div>
 
            <div className="modal-footer">
              <button className="btn-secondary" onClick={handleCloseModal}>Cancel</button>
              <button className="btn-primary px-8" onClick={handleSaveModal} disabled={saving}>
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
