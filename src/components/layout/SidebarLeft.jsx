'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Ship, Users, UserPlus, Search } from 'lucide-react';
import { useProfile } from '@/app/context/ProfileContext';

export default function SidebarLeft() {
  const pathname = usePathname();
  const { profile, currentIdentity } = useProfile();
  
  const isCompany = currentIdentity?.type === 'company';
  const name = isCompany ? currentIdentity.data?.name : profile?.fullName;
  const image = isCompany ? (currentIdentity.data?.logo_url || '/company_placeholder.png') : (profile?.profilePic || '/profile_pic.png');
  const headline = isCompany ? 'Maritime Enterprise' : (profile?.headline || 'Maritime Professional');

  const navLinks = [
    { name: 'Logbook', href: '/logbook', icon: Ship },
    { name: 'Connections', href: '/connections', icon: UserPlus },
    { name: 'Groups', href: '/groups', icon: Users },
    { name: 'Talent', href: '/talent', icon: Search },
  ];

  return (
    <aside className="sidebar-left">
      <div className="card mb-6 overflow-hidden">
        <div className="h-16 bg-[#002b4e]"></div>
        <div className="px-4 pb-4">
          <div className="flex justify-center -mt-8 mb-3">
            <img 
              src={image} 
              alt={name} 
              className="w-16 h-16 rounded-lg border-2 border-white object-cover bg-white"
            />
          </div>
          <div className="text-center mb-4">
            <h3 className="font-bold text-base text-[#1b1c1c]">{name}</h3>
            <p className="text-xs text-[#42474f] mt-1">{headline}</p>
          </div>
          <div className="border-t border-[#efeded] pt-4 flex flex-col gap-3">
            <div className="flex justify-between items-center text-xs">
              <span className="text-[#42474f]">Profile viewers</span>
              <span className="font-semibold text-[#002b4e]">42</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-[#42474f]">Post impressions</span>
              <span className="font-semibold text-[#002b4e]">1.2k</span>
            </div>
          </div>
        </div>
      </div>

      <div className="card py-2">
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
    </aside>
  );
}
