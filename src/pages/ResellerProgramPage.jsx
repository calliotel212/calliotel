import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight, CheckCircle, TrendingUp, Users, DollarSign, Zap,
  Tag, Sparkles, Image as ImageIcon, ShieldCheck, Rocket, Star,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const ResellerProgramPage = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const ctaTarget = isAuthenticated ? '/reseller' : '/signup?next=/reseller';

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(180deg, #0a0a0f 0%, #18120c 100%)', color: '#fff' }}>
      {/* HERO ───────────────────────────────────────────────────────── */}
      <section style={{ padding: '120px 20px 80px', maxWidth: 1100, margin: '0 auto', textAlign: 'center' }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 14px',
          borderRadius: 999, background: 'rgba(16,185,129,0.12)',
          border: '1px solid rgba(16,185,129,0.3)', fontSize: 13, fontWeight: 600, color: '#fbbf24',
          marginBottom: 24,
        }}>
          <Sparkles size={14} /> NEW — White-label reseller program
        </div>
        <h1 style={{
          fontSize: 'clamp(36px, 6vw, 64px)', fontWeight: 900, lineHeight: 1.05,
          letterSpacing: '-1.5px', marginBottom: 20,
        }}>
          Sell virtual numbers & SMS<br />
          <span style={{ background: 'linear-gradient(135deg, #fbbf24, #10b981)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            under your own brand
          </span>
        </h1>
        <p style={{ fontSize: 'clamp(16px, 2.2vw, 20px)', color: 'rgba(255,255,255,0.7)', maxWidth: 720, margin: '0 auto 32px', lineHeight: 1.5 }}>
          Buy credits at <b style={{ color: '#fbbf24' }}>30% off wholesale</b>, mark them up however you like,
          and serve your own verified business customers from one dashboard. No setup fees.
          No long contracts. Partner approval and compliance checks apply.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => navigate(ctaTarget)} style={{
            padding: '16px 32px', fontSize: 17, fontWeight: 800, borderRadius: 12,
            background: 'linear-gradient(135deg, #10b981, #047857)', color: '#fff',
            border: 'none', cursor: 'pointer', boxShadow: '0 4px 24px rgba(16,185,129,0.5)',
            display: 'inline-flex', alignItems: 'center', gap: 8,
          }}>
            <Rocket size={18} /> Apply to Partner — Free
            <ArrowRight size={18} />
          </button>
          <button onClick={() => document.getElementById('how-it-works')?.scrollIntoView({behavior:'smooth'})} style={{
            padding: '16px 28px', fontSize: 17, fontWeight: 700, borderRadius: 12,
            background: 'transparent', color: '#fff', border: '1px solid rgba(255,255,255,0.2)',
            cursor: 'pointer',
          }}>
            How it works ↓
          </button>
        </div>

        <div style={{
          marginTop: 32, display: 'flex', gap: 10, justifyContent: 'center',
          flexWrap: 'wrap', fontSize: 13, color: 'rgba(255,255,255,0.7)',
        }}>
          {[
            'Business verification',
            'Transparent wholesale pricing',
            'Keep 100% of markup',
          ].map((t, i) => (
            <span key={i} style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '6px 12px', borderRadius: 999,
              background: 'rgba(34,197,94,0.08)',
              border: '1px solid rgba(34,197,94,0.22)',
              whiteSpace: 'nowrap',
            }}>
              <CheckCircle size={13} color="#22c55e" /> {t}
            </span>
          ))}
        </div>
      </section>

      {/* EXPLAINER VIDEO ───────────────────────────────────────────── */}
      <section style={{ padding: '20px 20px 40px', maxWidth: 1100, margin: '0 auto' }}>
        <div style={{
          position: 'relative', width: '100%', paddingTop: '56.25%',
          borderRadius: 20, overflow: 'hidden',
          border: '1px solid rgba(16,185,129,0.25)',
          boxShadow: '0 12px 48px rgba(16,185,129,0.18)',
          background: '#000',
        }}>
          <iframe
            src="/reseller-howto/"
            title="How to Become a Calliotel Reseller"
            allow="autoplay; fullscreen"
            style={{
              position: 'absolute', top: 0, left: 0,
              width: '100%', height: '100%', border: 0,
            }}
          />
        </div>
        <p style={{ textAlign: 'center', marginTop: 12, fontSize: 13, color: 'rgba(255,255,255,0.45)' }}>
          45-second walkthrough — how the reseller program works, end to end.
        </p>
      </section>

      {/* THREE BIG VALUE PROPS ─────────────────────────────────────── */}
      <section style={{ padding: '40px 20px', maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
          {[
            { icon: <DollarSign size={28} color="#22c55e" />, title: '30% Wholesale Discount', desc: 'Every $1 of credit costs you just $0.70. Built-in 43% margin before you even mark up.' },
            { icon: <Tag size={28} color="#fbbf24" />, title: 'Pick Your Markup',  desc: 'Choose 1.5x, 2x, or 3x. We show suggested retail; you keep every cent above wholesale.' },
            { icon: <Users size={28} color="#F5A623" />, title: 'Customer Sub-Accounts', desc: 'Create accounts for your customers in seconds. Email + password — they log in to YOUR brand.' },
          ].map((card, i) => (
            <div key={i} style={{
              padding: 28, borderRadius: 16,
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
            }}>
              <div style={{ marginBottom: 14 }}>{card.icon}</div>
              <h3 style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>{card.title}</h3>
              <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 14.5, lineHeight: 1.55 }}>{card.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS ──────────────────────────────────────────────── */}
      <section id="how-it-works" style={{ padding: '80px 20px', maxWidth: 1000, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <h2 style={{ fontSize: 36, fontWeight: 900, marginBottom: 12 }}>Live in 4 steps</h2>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 17 }}>A clear path from application to compliant customer service.</p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {[
            { n: 1, title: 'Apply & verify your business', desc: 'Tell us about your company and intended use. We review partner applications before reseller access is enabled.' },
            { n: 2, title: 'Pick your brand name & upload logo', desc: 'Choose what your customers will see — for example, "MaxTel Pro" or "Nova Connect". Upload a logo and configure your partner branding.' },
            { n: 3, title: 'Onboard verified customers', desc: 'Create customer sub-accounts and collect the business or identity information required for their numbers and messaging use case.' },
            { n: 4, title: 'Fund service & set your price', desc: 'Fund customer service at your wholesale rate, choose a sustainable retail markup and manage the relationship from your dashboard.' },
          ].map(s => (
            <div key={s.n} style={{
              display: 'flex', gap: 20, padding: 24, borderRadius: 16,
              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
              alignItems: 'flex-start',
            }}>
              <div style={{
                flexShrink: 0, width: 48, height: 48, borderRadius: 12,
                background: 'linear-gradient(135deg, #10b981, #047857)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 22, fontWeight: 900,
              }}>{s.n}</div>
              <div>
                <h3 style={{ fontSize: 19, fontWeight: 800, marginBottom: 6 }}>{s.title}</h3>
                <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 15, lineHeight: 1.55 }}>{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* PROFIT EXAMPLE ────────────────────────────────────────────── */}
      <section style={{ padding: '40px 20px 80px', maxWidth: 900, margin: '0 auto' }}>
        <div style={{
          padding: 36, borderRadius: 20,
          background: 'linear-gradient(135deg, rgba(34,197,94,0.08), rgba(16,185,129,0.08))',
          border: '1px solid rgba(34,197,94,0.25)',
        }}>
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <TrendingUp size={32} color="#22c55e" style={{margin:'0 auto 12px'}} />
            <h2 style={{ fontSize: 28, fontWeight: 900 }}>Illustrative recurring-revenue model</h2>
            <p style={{ color: 'rgba(255,255,255,0.6)', marginTop: 6 }}>Example only: 10 customers buying $50/month each</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, textAlign: 'center' }}>
            {[
              { label: 'Customers', value: '10', color: '#F5A623' },
              { label: 'Their spend', value: '$500', color: '#fbbf24' },
              { label: 'Your wholesale cost', value: '$350', color: '#a3a3a3' },
              { label: 'Your monthly profit', value: '$150', color: '#22c55e', big: true },
            ].map((s,i)=>(
              <div key={i} style={{ padding: 16, borderRadius: 12, background: 'rgba(0,0,0,0.3)' }}>
                <div style={{ fontSize: s.big?32:24, fontWeight: 900, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', marginTop: 4 }}>{s.label}</div>
              </div>
            ))}
          </div>
          <p style={{ textAlign: 'center', marginTop: 20, fontSize: 14, color: 'rgba(255,255,255,0.55)' }}>
            Example gross margin before payment fees, support, taxes, compliance and other operating costs.
          </p>
        </div>
      </section>

      {/* BUSINESS PARTNER PACKAGES ─────────────────────────────────── */}
      <section style={{ padding: '40px 20px 80px', maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 14px',
            borderRadius: 999, background: 'rgba(34,197,94,0.12)',
            border: '1px solid rgba(34,197,94,0.35)', fontSize: 13, fontWeight: 700, color: '#22c55e',
            marginBottom: 16,
          }}>
            <DollarSign size={14} /> BUSINESS PARTNER PACKAGES
          </div>
          <h2 style={{ fontSize: 36, fontWeight: 900, marginBottom: 10 }}>
            Build recurring revenue with{' '}
            <span style={{ background: 'linear-gradient(135deg, #fbbf24, #22c55e)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              real business customers
            </span>
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 16, maxWidth: 720, margin: '0 auto' }}>
            Serve agencies, support teams, property managers and online businesses that need
            dedicated phone lines. You choose your retail price and keep the markup.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
          {[
            {
              name: 'Starter Partner',
              audience: 'Freelancers and local businesses',
              example: '5 customer lines',
              features: ['Custom branding', 'Customer sub-accounts', 'Email support'],
              color: '#22c55e',
            },
            {
              name: 'Agency Partner',
              audience: 'Agencies and support teams',
              example: '25 customer lines',
              features: ['Everything in Starter', 'Priority onboarding', 'Usage reporting'],
              color: '#fbbf24',
            },
            {
              name: 'White-Label Partner',
              audience: 'Established telecom resellers',
              example: 'Your domain and storefront',
              features: ['Branded website', 'Custom pricing', 'Launch assistance'],
              color: '#10b981',
            },
          ].map((plan) => (
            <div key={plan.name} style={{
              padding: 24, borderRadius: 16,
              background: `linear-gradient(135deg, ${plan.color}15, transparent)`,
              border: `1px solid ${plan.color}55`,
            }}>
              <div style={{ fontSize: 12, color: plan.color, fontWeight: 800, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8 }}>
                {plan.example}
              </div>
              <h3 style={{ fontSize: 22, fontWeight: 900, marginBottom: 6 }}>{plan.name}</h3>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', marginBottom: 16 }}>{plan.audience}</p>
              {plan.features.map(feature => (
                <div key={feature} style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 9, fontSize: 14, color: 'rgba(255,255,255,0.75)' }}>
                  <CheckCircle size={14} color={plan.color} /> {feature}
                </div>
              ))}
            </div>
          ))}
        </div>

        <div style={{ marginTop: 28, padding: 20, borderRadius: 14,
          background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.3)',
          textAlign: 'center', fontSize: 14.5, color: 'rgba(255,255,255,0.85)' }}>
          <ShieldCheck size={16} style={{ display: 'inline', verticalAlign: 'text-bottom', marginRight: 6, color: '#22c55e' }} />
          Partners must verify customers where required and follow consent, messaging-registration,
          identity and acceptable-use rules. We help legitimate businesses launch correctly.
        </div>
      </section>

      {/* FEATURES GRID ─────────────────────────────────────────────── */}
      <section style={{ padding: '40px 20px 80px', maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <h2 style={{ fontSize: 32, fontWeight: 900 }}>Everything you need built in</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
          {[
            { icon: <ImageIcon size={20}/>, t: 'Logo upload', d: 'PNG/JPG/SVG up to 150KB' },
            { icon: <Zap size={20}/>, t: 'Instant funding', d: 'Atomic, race-safe wallet transfers' },
            { icon: <ShieldCheck size={20}/>, t: 'Full audit trail', d: 'Every transaction logged' },
            { icon: <Star size={20}/>, t: 'Multi-country inventory', d: 'Availability varies by country and regulation' },
            { icon: <Users size={20}/>, t: 'Unlimited customers', d: 'No cap on sub-accounts' },
          ].map((f,i)=>(
            <div key={i} style={{
              padding: 18, borderRadius: 12,
              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
            }}>
              <div style={{ color: '#fbbf24', marginBottom: 8 }}>{f.icon}</div>
              <h4 style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>{f.t}</h4>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)' }}>{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ ────────────────────────────────────────────────────────── */}
      <section style={{ padding: '40px 20px 80px', maxWidth: 800, margin: '0 auto' }}>
        <h2 style={{ fontSize: 32, fontWeight: 900, textAlign: 'center', marginBottom: 32 }}>Quick answers</h2>
        {[
          { q: 'Is there a fee to become a reseller?', a: 'There is no application fee. Partner access is subject to business verification, use-case review and approval.' },
          { q: 'Do my customers know I\'m using Calliotel?', a: 'No. They log in and see YOUR brand name and logo at the top. They never see "Calliotel" anywhere.' },
          { q: 'How do I bill my customers?', a: 'You bill customers through your approved business payment method and remain responsible for invoices, taxes, refunds and payment compliance.' },
          { q: 'What\'s the minimum customer top-up?', a: 'You decide. Send $1 or $1,000 — your call. The 30% discount applies on every transfer.' },
          { q: 'Can I leave the program?', a: 'Yes, anytime. Your customers and credits stay yours. No lock-in.' },
        ].map((f,i)=>(
          <details key={i} style={{
            padding: 20, marginBottom: 12, borderRadius: 12,
            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
          }}>
            <summary style={{ cursor: 'pointer', fontWeight: 700, fontSize: 16 }}>{f.q}</summary>
            <p style={{ marginTop: 12, color: 'rgba(255,255,255,0.7)', fontSize: 14.5, lineHeight: 1.55 }}>{f.a}</p>
          </details>
        ))}
      </section>

      {/* FINAL CTA ────────────────────────────────────────────────── */}
      <section style={{ padding: '60px 20px 100px', textAlign: 'center' }}>
        <h2 style={{ fontSize: 36, fontWeight: 900, marginBottom: 16 }}>
          Ready to launch your own SMS business?
        </h2>
        <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 17, marginBottom: 28 }}>
          {isAuthenticated ? 'You\'re already signed in — head to your reseller dashboard.' : 'Create your free account in 30 seconds.'}
        </p>
        <button onClick={() => navigate(ctaTarget)} style={{
          padding: '18px 40px', fontSize: 18, fontWeight: 800, borderRadius: 12,
          background: 'linear-gradient(135deg, #10b981, #047857)', color: '#fff',
          border: 'none', cursor: 'pointer', boxShadow: '0 4px 24px rgba(16,185,129,0.5)',
          display: 'inline-flex', alignItems: 'center', gap: 8,
        }}>
          {isAuthenticated ? 'Open Reseller Dashboard' : 'Get Started — It\'s Free'}
          <ArrowRight size={18} />
        </button>
      </section>
    </div>
  );
};

export default ResellerProgramPage;
