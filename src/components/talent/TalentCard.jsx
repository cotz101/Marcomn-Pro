'use client';

import { useRouter } from 'next/navigation';
import { MapPin } from 'lucide-react';

export default function TalentCard({ profile }) {
  const router = useRouter();
  return (
    <div className="talent-card card w-full p-5 hover:shadow-md transition-shadow flex flex-col items-center gap-3.5 h-full bg-white rounded-xl shadow-sm border border-slate-100 text-center">
      
      {/* 1. Avatar */}
      <div className="mt-2 mb-1">
        <img 
          src={profile.avatar_url || '/avatar_placeholder.png'} 
          alt={profile.name || 'Talent Avatar'} 
          className="w-20 h-20 rounded-full border-2 border-slate-100 object-cover"
        />
      </div>
      
      {/* 2. Name */}
      <h3 className="text-lg md:text-xl font-bold text-navy-900 leading-tight">
        {profile.name || 'Maritime Professional'}
      </h3>
      
      {/* 3. Current role or previous role */}
      <p className="text-sm font-semibold text-blue-900 leading-snug">
        {profile.currentRole || profile.previousRole || 'Maritime Professional'}
      </p>
      
      {/* 4. Years of experience */}
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
        {profile.yearsExperience ? `${profile.yearsExperience} Years Experience` : 'Entry Level'}
      </p>
      
      {/* 5. Bio */}
      {profile.bio && (
        <p className="text-sm leading-relaxed text-gray-600 mt-1 line-clamp-2">
          {profile.bio}
        </p>
      )}
      
      {/* 6. Location */}
      {profile.location && (
        <span className="flex items-center justify-center gap-1 text-xs text-slate-500 font-medium mt-1">
          <MapPin size={12} className="text-slate-400" />
          {profile.location}
        </span>
      )}
 
      {/* 7. View Profile button - Centered, not full width standard light button */}
      <div className="mt-auto w-full flex justify-center pt-2">
        <button 
          onClick={() => router.push(`/profile/${profile.id}`)}
          className="bg-white hover:bg-slate-50 text-[#002b4e] text-sm font-semibold rounded-xl border border-slate-200 transition-colors shadow-sm"
          style={{ 
            display: 'inline-flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            padding: '10px 24px', 
            width: 'auto',
            minWidth: '150px',
            marginTop: '16px'
          }}
        >
          View Profile
        </button>
      </div>
    </div>
  );
}
