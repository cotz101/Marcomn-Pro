'use client';

import React from 'react';
import { Plus, Search } from 'lucide-react';

export default function GroupsHeader({ searchTerm, setSearchTerm, onCreateGroupClick }) {
  return (
    <header className="header-container w-full max-w-full px-4 sm:px-0 pt-4 pb-0 mb-4 bg-white flex-shrink-0 flex flex-col gap-4">
      {/* Top Section: Title & Button */}
      <div className="title-button-row flex flex-row justify-between items-center w-full">
        <div className="text-group flex flex-col">
          <h1 className="title text-2xl font-bold text-[#0e2a4d] m-0">Maritime Groups</h1>
          <p className="subtitle text-sm text-[#6b7280] m-0 mt-0.5">Connect with specialized maritime communities</p>
        </div>
        <button 
          onClick={onCreateGroupClick}
          className="action-button flex items-center gap-2 px-4 py-2 bg-[#002b4e] text-white rounded-lg font-bold text-sm hover:bg-[#001f38] transition-all shadow-sm border-none cursor-pointer"
        >
          <Plus size={18} className="icon" />
          Group
        </button>
      </div>

      {/* Search Bar Section */}
      <div className="search-container px-4 sm:px-0 bg-white pb-[10px] pt-0 w-full">
        <div className="search-wrapper relative w-full">
          <Search className="search-icon absolute left-4 top-1/2 -translate-y-1/2 text-[#9ca3af] pointer-events-none" size={20} />
          <input 
            type="text" 
            placeholder="Search groups by name, rank, or specialty..." 
            className="search-input w-full pl-12 pr-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm outline-none"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>
    </header>
  );
}
