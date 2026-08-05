'use client';

import { MapPin } from 'lucide-react';

export default function CompanyTopCard({ company, isCompany }) {
  if (!isCompany) return null;

  const name = company?.name || 'Company Profile';
  const logo = company?.logo_url || '/company_placeholder.png';
  const industry = company?.industry || 'Maritime Enterprise';
  const location = company?.location;
  const companyId = company?.id;

  return (
    <div className="flex flex-col items-center text-center">
      {/* Company Logo */}
      <div className="flex justify-center mb-3">
        <img 
          src={logo} 
          alt={name} 
          className="w-20 h-20 rounded-xl object-cover bg-white shadow-sm border border-gray-100"
        />
      </div>

      <h3 className="font-sans font-bold text-lg text-[#0e2a4d] tracking-tight leading-tight">{name}</h3>
      <p className="text-[15px] font-semibold text-blue-900 mt-0.5 font-sans">{industry}</p>

      {location && (
        <div className="flex items-center gap-1.5 text-gray-500 text-[13px] mt-1.5 font-['Public_Sans',sans-serif]">
          <MapPin size={14} className="text-gray-400" />
          <span>{location}</span>
        </div>
      )}

    </div>
  );
}
