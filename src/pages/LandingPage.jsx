import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import SEOHead, { webAppSchema, orgSchema } from '../components/SEOHead';
import ProfessionalFooter from '../components/ProfessionalFooter';
import LandingNav from '../components/LandingNav';
import WhatsNewBox from '../components/WhatsNewBox';
import TalkOfferModal from '../components/TalkOfferModal';
import TalkOfferSection from '../components/TalkOfferSection';
import GuestServiceSearch from '../components/GuestServiceSearch';
import { TALK_OFFER } from '../utils/talkOffer';
import { TELEGRAM_MINI_APP_URL, isTelegramMiniApp } from '../utils/telegramMiniApp';
import { Phone, Globe, Shield, Zap, ArrowRight, Check, Star, ChevronDown, Users, Lock, CreditCard, Wifi } from 'lucide-react';

/* ── Animated counter ─────────────────────────────────────── */
function useCountUp(target, duration = 1600) {
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  const started = useRef(false);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !started.current) {
        started.current = true;
        const num = parseFloat(String(target).replace(/[^0-9.]/g, ''));
        const start = performance.now();
        const tick = (now) => {
          const p = Math.min((now - start) / duration, 1);
          const ease = 1 - Math.pow(1 - p, 3);
          setCount(Math.floor(ease * num));
          if (p < 1) requestAnimationFrame(tick);
          else setCount(num);
        };
        requestAnimationFrame(tick);
      }
    }, { threshold: 0.5 });
    obs.observe(node);
    return () => obs.disconnect();
  }, [target, duration]);
  return [count, ref];
}

/* ── Number hero card ─────────────────────────────────────── */
function HeroCard() {
  const NUMBERS = [
    { flag: '🇺🇸', num: '+1 (646) 555-0182', loc: 'New York, USA',   col: '#F5A623' },
    { flag: '🇬🇧', num: '+44 20 7946 0312', loc: 'London, UK',       col: '#6366f1' },
    { flag: '🇦🇺', num: '+61 2 9876 5432',  loc: 'Sydney, AU',       col: '#f59e0b' },
    { flag: '🇨🇦', num: '+1 (604) 555-0847', loc: 'Vancouver, CA',   col: '#10b981' },
    { flag: '🇵🇷', num: '+1 (787) 555-0148', loc: 'San Juan, PR',    col: '#8b5cf6' },
  ];
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setIdx(i => (i + 1) % NUMBERS.length), 2800);
    return () => clearInterval(t);
  }, []);
  const c = NUMBERS[idx];
  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)',
      borderRadius: 24, padding: '28px 28px 24px', minWidth: 300, maxWidth: 340,
      boxShadow: '0 32px 80px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08)',
      position: 'relative', overflow: 'hidden', flexShrink: 0,
    }}>
      {/* top accent line */}
      <div style={{ position:'absolute', top:0, left:0, right:0, height:3, background:`linear-gradient(90deg, transparent, ${c.col}, transparent)`, transition:'background 0.6s' }} />

      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:20 }}>
        <div style={{ width:32, height:32, borderRadius:10, background:`${c.col}33`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:16 }}>📱</div>
        <div>
          <div style={{ fontSize:11, color:'rgba(255,255,255,0.72)', textTransform:'uppercase', letterSpacing:1 }}>Your Virtual Number</div>
          <div style={{ fontSize:12, color:'#10b981', fontWeight:700 }}>● Active</div>
        </div>
        <span style={{ marginLeft:'auto', fontSize:22 }}>{c.flag}</span>
      </div>

      <div style={{ fontSize:20, fontWeight:800, color:'#fff', letterSpacing:0.5, marginBottom:4, fontFamily:'monospace' }}>{c.num}</div>
      <div style={{ fontSize:13, color:'rgba(255,255,255,0.72)', marginBottom:20 }}>{c.loc}</div>

      <div style={{ display:'flex', gap:6, marginBottom:20 }}>
        {['SMS Ready','Call Fwd','Private'].map((t,i) => (
          <span key={t} style={{
            padding:'4px 9px', borderRadius:20, fontSize:11, fontWeight:600,
            background: i===0 ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.06)',
            color: i===0 ? '#10b981' : 'rgba(255,255,255,0.7)',
            border:`1px solid ${i===0 ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.07)'}`,
          }}>{t}</span>
        ))}
      </div>

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div>
          <div style={{ fontSize:11, color:'rgba(255,255,255,0.65)', marginBottom:2 }}>Monthly</div>
          <div style={{ fontSize:22, fontWeight:900, color:c.col, transition:'color 0.6s' }}>$1.99<span style={{ fontSize:12, fontWeight:400, color:'rgba(255,255,255,0.72)' }}>/mo</span></div>
        </div>
        <div style={{ padding:'10px 18px', borderRadius:12, fontSize:13, fontWeight:800, background:`linear-gradient(135deg, ${c.col}, ${c.col}cc)`, color:'#fff', cursor:'pointer', boxShadow:`0 4px 20px ${c.col}55`, transition:'all 0.6s' }}>Get It →</div>
      </div>

      {/* SMS notification bubble */}
      <div style={{
        position:'absolute', top:-12, right:-10,
        background:'rgba(10,10,24,0.96)', border:'1px solid rgba(16,185,129,0.35)',
        borderRadius:12, padding:'8px 14px', boxShadow:'0 8px 32px rgba(0,0,0,0.5)',
        display:'flex', alignItems:'center', gap:8,
      }}>
        <span style={{ fontSize:14 }}>💬</span>
        <div>
          <div style={{ fontSize:10, color:'#10b981', fontWeight:700 }}>SMS Received</div>
          <div style={{ fontSize:10, color:'rgba(255,255,255,0.7)' }}>WhatsApp: 483921</div>
        </div>
      </div>

      {/* Country dots */}
      <div style={{ display:'flex', gap:4, justifyContent:'center', marginTop:20 }}>
        {NUMBERS.map((n, i) => (
          <button key={i} onClick={() => setIdx(i)} aria-label={`Show ${n.loc} number`} aria-pressed={i === idx} style={{ display:'flex', alignItems:'center', justifyContent:'center', width:24, height:24, background:'none', border:'none', cursor:'pointer', padding:0, flexShrink:0 }}>
            <span style={{ display:'block', width:i===idx?20:8, height:8, borderRadius:4, background:i===idx ? c.col : 'rgba(255,255,255,0.15)', transition:'all 0.4s', pointerEvents:'none' }} />
          </button>
        ))}
      </div>
    </div>
  );
}

/* LiveStrip removed — no fake activity feed */

/* ── App store section ────────────────────────────────────── */
function AppSection() {
  const [iosOpen, setIosOpen] = useState(false);
  const AppleLogo = () => (
    <svg width="22" height="26" viewBox="0 0 170 210" fill="white"><path d="M150 148c-6 13-9 19-16 30-10 16-25 34-43 34-16 1-21-10-43-10s-28 11-44 10c-18 0-33-19-43-34C-6 154-13 112-2 73c7-26 21-40 35-40 14 0 22 9 42 9 19 0 26-9 42-9 13 0 28 13 35 38l-2 1c-6 3-24 11-24 35 0 27 19 37 28 40l-4 1z"/><path d="M110 0c1 18-8 36-18 48-10 12-26 21-39 20-1-14 5-28 15-39 10-12 27-21 42-29z"/></svg>
  );
  return (
    <section style={{ padding:'80px 0', borderTop:'1px solid rgba(255,255,255,0.06)' }}>
      <div className="max-w-3xl mx-auto px-4 text-center">
        <div style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'5px 14px', borderRadius:100, background:'rgba(245,166,35,0.1)', border:'1px solid rgba(245,166,35,0.2)', fontSize:11, fontWeight:700, color:'#F5A623', letterSpacing:1.5, textTransform:'uppercase', marginBottom:20 }}>
          📱 Mobile App
        </div>
        <h2 style={{ fontSize:'clamp(26px,4vw,40px)', fontWeight:900, color:'#fff', marginBottom:12, lineHeight:1.15, letterSpacing:'-0.5px' }}>
          Calliotel in Your Pocket
        </h2>
        <p style={{ fontSize:16, color:'rgba(255,255,255,0.78)', marginBottom:36, maxWidth:420, margin:'0 auto 36px' }}>
          Open in Telegram with one tap — or download for iOS and Android.
        </p>
        <div style={{ display:'flex', gap:12, justifyContent:'center', flexWrap:'wrap', marginBottom:20 }}>
          {[
            { store:'Telegram', sub:'Mini App — no download', href: TELEGRAM_MINI_APP_URL, action:'Open in', icon:<svg width="22" height="22" viewBox="0 0 24 24" fill="white" aria-hidden="true"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12l-6.871 4.326-2.962-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.833.941z"/></svg> },
            { store:'App Store', sub:'iOS — iPhone & iPad', href:'https://apps.apple.com/app/calliotel/id6761994577', action:'Download on', icon:<AppleLogo /> },
            { store:'Google Play', sub:'Android devices', href:'https://play.google.com/store/apps/details?id=app.calliotel', action:'Download on', icon:<span style={{fontSize:22}}>▶</span> },
          ].map(b => (
            <a key={b.store} href={b.href} target="_blank" rel="noopener noreferrer" title={`${b.action} ${b.store} (opens in a new tab)`} style={{ textDecoration:'none' }}>
              <div style={{
                display:'flex', alignItems:'center', gap:12, padding:'12px 20px',
                borderRadius:14, background: b.store === 'Telegram' ? 'rgba(42,171,238,0.12)' : 'rgba(16,185,129,0.07)',
                border: b.store === 'Telegram' ? '1px solid rgba(42,171,238,0.45)' : '1px solid rgba(16,185,129,0.3)', minWidth:160,
              }}>
                <div style={{ width:28, height:32, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>{b.icon}</div>
                <div style={{ textAlign:'left' }}>
                  <div style={{ fontSize:10, color: b.store === 'Telegram' ? '#2AABEE' : '#10b981', fontWeight:700, textTransform:'uppercase', letterSpacing:1 }}>{b.action}</div>
                  <div style={{ fontSize:14, color:'#fff', fontWeight:700 }}>{b.store}</div>
                  <div style={{ fontSize:10, color:'rgba(255,255,255,0.65)' }}>{b.sub}</div>
                </div>
              </div>
            </a>
          ))}
        </div>
        <button onClick={() => setIosOpen(v => !v)} style={{
          padding:'13px 28px', borderRadius:12, fontSize:14, fontWeight:700,
          background:'linear-gradient(135deg,#F5A623,#d4901d)', color:'#000',
          border:'none', cursor:'pointer', boxShadow:'0 6px 24px rgba(245,166,35,0.35)',
          display:'inline-flex', alignItems:'center', gap:8,
        }}>
          📲 Use on Any Browser — No Download Needed
        </button>
        {iosOpen && (
          <div style={{ marginTop:20, maxWidth:360, margin:'20px auto 0', background:'rgba(15,15,30,0.95)', border:'1px solid rgba(245,166,35,0.2)', borderRadius:16, padding:'18px 22px', textAlign:'left' }}>
            <p style={{ fontSize:12, fontWeight:700, color:'#F5A623', marginBottom:12, letterSpacing:0.5 }}>ADD TO HOME SCREEN (iPHONE)</p>
            {['Open in Safari', 'Tap the Share button (square + arrow)', 'Tap "Add to Home Screen"', 'Tap "Add" — done! 🎉'].map((t,i) => (
              <div key={i} style={{ display:'flex', gap:10, marginBottom:10, alignItems:'flex-start' }}>
                <div style={{ width:20, height:20, borderRadius:6, background:'rgba(245,166,35,0.2)', border:'1px solid rgba(245,166,35,0.3)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:800, color:'#F5A623', flexShrink:0 }}>{i+1}</div>
                <p style={{ fontSize:13, color:'rgba(255,255,255,0.7)', margin:0, lineHeight:1.5 }}>{t}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

/* ── Main landing page ────────────────────────────────────── */
const LandingPage = () => {
  const navigate = useNavigate();
  const [openFaq, setOpenFaq] = useState(null);

  const [c1, r1] = useCountUp(50000);
  const [c2, r2] = useCountUp(800);
  const [c3, r3] = useCountUp(180);
  const [c4, r4] = useCountUp(5);

  const faqs = [
    { q: 'Does it work for WhatsApp verification?', a: 'Many users verify WhatsApp successfully with our numbers, but WhatsApp is not guaranteed — their rules change often. If a code doesn’t arrive, pick another number. Unused credit stays in your account.' },
    { q: 'How fast is activation?', a: 'Instant. Once your payment is confirmed, your number is live in under 60 seconds. No waiting, no paperwork.' },
    { q: 'What payment methods do you accept?', a: 'Visa, Mastercard, Amex, Apple Pay and Google Pay via Stripe from $2. Crypto (USDT, TRX and more) from $5. First $5 this campaign unlocks 60 minutes of US/Canada calling.' },
    { q: 'What is an eSIM?', a: 'An eSIM is a digital SIM card delivered as a QR code — scan it and get mobile data in 180+ countries instantly. No physical SIM needed, works on any modern phone.' },
    { q: 'Is my identity kept private?', a: 'Yes. No ID required, ever. Your real phone number is never exposed. We never sell or share your data.' },
    { q: 'Can I cancel anytime?', a: 'Yes — cancel from your dashboard any time. No penalties, no lock-ins. Your wallet balance stays available for future use.' },
    { q: 'What if I have an issue?', a: 'Cancel anytime from your dashboard. You keep the number until the paid period ends. A number is a phone line for that month — not a one-SMS trial.' },
  ];

  const services = [
    {
      icon: '📱', gradient: 'linear-gradient(135deg,#F5A623,#d4901d)',
      glow: 'rgba(245,166,35,0.3)', border: 'rgba(245,166,35,0.2)',
      title: 'Virtual Numbers', price: 'From $1.99/mo',
      badge: null,
      desc: 'Real mobile numbers from US, UK, Canada, Australia & Puerto Rico. Verify WhatsApp, Telegram, Instagram, TikTok, banks & 800+ apps.',
      features: ['🇺🇸 US · 🇬🇧 UK · 🇨🇦 CA · 🇦🇺 AU · 🇵🇷 PR', 'SMS, MMS & calls', 'Auto-renews monthly', 'No ID required'],
      cta: 'Browse Numbers', route: '/browse-numbers',
    },
    {
      icon: '🔢', gradient: 'linear-gradient(135deg,#f59e0b,#F5A623)',
      glow: 'rgba(245,166,35,0.3)', border: 'rgba(245,166,35,0.2)',
      title: '180+ Services', price: 'From $0.99',
      badge: 'NEW',
      desc: 'WhatsApp, Instagram, Telegram and 180+ more. Search the list with no account — sign up or log in when you buy.',
      features: ['Search before you sign up', 'From $0.99', 'Auto country available', 'Money back if it does not arrive'],
      cta: 'Search services', route: '/services',
    },
    {
      icon: '📡', gradient: 'linear-gradient(135deg,#059669,#10b981)',
      glow: 'rgba(16,185,129,0.3)', border: 'rgba(16,185,129,0.2)',
      title: 'eSIM', price: 'From $0.54',
      badge: 'POPULAR',
      desc: 'eSIM data in 180+ countries. Scan a QR, go online — no physical SIM, no roaming fees.',
      features: ['180+ countries covered', '4G & 5G networks', 'Instant QR code delivery', 'No physical SIM needed'],
      cta: 'Browse eSIMs', route: '/esim',
    },
    {
      icon: '📞', gradient: 'linear-gradient(135deg,#3b82f6,#2563eb)',
      glow: 'rgba(59,130,246,0.3)', border: 'rgba(59,130,246,0.2)',
      title: 'Calling Plans', price: 'Talk Starter $5',
      badge: '60 MIN',
      desc: 'Real outbound calls — not OTP numbers. First $5 unlocks 60 minutes to the US & Canada.',
      features: ['60 min US/CA on first $5', 'Then $0.02 per minute', 'Inbound calls always free', 'Works from the in-app dialer'],
      cta: 'Start talking', route: TALK_OFFER.ctaPath,
    },
  ];

  return (
    <div className="min-h-screen text-white" style={{ background: '#060610' }}>
      <SEOHead
        description="Virtual numbers, 180+ services, and eSIM data in 180+ countries. No ID. Instant activation. One account, worldwide."
        keywords="virtual phone number, esim data plan, US virtual number, UK virtual number, eSIM travel, 180 services"
        path="/"
        schema={{ '@graph': [webAppSchema, orgSchema] }}
      />

      <style>{`
        .lp-service-card {
          background: rgba(255,255,255,0.025);
          border: 1px solid rgba(255,255,255,0.08);
          transition: transform 0.25s ease, box-shadow 0.25s ease, background 0.25s ease;
        }
        .lp-service-card:hover {
          transform: translateY(-6px);
          background: rgba(255,255,255,0.045);
        }
        .lp-glass {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.07);
          transition: background 0.2s, border-color 0.2s;
        }
        .lp-glass:hover {
          background: rgba(255,255,255,0.06);
          border-color: rgba(245,166,35,0.25);
        }
        .lp-faq-item {
          border-bottom: 1px solid rgba(255,255,255,0.07);
          transition: background 0.15s;
        }
        .lp-faq-item:hover {
          background: rgba(255,255,255,0.02);
        }
        .lp-btn-primary {
          transition: transform 0.2s, box-shadow 0.2s;
        }
        .lp-btn-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 14px 44px rgba(245,166,35,0.6) !important;
        }
        .lp-testimonial {
          background: rgba(255,255,255,0.025);
          border: 1px solid rgba(255,255,255,0.07);
          transition: border-color 0.2s, transform 0.2s;
        }
        .lp-testimonial:hover {
          border-color: rgba(245,166,35,0.25);
          transform: translateY(-3px);
        }
      `}</style>

      <LandingNav />

      <main>
        {/* ── HERO ──────────────────────────────────────────── */}
        <section className="relative overflow-hidden pt-[90px] pb-[100px]">
          {/* Gradient orbs */}
          <div className="absolute inset-0 pointer-events-none">
            <div style={{ position:'absolute', top:'-10%', left:'50%', transform:'translateX(-50%)', width:900, height:500, background:'radial-gradient(ellipse, rgba(245,166,35,0.12), transparent 70%)', borderRadius:'50%' }} />
            <div style={{ position:'absolute', bottom:0, left:'20%', width:400, height:300, background:'radial-gradient(ellipse, rgba(16,185,129,0.06), transparent 70%)', borderRadius:'50%' }} />
            <div style={{ position:'absolute', bottom:0, right:'15%', width:400, height:300, background:'radial-gradient(ellipse, rgba(249,115,22,0.05), transparent 70%)', borderRadius:'50%' }} />
          </div>

          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col items-center gap-8 lg:flex-row lg:items-center lg:gap-16">

              {/* Left */}
              <div className="flex-1 text-center lg:text-left">
                {/* Badge */}
                <div style={{
                  display:'inline-flex', alignItems:'center', gap:8,
                  padding:'6px 16px', borderRadius:100,
                  background:'rgba(245,166,35,0.1)', border:'1px solid rgba(245,166,35,0.25)',
                  marginBottom:28,
                }}>
                  <span style={{ width:7, height:7, borderRadius:'50%', background:'#10b981', display:'inline-block', boxShadow:'0 0 6px #10b981' }} />
                  <span style={{ fontSize:13, fontWeight:700, color:'#F5A623', letterSpacing:0.3 }}>
                    🇺🇸 US · 🇨🇦 CA · 🇬🇧 UK · 🇦🇺 AU · 🇵🇷 PR · 180+ services · 📡 eSIM 180+
                  </span>
                </div>

                <h1 style={{ fontSize:'clamp(38px,5.5vw,70px)', fontWeight:900, lineHeight:1.06, letterSpacing:'-1.5px', marginBottom:24, color: '#fff' }}>
                  Virtual Numbers &amp;{' '}
                  <span style={{ color:'#F5A623' }}>eSIM Data</span>
                  <br />All in One Place
                </h1>

                <p style={{ fontSize:18, color:'rgba(255,255,255,0.65)', lineHeight:1.75, marginBottom:16, maxWidth:520 }}>
                  Virtual numbers for SMS &amp; calls. eSIM data when you travel. One account, worldwide.
                </p>

                {/* Price callout */}
                <div style={{
                  display:'inline-flex', alignItems:'center', gap:10, padding:'8px 16px',
                  borderRadius:12, marginBottom:32,
                  background:'rgba(34,197,94,0.08)', border:'1px solid rgba(34,197,94,0.22)',
                }}>
                  <span style={{ fontSize:16 }}>💸</span>
                  <span style={{ fontSize:14, color:'rgba(255,255,255,0.75)', fontWeight:500 }}>
                    Talk Starter <strong style={{ color:'#22c55e' }}>$5 = 60 min</strong> · calls <strong style={{ color:'#22c55e' }}>$0.02/min</strong> · numbers from <strong style={{ color:'#22c55e' }}>$1.35/mo</strong>
                  </span>
                </div>

                <div style={{ display:'flex', gap:12, flexWrap:'wrap', justifyContent:'center', marginBottom:36 }} className="lg:justify-start">
                  {isTelegramMiniApp() && (
                    <button onClick={() => navigate('/services')} className="lp-btn-primary" style={{
                      padding:'15px 34px', borderRadius:14, fontSize:17, fontWeight:800,
                      background:'#F5A623',
                      color:'#000', border:'none', cursor:'pointer',
                      boxShadow:'0 8px 32px rgba(245,166,35,0.5)',
                    }}>
                      180+ Services →
                    </button>
                  )}
                  <button onClick={() => navigate('/browse-numbers?first=1')} className="lp-btn-primary" style={{
                    padding:'15px 34px', borderRadius:14, fontSize:17, fontWeight:800,
                    background: isTelegramMiniApp() ? 'rgba(255,255,255,0.08)' : '#F5A623',
                    color: isTelegramMiniApp() ? '#fff' : '#000',
                    border: isTelegramMiniApp() ? '1px solid rgba(255,255,255,0.14)' : 'none',
                    cursor:'pointer',
                    boxShadow: isTelegramMiniApp() ? 'none' : '0 8px 32px rgba(245,166,35,0.5)',
                  }}>
                    Get Started Free →
                  </button>
                  {!isTelegramMiniApp() && (
                    <a
                      href={TELEGRAM_MINI_APP_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Open Calliotel in Telegram (opens in a new tab)"
                      style={{
                        padding:'13px 22px', borderRadius:14, fontSize:15, fontWeight:700,
                        background:'#2AABEE', color:'#fff', textDecoration:'none',
                        border:'none', cursor:'pointer', display:'inline-flex', alignItems:'center', gap:8,
                        boxShadow:'0 8px 28px rgba(42,171,238,0.35)',
                      }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12l-6.871 4.326-2.962-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.833.941z"/></svg>
                      Open in Telegram
                    </a>
                  )}
                  <button onClick={() => navigate(TALK_OFFER.ctaPath)} style={{
                    padding:'13px 26px', borderRadius:14, fontSize:15, fontWeight:600,
                    background:'rgba(255,255,255,0.05)', color:'rgba(255,255,255,0.75)',
                    border:'1px solid rgba(255,255,255,0.12)', cursor:'pointer',
                  }}
                    onMouseEnter={e => { e.currentTarget.style.background='rgba(255,255,255,0.09)'; e.currentTarget.style.borderColor='rgba(255,255,255,0.2)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background='rgba(255,255,255,0.05)'; e.currentTarget.style.borderColor='rgba(255,255,255,0.12)'; }}>
                    Talk Starter $5
                  </button>
                </div>

                {/* Trust pills */}
                <div style={{ display:'flex', flexWrap:'wrap', gap:'8px 20px', justifyContent:'center' }} className="lg:justify-start">
                  {[
                    { icon:'✓', col:'#10b981', text:'No ID required' },
                    { icon:'⚡', col:'#F5A623', text:'Active in 60 seconds' },
                    { icon:'🔒', col:'#10b981', text:'100% private' },
                    { icon:'📞', col:'#F5A623', text:'SMS, MMS & calls' },
                    { icon:'🌍', col:'#6366f1', text:'180+ countries' },
                    { icon:'🔢', col:'#F5A623', text:'180+ services' },
                  ].map((t,i) => (
                    <span key={i} style={{ display:'flex', alignItems:'center', gap:6, fontSize:13, color:'rgba(255,255,255,0.78)', fontWeight:500 }}>
                      <span style={{ color:t.col, fontWeight:800 }}>{t.icon}</span>{t.text}
                    </span>
                  ))}
                </div>
              </div>

              {/* Right: hero card */}
              <div style={{ flexShrink:0 }}>
                <HeroCard />
              </div>
            </div>
          </div>
        </section>

        {/* ── WHAT'S NEW ─────────────────────────────────────── */}
        <section style={{ padding:'24px 0 8px' }}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <WhatsNewBox />
          </div>
        </section>

        <TalkOfferSection />

        <GuestServiceSearch />

        {/* ── GUARANTEE STRIP ───────────────────────────────── */}
        <section style={{
          background:'linear-gradient(90deg,rgba(16,185,129,0.10),rgba(16,185,129,0.05) 50%,rgba(16,185,129,0.10))',
          borderTop:'1px solid rgba(16,185,129,0.22)', borderBottom:'1px solid rgba(16,185,129,0.22)',
          padding:'22px 0',
        }}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div style={{ display:'flex', flexWrap:'wrap', gap:28, justifyContent:'center', alignItems:'center', textAlign:'center' }}>
              {[
                { icon:'⚡', text:'Instant Activation', sub:'Active the moment you pay' },
                { icon:'💳', text:'Min deposit $2', sub:'Top up instantly' },
                { icon:'⚡', text:'SMS in < 30s', sub:'Real numbers only' },
                { icon:'🔒', text:'Zero ID required', sub:'100% anonymous' },
              ].map((g,i) => (
                <React.Fragment key={i}>
                  <div style={{ textAlign:'center' }}>
                    <div style={{ fontSize:18, marginBottom:2 }}>{g.icon}</div>
                    <div style={{ fontSize:16, fontWeight:900, color:'#fff' }}>{g.text}</div>
                    <div style={{ fontSize:11, color:'rgba(255,255,255,0.7)', fontWeight:500 }}>{g.sub}</div>
                  </div>
                  {i < 3 && <div style={{ width:1, height:36, background:'rgba(255,255,255,0.12)' }} className="hidden md:block" />}
                </React.Fragment>
              ))}
            </div>
          </div>
        </section>

        {/* ── LIVE ACTIVITY ─────────────────────────────────── */}
        {/* Live activity strip removed — no fake social proof */}

        {/* ── STATS ─────────────────────────────────────────── */}
        <section style={{ padding:'64px 0', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:24, textAlign:'center' }}>
              <div ref={r1}>
                <div style={{ fontSize:52, fontWeight:900, color:'#fff', lineHeight:1, fontVariantNumeric:'tabular-nums' }}>{c1.toLocaleString()}+</div>
                <div style={{ fontSize:14, color:'rgba(255,255,255,0.7)', marginTop:6, fontWeight:500 }}>Happy Customers</div>
              </div>
              <div ref={r2}>
                <div style={{ fontSize:52, fontWeight:900, color:'#fff', lineHeight:1 }}>{c2}+</div>
                <div style={{ fontSize:14, color:'rgba(255,255,255,0.7)', marginTop:6, fontWeight:500 }}>Apps Supported</div>
              </div>
              <div ref={r3}>
                <div style={{ fontSize:52, fontWeight:900, color:'#fff', lineHeight:1 }}>{c3}+</div>
                <div style={{ fontSize:14, color:'rgba(255,255,255,0.7)', marginTop:6, fontWeight:500 }}>eSIM Countries</div>
              </div>
              <div ref={r4}>
                <div style={{ fontSize:52, fontWeight:900, color:'#10b981', lineHeight:1 }}>{c4}</div>
                <div style={{ fontSize:14, color:'rgba(255,255,255,0.7)', marginTop:6, fontWeight:500 }}>Countries (Numbers)</div>
              </div>
            </div>
          </div>
        </section>

        {/* ── SLOGAN ────────────────────────────────────────── */}
        <section style={{ padding:'60px 0 56px', textAlign:'center', borderBottom:'1px solid rgba(255,255,255,0.06)', position:'relative', overflow:'hidden' }}>
          {/* subtle background glow */}
          <div style={{ position:'absolute', inset:0, background:'radial-gradient(ellipse at 50% 100%, rgba(245,166,35,0.06), transparent 70%)', pointerEvents:'none' }} />
          <div className="max-w-4xl mx-auto px-4 relative">
            <p style={{ fontSize:'clamp(28px,4.5vw,52px)', fontWeight:900, lineHeight:1.25, letterSpacing:'-0.5px', margin:0 }}>
              <span style={{ color:'rgba(255,255,255,0.55)', fontStyle:'italic', fontWeight:400 }}>We can talk </span>
              <span style={{ color:'#F5A623', fontStyle:'italic' }}>any language,</span>
              <br />
              <span style={{ color:'rgba(255,255,255,0.55)', fontStyle:'italic', fontWeight:400 }}>even </span>
              <span style={{ color:'#fff', fontStyle:'italic' }}>yours.</span>
            </p>
            <p style={{ marginTop:16, fontSize:15, color:'rgba(255,255,255,0.45)', fontWeight:500, letterSpacing:0.3 }}>
              One platform. Every country. Any app.
            </p>
          </div>
        </section>

        {/* ── SERVICES ──────────────────────────────────────── */}
        <section style={{ padding:'96px 0' }}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div style={{ textAlign:'center', marginBottom:60 }}>
              <div style={{ display:'inline-block', padding:'5px 16px', borderRadius:100, background:'rgba(245,166,35,0.1)', border:'1px solid rgba(245,166,35,0.2)', fontSize:12, fontWeight:700, color:'#F5A623', letterSpacing:2, textTransform:'uppercase', marginBottom:14 }}>Four products</div>
              <h2 style={{ fontSize:'clamp(30px,4.5vw,52px)', fontWeight:900, lineHeight:1.1, letterSpacing:'-0.5px', marginBottom:14 }}>Everything You Need</h2>
              <p style={{ fontSize:17, color:'rgba(255,255,255,0.72)', maxWidth:500, margin:'0 auto' }}>One account. Four products. Global reach.</p>
            </div>

            <div style={{ display:'grid', gap:20 }} className="grid sm:grid-cols-2">
              {services.map((s,i) => (
                <div key={i} className="lp-service-card" style={{ borderRadius:22, padding:28, cursor:'pointer', position:'relative' }}
                  onClick={() => navigate(s.route)}>
                  {s.badge && (
                    <div style={{ position:'absolute', top:16, right:16, padding:'3px 10px', borderRadius:100, background:'linear-gradient(135deg,#059669,#10b981)', fontSize:9, fontWeight:800, color:'#fff', letterSpacing:1.5, textTransform:'uppercase', boxShadow:'0 2px 10px rgba(16,185,129,0.4)' }}>{s.badge}</div>
                  )}
                  <div style={{ width:56, height:56, borderRadius:16, background:s.gradient, display:'flex', alignItems:'center', justifyContent:'center', fontSize:26, marginBottom:20, boxShadow:`0 8px 24px ${s.glow}` }}>
                    {s.icon}
                  </div>
                  <h3 style={{ fontSize:20, fontWeight:800, color:'#fff', marginBottom:6 }}>{s.title}</h3>
                  <p style={{ fontSize:14, color:'rgba(255,255,255,0.75)', lineHeight:1.65, marginBottom:20 }}>{s.desc}</p>
                  <div style={{ display:'flex', flexDirection:'column', gap:7, marginBottom:22 }}>
                    {s.features.map(f => (
                      <div key={f} style={{ display:'flex', alignItems:'center', gap:8, fontSize:13, color:'rgba(255,255,255,0.65)' }}>
                        <Check style={{ width:14, height:14, color:'#10b981', flexShrink:0 }} /> {f}
                      </div>
                    ))}
                  </div>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', paddingTop:16, borderTop:'1px solid rgba(255,255,255,0.07)' }}>
                    <span style={{ fontSize:14, fontWeight:800, color:'rgba(255,255,255,0.85)' }}>{s.price}</span>
                    <span style={{ fontSize:13, fontWeight:700, color:'rgba(255,255,255,0.75)', display:'flex', alignItems:'center', gap:4 }}>
                      {s.cta} <ArrowRight style={{ width:14, height:14 }} />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── HOW IT WORKS ──────────────────────────────────── */}
        <section style={{ padding:'80px 0', background:'rgba(255,255,255,0.012)', borderTop:'1px solid rgba(255,255,255,0.06)', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div style={{ textAlign:'center', marginBottom:56 }}>
              <h2 style={{ fontSize:'clamp(28px,4vw,48px)', fontWeight:900, lineHeight:1.1, letterSpacing:'-0.5px', marginBottom:12 }}>How It Works</h2>
              <p style={{ fontSize:17, color:'rgba(255,255,255,0.72)' }}>From signup to active in under 2 minutes.</p>
            </div>
            <div style={{ display:'grid', gap:20 }} className="grid md:grid-cols-3">
              {[
                { n:'1', emoji:'👤', title:'Create Account', desc:'Sign up in 30 seconds with just your email. No ID, no documents — ever.' },
                { n:'2', emoji:'💳', title:'Add Balance', desc:'Top up from $2 via Visa/Mastercard/Amex or crypto. Works in every country.' },
                { n:'3', emoji:'⚡', title:'Call or verify', desc:'Pick a number or eSIM. Receive SMS free. Outbound US/CA calls from $0.02/min — 60 min on first $5.' },
              ].map(s => (
                <div key={s.n} className="lp-glass" style={{ borderRadius:20, padding:'28px 24px', textAlign:'center' }}>
                  <div style={{ width:56, height:56, borderRadius:'50%', background:'#F5A623', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:900, fontSize:22, color:'#000', margin:'0 auto 16px' }}>{s.n}</div>
                  <div style={{ fontSize:32, marginBottom:12 }}>{s.emoji}</div>
                  <h3 style={{ fontSize:17, fontWeight:800, color:'#fff', marginBottom:8 }}>{s.title}</h3>
                  <p style={{ fontSize:14, color:'rgba(255,255,255,0.72)', lineHeight:1.65 }}>{s.desc}</p>
                </div>
              ))}
            </div>
            <div style={{ textAlign:'center', marginTop:40 }}>
              <button onClick={() => navigate('/browse-numbers?first=1')} className="lp-btn-primary" style={{
                padding:'14px 32px', borderRadius:13, fontSize:15, fontWeight:700,
                background:'#F5A623', color:'#000',
                border:'none', cursor:'pointer', boxShadow:'0 6px 28px rgba(245,166,35,0.4)',
              }}>
                Start Now — It's Free →
              </button>
            </div>
          </div>
        </section>

        {/* ── PRICING ───────────────────────────────────────── */}
        <section style={{ padding:'96px 0' }}>
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div style={{ textAlign:'center', marginBottom:56 }}>
              <div style={{ display:'inline-block', padding:'5px 16px', borderRadius:100, background:'rgba(245,166,35,0.1)', border:'1px solid rgba(245,166,35,0.2)', fontSize:12, fontWeight:700, color:'#F5A623', letterSpacing:2, textTransform:'uppercase', marginBottom:14 }}>Transparent Pricing</div>
              <h2 style={{ fontSize:'clamp(28px,4vw,48px)', fontWeight:900, lineHeight:1.1, letterSpacing:'-0.5px', marginBottom:12 }}>Simple, Honest Pricing</h2>
              <p style={{ fontSize:17, color:'rgba(255,255,255,0.72)' }}>No hidden fees. Pay only for what you use.</p>
            </div>
            <div style={{ display:'grid', gap:20 }} className="grid sm:grid-cols-2 lg:grid-cols-4">
              {[
                { name:'Talk Starter', price:'$5', period:'', desc:'60 minutes US/Canada on your first $5. Then $0.02/min. Real calls, not OTP.', cta:'Add $5 →', best:true, col:'#F5A623', route: TALK_OFFER.ctaPath },
                { name:'Monthly Number', price:'$1.99', period:'/mo', desc:'US number with SMS, MMS & calls. From $1.99/mo. Cancel anytime.', cta:'Get Started', best:false, col:'#F5A623', route: '/browse-numbers?first=1' },
                { name:'Annual Plan', price:'$1.35', period:'/mo', desc:'Same features, 32% off. Billed yearly. Less than a coffee a month.', cta:'Save 32% →', best:false, col:'#F5A623', route: '/browse-numbers?first=1' },
                { name:'eSIM Data', price:'$0.54', period:'+', desc:'Scan a QR. Go online in 180+ countries. No physical SIM.', cta:'Browse Plans', best:false, col:'#10b981', route: '/esim' },
              ].map((p,i) => (
                <div key={i} style={{
                  position:'relative', borderRadius:22, padding:28,
                  background: p.best ? 'linear-gradient(135deg,rgba(245,166,35,0.12),rgba(245,166,35,0.06))' : 'rgba(255,255,255,0.025)',
                  border: p.best ? `1px solid rgba(245,166,35,0.4)` : '1px solid rgba(255,255,255,0.08)',
                  boxShadow: p.best ? '0 0 60px rgba(245,166,35,0.12)' : 'none',
                }}>
                  {p.best && (
                    <div style={{ position:'absolute', top:-13, left:'50%', transform:'translateX(-50%)', padding:'5px 16px', borderRadius:100, background:'#F5A623', fontSize:10, fontWeight:800, color:'#000', whiteSpace:'nowrap', boxShadow:'0 4px 16px rgba(245,166,35,0.4)', letterSpacing:0.5 }}>MOST POPULAR</div>
                  )}
                  <h3 style={{ fontSize:16, fontWeight:700, color:'#fff', marginBottom:14 }}>{p.name}</h3>
                  <div style={{ display:'flex', alignItems:'baseline', gap:3, marginBottom:12 }}>
                    <span style={{ fontSize:44, fontWeight:900, color:'#fff' }}>{p.price}</span>
                    <span style={{ fontSize:13, color:'rgba(255,255,255,0.65)' }}>{p.period}</span>
                  </div>
                  <p style={{ fontSize:14, color:'rgba(255,255,255,0.72)', lineHeight:1.65, marginBottom:24 }}>{p.desc}</p>
                  <button onClick={() => navigate(p.route)} style={{
                    width:'100%', padding:'12px 0', borderRadius:12, fontSize:14, fontWeight:700,
                    cursor:'pointer', border:'none',
                    background: p.best ? `linear-gradient(135deg,${p.col},${p.col}cc)` : 'rgba(255,255,255,0.08)',
                    color: p.best ? '#000' : '#fff', boxShadow: p.best ? `0 4px 20px ${p.col}44` : 'none',
                  }}
                    onMouseEnter={e => e.currentTarget.style.transform='translateY(-2px)'}
                    onMouseLeave={e => e.currentTarget.style.transform='translateY(0)'}>
                    {p.cta}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── WHY CALLIOTEL ─────────────────────────────────── */}
        <section style={{ padding:'80px 0', background:'rgba(255,255,255,0.012)', borderTop:'1px solid rgba(255,255,255,0.06)' }}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div style={{ display:'grid', gap:48 }} className="grid lg:grid-cols-2 items-center">
              <div>
                <div style={{ display:'inline-block', padding:'5px 16px', borderRadius:100, background:'rgba(245,166,35,0.1)', border:'1px solid rgba(245,166,35,0.2)', fontSize:12, fontWeight:700, color:'#F5A623', letterSpacing:2, textTransform:'uppercase', marginBottom:18 }}>Why Calliotel</div>
                <h2 style={{ fontSize:'clamp(28px,3.5vw,44px)', fontWeight:900, lineHeight:1.12, marginBottom:18, letterSpacing:'-0.5px' }}>Built for Privacy &amp; Global Reach</h2>
                <p style={{ fontSize:16, color:'rgba(255,255,255,0.75)', lineHeight:1.75, marginBottom:28 }}>
                  Whether you're protecting your personal number, building a business presence, or verifying services globally — Calliotel delivers instantly with zero paperwork.
                </p>
                <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                  {[
                    { icon:<Shield size={18}/>, col:'#10b981', title:'Complete Privacy', desc:'Your real number is never shared. No ID, no documents, ever.' },
                    { icon:<Globe size={18}/>, col:'#F5A623', title:'5 Countries + 180+ eSIM', desc:'Real numbers from US, UK, CA, AU, PR. Data plans globally.' },
                    { icon:<Zap size={18}/>, col:'#f59e0b', title:'Instant Activation', desc:'Active the moment you pay. No waiting, no approval process.' },
                    { icon:<Users size={18}/>, col:'#8b5cf6', title:'All-In-One Dashboard', desc:'Manage numbers & eSIM plans from one clean interface.' },
                  ].map((item,i) => (
                    <div key={i} className="lp-glass" style={{ borderRadius:14, padding:'14px 18px', display:'flex', alignItems:'flex-start', gap:12 }}>
                      <div style={{ width:38, height:38, borderRadius:11, background:`${item.col}22`, display:'flex', alignItems:'center', justifyContent:'center', color:item.col, flexShrink:0 }}>{item.icon}</div>
                      <div>
                        <p style={{ fontSize:14, fontWeight:700, color:'#fff', marginBottom:2 }}>{item.title}</p>
                        <p style={{ fontSize:13, color:'rgba(255,255,255,0.7)', lineHeight:1.5 }}>{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Comparison */}
              <div style={{ borderRadius:22, overflow:'hidden', border:'1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ background:'rgba(255,255,255,0.03)', padding:'16px 24px', borderBottom:'1px solid rgba(255,255,255,0.07)', display:'grid', gridTemplateColumns:'1fr 120px 120px', gap:8, fontSize:12, fontWeight:700, color:'rgba(255,255,255,0.65)', textTransform:'uppercase', letterSpacing:1 }}>
                  <span>Feature</span><span style={{ textAlign:'center', color:'#F5A623' }}>Calliotel</span><span style={{ textAlign:'center' }}>Others</span>
                </div>
                {[
                  ['No ID required','✓','✗'],
                  ['Instant activation','✓','Varies'],
                  ['eSIM (180+ countries)','✓','Rarely'],
                  ['SMS, MMS & calls','✓','Varies'],
                  ['Crypto payments','✓','Rare'],
                  ['Mobile app (iOS + Android)','✓','Some'],
                  ['24/7 support','✓','Varies'],
                ].map(([feat,us,them],i) => (
                  <div key={i} style={{ padding:'13px 24px', display:'grid', gridTemplateColumns:'1fr 120px 120px', gap:8, borderBottom:'1px solid rgba(255,255,255,0.05)', background: i%2===0?'rgba(255,255,255,0.01)':'transparent' }}>
                    <span style={{ fontSize:14, color:'rgba(255,255,255,0.7)' }}>{feat}</span>
                    <span style={{ textAlign:'center', fontSize:14, fontWeight:800, color:'#10b981' }}>{us}</span>
                    <span style={{ textAlign:'center', fontSize:14, color:'rgba(255,255,255,0.65)' }}>{them}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── TESTIMONIALS ──────────────────────────────────── */}
        <section style={{ padding:'96px 0' }}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div style={{ textAlign:'center', marginBottom:56 }}>
              <div style={{ display:'inline-flex', alignItems:'center', gap:8, marginBottom:16, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:100, padding:'6px 16px' }}>
                {[...Array(5)].map((_,i) => <Star key={i} size={14} fill="#f59e0b" color="#f59e0b" />)}
                <span style={{ fontSize:14, color:'rgba(255,255,255,0.78)', fontWeight:600 }}>Trusted by users in 100+ countries</span>
              </div>
              <h2 style={{ fontSize:'clamp(28px,4vw,48px)', fontWeight:900, lineHeight:1.1, letterSpacing:'-0.5px' }}>Real People, Real Results</h2>
            </div>
            <div style={{ display:'grid', gap:16 }} className="grid sm:grid-cols-2 lg:grid-cols-3">
              {[
                { name:'Rahul S.', loc:'🇮🇳 Mumbai, India', text:'Used it to get a US WhatsApp number for my business. Activated in 60 seconds. My clients think I\'m based in America. Incredible.', stars:5, av:'RS' },
                { name:'Marcus K.', loc:'🇬🇧 London, UK', text:'Got a UK number in 10 seconds. Worked first try. The eSIM for my trip to Japan was perfect — scanned the QR and had data instantly.', stars:5, av:'MK' },
                { name:'Ahmed F.', loc:'🇵🇰 Karachi, Pakistan', text:'Best service I found. Got a US number, verified WhatsApp in under 2 minutes. Very cheap, great support. Will buy more numbers.', stars:5, av:'AF' },
                { name:'Yuki T.', loc:'🇯🇵 Tokyo, Japan', text:'The eSIM saved me on a business trip. Bought it from the airport — instant data in Europe. Way cheaper than roaming.', stars:5, av:'YT' },
                { name:'Carlos M.', loc:'🇧🇷 São Paulo, Brazil', text:'Got a US number in under a minute. Used it to verify my WhatsApp business account. Works perfectly — cheapest I found anywhere.', stars:5, av:'CM' },
                { name:'Kofi A.', loc:'🇳🇬 Lagos, Nigeria', text:'Tried 4 other providers — all had issues. Calliotel just works. Numbers activate instantly, pricing is fair, support is fast.', stars:5, av:'KA' },
              ].map((t,i) => (
                <div key={i} className="lp-testimonial" style={{ borderRadius:20, padding:24 }}>
                  <div style={{ display:'flex', gap:2, marginBottom:14 }}>
                    {[...Array(t.stars)].map((_,j) => <Star key={j} size={14} fill="#f59e0b" color="#f59e0b" />)}
                  </div>
                  <p style={{ fontSize:14, color:'rgba(255,255,255,0.7)', lineHeight:1.7, marginBottom:18, fontStyle:'italic' }}>"{t.text}"</p>
                  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <div style={{ width:36, height:36, borderRadius:'50%', background:'linear-gradient(135deg,#F5A623,#d4901d)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:800, color:'#000', flexShrink:0 }}>{t.av}</div>
                    <div>
                      <div style={{ fontSize:13, fontWeight:700, color:'#fff' }}>{t.name}</div>
                      <div style={{ fontSize:12, color:'rgba(255,255,255,0.65)' }}>{t.loc}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── MOBILE APP ────────────────────────────────────── */}
        <AppSection />

        {/* ── FAQ ───────────────────────────────────────────── */}
        <section style={{ padding:'80px 0', borderTop:'1px solid rgba(255,255,255,0.06)' }}>
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <div style={{ textAlign:'center', marginBottom:48 }}>
              <h2 style={{ fontSize:'clamp(26px,4vw,44px)', fontWeight:900, lineHeight:1.1, letterSpacing:'-0.5px', marginBottom:10 }}>Frequently Asked Questions</h2>
              <p style={{ fontSize:16, color:'rgba(255,255,255,0.7)' }}>Everything you need to know before getting started.</p>
            </div>
            <div style={{ borderRadius:20, overflow:'hidden', border:'1px solid rgba(255,255,255,0.08)' }}>
              {faqs.map((faq,i) => (
                <div key={i} className="lp-faq-item" style={{ padding:'20px 24px', cursor:'pointer' }} onClick={() => setOpenFaq(openFaq===i ? null : i)}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:16 }}>
                    <span style={{ fontSize:15, fontWeight:700, color:'#fff' }}>{faq.q}</span>
                    <ChevronDown size={18} style={{ color:'rgba(255,255,255,0.65)', flexShrink:0, transform: openFaq===i?'rotate(180deg)':'none', transition:'transform 0.2s' }} />
                  </div>
                  {openFaq===i && (
                    <p style={{ fontSize:14, color:'rgba(255,255,255,0.75)', lineHeight:1.7, marginTop:12, marginBottom:0 }}>{faq.a}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA BANNER ────────────────────────────────────── */}
        <section style={{
          margin:'0 0 0', padding:'96px 0',
          background:'linear-gradient(135deg,rgba(245,166,35,0.12),rgba(245,166,35,0.06))',
          borderTop:'1px solid rgba(245,166,35,0.25)', borderBottom:'1px solid rgba(245,166,35,0.15)',
          textAlign:'center',
        }}>
          <div className="max-w-2xl mx-auto px-4">
            <div style={{ fontSize:48, marginBottom:16 }}>🚀</div>
            <h2 style={{ fontSize:'clamp(28px,4vw,48px)', fontWeight:900, lineHeight:1.1, letterSpacing:'-0.5px', marginBottom:16, color:'#fff' }}>
              Ready to Get Your Number?
            </h2>
            <p style={{ fontSize:18, color:'rgba(255,255,255,0.75)', marginBottom:36 }}>
              Join thousands of users in 100+ countries. Active in 60 seconds. No ID required.
            </p>
            <div style={{ display:'flex', gap:12, justifyContent:'center', flexWrap:'wrap' }}>
              <button onClick={() => navigate('/browse-numbers?first=1')} className="lp-btn-primary" style={{
                padding:'16px 40px', borderRadius:14, fontSize:17, fontWeight:800,
                background:'#F5A623', color:'#000',
                border:'none', cursor:'pointer', boxShadow:'0 8px 32px rgba(245,166,35,0.5)',
              }}>
                Get Started Now →
              </button>
              <button onClick={() => navigate('/esim')} style={{
                padding:'14px 28px', borderRadius:14, fontSize:15, fontWeight:600,
                background:'rgba(255,255,255,0.07)', color:'rgba(255,255,255,0.8)',
                border:'1px solid rgba(255,255,255,0.15)', cursor:'pointer',
              }}
                onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.12)'}
                onMouseLeave={e => e.currentTarget.style.background='rgba(255,255,255,0.07)'}>
                Browse eSIM Plans 📡
              </button>
            </div>
          </div>
        </section>
      </main>

      <ProfessionalFooter />
      <TalkOfferModal />
    </div>
  );
};

export default LandingPage;
