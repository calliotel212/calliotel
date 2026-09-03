import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { setAuthRedirect } from '../utils/authRedirect';
import { getServiceUseNote } from '../utils/serviceUseNotes';

const API = `${process.env.REACT_APP_BACKEND_URL || ''}/api`;

function Logo({ service, size = 28 }) {
  const [failed, setFailed] = useState(false);
  const logo = service?.logo;
  if (!logo || failed) {
    return <span style={{ fontSize: size, lineHeight: 1 }}>{service?.icon || '📱'}</span>;
  }
  return (
    <img
      src={logo}
      alt=""
      width={size}
      height={size}
      style={{ width: size, height: size, borderRadius: 8, objectFit: 'contain', background: '#fff' }}
      onError={() => setFailed(true)}
    />
  );
}

export default function GuestServiceSearch() {
  const navigate = useNavigate();
  const { isAuthenticated, token } = useAuth();
  const signedIn = isAuthenticated || !!token;
  const [services, setServices] = useState([]);
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState(null);

  useEffect(() => {
    axios.get(`${API}/one-otp/catalog`).then((res) => {
      const rows = res.data?.services || [];
      setServices(rows);
      setPicked(rows.find((s) => s.code === 'whatsapp') || rows[0] || null);
    }).catch(() => {});
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return services.slice(0, 9);
    return services.filter((s) => `${s.name} ${s.code}`.toLowerCase().includes(q)).slice(0, 9);
  }, [services, query]);

  const goBrowse = (code) => {
    const next = code ? `/services?service=${encodeURIComponent(code)}` : '/services';
    navigate(next);
  };

  const goBuy = (service) => {
    const code = service?.code;
    const next = code ? `/services?service=${encodeURIComponent(code)}&buy=1` : '/services?buy=1';
    if (signedIn) {
      navigate(next);
      return;
    }
    setAuthRedirect(next);
    navigate(`/login?next=${encodeURIComponent(next)}`);
  };

  const count = services.length >= 180 ? '180+' : `${services.length || 180}+`;
  const selected = picked || filtered[0];
  const price = Number(selected?.price || 0.99).toFixed(2);

  return (
    <section style={{
      padding: '48px 0',
      borderTop: '1px solid rgba(245,166,35,0.18)',
      borderBottom: '1px solid rgba(245,166,35,0.18)',
      background: 'linear-gradient(180deg, rgba(245,166,35,0.06), rgba(255,255,255,0.02))',
    }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div style={{ textAlign: 'center', marginBottom: 22 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '6px 14px', borderRadius: 999, marginBottom: 12,
            background: 'rgba(245,166,35,0.12)', border: '1px solid rgba(245,166,35,0.35)',
            fontSize: 12, fontWeight: 800, color: '#F5A623', letterSpacing: 0.5, textTransform: 'uppercase',
          }}>
            {count} services · no account needed to search
          </div>
          <h2 style={{
            fontSize: 'clamp(24px, 4vw, 36px)', fontWeight: 900, color: '#fff',
            margin: 0, letterSpacing: -0.5,
          }}>
            Search <span style={{ color: '#F5A623' }}>{count} services</span>
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.55)', marginTop: 8, fontSize: 15 }}>
            Find the app you need. Buy after you sign up or log in.
          </p>
        </div>

        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <div style={{ position: 'relative', marginBottom: 16 }}>
            <Search style={{
              width: 18, height: 18, position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
              color: 'rgba(255,255,255,0.4)',
            }} />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search WhatsApp, Instagram, Discord…"
              aria-label="Search services"
              style={{
                width: '100%', padding: '14px 14px 14px 44px', borderRadius: 14,
                border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(0,0,0,0.35)',
                color: '#fff', fontSize: 15, outline: 'none',
              }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 16 }}>
            {filtered.map((s) => (
              <button
                key={s.code}
                type="button"
                onClick={() => setPicked(s)}
                style={{
                  textAlign: 'left', padding: 12, borderRadius: 14, cursor: 'pointer',
                  background: picked?.code === s.code ? 'rgba(245,166,35,0.16)' : 'rgba(255,255,255,0.04)',
                  border: picked?.code === s.code ? '1px solid rgba(245,166,35,0.55)' : '1px solid rgba(255,255,255,0.08)',
                }}
              >
                <Logo service={s} size={26} />
                <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', marginTop: 6, lineHeight: 1.25 }}>{s.name}</div>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#F5A623', marginTop: 4 }}>
                  ${Number(s.price || 0.99).toFixed(2)}
                </div>
              </button>
            ))}
          </div>

          {filtered.length === 0 && (
            <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.5)', fontSize: 14, marginBottom: 16 }}>
              No match. Try another name.
            </p>
          )}

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
            <button
              type="button"
              onClick={() => goBuy(selected)}
              disabled={!selected}
              style={{
                padding: '14px 28px', borderRadius: 14, fontSize: 15, fontWeight: 800,
                background: '#F5A623', color: '#000', border: 'none', cursor: 'pointer',
              }}
            >
              {`Get ${selected?.name || 'this'} · $${price}`}
            </button>
            <button
              type="button"
              onClick={() => goBrowse(selected?.code)}
              style={{
                padding: '14px 22px', borderRadius: 14, fontSize: 15, fontWeight: 700,
                background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.8)',
                border: '1px solid rgba(255,255,255,0.12)', cursor: 'pointer',
              }}
            >
              Browse all {count}
            </button>
          </div>
          <p style={{
            marginTop: 14, fontSize: 12, lineHeight: 1.5, color: 'rgba(255,255,255,0.5)', textAlign: 'center',
          }}>
            {getServiceUseNote(selected?.code, selected?.name)}
          </p>
        </div>
      </div>
    </section>
  );
}
