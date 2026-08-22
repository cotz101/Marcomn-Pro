import Link from 'next/link';

const informationLinks = [
  ['/credits', 'MCredits'],
  ['/legal/privacy', 'Privacy'],
  ['/legal/terms', 'Terms'],
  ['/legal/payments', 'Payments & Refunds'],
];

export default function InformationNav({ currentPath }) {
  return (
    <div className="w-full border-b border-slate-200 bg-white">
      <nav aria-label="MarComn information and legal pages" className="no-scrollbar w-full overflow-x-auto px-4 sm:px-6">
        <div className="mx-auto flex min-h-14 w-max items-stretch gap-7 sm:min-w-full sm:justify-center lg:gap-10">
          {informationLinks.map(([href, label]) => {
            const active = currentPath === href;
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? 'page' : undefined}
                className={`flex min-h-14 shrink-0 items-center border-b-2 text-[15px] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-[#00B4D8] sm:text-base ${active ? 'border-[#00B4D8] font-bold text-[#0e2a4d]' : 'border-transparent font-medium text-slate-600 hover:border-slate-300 hover:text-[#007f9b]'}`}
              >
                {label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
