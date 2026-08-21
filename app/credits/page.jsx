import Link from 'next/link';
import LandingLogo from '@/app/components/LandingLogo';
import { createClient } from '@/lib/supabase-server';
import { getCMSPageData } from '@/lib/cmsPublicPage';
import LegalLinks from '@/app/components/LegalLinks';
import { Coins, Ship, LayoutGrid, Newspaper, MessageSquare, Bell, Briefcase } from 'lucide-react';
import { ProfileProvider } from '@/app/context/ProfileContext';
import AppShell from '@/app/components/AppShell';

export const dynamic = 'force-dynamic';

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
          </AppShell>
        </ProfileProvider>
      );
    } else {
      return (
        <div className="min-h-screen flex flex-col bg-gradient-to-b from-[#e8f1fb] via-[#f3f7fb] to-[#f3f7fb]">
          <header className="header app-header">
            <div className="app-container">
              <div className="w-full flex items-center justify-between py-2 px-4 h-[calc(76px+env(safe-area-inset-top))] md:h-auto md:min-h-[64px] pt-[calc(env(safe-area-inset-top)+20px)] md:pt-1">
                <div className="flex items-center gap-3 flex-1 md:flex-none">
                  <Link href="/" className="logo font-semibold text-[#002b4e] flex items-center">
                    <span>Mar<span>Comn</span></span>
                  </Link>
                </div>
                <div className="hidden md:flex items-center justify-center !mt-[10px] flex-1">
                  <Link href="/logbook" className="nav-link">
                    <Ship size={24} />
                    <span>MNetwork</span>
                  </Link>
                  <Link href="/mservices" className="nav-link">
                    <LayoutGrid size={24} />
                    <span>MServices</span>
                  </Link>
                  <Link href="/mblog" className="nav-link">
                    <Newspaper size={24} />
                    <span>MBlogs</span>
                  </Link>
                </div>
                <div className="flex items-center gap-1.5 md:gap-3 flex-shrink-0">
                  <Link href="/login" className="header-icon-btn scale-110 md:scale-100 flex-shrink-0">
                    <MessageSquare size={26} />
                  </Link>
                  <Link href="/login" className="header-icon-btn relative hidden md:block">
                    <Bell size={22} />
                  </Link>
                  <Link 
                    href="/login"
                    className="btn-primary-pill px-2.5 py-1.5 md:px-5 ml-1.5 md:ml-3 flex items-center justify-center mr-1 md:mr-3 flex-shrink-0 text-sm font-bold"
                    style={{ backgroundColor: 'var(--primary-container)', color: '#002b4e' }}
                  >
                    <Briefcase size={16} className="md:mr-2" />
                    <span className="hidden md:inline whitespace-nowrap">Post a Job</span>
                  </Link>
                  <Link 
                    href="/login" 
                    className="text-xs font-bold px-4 py-2 rounded-xl transition-all hover:opacity-90"
                    style={{ backgroundColor: '#00B4D8', color: '#0e2a4d' }}
                  >
                    Sign In
                  </Link>
                </div>
              </div>
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
    <div className="w-full bg-gradient-to-b from-[#e8f1fb] via-[#f3f7fb] to-[#f3f7fb] min-h-screen pb-20 flex flex-col items-center">
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

      <div className="w-full max-w-4xl mx-auto px-4 py-8 md:py-12 space-y-6 md:space-y-8 flex flex-col items-center">
        {/* Page Title & Meta Description */}
        <div className="text-center max-w-2xl mx-auto space-y-2.5 mb-2 w-full">
          <h1 className="text-3xl md:text-4xl font-extrabold text-[#0e2a4d] tracking-tight">
            {page.title || "MCredits Guide & Pricing"}
          </h1>
          {page.meta_description && (
            <p className="text-sm md:text-base text-gray-500 font-medium leading-relaxed">
              {page.meta_description}
            </p>
          )}
        </div>

        {/* User Balance / Available Funds Card */}
        {user ? (
          <div className="bg-white rounded-2xl shadow-[0_8px_30px_rgba(14,42,77,0.025)] p-6 md:p-8 flex flex-col sm:flex-row items-center justify-between gap-4 w-full">
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
        ) : (
          <div className="bg-white rounded-2xl shadow-[0_8px_30px_rgba(14,42,77,0.025)] p-6 md:p-8 flex flex-col sm:flex-row items-center justify-between gap-4 w-full">
            <div className="flex items-center gap-3 text-left">
              <div className="p-2 bg-blue-50 text-[#00B4D8] rounded-lg shrink-0">
                <Coins size={20} />
              </div>
              <p className="text-sm text-gray-500 font-medium">
                Track your live balance, transaction history, and buy preset packages by signing in.
              </p>
            </div>
            <Link 
              href="/login" 
              className="text-xs font-bold px-5 py-3 rounded-xl transition-all hover:opacity-90 shadow-sm shrink-0"
              style={{ backgroundColor: '#00B4D8', color: '#0e2a4d' }}
            >
              Sign In
            </Link>
          </div>
        )}

        {/* Fallback 2: No Sections */}
        {sections.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center shadow-[0_8px_30px_rgba(14,42,77,0.025)] w-full">
            <p className="text-sm text-gray-500 font-medium font-sans">No content sections available yet.</p>
          </div>
        ) : (
          <div className="space-y-6 md:space-y-8 w-full">
            {sections.map((section) => {
              const paragraphs = section.content.split('\n').filter(p => p.trim() !== '');
              return (
                <section 
                  key={section.id} 
                  className="bg-white rounded-2xl p-6 md:p-8 shadow-[0_8px_30px_rgba(14,42,77,0.025)] space-y-4 w-full text-left"
                >
                  <h2 className="text-lg md:text-xl font-bold text-[#0e2a4d] border-b border-slate-50 pb-2">
                    {section.title}
                  </h2>
                  <div className="space-y-4">
                    {paragraphs.map((para, i) => (
                      <p key={i} className="text-sm text-gray-600 leading-relaxed font-medium">
                        {para}
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
                    <div className="mt-8 pt-6 border-t border-slate-100/60">
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
                                  className={`relative p-5 rounded-2xl flex flex-col justify-between transition-all duration-200 ${
                                    isPromo 
                                      ? 'bg-white shadow-[0_8px_24px_rgba(14,42,77,0.06)] ring-2 ring-[#00B4D8]/30 scale-[1.02] md:scale-105 z-10 border-0' 
                                      : 'bg-slate-50/60 hover:bg-slate-50/80 shadow-none border-0'
                                  }`}
                                >
                                  {isPromo && (
                                    <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-[#00B4D8] text-[#0e2a4d] text-[9px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider shadow-sm">
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
                                    className="mt-4 w-full text-center py-2.5 px-4 rounded-xl text-xs font-bold transition-all shadow-sm hover:opacity-95 hover:shadow-md active:scale-[0.98]"
                                    style={{ backgroundColor: '#00B4D8', color: '#0e2a4d' }}
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
          <section className="space-y-6 w-full">
            <h2 className="text-xl font-bold text-[#0e2a4d] tracking-tight text-left">Frequently Asked Questions</h2>
            <div className="space-y-4">
              {faqs.map((faq) => (
                <div 
                  key={faq.id} 
                  className="bg-white rounded-2xl p-6 md:p-8 shadow-[0_8px_30px_rgba(14,42,77,0.025)]"
                >
                  <h3 className="font-bold text-[#0e2a4d] text-sm md:text-base mb-2 text-left">
                    {faq.question}
                  </h3>
                  <p className="text-gray-600 text-xs sm:text-sm leading-relaxed font-medium text-left">
                    {faq.answer}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );

  if (user) {
    return (
      <ProfileProvider userId={user.id} userEmail={user.email}>
        <AppShell userEmail={user.email} userId={user.id}>
          {renderContent()}
        </AppShell>
      </ProfileProvider>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-[#e8f1fb] via-[#f3f7fb] to-[#f3f7fb]">
      {/* Mimic AppShell Header for logged-out users */}
      <header className="header app-header">
        <div className="app-container">
          <div className="w-full flex items-center justify-between py-2 px-4 h-[calc(76px+env(safe-area-inset-top))] md:h-auto md:min-h-[64px] pt-[calc(env(safe-area-inset-top)+20px)] md:pt-1">
            {/* LEFT: Logo */}
            <div className="flex items-center gap-3 flex-1 md:flex-none">
              <Link href="/" className="logo font-semibold text-[#002b4e] flex items-center">
                <span>Mar<span>Comn</span></span>
              </Link>
            </div>

            {/* CENTER: Main Navigation (Desktop Only) */}
            <div className="hidden md:flex items-center justify-center !mt-[10px] flex-1">
              <Link href="/logbook" className="nav-link">
                <Ship size={24} />
                <span>MNetwork</span>
              </Link>
              <Link href="/mservices" className="nav-link">
                <LayoutGrid size={24} />
                <span>MServices</span>
              </Link>
              <Link href="/mblog" className="nav-link">
                <Newspaper size={24} />
                <span>MBlogs</span>
              </Link>
            </div>

            {/* RIGHT: Actions */}
            <div className="flex items-center gap-1.5 md:gap-3 flex-shrink-0">
              {/* Message Icon */}
              <Link href="/login" className="header-icon-btn scale-110 md:scale-100 flex-shrink-0 relative">
                <MessageSquare size={26} />
              </Link>

              {/* Bell Icon */}
              <Link href="/login" className="header-icon-btn relative hidden md:block">
                <Bell size={22} />
              </Link>

              {/* Post a Job Button */}
              <Link 
                href="/login"
                className="btn-primary-pill px-2.5 py-1.5 md:px-5 ml-1.5 md:ml-3 flex items-center justify-center mr-1 md:mr-3 flex-shrink-0 text-sm font-bold"
                style={{ backgroundColor: 'var(--primary-container)', color: '#002b4e' }}
              >
                <Briefcase size={16} className="md:mr-2" />
                <span className="hidden md:inline whitespace-nowrap">Post a Job</span>
              </Link>

              {/* Sign In Button */}
              <Link 
                href="/login" 
                className="text-xs font-bold px-4 py-2 rounded-xl transition-all hover:opacity-90"
                style={{ backgroundColor: '#00B4D8', color: '#0e2a4d' }}
              >
                Sign In
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center w-full">
        {renderContent()}
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="mobile-bottom-nav md:hidden" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 8px)' }}>
        <Link 
          href="/login" 
          className="mobile-nav-item"
          style={{ '--active-color': '#002b4e' }}
        >
          <Ship size={24} className="mobile-nav-icon" />
          <span className="mobile-nav-label">MNetwork</span>
        </Link>
        <Link 
          href="/login" 
          className="mobile-nav-item"
          style={{ '--active-color': '#002b4e' }}
        >
          <LayoutGrid size={24} className="mobile-nav-icon" />
          <span className="mobile-nav-label">MServices</span>
        </Link>
        <Link 
          href="/login" 
          className="mobile-nav-item"
          style={{ '--active-color': '#002b4e' }}
        >
          <Newspaper size={24} className="mobile-nav-icon" />
          <span className="mobile-nav-label">MBlogs</span>
        </Link>
        <Link 
          href="/login"
          className="mobile-nav-item"
          style={{ '--active-color': '#002b4e' }}
        >
          <Bell size={24} className="mobile-nav-icon" />
          <span className="mobile-nav-label">Alerts</span>
        </Link>
      </nav>

      {/* Footer */}
      <footer className="text-center py-8 text-xs text-gray-400 border-t border-gray-100 bg-white">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span>© 2026 MarComn. All rights reserved.</span>
          <LegalLinks />
        </div>
      </footer>
    </div>
  );
}
