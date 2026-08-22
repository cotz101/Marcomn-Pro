import LegalLinks from '@/app/components/LegalLinks';

export default function PublicSiteFooter() {
  return (
    <footer className="w-full border-t border-slate-200 bg-white px-5 py-7 text-center text-sm text-slate-500">
      <div className="mx-auto flex w-full max-w-7xl flex-col items-center">
        <LegalLinks className="w-full" />
        <p className="mt-4 text-xs">© 2026 MarComn. All rights reserved.</p>
      </div>
    </footer>
  );
}
