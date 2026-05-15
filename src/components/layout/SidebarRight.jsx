'use client';

import { Info, ExternalLink, Briefcase, TrendingUp, Sparkles, ThumbsUp, Share2 } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function SidebarRight() {
  const pathname = usePathname();
  const isGroupsPage = pathname === '/groups';
  const isGroupDiscussionPage = pathname?.startsWith('/groups/') && pathname !== '/groups';
  const isMBlogPage = pathname?.startsWith('/mblog');

  const recentBlogs = [
    { id: 1, title: 'Sustainable Shipping in 2026', author: 'Capt. Sarah Miller', date: '2 days ago' },
    { id: 2, title: 'The Future of Autonomous Vessels', author: 'TechMaritime', date: '1 week ago' },
    { id: 3, title: 'Global Port Congestion Trends', author: 'Logistics Daily', date: '3 days ago' },
  ];

  const recentJobs = [
    { id: 1, title: 'Chief Engineer', company: 'Maersk Line', location: 'Singapore' },
    { id: 2, title: 'Port Operations Manager', company: 'DP World', location: 'Dubai' },
    { id: 3, title: 'Maritime Safety Officer', company: 'Lloyd\'s Register', location: 'London' },
  ];

  const activeGroups = [
    { id: 1, name: 'Tanker Operations', members: '1.2k', activity: 'High' },
    { id: 2, name: 'Maritime Safety Hub', members: '850', activity: 'High' },
    { id: 3, name: 'Offshore Wind Energy', members: '420', activity: 'Moderate' },
  ];

  const recentGroups = [
    { id: 4, name: 'LNG Carrier Pros', date: 'Created 2 days ago' },
    { id: 5, name: 'Singapore Port Staff', date: 'Created 5 days ago' },
    { id: 6, name: 'Cyber Security at Sea', date: 'Created 1 week ago' },
  ];

  if (isMBlogPage) {
    return (
      <aside className="sidebar-right sticky top-24 hidden lg:block w-[300px]">
        <div className="flex flex-col gap-5">
          {/* Top Most Liked */}
          <div className="card p-4 border border-[#f0f0f0] bg-white rounded-lg shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <div className="p-1.5 bg-blue-50 rounded-md text-blue-600">
                <ThumbsUp size={16} />
              </div>
              <h3 className="font-bold text-sm text-[#0e2a4d]">Top Most Liked</h3>
            </div>
            <div className="flex flex-col gap-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="animate-pulse">
                  <div className="h-3 bg-gray-100 rounded w-full mb-2" />
                  <div className="h-2 bg-gray-50 rounded w-1/2" />
                </div>
              ))}
            </div>
          </div>

          {/* Most Active */}
          <div className="card p-4 border border-[#f0f0f0] bg-white rounded-lg shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <div className="p-1.5 bg-green-50 rounded-md text-green-600">
                <TrendingUp size={16} />
              </div>
              <h3 className="font-bold text-sm text-[#0e2a4d]">Most Active</h3>
            </div>
            <div className="flex flex-col gap-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="animate-pulse">
                  <div className="h-3 bg-gray-100 rounded w-full mb-2" />
                  <div className="h-2 bg-gray-50 rounded w-1/3" />
                </div>
              ))}
            </div>
          </div>

          {/* Most Shared */}
          <div className="card p-4 border border-[#f0f0f0] bg-white rounded-lg shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <div className="p-1.5 bg-purple-50 rounded-md text-purple-600">
                <Share2 size={16} />
              </div>
              <h3 className="font-bold text-sm text-[#0e2a4d]">Most Shared</h3>
            </div>
            <div className="flex flex-col gap-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="animate-pulse">
                  <div className="h-3 bg-gray-100 rounded w-full mb-2" />
                  <div className="h-2 bg-gray-50 rounded w-1/4" />
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 px-2 text-[10px] text-[#727780] flex flex-wrap gap-x-3 gap-y-1 justify-center opacity-60">
            <span>About</span>
            <span>Accessibility</span>
            <span>Help Center</span>
            <span>Privacy & Terms</span>
            <span className="w-full text-center mt-2">MarComn Corporation © 2026</span>
          </div>
        </div>
      </aside>
    );
  }

  return (
    <aside className="sidebar-right sticky top-24 hidden lg:block">
      {isGroupDiscussionPage ? (
        <>
          <div className="card p-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-sm text-[#1b1c1c]">Members Online</h3>
              <span className="flex items-center gap-1 text-[10px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full border border-green-100">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                LIVE
              </span>
            </div>
            <div className="flex flex-col gap-3">
              {[
                { name: 'Capt. Sarah Miller', role: 'Master · MV Pacific Star' },
                { name: 'Engr. Priya Sharma', role: 'Chief Engineer' },
                { name: 'Ana González', role: 'HSEQ Manager' },
                { name: 'Pedro Alvarez', role: 'Safety Officer' },
                { name: 'Johan van Dijk', role: '2nd Officer · Offshore' },
              ].map((m, i) => (
                <div key={i} className="flex items-center gap-2.5 cursor-pointer hover:bg-gray-50 -mx-4 px-4 py-1.5 rounded-md transition-colors">
                  <div className="relative flex-shrink-0">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-[#002b4e] flex items-center justify-center text-white font-bold text-xs">
                      {m.name.charAt(0)}
                    </div>
                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-400 border-2 border-white rounded-full" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#002b4e] truncate">{m.name}</p>
                    <p className="text-[10px] text-[#727780] truncate">{m.role}</p>
                  </div>
                </div>
              ))}
              <Link href="#" className="text-xs font-bold text-[#004173] mt-2 hover:underline">
                View all members
              </Link>
            </div>
          </div>

          <div className="sidebar-spacer" />

          <div className="card p-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-sm text-[#1b1c1c]">Related Groups</h3>
            </div>
            <div className="flex flex-col gap-3">
              {[
                { name: 'Maritime Safety Hub', members: '850' },
                { name: 'Tanker Operations', members: '1.2k' },
                { name: 'STCW Competency Hub', members: '4.5k' },
              ].map((g, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-[#002b4e]">{g.name}</p>
                    <p className="text-[10px] text-gray-400">{g.members} members</p>
                  </div>
                  <button className="text-[10px] font-bold text-[#002b4e] border border-[#002b4e] px-2 py-1 rounded-md hover:bg-blue-50 transition-colors">
                    Join
                  </button>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : isGroupsPage ? (
        <>
          <div className="card p-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-sm text-[#1b1c1c]">Most Active Groups</h3>
              <TrendingUp size={14} className="text-[#42474f]" />
            </div>
            <div className="flex flex-col gap-4">
              {activeGroups.map(group => (
                <div key={group.id} className="group cursor-pointer">
                  <h4 className="text-sm font-semibold text-[#002b4e] group-hover:underline">
                    {group.name}
                  </h4>
                  <p className="text-[11px] text-[#727780] mt-1">{group.members} Members • {group.activity} Activity</p>
                </div>
              ))}
              <Link href="/groups?filter=active" className="text-xs font-bold text-[#004173] mt-2 hover:underline">
                View all active groups
              </Link>
            </div>
          </div>

          <div className="sidebar-spacer"></div>

          <div className="card p-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-sm text-[#1b1c1c]">Recently Created</h3>
              <Sparkles size={14} className="text-[#42474f]" />
            </div>
            <div className="flex flex-col gap-4">
              {recentGroups.map(group => (
                <div key={group.id} className="cursor-pointer hover:bg-[#f5f3f3] -mx-4 px-4 py-2 transition-colors">
                  <p className="text-sm font-semibold text-[#1b1c1c]">{group.name}</p>
                  <p className="text-xs text-[#42474f] mt-1">{group.date}</p>
                </div>
              ))}
              <Link href="/groups?filter=recent" className="text-xs font-bold text-[#004173] mt-2 hover:underline">
                Explore new groups
              </Link>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="card p-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-sm text-[#1b1c1c]">Recent Blog</h3>
              <Info size={14} className="text-[#42474f] cursor-pointer" />
            </div>
            <div className="flex flex-col gap-4">
              {recentBlogs.map(blog => (
                <div key={blog.id} className="group cursor-pointer">
                  <h4 className="text-sm font-semibold text-[#002b4e] group-hover:underline">
                    {blog.title}
                  </h4>
                  <p className="text-[11px] text-[#727780] mt-1">{blog.author} • {blog.date}</p>
                </div>
              ))}
              <Link href="/mblog" className="text-xs font-bold text-[#004173] mt-2 hover:underline">
                View all articles
              </Link>
            </div>
          </div>

          <div className="sidebar-spacer"></div>

          <div className="card p-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-sm text-[#1b1c1c]">Recent Job Postings</h3>
              <Briefcase size={14} className="text-[#42474f]" />
            </div>
            <div className="flex flex-col gap-4">
              {recentJobs.map(job => (
                <div key={job.id} className="cursor-pointer hover:bg-[#f5f3f3] -mx-4 px-4 py-2 transition-colors">
                  <p className="text-sm font-semibold text-[#1b1c1c]">{job.title}</p>
                  <p className="text-xs text-[#42474f] mt-1">{job.company} • {job.location}</p>
                </div>
              ))}
              <Link href="/jobs" className="text-xs font-bold text-[#004173] mt-2 hover:underline">
                View all jobs
              </Link>
            </div>
          </div>
        </>
      )}

      <div className="mt-6 px-2 text-[10px] text-[#727780] flex flex-wrap gap-x-3 gap-y-1 justify-center">
        <span>About</span>
        <span>Accessibility</span>
        <span>Help Center</span>
        <span>Privacy & Terms</span>
        <span className="w-full text-center mt-2">MarComn Corporation © 2026</span>
      </div>
    </aside>
  );
}
