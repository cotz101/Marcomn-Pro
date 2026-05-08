'use client';

import { useState, useEffect } from 'react';
import { UserPlus, UserCheck, Users, MoreHorizontal, MapPin } from 'lucide-react';
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
          <div className="hiring-status-top">
            <span className={`status-dot ${profile.open_to_work ? 'active' : 'inactive'}`}></span>
            <span className="professional-name">{profile.full_name}</span>
          </div>

          <p className="professional-rank">{profile.position || 'Maritime Professional'}</p>
          
          <div className="professional-location">
            <MapPin size={11} />
            <span>{profile.location || 'Global Operations'}</span>
          </div>

          {profile.is_sailing && profile.vessel_name && (
            <div className="vessel-status">
              <span>{profile.vessel_name}</span>
            </div>
          )}

          {profile.bio && (
            <p className="professional-bio">{profile.bio.substring(0, 120)}</p>
          )}

          {profile.skills && profile.skills.length > 0 && (
            <div className="professional-skills">
              {profile.skills.slice(0, 3).map((skill, idx) => (
                <span key={idx} className="skill-pill">{skill}</span>
              ))}
            </div>
          )}

          <div className="professional-actions">
            <button 
              className={`btn-follow-passport ${isFollowing ? 'following' : ''}`}
              onClick={handleFollowClick}
            >
              {isFollowing ? (
                <>
                  <UserCheck size={14} />
                  <span>Following</span>
                </>
              ) : (
                <>
                  <UserPlus size={14} />
                  <span>Follow</span>
                </>
              )}
            </button>
            <button 
              className="btn-text-passport"
              onClick={() => setShowDetails(true)}
            >
              View Profile
            </button>
          </div>
        </div>
      </div>

      {showDetails && (
        <ProfileDetailModal 
          isOpen={showDetails}
          onClose={() => setShowDetails(false)}
          profile={profile}
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
