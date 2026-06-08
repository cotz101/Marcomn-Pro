'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Users, UserMinus, Loader2, MapPin } from 'lucide-react';
import { getFriendsList, removeFriend } from '@/app/actions/friendships';
import BaseModal from '../layout/BaseModal';

export default function FriendsGrid() {
  const router = useRouter();
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirmRemove, setConfirmRemove] = useState(null);
  const [removingId, setRemovingId] = useState(null);

  useEffect(() => {
    async function loadFriends() {
      try {
        const list = await getFriendsList();
        setFriends(list || []);
      } catch (err) {
        console.error('Error loading friends:', err);
      } finally {
        setLoading(false);
      }
    }
    loadFriends();
  }, []);

  const handleRemoveClick = (friend) => {
    setConfirmRemove(friend);
  };

  const confirmRemoveFriend = async () => {
    if (!confirmRemove) return;
    setRemovingId(confirmRemove.friendshipId);
    try {
      await removeFriend(confirmRemove.friendshipId);
      setFriends(prev => prev.filter(f => f.friendshipId !== confirmRemove.friendshipId));
    } catch (err) {
      console.error('Error removing friend:', err);
      alert('Failed to remove friend');
    } finally {
      setRemovingId(null);
      setConfirmRemove(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="animate-spin text-[#002b4e]" size={32} />
      </div>
    );
  }

  if (friends.length === 0) {
    return (
      <div className="card p-16 text-center text-gray-500 mt-8 border-dashed border-2 border-slate-100 bg-slate-50/50">
        <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm">
          <Users size={32} className="text-slate-300" />
        </div>
        <h3 className="text-xl font-bold text-slate-800 mb-2">No Friends Yet</h3>
        <p className="max-w-xs mx-auto text-slate-500">
          Build your network by sending friend requests to maritime professionals.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="discovery-grid gap-1.5 md:gap-4 pb-32">
        {friends.map((item) => (
          <div key={item.friendshipId} className="professional-card card w-full">
            <div className="card-avatar-wrapper relative">
              <img 
                src={item.profile.avatar_url || '/avatar_placeholder.png'} 
                alt={item.profile.name} 
                className="professional-avatar"
              />
            </div>
            <div className="professional-info-container text-center pt-2">
              <h3 className="professional-name text-lg font-bold text-[#002b4e] mb-1">{item.profile.name}</h3>
              <p className="professional-rank text-sm font-medium text-[#004173] mb-3">{item.profile.currentRole || 'Maritime Professional'}</p>
              
              <div className="professional-location flex items-center justify-center gap-1.5 text-slate-500 mb-6">
                <MapPin size={14} className="text-slate-400" />
                <span className="text-xs font-medium tracking-wide">{item.profile.location || 'Global Operations'}</span>
              </div>

              <div className="flex items-center justify-center gap-6 pt-4 border-t border-slate-50">
                <button 
                  className="flex flex-col items-center gap-1.5 text-red-500 font-bold text-[11px] uppercase tracking-tighter hover:opacity-80 transition-all hover:scale-105"
                  onClick={() => handleRemoveClick(item)}
                >
                  <div className="w-12 h-12 rounded-full bg-white border border-slate-100 flex items-center justify-center text-red-500 shadow-sm">
                    {removingId === item.friendshipId ? <Loader2 className="animate-spin" size={23} /> : <UserMinus size={23} />}
                  </div>
                  <span>Remove</span>
                </button>

                <button 
                  className="flex flex-col items-center gap-1.5 text-[#004173] font-bold text-[11px] uppercase tracking-tighter hover:opacity-80 transition-all hover:scale-105"
                  onClick={() => router.push(`/profile/${item.profile.id}`)}
                >
                  <div className="w-12 h-12 rounded-full bg-white border border-slate-100 flex items-center justify-center text-[#004173] shadow-sm">
                    <Users size={23} />
                  </div>
                  <span>View Profile</span>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {confirmRemove && (
        <BaseModal 
          isOpen={!!confirmRemove} 
          onClose={() => setConfirmRemove(null)}
          title="Remove Friend"
        >
          <div className="p-4 text-center">
            <p className="mb-6 text-gray-600">
              Are you sure you want to remove <strong>{confirmRemove.profile.name}</strong> from your friends list?
            </p>
            <div className="flex gap-3">
              <button 
                className="btn-secondary flex-1" 
                onClick={() => setConfirmRemove(null)}
                disabled={removingId !== null}
              >
                Cancel
              </button>
              <button 
                className="btn-primary flex-1" 
                style={{ backgroundColor: '#e11d48' }}
                onClick={confirmRemoveFriend}
                disabled={removingId !== null}
              >
                {removingId ? 'Removing...' : 'Remove Friend'}
              </button>
            </div>
          </div>
        </BaseModal>
      )}
    </>
  );
}
