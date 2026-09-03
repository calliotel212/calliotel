import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { isTelegramMiniApp } from '../utils/telegramMiniApp';

const BANNER_KEY   = 'calliotel_ticker_dismissed_v4';
const HIDDEN_PATHS = ['/login', '/signup', '/forgot-password', '/reset-password', '/onboarding', '/go', '/maintenance'];

const ANNOUNCEMENTS = [
  {
    icon: '📞',
    badge: 'TALK',
    text: 'Late Summer Talk — first $5 unlocks 60 minutes to the US & Canada. Then $0.02/min. Ends Sep 21st.',
    cta: 'Talk Starter $5',
    path: '/buy-credits?amount=5&offer=talk',
    color: '#2563eb',
    bg: 'rgba(37,99,235,0.16)',
  },
  {
    icon: '🍎',
    badge: 'NOW LIVE',
    text: 'Calliotel is on the App Store! Download for iPhone & iPad — get your number in 60 seconds.',
    cta: 'Download iOS App',
    path: 'https://apps.apple.com/app/calliotel/id6761994577',
    external: true,
    color: '#5b21b6',
    bg: 'rgba(124,58,237,0.14)',
  },
  {
    icon: '🇵🇷',
    badge: 'NEW',
    text: 'Puerto Rico numbers now live — +1 787 / +1 939, instant SMS & voice, no documents.',
    cta: 'Get PR Number',
    path: '/browse-numbers',
    color: '#059669',
    bg: 'rgba(5,150,105,0.14)',
  },
  {
    icon: '₿',
    badge: 'NEW',
    text: 'Crypto payments live — pay with USDT, Bitcoin, Ethereum. No bank needed.',
    cta: 'Pay with Crypto',
    path: '/buy-credits?tab=crypto',
    color: '#d97706',
    bg: 'rgba(245,166,35,0.12)',
  },
  {
    icon: '🌍',
    badge: null,
    text: '7 countries available — 🇺🇸 US · 🇨🇦 CA · 🇬🇧 UK · 🇦🇺 AU · 🇵🇷 PR · 🇳🇱 NL · 🇸🇪 SE. Instant activation.',
    cta: 'Browse Numbers',
    path: '/browse-numbers',
    color: '#d97706',
    bg: 'rgba(245,166,35,0.12)',
  },
  {
    icon: '💎',
    badge: 'EARN',
    text: 'Reseller program — earn 20% lifetime commission on every sale you refer. No cap.',
    cta: 'Become a Reseller',
    path: '/reseller-program',
    color: '#7c3aed',
    bg: 'rgba(124,58,237,0.14)',
  },
  {
    icon: '📱',
    badge: null,
    text: 'Mobile app available — 5,000+ downloads on Play Store & App Store. Get it free.',
    cta: 'Download App',
    path: 'https://play.google.com/store/apps/details?id=app.calliotel',
    external: true,
    color: '#059669',
    bg: 'rgba(5,150,105,0.14)',
  },
  {
    icon: '⚡',
    badge: 'SAVE 40%',
    text: 'Annual plans from $1.14/mo — lock in your rate today and beat the price hike.',
    cta: 'Get Started',
    path: '/signup',
    color: '#059669',
    bg: 'rgba(5,150,105,0.14)',
  },
];

const ROTATE_MS = 4500;

export default function AnnouncementBanner() {
  const { user }   = useAuth();
  const navigate   = useNavigate();
  const location   = useLocation();
  const [idx, setIdx]           = useState(0);
  const [fading, setFading]     = useState(false);
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(BANNER_KEY) === '1'; } catch { return false; }
  });
  const timerRef = useRef(null);

  useEffect(() => {
    if (dismissed) return;
    timerRef.current = setInterval(() => {
      setFading(true);
      setTimeout(() => {
        setIdx(i => (i + 1) % ANNOUNCEMENTS.length);
        setFading(false);
      }, 350);
    }, ROTATE_MS);
    return () => clearInterval(timerRef.current);
  }, [dismissed]);

  if (dismissed) return null;
  if (isTelegramMiniApp()) return null;
  if (HIDDEN_PATHS.includes(location.pathname)) return null;

  const item = ANNOUNCEMENTS[idx];

  const dismiss = () => {
    try { localStorage.setItem(BANNER_KEY, '1'); } catch {}
    clearInterval(timerRef.current);
    setDismissed(true);
  };

  const handleCta = () => {
    if (item.external) {
      window.open(item.path, '_blank', 'noopener noreferrer');
    } else {
      navigate(item.path);
    }
  };

  return (
    <div style={{
      background: item.bg,
      borderBottom: `1px solid ${item.color}44`,
      padding: '11px 16px 11px 14px',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      position: 'relative',
      zIndex: 50,
      transition: 'background 0.4s ease, border-color 0.4s ease',
      minHeight: 52,
      overflow: 'hidden',
    }}>

      {/* Scrolling shimmer line at very top */}
      <div style={{
        position: 'absolute',
        top: 0, left: '-100%', width: '300%',
        height: 2,
        background: `linear-gradient(90deg, transparent 0%, ${item.color} 50%, transparent 100%)`,
        animation: 'tickerShimmer 2s linear infinite',
        willChange: 'transform',
      }} />
      <style>{`
        @keyframes tickerShimmer {
          0%   { transform: translateX(100%); }
          100% { transform: translateX(-100%); }
        }
        @keyframes tickerPop {
          0%   { transform: scale(0.85); opacity: 0; }
          60%  { transform: scale(1.08); }
          100% { transform: scale(1);    opacity: 1; }
        }
      `}</style>

      {/* Icon */}
      <div style={{
        flexShrink: 0,
        fontSize: 22,
        width: 38, height: 38,
        borderRadius: 11,
        background: `${item.color}28`,
        border: `1px solid ${item.color}55`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        animation: fading ? 'none' : 'tickerPop 0.4s ease',
        transition: 'opacity 0.35s ease',
        opacity: fading ? 0 : 1,
      }}>
        {item.icon}
      </div>

      {/* Text */}
      <p style={{
        margin: 0,
        fontSize: 14,
        color: '#ffffff',
        fontWeight: 500,
        lineHeight: 1.4,
        flex: 1,
        minWidth: 0,
        transition: 'opacity 0.35s ease',
        opacity: fading ? 0 : 1,
        overflow: 'hidden',
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical',
      }}>
        {item.badge && (
          <span style={{
            color: '#fff',
            fontWeight: 800,
            fontSize: 12,
            letterSpacing: 0.5,
            marginRight: 5,
          }}>
            {item.badge} ·{' '}
          </span>
        )}
        {item.text}
      </p>

      {/* CTA button */}
      <button
        onClick={handleCta}
        style={{
          flexShrink: 0,
          padding: '8px 14px',
          borderRadius: 9,
          background: item.color,
          border: 'none',
          color: '#fff',
          fontWeight: 800,
          fontSize: 12,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          transition: 'opacity 0.35s ease, transform 0.2s ease',
          opacity: fading ? 0 : 1,
          boxShadow: `0 3px 14px ${item.color}55`,
          letterSpacing: 0.2,
          textShadow: '0 1px 2px rgba(0,0,0,0.25)',
        }}
        onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.05)'; }}
        onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
      >
        {item.cta} →
      </button>

      {/* Dot indicators */}
      <div style={{ flexShrink: 0, display: 'flex', gap: 4, alignItems: 'center' }}>
        {ANNOUNCEMENTS.map((_, i) => (
          <div
            key={i}
            onClick={() => { setFading(true); setTimeout(() => { setIdx(i); setFading(false); }, 350); }}
            style={{
              width: i === idx ? 16 : 6,
              height: 6,
              borderRadius: 3,
              background: i === idx ? item.color : 'rgba(255,255,255,0.15)',
              cursor: 'pointer',
              transition: 'all 0.35s ease',
              flexShrink: 0,
            }}
          />
        ))}
      </div>

      {/* Dismiss */}
      <button
        onClick={dismiss}
        aria-label="Dismiss banner"
        style={{
          flexShrink: 0,
          background: 'none',
          border: 'none',
          color: 'rgba(255,255,255,0.4)',
          fontSize: 16,
          cursor: 'pointer',
          padding: '6px 6px',
          lineHeight: 1,
          marginLeft: 2,
        }}
      >
        ✕
      </button>
    </div>
  );
}
