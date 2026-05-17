'use client';
import { useState, useEffect } from 'react';
import { Search, ChevronDown, Briefcase } from 'lucide-react';
import JobCard from '../jobs/JobCard';
import JobDetailsModal from '../jobs/JobDetailsModal';
import { createClient } from '@/lib/supabase';
import { useProfile } from '@/app/context/ProfileContext';

const SkeletonCard = () => (
  <div className="bg-white border border-gray-200 rounded-lg p-7 mb-4 shadow-sm animate-pulse flex gap-5 items-start">
    <div className="w-16 h-16 bg-gray-100 rounded-md flex-shrink-0"></div>
    <div className="flex-1 space-y-3">
      <div className="h-6 bg-gray-100 rounded w-1/3"></div>
      <div className="h-4 bg-gray-100 rounded w-1/4"></div>
      <div className="h-3 bg-gray-100 rounded w-1/2"></div>
      <div className="flex gap-2 pt-2">
        <div className="h-5 bg-gray-100 rounded w-16"></div>
        <div className="h-5 bg-gray-100 rounded w-20"></div>
        <div className="h-5 bg-gray-100 rounded w-24"></div>
      </div>
    </div>
  </div>
);

const EmptyState = () => (
  <div className="bg-white border border-gray-200 rounded-lg p-10 text-center shadow-sm">
    <div className="w-16 h-16 bg-blue-50 text-blue-900 rounded-full flex items-center justify-center mx-auto mb-4">
      <Briefcase size={28} />
    </div>
    <h3 className="text-lg font-bold text-blue-900 mb-1">No Opportunities Available</h3>
    <p className="text-sm text-gray-500 max-w-sm mx-auto">
      No opportunities available at the moment. Check back soon!
    </p>
  </div>
);

export default function ServicesFeed() {
  const { setToast } = useProfile();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedJob, setSelectedJob] = useState(null);

  useEffect(() => {
    async function fetchJobs() {
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from('jobs')
          .select(`
            *,
            company:companies(name, logo_url),
            poster:profiles(name, avatar_url)
          `)
          .eq('status', 'Open')
          .order('created_at', { ascending: false });

        if (error) throw error;
        setJobs(data || []);
      } catch (err) {
        console.error('Error fetching jobs:', err.message || err);
      } finally {
        setLoading(false);
      }
    }
    fetchJobs();
  }, []);

  const handleApply = (job) => {
    console.log('Applying for Job ID:', job.id);
    if (setToast) {
      setToast({
        type: 'success',
        message: `Successfully applied for ${job.title}!`
      });
    } else {
      alert(`Successfully applied for ${job.title}!`);
    }
    setSelectedJob(null);
  };

  const filteredJobs = jobs.filter(job => {
    const titleMatch = (job.title || '').toLowerCase().includes(searchTerm.toLowerCase());
    const descMatch = (job.description || '').toLowerCase().includes(searchTerm.toLowerCase());
    const locMatch = (job.location || '').toLowerCase().includes(searchTerm.toLowerCase());
    const compName = job.company?.name || job.poster?.name || 'Private Poster';
    const companyMatch = compName.toLowerCase().includes(searchTerm.toLowerCase());
    return titleMatch || descMatch || locMatch || companyMatch;
  });

  return (
    <div className="flex flex-col gap-2">
      <div>
        <h2 className="text-[#002b4e] font-bold text-xl mb-1">Opportunity</h2>
        <p className="text-sm text-[#42474f] mb-4">Discover top maritime talent and specialized service providers.</p>
      </div>

      {/* Unified Header Container (Search & Sort) */}
      <div className="flex items-center justify-between mb-6 bg-white border border-gray-200 rounded-lg p-3 px-5 shadow-sm">
        {/* Left Side (Search - No Overlapping Placeholder) */}
        <div className="flex items-center gap-3 w-full max-w-sm">
          <Search className="text-gray-400" size={18} />
          <input 
            type="text" 
            placeholder="Search opportunities..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.value || e.target.value)}
            className="w-full border-none focus:outline-none text-sm bg-transparent placeholder-gray-400" 
          />
        </div>

        {/* Right Side (Sort Separator) */}
        <div className="flex items-center gap-1 text-sm font-medium text-gray-600 cursor-pointer hover:text-blue-900 border-l border-gray-200 pl-4">
          <span>Most Recent</span>
          <ChevronDown size={16} />
        </div>
      </div>

      {/* Main Feed panel mapping JobCard */}
      <div className="flex flex-col">
        {loading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : filteredJobs.length === 0 ? (
          <EmptyState />
        ) : (
          filteredJobs.map(job => (
            <JobCard 
              key={job.id} 
              job={job} 
              onClick={() => setSelectedJob(job)} 
            />
          ))
        )}
      </div>

      {/* Show More */}
      {filteredJobs.length > 5 && (
        <div className="flex justify-center mt-2 mb-8">
          <button className="px-6 py-2 border border-gray-200 bg-white rounded-full text-sm font-medium text-gray-600 hover:bg-gray-50 shadow-sm transition-all">
            Show More Listings
          </button>
        </div>
      )}

      {/* Quick View & Apply Modal */}
      {selectedJob && (
        <JobDetailsModal 
          job={selectedJob} 
          onClose={() => setSelectedJob(null)} 
          onApply={handleApply}
        />
      )}
    </div>
  );
}
