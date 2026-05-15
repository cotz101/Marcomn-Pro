'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase';
import { User, Check, X } from 'lucide-react';

export default function PendingRequests({ groupId }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('group_members')
        .select('*')
        .match({ group_id: groupId, status: 'pending' });

      if (error) {
        alert('Fetch error: ' + error.message);
        console.error('PendingRequests: Error fetching:', error.message);
        throw error;
      }
      setRequests(data || []);
    } catch (err) {
      console.error('PendingRequests: Catch block error:', err.message || JSON.stringify(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (groupId) {
      fetchRequests();
    }
  }, [groupId]);

  const handleApprove = async (userId) => {
    try {
      const { error } = await supabase
        .from('group_members')
        .update({ status: 'member' })
        .eq('group_id', groupId)
        .eq('user_id', userId);

      if (error) throw error;
      
      alert('User approved!');
      // Revalidate: Re-fetch requests from backend
      fetchRequests();
    } catch (err) {
      console.error('Error approving user:', err.message);
      alert('Failed to approve user: ' + err.message);
    }
  };

  const handleDecline = async (userId) => {
    try {
      const { error } = await supabase
        .from('group_members')
        .delete()
        .eq('group_id', groupId)
        .eq('user_id', userId);

      if (error) throw error;
      
      alert('Request declined.');
      // Revalidate: Re-fetch requests from backend
      fetchRequests();
    } catch (err) {
      console.error('Error declining request:', err.message);
      alert('Failed to decline request: ' + err.message);
    }
  };

  if (loading) return <div className="p-4 text-center text-sm text-gray-500 font-medium bg-slate-50 rounded-xl mb-6 border border-slate-100">Loading requests...</div>;
  
  if (requests.length === 0) {
    return (
      <div className="p-4 text-center text-sm text-slate-500 font-medium bg-slate-50 rounded-xl mb-6 border border-slate-100 border-dashed">
        No pending requests.
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-6">
      <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
        <h3 className="text-sm font-bold text-[#002b4e]">Pending Join Requests ({requests.length})</h3>
      </div>
      <div className="divide-y divide-gray-100">
        {requests.map((request) => (
          <div key={request.user_id} className="p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center overflow-hidden border border-gray-100">
                <User size={20} className="text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900">ID: {request.user_id.substring(0, 8)}...</p>
                <p className="text-xs text-gray-500">Requested access</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => handleApprove(request.user_id)}
                className="p-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors shadow-sm"
                title="Approve"
              >
                <Check size={18} />
              </button>
              <button 
                onClick={() => handleDecline(request.user_id)}
                className="p-2 bg-white text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors shadow-sm"
                title="Decline"
              >
                <X size={18} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
