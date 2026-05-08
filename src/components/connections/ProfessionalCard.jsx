'use client';

import { useState, useEffect } from 'react';
import { UserPlus, UserCheck, Users, MoreHorizontal, MapPin, Anchor, Shield, Compass, Users2, Ship, ChevronRight, MessageSquare } from 'lucide-react';
import { createClient } from '@/lib/supabase';
import BaseModal from '../layout/BaseModal';
import ProfileDetailModal from '../profile/ProfileDetailModal';

export default function ProfessionalCard({ profile, onFollow }) {
  const [isFollowing, setIsFollowing] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const supabase = createClient();

  useEffect(() => {
    async function checkFollowStatus() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setCurrentUser(user);

      // Don't show follow button for self
      if (user.id === profile.id) return;

      const { data, error } = await supabase
        .from('follows')
        .select('*')
        .eq('follower_id', user.id)
        .eq('following_id', profile.id)
        .single();
      
      if (data) setIsFollowing(true);
    }

    checkFollowStatus();
  }, [profile.id]);

  const handleFollowClick = async () => {
    if (!currentUser) return;

    if (isFollowing) {
      setShowConfirm(true);
    } else {
      // Optimistic update
      setIsFollowing(true);
      
      const { error } = await supabase
        .from('follows')
        .insert({
          follower_id: currentUser.id,
          following_id: profile.id
        });

      if (error) {
        setIsFollowing(false);
        console.error('Error following:', error);
      } else if (onFollow) {
        onFollow(profile.id, true);
      }
    }
  };

  const confirmUnfollow = async () => {
    if (!currentUser) return;

    // Optimistic update
    setIsFollowing(false);
    setShowConfirm(false);

    const { error } = await supabase
      .from('follows')
      .delete()
      .eq('follower_id', currentUser.id)
      .eq('following_id', profile.id);

    if (error) {
      setIsFollowing(true);
      console.error('Error unfollowing:', error);
    } else if (onFollow) {
      onFollow(profile.id, false);
    }
  };

  return (
    <>
      <div className="professional-card card">
        <div className="card-avatar-wrapper">
          <img 
            src={profile.avatar_url || '/profile_pic.png'} 
            alt={profile.full_name} 
            className="professional-avatar"
          />
        </div>

        <div className="professional-info-container">
          {profile.is_sailing && (
            <div className="engagement-banner mb-4">
              <span className="engagement-tag">NOT SEEKING</span>
              <span className="engagement-vessel">Engaged: {profile.vessel_name || 'Active Vessel'}</span>
            </div>
          )}

          <div className="hiring-status-top">
            <span className={`status-dot ${profile.open_to_work ? 'active' : 'inactive'}`}></span>
            <span className="professional-name">{profile.full_name}</span>
          </div>

          <p className="professional-rank">{profile.headline || profile.current_position || 'Maritime Professional'}</p>
          
          <div className="professional-location">
            <MapPin size={11} />
            <span>{profile.location || 'Global Operations'}</span>
          </div>

          {!profile.is_sailing && profile.open_to_work && (
            <div className="hiring-status-badge mb-3">
              <span className={`status-dot active`}></span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Available for Deployment
              </span>
            </div>
          )}

          {profile.bio && (
            <p className="professional-bio">{profile.bio.substring(0, 120)}</p>
          )}

          <div className="w-full h-[1px] bg-slate-100 mb-4"></div>

          {profile.skills && (Array.isArray(profile.skills) ? profile.skills.length > 0 : typeof profile.skills === 'string' && profile.skills.length > 0) && (
            <div className="flex flex-wrap gap-2 mb-4 justify-center px-2">
              {(Array.isArray(profile.skills) ? profile.skills : profile.skills.split(',')).slice(0, 5).map((skill, i) => (
                <span key={i} className="skill-pill">
                  {typeof skill === 'string' ? skill.trim() : skill}
                </span>
              ))}
            </div>
          )}

            <div className="flex items-center justify-center gap-6 mt-2">
              {currentUser?.id !== profile.id && (
                <button 
                  className="flex flex-col items-center gap-1 text-[#004173] font-bold text-[10px] uppercase tracking-tighter hover:opacity-80 transition-opacity"
                  onClick={handleFollowClick}
                >
                  <div className="w-10 h-10 rounded-full bg-[#f8fafc] border border-slate-100 flex items-center justify-center text-[#004173] shadow-sm">
                    {isFollowing ? <UserCheck size={18} /> : <UserPlus size={18} />}
                  </div>
                  <span>{isFollowing ? 'Following' : 'Follow'}</span>
                </button>
              )}
              {currentUser?.id !== profile.id && (
                <button className="flex flex-col items-center gap-1 text-[#004173] font-bold text-[10px] uppercase tracking-tighter hover:opacity-80 transition-opacity">
                  <div className="w-10 h-10 rounded-full bg-[#f8fafc] border border-slate-100 flex items-center justify-center text-[#004173] shadow-sm">
                    <MessageSquare size={18} />
                  </div>
                  <span>Message</span>
                </button>
              )}
              <button 
                className="flex flex-col items-center gap-1 text-[#004173] font-bold text-[10px] uppercase tracking-tighter hover:opacity-80 transition-opacity"
                onClick={() => setShowDetails(true)}
              >
                <div className="w-10 h-10 rounded-full bg-[#f8fafc] border border-slate-100 flex items-center justify-center text-[#004173] shadow-sm">
                  <Users size={18} />
                </div>
                <span>View ID</span>
              </button>
            </div>
        </div>
      </div>

      {showDetails && (
        <ProfileDetailModal 
          isOpen={showDetails}
          onClose={() => setShowDetails(false)}
          profile={profile}
          isSelf={currentUser?.id === profile.id}
        />
      )}

      {showConfirm && (
        <BaseModal 
          isOpen={showConfirm} 
          onClose={() => setShowConfirm(false)}
          title="Unfollow?"
        >
          <div className="p-4 text-center">
            <p className="mb-6 text-gray-600">
              Are you sure you want to stop following <strong>{profile.full_name}</strong>?
            </p>
            <div className="flex gap-3">
              <button 
                className="btn-secondary flex-1" 
                onClick={() => setShowConfirm(false)}
              >
                Cancel
              </button>
              <button 
                className="btn-primary flex-1" 
                style={{ backgroundColor: '#e11d48' }}
                onClick={confirmUnfollow}
              >
                Unfollow
              </button>
            </div>
          </div>
        </BaseModal>
      )}
    </>
  );
}
