import Link from 'next/link';
import PublicSiteFooter from '@/app/components/PublicSiteFooter';
import PublicSiteHeader from '@/app/components/PublicSiteHeader';

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#f0f4fa' }}>
      <PublicSiteHeader />

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center text-center px-4 py-20">
        <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-600 text-sm font-medium px-4 py-1.5 rounded-full mb-8 border border-blue-100">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block"></span>
          The living professional community
        </div>

        <h1 className="text-6xl font-bold leading-tight mb-6" style={{ color: '#0e2a4d', maxWidth: '700px' }}>
          Where professionals<br />connect &amp; build.
        </h1>

        <p className="text-base text-gray-500 mb-10" style={{ maxWidth: '460px', lineHeight: '1.7' }}>
          Marcomn is a community-driven networking platform combining a social feed, job marketplace, and direct messaging. Warmer, faster, and more human.
        </p>

        <Link
          href="/login"
          className="text-xl font-bold px-12 py-5 rounded-xl shadow-sm transition-all hover:opacity-90"
          style={{ backgroundColor: '#00B4D8', color: '#0e2a4d' }}
        >
          Join the community
        </Link>
      </main>

      <PublicSiteFooter />
    </div>
  );
}
