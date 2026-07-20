'use client';

import { Briefcase } from 'lucide-react';

export default function PersonalOverview({ profile, isCompany }) {
  if (isCompany) return null;

  const skills = profile?.skills || [];
  const experience = profile?.yearsOfExperience || profile?.yearsExperience;
  const bio = profile?.bio;

  if (!skills.length && !experience && !bio) return null;

  return (
    <div className="flex flex-col w-full mb-2 mt-4 pt-4 border-t border-gray-100">
      <div className="uppercase text-[11px] font-extrabold text-gray-400 tracking-wider mb-2.5 font-['Public_Sans',sans-serif]">
        Professional Overview
      </div>
      
      <div className="flex flex-col gap-3.5 w-full">
        {skills && skills.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {skills.map((skill, sIdx) => (
              <span key={sIdx} className="px-2.5 py-1 bg-gray-50 border border-gray-200 text-[#0e2a4d] rounded-full text-[11px] font-semibold whitespace-nowrap font-sans">
                {skill}
              </span>
            ))}
          </div>
        )}
        
        {experience && (
          <div className="flex items-center gap-2 text-[#4b5563] text-[13px] font-medium font-['Public_Sans',sans-serif]">
            <Briefcase size={14} className="text-gray-400" />
            <span>{experience} Years of Experience</span>
          </div>
        )}

        {bio && (
          <div className="text-gray-500 text-[13px] line-clamp-2 leading-relaxed font-['Public_Sans',sans-serif]">
            {bio}
          </div>
        )}
      </div>
    </div>
  );
}
