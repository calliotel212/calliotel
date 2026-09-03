import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TALK_DESTINATIONS, TALK_OFFER, isTalkOfferLive, talkOfferRemaining } from '../utils/talkOffer';

export default function TalkOfferSection() {
  const navigate = useNavigate();
  const [left, setLeft] = useState(() => talkOfferRemaining());
  const live = isTalkOfferLive();

  useEffect(() => {
    const id = setInterval(() => setLeft(talkOfferRemaining()), 30000);
    return () => clearInterval(id);
  }, []);

  return (
    <section style={{ padding: '80px 0', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{
            display: 'inline-block', padding: '5px 16px', borderRadius: 100,
            background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.28)',
            fontSize: 12, fontWeight: 700, color: '#60a5fa', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 14,
          }}>
            {TALK_OFFER.name}{live ? ` · ${left.days}d ${left.hours}h left` : ' · ended'}
          </div>
          <h2 style={{ fontSize: 'clamp(28px,4vw,48px)', fontWeight: 900, lineHeight: 1.1, letterSpacing: '-0.5px', marginBottom: 12, color: '#fff' }}>
            Calling plans that actually ring
          </h2>
          <p style={{ fontSize: 17, color: 'rgba(255,255,255,0.72)', maxWidth: 560, margin: '0 auto' }}>
            Competitors sell a code. You get outbound voice — 60 minutes on the first $5, then $0.02/min to the US &amp; Canada.
          </p>
        </div>

        <div style={{ display: 'grid', gap: 16, marginBottom: 36 }} className="grid md:grid-cols-3">
          {[
            { n: '1', title: 'Add $5', desc: 'Card or USDT. First deposit this campaign unlocks the Talk Starter minutes.' },
            { n: '2', title: 'Get a number', desc: `US numbers from $${TALK_OFFER.numberFrom.toFixed(2)}/mo. Incoming calls stay free.` },
            { n: '3', title: 'Talk 60 minutes', desc: 'US & Canada at $0.02/min after the free hour. Real calls, not OTP.' },
          ].map((s) => (
            <div key={s.n} style={{
              borderRadius: 20, padding: '24px 22px',
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.07)',
            }}>
              <div style={{
                width: 40, height: 40, borderRadius: 12, background: '#F5A623', color: '#000',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, marginBottom: 14,
              }}>
                {s.n}
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: '#fff', marginBottom: 8 }}>{s.title}</h3>
              <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.68)', lineHeight: 1.6, margin: 0 }}>{s.desc}</p>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gap: 12 }} className="grid sm:grid-cols-2 lg:grid-cols-3">
          {TALK_DESTINATIONS.map((d) => (
            <div key={d.name} style={{
              borderRadius: 16, padding: '16px 18px',
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.08)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
            }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>{d.flag} {d.name}</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>{d.note}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 20, fontWeight: 900, color: '#F5A623' }}>{d.rate}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>{d.unit}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ textAlign: 'center', marginTop: 36 }}>
          <button
            type="button"
            onClick={() => navigate(TALK_OFFER.ctaPath)}
            style={{
              padding: '14px 32px', borderRadius: 13, fontSize: 15, fontWeight: 800,
              background: '#F5A623', color: '#000', border: 'none', cursor: 'pointer',
              boxShadow: '0 6px 28px rgba(245,166,35,0.4)',
            }}
          >
            Start Talk Starter — $5 →
          </button>
          <p style={{ margin: '12px 0 0', fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
            {TALK_OFFER.endsLabel} · Number stays from ${TALK_OFFER.numberFrom.toFixed(2)}/mo
          </p>
        </div>
      </div>
    </section>
  );
}
