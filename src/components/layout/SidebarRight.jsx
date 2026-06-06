'use client';

import { useState, useEffect } from 'react';
import { Info, ExternalLink, Briefcase, TrendingUp, Sparkles, ThumbsUp, Share2, MessageSquare } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase';

export default function SidebarRight() {
  const pathname = usePathname();
  const isGroupsPage = pathname === '/groups';
  const isGroupDiscussionPage = pathname?.startsWith('/groups/') && pathname !== '/groups';
  const isMBlogPage = pathname?.startsWith('/mblog');

  const supabase = createClient();
  
  const getRelativeTime = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);

    if (diffInSeconds < 60) return 'Just now';
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) return `${diffInMinutes} minute${diffInMinutes > 1 ? 's' : ''} ago`;
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 30) return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
    const diffInMonths = Math.floor(diffInDays / 30);
    if (diffInMonths < 12) return `${diffInMonths} month${diffInMonths > 1 ? 's' : ''} ago`;
    const diffInYears = Math.floor(diffInDays / 365);
    return `${diffInYears} year${diffInYears > 1 ? 's' : ''} ago`;
  };
  const [topLiked, setTopLiked] = useState([]);
  const [mostActive, setMostActive] = useState([]);
  const [mostShared, setMostShared] = useState([]);
  const [loadingMBlogStats, setLoadingMBlogStats] = useState(true);

  // Widget States
  const [recentBlogsData, setRecentBlogsData] = useState([]);
  const [latestOpportunitiesData, setLatestOpportunitiesData] = useState([]);
  const [loadingWidgets, setLoadingWidgets] = useState(true);

  // Groups Widget States
  const [activeGroupsData, setActiveGroupsData] = useState([]);
  const [recentGroupsData, setRecentGroupsData] = useState([]);
  const [loadingGroupsWidgets, setLoadingGroupsWidgets] = useState(true);

  useEffect(() => {
    if (isMBlogPage) {
      fetchMBlogStats();
    } else {
      setLoadingMBlogStats(false);
    }
  }, [isMBlogPage]);

  const fetchMBlogStats = async () => {
    if (!isMBlogPage) {
      setLoadingMBlogStats(false);
      return;
    }

    try {
      setLoadingMBlogStats(true);
      const { data, error } = await supabase
        .from('mblog_articles')
        .select(`
          id,
          title,
          author:profiles(name),
          likes:mblog_article_likes(id),
          comments:mblog_article_comments(id),
          shares:logbook_posts!shared_article_id(id)
        `);

      if (error) throw error;

      if (data) {
        const processed = data.map(a => ({
          ...a,
          likeCount: a.likes?.length || 0,
          commentCount: a.comments?.length || 0,
          shareCount: a.shares?.length || 0,
        }));

        setTopLiked([...processed].filter(a => a.likeCount > 0).sort((a, b) => b.likeCount - a.likeCount).slice(0, 3));
        setMostActive([...processed].filter(a => a.commentCount > 0).sort((a, b) => b.commentCount - a.commentCount).slice(0, 3));
        setMostShared([...processed].filter(a => a.shareCount > 0).sort((a, b) => b.shareCount - a.shareCount).slice(0, 3));
      }
    } catch (err) {
      console.log('DEBUG: MBlog stats fetch error:', err.message || err);
    } finally {
      setLoadingMBlogStats(false);
    }
  };

  useEffect(() => {
    const fetchWidgets = async () => {
      setLoadingWidgets(true);
      try {
        // 1. Recent Blogs (Most Recently Created)
        const { data: bData, error: bErr } = await supabase
          .from('mblog_articles')
          .select(`
            id, title, created_at,
            author:profiles(name)
          `)
          .order('created_at', { ascending: false })
          .limit(3);
        
        if (!bErr && bData) {
          setRecentBlogsData(bData);
        }

        // 2. MServices (Latest Opportunities)
        const { data: oData, error: oErr } = await supabase
          .from('jobs')
          .select(`
            id,
            title,
            location,
            created_at,
            company:companies(name),
            poster:profiles(name)
          `)
          .in('status', ['Published', 'published', 'Open', 'open'])
          .order('created_at', { ascending: false })
          .limit(3);

        if (oErr) {
          console.log('🚨 [MServices Widget Debug] Error fetching jobs:', oErr);
        }

        if (!oErr && oData) {
          setLatestOpportunitiesData(oData);
        }
      } catch (err) {
        console.error('Error fetching widgets:', err);
      } finally {
        setLoadingWidgets(false);
      }
    };
    fetchWidgets();
  }, []);

  useEffect(() => {
    if (!isGroupsPage) return;

    const fetchGroupsWidgets = async () => {
      setLoadingGroupsWidgets(true);
      try {
        // 1. Fetch active groups (joined with post counts)
        const { data: activeData, error: activeErr } = await supabase
          .from('groups')
          .select('id, name, group_posts(id)');

        if (!activeErr && activeData) {
          const mapped = activeData.map(g => ({
            id: g.id,
            name: g.name,
            postCount: g.group_posts?.length || 0
          }));
          mapped.sort((a, b) => b.postCount - a.postCount);
          setActiveGroupsData(mapped.slice(0, 3));
        } else if (activeErr) {
          console.error('Error fetching active groups:', activeErr);
        }

        // 2. Fetch recently created groups
        const { data: recentData, error: recentErr } = await supabase
          .from('groups')
          .select('id, name, created_at')
          .order('created_at', { ascending: false })
          .limit(3);

        if (!recentErr && recentData) {
          setRecentGroupsData(recentData);
        } else if (recentErr) {
          console.error('Error fetching recent groups:', recentErr);
        }
      } catch (err) {
        console.error('Error fetching groups widgets:', err);
      } finally {
        setLoadingGroupsWidgets(false);
      }
    };

    fetchGroupsWidgets();
  }, [isGroupsPage]);

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
            <div className="flex flex-col gap-1">
              {loadingMBlogStats ? (
                [1, 2, 3].map(i => (
                  <div key={i} className="animate-pulse p-2">
                    <div className="h-3 bg-gray-100 rounded w-full mb-2" />
                    <div className="h-2 bg-gray-50 rounded w-1/2" />
                  </div>
                ))
              ) : topLiked.length === 0 ? (
                 <p className="text-xs text-gray-400 p-2">No liked articles yet.</p>
              ) : (
                topLiked.map(article => (
                  <Link 
                    key={article.id} 
                    href={`/mblog?articleId=${article.id}`}
                    className="flex flex-col gap-1 p-2 rounded-md hover:bg-slate-50 cursor-pointer transition-colors group"
                  >
                    <p className="text-sm font-semibold text-[#002b4e] line-clamp-2 group-hover:text-[#004173] leading-tight">
                      {article.title}
                    </p>
                    <div className="flex justify-between items-center mt-1">
                      <span className="text-[11px] text-gray-500 truncate pr-2">
                        {article.author?.name || 'Anonymous'}
                      </span>
                      <span className="flex items-center gap-1 text-[11px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-md whitespace-nowrap">
                        <ThumbsUp size={10} />
                        {article.likeCount}
                      </span>
                    </div>
                  </Link>
                ))
              )}
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
            <div className="flex flex-col gap-1">
              {loadingMBlogStats ? (
                [1, 2, 3].map(i => (
                  <div key={i} className="animate-pulse p-2">
                    <div className="h-3 bg-gray-100 rounded w-full mb-2" />
                    <div className="h-2 bg-gray-50 rounded w-1/3" />
                  </div>
                ))
              ) : mostActive.length === 0 ? (
                 <p className="text-xs text-gray-400 p-2">No active articles yet.</p>
              ) : (
                mostActive.map(article => (
                  <Link 
                    key={article.id} 
                    href={`/mblog?articleId=${article.id}`}
                    className="flex flex-col gap-1 p-2 rounded-md hover:bg-slate-50 cursor-pointer transition-colors group"
                  >
                    <p className="text-sm font-semibold text-[#002b4e] line-clamp-2 group-hover:text-[#004173] leading-tight">
                      {article.title}
                    </p>
                    <div className="flex justify-between items-center mt-1">
                      <span className="text-[11px] text-gray-500 truncate pr-2">
                        {article.author?.name || 'Anonymous'}
                      </span>
                      <span className="flex items-center gap-1 text-[11px] font-bold text-green-600 bg-green-50 px-1.5 py-0.5 rounded-md whitespace-nowrap">
                        <MessageSquare size={10} />
                        {article.commentCount}
                      </span>
                    </div>
                  </Link>
                ))
              )}
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
            <div className="flex flex-col gap-1">
              {loadingMBlogStats ? (
                [1, 2, 3].map(i => (
                  <div key={i} className="animate-pulse p-2">
                    <div className="h-3 bg-gray-100 rounded w-full mb-2" />
                    <div className="h-2 bg-gray-50 rounded w-1/4" />
                  </div>
                ))
              ) : mostShared.length === 0 ? (
                 <p className="text-xs text-gray-400 p-2">No shared articles yet.</p>
              ) : (
                mostShared.map(article => (
                  <Link 
                    key={article.id} 
                    href={`/mblog?articleId=${article.id}`}
                    className="flex flex-col gap-1 p-2 rounded-md hover:bg-slate-50 cursor-pointer transition-colors group"
                  >
                    <p className="text-sm font-semibold text-[#002b4e] line-clamp-2 group-hover:text-[#004173] leading-tight">
                      {article.title}
                    </p>
                    <div className="flex justify-between items-center mt-1">
                      <span className="text-[11px] text-gray-500 truncate pr-2">
                        {article.author?.name || 'Anonymous'}
                      </span>
                      <span className="flex items-center gap-1 text-[11px] font-bold text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded-md whitespace-nowrap">
                        <Share2 size={10} />
                        {article.shareCount}
                      </span>
                    </div>
                  </Link>
                ))
              )}
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
          {/* Widget 1: Most Active Groups */}
          <div className="card p-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-sm text-[#1b1c1c]">Most Active Groups</h3>
              <TrendingUp size={14} className="text-[#42474f]" />
            </div>
            <div className="flex flex-col gap-4">
              {loadingGroupsWidgets ? (
                [1, 2, 3].map(i => (
                  <div key={i} className="animate-pulse">
                    <div className="h-4 bg-gray-100 rounded w-full mb-2" />
                    <div className="h-3 bg-gray-50 rounded w-2/3" />
                  </div>
                ))
              ) : activeGroupsData.length === 0 ? (
                <p className="text-xs text-gray-400">No active groups found.</p>
              ) : (
                activeGroupsData.map(group => (
                  <div key={group.id} className="group cursor-pointer">
                    <Link href={`/groups/${group.id}`} className="text-sm font-semibold text-[#002b4e] hover:underline block">
                      {group.name}
                    </Link>
                    <p className="text-[11px] text-[#727780] mt-1">({group.postCount} Posts)</p>
                  </div>
                ))
              )}
              <Link href="/groups?filter=active" className="text-xs font-bold text-[#004173] mt-2 hover:underline">
                View all active groups
              </Link>
            </div>
          </div>

          <div className="sidebar-spacer"></div>

          {/* Widget 2: Recently Created */}
          <div className="card p-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-sm text-[#1b1c1c]">Recently Created</h3>
              <Sparkles size={14} className="text-[#42474f]" />
            </div>
            <div className="flex flex-col gap-4">
              {loadingGroupsWidgets ? (
                [1, 2, 3].map(i => (
                  <div key={i} className="animate-pulse">
                    <div className="h-4 bg-gray-100 rounded w-full mb-2" />
                    <div className="h-3 bg-gray-50 rounded w-1/2" />
                  </div>
                ))
              ) : recentGroupsData.length === 0 ? (
                <p className="text-xs text-gray-400">No new groups found.</p>
              ) : (
                recentGroupsData.map(group => (
                  <div key={group.id} className="cursor-pointer hover:bg-[#f5f3f3] -mx-4 px-4 py-2 transition-colors">
                    <Link href={`/groups/${group.id}`} className="text-sm font-semibold text-[#1b1c1c] hover:text-[#004173] block">
                      {group.name}
                    </Link>
                    <p className="text-xs text-[#42474f] mt-1">{getRelativeTime(group.created_at)}</p>
                  </div>
                ))
              )}
              <Link href="/groups?filter=recent" className="text-xs font-bold text-[#004173] mt-2 hover:underline">
                Explore new groups
              </Link>
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Upper Container: MBlogs */}
          <div className="card p-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-sm text-[#1b1c1c]">MBlogs</h3>
              <Info size={14} className="text-[#42474f] cursor-pointer" />
            </div>
            <div className="flex flex-col gap-4">
              {loadingWidgets ? (
                [1, 2, 3].map(i => (
                  <div key={i} className="animate-pulse">
                    <div className="h-4 bg-gray-100 rounded w-full mb-2" />
                    <div className="h-3 bg-gray-50 rounded w-2/3" />
                  </div>
                ))
              ) : recentBlogsData.length === 0 ? (
                <p className="text-xs text-gray-400">No blogs found.</p>
              ) : (
                recentBlogsData.map(blog => {
                  return (
                    <div key={blog.id} className="group cursor-pointer">
                      <Link href={`/mblog?articleId=${blog.id}`} className="text-sm font-medium text-blue-950 group-hover:underline line-clamp-2 leading-tight block">
                        {blog.title}
                      </Link>
                      <p className="text-xs text-gray-400 mt-1 truncate">
                        {blog.author?.name || 'Anonymous'} · {getRelativeTime(blog.created_at)}
                      </p>
                    </div>
                  );
                })
              )}
              <Link href="/mblog" className="text-xs font-bold text-[#004173] mt-2 hover:underline">
                View All MBlogs
              </Link>
            </div>
          </div>

          <div className="sidebar-spacer"></div>

          {/* Lower Container: MServices (Opportunities) */}
          <div className="card p-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-sm text-[#1b1c1c]">MServices</h3>
              <Sparkles size={14} className="text-[#42474f]" />
            </div>
            <div className="flex flex-col gap-4">
              {loadingWidgets ? (
                [1, 2, 3].map(i => (
                  <div key={i} className="animate-pulse">
                    <div className="h-4 bg-gray-100 rounded w-full mb-2" />
                    <div className="h-3 bg-gray-50 rounded w-1/2" />
                  </div>
                ))
              ) : latestOpportunitiesData.length === 0 ? (
                <p className="text-xs text-gray-400">No opportunities found.</p>
              ) : (
                latestOpportunitiesData.map(opp => {
                  const companyName = opp.company?.name || opp.poster?.name || 'Private Poster';
                  return (
                    <div key={opp.id} className="group cursor-pointer">
                      <Link href={`/mservices/opportunity/${opp.id}`} className="text-sm font-medium text-blue-950 group-hover:underline truncate block">
                        {opp.title}
                      </Link>
                      <p className="text-xs text-gray-800 font-semibold mt-0.5 truncate">
                        {companyName}
                      </p>
                      <div className="flex justify-between items-center text-[10px] text-gray-400 mt-1">
                        <span>{opp.location}</span>
                        <span>{getRelativeTime(opp.created_at)}</span>
                      </div>
                    </div>
                  );
                })
              )}
              <Link href="/mservices" className="text-xs font-bold text-[#004173] mt-2 hover:underline">
                View All Opportunities
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
