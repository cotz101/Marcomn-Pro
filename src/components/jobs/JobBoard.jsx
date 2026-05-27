'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { Briefcase, MapPin, DollarSign, Clock, Building2, Search, Filter, Ship, X, Award } from 'lucide-react';
import Link from 'next/link';
import JobCard from './JobCard';

export default function JobBoard() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('recent');
  
  // Filtering States
  const [filterLocation, setFilterLocation] = useState('All');
  const [filterJobType, setFilterJobType] = useState('All');
  const [selectedSkillPill, setSelectedSkillPill] = useState(null);
  
  // UI States
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const [visibleJobsCount, setVisibleJobsCount] = useState(4);

  const supabase = createClient();
  const searchParams = useSearchParams();
  const router = useRouter();
  const jobIdFromUrl = searchParams.get('jobId');

  const fetchJobs = useCallback(async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData?.user;

      let jobsQuery = supabase
        .from('jobs')
        .select(`
          id,
          title,
          location,
          employment_type,
          salary_range,
          tags,
          required_skills,
          created_at,
          company_id,
          poster_id,
          status
        `)
        .in('status', ['Published', 'published', 'Open', 'open'])
        .order('created_at', { ascending: false });

      if (debouncedSearchTerm) {
        jobsQuery = jobsQuery.or(`title.ilike.%${debouncedSearchTerm}%,location.ilike.%${debouncedSearchTerm}%,salary_range.ilike.%${debouncedSearchTerm}%,employment_type.ilike.%${debouncedSearchTerm}%`);
      }

      const [jobsResponse, appsResponse] = await Promise.all([
        jobsQuery,
        user 
          ? supabase.from('applications').select('job_id, status').eq('applicant_id', user.id)
          : Promise.resolve({ data: [] })
      ]);

      const jobsData = jobsResponse.data;
      const jobsError = jobsResponse.error;
      const appsData = appsResponse.data || [];

      if (jobsError) {
        console.error('⚠️ [PostgREST 406 Trace]:', JSON.stringify(jobsError, Object.getOwnPropertyNames(jobsError)));
        throw jobsError;
      }
      
      if (jobsData) {
        const appsMap = {};
        appsData.forEach(app => {
          appsMap[app.job_id] = app;
        });
        
        const jobsWithApps = jobsData.map(job => ({
          ...job,
          application: appsMap[job.id] || null
        }));

        setJobs(jobsWithApps);
      }
    } catch (err) {
      console.error('Error in fetchJobs:', err);
    } finally {
      setLoading(false);
    }
  }, [supabase, debouncedSearchTerm]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
      // Reset visible jobs when search changes
      setVisibleJobsCount(4);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    fetchJobs();

    const handleJobUpdate = () => {
      fetchJobs();
    };

    window.addEventListener('job-posted', handleJobUpdate);
    return () => {
      window.removeEventListener('job-posted', handleJobUpdate);
    };
  }, [fetchJobs]);

  useEffect(() => {
    if (jobIdFromUrl) {
      router.push(`/mservices/opportunity/${jobIdFromUrl}`);
    }
  }, [jobIdFromUrl, router]);

  // Derived filter options from all fetched jobs (so filter options are persistent and accurate)
  const filterOptions = useMemo(() => {
    const allSkills = jobs.flatMap(j => [...(j.required_skills || []), ...(j.tags || [])]).filter(Boolean);
    const skillCounts = {};
    allSkills.forEach(s => {
      skillCounts[s] = (skillCounts[s] || 0) + 1;
    });
    const sortedSkills = Object.entries(skillCounts)
      .sort((a, b) => b[1] - a[1])
      .map(e => e[0]);

    return {
      locations: ['All', ...new Set(jobs.map(j => j.location).filter(Boolean))],
      jobTypes: ['All', ...new Set(jobs.map(j => j.employment_type || j.jobType || j.job_type).filter(Boolean))],
      skills: sortedSkills.slice(0, 5)
    };
  }, [jobs]);

  // Client-side filtering & sorting
  const processedJobs = useMemo(() => {
    let result = [...jobs];

    // Location Filter
    if (filterLocation !== 'All') {
      result = result.filter(job => job.location === filterLocation);
    }

    // Job Type Filter
    if (filterJobType !== 'All') {
      result = result.filter(job => {
        const currentType = job.employment_type || job.jobType || job.job_type || 'Full-time';
        return currentType === filterJobType;
      });
    }

    // Skill Pill Filter
    if (selectedSkillPill) {
      result = result.filter(job => {
        const skills = [...(job.required_skills || []), ...(job.tags || [])];
        return skills.includes(selectedSkillPill);
      });
    }

    // Sorting
    return result.sort((a, b) => {
      if (sortBy === 'recent') {
        return new Date(b.created_at) - new Date(a.created_at);
      }
      if (sortBy === 'oldest') {
        return new Date(a.created_at) - new Date(b.created_at);
      }
      if (sortBy === 'az') {
        return (a.title || '').localeCompare(b.title || '');
      }
      if (sortBy === 'za') {
        return (b.title || '').localeCompare(a.title || '');
      }
      return 0;
    });
  }, [jobs, sortBy, filterLocation, filterJobType, selectedSkillPill]);

  // Reset pagination when filters change
  useEffect(() => {
    setVisibleJobsCount(4);
  }, [filterLocation, filterJobType, selectedSkillPill, sortBy]);

  const visibleJobs = processedJobs.slice(0, visibleJobsCount);

  const handleShowMore = () => {
    setVisibleJobsCount(prev => prev + 3);
  };

  // Vibrant Skill Pill Palette Mapping
  const getSkillColor = (skillName) => {
    const hash = skillName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const palettes = [
      'bg-amber-100 hover:bg-amber-200 text-amber-900 border-amber-300',
      'bg-yellow-100 hover:bg-yellow-200 text-yellow-900 border-yellow-300',
      'bg-purple-100 hover:bg-purple-200 text-purple-900 border-purple-300',
      'bg-orange-100 hover:bg-orange-200 text-orange-900 border-orange-300'
    ];
    return palettes[hash % palettes.length];
  };

  return (
    <div className="job-board-container w-full max-w-5xl mx-auto">
      <header className="job-board-header mb-6 flex flex-col max-[440px]:bg-white max-[440px]:border max-[440px]:border-slate-200 max-[440px]:p-5 max-[440px]:rounded-2xl max-[440px]:shadow-sm">
        {/* Top Row: Title/Subtitle */}
        <div className="flex flex-col justify-start gap-1 mb-5 max-[440px]:mb-4 order-1">
          <div className="w-full text-left">
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Opportunity</h1>
            <p className="text-slate-500 text-sm mt-1">Discover top maritime talent and specialized service providers.</p>
          </div>
        </div>

        {/* Search Bar (Directly below subtitle) */}
        <div className="flex items-center w-full bg-white border border-slate-200 rounded-full shadow-sm overflow-hidden mb-16 max-[440px]:mb-12 order-3 min-[441px]:order-2">
          <div className="pl-5 text-slate-400">
            <Search size={18} />
          </div>
          <input 
            type="text" 
            placeholder="Search by job title, company, location, or keywords..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 px-4 py-4 md:py-3.5 min-h-[48px] text-[15px] text-slate-700 placeholder-slate-400 outline-none bg-transparent"
          />
          <button className="bg-[#002b4e] hover:bg-[#001f38] text-white px-5 min-[441px]:px-8 py-4 md:py-3.5 text-sm font-bold transition-colors h-full min-h-[48px] cursor-pointer">
            Search
          </button>
        </div>

        {/* Filter & Sort Row (Under Search Bar, visible on all viewports) */}
        <div className="flex flex-row items-center gap-3 w-full justify-start mb-4 order-4">
          <button 
            onClick={() => setIsFilterPanelOpen(!isFilterPanelOpen)}
            className="flex items-center justify-center gap-2 px-5 py-3 min-h-[44px] bg-white border border-slate-200 rounded-full text-sm font-semibold text-slate-700 hover:bg-slate-50 shadow-sm transition-colors cursor-pointer flex-1 sm:flex-none"
          >
            <Filter size={16} />
            Filter
          </button>
          <div className="relative flex-1 sm:flex-none sm:w-48">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full bg-white border border-slate-200 text-slate-700 text-sm font-semibold rounded-full px-4 py-3 min-h-[44px] focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none shadow-sm cursor-pointer hover:bg-slate-50 transition-colors appearance-none pr-8 text-center"
              style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: 'right 0.75rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1.2em 1.2em', textAlignLast: 'center' }}
            >
              <option value="recent">Most Recent</option>
              <option value="oldest">Oldest</option>
              <option value="az">A–Z</option>
              <option value="za">Z–A</option>
            </select>
          </div>
        </div>

        {/* Option A Filter Panel */}
        {isFilterPanelOpen && (
          <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 mb-5 shadow-sm animate-in fade-in slide-in-from-top-2 filter-panel order-5 min-[441px]:order-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              
              {/* Job Type Filter (Pills) - MOVED TO FIRST */}
              <div className="flex flex-col gap-2.5">
                <span className="text-sm font-bold text-slate-700 tracking-wide">Job Type</span>
                <div className="flex flex-wrap gap-2">
                  {filterOptions.jobTypes.map(type => {
                    const isSelected = filterJobType === type;
                    return (
                      <button
                        key={type}
                        onClick={() => setFilterJobType(type)}
                        className={`px-4 py-2 text-sm font-bold rounded-full border transition-all cursor-pointer ${
                          isSelected 
                            ? 'bg-[#002b4e] border-[#001f38] text-white shadow-sm ring-1 ring-[#002b4e] ring-offset-1'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {type === 'All' ? 'All Types' : type}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Location Filter - MOVED TO SECOND */}
              <div className="flex flex-col gap-2.5">
                <span className="text-sm font-bold text-slate-700 tracking-wide">Location</span>
                <select
                  value={filterLocation}
                  onChange={(e) => setFilterLocation(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-700 text-[15px] font-semibold rounded-lg p-3.5 focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none cursor-pointer hover:bg-slate-100 transition-colors"
                >
                  {filterOptions.locations.map(loc => (
                    <option key={loc} value={loc}>{loc === 'All' ? 'All Locations' : loc}</option>
                  ))}
                </select>
              </div>

            </div>
          </div>
        )}

        {/* Required Skills Pill Filter (Outside Filter Panel) */}
        {filterOptions.skills.length > 0 && (
          <div className="mb-2 md:mb-6 order-6 min-[441px]:order-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Job Tags & Required Skills</span>
              {selectedSkillPill && (
                <button onClick={() => setSelectedSkillPill(null)} className="text-[11px] font-bold text-red-600 hover:text-red-800 flex items-center gap-1 bg-transparent cursor-pointer">
                  <X size={12} /> Clear
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {filterOptions.skills.map((skill) => {
                const isSelected = selectedSkillPill === skill;
                return (
                  <button
                    key={skill}
                    onClick={() => setSelectedSkillPill(isSelected ? null : skill)}
                    className={`px-4 py-2 text-sm font-bold rounded-full border transition-all cursor-pointer ${
                      isSelected 
                        ? 'bg-[#002b4e] border-[#001f38] text-white shadow-sm ring-1 ring-[#002b4e] ring-offset-1'
                        : getSkillColor(skill)
                    }`}
                  >
                    {skill}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </header>

      {/* Job Card List */}
      {loading ? (
        <div className="loading-state flex flex-col items-center justify-center py-20 text-slate-400">
          <div className="spinner mb-4"></div>
          <p className="text-sm font-medium">Scanning the horizon for opportunities...</p>
        </div>
      ) : processedJobs.length > 0 ? (
        <div className="jobs-container pb-20">
          <div className="jobs-grid grid gap-4 mb-6">
            {visibleJobs.map(job => (
              <JobCard 
                key={job.id} 
                job={job} 
                application={job.application} 
                onClick={() => router.push(`/mservices/opportunity/${job.id}`)} 
              />
            ))}
          </div>
          
          {visibleJobsCount < processedJobs.length && (
            <div className="flex justify-center mt-4 mb-8">
              <button 
                onClick={handleShowMore}
                className="px-8 py-3 bg-white border border-slate-200 rounded-full text-sm font-bold text-slate-700 hover:bg-slate-50 hover:text-[#002b4e] shadow-sm transition-colors cursor-pointer"
              >
                Show More Listings
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="empty-state flex flex-col items-center justify-center py-20 text-slate-400">
          <Briefcase size={48} className="mb-4 opacity-50" />
          <h3 className="text-lg font-bold text-slate-700 mb-1">No jobs found</h3>
          <p className="text-sm">Try adjusting your search terms or filters.</p>
        </div>
      )}

      <style jsx>{`
        .spinner {
          width: 36px;
          height: 36px;
          border: 3px solid #f1f5f9;
          border-top: 3px solid #002b4e;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        /* Default Layout */
        .jobs-grid {
          grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
        }

        /* Mobile Responsive Polish */
        @media (max-width: 440px) {
          .jobs-container {
            padding-bottom: 120px !important;
          }
        }
        
        @media (max-width: 323px) {
          .job-board-container {
            padding-left: 0px !important;
            padding-right: 0px !important;
          }
          .jobs-grid {
            gap: 12px !important;
            grid-template-columns: 1fr;
          }
          .filter-panel {
            padding: 12px !important;
            border-radius: 0px !important;
            border-left: none !important;
            border-right: none !important;
          }
        }
      `}</style>
    </div>
  );
}

