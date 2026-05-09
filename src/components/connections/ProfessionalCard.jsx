'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { UserPlus, UserCheck, Users, MapPin, MessageSquare } from 'lucide-react';
import { createClient } from '@/lib/supabase';
import BaseModal from '../layout/BaseModal';
import ProfileDetailModal from '../profile/ProfileDetailModal';

export default function ProfessionalCard({ profile, onFollow }) {
  const router = useRouter();
  const [isFollowing, setIsFollowing] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const isOnline = profile.isOnline ?? (profile.id.charCodeAt(0) % 2 === 0); // Mock logic for demo
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
      <div className="professional-card card w-full">
        <div className="card-avatar-wrapper relative">
          <img 
            src={profile.avatar_url || '/profile_pic.png'} 
            alt={profile.name} 
            className="professional-avatar"
          />
          <div 
            className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-white shadow-sm ${isOnline ? 'bg-green-500' : 'bg-gray-400'}`}
            title={isOnline ? 'Online' : 'Offline'}
          ></div>
        </div>

        <div className="professional-info-container text-center pt-2">
          <h3 className="professional-name text-lg font-bold text-[#002b4e] mb-1">{profile.name}</h3>
          <p className="professional-rank text-sm font-medium text-[#004173] mb-3">{profile.currentRole || 'Maritime Professional'}</p>
          
          <div className="professional-location flex items-center justify-center gap-1.5 text-slate-500 mb-6">
            <MapPin size={14} className="text-slate-400" />
            <span className="text-xs font-medium tracking-wide">{profile.location || 'Global Operations'}</span>
          </div>

          <div className="flex items-center justify-center gap-6 pt-4 border-t border-slate-50">
            {currentUser?.id !== profile.id && (
              <>
                <button 
                  className={`flex flex-col items-center gap-1.5 font-bold text-[11px] uppercase tracking-tighter transition-all hover:scale-105 ${isFollowing ? 'text-white' : 'text-[#004173]'}`}
                  onClick={handleFollowClick}
                >
                  <div className={`w-11 h-11 rounded-full border border-slate-100 flex items-center justify-center shadow-sm ${isFollowing ? 'bg-[#002b4e] text-white border-[#002b4e]' : 'bg-white text-[#004173]'}`}>
                    {isFollowing ? <UserCheck size={20} /> : <UserPlus size={20} />}
                  </div>
                  <span className={isFollowing ? 'text-[#002b4e]' : 'text-[#004173]'}>{isFollowing ? 'Following' : 'Follow'}</span>
                </button>
                
                <button className="flex flex-col items-center gap-1.5 text-[#004173] font-bold text-[11px] uppercase tracking-tighter hover:opacity-80 transition-all hover:scale-105">
                  <div className="w-11 h-11 rounded-full bg-white border border-slate-100 flex items-center justify-center text-[#004173] shadow-sm">
                    <MessageSquare size={20} />
                  </div>
                  <span>Message</span>
                </button>
              </>
            )}

            <button 
              className="flex flex-col items-center gap-1.5 text-[#004173] font-bold text-[11px] uppercase tracking-tighter hover:opacity-80 transition-all hover:scale-105"
              onClick={() => router.push(`/profile/${profile.id}`)}
            >
              <div className="w-11 h-11 rounded-full bg-white border border-slate-100 flex items-center justify-center text-[#004173] shadow-sm">
                <Users size={20} />
              </div>
              <span>View ID</span>
            </button>
          </div>
        </div>
      </div>


      {showConfirm && (
        <BaseModal 
          isOpen={showConfirm} 
          onClose={() => setShowConfirm(false)}
          title="Unfollow?"
        >
          <div className="p-4 text-center">
            <p className="mb-6 text-gray-600">
              Are you sure you want to stop following <strong>{profile.name}</strong>?
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
