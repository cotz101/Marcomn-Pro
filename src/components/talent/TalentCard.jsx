'use client';

import { useRouter } from 'next/navigation';
import { MapPin } from 'lucide-react';

export default function TalentCard({ profile }) {
  const router = useRouter();
  const isAvailable = profile.open_to_work === true;
  
  // Safely handle skills array, take up to 4
  const skillsList = Array.isArray(profile.skills) ? profile.skills : [];
  const displaySkills = skillsList.slice(0, 3);

  return (
    <div className="talent-card card w-full p-5 hover:shadow-md transition-all duration-300 flex flex-col items-center h-full bg-white border border-slate-200 rounded-xl text-center">
      
      {/* Avatar */}
      <div className="mt-2 mb-3">
        <img 
          src={profile.avatar_url || 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y'} 
          alt={profile.name || 'Talent Avatar'} 
          className="w-20 h-20 rounded-full border-2 border-slate-100 object-cover"
        />
      </div>
      
      {/* Name */}
      <h3 className="text-lg font-bold text-[#002b4e] leading-tight mb-1">
        {profile.name || 'Anonymous User'}
      </h3>
      
      {/* Role */}
      <p className="text-sm text-slate-500 mb-3">
        {profile.currentRole || profile.current_role || 'Maritime Professional'}
      </p>

      {/* Availability Status */}
      <div className="flex items-center justify-center gap-1.5 mb-2 text-sm font-medium">
        <div className={`w-2.5 h-2.5 rounded-full ${isAvailable ? 'bg-green-500' : 'bg-slate-300'}`}></div>
        <span className={isAvailable ? 'text-green-700' : 'text-slate-500'}>
          {isAvailable ? 'Available Now' : 'Not Available'}
        </span>
      </div>

      {/* Experience */}
      <div className="text-sm text-[#002b4e] font-medium mb-4">
        {profile.years_experience || profile.yearsExperience || '0'}+ Years of Experience
      </div>

      {/* Skills */}
      {displaySkills.length > 0 && (
        <div className="flex flex-wrap justify-center gap-2 mb-6">
          {displaySkills.map((skill, idx) => (
            <span key={idx} className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-xs font-medium">
              {skill}
            </span>
          ))}
        </div>
      )}

      {/* Footer CTA */}
      <div className="mt-auto w-full pt-4 flex justify-center">
        <button 
          onClick={() => router.push(`/profile/${profile.id}`)}
          className="w-auto px-5 py-1.5 text-sm font-medium text-blue-900 bg-white border border-blue-900 rounded-full hover:bg-blue-50 transition-colors"
        >
          View Profile
        </button>
      </div>
    </div>
  );
}
