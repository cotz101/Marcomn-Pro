'use client';
import { useRef, useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

import { createClient } from '@/lib/supabase';
import { getCandidateReputation } from '@/app/actions/reputation';
import { Camera, Briefcase, MapPin, Edit3, X, Check, Plus, ArrowLeft, Ship, MessageSquare, Lock, Coins } from 'lucide-react';

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
  const [messagePrivacy, setMessagePrivacy] = useState('connections');
  const [isFollowedBack, setIsFollowedBack] = useState(false);
  const [reputation, setReputation] = useState(null);
  
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('success');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  
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
          .maybeSingle();

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

          // Check if they follow us back (mutual follow)
          const { data: followBackData } = await supabase
            .from('follows')
            .select('*')
            .eq('follower_id', viewUid)
            .eq('following_id', currentUserId)
            .maybeSingle();

          setIsFollowedBack(!!followBackData);
        }
        setLoading(false);
      };
      fetchViewedProfile();
    } else if (isOwnProfile && initialProfile) {
      setProfile(initialProfile);
    }
  }, [viewUid, isOwnProfile, initialProfile, currentUserId]);

  useEffect(() => {
    const fetchReputation = async () => {
      const targetUid = viewUid || currentUserId;
      if (!targetUid) return;
      try {
        const rep = await getCandidateReputation(targetUid);
        setReputation(rep);
      } catch (err) {
        console.error('Failed to fetch reputation', err);
      }
    };
    fetchReputation();
  }, [viewUid, currentUserId]);

  // Removed sync of editSkillsInput; handled when opening modal
 
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
    setMessagePrivacy(profile.message_privacy || 'connections');
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
      message_privacy: messagePrivacy,
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
        message_privacy: profileUpdate.message_privacy,
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
      
      if (!error) {
        setIsFollowing(true);
        
        // Connection Notification Bridge
        try {
          // Guard against Duplicate Notifs (don't spam if unfollow/re-follow)
          const { count } = await supabase.from('notifications')
            .select('*', { count: 'exact', head: true })
            .eq('recipient_id', viewUid)
            .eq('sender_id', currentUserId)
            .eq('type', 'connection');

          if (count === 0) {
            await supabase.from('notifications').insert([{
              recipient_id: viewUid,
              sender_id: currentUserId,
              type: 'connection',
              title: 'New Connection',
              body: 'Started following you',
              link: '/profile/' + currentUserId,
              is_read: false
            }]);
          }
        } catch (err) {
          console.error('Failed to send connection notification:', err);
        }
      }
    }
  };

  const handleMessageClick = async () => {
    if (!currentUserId || !viewUid) return;
    const supabase = createClient();
    
    try {
      // Query both combinations
      const { data: conv1 } = await supabase
        .from('conversations')
        .select('id')
        .eq('participant_one', currentUserId)
        .eq('participant_two', viewUid)
        .maybeSingle();

      if (conv1) {
        router.push(`/messages?chat=${conv1.id}`);
        return;
      }

      const { data: conv2 } = await supabase
        .from('conversations')
        .select('id')
        .eq('participant_one', viewUid)
        .eq('participant_two', currentUserId)
        .maybeSingle();

      if (conv2) {
        router.push(`/messages?chat=${conv2.id}`);
        return;
      }

      // If it does not exist, insert a new conversation
      const { data: newConv, error: insertError } = await supabase
        .from('conversations')
        .insert({
          participant_one: currentUserId,
          participant_two: viewUid
        })
        .select('id')
        .maybeSingle();

      if (insertError) {
        console.error('Error creating conversation:', insertError);
        showToast('Error starting conversation: ' + insertError.message, 'error');
        return;
      }

      router.push(`/messages?chat=${newConv.id}`);
    } catch (err) {
      console.error('Error handling message click:', err);
      showToast('Failed to start chat', 'error');
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
                <img src={profile.profilePic || '/avatar_placeholder.png'} alt={profile.name} className="profile-pic" />
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
                <div style={{ display: 'flex', gap: 8 }}>
                  <button 
                    className="btn-edit-profile" 
                    onClick={() => router.push('/profile/wallet')} 
                    style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: 6, padding: '0 12px', fontSize: 13, fontWeight: 'bold' }}
                    title="MCredits Wallet"
                  >
                    <Coins size={16} /> <span className="hidden sm:inline">Wallet</span>
                  </button>
                  <button className="btn-edit-profile" onClick={handleOpenModal} aria-label="Edit Profile" style={{ color: '#00B4D8' }}>
                    <Edit3 size={18} />
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between w-full gap-4">
              <h1 className="profile-name m-0 leading-tight">{profile.name}</h1>
              {/* Minimal right-aligned Back Button */}
              <button 
                onClick={(e) => { e.stopPropagation(); router.back(); }} 
                className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-[#002b4e] bg-slate-100/80 hover:bg-slate-200/80 px-2.5 py-1 rounded-md transition-all shadow-sm active:scale-[0.97]"
                title="Back"
              >
                <ArrowLeft size={14} strokeWidth={2.5} /> <span>Back</span>
              </button>
            </div>
            <h2 className="profile-headline">{profile.currentRole}</h2>


            <div className="flex flex-row flex-wrap items-center justify-between w-full mt-2">
              {profile.location && (
                <p className="profile-location flex items-center gap-1" style={{ color: 'var(--text-secondary)' }}>
                  <MapPin size={14} className="text-slate-400" /> 
                  <span className="text-sm font-medium">{profile.location}</span>
                </p>
              )}

              {isOwnProfile ? null : (
                <div className="flex flex-row gap-2 mt-4 md:mt-0 w-full md:w-auto">
                  <button 
                    className="flex-1 md:flex-initial w-auto px-5 py-2.5 md:px-4 md:py-1.5 text-sm md:text-xs inline-flex items-center justify-center gap-2 bg-blue-900 text-white font-bold rounded-lg transition-all shadow-sm active:scale-[0.98]"
                    onClick={handleFollow}
                  >
                    {isFollowing ? <Check size={16} /> : <Plus size={16} />}
                    {isFollowing ? 'Following' : 'Follow'}
                  </button>
                  {(() => {
                    const areConnected = isFollowing && isFollowedBack;
                    const canMessage = isOwnProfile || (profile.message_privacy === 'anyone') || areConnected;

                    if (canMessage) {
                      return (
                        <button 
                          onClick={handleMessageClick}
                          className="flex-1 md:flex-initial w-auto px-5 py-2.5 md:px-4 md:py-1.5 text-sm md:text-xs inline-flex items-center justify-center gap-2 bg-white hover:bg-slate-50 text-[#002b4e] border-2 border-[#002b4e] font-bold rounded-lg transition-all shadow-sm active:scale-[0.98]"
                        >
                          <MessageSquare size={16} className="text-[#002b4e]" />
                          Message
                        </button>
                      );
                    } else {
                      return (
                        <button 
                          disabled
                          className="flex-1 md:flex-initial w-auto px-5 py-2.5 md:px-4 md:py-1.5 text-sm md:text-xs inline-flex items-center justify-center gap-2 bg-gray-100 border border-gray-200 text-gray-400 cursor-not-allowed font-medium rounded-lg shadow-sm"
                        >
                          <Lock size={16} />
                          Inbox Private
                        </button>
                      );
                    }
                  })()}
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
                        className="px-3 py-1 bg-blue-50/80 text-blue-900 rounded-full text-sm font-semibold border border-blue-100/80 shadow-sm transition-all hover:bg-blue-100/50"
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
          <section className="profile-card about-card about-section-container" style={{ marginTop: '15px' }}>
            <h2 className="section-title">About</h2>
            <p className="about-text">{profile.bio || profile.about}</p>
          </section>
        )}

        {/* ── Trust & Reputation Card ── */}
        <section className="profile-card about-card about-section-container" style={{ marginTop: '15px' }}>
          <h2 className="section-title flex items-center gap-2 mb-4">
            <Check size={20} className="text-[#004173]" />
            Trust & Reputation
          </h2>
          {reputation ? (
            <div className="flex flex-col gap-6 mt-2">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 flex flex-col items-center justify-center text-center shadow-sm">
                  <span className="text-3xl font-bold text-[#004173] leading-none mb-1">
                    {(reputation.summary?.completed_jobs + reputation.summary?.cancelled_jobs) === 0 
                      ? 'N/A' 
                      : `${reputation.summary?.completion_rate || 0}%`}
                  </span>
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Completion Rate</span>
                </div>
                <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 flex flex-col items-center justify-center text-center shadow-sm">
                  <span className="text-3xl font-bold text-emerald-600 leading-none mb-1">{reputation.summary?.completed_jobs || 0}</span>
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Completed Jobs</span>
                </div>
                <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 flex flex-col items-center justify-center text-center shadow-sm">
                  <span className="text-3xl font-bold text-slate-700 leading-none mb-1">{reputation.summary?.cancelled_jobs || 0}</span>
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Cancelled Engagements</span>
                </div>
              </div>

              {(reputation.summary?.completed_jobs + reputation.summary?.cancelled_jobs) === 0 && (
                <div className="text-center py-6 text-sm font-semibold text-slate-500 bg-slate-50 border border-dashed border-slate-200 rounded-xl">
                  No engagement history yet.
                </div>
              )}

              {reputation.feedback && reputation.feedback.length > 0 && (
                <div className="mt-2">
                  <h3 className="text-sm font-bold text-slate-800 mb-4">Recent Feedback</h3>
                  <div className="flex flex-col gap-3">
                    {reputation.feedback.map((fb, idx) => (
                      <div key={idx} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-start gap-4">
                        <div className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center border ${
                          fb.feedback_sentiment === 'positive' ? 'bg-emerald-50 border-emerald-200 text-emerald-600' :
                          fb.feedback_sentiment === 'neutral' ? 'bg-amber-50 border-amber-200 text-amber-600' :
                          'bg-red-50 border-red-200 text-red-600'
                        }`}>
                          {fb.feedback_sentiment === 'positive' ? <Check size={20} /> :
                           fb.feedback_sentiment === 'neutral' ? <span className="font-bold">-</span> :
                           <X size={20} />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-bold text-[13px] text-slate-800">
                              {fb.companies?.name || 'Company'}
                            </span>
                            <span className="text-[11px] text-slate-400">
                              {new Date(fb.created_at).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
                            </span>
                          </div>
                          
                          {fb.feedback_tags && fb.feedback_tags.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mb-2">
                              {fb.feedback_tags.map((tag, tIdx) => (
                                <span key={tIdx} className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md text-[10px] font-semibold tracking-wide uppercase">
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                          
                          {fb.feedback_comment && (
                            <p className="text-sm text-slate-600 italic">"{fb.feedback_comment}"</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="p-4 text-center text-sm text-slate-400 animate-pulse">Loading reputation...</div>
          )}
        </section>
      </div>

      {/* ── Edit Modal ── */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal-content max-w-2xl" onClick={e => e.stopPropagation()}>
            <div className="modal-header" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                <h2 className="text-xl font-bold text-white">Edit profile</h2>
                <button className="btn-close" onClick={handleCloseModal}><X size={20} /></button>
              </div>
            </div>
 
            <div className="modal-body" style={{ padding: '24px', textAlign: 'left', maxHeight: '75vh', overflowY: 'auto' }}>
                <div className="flex flex-col gap-8">
                  
                  {/* Photo & Media Section (Now at Top) */}
                  <div className="media-section flex flex-col items-center justify-center p-6 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                    <div className="relative group">
                      <img 
                        src={profile.profilePic || '/avatar_placeholder.png'} 
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
                          <div className="w-14 h-7 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-7 peer-checked:after:border-white after:content-[''] after:absolute after:top-[3px] after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#002b4e]"></div>
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

                  {/* Section C: Messaging Privacy */}
                  <div className="section-c p-5 bg-slate-50 rounded-xl border border-slate-200">
                    <h3 className="text-lg font-bold text-[#002b4e] mb-4 flex items-center gap-2">
                      Messaging Privacy
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                      {/* Option A: Connections Only */}
                      <div 
                        onClick={() => setMessagePrivacy('connections')}
                        className={`cursor-pointer p-4 bg-white rounded-xl border-2 transition-all flex flex-col justify-between ${
                          messagePrivacy === 'connections' 
                            ? 'border-[#002b4e] ring-2 ring-[#002b4e]/10' 
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-bold text-slate-800 text-sm">Connections Only</span>
                            {messagePrivacy === 'connections' && (
                              <div className="w-5 h-5 rounded-full bg-[#002b4e] flex items-center justify-center text-white">
                                <Check size={12} strokeWidth={3} />
                              </div>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 leading-relaxed">
                            Only users in your MNetwork connections can send you direct messages.
                          </p>
                        </div>
                      </div>

                      {/* Option B: Open Inbox */}
                      <div 
                        onClick={() => setMessagePrivacy('anyone')}
                        className={`cursor-pointer p-4 bg-white rounded-xl border-2 transition-all flex flex-col justify-between ${
                          messagePrivacy === 'anyone' 
                            ? 'border-[#002b4e] ring-2 ring-[#002b4e]/10' 
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-bold text-slate-800 text-sm">Open Inbox</span>
                            {messagePrivacy === 'anyone' && (
                              <div className="w-5 h-5 rounded-full bg-[#002b4e] flex items-center justify-center text-white">
                                <Check size={12} strokeWidth={3} />
                              </div>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 leading-relaxed">
                            Anyone on MarComn can message you. Note: This allows recruiters/employers to easily contact you.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                </div>
            </div>
 
            <div className="modal-footer">
              <button className="btn-secondary" onClick={handleCloseModal}>Cancel</button>
              <button className="btn-primary px-8" onClick={handleSaveModal} disabled={saving}>
                {saving ? 'Saving...' : <><Check size={16} style={{ marginRight: 6 }} /> Save</>}
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
