'use client';

import { Mail, MapPin, Briefcase, Anchor, CheckCircle2, UserPlus, MessageSquare, Globe, Ship } from 'lucide-react';
import BaseModal from '../layout/BaseModal';

export default function ProfileDetailModal({ isOpen, onClose, profile, isSelf }) {
  if (!profile) return null;

  return (
    <BaseModal 
      isOpen={isOpen} 
      onClose={onClose} 
      title=""
      maxWidth="540px"
    >
      <div className="profile-detail-view">
        {/* Header Section */}
        <div className="flex flex-col items-center text-center px-6 pt-8 pb-6">
          <div className="relative mb-6">
            <img 
              src={profile.avatar_url || '/profile_pic.png'} 
              alt={profile.full_name} 
              className="w-28 h-28 rounded-full object-cover border-4 border-white shadow-xl"
            />
            <span className={`absolute bottom-2 right-2 w-6 h-6 rounded-full border-4 border-white ${profile.open_to_work ? 'bg-green-500' : 'bg-slate-400'}`}></span>
          </div>
          
          <h2 className="text-2xl font-bold text-[#000080] mb-1">{profile.full_name}</h2>
          <p className="text-[#64748b] text-base font-medium mb-3">{profile.headline || profile.position || 'Maritime Professional'}</p>
          
          <div className="flex flex-col items-center gap-3">
            <div className="flex items-center gap-1.5 text-sm text-[#64748b]">
              <MapPin size={16} className="text-[#94a3b8]" />
              <span>{profile.location || 'Global Operations'}</span>
            </div>
            
            {/* Skill Pills - Centered below location */}
            {profile.skills && (Array.isArray(profile.skills) ? profile.skills.length > 0 : typeof profile.skills === 'string' && profile.skills.length > 0) && (
                <div className="flex flex-wrap gap-2 justify-center px-4">
                  {(Array.isArray(profile.skills) ? profile.skills : profile.skills.split(',')).slice(0, 5).map((skill, i) => (
                    <span key={i} className="skill-pill">
                      {typeof skill === 'string' ? skill.trim() : skill}
                    </span>
                  ))}
                </div>
            )}

            {profile.is_sailing && (
              <div className="flex justify-center mt-2 w-full">
                <div className="engagement-banner !mb-0">
                  <span className="engagement-tag">NOT SEEKING</span>
                  <span className="engagement-vessel text-xs">Engaged: {profile.vessel_name || 'Active Vessel'}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="px-6">
          <div className="h-[1px] bg-[#f0f0f0] w-full"></div>
        </div>

        {/* Content Section */}
        <div className="px-6 py-8 space-y-10">
          {/* Bio */}
          {profile.bio && (
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-[#000080] uppercase tracking-widest opacity-70 px-5">About</h3>
              <p className="text-base text-[#475569] leading-relaxed mx-[20px]">
                {profile.bio}
              </p>
            </div>
          )}

          {/* Details Grid */}
          <div className="grid grid-cols-1 gap-6">
            <div className="flex items-start gap-4 p-4 rounded-2xl bg-white border border-[#f0f0f0]">
              <div className="p-3 rounded-xl bg-blue-50 text-[#000080]">
                <Briefcase size={20} />
              </div>
              <div>
                <span className="block text-xs font-bold text-[#000080] uppercase tracking-tight opacity-60 mb-1">Current Role</span>
                <p className="text-base font-semibold text-[#1e293b]">
                  {profile.current_position || profile.position || 'Not specified'}
                </p>
                <p className="text-sm text-[#64748b]">
                  {profile.current_company || 'Independent Contractor'}
                </p>
              </div>
            </div>

            {profile.is_sailing && (
              <div className="flex items-start gap-4 p-4 rounded-2xl bg-white border border-[#f0f0f0]">
                <div className="p-3 rounded-xl bg-green-50 text-green-600">
                  <CheckCircle2 size={20} />
                </div>
                <div>
                  <span className="block text-xs font-bold text-[#000080] uppercase tracking-tight opacity-60 mb-1">Availability</span>
                  <p className="text-base font-semibold text-[#1e293b]">
                    Currently Engaged
                  </p>
                  <p className="text-sm text-[#64748b]">
                    Onboard: {profile.vessel_name || 'Active Vessel'}
                  </p>
                </div>
              </div>
            )}
            {!profile.is_sailing && profile.open_to_work && (
              <div className="flex items-start gap-4 p-4 rounded-2xl bg-white border border-[#f0f0f0]">
                <div className="p-3 rounded-xl bg-green-50 text-green-600">
                  <CheckCircle2 size={20} />
                </div>
                <div>
                  <span className="block text-xs font-bold text-[#000080] uppercase tracking-tight opacity-60 mb-1">Availability</span>
                  <p className="text-base font-semibold text-[#1e293b]">
                    Open for Opportunity
                  </p>
                  <p className="text-sm text-[#64748b]">
                    Ready for immediate deployment
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions - Full width, bottom positioned */}
        {!isSelf && (
          <div className="px-6 pb-10 pt-6 mt-auto border-t border-[#f0f0f0] bg-white">
            <div className="flex flex-col gap-3">
              <button className="w-full bg-[#004173] text-white font-bold py-5 rounded-xl shadow-lg shadow-blue-900/10 hover:bg-[#002b4e] transition-all flex items-center justify-center gap-2">
                <UserPlus size={20} />
                Follow Professional
              </button>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        .skill-pill-outline {
          font-size: 12px;
          font-weight: 700;
          color: #004173;
          background: #f1f5f9;
          padding: 6px 14px;
          border-radius: 20px;
          border: 1px solid #004173;
        }
        .profile-detail-view {
          margin: -20px;
          display: flex;
          flex-direction: column;
          min-height: 100%;
        }
      `}</style>
    </BaseModal>
  );
}
