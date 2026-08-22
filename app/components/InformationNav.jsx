import Link from 'next/link';
import { Coins, FileText, ReceiptText, ShieldCheck } from 'lucide-react';

const informationLinks = [
  ['/credits', 'About MCredits', Coins],
  ['/legal/privacy', 'Privacy Policy', ShieldCheck],
  ['/legal/terms', 'Terms of Use', FileText],
  ['/legal/payments', 'Payments & Refunds', ReceiptText],
];

function PageLinks({ currentPath }) {
  return (
    <ul className="space-y-1.5">
      {informationLinks.map(([href, label, Icon]) => {
        const active = currentPath === href;
        return (
          <li key={href}>
            <Link
              href={href}
              aria-current={active ? 'page' : undefined}
              className={`flex min-h-11 items-center gap-3 rounded-md border-l-2 px-3 py-2 text-[15px] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00B4D8] ${active ? 'border-[#00B4D8] bg-[#eaf7fb] font-bold text-[#004173]' : 'border-transparent font-medium text-slate-600 hover:bg-slate-100 hover:text-[#004173]'}`}
            >
              <Icon size={17} aria-hidden="true" className="shrink-0" />
              <span>{label}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function SectionLinks({ sections }) {
  if (!sections?.length) return null;

  return (
    <div className="mt-7 border-t border-slate-200 pt-6">
      <h2 className="text-xs font-extrabold uppercase tracking-[0.14em] text-slate-500">On this page</h2>
      <ol className="mt-3 max-h-[48vh] space-y-0.5 overflow-y-auto pr-1">
        {sections.map((section) => (
          <li key={section.id}>
            <a
              href={`#${section.section_key}`}
              className="block rounded px-2 py-1.5 text-sm font-medium leading-5 text-slate-600 transition-colors hover:bg-slate-100 hover:text-[#007f9b] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00B4D8]"
            >
              {section.title}
            </a>
          </li>
        ))}
      </ol>
    </div>
  );
}

export default function InformationNav({ currentPath, sections = [] }) {
  return (
    <div className="min-w-0">
      <aside className="sticky top-6 hidden rounded-lg border border-slate-200 bg-white p-5 lg:block" aria-label="Marcomn Legal and Information Center">
        <div className="border-b border-slate-200 pb-4">
          <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#007f9b]">Marcomn</p>
          <h2 className="mt-1 text-xl font-bold tracking-tight text-[#0e2a4d]">Legal &amp; Information</h2>
        </div>
        <nav aria-label="Marcomn information and legal pages" className="mt-4">
          <PageLinks currentPath={currentPath} />
        </nav>
        <SectionLinks sections={sections} />
      </aside>

      <div className="rounded-lg border border-slate-200 bg-white p-4 lg:hidden">
        <p className="mb-3 text-xs font-extrabold uppercase tracking-[0.14em] text-[#007f9b]">Legal &amp; Information</p>
        <nav aria-label="Marcomn information and legal pages">
          <PageLinks currentPath={currentPath} />
        </nav>
        {sections.length > 0 && (
          <details className="mt-4 border-t border-slate-200 pt-4">
            <summary className="min-h-10 cursor-pointer py-2 text-sm font-bold text-[#0e2a4d] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00B4D8]">On this page</summary>
            <SectionLinks sections={sections} />
          </details>
        )}
      </div>
    </div>
  );
}
