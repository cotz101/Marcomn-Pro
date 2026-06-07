'use client';

import { useState, useEffect, useCallback } from 'react';
import { Search, ShieldAlert, ShieldCheck, UserPlus, Trash2, Loader2, Info } from 'lucide-react';
import { searchSystemUsers, assignPlatformRole, revokePlatformRole } from '@/app/actions/adminUserActions';
import AssignRoleModal from './AssignRoleModal';

export default function UserRoleAssignment({ roles, userRoles, onRefresh, callerUserId }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [feedback, setFeedback] = useState(null);

  // Search profiles callback
  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    const delayDebounce = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await searchSystemUsers(searchQuery);
        if (res.success) {
          // Filter out users who are already active admins to keep search tidy (optional)
          setSearchResults(res.users);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setSearchLoading(false);
      }
    }, 350);

    return () => clearTimeout(delayDebounce);
  }, [searchQuery]);

  const showFeedback = (message, type = 'success') => {
    setFeedback({ message, type });
    setTimeout(() => setFeedback(null), 4000);
  };

  const handleSelectUser = (user) => {
    setSelectedUser(user);
    setSearchQuery('');
    setSearchResults([]);
    setIsModalOpen(true);
  };

  const handleAssignRole = async (targetUserId, roleId, reason) => {
    try {
      const res = await assignPlatformRole(targetUserId, roleId, reason);
      if (res.success) {
        showFeedback('Role successfully assigned.');
        onRefresh();
        return { success: true };
      }
      return { success: false, error: res.error };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  const handleRevokeRole = async (userRoleId) => {
    if (!confirm('Are you sure you want to revoke this platform role? This user will lose related admin privileges immediately.')) {
      return;
    }

    setActionLoadingId(userRoleId);
    try {
      const res = await revokePlatformRole(userRoleId);
      if (res.success) {
        showFeedback('Role successfully revoked.');
        onRefresh();
      } else {
        showFeedback(res.error || 'Failed to revoke role.', 'error');
      }
    } catch (err) {
      showFeedback(err.message || 'An unexpected error occurred.', 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div className="flex flex-col space-y-6">
      {/* Top action: Search & promote user */}
      <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm flex flex-col space-y-4">
        <div>
          <h3 className="text-sm font-bold text-[#0e2a4d] flex items-center gap-2">
            <UserPlus size={16} /> Promote User to Platform Admin
          </h3>
          <p className="text-xs text-gray-400 font-medium mt-0.5">
            Search users by name or email to assign them administrative roles.
          </p>
        </div>

        {/* Search bar */}
        <div className="relative w-full max-w-lg">
          <div className="flex items-center gap-2 bg-slate-50 border border-gray-200 rounded-xl px-3 py-2.5">
            <Search size={16} className="text-gray-400" />
            <input
              type="text"
              placeholder="Search user name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent outline-none border-none text-sm font-medium placeholder-gray-400"
            />
            {searchLoading && <Loader2 size={16} className="animate-spin text-gray-400" />}
          </div>

          {/* Search suggestions dropdown */}
          {searchResults.length > 0 && (
            <div className="absolute left-0 right-0 mt-2 bg-white border border-gray-100 rounded-xl shadow-xl z-10 max-h-60 overflow-y-auto divide-y divide-gray-50">
              {searchResults.map((user) => (
                <button
                  key={user.id}
                  onClick={() => handleSelectUser(user)}
                  className="w-full text-left px-4 py-3 hover:bg-slate-50 flex items-center gap-3 transition-colors border-none bg-transparent outline-none cursor-pointer"
                >
                  {user.avatar_url ? (
                    <img 
                      src={user.avatar_url} 
                      alt="" 
                      className="w-8 h-8 rounded-full border border-gray-200 object-cover" 
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center text-[10px] font-bold text-blue-600">
                      {user.name?.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-[#0e2a4d] truncate">{user.name}</p>
                    <p className="text-[10px] text-gray-400 truncate">{user.email}</p>
                  </div>
                  <span className="text-[10px] font-bold text-blue-600 bg-blue-50/50 px-2 py-1 rounded-md">
                    Select
                  </span>
                </button>
              ))}
            </div>
          )}

          {searchQuery.trim().length >= 2 && searchResults.length === 0 && !searchLoading && (
            <div className="absolute left-0 right-0 mt-2 bg-white border border-gray-100 rounded-xl shadow-xl p-4 text-center text-xs text-gray-400 font-medium z-10">
              No users found matching your search.
            </div>
          )}
        </div>
      </div>

      {/* Global alert feedback */}
      {feedback && (
        <div className={`p-4 rounded-xl border text-xs font-bold flex items-center gap-2 animate-in fade-in duration-200 ${
          feedback.type === 'success' 
            ? 'bg-emerald-50 border-emerald-100 text-emerald-700' 
            : 'bg-red-50 border-red-100 text-red-700'
        }`}>
          {feedback.type === 'success' ? <ShieldCheck size={16} /> : <ShieldAlert size={16} />}
          {feedback.message}
        </div>
      )}

      {/* Admin users table */}
      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-[#0e2a4d]">Active Platform Administrators</h3>
            <p className="text-xs text-gray-400 font-medium mt-0.5">Currently active administrative accounts and roles.</p>
            <div className="flex items-center gap-1.5 mt-2 text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-1.5 rounded-lg border border-blue-100 w-fit">
              <Info size={12} />
              Users may have multiple active roles. Effective permissions are combined from all active roles.
            </div>
          </div>
        </div>

        {userRoles.length === 0 ? (
          <div className="text-center py-12 text-xs text-gray-400 font-medium">
            No active platform administrators assigned.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs text-gray-500 font-medium">
              <thead>
                <tr className="bg-slate-50/50 border-b border-gray-100 text-gray-400 font-bold uppercase text-[9px] tracking-wider">
                  <th className="px-6 py-3.5">Administrator</th>
                  <th className="px-6 py-3.5">Assigned Role</th>
                  <th className="px-6 py-3.5">Reason / Notes</th>
                  <th className="px-6 py-3.5">Assigned By</th>
                  <th className="px-6 py-3.5">Date</th>
                  <th className="px-6 py-3.5 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {userRoles.map((ur) => {
                  const isSelf = ur.user_id === callerUserId;
                  const isSuper = ur.platform_admin_roles?.role_key === 'super_admin';
                  
                  return (
                    <tr key={ur.id} className="hover:bg-slate-50/30 transition-colors">
                      {/* Admin Profile */}
                      <td className="px-6 py-4 flex items-center gap-3">
                        {ur.profile?.avatar_url ? (
                          <img 
                            src={ur.profile.avatar_url} 
                            alt="" 
                            className="w-7 h-7 rounded-full border border-gray-100 object-cover" 
                          />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-[9px] font-bold text-slate-500">
                            {ur.profile?.name?.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="font-bold text-gray-800">{ur.profile?.name}</p>
                          <p className="text-[10px] text-gray-400">{ur.profile?.email}</p>
                        </div>
                      </td>

                      {/* Assigned Role */}
                      <td className="px-6 py-4">
                        <span className={`inline-block px-2 py-0.5 rounded-full font-bold text-[10px] ${
                          isSuper 
                            ? 'bg-rose-50 border border-rose-100 text-rose-700'
                            : ur.platform_admin_roles?.role_key === 'finance_admin'
                            ? 'bg-cyan-50 border border-cyan-100 text-cyan-700'
                            : ur.platform_admin_roles?.role_key === 'wallet_admin'
                            ? 'bg-amber-50 border border-amber-100 text-amber-700'
                            : 'bg-slate-100 border border-slate-250 text-slate-700'
                        }`}>
                          {ur.platform_admin_roles?.role_name}
                        </span>
                      </td>

                      {/* Assigned Reason */}
                      <td className="px-6 py-4 max-w-xs">
                        <p className="truncate text-gray-600 font-medium" title={ur.assigned_reason}>
                          {ur.assigned_reason || 'No details provided.'}
                        </p>
                      </td>

                      {/* Assigned By */}
                      <td className="px-6 py-4 text-gray-600 font-medium">
                        {ur.assignor?.name || 'System'}
                      </td>

                      {/* Assignment Date */}
                      <td className="px-6 py-4 text-gray-400">
                        {new Date(ur.created_at).toLocaleDateString(undefined, { 
                          year: 'numeric', 
                          month: 'short', 
                          day: 'numeric' 
                        })}
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() => handleRevokeRole(ur.id)}
                          disabled={actionLoadingId === ur.id || isSelf}
                          className={`p-1.5 rounded-lg border-none bg-transparent transition-colors cursor-pointer inline-flex items-center justify-center outline-none ${
                            isSelf
                              ? 'text-gray-250 cursor-not-allowed'
                              : 'text-gray-400 hover:text-red-600 hover:bg-red-50'
                          }`}
                          title={isSelf ? "Self-lockout protection: You cannot revoke your own role." : "Revoke platform role"}
                        >
                          {actionLoadingId === ur.id ? (
                            <Loader2 size={15} className="animate-spin" />
                          ) : (
                            <Trash2 size={15} />
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Role Assignment Modal */}
      <AssignRoleModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        targetUser={selectedUser}
        roles={roles}
        onAssign={handleAssignRole}
      />
    </div>
  );
}
