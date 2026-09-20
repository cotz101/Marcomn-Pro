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
    <div className="flex flex-col gap-6 w-full min-w-0">
      {/* Top action: Search & promote user */}
      <div className="bg-white border border-gray-150 rounded-2xl p-4 sm:p-6 shadow-sm flex flex-col">
        <div>
          <h3 className="text-sm sm:text-base font-bold text-[#0e2a4d] flex items-center gap-2">
            <UserPlus size={18} className="text-[#0e2a4d]" /> Promote User to Platform Admin
          </h3>
          <p className="text-xs text-gray-500 font-medium mt-1.5 leading-relaxed">
            Search users by name or email to assign them administrative roles.
          </p>
        </div>

        {/* Search bar */}
        <div className="relative w-full max-w-lg mt-4 sm:mt-5">
          <div className="flex items-center gap-2.5 bg-slate-50 border border-gray-200 rounded-xl px-3.5 py-2.5 focus-within:border-[#0e2a4d] focus-within:bg-white transition-colors">
            <Search size={16} className="text-gray-400 shrink-0" />
            <input
              type="text"
              placeholder="Search user name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent outline-none border-none text-sm font-medium placeholder-gray-400 text-gray-800"
            />
            {searchLoading && <Loader2 size={16} className="animate-spin text-gray-400 shrink-0" />}
          </div>

          {/* Search suggestions dropdown */}
          {searchResults.length > 0 && (
            <div className="absolute left-0 right-0 mt-2 bg-white border border-gray-150 rounded-xl shadow-xl z-20 max-h-60 overflow-y-auto divide-y divide-gray-100">
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
                      className="w-8 h-8 rounded-full border border-gray-200 object-cover shrink-0"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center text-[10px] font-bold text-blue-600 shrink-0">
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
            <div className="absolute left-0 right-0 mt-2 bg-white border border-gray-150 rounded-xl shadow-xl p-4 text-center text-xs text-gray-400 font-medium z-20">
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
      <div className="bg-white border border-gray-150 rounded-2xl shadow-sm overflow-hidden flex flex-col">
        <div className="p-4 sm:p-6 border-b border-gray-150 flex flex-col gap-3">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-[#0e2a4d]">Active Platform Administrators</h3>
            <p className="text-xs text-gray-500 font-medium mt-1 leading-relaxed">Currently active administrative accounts and roles.</p>
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold text-blue-700 bg-blue-50/80 px-3 py-2 rounded-xl border border-blue-100/80 w-fit max-w-full leading-normal">
            <Info size={14} className="shrink-0 text-blue-600" />
            <span>Users may have multiple active roles. Effective permissions are combined from all active roles.</span>
          </div>
        </div>

        {userRoles.length === 0 ? (
          <div className="text-center py-16 px-4 sm:px-6 text-sm text-gray-500 font-medium bg-slate-50/20">
            No active platform administrators assigned.
          </div>
        ) : (
          <div className="overflow-x-auto w-full">
            <table className="w-full min-w-[780px] border-collapse text-left text-xs text-gray-500 font-medium">
              <thead>
                <tr className="bg-slate-50/70 border-b border-gray-150 text-gray-400 font-bold uppercase text-[9px] tracking-wider">
                  <th className="pl-4 sm:pl-6 pr-4 py-3.5 text-left">Administrator</th>
                  <th className="px-4 py-3.5 text-left">Assigned Role</th>
                  <th className="px-4 py-3.5 text-left">Reason / Notes</th>
                  <th className="px-4 py-3.5 text-left">Assigned By</th>
                  <th className="px-4 py-3.5 text-left">Date</th>
                  <th className="pl-4 pr-4 sm:pr-6 py-3.5 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {userRoles.map((ur) => {
                  const isSelf = ur.user_id === callerUserId;
                  const isSuper = ur.platform_admin_roles?.role_key === 'super_admin';
                  
                  return (
                    <tr key={ur.id} className="hover:bg-slate-50/40 transition-colors">
                      {/* Admin Profile */}
                      <td className="pl-4 sm:pl-6 pr-4 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          {ur.profile?.avatar_url ? (
                            <img
                              src={ur.profile.avatar_url}
                              alt=""
                              className="w-8 h-8 rounded-full border border-gray-200 object-cover shrink-0"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-600 shrink-0">
                              {ur.profile?.name?.charAt(0).toUpperCase() || '?'}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="font-bold text-gray-900 text-xs sm:text-sm">{ur.profile?.name || 'Unknown'}</p>
                            <p className="text-[11px] text-gray-400 truncate">{ur.profile?.email}</p>
                          </div>
                        </div>
                      </td>

                      {/* Assigned Role */}
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-md font-bold text-[10px] tracking-wide ${
                          isSuper 
                            ? 'bg-rose-50 border border-rose-200/80 text-rose-700'
                            : ur.platform_admin_roles?.role_key === 'finance_admin'
                            ? 'bg-cyan-50 border border-cyan-200/80 text-cyan-700'
                            : ur.platform_admin_roles?.role_key === 'wallet_admin'
                            ? 'bg-amber-50 border border-amber-200/80 text-amber-700'
                            : 'bg-slate-100 border border-slate-200 text-slate-700'
                        }`}>
                          {ur.platform_admin_roles?.role_name}
                        </span>
                      </td>

                      {/* Assigned Reason */}
                      <td className="px-4 py-4 max-w-xs">
                        <p className="truncate text-gray-600 font-medium text-xs" title={ur.assigned_reason}>
                          {ur.assigned_reason || 'No details provided.'}
                        </p>
                      </td>

                      {/* Assigned By */}
                      <td className="px-4 py-4 text-gray-600 font-medium whitespace-nowrap text-xs">
                        {ur.assignor?.name || 'System'}
                      </td>

                      {/* Assignment Date */}
                      <td className="px-4 py-4 text-gray-400 whitespace-nowrap text-xs">
                        {new Date(ur.created_at).toLocaleDateString(undefined, { 
                          year: 'numeric', 
                          month: 'short', 
                          day: 'numeric' 
                        })}
                      </td>

                      {/* Actions */}
                      <td className="pl-4 pr-4 sm:pr-6 py-4 text-center whitespace-nowrap">
                        <button
                          onClick={() => handleRevokeRole(ur.id)}
                          disabled={actionLoadingId === ur.id || isSelf}
                          className={`p-2 rounded-lg border-none bg-transparent transition-colors cursor-pointer inline-flex items-center justify-center outline-none ${
                            isSelf
                              ? 'text-gray-250 cursor-not-allowed'
                              : 'text-gray-400 hover:text-red-600 hover:bg-red-50'
                          }`}
                          title={isSelf ? "Self-lockout protection: You cannot revoke your own role." : "Revoke platform role"}
                        >
                          {actionLoadingId === ur.id ? (
                            <Loader2 size={16} className="animate-spin" />
                          ) : (
                            <Trash2 size={16} />
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
