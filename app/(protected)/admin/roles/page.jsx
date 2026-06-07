'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useProfile } from '@/app/context/ProfileContext';
import { 
  ArrowLeft, 
  Loader2, 
  ShieldAlert, 
  Users, 
  Settings, 
  ShieldCheck 
} from 'lucide-react';
import { getAdminRolesAndUsers } from '@/app/actions/adminUserActions';
import UserRoleAssignment from '@/app/components/admin/UserRoleAssignment';
import RolePermissionMatrix from '@/app/components/admin/RolePermissionMatrix';

export default function AdminRolesPage() {
  const router = useRouter();
  const { profile, userId, showToast } = useProfile();

  const isLegacyAdmin = profile && ['super_admin', 'admin', 'brand_manager'].includes(profile.global_role);
  const isAuthorized = profile && (profile.admin_permissions?.includes('can_manage_admin_roles') || isLegacyAdmin);

  const [activeTab, setActiveTab] = useState('users'); // users, matrix
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState([]);
  const [userRoles, setUserRoles] = useState([]);

  const loadData = useCallback(async () => {
    if (!isAuthorized) return;
    
    setLoading(true);
    try {
      const res = await getAdminRolesAndUsers();
      if (res.success) {
        setRoles(res.roles || []);
        setUserRoles(res.userRoles || []);
      } else {
        showToast(res.error || 'Failed to load platform roles.', 'error');
      }
    } catch (err) {
      showToast('An error occurred loading admin configurations.', 'error');
    } finally {
      setLoading(false);
    }
  }, [isAuthorized, showToast]);

  useEffect(() => {
    if (profile) {
      if (isAuthorized) {
        loadData();
      } else {
        setLoading(false);
      }
    }
  }, [profile, isAuthorized, loadData]);

  // Loading view
  if (loading && !profile) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 flex flex-col items-center justify-center space-y-4">
        <Loader2 size={36} className="animate-spin text-blue-900" />
        <span className="text-sm text-gray-500 font-semibold">Validating session permissions...</span>
      </div>
    );
  }

  // Access Denied view
  if (!isAuthorized) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center font-sans">
        <div className="bg-white border border-gray-100 rounded-3xl p-8 shadow-md flex flex-col items-center space-y-6">
          <div className="p-4 bg-red-50 text-red-600 rounded-full">
            <ShieldAlert size={36} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Access Denied</h1>
            <p className="text-sm text-gray-500 mt-2">
              You do not have the necessary platform administrator privileges to access this area.
            </p>
          </div>
          <button 
            onClick={() => router.push('/')}
            className="w-full bg-[#002b4e] hover:bg-[#001c33] text-white text-sm font-bold py-3 rounded-xl transition-all shadow-sm cursor-pointer border-none outline-none select-none"
          >
            Return Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1280px] mx-auto px-4 py-8 font-sans w-full">
      {/* Back to Admin Dashboard Button */}
      <button
        onClick={() => router.push('/admin')}
        className="flex items-center gap-2 text-gray-500 hover:text-[#002b4e] transition-colors mb-6 text-sm font-bold cursor-pointer bg-none border-none outline-none"
      >
        <ArrowLeft size={16} /> Back to Admin Dashboard
      </button>

      {/* Page Header */}
      <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-blue-50 text-blue-950 rounded-xl flex items-center justify-center shrink-0">
            <ShieldCheck size={24} className="text-blue-900" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[#0e2a4d] leading-tight">Platform Roles & Access Control</h1>
            <p className="text-sm text-gray-500 mt-1 font-medium">
              Manage platform administrative roles, assign roles to users, and control access permissions.
            </p>
          </div>
        </div>
        <div className="shrink-0 flex items-center justify-end">
          <button
            onClick={() => router.push('/admin/audit-logs')}
            className="flex items-center gap-2 bg-[#0e2a4d] hover:bg-blue-900 text-white px-4 py-2 rounded-xl text-xs font-bold transition-colors shadow-sm border-none cursor-pointer"
          >
            <ShieldCheck size={14} />
            View Audit Logs
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 gap-6 mb-6 overflow-x-auto pb-px w-full">
        <button
          onClick={() => setActiveTab('users')}
          className={`pb-3 text-sm font-bold transition-all border-b-2 outline-none focus:outline-none whitespace-nowrap cursor-pointer flex items-center gap-2 bg-transparent border-t-0 border-x-0 ${
            activeTab === 'users'
              ? 'border-blue-900 text-blue-900 border-solid'
              : 'border-transparent text-gray-400 hover:text-gray-600'
          }`}
        >
          <Users size={16} />
          User Role Assignments
        </button>
        <button
          onClick={() => setActiveTab('matrix')}
          className={`pb-3 text-sm font-bold transition-all border-b-2 outline-none focus:outline-none whitespace-nowrap cursor-pointer flex items-center gap-2 bg-transparent border-t-0 border-x-0 ${
            activeTab === 'matrix'
              ? 'border-blue-900 text-blue-900 border-solid'
              : 'border-transparent text-gray-400 hover:text-gray-600'
          }`}
        >
          <Settings size={16} />
          Role Permission Matrix
        </button>
      </div>

      {/* Tab Content */}
      {loading ? (
        <div className="flex justify-center items-center py-12">
          <Loader2 size={28} className="animate-spin text-blue-900" />
        </div>
      ) : activeTab === 'users' ? (
        <UserRoleAssignment
          roles={roles}
          userRoles={userRoles}
          onRefresh={loadData}
          callerUserId={userId}
        />
      ) : (
        <RolePermissionMatrix />
      )}
    </div>
  );
}
