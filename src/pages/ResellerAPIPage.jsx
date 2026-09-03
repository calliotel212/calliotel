import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import LandingNav from '../components/LandingNav';
import ProfessionalFooter from '../components/ProfessionalFooter';
import { Check, ChevronDown, ArrowRight, Copy, CheckCheck, Zap, Globe, Shield, Code, DollarSign, Layers } from 'lucide-react';

const API = (process.env.REACT_APP_BACKEND_URL || '') + '/api';

/* ── Code snippet tab ─────────────────────────────────────── */
function CodeBlock({ code, lang = 'bash' }) {
  const [copied, setCopied] = useState(false);
  return (
    <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', background: '#0d1117', border: '1px solid rgba(255,255,255,0.08)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px', background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: 600, letterSpacing: 1 }}>{lang.toUpperCase()}</span>
        <button onClick={() => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: copied ? '#10b981' : 'rgba(255,255,255,0.4)', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600 }}>
          {copied ? <><CheckCheck size={13} /> Copied</> : <><Copy size={13} /> Copy</>}
        </button>
      </div>
      <pre style={{ margin: 0, padding: '18px 20px', fontSize: 13, color: '#e2e8f0', lineHeight: 1.75, overflowX: 'auto', fontFamily: "'Fira Code', 'Cascadia Code', monospace" }}>
        <code>{code}</code>
      </pre>
    </div>
  );
}

/* ── Apply form modal ─────────────────────────────────────── */
function ApplyModal({ onClose }) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(null);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    company_name: '', contact_name: '', email: '', phone: '',
    website: '', business_type: 'developer', expected_monthly_volume: 100,
    use_case: '', wants_white_label: false, white_label_brand_name: '',
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const submit = async () => {
    setLoading(true); setError('');
    try {
      const { data } = await axios.post(`${API}/reseller-api/apply`, {
        ...form,
        expected_monthly_volume: parseInt(form.expected_monthly_volume) || 0,
      });
      setDone(data);
    } catch (e) {
      setError(e.response?.data?.detail || 'Something went wrong. Please try again.');
    } finally { setLoading(false); }
  };

  const inputStyle = {
    width: '100%', padding: '11px 14px', borderRadius: 10, fontSize: 14,
    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
    color: '#fff', outline: 'none', boxSizing: 'border-box',
  };
  const labelStyle = { fontSize: 13, color: 'rgba(255,255,255,0.6)', fontWeight: 600, marginBottom: 6, display: 'block' };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 999, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: '#0f1020', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, padding: '32px 36px', width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto' }}>

        {done ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            {done.auto_approved ? (
              <>
                <div style={{ fontSize: 56, marginBottom: 12 }}>⚡</div>
                <h3 style={{ fontSize: 22, fontWeight: 900, color: '#fff', marginBottom: 8 }}>Instant Approval!</h3>
                <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 14, lineHeight: 1.6, marginBottom: 16 }}>
                  Your <strong style={{ color: '#fbbf24' }}>Starter</strong> API key is live now.
                  Your key has been emailed to <strong style={{ color: '#fff' }}>{form.email}</strong>.
                </p>
                <div style={{ background: '#0d1117', border: '1px solid rgba(16,185,129,0.35)', borderRadius: 12, padding: '16px 20px', marginBottom: 20, textAlign: 'left' }}>
                  <p style={{ margin: '0 0 6px', fontSize: 11, color: 'rgba(255,255,255,0.35)', fontWeight: 700, letterSpacing: 1 }}>YOUR API KEY</p>
                  <p style={{ margin: 0, fontFamily: 'monospace', fontSize: 13, color: '#10b981', wordBreak: 'break-all', lineHeight: 1.5 }}>{done.api_key}</p>
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                  <button onClick={() => { navigator.clipboard.writeText(done.api_key); }} style={{ padding: '10px 20px', borderRadius: 10, background: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)', cursor: 'pointer', fontWeight: 700, fontSize: 14 }}>Copy Key</button>
                  <button onClick={onClose} style={{ padding: '10px 20px', borderRadius: 10, background: 'linear-gradient(135deg,#10b981,#047857)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 14 }}>Start Building →</button>
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 56, marginBottom: 16 }}>🎉</div>
                <h3 style={{ fontSize: 22, fontWeight: 900, color: '#fff', marginBottom: 10 }}>Application Received!</h3>
                <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 15, lineHeight: 1.6, marginBottom: 20 }}>
                  Your Application ID is <strong style={{ color: '#10b981' }}>{done.app_id}</strong>.<br />
                  Tier: <strong style={{ color: '#f59e0b' }}>{done.suggested_tier?.toUpperCase()}</strong> ({done.commission_pct}% commission).<br /><br />
                  {done.suggested_tier === 'pro'
                    ? 'Pro accounts are reviewed quickly — expect your API key within a few hours.'
                    : 'Elite tier requires a short review. We\'ll contact you within 24 hours.'}
                </p>
                <button onClick={onClose} style={{ padding: '12px 28px', borderRadius: 10, background: 'linear-gradient(135deg,#F5A623,#d4901d)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 15 }}>Done</button>
              </>
            )}
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
              <div>
                <h3 style={{ fontSize: 20, fontWeight: 900, color: '#fff', marginBottom: 4 }}>Apply for Reseller API</h3>
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)' }}>Step {step} of 2 — takes 2 minutes</p>
              </div>
              <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', fontSize: 16 }}>✕</button>
            </div>

            {step === 1 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={labelStyle}>Company / Brand Name *</label>
                    <input style={inputStyle} value={form.company_name} onChange={e => set('company_name', e.target.value)} placeholder="Acme Telecom" />
                  </div>
                  <div>
                    <label style={labelStyle}>Your Name *</label>
                    <input style={inputStyle} value={form.contact_name} onChange={e => set('contact_name', e.target.value)} placeholder="John Smith" />
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>Email Address *</label>
                  <input style={inputStyle} type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="you@company.com" />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={labelStyle}>Phone Number *</label>
                    <input style={inputStyle} value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+1 555 000 0000" />
                  </div>
                  <div>
                    <label style={labelStyle}>Website (optional)</label>
                    <input style={inputStyle} value={form.website} onChange={e => set('website', e.target.value)} placeholder="https://yoursite.com" />
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>Business Type *</label>
                  <select style={{ ...inputStyle, cursor: 'pointer' }} value={form.business_type} onChange={e => set('business_type', e.target.value)}>
                    {['developer', 'agency', 'individual', 'telecom', 'other'].map(t => (
                      <option key={t} value={t} style={{ background: 'var(--bg-page)' }}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                    ))}
                  </select>
                </div>
                <button onClick={() => { if (!form.company_name || !form.contact_name || !form.email || !form.phone) { setError('Please fill all required fields.'); return; } setError(''); setStep(2); }} style={{ padding: '13px 0', borderRadius: 12, background: 'linear-gradient(135deg,#F5A623,#d4901d)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 15 }}>
                  Next →
                </button>
                {error && <p style={{ color: '#f87171', fontSize: 13, textAlign: 'center' }}>{error}</p>}
              </div>
            )}

            {step === 2 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label style={labelStyle}>Expected Monthly Volume (API calls) *</label>
                  <input style={inputStyle} type="number" value={form.expected_monthly_volume} onChange={e => set('expected_monthly_volume', e.target.value)} placeholder="e.g. 500" />
                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 5 }}>100+ = Pro tier (15%), 500+ = Elite tier (20%)</p>
                </div>
                <div>
                  <label style={labelStyle}>How will you use the API? *</label>
                  <textarea style={{ ...inputStyle, minHeight: 90, resize: 'vertical' }} value={form.use_case} onChange={e => set('use_case', e.target.value)} placeholder="e.g. I'm building a SaaS app for businesses that need virtual numbers for SMS verification..." />
                </div>
                <div style={{ padding: '14px 16px', borderRadius: 12, background: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.2)' }}>
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
                    <input type="checkbox" checked={form.wants_white_label} onChange={e => set('wants_white_label', e.target.checked)} style={{ marginTop: 3, width: 16, height: 16, cursor: 'pointer' }} />
                    <div>
                      <span style={{ fontSize: 14, fontWeight: 700, color: '#fbbf24' }}>I want a white-label website under my brand</span>
                      <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', margin: '3px 0 0' }}>$299 one-time setup · 1 year free hosting · then $49/month. We build it under your domain in 3–5 days.</p>
                    </div>
                  </label>
                  {form.wants_white_label && (
                    <div style={{ marginTop: 12 }}>
                      <label style={labelStyle}>Your Brand Name</label>
                      <input style={inputStyle} value={form.white_label_brand_name} onChange={e => set('white_label_brand_name', e.target.value)} placeholder="e.g. MaxTel, NovaSMS..." />
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => setStep(1)} style={{ flex: 1, padding: '13px 0', borderRadius: 12, background: 'rgba(255,255,255,0.06)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', fontWeight: 600, fontSize: 15 }}>← Back</button>
                  <button onClick={submit} disabled={loading || !form.use_case} style={{ flex: 2, padding: '13px 0', borderRadius: 12, background: loading ? 'rgba(245,166,35,0.5)' : 'linear-gradient(135deg,#F5A623,#d4901d)', color: '#fff', border: 'none', cursor: loading ? 'default' : 'pointer', fontWeight: 700, fontSize: 15 }}>
                    {loading ? 'Submitting…' : 'Submit Application →'}
                  </button>
                </div>
                {error && <p style={{ color: '#f87171', fontSize: 13, textAlign: 'center' }}>{error}</p>}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ── Main page ────────────────────────────────────────────── */
export default function ResellerAPIPage() {
  const navigate = useNavigate();
  const [showApply, setShowApply] = useState(false);
  const [openFaq, setOpenFaq] = useState(null);
  const [activeTab, setActiveTab] = useState('numbers');

  const TIERS = [
    { key: 'starter', name: 'Starter', commission: '10%', calls: '500/day', color: '#F5A623', glow: 'rgba(245,166,35,0.25)', products: ['Virtual Numbers (US/UK/CA/NL/SE)'], price: 'Free', cta: 'Apply Free', best: false },
    { key: 'pro',     name: 'Pro',     commission: '15%', calls: '5,000/day', color: '#10b981', glow: 'rgba(16,185,129,0.25)', products: ['Virtual Numbers', 'eSIM Data Plans'], price: 'Free (volume-based)', cta: 'Apply Now', best: true },
    { key: 'elite',   name: 'Elite',   commission: '20%', calls: 'Unlimited', color: '#f59e0b', glow: 'rgba(245,158,11,0.25)', products: ['Virtual Numbers', 'eSIM Data Plans', '+ White-Label Website'], price: 'By approval', cta: 'Contact Us', best: false },
  ];

  const SNIPPETS = {
    numbers: `# Search available numbers
curl -X GET "https://calliotel.com/api/v1/numbers/search?country=US&limit=5" \\
  -H "X-API-Key: crs_your_key_here"

# Response
{
  "country": "US",
  "count": 5,
  "results": [
    {
      "phone_number": "+1 (646) 555-0182",
      "country": "US",
      "monthly_price": 1.99,
      "your_cost_usd": 1.79,   // 10% off for Starter
      "commission_pct": 10
    }
  ]
}

# Purchase a number
curl -X POST "https://calliotel.com/api/v1/numbers/purchase" \\
  -H "X-API-Key: crs_your_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{
    "country": "US",
    "months": 1,
    "customer_ref": "your-customer-123"
  }'`,

    esim: `# Get eSIM plans for a country
curl -X GET "https://calliotel.com/api/v1/esim/plans?country=JP" \\
  -H "X-API-Key: crs_your_key_here"

# Purchase an eSIM plan
curl -X POST "https://calliotel.com/api/v1/esim/purchase" \\
  -H "X-API-Key: crs_your_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{
    "plan_id": "JP-1GB-7D",
    "customer_ref": "your-customer-456"
  }'

# Response includes QR code for instant activation
{
  "success": true,
  "qr_code_url": "https://...",
  "activation_code": "LPA:1$...",
  "valid_days": 7,
  "data_gb": 1,
  "commission_earned_usd": 0.27
}`,

    account: `# Check your account & commission stats
curl -X GET "https://calliotel.com/api/v1/account" \\
  -H "X-API-Key: crs_your_key_here"

# Response
{
  "reseller_id": "RS-3A9F2C",
  "company_name": "Your Company",
  "tier": "pro",
  "commission_pct": 15,
  "status": "active",
  "stats": {
    "total_sales": 142,
    "total_revenue_usd": 284.50,
    "total_commission_usd": 42.67
  }
}

# View commission history
curl -X GET "https://calliotel.com/api/v1/commissions?limit=10" \\
  -H "X-API-Key: crs_your_key_here"`,
  };

  const FAQS = [
    { q: 'How do I get my API key?', a: 'Apply using the form on this page. We review applications within 24 hours and email you your API key along with your reseller ID and tier. Want to test first? Use crs_sandbox_test — works instantly, no application needed, no charges.' },
    { q: 'Is there a sandbox / test mode?', a: 'Yes. Use API key crs_sandbox_test in any request — you get real-format responses with zero charges. Sandbox numbers and eSIM responses are simulated. No signup required to try the sandbox.' },
    { q: 'What are the API rate limits?', a: 'Burst rate: 10 req/sec across all tiers. Daily soft cap: Starter (500 req/day), Pro (5,000 req/day), Elite (Unlimited). Every API response includes X-RateLimit-Remaining and X-RateLimit-Reset headers so your app knows exactly where it stands.' },
    { q: 'What happens if my webhook server goes down?', a: 'We retry failed webhook deliveries automatically using exponential backoff — 3 attempts over 30 minutes. If all 3 fail, the event is logged in your dashboard for manual review. You never lose an event.' },
    { q: 'When and how do I get paid?', a: 'Commissions are tracked in real-time. Payouts are issued monthly to your preferred payment method (bank transfer, crypto, or Calliotel wallet credit). Minimum payout threshold is $10.' },
    { q: 'What is the difference between tiers?', a: 'Starter (10% commission, 500 calls/day, numbers only), Pro (15%, 5,000/day, adds eSIM), Elite (20%, unlimited, adds white-label website). Tier upgrades are based on volume and quality.' },
    { q: 'What is a white-label website?', a: 'We build you a fully branded version of the Calliotel platform under your own domain and brand name — your logo, your colors, your prices. Your customers never know it\'s powered by Calliotel. One-time $299 setup fee. First year hosting is FREE, then $49/month after that.' },
    { q: 'Can I set my own prices for my customers?', a: 'Yes, completely. The API tells you your cost (our price minus your commission). You charge your customers whatever you want — we don\'t interfere with your pricing.' },
    { q: 'Is there a setup fee to join the reseller program?', a: 'Zero cost to join the API reseller program — no setup fee, no monthly fee. You earn commissions and that\'s it. The white-label website is a separate paid service ($299 setup + 1 year free hosting, then $49/month).' },
    { q: 'What countries are available for virtual numbers?', a: 'US, UK, Canada, Netherlands (NL), Sweden (SE), and Puerto Rico (PR). eSIM plans cover 180+ countries.' },
    { q: 'Do you have SDKs for Python, Node.js, or PHP?', a: 'Official SDKs for Python, Node.js, and PHP are in active development — expected Q3 2026. Today, any language works via plain HTTP requests with an X-API-Key header. The API is REST-based and straightforward to integrate.' },
  ];

  return (
    <div style={{ minHeight: '100vh', background: '#060610', color: '#fff', fontFamily: "'Inter',-apple-system,sans-serif" }}>
      <LandingNav />

      <style>{`
        .rap-card { background: rgba(255,255,255,0.025); border: 1px solid rgba(255,255,255,0.08); transition: transform 0.22s, border-color 0.22s; }
        .rap-card:hover { transform: translateY(-4px); border-color: rgba(255,255,255,0.15); }
        .rap-tab { padding: 9px 18px; border-radius: 9px; font-size: 13px; font-weight: 700; cursor: pointer; border: none; transition: background 0.15s, color 0.15s; }
        .rap-faq { border-bottom: 1px solid rgba(255,255,255,0.07); cursor: pointer; transition: background 0.15s; }
        .rap-faq:hover { background: rgba(255,255,255,0.02); }
      `}</style>

      {/* ── HERO ──────────────────────────────────────────────────── */}
      <section style={{ position: 'relative', padding: '100px 20px 80px', textAlign: 'center', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          <div style={{ position: 'absolute', top: '-15%', left: '50%', transform: 'translateX(-50%)', width: 800, height: 400, background: 'radial-gradient(ellipse, rgba(245,166,35,0.12), transparent 70%)', borderRadius: '50%' }} />
          <div style={{ position: 'absolute', bottom: 0, left: '10%', width: 400, height: 250, background: 'radial-gradient(ellipse, rgba(16,185,129,0.06), transparent 70%)', borderRadius: '50%' }} />
          <div style={{ position: 'absolute', bottom: 0, right: '10%', width: 400, height: 250, background: 'radial-gradient(ellipse, rgba(245,158,11,0.06), transparent 70%)', borderRadius: '50%' }} />
        </div>

        <div style={{ position: 'relative', maxWidth: 800, margin: '0 auto' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 16px', borderRadius: 100, background: 'rgba(245,166,35,0.1)', border: '1px solid rgba(245,166,35,0.25)', marginBottom: 28 }}>
            <Code size={13} style={{ color: '#F5A623' }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: '#F5A623', letterSpacing: 1.5, textTransform: 'uppercase' }}>Reseller API — Earn 10–20% Commission</span>
          </div>

          <h1 style={{ fontSize: 'clamp(38px,5.5vw,68px)', fontWeight: 900, lineHeight: 1.06, letterSpacing: '-1.5px', marginBottom: 22 }}>
            Reseller API — Sell<br />
            <span style={{ background: 'linear-gradient(135deg,#F5A623,#6366f1)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Under Your Brand</span>
          </h1>

          <p style={{ fontSize: 19, color: 'rgba(255,255,255,0.6)', lineHeight: 1.75, maxWidth: 620, margin: '0 auto 16px' }}>
            Integrate virtual numbers and eSIM plans into your app or website with a single REST API. Earn <strong style={{ color: '#fff' }}>10–20% commission</strong> on every sale. We handle the infrastructure — you keep the profit.
          </p>

          {/* Country coverage */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 32, fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.45)' }}>
            <span>Numbers available instantly in</span>
            {['🇺🇸 US', '🇨🇦 Canada', '🇬🇧 UK', '🇳🇱 Netherlands', '🇸🇪 Sweden', '🇵🇷 Puerto Rico'].map(c => (
              <span key={c} style={{ padding: '3px 10px', borderRadius: 100, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)' }}>{c}</span>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 48 }}>
            <button onClick={() => setShowApply(true)} style={{ padding: '15px 36px', borderRadius: 14, fontSize: 17, fontWeight: 800, background: 'linear-gradient(135deg,#F5A623,#F5A623)', color: '#fff', border: 'none', cursor: 'pointer', boxShadow: '0 8px 32px rgba(245,166,35,0.45)' }}>
              Get API Keys →
            </button>
            <a href="#docs" style={{ padding: '13px 28px', borderRadius: 14, fontSize: 15, fontWeight: 600, background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.8)', border: '1px solid rgba(255,255,255,0.12)', cursor: 'pointer', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6 }}>
              View API Docs ↓
            </a>
          </div>

          {/* Mini stats */}
          <div style={{ display: 'flex', gap: 40, justifyContent: 'center', flexWrap: 'wrap' }}>
            {[
              { val: '10–20%', label: 'Commission per sale' },
              { val: '$0', label: 'Setup fee' },
              { val: '3', label: 'Products to resell' },
              { val: '24h', label: 'API key delivery' },
            ].map(s => (
              <div key={s.label} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 26, fontWeight: 900, color: '#fff' }}>{s.val}</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Social proof */}
          <div style={{ marginTop: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 24, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 18px', borderRadius: 100, background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}>
              <span style={{ fontSize: 16 }}>👥</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#10b981' }}>Trusted by 50+ Developer Teams</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 18px', borderRadius: 100, background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)' }}>
              <span style={{ fontSize: 16 }}>🔗</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#a5b4fc' }}>Works with Zapier · REST · Webhooks</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 18px', borderRadius: 100, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
              <span style={{ fontSize: 16 }}>⭐</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#fbbf24' }}>Beta Program — Apply Today</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── TIERS ──────────────────────────────────────────────────── */}
      <section style={{ padding: '80px 20px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 52 }}>
            <h2 style={{ fontSize: 'clamp(28px,4vw,46px)', fontWeight: 900, letterSpacing: '-0.5px', marginBottom: 12 }}>Commission Tiers</h2>
            <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.45)' }}>Start free. Earn more as you grow. No monthly fees ever.</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 20 }}>
            {TIERS.map(t => (
              <div key={t.key} style={{
                position: 'relative', borderRadius: 22, padding: '28px 26px',
                background: t.best ? `linear-gradient(135deg, ${t.color}18, ${t.color}08)` : 'rgba(255,255,255,0.025)',
                border: t.best ? `1px solid ${t.color}55` : '1px solid rgba(255,255,255,0.08)',
                boxShadow: t.best ? `0 0 60px ${t.glow}` : 'none',
              }}>
                {t.best && (
                  <div style={{ position: 'absolute', top: -13, left: '50%', transform: 'translateX(-50%)', padding: '4px 14px', borderRadius: 100, background: `linear-gradient(135deg,${t.color},${t.color}cc)`, fontSize: 10, fontWeight: 800, color: '#fff', whiteSpace: 'nowrap', letterSpacing: 0.5 }}>MOST POPULAR</div>
                )}

                <div style={{ width: 44, height: 44, borderRadius: 14, background: `${t.color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                  <DollarSign size={22} style={{ color: t.color }} />
                </div>

                <h3 style={{ fontSize: 20, fontWeight: 900, color: '#fff', marginBottom: 4 }}>{t.name}</h3>
                <div style={{ fontSize: 38, fontWeight: 900, color: t.color, marginBottom: 4, lineHeight: 1 }}>{t.commission}</div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 20 }}>commission per sale · {t.price}</div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
                  {[`${t.calls} API calls`, ...t.products].map(f => (
                    <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>
                      <Check size={14} style={{ color: t.color, flexShrink: 0 }} /> {f}
                    </div>
                  ))}
                </div>

                <button onClick={() => t.key === 'elite' ? window.open('mailto:resellers@calliotel.com') : setShowApply(true)} style={{
                  width: '100%', padding: '12px 0', borderRadius: 12, fontSize: 14, fontWeight: 700,
                  background: t.best ? `linear-gradient(135deg,${t.color},${t.color}cc)` : 'rgba(255,255,255,0.07)',
                  color: '#fff', border: 'none', cursor: 'pointer',
                  boxShadow: t.best ? `0 4px 20px ${t.glow}` : 'none',
                }}>
                  {t.cta} →
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ─────────────────────────────────────────── */}
      <section style={{ padding: '80px 20px', background: 'rgba(255,255,255,0.012)', borderTop: '1px solid rgba(255,255,255,0.06)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <h2 style={{ fontSize: 'clamp(26px,4vw,42px)', fontWeight: 900, letterSpacing: '-0.5px', textAlign: 'center', marginBottom: 52 }}>How It Works</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 24 }}>
            {[
              { n: '1', icon: '📝', title: 'Apply', desc: 'Fill the 2-minute form. We review in 24h.' },
              { n: '2', icon: '🔑', title: 'Get API Key', desc: 'Receive your key by email. Plug it in and go.' },
              { n: '3', icon: '⚡', title: 'Call the API', desc: 'Buy numbers & eSIM plans for your customers.' },
              { n: '4', icon: '💰', title: 'Earn Commission', desc: '10–20% credited on every sale. Paid monthly.' },
            ].map(s => (
              <div key={s.n} style={{ textAlign: 'center', padding: '24px 20px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 18 }}>
                <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'linear-gradient(135deg,#F5A623,#F5A623)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 18, color: '#fff', margin: '0 auto 12px' }}>{s.n}</div>
                <div style={{ fontSize: 28, marginBottom: 10 }}>{s.icon}</div>
                <h3 style={{ fontSize: 16, fontWeight: 800, color: '#fff', marginBottom: 8 }}>{s.title}</h3>
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', lineHeight: 1.6 }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── API DOCS ──────────────────────────────────────────────── */}
      <section id="docs" style={{ padding: '96px 20px' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <div style={{ display: 'inline-block', padding: '5px 16px', borderRadius: 100, background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)', fontSize: 11, fontWeight: 700, color: '#a5b4fc', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 14 }}>
              <Code size={11} style={{ display: 'inline', marginRight: 6 }} />API Reference
            </div>
            <h2 style={{ fontSize: 'clamp(26px,4vw,42px)', fontWeight: 900, letterSpacing: '-0.5px', marginBottom: 12 }}>Simple REST API</h2>
            <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.45)' }}>Base URL: <code style={{ color: '#F5A623', background: 'rgba(245,166,35,0.1)', padding: '2px 8px', borderRadius: 6 }}>https://calliotel.com/api</code> · Auth: <code style={{ color: '#F5A623', background: 'rgba(245,166,35,0.1)', padding: '2px 8px', borderRadius: 6 }}>X-API-Key: crs_...</code></p>
          </div>

          {/* Tab switcher */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 20, background: 'rgba(255,255,255,0.04)', padding: 6, borderRadius: 13, border: '1px solid rgba(255,255,255,0.07)', flexWrap: 'wrap' }}>
            {[
              { key: 'numbers', label: '📱 Numbers' },
              { key: 'esim',    label: '📡 eSIM' },
              { key: 'account', label: '📊 Account' },
            ].map(tab => (
              <button key={tab.key} className="rap-tab" onClick={() => setActiveTab(tab.key)} style={{
                background: activeTab === tab.key ? 'rgba(245,166,35,0.25)' : 'transparent',
                color: activeTab === tab.key ? '#F5A623' : 'rgba(255,255,255,0.45)',
                border: activeTab === tab.key ? '1px solid rgba(245,166,35,0.35)' : '1px solid transparent',
              }}>{tab.label}</button>
            ))}
          </div>

          <CodeBlock code={SNIPPETS[activeTab]} lang="bash" />

          <div style={{ marginTop: 20, padding: '14px 18px', borderRadius: 12, background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.2)', fontSize: 14, color: 'rgba(255,255,255,0.6)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <Shield size={16} style={{ color: '#10b981', flexShrink: 0 }} />
            All endpoints return JSON. Errors return standard HTTP codes with a <code style={{ color: '#10b981' }}>detail</code> field. Use key <code style={{ color: '#10b981' }}>crs_sandbox_test</code> for sandbox testing — no charges incurred.
          </div>
        </div>
      </section>

      {/* ── DEVELOPER TRUST SIGNALS ───────────────────────────────── */}
      <section style={{ padding: '80px 20px', background: 'rgba(255,255,255,0.012)', borderTop: '1px solid rgba(255,255,255,0.06)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ maxWidth: 960, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <div style={{ display: 'inline-block', padding: '5px 16px', borderRadius: 100, background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)', fontSize: 11, fontWeight: 700, color: '#a5b4fc', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 14 }}>Built for Developers</div>
            <h2 style={{ fontSize: 'clamp(26px,4vw,42px)', fontWeight: 900, letterSpacing: '-0.5px', marginBottom: 12 }}>Enterprise-Grade Reliability</h2>
            <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.45)', marginBottom: 12 }}>Everything you need to build a production-ready integration.</p>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 20px', borderRadius: 100, background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)', fontSize: 14, fontWeight: 700, color: '#10b981' }}>
              🛡️ 99.95% Uptime SLA — Redundant carrier routing with automatic failover
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 20 }}>
            {[
              {
                icon: '⚡',
                title: 'Rate Limits',
                desc: 'Burst: 10 req/sec. Daily soft cap: Starter (500), Pro (5,000), Elite (Unlimited). X-RateLimit-Remaining header on every response.',
                color: '#F5A623',
              },
              {
                icon: '🔄',
                title: 'Webhook Retries',
                desc: 'Automatic retries with exponential backoff — 3 attempts over 30 minutes if your server is down. Full event log in your dashboard.',
                color: '#10b981',
              },
              {
                icon: '🧪',
                title: 'Sandbox Mode',
                desc: 'Free test environment. Use API key crs_sandbox_test — zero charges, real responses, instant setup. No application required.',
                color: '#6366f1',
                badge: 'Try for free',
              },
              {
                icon: '🔐',
                title: '2FA Security',
                desc: 'Two-Factor Authentication enforced for all reseller accounts. TOTP-based (Google Authenticator, Authy). API keys can be rotated any time.',
                color: '#f59e0b',
              },
              {
                icon: '📦',
                title: 'Official SDKs',
                desc: 'Python, Node.js, and PHP SDKs in active development. Any language works today via plain HTTP. Official libraries coming Q3 2026.',
                color: '#ec4899',
                badge: 'Coming soon',
              },
              {
                icon: '📊',
                title: 'Real-Time Dashboard',
                desc: 'Live commission tracking, API call logs, error rates, and payout history. Webhook delivery status visible per event.',
                color: '#14b8a6',
              },
            ].map(item => (
              <div key={item.title} style={{ padding: '26px 24px', borderRadius: 18, background: 'rgba(255,255,255,0.03)', border: `1px solid rgba(255,255,255,0.07)`, position: 'relative' }}>
                {item.badge && (
                  <div style={{ position: 'absolute', top: 16, right: 16, padding: '3px 10px', borderRadius: 100, background: `${item.color}22`, border: `1px solid ${item.color}44`, fontSize: 10, fontWeight: 800, color: item.color, letterSpacing: 0.5 }}>{item.badge}</div>
                )}
                <div style={{ fontSize: 28, marginBottom: 12 }}>{item.icon}</div>
                <h3 style={{ fontSize: 16, fontWeight: 800, color: '#fff', marginBottom: 8 }}>{item.title}</h3>
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 1.65, margin: 0 }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── WHITE LABEL SECTION ───────────────────────────────────── */}
      <section style={{ padding: '80px 20px', background: 'rgba(255,255,255,0.012)', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 48, alignItems: 'center' }}>
            <div>
              <div style={{ display: 'inline-block', padding: '5px 14px', borderRadius: 100, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', fontSize: 11, fontWeight: 700, color: '#fbbf24', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 18 }}>🌐 Add-On Service</div>
              <h2 style={{ fontSize: 'clamp(26px,3.5vw,40px)', fontWeight: 900, letterSpacing: '-0.5px', marginBottom: 16, lineHeight: 1.15 }}>
                We Build Your<br />
                <span style={{ background: 'linear-gradient(135deg,#f59e0b,#f97316)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>White-Label Website</span>
              </h2>

              {/* Pricing box */}
              <div style={{ display: 'flex', gap: 12, marginBottom: 22, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 130, padding: '16px 20px', borderRadius: 14, background: 'linear-gradient(135deg,rgba(245,158,11,0.15),rgba(249,115,22,0.1))', border: '1px solid rgba(245,158,11,0.35)', textAlign: 'center' }}>
                  <div style={{ fontSize: 30, fontWeight: 900, color: '#f59e0b', lineHeight: 1 }}>$299</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 4, fontWeight: 600 }}>One-time setup</div>
                </div>
                <div style={{ flex: 1, minWidth: 130, padding: '16px 20px', borderRadius: 14, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', textAlign: 'center' }}>
                  <div style={{ fontSize: 30, fontWeight: 900, color: '#fff', lineHeight: 1 }}>FREE</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 4, fontWeight: 600 }}>1st year hosting</div>
                </div>
                <div style={{ flex: 1, minWidth: 130, padding: '16px 20px', borderRadius: 14, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', textAlign: 'center' }}>
                  <div style={{ fontSize: 30, fontWeight: 900, color: '#fff', lineHeight: 1 }}>$49<span style={{ fontSize: 15, fontWeight: 600, color: 'rgba(255,255,255,0.5)' }}>/mo</span></div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 4, fontWeight: 600 }}>After year 1</div>
                </div>
              </div>

              <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.55)', lineHeight: 1.75, marginBottom: 22 }}>
                Get your own branded virtual number platform — your logo, your domain, your prices. We build it, host it, and maintain it. Your customers never know it's powered by Calliotel.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginBottom: 28 }}>
                {[
                  'Your own domain (e.g. maxtel.com)',
                  'Your brand name, logo & colors',
                  'Your own pricing for customers',
                  'Full virtual numbers + eSIM integrated',
                  'Payment gateway & SSL included',
                  'Delivered in 3–5 business days',
                  '1 year free hosting — then $49/month',
                ].map(f => (
                  <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: 'rgba(255,255,255,0.7)' }}>
                    <Check size={15} style={{ color: '#f59e0b', flexShrink: 0 }} /> {f}
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setShowApply(true)} style={{ padding: '13px 26px', borderRadius: 12, background: 'linear-gradient(135deg,#f59e0b,#f97316)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 800, fontSize: 15 }}>
                  Order White-Label Site →
                </button>
                <a href="mailto:resellers@calliotel.com" style={{ padding: '11px 20px', borderRadius: 12, background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.12)', textDecoration: 'none', fontWeight: 600, fontSize: 14, display: 'flex', alignItems: 'center' }}>
                  Email Us
                </a>
              </div>
            </div>

            {/* Preview mockup */}
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: '28px 24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
                <div style={{ width: 32, height: 32, borderRadius: 9, background: 'linear-gradient(135deg,#f59e0b,#f97316)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, color: '#fff', fontSize: 14 }}>M</div>
                <span style={{ fontWeight: 800, fontSize: 15, color: '#fff' }}>MaxTel</span>
                <span style={{ marginLeft: 'auto', fontSize: 11, color: '#10b981', fontWeight: 700 }}>● Live</span>
              </div>
              <div style={{ fontSize: 22, fontWeight: 900, color: '#fff', marginBottom: 8, letterSpacing: '-0.5px' }}>Virtual Numbers for<br />Your Business</div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 20 }}>Powered by your infrastructure</div>
              {['🇺🇸 US Number — $2.49/mo', '🇬🇧 UK Number — $2.49/mo', '📡 eSIM Global — from $1.99'].map((item, i) => (
                <div key={i} style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', marginBottom: 8, fontSize: 13, color: 'rgba(255,255,255,0.7)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  {item}
                  <span style={{ color: '#f59e0b', fontWeight: 700, fontSize: 11 }}>Buy →</span>
                </div>
              ))}
              <div style={{ marginTop: 16, padding: '10px 14px', borderRadius: 10, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', textAlign: 'center', fontSize: 12, color: '#fbbf24', fontWeight: 700 }}>
                Your brand · Your prices · Your domain
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ───────────────────────────────────────────────────── */}
      <section style={{ padding: '80px 20px' }}>
        <div style={{ maxWidth: 700, margin: '0 auto' }}>
          <h2 style={{ fontSize: 'clamp(26px,4vw,40px)', fontWeight: 900, letterSpacing: '-0.5px', textAlign: 'center', marginBottom: 40 }}>Questions?</h2>
          <div style={{ borderRadius: 18, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
            {FAQS.map((faq, i) => (
              <div key={i} className="rap-faq" style={{ padding: '18px 22px' }} onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>{faq.q}</span>
                  <ChevronDown size={17} style={{ color: 'rgba(255,255,255,0.35)', flexShrink: 0, transform: openFaq === i ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                </div>
                {openFaq === i && <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.55)', lineHeight: 1.7, marginTop: 12, marginBottom: 0 }}>{faq.a}</p>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── BOTTOM CTA ────────────────────────────────────────────── */}
      <section style={{ padding: '96px 20px', background: 'linear-gradient(135deg,rgba(245,166,35,0.12),rgba(99,102,241,0.08))', borderTop: '1px solid rgba(245,166,35,0.2)', textAlign: 'center' }}>
        <div style={{ maxWidth: 600, margin: '0 auto' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🚀</div>
          <h2 style={{ fontSize: 'clamp(26px,4vw,44px)', fontWeight: 900, letterSpacing: '-0.5px', marginBottom: 14, color: '#fff' }}>
            Start Earning Today
          </h2>
          <p style={{ fontSize: 17, color: 'rgba(255,255,255,0.5)', marginBottom: 36 }}>
            Zero setup cost. API key in 24 hours. 10–20% commission on every sale you make.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button onClick={() => setShowApply(true)} style={{ padding: '15px 38px', borderRadius: 14, fontSize: 17, fontWeight: 800, background: 'linear-gradient(135deg,#F5A623,#F5A623)', color: '#fff', border: 'none', cursor: 'pointer', boxShadow: '0 8px 32px rgba(245,166,35,0.45)' }}>
              Get API Keys →
            </button>
            <a href="mailto:resellers@calliotel.com" style={{ padding: '13px 24px', borderRadius: 14, fontSize: 15, fontWeight: 600, background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.75)', border: '1px solid rgba(255,255,255,0.12)', textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
              Questions? Email Us
            </a>
          </div>
        </div>
      </section>

      <ProfessionalFooter />

      {showApply && <ApplyModal onClose={() => setShowApply(false)} />}
    </div>
  );
}
