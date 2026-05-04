'use client';

import { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setDeferredPrompt(e);
      // Update UI notify the user they can install the PWA
      setIsVisible(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsVisible(false);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    // Show the install prompt
    deferredPrompt.prompt();

    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User response to the install prompt: ${outcome}`);

    // We've used the prompt, and can't use it again, throw it away
    setDeferredPrompt(null);
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div className="install-banner">
      <div className="install-content">
        <div className="install-icon">
          <Download size={20} />
        </div>
        <div className="install-text">
          <span className="install-title">Install MarComn</span>
          <span className="install-desc">Add to home screen for a better experience</span>
        </div>
      </div>
      <div className="install-actions">
        <button className="btn-install" onClick={handleInstallClick}>
          Install
        </button>
        <button className="btn-close-banner" onClick={() => setIsVisible(false)}>
          <X size={16} />
        </button>
      </div>

      <style jsx>{`
        .install-banner {
          position: fixed;
          bottom: 80px; /* Above mobile tab bar */
          left: 16px;
          right: 16px;
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 12px 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
          z-index: 1000;
          animation: slideUp 0.3s ease-out;
        }

        @media (min-width: 768px) {
          .install-banner {
            bottom: 24px;
            max-width: 400px;
            left: auto;
            right: 24px;
          }
        }

        @keyframes slideUp {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }

        .install-content {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .install-icon {
          background: #e0f2fe;
          color: #0a66c2;
          width: 40px;
          height: 40px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .install-text {
          display: flex;
          flex-direction: column;
        }

        .install-title {
          font-weight: 700;
          font-size: 14px;
          color: #1e293b;
        }

        .install-desc {
          font-size: 12px;
          color: #64748b;
        }

        .install-actions {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .btn-install {
          background: #0a66c2;
          color: white;
          border: none;
          padding: 6px 16px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.2s;
        }

        .btn-install:hover {
          background: #004182;
        }

        .btn-close-banner {
          background: none;
          border: none;
          color: #94a3b8;
          cursor: pointer;
          padding: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
      `}</style>
    </div>
  );
}
