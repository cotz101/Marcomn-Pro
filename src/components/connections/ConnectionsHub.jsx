'use client';

import { useState } from 'react';
import DiscoveryGrid from './DiscoveryGrid';
import { UserPlus, Users, Link as LinkIcon, Mail } from 'lucide-react';

export default function ConnectionsHub() {
  const [activeTab, setActiveTab] = useState('discovery');

  const tabs = [
    { id: 'discovery', label: 'Discovery', icon: UserPlus },
    { id: 'connections', label: 'Connections', icon: Users },
    { id: 'following', label: 'Following', icon: LinkIcon },
    { id: 'invitations', label: 'Invitations', icon: Mail },
  ];

  return (
    <div className="connections-hub" style={{ paddingBottom: '100px' }}>
      <div className="connections-header card mb-6" style={{ padding: '0' }}>
        <h1 className="text-xl font-bold px-4 md:px-6 pt-6">Professional Network</h1>
        <div className="flex gap-6 px-4 md:px-6 py-4 border-b overflow-x-auto no-scrollbar">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 pb-2 transition-all whitespace-nowrap border-b-2 ${
                activeTab === tab.id 
                ? 'border-[#002b4e] text-[#002b4e] font-bold' 
                : 'border-transparent text-gray-500 hover:text-gray-700 font-medium'
              }`}
            >
              <tab.icon size={18} />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="connections-content">
        {activeTab === 'discovery' && <DiscoveryGrid />}
        {activeTab === 'connections' && (
          <div className="card p-12 text-center text-gray-500">
            <div className="flex justify-center mb-4"><Users size={48} className="text-gray-300" /></div>
            <h3 className="text-lg font-bold text-gray-700 mb-2">My Network</h3>
            <p>You haven't built any direct connections yet. Start by discovering maritime professionals.</p>
            <button onClick={() => setActiveTab('discovery')} className="btn-primary mt-6 mx-auto block">Find Professionals</button>
          </div>
        )}
        {activeTab === 'following' && (
          <div className="card p-12 text-center text-gray-500">
            <div className="flex justify-center mb-4"><LinkIcon size={48} className="text-gray-300" /></div>
            <h3 className="text-lg font-bold text-gray-700 mb-2">Following</h3>
            <p>You aren't following anyone yet. People you follow will appear here.</p>
          </div>
        )}
        {activeTab === 'invitations' && (
          <div className="card p-12 text-center text-gray-500">
            <div className="flex justify-center mb-4"><Mail size={48} className="text-gray-300" /></div>
            <h3 className="text-lg font-bold text-gray-700 mb-2">Invitations</h3>
            <p>Your connection requests and invitations will appear here. Stay connected!</p>
          </div>
        )}
      </div>
    </div>
  );
}
