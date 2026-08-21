import Link from 'next/link';
import LandingLogo from '@/app/components/LandingLogo';
import LegalLinks from '@/app/components/LegalLinks';
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
    <div className="min-h-screen bg-gradient-to-b from-[#e8f1fb] via-[#f3f7fb] to-[#f3f7fb] text-slate-700">
      <header className="sticky top-0 z-40 border-b border-slate-100 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3 sm:px-8">
          <Link href="/" aria-label="MarComn home"><LandingLogo /></Link>
          <Link href="/login" className="rounded-xl bg-[#00B4D8] px-4 py-2 text-xs font-bold text-[#0e2a4d] hover:opacity-90">Sign In</Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="mb-9 text-center sm:text-left">
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-[#008eaa]">MarComn Legal</p>
          <h1 className="text-3xl font-extrabold tracking-tight text-[#0e2a4d] sm:text-4xl">{page.title}</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 sm:text-base">{page.meta_description}</p>
          <p className="mt-4 text-sm font-semibold text-slate-500">Effective date: {LEGAL_EFFECTIVE_DATE}</p>
        </div>
        <div className="space-y-5">
          {sections.map((item) => (
            <section key={item.id} className="rounded-2xl bg-white p-5 shadow-[0_8px_30px_rgba(14,42,77,0.035)] sm:p-8">
              <h2 className="mb-4 border-b border-slate-100 pb-3 text-lg font-bold text-[#0e2a4d] sm:text-xl">{item.title}</h2>
              <div className="space-y-3">
                {item.content.split('\n').filter(Boolean).map((paragraph, index) => (
                  <p key={index} className="whitespace-pre-line text-sm font-medium leading-7 text-slate-600 sm:text-[15px]">
                    <InlineText text={paragraph} />
                  </p>
                ))}
              </div>
            </section>
          ))}
        </div>
        {faqs.length > 0 && (
          <section className="mt-10">
            <h2 className="mb-5 text-xl font-bold text-[#0e2a4d]">Frequently Asked Questions</h2>
            <div className="space-y-4">{faqs.map((faq) => (
              <article key={faq.id} className="rounded-2xl bg-white p-5 sm:p-6">
                <h3 className="font-bold text-[#0e2a4d]">{faq.question}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600"><InlineText text={faq.answer} /></p>
              </article>
            ))}</div>
          </section>
        )}
      </main>
      <footer className="border-t border-slate-100 bg-white px-5 py-8 text-center text-xs text-slate-500">
        <LegalLinks />
        <p className="mt-5">© 2026 MarComn. All rights reserved.</p>
      </footer>
    </div>
  );
}
