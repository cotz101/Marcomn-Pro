'use client';

import { Search } from 'lucide-react';

export const TABS = [
  { id: 'All', label: 'All' },
  { id: 'Applied', label: 'Applied' },
  { id: 'Review', label: 'Review' },
  { id: 'Shortlisted', label: 'Shortlisted' },
  { id: 'Accepted', label: 'Accepted' },
  { id: 'Active', label: 'Active' },
  { id: 'Completed', label: 'Completed' },
  { id: 'Cancelled', label: 'Cancelled' },
];

export function getApplicationCategory(app) {
  if (!app) return 'Applied';
  const appStatus = (app.status || '').trim();
  const orderArray = Array.isArray(app.job_orders) ? app.job_orders : [app.job_orders].filter(Boolean);
  const order = orderArray[0];
  const orderStatus = (order?.status || '').trim();

  // Completed engagement check
  if (appStatus === 'Accepted' && orderStatus === 'Completed') {
    return 'Completed';
  }

  // Active engagement check
  if (
    appStatus === 'Accepted' && 
    (orderStatus === 'Active' || 
     orderStatus === 'Work Completed by Applicant' || 
     orderStatus === 'Completion Confirmed by Company' || 
     orderStatus === 'Payment Confirmed by Applicant')
  ) {
    return 'Active';
  }

  // Accepted (Offer accepted)
  if (appStatus.toLowerCase() === 'accepted') {
    return 'Accepted';
  }

  // Shortlisted
  if (appStatus.toLowerCase() === 'shortlisted') {
    return 'Shortlisted';
  }

  // Review
  if (
    appStatus.toLowerCase() === 'review' || 
    appStatus.toLowerCase() === 'under review' || 
    appStatus.toLowerCase() === 'reviewing' ||
    appStatus.toLowerCase() === 'in_review'
  ) {
    return 'Review';
  }

  // Cancelled / Withdrawn / Rejected
  if (
    appStatus.toLowerCase().includes('cancel') || 
    appStatus.toLowerCase() === 'withdrawn' || 
    appStatus.toLowerCase() === 'rejected'
  ) {
    return 'Cancelled';
  }

  // Applied / Pending default
  return 'Applied';
}

export default function ApplicationStatusTabs({ 
  selectedStatus, 
  onSelectStatus, 
  searchTerm, 
  onSearchChange, 
  applications = [] 
}) {
  // Compute counts for all status categories dynamically based on loaded applications dataset
  const counts = applications.reduce((acc, app) => {
    acc.All = (acc.All || 0) + 1;
    const cat = getApplicationCategory(app);
    acc[cat] = (acc[cat] || 0) + 1;
    return acc;
  }, { All: 0, Applied: 0, Review: 0, Shortlisted: 0, Accepted: 0, Active: 0, Completed: 0, Cancelled: 0 });

  return (
    <div className="flex flex-col gap-4 mb-6">
      {/* Search Bar (Future-ready layout for additional filter dropdowns) */}
      <div className="flex flex-col sm:flex-row items-center gap-3 w-full">
        <div className="relative flex-1 w-full">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search by job title, company, or location..."
            className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900 transition-all shadow-xs"
          />
        </div>
      </div>

      {/* Horizontally Scrollable Pill Tabs */}
      <div className="w-full overflow-x-auto no-scrollbar scrollbar-none py-1 -my-1">
        <div className="flex items-center gap-2 whitespace-nowrap min-w-max">
          {TABS.map((tab) => {
            const isSelected = selectedStatus === tab.id;
            const count = counts[tab.id] || 0;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onSelectStatus(tab.id)}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer select-none outline-none focus:outline-none ${
                  isSelected
                    ? 'bg-[#0e2a4d] text-white shadow-sm ring-1 ring-[#0e2a4d]'
                    : 'bg-gray-100 hover:bg-gray-200/80 text-gray-700 hover:text-gray-900 border border-transparent'
                }`}
              >
                <span>{tab.label}</span>
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                  isSelected 
                    ? 'bg-white/20 text-white' 
                    : 'bg-gray-200/80 text-gray-600'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
