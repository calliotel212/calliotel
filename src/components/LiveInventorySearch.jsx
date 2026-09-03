import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

// Always use relative URLs for public inventory — works in dev, prod, and behind any proxy
const API = '';

export default function LiveInventorySearch() {
  const nav = useNavigate();
  const [meta, setMeta] = useState({ services: [], countries: [] });
  const [service, setService] = useState('whatsapp');
  const [country, setCountry] = useState('NG');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef(null);

  useEffect(() => {
    axios.get(`${API}/api/public/inventory/services`).then(r => {
      setMeta(r.data || {});
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!service || !country) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await axios.get(`${API}/api/public/inventory/search`, { params: { service, country } });
        setResult(r.data);
      } catch {
        setResult({ available: false, error: 'lookup_failed' });
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(debounceRef.current);
  }, [service, country]);

  const svc = meta.services?.find(s => s.slug === service);
  const ctry = meta.countries?.find(c => c.iso2 === country);

  const handleGetIt = () => {
    const params = new URLSearchParams({ service, country, signup: '1' });
    nav(`/login?${params.toString()}`);
  };

  return (
    <section style={{
      background: 'linear-gradient(135deg, rgba(16,185,129,0.04) 0%, rgba(255,255,255,0.02) 100%)',
      borderTop: '1px solid rgba(16,185,129,0.15)',
      borderBottom: '1px solid rgba(16,185,129,0.15)',
      padding: '48px 0',
    }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '6px 14px', borderRadius: 999,
            background: 'rgba(16,185,129,0.12)',
            border: '1px solid rgba(16,185,129,0.35)',
            fontSize: 12, fontWeight: 800, color: '#10b981',
            letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 12,
          }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 8px #10b981' }} />
            Check Stock — No Account Needed
          </div>
          <h2 style={{
            fontSize: 'clamp(24px, 4vw, 36px)', fontWeight: 900, color: '#fff',
            margin: 0, letterSpacing: -0.5,
          }}>
            See If Your Number Is <span style={{ color: '#10b981' }}>Available Right Now</span>
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.55)', marginTop: 8, fontSize: 15 }}>
            Pick the app + country. We check live inventory across all our providers in 2 seconds.
          </p>
        </div>

        <div style={{
          maxWidth: 880, margin: '0 auto',
          background: 'rgba(0,0,0,0.4)',
          border: '1px solid rgba(16,185,129,0.25)',
          borderRadius: 16, padding: 20,
          boxShadow: '0 12px 40px rgba(16,185,129,0.08)',
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 12,
          }}>
            <label style={{ display: 'block' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.5)', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 6 }}>Service</div>
              <select
                value={service}
                onChange={e => setService(e.target.value)}
                style={{
                  width: '100%', padding: '12px 14px', borderRadius: 10,
                  background: 'rgba(255,255,255,0.05)', color: '#fff',
                  border: '1px solid rgba(255,255,255,0.12)', fontSize: 15, fontWeight: 600,
                  cursor: 'pointer', outline: 'none',
                }}
              >
                {meta.services?.map(s => (
                  <option key={s.slug} value={s.slug} style={{ background: '#1a1a1a' }}>
                    {s.icon} {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ display: 'block' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.5)', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 6 }}>Country</div>
              <select
                value={country}
                onChange={e => setCountry(e.target.value)}
                style={{
                  width: '100%', padding: '12px 14px', borderRadius: 10,
                  background: 'rgba(255,255,255,0.05)', color: '#fff',
                  border: '1px solid rgba(255,255,255,0.12)', fontSize: 15, fontWeight: 600,
                  cursor: 'pointer', outline: 'none',
                }}
              >
                {meta.countries?.map(c => (
                  <option key={c.iso2} value={c.iso2} style={{ background: '#1a1a1a' }}>
                    {c.flag} {c.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div style={{
            marginTop: 16, padding: '18px 20px', borderRadius: 12,
            background: result?.available
              ? 'linear-gradient(135deg, rgba(16,185,129,0.12), rgba(16,185,129,0.04))'
              : 'rgba(255,255,255,0.03)',
            border: result?.available
              ? '1px solid rgba(16,185,129,0.4)'
              : '1px solid rgba(255,255,255,0.08)',
            display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
            transition: 'all 0.3s ease',
            minHeight: 76,
          }}>
            {loading && (
              <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 14, fontWeight: 600 }}>
                Checking live stock…
              </div>
            )}
            {!loading && result?.available && (
              <>
                <div style={{ fontSize: 32 }}>{ctry?.flag}</div>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#fff' }}>
                    {result.stock}+ Numbers Available · {svc?.name} {ctry?.name}
                  </div>
                  <div style={{ fontSize: 13, color: '#10b981', fontWeight: 700, marginTop: 2 }}>
                    ✓ Live · ${result.price_usd?.toFixed(2)} per number · SMS in &lt; 30s
                  </div>
                </div>
                <button
                  onClick={handleGetIt}
                  style={{
                    padding: '12px 22px', borderRadius: 10,
                    background: 'linear-gradient(135deg, #10b981, #059669)',
                    color: '#fff', fontWeight: 800, fontSize: 14,
                    border: 'none', cursor: 'pointer',
                    boxShadow: '0 6px 20px rgba(16,185,129,0.4)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Get This Number →
                </button>
              </>
            )}
            {!loading && result && !result.available && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ fontSize: 28 }}>⏳</div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>
                    Out of stock for {svc?.name} {ctry?.name} right now
                  </div>
                  <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
                    Try another country — stock refreshes every minute.
                  </div>
                </div>
              </div>
            )}
          </div>

          <div style={{
            marginTop: 12, fontSize: 12, textAlign: 'center',
            color: 'rgba(255,255,255,0.45)',
          }}>
            US numbers receive <strong style={{ color: '#10b981' }}>SMS, MMS &amp; calls</strong>. From $1.99/mo.
          </div>
        </div>
      </div>
    </section>
  );
}
