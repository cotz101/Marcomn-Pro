import LegalLinks from '@/app/components/LegalLinks';

export default function PublicSiteFooter() {
  return (
    <footer className="w-full border-t border-slate-300 bg-[#e9edf1] px-5 py-9 text-sm text-slate-600 sm:px-8 sm:py-11">
      <div className="mx-auto grid w-full max-w-7xl gap-8 md:grid-cols-[1fr_auto] md:items-start">
        <div className="space-y-3 text-center md:text-left">
          <div>
            <p className="font-extrabold tracking-[0.08em] text-[#0e2a4d]">MARCOMN PTE. LTD.</p>
            <p className="mt-1 text-xs">© 2026 MarComn. All rights reserved.</p>
          </div>
          <address className="text-xs not-italic leading-6 text-slate-500">
            VISION EXCHANGE<br />
            2 Venture Drive, #13-028<br />
            Singapore 608526<br />
            <a href="mailto:ops@marcomn.com" className="font-medium text-[#007f9b] hover:underline">Contact: ops@marcomn.com</a>
          </address>
        </div>
        <LegalLinks className="w-full md:w-auto md:justify-end" />
      </div>
    </footer>
  );
}
