'use client';

import { Mail, MapPin, Briefcase, Anchor, CheckCircle2, UserPlus, MessageSquare, Globe } from 'lucide-react';
import BaseModal from '../layout/BaseModal';

export default function ProfileDetailModal({ isOpen, onClose, profile }) {
  if (!profile) return null;

  return (
    <BaseModal 
      isOpen={isOpen} 
      onClose={onClose} 
      title="Professional Profile"
      maxWidth="580px"
    >
      <div className="profile-detail-view">
        {/* Header Section */}
        <div className="flex flex-col items-center text-center p-6 border-b bg-slate-50/50">
          <div className="relative mb-4">
            <img 
              src={profile.avatar_url || '/profile_pic.png'} 
              alt={profile.full_name} 
              className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-md"
            />
            <span className={`absolute bottom-1 right-1 w-5 h-5 rounded-full border-2 border-white ${profile.open_to_work ? 'bg-green-500' : 'bg-slate-400'}`}></span>
          </div>
          
          <h2 className="text-xl font-bold text-[#000080] mb-1">{profile.full_name}</h2>
          <p className="text-[#64748b] font-medium mb-2">{profile.headline || 'Maritime Professional'}</p>
          
          <div className="flex items-center gap-4 text-xs text-[#94a3b8]">
            <div className="flex items-center gap-1">
              <MapPin size={14} />
              <span>{profile.location || 'Global Operations'}</span>
            </div>
            {profile.is_sailing && (
              <div className="flex items-center gap-1 text-[#002b4e] font-semibold">
                <Anchor size={14} />
                <span>Sailing: {profile.vessel_name || 'Active Vessel'}</span>
              </div>
            )}
          </div>
        </div>

        {/* Content Section */}
        <div className="p-6 space-y-8">
          {/* Bio */}
          {profile.bio && (
            <div className="space-y-2">
              <h3 className="text-sm font-bold text-[#002b4e] uppercase tracking-wider">Professional Bio</h3>
              <p className="text-sm text-[#475569] leading-relaxed italic">
                "{profile.bio}"
              </p>
            </div>
          )}

          {/* Current Status */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
              <div className="flex items-center gap-2 mb-2 text-[#002b4e]">
                <Briefcase size={16} />
                <span className="text-xs font-bold uppercase tracking-tight">Current Role</span>
              </div>
              <p className="text-sm font-semibold text-[#1e293b]">
                {profile.current_position || 'Not specified'}
              </p>
              <p className="text-xs text-[#64748b]">
                {profile.current_company || 'Independent'}
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
              <div className="flex items-center gap-2 mb-2 text-[#002b4e]">
                <CheckCircle2 size={16} />
                <span className="text-xs font-bold uppercase tracking-tight">Availability</span>
              </div>
              <p className="text-sm font-semibold text-[#1e293b]">
                {profile.open_to_work ? 'Available for Hire' : 'Not Looking'}
              </p>
              <p className="text-xs text-[#64748b]">
                {profile.open_to_work ? 'Open to new opportunities' : 'Currently engaged'}
              </p>
            </div>
          </div>

          {/* Skills */}
          {profile.skills && profile.skills.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-[#002b4e] uppercase tracking-wider">Core Specialties</h3>
              <div className="flex flex-wrap gap-2">
                {profile.skills.map((skill, i) => (
                  <span key={i} className="skill-pill-large">
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-6 bg-slate-50 border-t flex gap-3">
          <button className="btn-follow-passport flex-1 py-3 text-sm flex items-center justify-center gap-2">
            <UserPlus size={18} />
            Connect
          </button>
          <button className="btn-ghost-navy flex-1 py-3 text-sm flex items-center justify-center gap-2" style={{ borderRadius: '8px' }}>
            <MessageSquare size={18} />
            Message
          </button>
        </div>
      </div>

      <style jsx>{`
        .skill-pill-large {
          font-size: 11px;
          font-weight: 700;
          color: #002b4e;
          background: white;
          padding: 6px 14px;
          border-radius: 20px;
          border: 1px solid #e2e8f0;
          box-shadow: 0 1px 2px rgba(0,0,0,0.03);
        }
        .profile-detail-view {
          margin: -20px; /* Offset modal body padding */
        }
      `}</style>
    </BaseModal>
  );
}
