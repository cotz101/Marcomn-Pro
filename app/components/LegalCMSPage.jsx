import Link from 'next/link';
import { CalendarDays } from 'lucide-react';
import InformationNav from '@/app/components/InformationNav';
import PublicSiteFooter from '@/app/components/PublicSiteFooter';
import PublicSiteHeader from '@/app/components/PublicSiteHeader';
import { LEGAL_EFFECTIVE_DATE } from '@/lib/legalContent';

const normalizeBrand = (text) => text.replaceAll('MarComn', 'Marcomn');

function InlineText({ text }) {
  const pieces = normalizeBrand(text).split(/(\[\[[^\]]+\|[^\]]+\]\])/g);
  return pieces.map((piece, index) => {
    const match = piece.match(/^\[\[([^|]+)\|([^\]]+)\]\]$/);
    return match ? <Link key={index} href={match[2]} className="text-[#007f9b] underline decoration-[#00B4D8]/40 underline-offset-2 hover:text-[#005f74]">{match[1]}</Link> : piece;
  });
}

export default function LegalCMSPage({ data }) {
  const { page, sections, faqs } = data;
  return (
    <div className="min-h-screen bg-[#f4f6f8] text-slate-700">
      <PublicSiteHeader />
      <main
        className="grid w-full max-w-[1200px] gap-6 px-4 py-6 sm:px-6 sm:py-8 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-8 lg:px-8 lg:py-10"
        style={{ marginInline: 'auto' }}
      >
        <InformationNav currentPath={`/${page.slug}`} sections={sections} />

        <article className="legal-center-document min-w-0 rounded-lg border border-slate-200 bg-white">
          <header className="border-b border-slate-200 pb-7">
            <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#007f9b]">Marcomn Legal</p>
            <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-[#0e2a4d] sm:text-4xl lg:text-[2.5rem] lg:leading-tight">Marcomn {normalizeBrand(page.title)}</h1>
            {page.meta_description && <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600 sm:text-[17px] sm:leading-8">{normalizeBrand(page.meta_description)}</p>}
          </header>

          <div className="mt-6 inline-flex items-start gap-2.5 rounded border border-[#b9e2ed] bg-[#eef9fc] px-3.5 py-2.5 text-sm font-semibold text-[#0e2a4d]">
            <CalendarDays size={19} aria-hidden="true" className="mt-0.5 shrink-0 text-[#007f9b]" />
            <span>Effective date: {LEGAL_EFFECTIVE_DATE}</span>
          </div>

          <div className="mt-9">
            {sections.map((item, itemIndex) => {
              const paragraphs = item.content
                .split('\n')
                .filter(Boolean)
                .filter((paragraph, index) => !(itemIndex === 0 && index === 0 && paragraph === `Effective date: ${LEGAL_EFFECTIVE_DATE}`));

              return (
                <section id={item.section_key} key={item.id} className={`scroll-mt-8 py-8 first:pt-0 sm:py-10 ${itemIndex > 0 ? 'border-t border-slate-200' : ''}`}>
                  <h2 className="mb-4 border-b border-slate-200 pb-3 text-xl font-bold leading-snug tracking-tight text-[#0e2a4d] sm:text-[1.4rem]">{item.title}</h2>
                  <div className="max-w-[800px] space-y-5">
                    {paragraphs.map((paragraph, index) => (
                      <p key={index} className="whitespace-pre-line text-base font-normal leading-8 text-slate-600 sm:text-[17px]">
                        <InlineText text={paragraph} />
                      </p>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>

          {faqs.length > 0 && (
            <section className="border-t border-slate-200 pt-9" aria-labelledby="legal-faq-heading">
              <h2 id="legal-faq-heading" className="text-2xl font-bold tracking-tight text-[#0e2a4d]">Frequently Asked Questions</h2>
              <div className="mt-5 divide-y divide-slate-200">{faqs.map((faq) => (
                <div key={faq.id} className="py-6 first:pt-0 last:pb-0">
                  <h3 className="text-lg font-semibold text-[#0e2a4d]">{faq.question}</h3>
                  <p className="mt-2 max-w-[800px] text-base leading-8 text-slate-600"><InlineText text={faq.answer} /></p>
                </div>
              ))}</div>
            </section>
          )}
        </article>
      </main>
      <PublicSiteFooter />
    </div>
  );
}
