import React, { useState, useEffect } from 'react';
import { X, Download, Share } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import safeLocalStorage from '../utils/safeLocalStorage';
import { isTelegramMiniApp } from '../utils/telegramMiniApp';

const PERM_KEY = 'pwa-installed-permanently';

const InstallPWA = () => {
  const [showPrompt, setShowPrompt] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [platform, setPlatform] = useState(null);
  const location = useLocation();

  useEffect(() => { setShowPrompt(false); }, [location.pathname]);

  useEffect(() => {
    let cancelled = false;
    import('../utils/telegramMiniApp').then(({ isTelegramMiniApp }) => {
      if (!cancelled && isTelegramMiniApp()) setShowPrompt(false);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    // Already installed → nothing to do
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone;
    if (isStandalone) {
      safeLocalStorage.setItem(PERM_KEY, 'true');
      return;
    }

    const ua        = navigator.userAgent.toLowerCase();
    const isIOS     = /iphone|ipad|ipod/.test(ua);
    const isAndroid = /android/.test(ua);
    const detected  = isIOS ? 'ios' : isAndroid ? 'android' : 'desktop';
    setPlatform(detected);

    // ── KEY FIX: read the prompt captured in index.html before React loaded ──
    if (window.__pwaPrompt) {
      setDeferredPrompt(window.__pwaPrompt);
    }

    // Also listen for the event firing after React mounts (first visit race)
    const handler = (e) => {
      e.preventDefault();
      window.__pwaPrompt = e;
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);

    // Expose show function so buttons anywhere in the app can open this popup
    window.__pwaShowPrompt = () => setShowPrompt(true);

    window.addEventListener('appinstalled', () => {
      safeLocalStorage.setItem(PERM_KEY, 'true');
      setShowPrompt(false);
    });

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    window.__pwaPrompt = null;
    setShowPrompt(false);
    if (outcome === 'accepted') safeLocalStorage.setItem(PERM_KEY, 'true');
  };

  if (!showPrompt || !platform) return null;
  if (isTelegramMiniApp()) return null;

  return (
    <AnimatePresence>
      {showPrompt && (
        <>
          <div
            onClick={() => setShowPrompt(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9998 }}
          />

          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            style={{
              position: 'fixed', bottom: 20, left: 16, right: 16,
              maxWidth: 420, margin: '0 auto', zIndex: 9999,
            }}
          >
            <div style={{
              borderRadius: 24, overflow: 'hidden',
              background: '#111827',
              boxShadow: '0 32px 80px rgba(0,0,0,0.7)',
            }}>
              {/* Header */}
              <div style={{
                background: 'linear-gradient(135deg,#059669,#10b981)',
                padding: '20px',
                display: 'flex', alignItems: 'center', gap: 14,
                position: 'relative',
              }}>
                <button
                  onClick={() => setShowPrompt(false)}
                  style={{
                    position: 'absolute', top: 12, right: 12,
                    background: 'rgba(255,255,255,0.2)', border: 'none',
                    borderRadius: 8, width: 28, height: 28, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <X size={14} color="#fff" />
                </button>
                <div style={{
                  width: 52, height: 52, borderRadius: 14,
                  background: 'rgba(255,255,255,0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, fontSize: 26,
                }}>
                  🚀
                </div>
                <div>
                  <div style={{ color: '#fff', fontWeight: 800, fontSize: 17 }}>
                    Install Calliotel
                  </div>
                  <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, marginTop: 2 }}>
                    Add to your home screen
                  </div>
                </div>
              </div>

              {/* Body */}
              <div style={{ padding: '20px 20px 24px' }}>

                {/* Android / Desktop — native prompt available → one button */}
                {(platform === 'android' || platform === 'desktop') && deferredPrompt && (
                  <>
                    <p style={{
                      fontSize: 14, color: 'rgba(255,255,255,0.55)',
                      marginBottom: 20, lineHeight: 1.6, textAlign: 'center',
                    }}>
                      Tap <strong style={{ color: '#fff' }}>Install</strong> — the app will appear on your home screen instantly.
                    </p>
                    <button onClick={handleInstall} style={{
                      width: '100%', padding: '16px 0', borderRadius: 14,
                      background: 'linear-gradient(135deg,#10b981,#059669)',
                      color: '#fff', fontSize: 16, fontWeight: 800,
                      border: 'none', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                      boxShadow: '0 6px 28px rgba(16,185,129,0.45)',
                    }}>
                      <Download size={18} />
                      Install
                    </button>
                  </>
                )}

                {/* Android / Desktop — prompt not ready (Chrome cooldown) */}
                {(platform === 'android' || platform === 'desktop') && !deferredPrompt && (
                  <>
                    <p style={{
                      fontSize: 14, color: 'rgba(255,255,255,0.55)',
                      marginBottom: 16, lineHeight: 1.6, textAlign: 'center',
                    }}>
                      Tap the <strong style={{ color: '#fff' }}>⋮ menu</strong> in Chrome,<br />
                      then tap <strong style={{ color: '#fff' }}>"Install app"</strong>.
                    </p>
                    <div style={{
                      background: 'rgba(16,185,129,0.08)',
                      border: '1px solid rgba(16,185,129,0.25)',
                      borderRadius: 12, padding: '12px 14px',
                      fontSize: 15, color: '#F5A623', textAlign: 'center', fontWeight: 700,
                    }}>
                      ⋮ → Install app
                    </div>
                  </>
                )}

                {/* iOS */}
                {platform === 'ios' && (
                  <>
                    <p style={{
                      fontSize: 14, color: 'rgba(255,255,255,0.55)',
                      marginBottom: 16, lineHeight: 1.6, textAlign: 'center',
                    }}>
                      In Safari tap the <strong style={{ color: '#fff' }}>Share</strong> button,<br />
                      then <strong style={{ color: '#fff' }}>"Add to Home Screen"</strong>.
                    </p>
                    <div style={{
                      background: 'rgba(245,166,35,0.08)',
                      border: '1px solid rgba(245,166,35,0.2)',
                      borderRadius: 12, padding: '12px 14px',
                      fontSize: 15, color: '#F5A623', textAlign: 'center', fontWeight: 700,
                    }}>
                      Share (□↑) → Add to Home Screen → Add
                    </div>
                  </>
                )}

                <button
                  onClick={() => setShowPrompt(false)}
                  style={{
                    width: '100%', marginTop: 16, padding: '8px 0',
                    fontSize: 13, color: 'rgba(255,255,255,0.25)',
                    background: 'none', border: 'none', cursor: 'pointer',
                  }}
                >
                  Maybe later
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default InstallPWA;
