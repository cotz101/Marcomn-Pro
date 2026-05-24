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
  Award,
  MapPin,
  Briefcase
} from 'lucide-react';
import { useProfile } from '@/app/context/ProfileContext';
import { createClient } from '@/lib/supabase';

export default function SidebarLeft() {
  const pathname = usePathname();
  const { profile, currentIdentity } = useProfile();
  
  const isCompany = currentIdentity?.type === 'company';

  const supabase = createClient();
  const [topContributors, setTopContributors] = useState([]);
  const [loadingContributors, setLoadingContributors] = useState(true);

  const isMBlogPage = pathname?.includes('/mblog');

  const [connectionCount, setConnectionCount] = useState(0);
  const [groupCount, setGroupCount] = useState(0);
  const [fetchedProfileData, setFetchedProfileData] = useState(null);
  const [loadingMetrics, setLoadingMetrics] = useState(true);

  useEffect(() => {
    if (isMBlogPage) {
      fetchTopContributors();
    }
  }, [isMBlogPage]);

  useEffect(() => {
    const fetchUserMetrics = async () => {
      const currentUserId = profile?.id;
      if (!currentUserId) return;
      
      setLoadingMetrics(true);
      try {
        // Explicit Profile Fetch
        const { data: profData, error: profErr } = await supabase
          .from('profiles')
          .select('name, currentRole, previousRole, location, yearsOfExperience, bio, avatar_url, skills')
          .eq('id', currentUserId)
          .single();
        
        if (!profErr && profData) {
          setFetchedProfileData(profData);
        }

        // Connections
        const { count: cCount, error: cErr } = await supabase
          .from('follows')
          .select('*', { count: 'exact', head: true })
          .or(`follower_id.eq.${currentUserId},following_id.eq.${currentUserId}`);
        
        // Groups
        const { count: gCount, error: gErr } = await supabase
          .from('group_members')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', currentUserId);

        if (!cErr) setConnectionCount(cCount || 0);
        if (!gErr) setGroupCount(gCount || 0);
      } catch (err) {
        console.error('Error fetching user metrics:', err);
      } finally {
        setLoadingMetrics(false);
      }
    };

    if (profile?.id) {
      fetchUserMetrics();
    }
  }, [profile?.id]);

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

  const activeConnections = connectionCount || 0;
  const activeGroups = groupCount || 0;

  // Dynamic Metadata Priority Extraction Logic
  const sourceProfile = fetchedProfileData || profile || {};
  
  const name = isCompany ? currentIdentity.data?.name : (sourceProfile.name || sourceProfile.fullName || 'MarComn Member');
  const image = isCompany ? (currentIdentity.data?.logo_url || '/company_placeholder.png') : (sourceProfile.avatar_url || sourceProfile.profilePic || '/profile_pic.png');
  const displayRole = sourceProfile.currentRole || sourceProfile.previousRole || 'MarComn Professional';
  const headline = isCompany ? 'Maritime Enterprise' : displayRole;

  const experience = sourceProfile.yearsOfExperience || sourceProfile.yearsExperience;
  const location = sourceProfile.location;
  const skills = sourceProfile.skills;
  const bio = sourceProfile.bio;

  return (
    <aside className="sidebar-left">
      <div className="post-card rounded-[16px] border border-[#e5e7eb] overflow-hidden bg-white flex flex-col">
        {/* Content Section */}
        <div className="post-inner p-5 relative flex flex-col">
          {/* Avatar Overlap */}
          <div className="flex justify-center mb-3">
            <img 
              src={image} 
              alt={name} 
              className="w-20 h-20 rounded-full object-cover bg-white shadow-sm"
            />
          </div>
          
          <div className="flex flex-col items-center mb-4 text-center">
            <h3 className="font-sans font-bold text-lg text-[#0e2a4d] tracking-tight leading-tight">{name}</h3>
            <p className="text-[15px] text-gray-600 mt-0.5 font-sans font-medium">{headline}</p>
            {location && (
              <div className="flex items-center gap-1.5 text-gray-500 text-[13px] mt-1.5 font-['Public_Sans',sans-serif]">
                <MapPin size={14} className="text-gray-400" />
                <span>{location}</span>
              </div>
            )}
          </div>
          
          {/* Professional Overview */}
          {showStats && (!loadingMetrics && (skills?.length > 0 || experience || bio)) && (
            <div className="flex flex-col w-full mb-2">
              <div className="uppercase text-[11px] font-extrabold text-gray-400 tracking-wider mb-2.5 font-['Public_Sans',sans-serif]">
                Professional Overview
              </div>
              
              <div className="flex flex-col gap-3.5 w-full">
                {skills && skills.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {skills.map((skill, sIdx) => (
                      <span key={sIdx} className="px-2.5 py-1 bg-gray-50 border border-gray-200 text-[#0e2a4d] rounded-full text-[11px] font-semibold whitespace-nowrap font-sans">
                        {skill}
                      </span>
                    ))}
                  </div>
                )}
                
                {experience && (
                  <div className="flex items-center gap-2 text-[#4b5563] text-[13px] font-medium font-['Public_Sans',sans-serif]">
                    <Briefcase size={14} className="text-gray-400" />
                    <span>{experience} Years of Experience</span>
                  </div>
                )}

                {bio && (
                  <div className="text-gray-500 text-[13px] line-clamp-2 leading-relaxed font-['Public_Sans',sans-serif]">
                    {bio}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Footer Section */}
          <Link href={`/profile/${profile?.id || ''}`} className="block w-full py-2 mt-4 text-center text-[13px] font-medium text-blue-950 bg-transparent hover:text-blue-700 hover:underline transition-all font-sans">
            View Profile
          </Link>
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
