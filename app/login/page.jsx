'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase';
import LandingLogo from '@/app/components/LandingLogo';

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [step, setStep] = useState('email'); // 'email' | 'otp' | 'loading'
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [guestLoading, setGuestLoading] = useState(false);
  const inputRefs = useRef([]);

  const handleSendOtp = async (e) => {
    e.preventDefault();
    if (!email) return;
    setSending(true);
    setError('');
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    });
    setSending(false);
    if (error) setError(error.message);
    else setStep('otp');
  };

  const handleOtpChange = (index, value) => {
    if (!/^\d?$/.test(value)) return;
    const updated = [...otp];
    updated[index] = value;
    setOtp(updated);
    if (value && index < 5) inputRefs.current[index + 1]?.focus();
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0)
      inputRefs.current[index - 1]?.focus();
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    const token = otp.join('');
    if (token.length !== 6) return;
    setStep('loading');
    setError('');
    const { error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'email'
    });
    if (error) { setError(error.message); setStep('otp'); }
    else router.push('/logbook');
  };

  const handleGuestLogin = async () => {
    setGuestLoading(true);
    setError('');
    // Anonymous sign-in — creates a real session the middleware recognises.
    // Enable "Anonymous sign-ins" in Supabase dashboard: Auth → Settings → Anonymous sign-ins
    const { error } = await supabase.auth.signInAnonymously();
    if (error) {
      setError('Guest login unavailable: ' + error.message);
      setGuestLoading(false);
    } else {
      router.push('/logbook');
    }
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#f0f4fa' }}>
      {/* Header */}
      <header className="bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6 md:px-12 py-3 flex items-center w-full">
          <Link href="/" className="w-fit block">
            <LandingLogo />
          </Link>
        </div>
      </header>

      {/* Card */}
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 w-full max-w-sm p-8">

          {/* Loading state */}
          {step === 'loading' && (
            <div className="flex flex-col items-center gap-4 py-8">
              <div className="w-8 h-8 border-[3px] border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-gray-400 text-sm">Signing you in…</p>
            </div>
          )}

          {/* Email step */}
          {step === 'email' && (
            <>
              <div className="mb-6">
                <h1 className="text-xl font-bold mb-1" style={{ color: '#0e2a4d' }}>Sign in</h1>
                <p className="text-sm text-gray-400">We'll send a secure code to your email.</p>
              </div>

              <form onSubmit={handleSendOtp} className="flex flex-col gap-3">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition"
                />
                {error && <p className="text-red-400 text-xs">{error}</p>}
                <button
                  type="submit"
                  disabled={sending}
                  className="w-full py-2.5 rounded-lg text-sm font-semibold text-white transition-opacity disabled:opacity-60"
                  style={{ backgroundColor: '#0e2a4d' }}
                >
                  {sending ? 'Sending…' : 'Send Secure Code'}
                </button>
              </form>

              {/* Divider */}
              <div className="flex items-center gap-3 my-5">
                <div className="flex-1 h-px bg-gray-100"></div>
                <span className="text-xs text-gray-300">or</span>
                <div className="flex-1 h-px bg-gray-100"></div>
              </div>

              {/* Guest / dev bypass */}
              <button
                onClick={handleGuestLogin}
                disabled={guestLoading}
                className="w-full py-2.5 rounded-lg text-xs font-medium text-gray-400 border border-dashed border-gray-200 hover:border-gray-300 hover:text-gray-500 transition-all disabled:opacity-50"
              >
                {guestLoading ? 'Entering…' : '⚡ Quick Login — Guest Mode'}
              </button>
              <p className="text-center text-xs text-gray-300 mt-2">Dev bypass · bypasses email OTP</p>
            </>
          )}

          {/* OTP step */}
          {step === 'otp' && (
            <>
              <div className="mb-6">
                <h1 className="text-xl font-bold mb-1" style={{ color: '#0e2a4d' }}>Check your inbox</h1>
                <p className="text-sm text-gray-400">
                  6-digit code sent to <span className="font-medium text-gray-600">{email}</span>
                </p>
              </div>

              <form onSubmit={handleVerify} className="flex flex-col gap-5">
                <div className="flex gap-2 justify-center">
                  {otp.map((digit, i) => (
                    <input
                      key={i}
                      ref={(el) => (inputRefs.current[i] = el)}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(i, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(i, e)}
                      className="w-10 h-12 text-center text-lg font-bold border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-400 transition"
                      style={{ color: '#0e2a4d' }}
                    />
                  ))}
                </div>

                {error && <p className="text-red-400 text-xs text-center">{error}</p>}

                <button
                  type="submit"
                  disabled={otp.join('').length !== 6}
                  className="w-full py-2.5 rounded-lg text-sm font-semibold text-white transition-opacity disabled:opacity-40"
                  style={{ backgroundColor: '#0e2a4d' }}
                >
                  Verify &amp; Sign in
                </button>

                <div className="flex justify-between text-xs text-gray-400">
                  <button type="button" onClick={() => setStep('email')} className="hover:text-gray-600">
                    ← Back
                  </button>
                  <button type="button" onClick={() => { setOtp(['','','','','','']); handleSendOtp({ preventDefault: () => {} }); }} className="hover:text-blue-500">
                    Resend code
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </main>

      <footer className="text-center py-5 text-xs text-gray-300">
        © 2026 Marcomn · <span className="text-blue-400">The professional network.</span>
      </footer>
    </div>
  );
}
