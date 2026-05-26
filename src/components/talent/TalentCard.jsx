'use client';

import { useRouter } from 'next/navigation';
import { MapPin } from 'lucide-react';

export default function TalentCard({ profile }) {
  const router = useRouter();
  return (
    <div className="talent-card card w-full p-4 md:p-5 hover:shadow-md transition-shadow flex flex-col items-center gap-3 h-full bg-white rounded-xl shadow-sm border border-slate-100 text-center">
      
      {/* Avatar */}
      <div className="mt-2 mb-2">
        <img 
          src={profile.avatar_url || '/avatar_placeholder.png'} 
          alt={profile.name || 'Talent Avatar'} 
          className="w-20 h-20 rounded-full border-2 border-slate-100 object-cover"
        />
      </div>
      
      {/* Name */}
      <h3 className="text-lg md:text-xl font-bold text-navy-900 leading-tight">
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
      <p className="text-sm font-medium text-marcomn-blue-600">
        {profile.yearsExperience ? `${profile.yearsExperience} years exp.` : profile.currentRole}
      </p>

      {/* Bio / Summary */}
      {profile.bio && (
        <p className="text-sm md:text-base leading-relaxed text-gray-700 mt-2 line-clamp-2">
          {profile.bio}
        </p>
      )}

      {/* Skills */}
      {profile.skills && profile.skills.length > 0 && (
        <div className="flex flex-wrap justify-center gap-2 mt-2 w-full">
          {profile.skills.slice(0, 3).map((skill, index) => (
            <span key={index} className="text-xs px-2 py-1 bg-gray-100 rounded-md text-gray-700">
              {skill}
            </span>
          ))}
          {profile.skills.length > 3 && (
            <span className="text-xs px-2 py-1 bg-gray-100 rounded-md text-gray-700">
              +{profile.skills.length - 3}
            </span>
          )}
        </div>
      )}

      {/* Footer CTA */}
      <div className="mt-auto w-full">
        <button 
          onClick={() => router.push(`/profile/${profile.id}`)}
          className="w-full h-10 flex items-center justify-center mt-4 border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
        >
          View Profile
        </button>
      </div>
    </div>
  );
}
