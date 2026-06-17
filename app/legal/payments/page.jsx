import Link from 'next/link';
import LandingLogo from '@/app/components/LandingLogo';
import { createClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

async function getCMSPageData(slug) {
  try {
    const supabase = await createClient();

    // 1. Fetch page
    const { data: page, error: pageError } = await supabase
      .from('cms_pages')
      .select('*')
      .eq('slug', slug)
      .eq('is_published', true)
      .single();

    if (pageError || !page) {
      return null;
    }

    // 2. Fetch sections
    const { data: sections } = await supabase
      .from('cms_page_sections')
      .select('*')
      .eq('page_id', page.id)
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    // 3. Fetch FAQs
    const { data: faqs } = await supabase
      .from('cms_faqs')
      .select('*')
      .eq('page_id', page.id)
      .eq('is_published', true)
      .order('sort_order', { ascending: true });

    // 4. Fetch content variables
    const variables = {};

    const { data: cmsVars } = await supabase
      .from('cms_content_variables')
      .select('variable_key, value')
      .eq('is_public', true);
    
    cmsVars?.forEach(v => {
      variables[v.variable_key] = v.value;
    });

    // Merge platform settings
    const { data: platformSettings } = await supabase
      .from('platform_settings')
      .select('key, value');
    
    platformSettings?.forEach(s => {
      variables[s.key] = s.value;
    });

    const formatText = (text) => {
      if (!text) return '';
      return text.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
        const trimmedKey = key.trim();
        return variables[trimmedKey] !== undefined ? variables[trimmedKey] : match;
      });
    };

    return {
      page,
      sections: (sections || []).map(s => ({
        ...s,
        title: formatText(s.title),
        content: formatText(s.content)
      })),
      faqs: (faqs || []).map(f => ({
        ...f,
        question: formatText(f.question),
        answer: formatText(f.answer)
      })),
      variables
    };
  } catch (error) {
    console.error(`Error fetching CMS page data for slug: ${slug}`, error);
    return null;
  }
}

export default async function PaymentsLegalPage() {
  const data = await getCMSPageData('legal/payments');

  // Fallback 1: Page missing/unpublished
  if (!data) {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-b from-[#e8f1fb] via-[#f3f7fb] to-[#f3f7fb]">
        <header className="bg-white border-b border-gray-100 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-6 md:px-12 py-3 flex items-center justify-between w-full">
            <Link href="/" className="flex items-center">
              <LandingLogo />
            </Link>
            <Link 
              href="/login" 
              className="text-xs font-bold px-4 py-2 rounded-xl text-white transition-all hover:opacity-90 bg-[#00B4D8]"
            >
              Sign In
            </Link>
          </div>
        </header>
        <main className="flex-1 flex flex-col items-center justify-center text-center px-6 py-20">
          <h1 className="text-4xl font-extrabold text-[#0e2a4d] mb-4">Page Not Found</h1>
          <p className="text-gray-500 mb-8 max-w-md">
            The requested page is either not configured or has not been published by administrators.
          </p>
          <Link 
            href="/" 
            className="text-sm font-bold px-6 py-3 rounded-xl transition-all hover:opacity-90"
            style={{ backgroundColor: '#00B4D8', color: '#0e2a4d' }}
          >
            Back to Home
          </Link>
        </main>
      </div>
    );
  }

  const { page, sections, faqs } = data;

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-[#e8f1fb] via-[#f3f7fb] to-[#f3f7fb]">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 md:px-12 py-3 flex items-center justify-between w-full">
          <Link href="/" className="flex items-center">
            <LandingLogo />
          </Link>
          <Link 
            href="/login" 
            className="text-xs font-bold px-4 py-2 rounded-xl text-white transition-all hover:opacity-90 bg-[#00B4D8]"
          >
            Sign In
          </Link>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-3xl mx-auto px-5 sm:px-6 py-12 w-full">
        {/* Page Title & Meta Description */}
        <div className="mb-10 text-center sm:text-left">
          <h1 className="text-3xl font-extrabold text-[#0e2a4d] tracking-tight">{page.title}</h1>
          {page.meta_description && (
            <p className="text-sm text-gray-500 mt-2 font-medium leading-relaxed max-w-2xl">
              {page.meta_description}
            </p>
          )}
          <div className="h-px bg-gray-200 mt-6 w-full"></div>
        </div>

        {/* Fallback 2: No Sections */}
        {sections.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center shadow-[0_8px_30px_rgba(14,42,77,0.025)] border-0">
            <p className="text-sm text-gray-500 font-medium">No content sections available yet.</p>
          </div>
        ) : (
          <div className="space-y-10">
            {sections.map((section) => {
              const paragraphs = section.content.split('\n').filter(p => p.trim() !== '');
              return (
                <section 
                  key={section.id} 
                  className="bg-white rounded-2xl p-6 sm:p-8 shadow-[0_8px_30px_rgba(14,42,77,0.025)] border-0"
                >
                  <h2 className="text-lg font-bold text-[#0e2a4d] mb-4 border-b border-slate-50 pb-2">
                    {section.title}
                  </h2>
                  <div className="space-y-4">
                    {paragraphs.map((para, i) => (
                      <p key={i} className="text-sm text-gray-600 leading-relaxed font-medium">
                        {para}
                      </p>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}

        {/* FAQs Section */}
        {faqs.length > 0 && (
          <section className="mt-16">
            <h2 className="text-xl font-bold text-[#0e2a4d] mb-6 tracking-tight">Frequently Asked Questions</h2>
            <div className="space-y-4">
              {faqs.map((faq) => (
                <div 
                  key={faq.id} 
                  className="bg-white rounded-2xl p-6 shadow-[0_8px_30px_rgba(14,42,77,0.025)] border-0"
                >
                  <h3 className="font-bold text-[#0e2a4d] text-sm mb-2">
                    {faq.question}
                  </h3>
                  <p className="text-gray-600 text-xs sm:text-sm leading-relaxed font-medium">
                    {faq.answer}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="text-center py-8 text-xs text-gray-400 border-t border-gray-100 bg-white mt-20">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span>© 2026 MarComn. All rights reserved.</span>
          <div className="flex gap-4">
            <Link href="/credits" className="hover:text-gray-600 font-medium">Credits</Link>
            <Link href="/legal/payments" className="hover:text-gray-600 font-medium">Payment Policies</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
