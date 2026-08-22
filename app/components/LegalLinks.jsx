import Link from 'next/link';

const links = [
  ['/credits', 'About MCredits'],
  ['/legal/privacy', 'Privacy Policy'],
  ['/legal/terms', 'Terms of Use'],
  ['/legal/payments', 'MCredits, Payments & Refund Policy'],
];

export default function LegalLinks({ className = '' }) {
  return (
    <nav aria-label="Legal and MCredit information" className={`flex flex-wrap justify-center gap-x-5 gap-y-2 ${className}`}>
      {links.map(([href, label]) => (
        <Link key={href} href={href} className="font-medium hover:text-[#0e2a4d] hover:underline">
          {label}
        </Link>
      ))}
    </nav>
  );
}
