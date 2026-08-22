import LegalLinks from '@/app/components/LegalLinks';

export default function PublicSiteFooter() {
  return (
    <footer className="w-full border-t border-slate-300 bg-[#e9edf1] px-5 py-6 text-sm text-slate-600 sm:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col items-center justify-between gap-4 text-center md:flex-row md:text-left">
        <p className="text-xs">© 2026 Marcomn. All rights reserved.</p>
        <LegalLinks className="w-full md:w-auto md:justify-end" />
      </div>
    </footer>
  );
}
