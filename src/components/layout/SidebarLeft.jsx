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
  Library,
  BookOpen,
  Award
} from 'lucide-react';
import { useProfile } from '@/app/context/ProfileContext';
import { createClient } from '@/lib/supabase';
import PersonalTopCard from './PersonalTopCard';
import CompanyTopCard from './CompanyTopCard';
import PersonalOverview from './PersonalOverview';
import CompanyOverview from './CompanyOverview';

export default function SidebarLeft() {
  const pathname = usePathname();
  const { profile, currentIdentity, userId } = useProfile();
  
  const isCompany = currentIdentity?.isCompany || currentIdentity?.type === 'company';
  const supabase = createClient();

  const [personalData, setPersonalData] = useState(null);
  const [companyData, setCompanyData] = useState(null);
  const [loadingData, setLoadingData] = useState(true);

  const [topContributors, setTopContributors] = useState([]);
  const [loadingContributors, setLoadingContributors] = useState(true);

  const isMBlogPage = pathname?.includes('/mblog');

  // Async Safety Identity Data Fetcher
  useEffect(() => {
    let isActive = true;
    setLoadingData(true);

    const loadIdentityData = async () => {
      if (isCompany) {
        // Clear personal data immediately to prevent cross-leakage
        setPersonalData(null);

        const companyId = currentIdentity?.id;
        if (!companyId) {
          if (isActive) {
            setCompanyData(currentIdentity?.data || null);
            setLoadingData(false);
          }
          return;
        }

        try {
          const { data, error } = await supabase
            .from('companies')
            .select('id, name, logo_url, industry, location, bio, website, services')
            .eq('id', companyId)
            .maybeSingle();

          if (isActive) {
            if (!error && data) {
              setCompanyData(data);
            } else {
              setCompanyData(currentIdentity?.data || null);
            }
          }
        } catch (err) {
          console.error('Error fetching company data for sidebar:', err);
          if (isActive) setCompanyData(currentIdentity?.data || null);
        } finally {
          if (isActive) setLoadingData(false);
        }

      } else {
        // Clear company data immediately to prevent cross-leakage
        setCompanyData(null);

        const activeUserId = profile?.id || userId;
        if (!activeUserId) {
          if (isActive) {
            setPersonalData(profile || null);
            setLoadingData(false);
          }
          return;
        }

        try {
          const { data, error } = await supabase
            .from('profiles')
            .select('id, name, currentRole, previousRole, location, yearsOfExperience, bio, avatar_url, skills')
            .eq('id', activeUserId)
            .maybeSingle();

          if (isActive) {
            if (!error && data) {
              setPersonalData({ ...profile, ...data });
            } else {
              setPersonalData(profile || null);
            }
          }
        } catch (err) {
          console.error('Error fetching personal profile for sidebar:', err);
          if (isActive) setPersonalData(profile || null);
        } finally {
          if (isActive) setLoadingData(false);
        }
      }
    };

    loadIdentityData();

    return () => {
      isActive = false;
    };
  }, [isCompany, currentIdentity?.id, profile?.id, userId]);

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
  let sidebarTitle = "MNetwork";

  if (pathname?.startsWith('/mservices') || pathname?.startsWith('/partners') || pathname?.startsWith('/jobs')) {
    sidebarTitle = "Manage MServices";
    navLinks = [
      { name: 'Opportunity', href: '/mservices', icon: Lightbulb },
      { name: 'Partners', href: '/partners', icon: Handshake },
      { name: 'My Job Posting', href: '/jobs/my-postings', icon: FileText },
      { name: 'My Job Application', href: '/jobs/my-applications', icon: Send },
    ];
  } else if (pathname?.includes('/mblog')) {
    sidebarTitle = "Manage my insights";
    navLinks = [
      { name: 'All MBlogs', href: '/mblog?view=all', icon: Library },
      { name: 'My MBlogs', href: '/mblog?view=my', icon: BookOpen },
    ];
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
      <div className="post-card rounded-[16px] border border-[#e5e7eb] overflow-hidden bg-white flex flex-col">
        {/* Content Section */}
        <div className="post-inner p-5 relative flex flex-col">
          {loadingData ? (
            <div className="flex flex-col items-center animate-pulse py-4">
              <div className="w-20 h-20 bg-gray-200 rounded-full mb-3"></div>
              <div className="h-4 bg-gray-200 rounded w-32 mb-2"></div>
              <div className="h-3 bg-gray-100 rounded w-24"></div>
            </div>
          ) : isCompany ? (
            <>
              <CompanyTopCard company={companyData || currentIdentity?.data} isCompany={true} />
              <CompanyOverview company={companyData || currentIdentity?.data} isCompany={true} />
            </>
          ) : (
            <>
              <PersonalTopCard profile={personalData || profile} isCompany={false} />
              <PersonalOverview profile={personalData || profile} isCompany={false} />
            </>
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
                    ? 'bg-blue-50/50 border-l-4 border-blue-950 font-semibold text-blue-950' 
                    : 'text-gray-500 hover:bg-[#f5f3f3] font-medium'
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
