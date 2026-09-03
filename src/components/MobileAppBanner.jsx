import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { isTelegramMiniApp } from '../utils/telegramMiniApp';

const BANNER_KEY  = 'calliotel_app_banner_dismissed_v3';
const HIDDEN_PATHS = ['/login', '/signup', '/onboarding', '/go', '/maintenance'];

const PLAY_STORE = 'https://play.google.com/store/apps/details?id=app.calliotel';
const APP_STORE  = 'https://apps.apple.com/app/calliotel/id6761994577';

export default function MobileAppBanner() {
  const location = useLocation();
  const [dismissed, setDismissed] = useState(true);
  const [visible, setVisible]     = useState(false);

  useEffect(() => {
    const wasDismissed = (() => {
      try { return localStorage.getItem(BANNER_KEY) === '1'; } catch { return false; }
    })();
    if (!wasDismissed) {
      setDismissed(false);
      setTimeout(() => setVisible(true), 600);
    }
  }, []);

  if (dismissed) return null;
  if (isTelegramMiniApp()) return null;
  if (HIDDEN_PATHS.includes(location.pathname)) return null;

  const dismiss = () => {
    try { localStorage.setItem(BANNER_KEY, '1'); } catch {}
    setVisible(false);
    setTimeout(() => setDismissed(true), 300);
  };

  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 9999,
      transform: visible ? 'translateY(0)' : 'translateY(100%)',
      transition: 'transform 0.35s cubic-bezier(0.34,1.2,0.64,1)',
    }}>
      <div style={{
        margin: '0 8px 8px',
        borderRadius: 18,
        overflow: 'hidden',
        background: 'linear-gradient(135deg, #0f172a 0%, #0a1a12 100%)',
        border: '1px solid rgba(16,185,129,0.35)',
        boxShadow: '0 -4px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(16,185,129,0.1)',
      }}>
        {/* Top strip — transform-based shimmer (GPU composited, no CLS) */}
        <div style={{ height: 3, background: '#059669', overflow: 'hidden', position: 'relative' }}>
          <div style={{
            position: 'absolute', top: 0, left: 0,
            width: '100%', height: '100%',
            background: 'linear-gradient(90deg, #059669 0%, #34d399 50%, #059669 100%)',
            animation: 'mobileStripShimmer 2s linear infinite',
            willChange: 'transform',
            transform: 'translateX(-100%)',
          }} />
        </div>
        <style>{`@keyframes mobileStripShimmer { 0%{transform:translateX(-100%)} 100%{transform:translateX(100%)} }`}</style>

        <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* App icon */}
          <div style={{
            width: 48, height: 48, borderRadius: 13, flexShrink: 0,
            background: 'linear-gradient(135deg, #10b981, #059669)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 16px rgba(16,185,129,0.4)',
            fontSize: 24,
          }}>
            📱
          </div>

          {/* Text */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 900, color: '#fff', marginBottom: 1 }}>
              Get the Calliotel App
            </div>
            <div style={{ display: 'flex', gap: 3, marginBottom: 3 }}>
              {'★★★★★'.split('').map((s, i) => (
                <span key={i} style={{ color: '#fbbf24', fontSize: 10 }}>{s}</span>
              ))}
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginLeft: 2 }}>5k+ downloads</span>
            </div>
            {/* Both store buttons */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <a
                href={APP_STORE}
                target="_blank"
                rel="noopener noreferrer"
                title="Download on the App Store (opens in a new tab)"
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '6px 10px',
                  borderRadius: 8,
                  background: '#000',
                  border: '1px solid rgba(255,255,255,0.2)',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: 11,
                  textDecoration: 'none',
                  whiteSpace: 'nowrap',
                }}
              >
                <span style={{ fontSize: 14 }}>🍎</span>
                App Store
              </a>
              <a
                href={PLAY_STORE}
                target="_blank"
                rel="noopener noreferrer"
                title="Get it on Google Play (opens in a new tab)"
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '6px 10px',
                  borderRadius: 8,
                  background: '#000',
                  border: '1px solid rgba(255,255,255,0.2)',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: 11,
                  textDecoration: 'none',
                  whiteSpace: 'nowrap',
                }}
              >
                <span style={{ fontSize: 13 }}>▶</span>
                Google Play
              </a>
            </div>
          </div>

          {/* Close */}
          <button
            onClick={dismiss}
            aria-label="Dismiss app banner"
            style={{
              flexShrink: 0,
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: 'rgba(255,255,255,0.45)',
              width: 28, height: 28,
              borderRadius: '50%',
              cursor: 'pointer',
              fontSize: 14,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}
