'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase';
import { 
  Building2, 
  Search, 
  MapPin, 
  Globe, 
  Loader2, 
  Handshake, 
  ExternalLink 
} from 'lucide-react';

export default function PartnersDirectory() {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
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

  const filteredCompanies = companies.filter(company => {
    const term = searchTerm.toLowerCase();
    const matchesName = (company.name || '').toLowerCase().includes(term);
    const matchesIndustry = (company.industry || '').toLowerCase().includes(term);
    const matchesLocation = (company.location || '').toLowerCase().includes(term);
    return matchesName || matchesIndustry || matchesLocation;
  });

  return (
    <div className="w-full max-w-5xl mx-auto py-8 px-4">
      {/* Header Banner */}
      <div className="relative overflow-hidden bg-gradient-to-r from-blue-900 to-indigo-800 rounded-xl py-10 px-6 md:px-12 mb-8 shadow-sm flex items-center justify-between">
        <div className="relative z-10 w-full max-w-2xl">
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">B2B Partners Directory</h1>
          <p className="text-blue-100 text-sm md:text-base">Connect with verified maritime enterprises, logistics providers, and industrial suppliers.</p>
        </div>
        <Handshake className="absolute -right-4 top-1/2 -translate-y-1/2 text-white opacity-10 hidden md:block" size={160} />
      </div>

      {/* Search Input */}
      <div className="flex items-center bg-white border border-gray-200 rounded-xl p-3 shadow-sm max-w-md w-full mb-8">
        <Search size={20} className="text-gray-400 mr-2 flex-shrink-0" />
        <input 
          type="text"
          placeholder="Search partners, industries, or locations..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full text-sm outline-none border-none text-gray-700 bg-transparent"
        />
      </div>

      {/* Loading Skeleton Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-8">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm animate-pulse flex flex-col items-center">
              <div className="w-24 h-24 rounded-2xl bg-gray-200 mb-5"></div>
              <div className="h-5 bg-gray-200 rounded w-1/2 mb-3"></div>
              <div className="h-6 bg-gray-100 rounded-full w-1/3 mb-6"></div>
              <div className="space-y-2 w-full px-4 mb-4">
                <div className="h-3 bg-gray-100 rounded w-full mx-auto"></div>
                <div className="h-3 bg-gray-100 rounded w-5/6 mx-auto"></div>
                <div className="h-3 bg-gray-100 rounded w-2/3 mx-auto"></div>
              </div>
              <div className="w-full mt-auto pt-4">
                <div className="h-10 bg-gray-100 rounded-xl w-full"></div>
              </div>
            </div>
          ))}
        </div>
      ) : filteredCompanies.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-100 shadow-sm">
          <Building2 size={48} className="text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-gray-700 mb-1">No Partners Found</h3>
          <p className="text-gray-500 text-sm">We couldn't find any partners matching "{searchTerm}".</p>
        </div>
      ) : (
        /* Company Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-8">
          {filteredCompanies.map((company) => {
            const siteUrl = company.website || company.website_url;
            const hasWebsite = siteUrl && siteUrl.trim().length > 0;
            return (
              <div 
                key={company.id}
                className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col items-center p-8"
              >
                {/* Brand / Logo Section */}
                {company.logo_url ? (
                  <img 
                    src={company.logo_url} 
                    alt={company.name} 
                    className="w-24 h-24 rounded-2xl object-cover border-2 border-gray-100 shadow-sm mb-5" 
                  />
                ) : (
                  <div className="w-24 h-24 rounded-2xl bg-blue-50 flex items-center justify-center border-2 border-gray-100 shadow-sm mb-5 text-blue-700">
                    <Building2 size={36} className="text-blue-600" />
                  </div>
                )}

                <h3 className="text-xl font-bold text-blue-900 text-center" title={company.name}>
                  {company.name}
                </h3>

                <div className="mt-2 px-4 py-1.5 bg-blue-50 text-blue-700 text-xs font-bold rounded-full uppercase tracking-wider">
                  {company.industry || 'Maritime Partner'}
                </div>

                {company.location && (
                  <div className="flex items-center justify-center gap-1.5 text-xs text-gray-400 mt-2 font-medium">
                    <MapPin size={12} className="text-gray-400" />
                    <span>{company.location}</span>
                  </div>
                )}

                {/* Bio / Description */}
                <p className="text-sm text-gray-500 text-center mt-5 line-clamp-3 leading-relaxed w-full px-4">
                  {company.bio || 'Verified maritime B2B enterprise.'}
                </p>

                {/* Action Section */}
                {hasWebsite ? (
                  <a 
                    href={siteUrl.startsWith('http') ? siteUrl : `https://${siteUrl}`}
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="w-full mt-8 py-2.5 bg-gray-50 hover:bg-gray-100 text-blue-800 text-sm font-semibold rounded-xl border border-gray-200 transition-colors text-center inline-block"
                  >
                    Visit Website
                  </a>
                ) : (
                  <button 
                    disabled
                    className="w-full mt-8 py-2.5 bg-gray-50 opacity-60 text-gray-400 text-sm font-medium rounded-xl border border-gray-200 text-center cursor-not-allowed"
                  >
                    Website Unavailable
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
