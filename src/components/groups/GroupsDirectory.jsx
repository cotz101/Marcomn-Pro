'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Search } from 'lucide-react';
import { createClient } from '@/lib/supabase';
import { useProfile } from '@/app/context/ProfileContext';
import GroupCard from './GroupCard';
import CreateGroupModal from './CreateGroupModal';

export default function GroupsDirectory() {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [displayLimit, setDisplayLimit] = useState(5);
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const router = useRouter();
  const supabase = createClient();
  const { userId } = useProfile();
  const currentUser = { id: userId };

  const fetchGroups = async () => {
    setLoading(true);
    try {
      // Fetch all groups with real member count
      const { data: allGroups, error: groupsError } = await supabase
        .from('groups')
        .select('id, name, description, type, owner_id, group_members(count)')
        .order('created_at', { ascending: false });

      if (groupsError) throw groupsError;

      let userMemberships = [];
      if (currentUser.id) {
        const { data: memberships } = await supabase
          .from('group_members')
          .select('group_id, status, role')
          .eq('user_id', currentUser.id);
        userMemberships = memberships || [];
      }

      const groupsWithMembership = allGroups.map(group => {
        const membership = userMemberships.find(m => m.group_id === group.id);
        const isAccepted = !!membership && (
          membership.status === 'member' || 
          membership.role === 'admin' || 
          membership.role === 'moderator'
        );

        return {
          ...group,
          isMember: isAccepted,
          membershipStatus: membership?.status,
          membershipRole: membership?.role,
          member_count: group.group_members?.[0]?.count || 0
        };
      });

      setGroups(groupsWithMembership);
    } catch (err) {
      console.error('Error fetching groups:', err.message || JSON.stringify(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGroups();
  }, [currentUser.id]);

  const handleGroupAction = async (group) => {
    if (!currentUser.id) {
      alert('Please sign in to join groups.');
      return;
    }

    const isPrivate = group.type?.toLowerCase() === 'private';

    if (isPrivate) {
      // PRIVATE FLOW: Request Access (Status: pending)
      const { error } = await supabase.from('group_members').insert({ 
        group_id: group.id, 
        user_id: currentUser.id, 
        role: 'member', 
        status: 'pending' 
      });
      if (!error) {
        alert('Request sent to admin.');
        fetchGroups(); // Refresh UI
      } else {
        console.error('Error joining group:', error);
      }
    } else {
      // PUBLIC FLOW: Immediate Join (Status: member)
      const { error } = await supabase.from('group_members').insert({ 
        group_id: group.id, 
        user_id: currentUser.id, 
        role: 'member', 
        status: 'member' 
      });
      if (!error) {
        router.push(`/groups/${group.id}`);
      } else {
        console.error('Error joining group:', error);
      }
    }
  };

  const filteredGroups = groups.filter(group => {
    if (!searchTerm.trim()) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      group.name.toLowerCase().includes(searchLower) || 
      (group.description && group.description.toLowerCase().includes(searchLower))
    );
  });

  const visibleGroups = filteredGroups.slice(0, displayLimit);

  return (
    <div className="flex flex-col w-full max-w-full overflow-x-hidden px-4 md:px-0">
        {/* Header Area */}
        <div className="flex flex-col md:flex-row md:justify-between md:items-start w-full mb-6 gap-4">
          <div className="flex flex-col">
            <h1 className="text-2xl font-bold text-[#0e2a4d]">Maritime Groups</h1>
            <p className="text-sm text-gray-500">Connect with specialized maritime communities</p>
          </div>
          <button 
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-[#002b4e] text-white rounded-lg font-bold text-sm hover:bg-[#001f38] transition-all shadow-sm"
          >
            <Plus size={18} />
            Create Group
          </button>
        </div>

        {/* Search Bar */}
        <div className="search-container mb-6" style={{ paddingTop: '0' }}>
          <div className="search-bar-wrapper relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input 
              type="text" 
              placeholder="Search groups by name, rank, or specialty..." 
              className="search-input w-full pl-12 pr-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Group Feed */}
        <div className="space-y-4 w-full">
          {visibleGroups.length > 0 ? (
            visibleGroups.map(group => (
              <GroupCard 
                key={group.id} 
                group={group} 
                onAction={handleGroupAction} 
              />
            ))
          ) : (
            <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-300">
              <p className="text-gray-500 font-medium">No groups found.</p>
              <button 
                onClick={() => { setSearchTerm(''); }}
                className="mt-2 text-sm font-bold text-blue-600 hover:underline"
              >
                Clear filters
              </button>
            </div>
          )}
          
          {displayLimit < filteredGroups.length && (
            <div className="pt-2 pb-20">
              <button 
                onClick={() => setDisplayLimit(prev => prev + 5)} 
                className="w-full py-4 mt-4 border border-gray-200 rounded-lg text-gray-600 font-medium hover:bg-gray-50 transition-all flex items-center justify-center"
              >
                Show More
              </button>
            </div>
          )}
        </div>

        <CreateGroupModal 
          isOpen={isCreateModalOpen} 
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={() => {
            setIsCreateModalOpen(false);
            fetchGroups();
          }}
        />
    </div>
  );
}
