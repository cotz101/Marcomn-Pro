'use client';

import { ArrowLeft, Users, Globe, Lock } from 'lucide-react';
import Link from 'next/link';
import { use } from 'react';
import GroupDiscussionFeed from '@/src/components/groups/GroupDiscussionFeed';

// Mock group data — in production this would be fetched from Supabase
const MOCK_GROUPS = {
  '1': { name: 'Deck Officers Association', privacy_type: 'public', member_count: '12,405', description: 'The global community for Bridge Officers.' },
  '2': { name: 'Maritime Green Tech Forum', privacy_type: 'public', member_count: '8,112', description: 'Dedicated to the future of sustainable shipping.' },
  '3': { name: 'Offshore Wind Operations', privacy_type: 'private', member_count: '3,450', description: 'A technical group for crew and engineers working on SOVs.' },
  '4': { name: 'Chartering & Broking Network', privacy_type: 'private', member_count: '5,920', description: 'Commercial maritime professionals.' },
  '5': { name: 'Maritime Safety & Compliance', privacy_type: 'public', member_count: '15,200', description: 'A critical hub for discussing vetting and inspections.' },
};

export default function GroupDiscussionPage({ params }) {
  const { groupId } = use(params);
  const group = MOCK_GROUPS[groupId] || {
    name: `Group #${groupId}`,
    privacy_type: 'public',
    member_count: '—',
    description: 'Maritime community group.',
  };
  const isPublic = group.privacy_type === 'public';

  return (
    <div className="w-full max-w-full overflow-x-hidden px-[14.5px] sm:px-4 md:px-0">
      {/* Group Header Card */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-5">
        {/* Banner */}
        <div className="h-24 bg-gradient-to-r from-[#002b4e] via-[#0a4b8a] to-[#1a6bb5] relative">
          <div className="absolute inset-0 opacity-10"
            style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'0.4\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")' }}
          />
        </div>
        
        {/* Group Meta */}
        <div className="px-4 pb-4 pt-3">
          {/* Back Navigation — Own Row */}
          <Link href="/groups">
            <button className="flex items-center gap-1.5 px-4 py-2 mb-3 text-xs font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              <ArrowLeft size={14} />
              <span>{"\u00A0"}Directory{"\u00A0"}</span>
            </button>
          </Link>

          {/* Title + Badge */}
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold text-[#002b4e] leading-tight">{group.name}</h1>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
              isPublic 
                ? 'bg-green-100 text-green-700 border-green-200' 
                : 'bg-orange-100 text-orange-700 border-orange-200'
            }`}>
              {isPublic ? <Globe size={9} /> : <Lock size={9} />}
              {isPublic ? 'Public' : 'Private'}
            </span>
          </div>

          {/* Member Count */}
          <div className="flex items-center gap-1 mt-1 text-xs text-gray-500">
            <Users size={13} />
            <span>{group.member_count} Members</span>
          </div>
        </div>
      </div>

      {/* Discussion Feed — mt-10 gap from header */}
      <div className="mt-10">
        <GroupDiscussionFeed groupId={groupId} />
      </div>
    </div>
  );
}
