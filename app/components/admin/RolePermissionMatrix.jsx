'use client';

import { useState, useEffect, useCallback } from 'react';
import { Loader2, ShieldAlert, ShieldCheck, Settings, Save, RotateCcw, AlertTriangle } from 'lucide-react';
import { getRolePermissionMatrix, updateRolePermissions } from '@/app/actions/adminUserActions';

const PERMISSION_GROUPS = [
  {
    title: 'General Admin',
    keys: ['can_access_platform_admin']
  },
  {
    title: 'Wallet / MCredits',
    keys: ['can_view_wallet_summary', 'can_view_wallet_control', 'can_grant_mcredits', 'can_deduct_mcredits']
  },
  {
    title: 'Top-Up',
    keys: ['can_approve_topups', 'can_reject_topups']
  },
  {
    title: 'Finance',
    keys: ['can_view_platform_wallet', 'can_view_finance_reports']
  },
  {
    title: 'Settings',
    keys: ['can_manage_global_settings']
  },
  {
    title: 'Admin Management',
    keys: ['can_manage_admin_roles', 'can_view_admin_audit_logs']
  },
  {
    title: 'Moderation',
    keys: ['can_moderate_content']
  },
  {
    title: 'Refund / Disputes',
    keys: ['can_manage_refund_reviews']
  }
];

export default function RolePermissionMatrix() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [originalMatrix, setOriginalMatrix] = useState({});
  const [currentMatrix, setCurrentMatrix] = useState({});
  const [selectedRoleId, setSelectedRoleId] = useState(null);
  const [feedback, setFeedback] = useState(null);

  const loadMatrix = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getRolePermissionMatrix();
      if (res.success) {
        setRoles(res.roles || []);
        setPermissions(res.permissions || []);
        setOriginalMatrix(res.rolePermissions || {});
        setCurrentMatrix(JSON.parse(JSON.stringify(res.rolePermissions || {})));
        
        if (res.roles && res.roles.length > 0 && !selectedRoleId) {
          setSelectedRoleId(res.roles[0].id);
        }
      } else {
        showFeedback(res.error || 'Failed to load permission matrix.', 'error');
      }
    } catch (err) {
      showFeedback('An unexpected error occurred.', 'error');
    } finally {
      setLoading(false);
    }
  }, [selectedRoleId]);

  useEffect(() => {
    loadMatrix();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const showFeedback = (message, type = 'success') => {
    setFeedback({ message, type });
    setTimeout(() => setFeedback(null), 4000);
  };

  const handleTogglePermission = (permissionKey) => {
    if (!selectedRoleId) return;
    const selectedRole = roles.find(r => r.id === selectedRoleId);
    if (selectedRole?.role_key === 'super_admin') return; // Read-only

    setCurrentMatrix(prev => {
      const currentRolePerms = prev[selectedRoleId] || [];
      let newPerms;
      if (currentRolePerms.includes(permissionKey)) {
        newPerms = currentRolePerms.filter(k => k !== permissionKey);
      } else {
        newPerms = [...currentRolePerms, permissionKey];
      }
      return { ...prev, [selectedRoleId]: newPerms };
    });
  };

  const handleReset = () => {
    if (!selectedRoleId) return;
    setCurrentMatrix(prev => ({
      ...prev,
      [selectedRoleId]: [...(originalMatrix[selectedRoleId] || [])]
    }));
  };

  const handleSave = async () => {
    if (!selectedRoleId) return;
    const selectedRole = roles.find(r => r.id === selectedRoleId);
    if (selectedRole?.role_key === 'super_admin') return;

    const newPerms = currentMatrix[selectedRoleId] || [];
    const origPerms = originalMatrix[selectedRoleId] || [];

    // Check if anything actually changed
    if (newPerms.length === origPerms.length && newPerms.every(p => origPerms.includes(p))) {
      showFeedback('No changes to save.');
      return;
    }

    if (!confirm(`Are you sure you want to update permissions for ${selectedRole.role_name}?`)) {
      return;
    }

    setSaving(true);
    try {
      const res = await updateRolePermissions(selectedRoleId, newPerms);
      if (res.success) {
        showFeedback('Permissions successfully updated.');
        // Update original matrix to reflect successful save
        setOriginalMatrix(prev => ({ ...prev, [selectedRoleId]: [...newPerms] }));
      } else {
        showFeedback(res.error || 'Failed to update permissions.', 'error');
      }
    } catch (err) {
      showFeedback(err.message || 'An unexpected error occurred.', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading && roles.length === 0) {
    return (
      <div className="flex justify-center items-center py-16">
        <Loader2 size={32} className="animate-spin text-blue-900" />
      </div>
    );
  }

  const selectedRole = roles.find(r => r.id === selectedRoleId);
  const isSuperAdmin = selectedRole?.role_key === 'super_admin';
  const rolePerms = currentMatrix[selectedRoleId] || [];
  const originalRolePerms = originalMatrix[selectedRoleId] || [];
  
  const hasChanges = rolePerms.length !== originalRolePerms.length || !rolePerms.every(p => originalRolePerms.includes(p));

  // Map permissions array to an object for easy access
  const permDetails = permissions.reduce((acc, p) => {
    acc[p.permission_key] = p;
    return acc;
  }, {});

  return (
    <div className="flex flex-col space-y-6">
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

      <div className="flex flex-col md:flex-row gap-6 items-start">
        {/* Left Panel: Role List */}
        <div className="w-full md:w-1/3 bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden shrink-0">
          <div className="px-5 py-4 border-b border-gray-100 bg-slate-50/50">
            <h3 className="text-sm font-bold text-[#0e2a4d]">Platform Roles</h3>
            <p className="text-[11px] text-gray-500 font-medium mt-0.5">Select a role to manage its permissions</p>
          </div>
          <div className="divide-y divide-gray-100 max-h-[600px] overflow-y-auto">
            {roles.map(role => (
              <button
                key={role.id}
                onClick={() => setSelectedRoleId(role.id)}
                className={`w-full text-left px-5 py-4 transition-colors border-none outline-none cursor-pointer flex flex-col gap-1 ${
                  selectedRoleId === role.id 
                    ? 'bg-blue-50/50 border-l-4 border-l-blue-600' 
                    : 'bg-white hover:bg-slate-50 border-l-4 border-l-transparent'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-sm font-bold ${selectedRoleId === role.id ? 'text-blue-900' : 'text-gray-700'}`}>
                    {role.role_name}
                  </span>
                  {role.role_key === 'super_admin' && (
                    <ShieldCheck size={14} className="text-rose-500" />
                  )}
                </div>
                <span className="text-[10px] text-gray-400 font-mono">{role.role_key}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Right Panel: Role Details & Permissions */}
        <div className="w-full md:w-2/3 bg-white border border-gray-100 rounded-2xl shadow-sm flex flex-col">
          {selectedRole ? (
            <>
              {/* Top Summary */}
              <div className="px-6 py-5 border-b border-gray-100 bg-slate-50/30 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-[#0e2a4d] flex items-center gap-2">
                    {selectedRole.role_name}
                  </h2>
                  <p className="text-xs text-gray-500 mt-1 max-w-md leading-relaxed">
                    {selectedRole.description || 'No description available for this role.'}
                  </p>
                  <div className="mt-3 flex items-center gap-3">
                    <span className="text-[10px] font-mono font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded-md">
                      {selectedRole.role_key}
                    </span>
                    <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-1 rounded-md">
                      {rolePerms.length} Active Permissions
                    </span>
                  </div>
                </div>

                <div className="flex flex-col gap-2 shrink-0">
                  <button
                    onClick={handleSave}
                    disabled={isSuperAdmin || !hasChanges || saving}
                    className={`px-4 py-2 text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all outline-none border-none cursor-pointer ${
                      isSuperAdmin || !hasChanges || saving
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm'
                    }`}
                  >
                    {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                    Save Changes
                  </button>
                  <button
                    onClick={handleReset}
                    disabled={isSuperAdmin || !hasChanges || saving}
                    className={`px-4 py-2 text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all outline-none border cursor-pointer ${
                      isSuperAdmin || !hasChanges || saving
                        ? 'bg-transparent border-transparent text-transparent cursor-not-allowed hidden'
                        : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <RotateCcw size={14} />
                    Reset
                  </button>
                </div>
              </div>

              {/* Super Admin Warning */}
              {isSuperAdmin && (
                <div className="px-6 py-3 bg-rose-50 border-b border-rose-100 flex items-center gap-2 text-rose-700 text-xs font-bold">
                  <AlertTriangle size={16} />
                  System protected role. Permissions are read-only and cannot be modified.
                </div>
              )}

              {/* Permissions List */}
              <div className="p-6 overflow-y-auto max-h-[600px]">
                <div className="space-y-8">
                  {PERMISSION_GROUPS.map((group, idx) => (
                    <div key={idx}>
                      <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 border-b border-gray-100 pb-2">
                        {group.title}
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {group.keys.map(key => {
                          const pInfo = permDetails[key];
                          if (!pInfo) return null; // If a permission key isn't in the DB yet, skip it gracefully
                          const isChecked = rolePerms.includes(key);

                          return (
                            <label 
                              key={key} 
                              className={`flex items-start gap-3 p-3 rounded-xl border transition-all ${
                                isSuperAdmin ? 'cursor-default bg-gray-50/50 border-gray-100 opacity-80' : 'cursor-pointer hover:border-blue-200 hover:bg-blue-50/20'
                              } ${isChecked ? 'border-blue-200 bg-blue-50/10' : 'border-gray-100'}`}
                            >
                              <div className="mt-0.5">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => handleTogglePermission(key)}
                                  disabled={isSuperAdmin}
                                  className={`w-4 h-4 rounded text-blue-600 border-gray-300 focus:ring-blue-500 ${isSuperAdmin ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
                                />
                              </div>
                              <div className="flex flex-col">
                                <span className="text-xs font-bold text-gray-800">{pInfo.permission_name}</span>
                                <span className="text-[10px] text-gray-500 mt-0.5 leading-snug">{pInfo.description}</span>
                                <span className="text-[9px] text-gray-400 font-mono mt-1">{key}</span>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
              <Settings size={48} className="text-gray-200 mb-4" />
              <h3 className="text-sm font-bold text-gray-400">No Role Selected</h3>
              <p className="text-xs text-gray-400 mt-1">Select a role from the left panel to view its permissions.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
