'use client';

import Link from 'next/link';
import { MapPin } from 'lucide-react';

export default function PersonalTopCard({ profile, isCompany }) {
  if (isCompany) return null;

  const name = profile?.name || profile?.fullName || 'MarComn Member';
  const avatar = profile?.avatar_url || profile?.profilePic || '/avatar_placeholder.png';
  const role = profile?.currentRole || profile?.previousRole || 'MarComn Professional';
  const location = profile?.location;
  const profileId = profile?.id;

  return (
    <div className="flex flex-col items-center text-center">
      {/* Avatar */}
      <div className="flex justify-center mb-3">
        <img 
          src={avatar} 
          alt={name} 
          className="w-20 h-20 rounded-full object-cover bg-white shadow-sm border border-gray-100"
        />
      </div>

      <h3 className="font-sans font-bold text-lg text-[#0e2a4d] tracking-tight leading-tight">{name}</h3>
      <p className="text-[15px] text-gray-600 mt-0.5 font-sans font-medium">{role}</p>

      {location && (
        <div className="flex items-center gap-1.5 text-gray-500 text-[13px] mt-1.5 font-['Public_Sans',sans-serif]">
          <MapPin size={14} className="text-gray-400" />
          <span>{location}</span>
        </div>
      )}

      <Link 
        href={profileId ? `/profile/${profileId}` : '/profile'} 
        className="block w-full py-2 mt-4 text-center text-[13px] font-medium text-blue-950 bg-transparent hover:text-blue-700 hover:underline transition-all font-sans"
      >
        View Profile
      </Link>
    </div>
  );
}
