import Link from 'next/link';
import LandingLogo from '@/app/components/LandingLogo';
import LegalLinks from '@/app/components/LegalLinks';
import PolicyHero from '@/app/components/PolicyHero';
import { LEGAL_EFFECTIVE_DATE } from '@/lib/legalContent';

function InlineText({ text }) {
  const pieces = text.split(/(\[\[[^\]]+\|[^\]]+\]\])/g);
  return pieces.map((piece, index) => {
    const match = piece.match(/^\[\[([^|]+)\|([^\]]+)\]\]$/);
    return match ? <Link key={index} href={match[2]} className="text-[#007f9b] underline hover:text-[#005f74]">{match[1]}</Link> : piece;
  });
}

export default function LegalCMSPage({ data }) {
  const { page, sections, faqs } = data;
  return (
    <div className="min-h-screen bg-[#f4f7fb] text-slate-700">
      <header className="sticky top-0 z-40 border-b border-slate-100 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3 sm:px-8">
          <Link href="/" aria-label="MarComn home"><LandingLogo /></Link>
          <Link href="/login" className="rounded-xl bg-[#00B4D8] px-4 py-2 text-xs font-bold text-[#0e2a4d] hover:opacity-90">Sign In</Link>
        </div>
      </header>
      <main>
        <div className="border-b border-[#dceaf3] bg-gradient-to-b from-[#e8f4fb] to-[#f4f7fb] px-5 py-12 sm:px-8 sm:py-16 lg:py-20">
          <PolicyHero eyebrow="MarComn Legal" title={page.title} description={page.meta_description} effectiveDate={LEGAL_EFFECTIVE_DATE} />
        </div>

        <div className="mx-auto grid w-full max-w-[1280px] gap-8 px-4 py-8 sm:px-6 sm:py-10 md:px-8 lg:grid-cols-[240px_minmax(0,880px)] lg:justify-center lg:gap-10 lg:px-12 lg:py-14">
          <aside className="hidden lg:block" aria-label="On this page">
            <nav className="sticky top-24 rounded-2xl border border-slate-200 bg-white/80 p-5">
              <h2 className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#0e2a4d]">On this page</h2>
              <ol className="mt-4 space-y-1 border-l border-slate-200">
                {sections.map((item) => (
                  <li key={item.id}>
                    <a href={`#${item.section_key}`} className="block border-l-2 border-transparent py-1.5 pl-4 text-xs font-semibold leading-5 text-slate-500 transition-colors hover:border-[#00B4D8] hover:text-[#007f9b] focus-visible:rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00B4D8]">
                      {item.title}
                    </a>
                  </li>
                ))}
              </ol>
            </nav>
          </aside>

          <div className="min-w-0">
            <details className="mb-5 rounded-xl border border-slate-200 bg-white px-4 py-3 lg:hidden">
              <summary className="min-h-7 cursor-pointer text-sm font-bold text-[#0e2a4d] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00B4D8]">On this page</summary>
              <ol className="mt-3 space-y-1 border-t border-slate-100 pt-3">
                {sections.map((item) => (
                  <li key={item.id}><a href={`#${item.section_key}`} className="block min-h-10 py-2 text-sm font-medium leading-6 text-[#007f9b] underline-offset-4 hover:underline">{item.title}</a></li>
                ))}
              </ol>
            </details>

            <div className="legal-document-surface rounded-2xl border border-slate-200 bg-white shadow-[0_12px_40px_rgba(14,42,77,0.045)]">
              {sections.map((item, itemIndex) => (
                <section id={item.section_key} key={item.id} className={`scroll-mt-28 py-7 sm:py-9 ${itemIndex > 0 ? 'border-t border-slate-200' : ''}`}>
                  <h2 className="mb-4 text-xl font-bold leading-snug text-[#0e2a4d] sm:text-[1.35rem]">{item.title}</h2>
                  <div className="space-y-4">
                {item.content.split('\n').filter(Boolean).map((paragraph, index) => (
                  <p key={index} className="whitespace-pre-line text-[15px] font-normal leading-7 text-slate-600 sm:text-base sm:leading-7">
                    <InlineText text={paragraph} />
                  </p>
                ))}
                  </div>
                </section>
              ))}
            </div>

            {faqs.length > 0 && (
              <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 sm:p-8" aria-labelledby="legal-faq-heading">
                <h2 id="legal-faq-heading" className="mb-5 text-xl font-bold text-[#0e2a4d]">Frequently Asked Questions</h2>
                <div className="divide-y divide-slate-200">{faqs.map((faq) => (
                  <div key={faq.id} className="py-5 first:pt-0 last:pb-0">
                    <h3 className="font-bold text-[#0e2a4d]">{faq.question}</h3>
                    <p className="mt-2 text-sm leading-7 text-slate-600"><InlineText text={faq.answer} /></p>
                  </div>
                ))}</div>
              </section>
            )}
          </div>
        </div>
      </main>
      <footer className="border-t border-slate-100 bg-white px-5 py-8 text-center text-xs text-slate-500">
        <LegalLinks />
        <p className="mt-5">© 2026 MarComn. All rights reserved.</p>
      </footer>
    </div>
  );
}
