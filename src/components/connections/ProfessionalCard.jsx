'use client';

import { useState, useEffect } from 'react';
import { UserPlus, UserCheck, Users, MoreHorizontal, MapPin } from 'lucide-react';
import { createClient } from '@/lib/supabase';
import BaseModal from '../layout/BaseModal';

export default function ProfessionalCard({ profile, onFollow }) {
  const [isFollowing, setIsFollowing] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
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
    <div className="professional-card card">
      {/* Avatar Zone (Left) */}
      <div className="card-avatar-wrapper">
        <img 
          src={profile.avatar_url || '/profile_pic.png'} 
          alt={profile.full_name} 
          className="professional-avatar"
        />
      </div>

      {/* Info Zone (Right) */}
      <div className="professional-info-container">
        <div className="hiring-status">
          <span className={`status-dot ${profile.open_to_work ? 'active' : 'inactive'}`}></span>
          <span className={profile.open_to_work ? 'text-green-600 font-bold' : 'text-slate-400'}>
            {profile.open_to_work ? 'Hiring Now' : 'Passive'}
          </span>
        </div>

        <h3 className="professional-name">{profile.full_name}</h3>
        <p className="professional-rank">{profile.position || 'Maritime Professional'}</p>
        
        <div className="professional-location">
          <MapPin size={12} className="text-slate-400" />
          <span>{profile.location || 'Global Operations'}</span>
        </div>

        <div className="professional-actions pt-2">
          <button className="btn-primary-passport">
            Message
          </button>
          <button className="btn-secondary-passport">
            View Profile
          </button>
        </div>
      </div>
    </div>

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
    </div>
  );
}
