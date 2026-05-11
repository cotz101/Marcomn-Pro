'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  ChevronLeft, Users, Globe, Lock, 
  Settings, MoreHorizontal, Info
} from 'lucide-react';
import { createClient } from '@/lib/supabase';
import GroupPostFeed from './GroupPostFeed';

export default function GroupPage() {
  const { id: groupId } = useParams();
  const router = useRouter();
  const supabase = createClient();
  const [group, setGroup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('discussion');

  useEffect(() => {
    fetchGroupDetails();
  }, [groupId]);

  const fetchGroupDetails = async () => {
    if (!groupId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('groups')
        .select('*')
        .eq('id', groupId)
        .single();

      if (error) throw error;
      setGroup(data);
    } catch (err) {
      console.error('Error fetching group details:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-slate-400">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
        <p className="text-sm italic">Loading group voyage...</p>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="text-center py-20">
        <h2 className="text-xl font-bold text-slate-900">Group not found</h2>
        <button 
          onClick={() => router.push('/groups')}
          className="mt-4 text-blue-600 hover:underline flex items-center gap-1 mx-auto"
        >
          <ChevronLeft size={16} /> Back to Directory
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#f8fafc]">
      {/* Group Header - Standardized Padding */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="px-[22px] py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => router.push('/groups')}
              className="p-2 -ml-2 rounded-full hover:bg-slate-50 text-slate-600 transition-colors"
            >
              <ChevronLeft size={20} />
            </button>
            <div className="flex flex-col">
              <h1 className="text-lg font-bold text-slate-900 leading-tight">{group.name}</h1>
              <div className="flex items-center gap-2 mt-0.5">
                {group.type?.toLowerCase() === 'private' ? (
                  <span className="flex items-center gap-1 text-[10px] font-bold text-orange-600 uppercase tracking-wider">
                    <Lock size={10} /> Private Group
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-[10px] font-bold text-blue-600 uppercase tracking-wider">
                    <Globe size={10} /> Public Group
                  </span>
                )}
                <span className="text-[10px] text-slate-300">•</span>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                  <Users size={10} /> {group.member_count || 0} Members
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="p-2 rounded-lg text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-all">
              <Settings size={20} />
            </button>
            <button className="p-2 rounded-lg text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-all">
              <MoreHorizontal size={20} />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="px-[22px] flex items-center gap-8 border-t border-slate-50">
          <button 
            onClick={() => setActiveTab('discussion')}
            className={`py-3 text-xs font-bold uppercase tracking-widest transition-all relative ${
              activeTab === 'discussion' ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            Discussion
            {activeTab === 'discussion' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full" />
            )}
          </button>
          <button 
            onClick={() => setActiveTab('about')}
            className={`py-3 text-xs font-bold uppercase tracking-widest transition-all relative ${
              activeTab === 'about' ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            About
            {activeTab === 'about' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full" />
            )}
          </button>
          <button 
            onClick={() => setActiveTab('members')}
            className={`py-3 text-xs font-bold uppercase tracking-widest transition-all relative ${
              activeTab === 'members' ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            Members
            {activeTab === 'members' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full" />
            )}
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 px-[22px] py-6 max-w-full overflow-x-hidden">
        {activeTab === 'discussion' && (
          <GroupPostFeed groupId={groupId} />
        )}
        
        {activeTab === 'about' && (
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Info size={16} className="text-blue-600" /> About this community
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed italic">
              {group.description || 'No description provided for this group.'}
            </p>
          </div>
        )}

        {activeTab === 'members' && (
          <div className="text-center py-10 text-slate-400 italic text-sm">
            Member directory coming soon...
          </div>
        )}
      </div>
      <button 
        onClick={() => router.push('/groups')}
        className="fixed top-24 left-4 z-40 bg-white p-2 rounded-full border border-gray-200 shadow-sm hover:bg-gray-50 md:hidden"
      >
        <ChevronLeft size={20} className="text-gray-600" />
      </button>
    </div>
  );
}
