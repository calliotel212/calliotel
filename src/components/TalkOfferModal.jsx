import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TALK_OFFER,
  dismissTalkOffer,
  isTalkOfferLive,
  talkOfferRemaining,
  wasTalkOfferDismissed,
} from '../utils/talkOffer';

function useCountdown() {
  const [left, setLeft] = useState(() => talkOfferRemaining());
  useEffect(() => {
    const id = setInterval(() => setLeft(talkOfferRemaining()), 30000);
    return () => clearInterval(id);
  }, []);
  return left;
}

export default function TalkOfferModal() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const left = useCountdown();

  useEffect(() => {
    if (!isTalkOfferLive() || wasTalkOfferDismissed()) return;
    const t = setTimeout(() => setOpen(true), 600);
    return () => clearTimeout(t);
  }, []);

  if (!open || left.expired) return null;

  const close = () => setOpen(false);
  const hideForever = () => {
    dismissTalkOffer();
    setOpen(false);
  };
  const go = () => {
    dismissTalkOffer();
    setOpen(false);
    navigate(TALK_OFFER.ctaPath);
  };

  const units = [
    { n: left.days, label: 'DAYS' },
    { n: left.hours, label: 'HOURS' },
    { n: left.mins, label: 'MINS' },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="talk-offer-title"
      onClick={close}
      style={{
        position: 'fixed', inset: 0, zIndex: 80,
        background: 'rgba(0,0,0,0.72)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 420,
          background: '#0c0c18',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 28,
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <button
          type="button"
          onClick={close}
          aria-label="Close offer"
          style={{
            position: 'absolute', top: 14, right: 14, zIndex: 2,
            width: 32, height: 32, borderRadius: 999,
            border: '1px solid rgba(255,255,255,0.12)',
            background: 'rgba(0,0,0,0.35)', color: '#fff',
            cursor: 'pointer', fontSize: 16, lineHeight: 1,
          }}
        >
          ×
        </button>

        <div style={{
          height: 148,
          background: 'radial-gradient(ellipse at 50% 80%, rgba(245,166,35,0.28), transparent 62%), #12101c',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            width: 88, height: 88, borderRadius: 28,
            background: '#F5A623', color: '#000',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 40, fontWeight: 900,
            boxShadow: '0 16px 40px rgba(245,166,35,0.35)',
          }}>
            ☎
          </div>
        </div>

        <div style={{ padding: '22px 24px 20px', textAlign: 'center' }}>
          <p style={{
            margin: 0, fontSize: 13, fontWeight: 800, letterSpacing: 1.4,
            textTransform: 'uppercase', color: '#60a5fa',
          }}>
            {TALK_OFFER.name}
          </p>
          <h2 id="talk-offer-title" style={{
            margin: '8px 0 0', fontSize: 26, fontWeight: 900, color: '#fff', lineHeight: 1.15,
          }}>
            {TALK_OFFER.headline}
          </h2>
          <p style={{
            margin: '12px 0 0', fontSize: 15, color: 'rgba(255,255,255,0.72)', lineHeight: 1.5,
          }}>
            {TALK_OFFER.offerLine}
          </p>

          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 20 }}>
            {units.map((u) => (
              <div key={u.label} style={{
                minWidth: 78, padding: '10px 8px', borderRadius: 14,
                background: '#161622', border: '1px solid rgba(255,255,255,0.08)',
              }}>
                <div style={{ fontSize: 22, fontWeight: 900, color: '#fff', fontVariantNumeric: 'tabular-nums' }}>
                  {u.n}
                </div>
                <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1, color: 'rgba(255,255,255,0.45)' }}>
                  {u.label}
                </div>
              </div>
            ))}
          </div>
          <p style={{ margin: '10px 0 0', fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>
            {TALK_OFFER.endsLabel}
          </p>

          <button
            type="button"
            onClick={go}
            style={{
              width: '100%', marginTop: 20, padding: '14px 18px',
              borderRadius: 999, border: 'none', cursor: 'pointer',
              background: '#3b82f6', color: '#fff',
              fontSize: 16, fontWeight: 800,
            }}
          >
            Talk Starter $5 →
          </button>
          <button
            type="button"
            onClick={hideForever}
            style={{
              marginTop: 12, background: 'none', border: 'none',
              color: 'rgba(255,255,255,0.45)', fontSize: 13, cursor: 'pointer',
            }}
          >
            Don&apos;t show again
          </button>
        </div>
      </div>
    </div>
  );
}
