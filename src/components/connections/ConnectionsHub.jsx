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
    <div className="connections-hub mx-auto w-full max-w-full px-4" style={{ paddingBottom: '100px' }}>
      <div className="connections-header bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6 flex flex-col gap-4 w-full">
        <h1 className="text-xl font-bold" style={{ color: '#002b4e' }}>Professional Network</h1>
        
        <div className="search-container" style={{ padding: '0' }}>
          <div className="search-bar-wrapper">
            <Search className="search-icon" size={20} />
            <input 
              type="text" 
              placeholder="Search by name, rank, or specialty..." 
              className="search-input"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="flex gap-8 border-b overflow-x-auto no-scrollbar mt-2">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 pb-3 transition-all whitespace-nowrap border-b-2 -mb-[1px] ${
                activeTab === tab.id 
                ? 'border-blue-900 text-blue-900 font-medium' 
                : 'border-transparent text-gray-500 hover:text-gray-700 font-medium'
              }`}
            >
              <tab.icon size={18} />
              <span className="text-sm uppercase tracking-wider">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="connections-content w-full">
        <DiscoveryGrid activeTab={activeTab} searchTerm={searchTerm} />
      </div>
    </div>
  );
}
