import LegalLinks from '@/app/components/LegalLinks';

export default function PublicSiteFooter() {
  return (
    <footer className="border-t border-slate-200 bg-white px-5 py-8 text-center text-xs text-slate-500">
      <div className="mx-auto max-w-7xl">
        <LegalLinks />
        <p className="mt-5">© 2026 MarComn. All rights reserved.</p>
      </div>
    </footer>
  );
}
