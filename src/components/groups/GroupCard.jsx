'use client';

import { useState } from 'react';
import { Users, Globe, Lock, ChevronRight, Loader2, Settings } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function GroupCard({ group, onAction }) {
  const isPrivate = group.type?.toLowerCase() === 'private';
  const isPublic = !isPrivate;
  const isPending = group.membershipStatus === 'pending';
  const router = useRouter();
  const [isEntering, setIsEntering] = useState(false);


  const isAdmin = group.membershipRole === 'admin';
  const isMember = group.isMember;

  const handleEnterGroup = () => {
    setIsEntering(true);
    // Brief loading state before navigation
    setTimeout(() => {
      router.push(`/groups/${group.id}`);
    }, 400);
  };

  // Final UX Logic for Avatar Stack - Deep Fetch Update
  // 1. Safe Extraction: Prioritize the 'members' array built by the Deep Fetch query
  const membersList = group.members || [];
  
  // 2. Max 4 Constraint & Dynamic Randomization
  // If 2+, randomize and slice to 4 for the display stack
  const displayMembers = membersList.length >= 2
    ? [...membersList].sort(() => 0.5 - Math.random()).slice(0, 4) 
    : membersList;

  return (
    <div className={`w-full min-h-[120px] grid grid-cols-2 gap-y-2 md:flex md:flex-col md:justify-between max-w-full bg-white border-y border-x-0 sm:border-x border-gray-200 rounded-none sm:rounded-lg overflow-hidden hover:shadow-md transition-all duration-300 p-4 md:p-6 pb-[max(1rem,env(safe-area-inset-bottom))] relative ${isEntering ? 'opacity-60 scale-[0.98]' : ''}`}>
      <div className="col-span-2 contents md:flex md:flex-row md:justify-between md:gap-4 md:w-full">
        {/* Left Column: Group Title & Badge */}
        <div className="col-span-2 md:col-span-1 flex-grow min-w-0 flex flex-col items-start text-left">
          <h3 className="text-xl md:text-2xl font-semibold leading-tight text-navy-900 truncate w-full">{group.name}</h3>
          <div className="mt-1">
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
        </div>

        {/* Right Column: Avatar Cluster & Member Count */}
        <div className="col-span-1 md:col-span-1 flex flex-row items-center gap-2 md:flex-col md:items-end text-left md:text-right flex-shrink-0 pt-1 mt-2.5 md:mt-0">
          {membersList.length >= 2 ? (
            <div className="flex items-center -space-x-4 mb-1 flex-row-reverse">
              {/* Using flex-row-reverse for natural right-anchor cascade overlap */}
              {group.member_count > 4 && (
                <div className="flex items-center justify-center w-8 h-8 rounded-full border-2 border-white bg-gray-100 text-[10px] font-semibold text-gray-600 relative z-0 shadow-sm first:ml-0 -ml-4">
                  +{group.member_count - 4}
                </div>
              )}
              {[...displayMembers].reverse().map((member, i) => {
                const avatarUrl = member.avatar_url;
                const name = member.name || "Member";
                
                return (
                  <div key={member.user_id || i} className="relative z-10 first:ml-0 -ml-4">
                    {avatarUrl ? (
                      <img 
                        src={avatarUrl}
                        className="w-8 h-8 rounded-full border-2 border-white object-cover shadow-sm"
                        alt={name}
                      />
                    ) : (
                      <div className={`flex items-center justify-center w-8 h-8 rounded-full border-2 border-white text-[10px] font-bold text-white shadow-sm ${
                        i % 3 === 0 ? 'bg-blue-400' : i % 3 === 1 ? 'bg-orange-400' : 'bg-emerald-400'
                      }`}>
                        {name.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex items-center justify-center w-8 h-8 rounded-full border-2 border-slate-200 bg-slate-50 text-slate-400 shadow-sm mb-1">
              <Users size={16} />
            </div>
          )}

          {/* Member Count Label aligned right */}
          <div className="text-xs md:text-sm text-gray-500 mt-1">
            {group.member_count} Members
          </div>
        </div>
      </div>

      <div className="col-span-1 md:col-span-2 flex justify-between items-center mt-2.5 md:mt-4 z-10">
        <div className="flex items-center">
          {/* Admin Pending Badge - Bottom Left */}
          {group.membershipRole === 'admin' && group.pendingCount > 0 && (
            <div className="flex items-center gap-1.5 px-5 py-1.5 bg-sky-100 text-sky-700 border border-sky-200 rounded-lg shadow-sm animate-bounce z-10">
              <span className="text-[10px] font-black uppercase tracking-wider">{group.pendingCount} Request{group.pendingCount > 1 ? 's' : ''}</span>
            </div>
          )}
        </div>

        <div className="flex gap-2 ml-auto">
          {group.isMember ? (
            <div className="flex gap-1.5">
              <button 
                onClick={handleEnterGroup}
                disabled={isEntering}
                className={`inline-flex items-center justify-center w-max px-5 h-10 bg-white text-gray-900 border border-gray-200 rounded-lg font-medium text-sm hover:bg-gray-50 transition-all shadow-sm whitespace-nowrap gap-2 ${isEntering ? 'animate-btn-loading' : ''}`}
              >
                {isEntering ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>{"\u00A0"}Entering...{"\u00A0"}</span>
                  </>
                ) : (
                  <>
                    <span>{"\u00A0"}Enter{"\u00A0"}</span>
                    <ChevronRight size={16} />
                  </>
                )}
              </button>
            </div>
          ) : isPending ? (
            <button 
              disabled
              className="inline-flex items-center justify-center w-max px-5 h-10 bg-gray-100 text-gray-400 border border-gray-200 rounded-lg font-medium text-sm cursor-not-allowed whitespace-nowrap gap-2"
            >
              Request Sent
            </button>
          ) : isPublic ? (
            <button 
              onClick={() => onAction(group)}
              className="inline-flex items-center justify-center w-max px-5 h-10 bg-blue-950 text-white rounded-lg font-medium text-sm hover:bg-blue-900 transition-all shadow-sm whitespace-nowrap"
            >
              Join Group
            </button>
          ) : (
            <button 
              onClick={() => onAction(group)}
              className="inline-flex items-center justify-center w-max px-5 h-10 bg-[#FAEADB] text-orange-900 hover:brightness-95 border border-transparent rounded-lg font-medium text-sm transition-all shadow-sm whitespace-nowrap"
            >
              Ask to Join
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
