'use client';

import { Info, ExternalLink, Briefcase } from 'lucide-react';
import Link from 'next/link';

export default function SidebarRight() {
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

  return (
    <aside className="sidebar-right">
      <div className="card p-4 mb-6">
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
          <Link href="/blog" className="text-xs font-bold text-[#004173] mt-2 hover:underline">
            View all blogs
          </Link>
        </div>
      </div>

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
