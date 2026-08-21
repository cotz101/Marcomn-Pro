import { CalendarDays } from 'lucide-react';

export default function PolicyHero({ eyebrow, title, description, effectiveDate }) {
  return (
    <div className="mx-auto max-w-3xl text-center">
      <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#007f9b]">
        {eyebrow}
      </p>
      <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-[#0e2a4d] sm:text-4xl lg:text-[2.75rem] lg:leading-tight">
        {title}
      </h1>
      {description && (
        <p className="mx-auto mt-4 max-w-2xl text-sm font-medium leading-7 text-slate-600 sm:text-base">
          {description}
        </p>
      )}
      {effectiveDate && (
        <div className="mt-6 inline-flex min-h-10 items-center gap-2 rounded-full border border-[#00B4D8]/20 bg-[#e8f7fb] px-4 py-2 text-sm font-bold text-[#0e2a4d]">
          <CalendarDays size={16} aria-hidden="true" />
          <span>Effective date: {effectiveDate}</span>
        </div>
      )}
    </div>
  );
}
