'use client';

import { useState, useEffect } from 'react';
import { useProfile } from '@/app/context/ProfileContext';
import { Building2 } from 'lucide-react';

function getCompanyInitials(name) {
  if (!name || typeof name !== 'string') return '';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
}

export default function CreatePost() {
  const { profile, setShowCreatePost, currentIdentity } = useProfile();
  const [logoError, setLogoError] = useState(false);

  const isCompany = currentIdentity?.type === 'company';
  const identityImage = isCompany ? (currentIdentity.data?.logo_url || null) : (profile?.profilePic || '/avatar_placeholder.png');
  const identityName = isCompany ? (currentIdentity.data?.name || 'Company') : (profile?.name || 'member');
  const initials = isCompany ? getCompanyInitials(identityName) : '';

  useEffect(() => {
    setLogoError(false);
  }, [currentIdentity]);

  return (
    <div 
      className="bg-white rounded-xl border border-gray-100 px-2 sm:px-4 py-5 mb-6 shadow-sm flex flex-col gap-3 w-full max-w-3xl mx-auto logbook-create-post-sticky"
      style={{ paddingTop: '20px', paddingBottom: '20px' }}
    >
      {/* Avatar + Rounded Trigger Button */}
      <div className="flex items-center gap-3 w-full">
        {identityImage && !logoError ? (
          <img
            src={identityImage}
            alt={identityName}
            onError={() => setLogoError(true)}
            className="w-10 h-10 object-cover border border-gray-100 shadow-xs flex-shrink-0"
            style={{ borderRadius: isCompany ? '8px' : '50%' }}
          />
        ) : isCompany ? (
          <div
            className="w-10 h-10 bg-slate-100 border border-slate-200/80 rounded-lg flex items-center justify-center shadow-xs flex-shrink-0 text-[#004173] font-bold select-none"
            aria-label={`${identityName} company`}
            role="img"
          >
            {initials ? (
              <span className="text-xs font-extrabold text-[#004173]">
                {initials}
              </span>
            ) : (
              <Building2 size={18} className="text-[#004173]" />
            )}
          </div>
        ) : (
          <div
            className="w-10 h-10 bg-blue-50 border border-blue-100 rounded-full flex items-center justify-center shadow-xs flex-shrink-0 text-blue-900 font-bold select-none"
            aria-label={identityName}
            role="img"
          >
            <span className="text-sm font-extrabold text-blue-900">
              {identityName.charAt(0).toUpperCase()}
            </span>
          </div>
        )}

        <button
          type="button"
          onClick={() => {
            setShowCreatePost(true);
          }}
          className="bg-gray-50 hover:bg-gray-100/80 border border-gray-200 font-sans font-medium text-sm text-gray-500 rounded-full transition-all cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-100 active:scale-[0.99] select-none flex items-center justify-center w-full text-center px-4 py-3"
        >
          Start a post as {identityName}...
        </button>
      </div>
    </div>
  );
}
