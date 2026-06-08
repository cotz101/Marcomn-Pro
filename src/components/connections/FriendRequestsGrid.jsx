'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Check, X, Loader2, UserPlus, MapPin } from 'lucide-react';
import { getFriendRequests, acceptFriendRequest, rejectFriendRequest, cancelFriendRequest } from '@/app/actions/friendships';

export default function FriendRequestsGrid() {
  const router = useRouter();
  const [requests, setRequests] = useState({ incoming: [], outgoing: [] });
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  const [activeTab, setActiveTab] = useState('incoming');

  useEffect(() => {
    loadRequests();
  }, []);

  async function loadRequests() {
    try {
      const data = await getFriendRequests();
      setRequests(data);
    } catch (err) {
      console.error('Error loading friend requests:', err);
    } finally {
      setLoading(false);
    }
  }

  const handleAccept = async (requestId) => {
    setProcessingId(requestId);
    try {
      await acceptFriendRequest(requestId);
      setRequests(prev => ({
        ...prev,
        incoming: prev.incoming.filter(r => r.requestId !== requestId)
      }));
    } catch (err) {
      console.error('Error accepting:', err);
      alert('Failed to accept request');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (requestId) => {
    setProcessingId(requestId);
    try {
      await rejectFriendRequest(requestId);
      setRequests(prev => ({
        ...prev,
        incoming: prev.incoming.filter(r => r.requestId !== requestId)
      }));
    } catch (err) {
      console.error('Error rejecting:', err);
      alert('Failed to reject request');
    } finally {
      setProcessingId(null);
    }
  };

  const handleCancel = async (requestId) => {
    setProcessingId(requestId);
    try {
      await cancelFriendRequest(requestId);
      setRequests(prev => ({
        ...prev,
        outgoing: prev.outgoing.filter(r => r.requestId !== requestId)
      }));
    } catch (err) {
      console.error('Error cancelling:', err);
      alert('Failed to cancel request');
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="animate-spin text-[#002b4e]" size={32} />
      </div>
    );
  }

  const currentList = activeTab === 'incoming' ? requests.incoming : requests.outgoing;

  return (
    <div className="w-full pb-32">
      <div className="flex justify-center gap-4 mb-8">
        <button
          className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
            activeTab === 'incoming' 
            ? 'bg-[#002b4e] text-white shadow-sm' 
            : 'bg-white text-slate-500 hover:bg-slate-50 border border-slate-200'
          }`}
          onClick={() => setActiveTab('incoming')}
        >
          Incoming ({requests.incoming.length})
        </button>
        <button
          className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
            activeTab === 'outgoing' 
            ? 'bg-[#002b4e] text-white shadow-sm' 
            : 'bg-white text-slate-500 hover:bg-slate-50 border border-slate-200'
          }`}
          onClick={() => setActiveTab('outgoing')}
        >
          Sent ({requests.outgoing.length})
        </button>
      </div>

      {currentList.length === 0 ? (
        <div className="card p-16 text-center text-gray-500 border-dashed border-2 border-slate-100 bg-slate-50/50">
          <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm">
            <UserPlus size={32} className="text-slate-300" />
          </div>
          <h3 className="text-xl font-bold text-slate-800 mb-2">
            No {activeTab === 'incoming' ? 'Incoming' : 'Sent'} Requests
          </h3>
          <p className="max-w-xs mx-auto text-slate-500">
            {activeTab === 'incoming' 
              ? 'You do not have any pending friend requests at the moment.' 
              : 'You have not sent any pending friend requests.'}
          </p>
        </div>
      ) : (
        <div className="discovery-grid gap-1.5 md:gap-4">
          {currentList.map((item) => (
            <div key={item.requestId} className="professional-card card w-full relative">
              {processingId === item.requestId && (
                <div className="absolute inset-0 bg-white/70 backdrop-blur-sm z-10 flex items-center justify-center rounded-2xl">
                  <Loader2 className="animate-spin text-[#002b4e]" size={32} />
                </div>
              )}
              <div className="card-avatar-wrapper relative">
                <img 
                  src={item.profile.avatar_url || '/avatar_placeholder.png'} 
                  alt={item.profile.name} 
                  className="professional-avatar cursor-pointer"
                  onClick={() => router.push(`/profile/${item.profile.id}`)}
                />
              </div>
              <div className="professional-info-container text-center pt-2">
                <h3 
                  className="professional-name text-lg font-bold text-[#002b4e] mb-1 cursor-pointer hover:underline"
                  onClick={() => router.push(`/profile/${item.profile.id}`)}
                >
                  {item.profile.name}
                </h3>
                <p className="professional-rank text-sm font-medium text-[#004173] mb-3">
                  {item.profile.currentRole || 'Maritime Professional'}
                </p>
                <div className="professional-location flex items-center justify-center gap-1.5 text-slate-500 mb-6">
                  <MapPin size={14} className="text-slate-400" />
                  <span className="text-xs font-medium tracking-wide">{item.profile.location || 'Global Operations'}</span>
                </div>

                <div className="flex items-center justify-center gap-6 pt-4 border-t border-slate-50">
                  {activeTab === 'incoming' ? (
                    <>
                      <button 
                        className="flex flex-col items-center gap-1.5 text-slate-400 font-bold text-[11px] uppercase tracking-tighter hover:text-red-500 transition-all hover:scale-105"
                        onClick={() => handleReject(item.requestId)}
                      >
                        <div className="w-12 h-12 rounded-full bg-white border border-slate-100 flex items-center justify-center shadow-sm">
                          <X size={23} />
                        </div>
                        <span>Reject</span>
                      </button>
                      <button 
                        className="flex flex-col items-center gap-1.5 text-emerald-600 font-bold text-[11px] uppercase tracking-tighter hover:opacity-80 transition-all hover:scale-105"
                        onClick={() => handleAccept(item.requestId)}
                      >
                        <div className="w-12 h-12 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shadow-sm">
                          <Check size={23} />
                        </div>
                        <span>Accept</span>
                      </button>
                    </>
                  ) : (
                    <button 
                      className="flex flex-col items-center gap-1.5 text-slate-500 font-bold text-[11px] uppercase tracking-tighter hover:text-orange-500 transition-all hover:scale-105"
                      onClick={() => handleCancel(item.requestId)}
                    >
                      <div className="w-12 h-12 rounded-full bg-white border border-slate-100 flex items-center justify-center shadow-sm">
                        <X size={23} />
                      </div>
                      <span>Cancel Request</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
