'use client';

import React from 'react';
import { User, LogOut, Settings } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';

export default function ProfileMenu({ onClose }) {
  const router = useRouter();
  const supabase = createClient();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/');
    if (onClose) onClose();
    window.location.href = '/';
  };

  return (
    <div className="profile-menu-dropdown-list flex flex-col py-1.5 bg-white border border-gray-150 rounded-xl shadow-md w-48 font-sans">
      <div 
        className="flex items-center gap-2.5 px-4 py-2 hover:bg-gray-50 text-gray-700 hover:text-navy-900 cursor-pointer text-sm font-semibold transition-colors select-none"
        onClick={() => { router.push('/profile'); if (onClose) onClose(); }}
      >
        <User size={16} />
        <span>View Profile</span>
      </div>
      
      <div 
        className="flex items-center gap-2.5 px-4 py-2 hover:bg-gray-50 text-gray-700 hover:text-navy-900 cursor-pointer text-sm font-semibold transition-colors select-none"
        onClick={() => { router.push('/settings/notifications'); if (onClose) onClose(); }}
      >
        <Settings size={16} />
        <span>Notification Settings</span>
      </div>
      
      <div 
        className="flex items-center gap-2.5 px-4 py-2 hover:bg-gray-50 text-red-500 hover:text-red-600 cursor-pointer text-sm font-bold transition-colors select-none border-t border-gray-100 mt-1"
        onClick={handleSignOut}
      >
        <LogOut size={16} />
        <span>Sign Out</span>
      </div>
    </div>
  );
}
