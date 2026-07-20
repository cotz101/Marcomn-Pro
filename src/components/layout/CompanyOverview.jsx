'use client';

import { Building2, Layers, MapPin } from 'lucide-react';

export default function CompanyOverview({ company, isCompany }) {
  if (!isCompany) return null;

  const industry = company?.industry;
  const services = company?.services; // array or string
  const bio = company?.bio || company?.description;
  const location = company?.location;

  return (
    <div className="flex flex-col w-full mb-2 mt-4 pt-4 border-t border-gray-100">
      <div className="uppercase text-[11px] font-extrabold text-blue-900 tracking-wider mb-2.5 font-['Public_Sans',sans-serif]">
        Company Overview
      </div>

      <div className="flex flex-col gap-3.5 w-full">
        {industry && (
          <div className="flex items-center gap-2 text-[#0e2a4d] text-[13px] font-semibold font-sans">
            <Building2 size={14} className="text-blue-700" />
            <span>{industry}</span>
          </div>
        )}

        {/* Services Tag List or Default Badge */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5 text-xs text-gray-500 font-medium">
            <Layers size={13} className="text-gray-400" />
            <span>Services & Solutions</span>
          </div>
          <div className="flex flex-wrap gap-1.5 mt-0.5">
            {Array.isArray(services) && services.length > 0 ? (
              services.map((service, idx) => (
                <span key={idx} className="px-2 py-0.5 bg-blue-50 border border-blue-100 text-blue-900 rounded-md text-[11px] font-medium font-sans">
                  {service}
                </span>
              ))
            ) : typeof services === 'string' && services.trim() ? (
              <span className="px-2 py-0.5 bg-blue-50 border border-blue-100 text-blue-900 rounded-md text-[11px] font-medium font-sans">
                {services}
              </span>
            ) : (
              <span className="px-2 py-0.5 bg-slate-50 border border-slate-200 text-slate-700 rounded-md text-[11px] font-medium font-sans">
                Maritime Services
              </span>
            )}
          </div>
        </div>

        {bio && (
          <div className="text-gray-600 text-[13px] line-clamp-3 leading-relaxed font-['Public_Sans',sans-serif]">
            {bio}
          </div>
        )}
      </div>
    </div>
  );
}
