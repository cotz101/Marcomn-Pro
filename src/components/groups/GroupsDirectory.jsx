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
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const router = useRouter();
  const supabase = createClient();
  const { userId } = useProfile();
  const currentUser = { id: userId };

  const fetchGroups = async (isInitial = true) => {
    setLoading(true);
    try {
      const limit = 6;
      const start = isInitial ? 0 : 6 + (page * 6);
      const end = start + limit - 1;

      // Step 1: Fetch groups first
      const { data: fetchedGroups, error: groupsError } = await supabase
        .from('groups')
        .select('id, name, description, type, owner_id, group_members(count)')
        .order('created_at', { ascending: false })
        .range(start, end);

      if (groupsError) throw groupsError;
      if (!fetchedGroups) return;

      // Step 2: Fetch memberships for the current user
      let userMemberships = [];
      if (currentUser.id) {
        const { data: memberships } = await supabase
          .from('group_members')
          .select('group_id, status, role')
          .eq('user_id', currentUser.id);
        userMemberships = memberships || [];
      }

      // Step 3: Fetch group members' profiles for the avatar stack
      const groupIds = fetchedGroups.map(g => g.id);
      const { data: membersData } = await supabase
        .from('group_members')
        .select(`
          group_id,
          profiles:user_id (
            id,
            name,
            avatar_url
          )
        `)
        .in('group_id', groupIds)
        .eq('status', 'member');

      const membersByGroup = (membersData || []).reduce((acc, curr) => {
        if (!acc[curr.group_id]) acc[curr.group_id] = [];
        if (curr.profiles) acc[curr.group_id].push(curr.profiles);
        return acc;
      }, {});

      // Step 4: Merge everything
      const groupsWithMembership = fetchedGroups.map(group => {
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
          member_count: group.group_members?.[0]?.count || 0,
          members: membersByGroup[group.id] || []
        };
      });

      if (isInitial) {
        setGroups(groupsWithMembership);
        setPage(0);
      } else {
        setGroups(prev => [...prev, ...groupsWithMembership]);
        setPage(prev => prev + 1);
      }

      setHasMore(fetchedGroups.length === limit);
    } catch (err) {
      console.error('Error fetching groups:', err.message || JSON.stringify(err));
    } finally {
      setLoading(false);
    }
  };

  const handleLoadMore = () => {
    fetchGroups(false);
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

  const GroupSkeleton = () => (
    <div className="w-full bg-white rounded-xl border border-gray-100 p-4 animate-pulse">
      <div className="flex gap-4">
        <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gray-200 rounded-lg flex-shrink-0" />
        <div className="flex-1 space-y-3 py-1">
          <div className="h-4 bg-gray-200 rounded w-1/3" />
          <div className="space-y-2">
            <div className="h-3 bg-gray-200 rounded w-full" />
            <div className="h-3 bg-gray-200 rounded w-5/6" />
          </div>
          <div className="h-3 bg-gray-200 rounded w-1/4" />
        </div>
      </div>
      <div className="flex justify-end mt-4">
        <div className="h-10 bg-gray-200 rounded-lg w-32" />
      </div>
    </div>
  );

  return (
    <div className="relative w-full max-w-full h-screen overflow-x-hidden flex flex-col">
      {/* Fixed Header & Search Area */}
      <div className="w-full max-w-full pt-4 pb-2 bg-white flex-shrink-0">
        <div className="flex flex-col md:flex-row md:justify-between md:items-start w-full mb-4 gap-4">
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
        <div className="search-container mb-2" style={{ paddingTop: '0' }}>
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
      </div>

      {/* Scrollable Zone */}
      <div className="flex-1 w-full overflow-y-auto overflow-x-hidden [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        <div className="space-y-4 w-full">
          {loading && groups.length === 0 ? (
            // Skeletal Loading state (4 cards)
            <>
              <GroupSkeleton />
              <GroupSkeleton />
              <GroupSkeleton />
              <GroupSkeleton />
            </>
          ) : filteredGroups.length > 0 ? (
            filteredGroups.map(group => (
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
          
          {hasMore && !searchTerm && (
            <div className="pt-2 flex justify-center w-full">
              <button 
                onClick={handleLoadMore} 
                className="w-full py-4 mt-4 border border-gray-200 rounded-lg text-gray-600 font-medium hover:bg-gray-50 transition-all flex items-center justify-center bg-white"
              >
                Show more groups
              </button>
            </div>
          )}
        </div>

        {/* Force-Up Spacer */}
        <div className="h-[100px] w-full" aria-hidden="true" />

        <CreateGroupModal 
          isOpen={isCreateModalOpen} 
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={() => {
            setIsCreateModalOpen(false);
            fetchGroups();
          }}
        />
      </div>
    </div>
  );
}
