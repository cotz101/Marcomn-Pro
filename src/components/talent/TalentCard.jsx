'use client';

import { useRouter } from 'next/navigation';
import { MapPin } from 'lucide-react';

export default function TalentCard({ profile }) {
  const router = useRouter();
  return (
    <div className="talent-card card w-full p-4 hover:shadow-md transition-shadow flex flex-col items-center gap-1 h-full bg-white rounded-xl shadow-sm border border-slate-100 text-center">
      
      {/* Avatar */}
      <div className="mt-2 mb-2">
        <img 
          src={profile.avatar_url || 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y'} 
          alt={profile.name || 'Talent Avatar'} 
          className="w-20 h-20 rounded-full border-2 border-slate-100 object-cover"
        />
      </div>
      
      {/* Name */}
      <h3 className="text-lg font-bold text-[#002b4e] leading-tight">
        {profile.name || 'Maritime Professional'}
      </h3>
      
      {/* Location */}
      {profile.location && (
        <span className="flex items-center gap-1 text-sm text-slate-500">
          <MapPin size={12} />
          {profile.location}
        </span>
      )}

      {/* Secondary Detail (Conditional Switch) */}
      <p className="text-sm text-slate-500">
        {profile.yearsExperience ? `${profile.yearsExperience} years exp.` : profile.currentRole}
      </p>

      {/* 1st Skill Pill */}
      {profile.skills && profile.skills.length > 0 && (
        <span className="mt-2 inline-block px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-100">
          {profile.skills[0]}
        </span>
      )}

      {/* Footer CTA */}
      <div className="mt-auto w-full">
        <button 
          onClick={() => router.push(`/profile/${profile.id}`)}
          className="w-full mt-4 py-2 border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
        >
          View Profile
        </button>
      </div>
    </div>
  );
}
