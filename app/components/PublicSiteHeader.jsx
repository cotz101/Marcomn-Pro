import Link from 'next/link';
import LandingLogo from '@/app/components/LandingLogo';

const publicNav = [
  ['/logbook', 'MNetwork'],
  ['/mservices', 'MServices'],
  ['/mblog', 'MBlogs'],
];

export default function PublicSiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex min-h-16 w-full max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-12">
        <Link href="/" aria-label="MarComn home" className="shrink-0 rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#00B4D8]">
          <LandingLogo />
        </Link>

        <nav aria-label="MarComn public navigation" className="hidden items-center gap-7 md:flex">
          {publicNav.map(([href, label]) => (
            <Link key={href} href={href} className="text-sm font-semibold text-slate-600 transition-colors hover:text-[#007f9b] focus-visible:rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#00B4D8]">
              {label}
            </Link>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <Link href="/login" className="min-h-10 rounded-xl px-3 py-2.5 text-sm font-bold text-[#0e2a4d] transition-colors hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00B4D8] sm:px-4">
            Sign In
          </Link>
          <Link href="/login" className="hidden min-h-10 rounded-xl bg-[#00B4D8] px-4 py-2.5 text-sm font-bold text-[#0e2a4d] transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0e2a4d] sm:inline-flex">
            Join MarComn
          </Link>
        </div>
      </div>
    </header>
  );
}
