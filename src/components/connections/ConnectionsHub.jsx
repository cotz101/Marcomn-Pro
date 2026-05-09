'use client';

import { useState } from 'react';
import DiscoveryGrid from './DiscoveryGrid';
import { UserPlus, Users, Link as LinkIcon, Mail } from 'lucide-react';

export default function ConnectionsHub() {
  const [activeTab, setActiveTab] = useState('discovery');

  const tabs = [
    { id: 'discovery', label: 'Discover', icon: UserPlus },
    { id: 'following', label: 'Following', icon: LinkIcon },
  ];

  return (
    <div className="connections-hub mx-auto w-full max-w-full px-4" style={{ paddingBottom: '100px' }}>
      <div className="connections-header card mb-6" style={{ padding: '0', background: 'transparent', boxShadow: 'none', border: 'none' }}>
        <h1 className="text-xl font-bold pt-6 pb-2" style={{ color: '#002b4e' }}>Professional Network</h1>
        <div className="flex gap-8 py-4 border-b overflow-x-auto no-scrollbar">
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

      <div className="connections-content">
        <DiscoveryGrid activeTab={activeTab} />
      </div>
    </div>
  );
}
