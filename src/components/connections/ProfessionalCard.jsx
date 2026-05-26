'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { UserPlus, UserCheck, Users, MapPin, MessageSquare } from 'lucide-react';
import { createClient } from '@/lib/supabase';
import BaseModal from '../layout/BaseModal';
import ProfileDetailModal from '../profile/ProfileDetailModal';

export default function ProfessionalCard({ profile, currentUser, onFollow }) {
  const router = useRouter();
  const [isFollowing, setIsFollowing] = useState(false);
  const [isFollowedBack, setIsFollowedBack] = useState(false);
  const [messagePrivacy, setMessagePrivacy] = useState('connections');
  const [showConfirm, setShowConfirm] = useState(false);
  const isOnline = profile.isOnline ?? (profile.id.charCodeAt(0) % 2 === 0); // Mock logic for demo
  const supabase = createClient();

  useEffect(() => {
    async function checkFollowStatus() {
      if (!currentUser) return;

      // Don't show follow button for self
      if (currentUser.id === profile.id) return;

      const { data: followData } = await supabase
        .from('follows')
        .select('*')
        .eq('follower_id', currentUser.id)
        .eq('following_id', profile.id)
        .maybeSingle();
      
      if (followData) setIsFollowing(true);

      const { data: followBackData } = await supabase
        .from('follows')
        .select('*')
        .eq('follower_id', profile.id)
        .eq('following_id', currentUser.id)
        .maybeSingle();
      
      if (followBackData) setIsFollowedBack(true);

      const { data: profileData } = await supabase
        .from('profiles')
        .select('message_privacy')
        .eq('id', profile.id)
        .maybeSingle();

      if (profileData) setMessagePrivacy(profileData.message_privacy || 'connections');
    }

    checkFollowStatus();
  }, [profile.id, currentUser]);

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
      } else {
        if (onFollow) {
          onFollow(profile.id, true);
        }
        
        // Connection Notification Bridge
        try {
          // Guard against Duplicate Notifs
          const { count } = await supabase.from('notifications')
            .select('*', { count: 'exact', head: true })
            .eq('recipient_id', profile.id)
            .eq('sender_id', currentUser.id)
            .eq('type', 'connection');

          if (count === 0) {
            await supabase.from('notifications').insert([{
              recipient_id: profile.id,
              sender_id: currentUser.id,
              type: 'connection',
              title: 'New Connection',
              body: 'Started following you',
              link: '/profile/' + currentUser.id,
              is_read: false
            }]);
          }
        } catch (err) {
          console.error('Failed to send connection notification:', err);
        }
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

  const handleMessageClick = async () => {
    if (!currentUser || !profile.id) return;
    
    // Privacy check: respect profile privacy configuration (connections or anyone)
    const areConnected = isFollowing && isFollowedBack;
    const canMessage = currentUser.id === profile.id || messagePrivacy === 'anyone' || areConnected;

    if (!canMessage) {
      alert('This user has restricted their inbox to connections only.');
      return;
    }

    try {
      // Query both combinations of direct conversations
      const { data: conv1 } = await supabase
        .from('conversations')
        .select('id')
        .eq('participant_one', currentUser.id)
        .eq('participant_two', profile.id)
        .maybeSingle();

      if (conv1) {
        router.push(`/messages?chat=${conv1.id}`);
        return;
      }

      const { data: conv2 } = await supabase
        .from('conversations')
        .select('id')
        .eq('participant_one', profile.id)
        .eq('participant_two', currentUser.id)
        .maybeSingle();

      if (conv2) {
        router.push(`/messages?chat=${conv2.id}`);
        return;
      }

      // If it does not exist, insert a new conversation
      const { data: newConv, error: insertError } = await supabase
        .from('conversations')
        .insert({
          participant_one: currentUser.id,
          participant_two: profile.id
        })
        .select('id')
        .maybeSingle();

      if (insertError) {
        console.error('Error creating conversation:', insertError);
        alert('Error starting conversation: ' + insertError.message);
        return;
      }

      router.push(`/messages?chat=${newConv.id}`);
    } catch (err) {
      console.error('Error handling message click:', err);
      alert('Failed to start chat');
    }
  };

  return (
    <>
      <div className="professional-card card w-full">
        <div className="card-avatar-wrapper relative">
          <img 
            src={profile.avatar_url || '/avatar_placeholder.png'} 
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
                  <div className={`w-12 h-12 rounded-full border border-slate-100 flex items-center justify-center shadow-sm ${isFollowing ? 'bg-[#002b4e] text-white border-[#002b4e]' : 'bg-white text-[#004173]'}`}>
                    {isFollowing ? <UserCheck size={23} /> : <UserPlus size={23} />}
                  </div>
                  <span className={isFollowing ? 'text-[#002b4e]' : 'text-[#004173]'}>{isFollowing ? 'Following' : 'Follow'}</span>
                </button>
                
                <button 
                  onClick={handleMessageClick}
                  className="flex flex-col items-center gap-1.5 text-[#004173] font-bold text-[11px] uppercase tracking-tighter hover:opacity-80 transition-all hover:scale-105"
                >
                  <div className="w-12 h-12 rounded-full bg-white border border-slate-100 flex items-center justify-center text-[#004173] shadow-sm">
                    <MessageSquare size={23} />
                  </div>
                  <span>Message</span>
                </button>
              </>
            )}

            <button 
              className="flex flex-col items-center gap-1.5 text-[#004173] font-bold text-[11px] uppercase tracking-tighter hover:opacity-80 transition-all hover:scale-105"
              onClick={() => router.push(`/profile/${profile.id}`)}
            >
              <div className="w-12 h-12 rounded-full bg-white border border-slate-100 flex items-center justify-center text-[#004173] shadow-sm">
                <Users size={23} />
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
