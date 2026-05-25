'use client';

import { useState } from 'react';
import DiscoveryGrid from './DiscoveryGrid';
import { UserPlus, Users, Link as LinkIcon, Mail, Search } from 'lucide-react';

export default function ConnectionsHub() {
  const [activeTab, setActiveTab] = useState('discovery');
  const [searchTerm, setSearchTerm] = useState('');

  const tabs = [
    { id: 'discovery', label: 'Discover', icon: UserPlus },
    { id: 'following', label: 'Following', icon: LinkIcon },
  ];

  return (
    <div className="connections-hub mx-auto w-full max-w-7xl px-4 py-4 md:py-8" style={{ paddingBottom: '100px' }}>
      
      {/* Sticky Search Bar */}
      <div className="sticky top-0 z-40 bg-[#f4f7f6]/90 backdrop-blur-md pt-2 pb-4 mb-4 -mx-4 px-4 md:mx-0 md:px-0 w-full block">
          <div className="relative w-full max-w-full min-w-[300px]">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input 
              type="text" 
              placeholder="Search Connections..." 
              className="w-full flex-grow bg-white border border-gray-200 text-gray-800 text-sm rounded-xl pl-12 pr-4 py-3 focus:ring-2 focus:ring-[#002b4e] focus:border-transparent outline-none transition-all shadow-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
      </div>

      <div className="w-full">
          <div className="flex gap-8 border-b border-gray-200 overflow-x-auto no-scrollbar mb-6 w-full">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 pb-3 transition-all whitespace-nowrap border-b-2 -mb-[1px] ${
                  activeTab === tab.id 
                  ? 'border-[#002b4e] text-[#002b4e] font-bold' 
                  : 'border-transparent text-gray-500 hover:text-gray-700 font-medium'
                }`}
              >
                <tab.icon size={18} />
                <span className="text-sm uppercase tracking-wider">{tab.label}</span>
              </button>
            ))}
          </div>

          <div className="connections-content w-full min-w-0">
            <DiscoveryGrid activeTab={activeTab} searchTerm={searchTerm} />
          </div>
      </div>
    </div>
  );
}
