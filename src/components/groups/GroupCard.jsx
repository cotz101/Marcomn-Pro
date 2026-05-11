'use client';

import { useState } from 'react';
import { Users, Globe, Lock, ChevronRight, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function GroupCard({ group, onAction }) {
  const isPrivate = group.type?.toLowerCase() === 'private';
  const isPublic = !isPrivate;
  const isPending = group.membershipStatus === 'pending';
  const router = useRouter();
  const [isEntering, setIsEntering] = useState(false);

  const handleEnterGroup = () => {
    setIsEntering(true);
    // Brief loading state before navigation
    setTimeout(() => {
      router.push(`/groups/${group.id}`);
    }, 400);
  };

  // Final UX Logic for Avatar Stack
  // 1. Cascade Threshold: Trigger if 2+ members
  // 2. Universal Shuffle: If 2+, randomize and slice to 3
  const members = group.members || [];
  const displayMembers = members.length >= 2
    ? [...members].sort(() => 0.5 - Math.random()).slice(0, 3) 
    : members;

  return (
    <div className={`w-full max-w-full bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-md transition-all duration-300 p-4 ${isEntering ? 'opacity-60 scale-[0.98]' : ''}`}>
      <div className="flex gap-4">
        {/* Group Avatar Stack - Refined UX Logic */}
        <div className="flex-shrink-0 pt-1">
          {members.length > 1 ? (
            <div className="flex items-center -space-x-3">
              {displayMembers.map((member, i) => (
                <div key={member.id || i} className="relative z-10">
                  {member.avatar_url ? (
                    <img 
                      src={member.avatar_url}
                      className="w-8 h-8 rounded-full border-2 border-white object-cover shadow-sm"
                      alt={member.name || "Member"}
                    />
                  ) : (
                    <div className="flex items-center justify-center w-8 h-8 rounded-full border-2 border-white bg-slate-50 text-slate-400 shadow-sm">
                      <Users size={16} />
                    </div>
                  )}
                </div>
              ))}
              {group.member_count > 3 && (
                <div className="flex items-center justify-center w-8 h-8 rounded-full border-2 border-white bg-gray-100 text-[10px] font-semibold text-gray-600 relative z-0 shadow-sm">
                  +{group.member_count - 3}
                </div>
              )}
            </div>
          ) : (
            /* Generic Fallback for Single/Zero Member */
            <div className="flex items-center justify-center w-8 h-8 rounded-full border-2 border-slate-200 bg-slate-50 text-slate-400 shadow-sm">
              <Users size={16} />
            </div>
          )}
        </div>

        {/* Group Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-bold text-lg text-[#0e2a4d] truncate">{group.name}</h3>
            {isPublic ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-[10px] font-bold uppercase tracking-wider border border-green-200">
                <Globe size={10} />
                Public
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 text-[10px] font-bold uppercase tracking-wider border border-orange-200">
                <Lock size={10} />
                Private
              </span>
            )}
          </div>
          
          <p className="text-sm text-gray-600 line-clamp-2 mb-3">
            {group.description}
          </p>
          
          <div className="flex items-center gap-4 text-xs text-gray-500 font-medium">
            <div className="flex items-center gap-1">
              <Users size={14} />
              <span>{group.member_count} Members</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end mt-6">
        {group.isMember ? (
          <button 
            onClick={handleEnterGroup}
            disabled={isEntering}
            className={`inline-flex items-center justify-center w-max !px-5 !py-1.5 bg-white text-gray-900 border border-gray-200 rounded-lg font-medium text-sm hover:bg-gray-50 transition-all shadow-sm whitespace-nowrap gap-2 ${isEntering ? 'animate-btn-loading' : ''}`}
          >
            {isEntering ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>{"\u00A0"}Entering...{"\u00A0"}</span>
              </>
            ) : (
              <>
                <span>{"\u00A0"}Enter Group{"\u00A0"}</span>
                <ChevronRight size={16} />
              </>
            )}
          </button>
        ) : isPending ? (
          <button 
            disabled
            className="inline-flex items-center justify-center w-max !px-5 !py-1.5 bg-gray-100 text-gray-400 border border-gray-200 rounded-lg font-medium text-sm cursor-not-allowed whitespace-nowrap gap-2"
          >
            Request Sent
          </button>
        ) : isPublic ? (
          <button 
            onClick={() => onAction(group)}
            className="inline-flex items-center justify-center w-max !px-5 !py-1.5 bg-blue-950 text-white rounded-lg font-medium text-sm hover:bg-blue-900 transition-all shadow-sm whitespace-nowrap"
          >
            Join Group
          </button>
        ) : (
          <button 
            onClick={() => onAction(group)}
            className="inline-flex items-center justify-center w-max !px-5 !py-1.5 bg-[#FAEADB] text-orange-900 hover:brightness-95 border border-transparent rounded-lg font-medium text-sm transition-all shadow-sm whitespace-nowrap"
          >
            Ask to Join
          </button>
        )}
      </div>
    </div>
  );
}
