'use client';

import { useState } from 'react';
import { Plus, Search } from 'lucide-react';
import GroupCard from './GroupCard';

export default function GroupsDirectory() {
  const [activeTab, setActiveTab] = useState('discover');
  const [displayLimit, setDisplayLimit] = useState(5);
  const [searchTerm, setSearchTerm] = useState('');
  
  const mockGroups = [
    {
      id: 1,
      name: 'Deck Officers Association',
      description: 'The global community for Bridge Officers to share navigation best practices, COLREGs discussions, and career advice.',
      privacy_type: 'public',
      member_count: '12,405',
      isMember: false
    },
    {
      id: 2,
      name: 'Maritime Green Tech Forum',
      description: 'Dedicated to the future of sustainable shipping. Discussing LNG, Ammonia, Hydrogen, and carbon capture technologies.',
      privacy_type: 'public',
      member_count: '8,112',
      isMember: true
    },
    {
      id: 3,
      name: 'Offshore Wind Operations',
      description: 'A technical group for crew and engineers working on SOVs, WTIVs, and subsea operations in the renewables sector.',
      privacy_type: 'private',
      member_count: '3,450',
      isMember: false
    },
    {
      id: 4,
      name: 'Chartering & Broking Network',
      description: 'Commercial maritime professionals discussing market trends, fixtures, and post-fixture operations.',
      privacy_type: 'private',
      member_count: '5,920',
      isMember: false
    },
    {
      id: 5,
      name: 'Maritime Safety & Compliance',
      description: 'A critical hub for discussing vetting, inspections (SIRE/VPC), and building a proactive safety culture at sea.',
      privacy_type: 'public',
      member_count: '15,200',
      isMember: false
    }
  ];

  const handleGroupAction = (id, type) => {
    console.log(`Action ${type} on group ${id}`);
  };

  const filteredGroups = (activeTab === 'discover' 
    ? mockGroups 
    : mockGroups.filter(g => g.isMember)
  ).filter(group => {
    if (!searchTerm.trim()) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      group.name.toLowerCase().includes(searchLower) || 
      group.description.toLowerCase().includes(searchLower)
    );
  });

  const visibleGroups = filteredGroups.slice(0, displayLimit);

  return (
    <div className="flex flex-col w-full max-w-full overflow-x-hidden px-[14.5px] sm:px-4 md:px-0">
        {/* Header Area */}
        <div className="flex flex-col md:flex-row md:justify-between md:items-start w-full mb-6 gap-4">
          <div className="flex flex-col">
            <h1 className="text-2xl font-bold text-[#0e2a4d]">Maritime Groups</h1>
            <p className="text-sm text-gray-500">Connect with specialized maritime communities</p>
          </div>
          <button className="flex items-center justify-center gap-2 px-4 py-2 bg-[#002b4e] text-white rounded-lg font-bold text-sm hover:bg-[#001f38] transition-all shadow-sm">
            <Plus size={18} />
            Create Group
          </button>
        </div>

        {/* Tabs */}
        <div className="bg-white border-b border-gray-200 mb-4 sticky top-0 z-10">
          <div className="flex gap-8">
            <button 
              onClick={() => setActiveTab('discover')}
              className={`pb-4 text-sm font-bold transition-all border-b-2 ${
                activeTab === 'discover' 
                  ? 'border-blue-600 text-blue-600' 
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Discover
            </button>
            <button 
              onClick={() => setActiveTab('my_groups')}
              className={`pb-4 text-sm font-bold transition-all border-b-2 ${
                activeTab === 'my_groups' 
                  ? 'border-blue-600 text-blue-600' 
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              My Groups
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="search-container mb-6" style={{ paddingTop: '0' }}>
          <div className="search-bar-wrapper relative">
            <Search className="search-icon absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={20} />
            <input 
              type="text" 
              placeholder="Search groups by name, rank, or specialty..." 
              className="search-input w-full pl-12 pr-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
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
                onClick={() => { setSearchTerm(''); setActiveTab('discover'); }}
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
    </div>
  );
}
