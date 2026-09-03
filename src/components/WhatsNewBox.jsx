import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const DISMISS_KEY = 'calliotel_whatsnew_dismissed_v2';

const UPDATES = [
  {
    date: 'Today',
    icon: '📞',
    title: 'Late Summer Talk',
    desc: 'First $5 = 60 min US/Canada. Then $0.02/min. Real calls, not OTP. Ends Sep 21st.',
    cta: 'Add $5',
    path: '/buy-credits?amount=5&offer=talk',
    badge: 'OFFER',
    badgeColor: '#3b82f6',
  },
  {
    date: 'Today',
    icon: '🇵🇷',
    title: 'Puerto Rico numbers added',
    desc: '+1 787 / +1 939 — instant activation, SMS + voice',
    cta: 'Browse',
    path: '/browse-numbers',
    badge: 'NEW',
    badgeColor: '#10b981',
  },
  {
    date: 'This week',
    icon: '📞',
    title: 'Outbound calling fixed',
    desc: 'Call any number from the in-app dialer, billed at $0.02/min US/CA',
    cta: 'Try it',
    path: '/keypad',
    badge: 'FIXED',
    badgeColor: '#F5A623',
  },
  {
    date: 'Jul 2026',
    icon: '💰',
    title: 'Save 32% with annual plans',
    desc: 'US numbers from $1.35/mo when you prepay 12 months',
    cta: 'See pricing',
    path: '/browse-numbers',
    badge: null,
  },
  {
    date: 'Jul 2026',
    icon: '🌍',
    title: '5 countries now available',
    desc: '🇺🇸 US · 🇨🇦 CA · 🇬🇧 UK · 🇦🇺 AU · 🇵🇷 PR — all instant',
    cta: 'Browse',
    path: '/browse-numbers',
    badge: null,
  },
];

export default function WhatsNewBox() {
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(() => {
    try {
      const val = localStorage.getItem(DISMISS_KEY);
      if (!val) return false;
      const { date } = JSON.parse(val);
      return date === new Date().toDateString();
    } catch { return false; }
  });

  if (dismissed) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, JSON.stringify({ date: new Date().toDateString() }));
    } catch {}
    setDismissed(true);
  };

  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(16,185,129,0.07) 0%, rgba(15,16,20,0.95) 100%)',
      border: '1px solid rgba(16,185,129,0.22)',
      borderRadius: 16,
      overflow: 'hidden',
      marginBottom: 0,
      position: 'relative',
    }}>
      {/* Shimmer top line — uses transform (GPU composited, no layout/paint) */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, overflow: 'hidden' }}>
        <div style={{
          position: 'absolute', top: 0, left: '-100%', width: '300%', height: '100%',
          background: 'linear-gradient(90deg, transparent 0%, #10b981 50%, transparent 100%)',
          animation: 'wnShimmer 3s linear infinite',
          willChange: 'transform',
        }} />
      </div>
      <style>{`
        @keyframes wnShimmer {
          0%   { transform: translateX(0%); }
          100% { transform: translateX(66.66%); }
        }
        @keyframes wnPulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.5; }
        }
      `}</style>

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 18px 12px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 18 }}>🚀</span>
          <span style={{ fontWeight: 800, fontSize: 14, color: '#fff', letterSpacing: 0.2 }}>
            What's New at Calliotel
          </span>
          {/* Live pulse */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 5,
            background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)',
            borderRadius: 20, padding: '2px 8px' }}>
            <div style={{
              width: 6, height: 6, borderRadius: '50%', background: '#10b981',
              animation: 'wnPulse 1.5s ease-in-out infinite',
            }} />
            <span style={{ fontSize: 10, fontWeight: 700, color: '#10b981', letterSpacing: 0.5 }}>LIVE</span>
          </div>
        </div>
        <button onClick={dismiss} style={{
          background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)',
          fontSize: 16, cursor: 'pointer', padding: '2px 6px', lineHeight: 1,
        }}>✕</button>
      </div>

      {/* Updates list */}
      <div style={{ padding: '8px 0' }}>
        {UPDATES.map((u, i) => (
          <div
            key={i}
            style={{
              display: 'flex', alignItems: 'flex-start', gap: 12,
              padding: '10px 18px',
              borderBottom: i < UPDATES.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
              cursor: u.path ? 'pointer' : 'default',
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => { if (u.path) e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
            onClick={() => { if (u.path) navigate(u.path); }}
          >
            {/* Icon */}
            <div style={{
              width: 34, height: 34, borderRadius: 10, flexShrink: 0,
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
            }}>
              {u.icon}
            </div>

            {/* Text */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', marginBottom: 2 }}>
                <span style={{ fontWeight: 700, fontSize: 13, color: '#fff' }}>{u.title}</span>
                {u.badge && (
                  <span style={{
                    fontSize: 9, fontWeight: 800, letterSpacing: 0.8,
                    color: u.badgeColor,
                    background: `${u.badgeColor}20`,
                    border: `1px solid ${u.badgeColor}50`,
                    borderRadius: 4, padding: '1px 6px',
                  }}>
                    {u.badge}
                  </span>
                )}
              </div>
              <p style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.55)', lineHeight: 1.4 }}>
                {u.desc}
              </p>
            </div>

            {/* Date + CTA */}
            <div style={{ flexShrink: 0, textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', fontWeight: 500 }}>{u.date}</span>
              {u.cta && (
                <span style={{
                  fontSize: 10, fontWeight: 700, color: '#10b981',
                  background: 'rgba(16,185,129,0.12)',
                  border: '1px solid rgba(16,185,129,0.3)',
                  borderRadius: 5, padding: '2px 7px',
                }}>
                  {u.cta} →
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={{
        padding: '10px 18px',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>
          Updated July 13, 2026 · More features shipping weekly
        </span>
        <button
          onClick={dismiss}
          style={{
            fontSize: 11, color: 'rgba(255,255,255,0.4)', background: 'none',
            border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6,
            padding: '3px 10px', cursor: 'pointer',
          }}
        >
          Dismiss for today
        </button>
      </div>
    </div>
  );
}
