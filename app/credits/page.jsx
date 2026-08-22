import Link from 'next/link';
import { createClient } from '@/lib/supabase-server';
import { getCMSPageData } from '@/lib/cmsPublicPage';
import InformationNav from '@/app/components/InformationNav';
import PublicSiteFooter from '@/app/components/PublicSiteFooter';
import PublicSiteHeader from '@/app/components/PublicSiteHeader';
import { Coins } from 'lucide-react';
import { ProfileProvider } from '@/app/context/ProfileContext';
import AppShell from '@/app/components/AppShell';

export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'About MCredits | Marcomn',
  description: 'A practical guide to Marcomn platform credits, packages, wallets, fees, and refunds.',
};

const normalizeBrand = (text) => text.replaceAll('MarComn', 'Marcomn');

const getTierName = (price) => {
  const p = Number(price);
  if (p <= 10) return "Basic";
  if (p <= 25) return "Starter";
  if (p <= 50) return "Pro";
  if (p <= 100) return "Business";
  if (p <= 250) return "Enterprise";
  return "Elite";
};

export default async function CreditsPage() {
  const data = await getCMSPageData('credits');

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let wallet = null;
  if (user) {
    const { data: walletData } = await supabase
      .from('mcredit_wallets')
      .select('*')
      .eq('owner_type', 'user')
      .eq('owner_id', user.id)
      .maybeSingle();
    wallet = walletData;
  }

  // Fallback 1: Page missing/unpublished
  if (!data) {
    if (user) {
      return (
        <ProfileProvider userId={user.id} userEmail={user.email}>
          <AppShell userEmail={user.email} userId={user.id}>
            <>
              <div className="min-h-screen w-full bg-gradient-to-b from-[#e8f1fb] via-[#f3f7fb] to-[#f3f7fb] pb-20 flex flex-col items-center justify-center text-center px-6 py-20">
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
              </div>
              <PublicSiteFooter />
            </>
          </AppShell>
        </ProfileProvider>
      );
    } else {
      return (
        <div className="min-h-screen flex flex-col bg-gradient-to-b from-[#e8f1fb] via-[#f3f7fb] to-[#f3f7fb]">
          <PublicSiteHeader />
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
          <PublicSiteFooter />
        </div>
      );
    }
  }

  const { page, sections, faqs, variables } = data;

  // Resolve packages
  let packages = [];
  try {
    if (variables['mcredit_topup_packages']) {
      const parsed = typeof variables['mcredit_topup_packages'] === 'string'
        ? JSON.parse(variables['mcredit_topup_packages'])
        : variables['mcredit_topup_packages'];
      
      if (Array.isArray(parsed)) {
        packages = parsed.filter(p => p.isActive).sort((a, b) => a.displayOrder - b.displayOrder);
      }
    }
  } catch (e) {
    console.error("Failed to parse packages in public credits page", e);
  }

  const recommendedId = (() => {
    if (packages.length === 0) return null;
    const match50 = packages.find(p => Number(p.usdPrice) === 50);
    if (match50) return match50.id || match50.usdPrice;
    const match100 = packages.find(p => Number(p.usdPrice) === 100);
    if (match100) return match100.id || match100.usdPrice;
    const midIndex = Math.floor(packages.length / 2);
    return packages[midIndex].id || packages[midIndex].usdPrice;
  })();

  const renderContent = () => (
    <div className="min-h-screen w-full bg-[#f4f6f8]">
      {/* CSS Override to hide sidebars and center the feed in AppShell */}
      <style dangerouslySetInnerHTML={{ __html: `
        aside.sidebar-left, aside.sidebar-right {
          display: none !important;
        }
        .main-grid {
          display: block !important;
          max-width: 100% !important;
        }
        .center-feed {
          max-width: 100% !important;
          width: 100% !important;
          padding: 0 !important;
        }
      `}} />

      <div
        className="grid w-full max-w-[1200px] gap-6 px-4 py-6 sm:px-6 sm:py-8 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-8 lg:px-8 lg:py-10"
        style={{ marginInline: 'auto' }}
      >
        <InformationNav currentPath="/credits" sections={sections} />

        <article className="legal-center-document min-w-0 rounded-lg border border-slate-200 bg-white">
          <header className="border-b border-slate-200 pb-7">
            <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#007f9b]">Marcomn MCredits</p>
            <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-[#0e2a4d] sm:text-4xl lg:text-[2.5rem] lg:leading-tight">{normalizeBrand(page.title || 'About MCredits')}</h1>
            {page.meta_description && <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600 sm:text-[17px] sm:leading-8">{normalizeBrand(page.meta_description)}</p>}
          </header>

        {/* User Balance / Available Funds Card */}
        {user ? (
          <div className="mt-6 flex w-full flex-col items-center justify-between gap-4 rounded-md border border-[#a8ddec] bg-[#eef9fc] p-5 sm:flex-row sm:p-6">
            <div className="flex items-center gap-4 text-left">
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl shrink-0">
                <Coins size={24} />
              </div>
              <div>
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Available Funds</h3>
                <p className="text-2xl font-extrabold text-[#0e2a4d] mt-0.5">
                  {wallet ? `${Number(wallet.balance).toFixed(2)} MC` : '0.00 MC'}
                </p>
              </div>
            </div>
            <Link 
              href="/profile/wallet" 
              className="text-xs font-bold px-6 py-3 rounded-xl transition-all hover:opacity-90 shadow-sm shrink-0"
              style={{ backgroundColor: '#00B4D8', color: '#0e2a4d' }}
            >
              Go to Wallet
            </Link>
          </div>
        ) : null}

        {/* Fallback 2: No Sections */}
        {sections.length === 0 ? (
          <div className="py-10 text-center w-full">
            <p className="text-sm text-gray-500 font-medium font-sans">No content sections available yet.</p>
          </div>
        ) : (
          <div className="w-full">
            {sections.map((section, sectionIndex) => {
              const paragraphs = section.content.split('\n').filter(p => p.trim() !== '');
              return (
                <section 
                  key={section.id} 
                  className={`w-full space-y-5 py-8 text-left sm:py-10 ${sectionIndex > 0 ? 'border-t border-slate-200' : ''}`}
                >
                  <h2 className="border-b border-slate-200 pb-3 text-xl font-bold leading-snug tracking-tight text-[#0e2a4d] sm:text-[1.4rem]">
                    {section.title}
                  </h2>
                  <div className="space-y-4">
                    {paragraphs.map((para, i) => (
                      <p key={i} className="text-base font-normal leading-8 text-slate-600 sm:text-[17px]">
                        {normalizeBrand(para)}
                      </p>
                    ))}
                  </div>

                  {section.section_key === 'refunds' && (
                    <Link href="/legal/payments" className="inline-flex text-sm font-bold text-[#007f9b] underline hover:text-[#005f74]">
                      Read the MCredits, Payments & Refund Policy
                    </Link>
                  )}

                  {/* Pricing grid injection under available-packages section */}
                  {section.section_key === 'available-packages' && (
                    <div className="mt-7 rounded-lg border border-[#dceaf3] bg-[#f8fbfd] p-4 sm:p-6">
                      {packages.length === 0 ? (
                        <p className="text-xs text-red-500 font-bold">No active top-up packages currently available.</p>
                      ) : (
                        <div className="space-y-4">
                          <span className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Preset Pricing Packages</span>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {packages.map((pkg) => {
                              const isPromo = (pkg.id || pkg.usdPrice) === recommendedId;
                              return (
                                <div
                                  key={pkg.id || pkg.usdPrice}
                                  className={`relative flex flex-col justify-between rounded-lg border p-5 transition-colors duration-200 ${
                                    isPromo 
                                      ? 'border-[#8fd3e5] bg-[#f4fbfd]'
                                      : 'border-slate-200 bg-white hover:border-[#9dd8e7]'
                                  }`}
                                >
                                  {isPromo && (
                                    <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded border border-[#9dd8e7] bg-[#dff3f8] px-2.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-[#005f74]">
                                      Most Popular
                                    </span>
                                  )}
                                  
                                  <div className="text-center space-y-2 py-2">
                                    <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                                      {pkg.name || getTierName(pkg.usdPrice)}
                                    </span>
                                    <div className="flex items-baseline justify-center gap-0.5">
                                      <span className="text-2xl font-extrabold text-[#0e2a4d]">${pkg.usdPrice}</span>
                                      <span className="text-[10px] text-gray-400 font-bold ml-1">USD</span>
                                    </div>
                                    
                                    <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold select-none mx-auto mt-1">
                                      <Coins size={12} className="text-emerald-600 shrink-0" />
                                      <span>+{pkg.mcreditAmount} MC</span>
                                    </div>
                                  </div>

                                  <Link
                                    href="/profile/wallet"
                                    className="mt-4 w-full rounded-md border border-[#b9e2ed] bg-[#dff3f8] px-4 py-2.5 text-center text-xs font-bold text-[#004173] transition-colors hover:bg-[#cfeaf2] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#007f9b]"
                                  >
                                    Purchase
                                  </Link>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}

        {/* FAQs Section */}
        {faqs.length > 0 && (
          <section className="w-full border-t border-slate-200 py-7 text-left sm:py-9">
            <h2 className="text-2xl font-bold leading-snug tracking-tight text-[#0e2a4d] sm:text-[1.65rem]">Frequently Asked Questions</h2>
            <div className="mt-5 divide-y divide-slate-200">
              {faqs.map((faq) => (
                <div 
                  key={faq.id} 
                  className="py-5 first:pt-0 last:pb-0"
                >
                  <h3 className="mb-2 text-left text-base font-bold text-[#0e2a4d] md:text-lg">
                    {faq.question}
                  </h3>
                  <p className="text-left text-base font-normal leading-8 text-slate-600">
                    {normalizeBrand(faq.answer)}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}
        </article>
      </div>
    </div>
  );

  if (user) {
    return (
      <ProfileProvider userId={user.id} userEmail={user.email}>
        <AppShell userEmail={user.email} userId={user.id}>
          <>
            {renderContent()}
            <PublicSiteFooter />
          </>
        </AppShell>
      </ProfileProvider>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#f4f7fb]">
      <PublicSiteHeader />

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center w-full">
        {renderContent()}
      </main>

      <PublicSiteFooter />
    </div>
  );
}
