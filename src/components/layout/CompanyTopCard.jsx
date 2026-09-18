import { useState } from 'react';
import { MapPin, Building2 } from 'lucide-react';

function getCompanyInitials(name) {
  if (!name || typeof name !== 'string') return '';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) {
    return parts[0].charAt(0).toUpperCase();
  }
  return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
}

export default function CompanyTopCard({ company, isCompany }) {
  if (!isCompany) return null;

  const [logoError, setLogoError] = useState(false);
  const name = company?.name || 'Company Profile';
  const logo = company?.logo_url || null;
  const industry = company?.industry || 'Maritime Enterprise';
  const location = company?.location;
  const companyId = company?.id;
  const initials = getCompanyInitials(name);

  return (
    <div className="flex flex-col items-center text-center">
      {/* Company Logo */}
      <div className="flex justify-center mb-3">
        {logo && !logoError ? (
          <img
            src={logo}
            alt={name}
            className="w-20 h-20 rounded-xl object-cover bg-white shadow-sm border border-gray-100"
            onError={() => setLogoError(true)}
          />
        ) : (
          <div
            className="w-20 h-20 rounded-xl bg-slate-100 flex items-center justify-center text-[#004173] font-bold text-xl shadow-sm border border-slate-200/80 select-none"
            aria-label={`${name} company`}
            role="img"
          >
            {initials ? initials : <Building2 size={32} className="text-[#004173]" />}
          </div>
        )}
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
