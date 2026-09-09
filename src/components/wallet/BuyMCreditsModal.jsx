'use client';

import Link from 'next/link';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogBody, 
  DialogFooter, 
  DialogNotice 
} from '@/src/components/ui/dialog';
import { Coins, CreditCard, Loader2 } from 'lucide-react';

export default function BuyMCreditsModal({
  isOpen,
  onClose,
  context = 'company', // 'company' | 'personal'
  modalTab,
  setModalTab,
  displayPackages = [],
  topupAmount,
  setTopupAmount,
  mcreditsPerUsd = 1.0,
  submittingStripe = false,
  topupMessage = null,
  onStripeCheckout,
}) {
  const isCompany = context === 'company';
  const descriptionText = isCompany
    ? 'Top up your company wallet securely via Stripe. Credits are applied automatically after payment.'
    : 'Top up your wallet securely via Stripe. Credits are applied automatically after payment.';

  const handleClose = () => {
    if (!submittingStripe) {
      onClose();
    }
  };

  const isCustomValid = 
    topupAmount && 
    !isNaN(Number(topupAmount)) && 
    Number(topupAmount) >= 5 && 
    Number(topupAmount) <= 10000 && 
    Number(Number(topupAmount).toFixed(2)) === Number(topupAmount);

  return (
    <Dialog
      isOpen={isOpen}
      onClose={handleClose}
      disableBackdropClick={submittingStripe}
      disableEscapeKey={submittingStripe}
    >
      <DialogContent maxWidth="md" className="max-w-[480px]">
        {/* MarComn Navy Branded Header */}
        <DialogHeader
          title="Buy MCredits"
          onClose={handleClose}
        />

        {/* Modal Body with consistent 20px / 24px content grid */}
        <DialogBody className="space-y-5">
          <div className="buy-mcredits-content w-full flex flex-col space-y-5">
            {/* Introductory Description */}
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-normal">
              {descriptionText}
            </p>

          {/* Status / Error Toast Message */}
          {topupMessage && (
            <DialogNotice
              variant={topupMessage.type === 'success' ? 'success' : 'destructive'}
              className="text-xs"
            >
              {topupMessage.text}
            </DialogNotice>
          )}

          {/* Segmented Control Tabs */}
          <div className="select-none pt-1">
            <div className="flex bg-slate-100/90 p-1.5 rounded-xl gap-1">
              <button
                type="button"
                onClick={() => setModalTab('package')}
                disabled={submittingStripe}
                className={`flex-1 py-2 text-xs font-bold text-center rounded-lg transition-all cursor-pointer ${
                  modalTab === 'package'
                    ? 'bg-white text-[#002b4e] shadow-xs'
                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                }`}
              >
                Package Top-Up
              </button>
              <button
                type="button"
                onClick={() => setModalTab('custom')}
                disabled={submittingStripe}
                className={`flex-1 py-2 text-xs font-bold text-center rounded-lg transition-all cursor-pointer ${
                  modalTab === 'custom'
                    ? 'bg-white text-[#002b4e] shadow-xs'
                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                }`}
              >
                Custom Amount
              </button>
            </div>
          </div>

          {/* Tab 1: Preset Packages */}
          {modalTab === 'package' && (
            <div className="space-y-3 pt-1">
              <span className="text-[12px] font-bold text-slate-500 uppercase tracking-wider block">
                Preset Packages
              </span>
              <div className="grid grid-cols-2 gap-3">
                {displayPackages.map((pkg) => (
                  <button
                    key={pkg.id}
                    type="button"
                    disabled={submittingStripe}
                    onClick={() => onStripeCheckout(pkg.usdPrice, pkg.id)}
                    className="border border-slate-200 hover:border-[#004173] hover:bg-slate-50/80 active:scale-[0.98] disabled:opacity-50 py-3.5 px-3 sm:p-4 rounded-xl flex flex-col items-center justify-center transition-all cursor-pointer group bg-white shadow-2xs"
                  >
                    <span className="text-sm font-extrabold text-[#002b4e] group-hover:text-[#004173] transition-colors">
                      ${pkg.usdPrice} USD
                    </span>
                    <span className="text-xs font-semibold text-emerald-600 mt-1 select-none">
                      +{pkg.mcreditAmount.toFixed(0)} MC
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Tab 2: Custom Amount Form */}
          {modalTab === 'custom' && (
            <div className="space-y-4 pt-1">
              <p className="text-xs text-slate-500 leading-relaxed font-normal">
                Enter a custom USD amount below. Paid securely online by card via Stripe and credited to your wallet automatically upon successful payment.
              </p>

              <div className="space-y-3.5 pt-1">
                <div>
                  <label className="block text-[12px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Custom Amount (USD)
                  </label>
                  <div className="relative rounded-xl shadow-2xs">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                      <span className="text-slate-400 text-sm font-semibold">$</span>
                    </div>
                    <input
                      type="number"
                      step="0.01"
                      min="5"
                      max="10000"
                      value={topupAmount}
                      disabled={submittingStripe}
                      onChange={(e) => setTopupAmount(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl pl-8 pr-3 py-2.5 text-sm outline-none focus:border-[#004173] focus:ring-1 focus:ring-[#004173]/20 font-medium text-slate-900 transition-all placeholder:text-slate-400"
                      placeholder="e.g. 150.00"
                    />
                  </div>

                  {/* Real-time calculated MCredits preview */}
                  {topupAmount && !isNaN(Number(topupAmount)) && Number(topupAmount) > 0 && (
                    <div className="flex justify-between items-center mt-2.5 text-xs select-none">
                      <span className="text-slate-500 font-medium">Estimated MCredits:</span>
                      <span className="font-extrabold text-emerald-600 flex items-center gap-1">
                        <Coins size={13} />
                        <span>+{((Number(topupAmount) || 0) * mcreditsPerUsd).toFixed(2)} MC</span>
                      </span>
                    </div>
                  )}

                  {/* Validation Messages */}
                  {topupAmount !== '' && Number(topupAmount) < 5 && (
                    <p className="text-[11px] text-red-600 font-semibold mt-2">
                      Minimum top-up is $5.00 USD.
                    </p>
                  )}
                  {topupAmount !== '' && Number(topupAmount) > 10000 && (
                    <p className="text-[11px] text-red-600 font-semibold mt-2">
                      Maximum top-up is $10,000.00 USD.
                    </p>
                  )}
                  {topupAmount !== '' &&
                    Number(topupAmount) >= 5 &&
                    Number(topupAmount) <= 10000 &&
                    Number(Number(topupAmount).toFixed(2)) !== Number(topupAmount) && (
                      <p className="text-[11px] text-red-600 font-semibold mt-2">
                        Maximum 2 decimal places allowed.
                      </p>
                    )}
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    disabled={submittingStripe || !isCustomValid}
                    onClick={() => onStripeCheckout(null, null, Number(topupAmount))}
                    className="w-full min-h-[44px] bg-[#004173] hover:bg-[#002b4e] active:scale-[0.99] text-white py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed disabled:shadow-none"
                  >
                    {submittingStripe ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <CreditCard size={16} />
                    )}
                    <span>Checkout Custom Amount</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Legal / Terms Disclaimer */}
          <div className="text-[11px] text-slate-400 text-center leading-relaxed pt-3 select-none font-normal">
            By purchasing MCredits, you agree to Marcomn’s{' '}
            <Link href="/credits" className="text-[#004173] hover:underline font-semibold">
              How MCredits Work
            </Link>{' '}
            and{' '}
            <Link href="/legal/payments" className="text-[#004173] hover:underline font-semibold">
              MCredits, Payments & Refund Policy
            </Link>
            .
          </div>
        </div>
      </DialogBody>

        {/* Footer with clean right-aligned secondary button */}
        <DialogFooter>
          <button
            type="button"
            onClick={handleClose}
            disabled={submittingStripe}
            className="w-full sm:w-auto px-6 py-2.5 min-h-[44px] text-xs sm:text-sm font-bold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-100 rounded-xl transition-all cursor-pointer border border-slate-200 shadow-2xs hover:shadow-xs active:scale-[0.98] text-center shrink-0 disabled:opacity-50"
          >
            Close
          </button>
        </DialogFooter>

        {/* Stripe Redirection Overlay */}
        {submittingStripe && (
          <div className="absolute inset-0 bg-white/90 z-20 rounded-2xl flex flex-col items-center justify-center space-y-3">
            <Loader2 size={32} className="animate-spin text-[#002b4e]" />
            <span className="text-xs text-slate-600 font-bold">
              Redirecting to Stripe Checkout...
            </span>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}