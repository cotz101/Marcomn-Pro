'use client';

import { useState } from 'react';
import { Users, Globe, Lock, ChevronRight, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function GroupCard({ group, onAction }) {
  const isPublic = group.privacy_type === 'public';
  const router = useRouter();
  const [isEntering, setIsEntering] = useState(false);

  const handleEnterGroup = () => {
    setIsEntering(true);
    // Brief loading state before navigation
    setTimeout(() => {
      router.push(`/groups/${group.id}`);
    }, 400);
  };

  return (
    <div className={`w-full bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-md transition-all duration-300 p-4 ${isEntering ? 'opacity-60 scale-[0.98]' : ''}`}>
      <div className="flex gap-4">
        {/* Group Image/Icon */}
        <div className="w-16 h-16 sm:w-20 sm:h-20 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0">
          <Users size={32} className="text-blue-600" />
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

      <div className="flex justify-end w-full mt-4">
        {group.isMember ? (
          <button 
            onClick={handleEnterGroup}
            disabled={isEntering}
            className={`w-fit px-8 py-2.5 bg-white text-[#002b4e] border border-[#002b4e] rounded-lg font-bold text-sm hover:bg-gray-50 transition-all shadow-sm whitespace-nowrap inline-flex items-center justify-center gap-2 ${isEntering ? 'animate-btn-loading' : ''}`}
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
        ) : (
          <button 
            onClick={() => onAction(group.id, isPublic ? 'join' : 'request')}
            className={`w-fit px-8 py-2.5 rounded-lg font-bold text-sm whitespace-nowrap inline-flex items-center justify-center gap-2 transition-all shadow-sm ${
              isPublic 
                ? 'bg-white text-[#002b4e] border border-[#002b4e] hover:bg-gray-50' 
                : 'bg-[#002b4e] text-white border border-transparent hover:bg-[#001f38]'
            }`}
          >
            {isPublic ? 'Join Group' : 'Request Access'}
          </button>
        )}
      </div>
    </div>
  );
}
