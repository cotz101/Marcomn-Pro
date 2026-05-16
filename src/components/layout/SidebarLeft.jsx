'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  Ship, 
  Users, 
  UserPlus, 
  Search, 
  Lightbulb, 
  Handshake, 
  FileText, 
  Send,
  BarChart2,
  Library,
  BookOpen,
  TrendingUp,
  Award
} from 'lucide-react';
import { useProfile } from '@/app/context/ProfileContext';

export default function SidebarLeft() {
  const pathname = usePathname();
  const { profile, currentIdentity } = useProfile();
  
  const isCompany = currentIdentity?.type === 'company';
  const name = isCompany ? currentIdentity.data?.name : profile?.fullName;
  const image = isCompany ? (currentIdentity.data?.logo_url || '/company_placeholder.png') : (profile?.profilePic || '/profile_pic.png');
  const headline = isCompany ? 'Maritime Enterprise' : (profile?.headline || 'Maritime Professional');

  let navLinks = [];
  let sidebarTitle = "Manage MNetwork";
  let showStats = true;
  let statsLabel1 = "Profile viewers";
  let statsValue1 = "42";
  let statsLabel2 = "Post impressions";
  let statsValue2 = "1.2k";

  if (pathname?.includes('/services')) {
    sidebarTitle = "Manage MServices";
    navLinks = [
      { name: 'Opportunity', href: '/services', icon: Lightbulb },
      { name: 'Partners', href: '/partners', icon: Handshake },
      { name: 'My Job Posting', href: '/jobs/my-postings', icon: FileText },
      { name: 'My Job Application', href: '/jobs/my-applications', icon: Send },
    ];
    statsLabel1 = "Active Jobs";
    statsValue1 = "12";
    statsLabel2 = "New Applicants";
    statsValue2 = "48";
  } else if (pathname?.includes('/mblog')) {
    sidebarTitle = "Manage my insights";
    navLinks = [
      { name: 'All Articles', href: '/mblog?view=all', icon: Library },
      { name: 'My Articles', href: '/mblog?view=my', icon: BookOpen },
    ];
    showStats = false; // Will show Contributors instead
  } else {
    // Default: MNetwork
    navLinks = [
      { name: 'Logbook', href: '/logbook', icon: Ship },
      { name: 'Connections', href: '/connections', icon: UserPlus },
      { name: 'Groups', href: '/groups', icon: Users },
      { name: 'Talent', href: '/talent', icon: Search },
    ];
  }

  return (
    <aside className="sidebar-left">
      <div className="card overflow-hidden">
        <div className="h-16 bg-[#002b4e]"></div>
        <div className="px-4 pb-4">
          <div className="flex justify-center -mt-8 mb-3">
            <img 
              src={image} 
              alt={name} 
              className="w-16 h-16 rounded-lg border-2 border-white object-cover bg-white"
            />
          </div>
          <div className="text-center">
            <h3 className="font-bold text-base text-[#1b1c1c]">{name}</h3>
            <p className="text-xs text-[#42474f] mt-1">{headline}</p>
          </div>
          
          {showStats && (
            <div className="border-t border-[#efeded] mt-4 pt-4 flex flex-col gap-3">
              <div className="flex justify-between items-center text-xs">
                <span className="text-[#42474f]">{statsLabel1}</span>
                <span className="font-semibold text-[#002b4e]">{statsValue1}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-[#42474f]">{statsLabel2}</span>
                <span className="font-semibold text-[#002b4e]">{statsValue2}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="sidebar-spacer"></div>

      <div className="card">
        <div className="px-4 py-3 border-bottom border-[#efeded]">
          <h4 className="text-xs font-bold uppercase tracking-wider text-[#42474f]">{sidebarTitle}</h4>
        </div>
        <nav className="flex flex-col">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive = pathname === link.href;
            return (
              <Link 
                key={link.name}
                href={link.href} 
                className={`flex items-center gap-3 px-4 py-3 text-sm transition-colors ${
                  isActive 
                    ? 'bg-[#f5f3f3] text-[#002b4e] font-bold' 
                    : 'text-[#42474f] hover:bg-[#f5f3f3] font-medium'
                }`}
              >
                <Icon size={18} />
                <span>{link.name}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {pathname?.includes('/mblog') && (
        <>
          <div className="sidebar-spacer"></div>
          <div className="card p-4">
            <div className="flex justify-between items-center mb-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#42474f]">Top Contributors</h4>
              <Award size={14} className="text-[#42474f]" />
            </div>
            <div className="flex flex-col gap-4">
              {[
                { name: 'Sarah Jenkins', role: 'Chief Maritime Economist', img: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=150' },
                { name: 'David Chen', role: 'Lead Naval Architect', img: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=150' },
                { name: 'Elena Rostova', role: 'Port Operations Dir.', img: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&q=80&w=150' }
              ].map((contributor) => (
                <div key={contributor.name} className="flex items-center gap-3">
                  <img src={contributor.img} alt={contributor.name} className="w-10 h-10 rounded-full object-cover" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-[#1b1c1c] truncate">{contributor.name}</p>
                    <p className="text-[10px] text-[#42474f] truncate">{contributor.role}</p>
                  </div>
                </div>
              ))}
            </div>
            <button className="w-full mt-4 text-xs font-bold text-[#004173] hover:underline">View All Authors</button>
          </div>
        </>
      )}
    </aside>
  );
}
