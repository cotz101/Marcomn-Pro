'use client';

import { useState } from 'react';
import { X, Loader2, Shield } from 'lucide-react';

export default function AssignRoleModal({ isOpen, onClose, targetUser, roles, onAssign }) {
  const [selectedRoleId, setSelectedRoleId] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen || !targetUser) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedRoleId) {
      setError('Please select a platform role.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const res = await onAssign(targetUser.id, selectedRoleId, reason);
      if (!res.success) {
        setError(res.error || 'Failed to assign role.');
      } else {
        onClose();
        setSelectedRoleId('');
        setReason('');
      }
    } catch (err) {
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="w-full max-w-md bg-white border border-gray-100 rounded-3xl p-6 shadow-2xl flex flex-col space-y-5 animate-in fade-in zoom-in duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-50 text-blue-900 rounded-xl">
              <Shield size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">Assign Platform Role</h2>
              <p className="text-xs text-gray-400 font-medium">Grant admin rights to user</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-xl transition-colors cursor-pointer border-none outline-none bg-transparent"
          >
            <X size={18} />
          </button>
        </div>

        {/* User Card */}
        <div className="p-3 bg-slate-50 border border-gray-100 rounded-2xl flex items-center gap-3">
          {targetUser.avatar_url ? (
            <img 
              src={targetUser.avatar_url} 
              alt="" 
              className="w-10 h-10 rounded-full border border-gray-200 object-cover" 
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-blue-100 border border-blue-200 flex items-center justify-center text-xs font-bold text-blue-600">
              {targetUser.name?.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-[#0e2a4d] truncate">{targetUser.name}</p>
            <p className="text-xs text-gray-400 truncate">{targetUser.email}</p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col space-y-4">
          
          {error && (
            <div className="p-3 bg-red-50 border border-red-100 text-red-600 text-xs font-bold rounded-xl">
              {error}
            </div>
          )}

          <div className="flex flex-col space-y-1.5">
            <label className="text-xs font-bold text-gray-500">Select Platform Role</label>
            <select
              value={selectedRoleId}
              onChange={(e) => setSelectedRoleId(e.target.value)}
              className="w-full bg-white border border-gray-200 text-sm rounded-xl py-3 px-4 outline-none focus:border-blue-900 transition-all font-medium cursor-pointer"
            >
              <option value="">-- Choose Role --</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.role_name} ({r.role_key})
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col space-y-1.5">
            <label className="text-xs font-bold text-gray-500">Assignment Notes / Reason</label>
            <textarea
              placeholder="Provide a reason for assigning this role..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              required
              className="w-full bg-white border border-gray-200 text-sm rounded-xl py-3 px-4 outline-none focus:border-blue-900 transition-all font-medium resize-none"
            />
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 border border-gray-200 hover:bg-slate-50 text-gray-600 text-xs font-bold py-3 rounded-xl transition-all cursor-pointer select-none border-solid text-center"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-[#002b4e] hover:bg-[#001c33] disabled:opacity-50 text-white text-xs font-bold py-3 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 select-none"
            >
              {loading ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Assigning...
                </>
              ) : (
                'Assign Role'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
