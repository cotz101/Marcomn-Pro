'use client';

import { useState, useEffect } from 'react';
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
import { createClient } from '@/lib/supabase';

export default function SidebarLeft() {
  const pathname = usePathname();
  const { profile, currentIdentity } = useProfile();
  
  const isCompany = currentIdentity?.type === 'company';
  const name = isCompany ? currentIdentity.data?.name : profile?.fullName;
  const image = isCompany ? (currentIdentity.data?.logo_url || '/company_placeholder.png') : (profile?.profilePic || '/profile_pic.png');
  const headline = isCompany ? 'Maritime Enterprise' : (profile?.headline || 'Maritime Professional');

  const supabase = createClient();
  const [topContributors, setTopContributors] = useState([]);
  const [loadingContributors, setLoadingContributors] = useState(true);

  const isMBlogPage = pathname?.includes('/mblog');

  useEffect(() => {
    if (isMBlogPage) {
      fetchTopContributors();
    }
  }, [isMBlogPage]);

  const fetchTopContributors = async () => {
    try {
      setLoadingContributors(true);
      const { data: articles, error } = await supabase
        .from('mblog_articles')
        .select(`
          author_id,
          author:profiles(id, name, avatar_url, headline)
        `);

      if (error) throw error;

      if (!articles || articles.length === 0) {
        setTopContributors([]);
        return;
      }

      const authorCountsMap = articles.reduce((acc, article) => {
        if (article.author_id && article.author) {
          const authorId = article.author_id;
          if (!acc[authorId]) {
            acc[authorId] = {
              id: authorId,
              name: article.author.name,
              img: article.author.avatar_url || '/profile_pic.png',
              role: article.author.headline || 'Maritime Professional',
              count: 0
            };
          }
          acc[authorId].count += 1;
        }
        return acc;
      }, {});

      const sortedAuthors = Object.values(authorCountsMap)
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      setTopContributors(sortedAuthors);
    } catch (err) {
      console.error('Error fetching top contributors:', err.message || err);
    } finally {
      setLoadingContributors(false);
    }
  };

  let navLinks = [];
  let sidebarTitle = "Manage MNetwork";
  let showStats = true;
  let statsLabel1 = "Profile viewers";
  let statsValue1 = "42";
  let statsLabel2 = "Post impressions";
  let statsValue2 = "1.2k";

  if (pathname?.startsWith('/mservices') || pathname?.startsWith('/partners') || pathname?.startsWith('/jobs')) {
    sidebarTitle = "Manage MServices";
    navLinks = [
      { name: 'Opportunity', href: '/mservices', icon: Lightbulb },
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

      {isMBlogPage && (
        <>
          <div className="sidebar-spacer"></div>
          <div className="card p-4">
            <div className="flex justify-between items-center mb-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#42474f]">Top Contributors</h4>
              <Award size={14} className="text-[#42474f]" />
            </div>
            <div className="flex flex-col gap-4">
              {loadingContributors ? (
                [1, 2, 3].map(i => (
                  <div key={i} className="flex items-center gap-3 animate-pulse">
                    <div className="w-10 h-10 rounded-full bg-gray-200"></div>
                    <div className="flex-1 min-w-0">
                      <div className="h-3 bg-gray-200 rounded w-24 mb-1"></div>
                      <div className="h-2 bg-gray-100 rounded w-16"></div>
                    </div>
                  </div>
                ))
              ) : topContributors.length === 0 ? (
                <p className="text-xs text-gray-400">No contributors yet.</p>
              ) : (
                topContributors.map((contributor) => (
                  <div key={contributor.id} className="flex items-center gap-3">
                    <img src={contributor.img} alt={contributor.name} className="w-10 h-10 rounded-full object-cover" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-[#1b1c1c] truncate">{contributor.name}</p>
                      <p className="text-[10px] text-[#42474f] truncate">
                        {contributor.count} {contributor.count === 1 ? 'Article' : 'Articles'} • {contributor.role}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
            <button className="w-full mt-4 text-xs font-bold text-[#004173] hover:underline">View All Authors</button>
          </div>
        </>
      )}
    </aside>
  );
}
