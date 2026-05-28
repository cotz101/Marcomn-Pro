'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { 
  Building2, 
  Search, 
  MapPin, 
  ExternalLink 
} from 'lucide-react';

export default function PartnersDirectory() {
  const router = useRouter();
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIndustry, setSelectedIndustry] = useState('All');
  const supabase = createClient();

  useEffect(() => {
    async function fetchCompanies() {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('companies')
          .select('*')
          .order('name', { ascending: true });

        if (error) throw error;
        setCompanies(data || []);
      } catch (err) {
        console.error('Error fetching companies:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchCompanies();
  }, []);

  // 1. Calculate Total Registered Companies
  const totalCompaniesCount = companies.length;

  // 2. Calculate Number of Industries Registered
  const uniqueIndustries = Array.from(new Set(companies.map(c => c.industry).filter(Boolean)));
  const totalIndustriesCount = uniqueIndustries.length;

  // 3. Calculate Top 4 Industries by Frequency from actual loaded data
  const industryCounts = {};
  companies.forEach(c => {
    if (c.industry) {
      industryCounts[c.industry] = (industryCounts[c.industry] || 0) + 1;
    }
  });
  const topIndustries = Object.entries(industryCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4) // Limit to top 4 industries plus All Partners (Max 5 tabs total)
    .map(entry => entry[0]);

  const filteredCompanies = companies.filter(company => {
    const matchesIndustryTab = selectedIndustry === 'All' || company.industry === selectedIndustry;
    const term = searchTerm.toLowerCase();
    const matchesName = (company.name || '').toLowerCase().includes(term);
    const matchesIndustryText = (company.industry || '').toLowerCase().includes(term);
    const matchesLocation = (company.location || '').toLowerCase().includes(term);
    return matchesIndustryTab && (matchesName || matchesIndustryText || matchesLocation);
  });

  return (
    <div className="partners-container w-full max-w-5xl mx-auto py-6 sm:py-8 px-3 sm:px-6 pb-24 sm:pb-12">
      {/* Mobile & layout custom overrides */}
      <style dangerouslySetInnerHTML={{ __html: `
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        
        /* General Layout Spacing & Visibility Controls */
        .partners-grid {
          display: grid !important;
          grid-template-columns: 1fr;
          gap: 24px !important;
          margin-top: 24px !important; /* Good spacing unified from 440px */
        }
        
        .partner-card {
          padding: 20px 20px 20px 26px !important; /* Breathe details from card border, perfectly aligned */
          border-radius: 16px !important;
        }
        
        @media (min-width: 768px) {
          .partners-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
          .partner-card {
            align-items: center !important;
            text-align: center !important;
            padding: 30px 24px !important;
          }
          .partner-card > .flex {
            flex-direction: column !important;
            align-items: center !important;
            gap: 16px !important;
            width: 100% !important;
          }
          .partner-card > .flex > .flex-1 {
            width: 100% !important;
            padding-left: 0 !important;
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
          }
          .partner-card > .flex > .flex-1 > .flex-wrap {
            justify-content: center !important;
          }
          .partner-card > p {
            padding-left: 0 !important;
            text-align: center !important;
            width: 100% !important;
          }
          .partner-card > div {
            padding-left: 0 !important;
            width: 100% !important;
          }
        }
        
        @media (min-width: 441px) {
          .partners-grid {
            display: grid !important; /* Force explicit display at 441px and above */
            visibility: visible !important;
            opacity: 1 !important;
            height: auto !important;
          }
          .partner-card {
            display: flex !important; /* Ensure card is displayed and flexes details */
            flex-direction: column !important;
            visibility: visible !important;
            opacity: 1 !important;
          }
        }

        @media (min-width: 441px) and (max-width: 767px) {
          .partners-container {
            padding-bottom: 150px !important; /* Prevent bottom nav overlap */
          }
        }

        @media (max-width: 440px) {
          .partners-container {
            padding-bottom: 120px !important; /* Prevent bottom nav overlap */
          }
          .partners-grid {
            gap: 14px !important;
            margin-top: 24px !important; /* Keep mobile spacing identical */
          }
        }

        @media (max-width: 323px) {
          .partners-container {
            padding-left: 6px !important;
            padding-right: 6px !important;
            padding-bottom: 140px !important;
          }
          .partner-card {
            padding: 16px 16px 16px 20px !important;
            border-radius: 12px !important;
          }
        }
      `}} />

      {/* Premium Header Card (Opportunity & Stats layout) */}
      <header className="mb-8 max-[440px]:mb-7 flex flex-col bg-white border border-slate-200 p-5 md:p-6 rounded-2xl shadow-sm">
        
        {/* Row 1: Title Section & Top Stats Cards */}
        <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-6 mb-6 px-2 md:px-4">
          <div className="flex-1">
            <h1 className="text-3xl font-extrabold tracking-tight leading-none mb-3" style={{ color: '#000050' }}>
              MarComn Partners
            </h1>
            <p className="text-slate-500 text-sm leading-relaxed max-w-xl">
              Curate and manage your high-tier partner organizations. Oversee active B2B contributions, monitor industrial networks, and foster strategic institutional relationships within the maritime ecosystem.
            </p>
          </div>

          {/* Stats Cards */}
          <div className="flex gap-4 flex-shrink-0 max-[440px]:grid max-[440px]:grid-cols-2">
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 min-w-[130px] flex flex-col justify-between shadow-xs">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Total Network</span>
              <span className="text-3xl font-black text-[#002b4e]">{totalCompaniesCount}</span>
            </div>
            <div className="bg-amber-50/40 border border-amber-100 rounded-2xl p-4 min-w-[130px] flex flex-col justify-between shadow-xs">
              <span className="text-[10px] font-black text-amber-600/80 uppercase tracking-widest block mb-2">Industries</span>
              <span className="text-3xl font-black text-amber-700">{totalIndustriesCount}</span>
            </div>
          </div>
        </div>

        {/* Row 2: Search Input (Opportunity Style search bar) */}
        <div className="w-full px-2 md:px-4 mb-6">
          <div
            className="flex items-center w-full overflow-hidden"
            style={{
              backgroundColor: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '9999px',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
            }}
          >
            <div className="pl-4 sm:pl-5 flex-shrink-0" style={{ color: '#94a3b8' }}>
              <Search size={18} />
            </div>
            <input
              type="text"
              placeholder="Search partners by name, industry, or location..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 min-w-0 outline-none bg-transparent max-[320px]:placeholder:text-[11px] placeholder:text-slate-400"
              style={{
                padding: '0.75rem 1rem',
                fontSize: '14px',
                color: '#334155',
                border: 'none',
              }}
            />
          </div>
        </div>

        {/* Row 3: Industry Tabs (Wrapping enabled to prevent overflow) */}
        {totalCompaniesCount > 0 && (
          <div className="w-full px-2 md:px-4 flex flex-wrap items-center gap-2 pb-1.5 mb-2">
            <button
              onClick={() => setSelectedIndustry('All')}
              className={`px-4 py-2 rounded-full text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                selectedIndustry === 'All'
                  ? 'bg-[#002b4e] text-white shadow-sm'
                  : 'bg-slate-50 text-slate-650 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              All Partners
            </button>
            {topIndustries.map((ind) => (
              <button
                key={ind}
                onClick={() => setSelectedIndustry(ind)}
                className={`px-4 py-2 rounded-full text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  selectedIndustry === ind
                    ? 'bg-[#002b4e] text-white shadow-sm'
                    : 'bg-slate-50 text-slate-655 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                {ind}
              </button>
            ))}
          </div>
        )}
      </header>

      {/* Loading Skeleton Grid */}
      {loading ? (
        <div className="partners-grid">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="partner-card bg-white border border-slate-200 shadow-sm animate-pulse flex flex-col">
              <div className="flex gap-4 items-start mb-4">
                <div className="w-16 h-16 rounded-xl bg-slate-100 flex-shrink-0"></div>
                <div className="flex-1 space-y-2 py-1">
                  <div className="h-4 bg-slate-200 rounded w-3/4"></div>
                  <div className="h-3.5 bg-slate-100 rounded w-1/2"></div>
                </div>
              </div>
              <div className="space-y-2 py-1 flex-1">
                <div className="h-3 bg-slate-100 rounded w-full"></div>
                <div className="h-3 bg-slate-100 rounded w-5/6"></div>
              </div>
              <div className="w-full mt-[40px] flex justify-center">
                <div className="h-10 bg-slate-100 rounded-xl w-32"></div>
              </div>
            </div>
          ))}
        </div>
      ) : filteredCompanies.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
          <Building2 size={48} className="text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-black text-slate-800 mb-1" style={{ color: '#002b4e' }}>No Partners Found</h3>
          <p className="text-slate-500 text-sm">We couldn't find any partners matching "{searchTerm}".</p>
        </div>
      ) : (
        /* Company Grid - Enforced dynamic layout spacing */
        <div className="partners-grid">
          {filteredCompanies.map((company) => {
            const siteUrl = company.website || company.website_url;
            const hasWebsite = siteUrl && siteUrl.trim().length > 0;
            return (
              <div 
                key={company.id}
                onClick={() => router.push(`/company/${company.id}`)}
                className="partner-card bg-white border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col cursor-pointer"
              >
                {/* Header Profile Section */}
                <div className="flex gap-4.5 items-start mb-4">
                  {/* Brand / Logo Section */}
                  {company.logo_url ? (
                    <img 
                      src={company.logo_url} 
                      alt={company.name} 
                      className="w-16 h-16 rounded-xl object-contain bg-white p-1 border border-slate-100 shadow-sm flex-shrink-0" 
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-xl bg-blue-50 flex items-center justify-center border border-slate-100 shadow-sm flex-shrink-0 text-blue-700">
                      <Building2 size={28} className="text-blue-600" />
                    </div>
                  )}

                  <div className="flex-1 min-w-0 pl-2">
                    {/* Wrap company name to avoid truncation */}
                    <h3 className="text-lg font-extrabold tracking-tight text-slate-855 whitespace-normal break-words leading-snug" style={{ color: '#002b4e' }}>
                      {company.name}
                    </h3>
                    
                    {/* Secondary Industry & Location with vertical spacing */}
                    <div className="flex flex-wrap gap-2 mt-2.5">
                      <span className="inline-block px-2.5 py-0.5 bg-blue-50/80 text-blue-800 text-[10px] font-bold rounded-full uppercase tracking-wider border border-blue-100">
                        {company.industry || 'Maritime Partner'}
                      </span>
                      {company.location && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-slate-400 font-medium">
                          <MapPin size={10} className="text-slate-400" />
                          <span>{company.location}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Bio / Description */}
                <p className="text-sm text-slate-500 mt-2 line-clamp-3 leading-relaxed flex-1 pl-2">
                  {company.bio || 'Verified maritime B2B enterprise.'}
                </p>

                {/* Action Section with extra vertical gap */}
                {hasWebsite && (
                  <div className="mt-[40px] pl-2 flex justify-center">
                    <a 
                      href={siteUrl.startsWith('http') ? siteUrl : `https://${siteUrl}`}
                      target="_blank" 
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="px-8 py-2.5 bg-white hover:bg-slate-50 text-[#002b4e] text-sm font-semibold rounded-xl border border-slate-200 transition-colors inline-flex items-center justify-center gap-1.5 shadow-sm"
                    >
                      <span>Visit Website</span>
                      <ExternalLink size={14} />
                    </a>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
