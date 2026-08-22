import LandingLogo from '@/app/components/LandingLogo';

export default function PublicSiteHeader() {
  return (
    <header className="border-b border-gray-100 bg-white">
      <div className="mx-auto flex w-full max-w-7xl items-center px-6 py-3 md:px-12">
        <LandingLogo />
      </div>
    </header>
  );
}
