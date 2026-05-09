'use client';

import { Search, ChevronDown, CheckCircle2 } from 'lucide-react';

export default function TalentFilterSidebar() {
  const ranks = [
    'Master Mariner',
    'Chief Officer',
    'Second Officer',
    'Chief Engineer',
    'Second Engineer',
    'ETO',
    'Bosun',
    'Able Seaman'
  ];

  const vesselTypes = [
    'Tanker',
    'Bulker',
    'Container',
    'Offshore',
    'Cruise',
    'LNG/LPG'
  ];

  return (
    <div className="talent-filters flex flex-col gap-6">
      {/* Search Focus */}
      <div className="filter-group">
        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 block">Search Talent</label>
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input 
            type="text"
            placeholder="Name, skills, or vessel..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-900/10 focus:border-blue-900 transition-all"
          />
        </div>
      </div>

      {/* Availability */}
      <div className="filter-group">
        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 block">Availability</label>
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-3 p-2 rounded-lg hover:bg-white cursor-pointer transition-colors border border-transparent hover:border-slate-100 group">
            <input type="radio" name="availability" className="accent-blue-900 w-4 h-4" defaultChecked />
            <span className="text-sm text-slate-700 group-hover:text-blue-900">Immediate Availability</span>
          </label>
          <label className="flex items-center gap-3 p-2 rounded-lg hover:bg-white cursor-pointer transition-colors border border-transparent hover:border-slate-100 group">
            <input type="radio" name="availability" className="accent-blue-900 w-4 h-4" />
            <span className="text-sm text-slate-600 group-hover:text-blue-900">Busy / On-Contract</span>
          </label>
        </div>
      </div>

      {/* Rank Dropdown */}
      <div className="filter-group">
        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 block">Rank / Role</label>
        <div className="relative">
          <select className="w-full appearance-none bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-900 cursor-pointer">
            <option value="">Select Rank</option>
            {ranks.map(rank => (
              <option key={rank} value={rank}>{rank}</option>
            ))}
          </select>
          <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        </div>
      </div>

      {/* Vessel Experience */}
      <div className="filter-group">
        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 block">Vessel Experience</label>
        <div className="grid grid-cols-1 gap-2">
          {vesselTypes.map(type => (
            <label key={type} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white cursor-pointer transition-colors border border-transparent hover:border-slate-100 group">
              <input type="checkbox" className="accent-blue-900 w-4 h-4 rounded" />
              <span className="text-sm text-slate-600 group-hover:text-blue-900">{type}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Experience Level */}
      <div className="filter-group">
        <div className="flex justify-between items-center mb-3">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block">Min. Experience</label>
          <span className="text-xs font-bold text-blue-900">5+ Years</span>
        </div>
        <input 
          type="range" 
          min="0" 
          max="30" 
          step="1"
          className="w-full accent-blue-900 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer"
        />
        <div className="flex justify-between mt-2">
          <span className="text-[10px] text-slate-400 font-medium">0</span>
          <span className="text-[10px] text-slate-400 font-medium">30+</span>
        </div>
      </div>

      {/* Reset Button */}
      <button className="mt-4 text-xs font-bold text-[#002b4e] hover:underline transition-all">
        RESET ALL FILTERS
      </button>
    </div>
  );
}
