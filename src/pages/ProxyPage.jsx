import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Copy, Loader, RefreshCw } from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../hooks/use-toast';
import BottomNav from '../components/BottomNav';
import safeLocalStorage from '../utils/safeLocalStorage';
import { setAuthRedirect } from '../utils/authRedirect';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const YELLOW = '#F5A623';
const BLACK = '#000000';
const CARD = '#111111';
const LINE = 'rgba(245,166,35,0.35)';

const KINDS = [
  { id: 'hq', label: 'HQ proxy', soon: false },
  { id: 'residential', label: 'Residential', soon: true },
  { id: 'mobile', label: 'Mobile', soon: true },
];

const TYPES = [{ id: 'dedicated_ipv4', label: 'IPv4 Dedicated' }];

const FAQS = [
  { q: 'Can I choose a country?', a: 'Yes. Pick a country and we show live stock and price for that IP.' },
  { q: 'Which protocols are available?', a: 'HTTP and SOCKS5. Use them in a browser, antidetect, parser, or OTP signup — not on calliotel.com itself.' },
  { q: 'Can I extend a proxy?', a: 'Not yet in this app. Rent a new period when the current one ends.' },
  { q: 'How is HQ different?', a: 'HQ is the live product: dedicated IPv4, fast, for accounts, OTP, and scripts. Residential and Mobile are coming soon.' },
  { q: 'When will connection data appear?', a: 'Right after Rent. Copy HTTP, SOCKS5, or host:port:user:pass from Active proxies.' },
];

const authHeaders = () => {
  const token = safeLocalStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const isActive = (o) => {
  if (!o?.expires_at) return o?.status !== 'expired';
  const t = Date.parse(o.expires_at);
  return Number.isFinite(t) ? t > Date.now() : o?.status !== 'expired';
};

const field = {
  width: '100%',
  marginTop: 6,
  padding: '11px 12px',
  borderRadius: 10,
  background: BLACK,
  color: '#fff',
  border: `1px solid ${LINE}`,
  fontSize: 14,
};
const labelStyle = { fontSize: 12, color: YELLOW, fontWeight: 800 };

export default function ProxyPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isAuthenticated, token, balance, refreshBalance } = useAuth();
  const signedIn = isAuthenticated || !!token;

  const [tab, setTab] = useState('rent');
  const [kind, setKind] = useState('hq');
  const [catalog, setCatalog] = useState({ countries: [], periods: [5, 10, 20, 30] });
  const [country, setCountry] = useState('al');
  const [countryOpen, setCountryOpen] = useState(false);
  const [countryQ, setCountryQ] = useState('');
  const [proxyType, setProxyType] = useState('dedicated_ipv4');
  const [period, setPeriod] = useState(5);
  const [amount, setAmount] = useState(1);
  const [quote, setQuote] = useState(null);
  const [orders, setOrders] = useState([]);
  const [buying, setBuying] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCountry, setFilterCountry] = useState('');
  const [filterType, setFilterType] = useState('');
  const [applied, setApplied] = useState({ search: '', country: '', type: '' });

  const countries = catalog.countries || [];
  const selected = countries.find((c) => c.code === country);

  const loadOrders = async () => {
    if (!signedIn) return;
    try {
      const res = await axios.get(`${API}/proxy/my-orders`, { headers: authHeaders() });
      setOrders(res.data.orders || []);
    } catch {
      setOrders([]);
    }
  };

  useEffect(() => {
    axios.get(`${API}/proxy/catalog`).then((res) => {
      setCatalog(res.data);
      const hasAl = (res.data.countries || []).some((c) => c.code === 'al');
      if (hasAl) setCountry('al');
      else if (res.data.countries?.[0]?.code) setCountry(res.data.countries[0].code);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadOrders(); }, [signedIn]);

  useEffect(() => {
    if (kind !== 'hq' || !country || !period) return undefined;
    let cancelled = false;
    setQuote(null);
    axios.get(`${API}/proxy/quote`, { params: { country, period, amount } }).then((res) => {
      if (!cancelled) setQuote(res.data);
    }).catch(() => {
      if (!cancelled) setQuote({ available: false });
    });
    return () => { cancelled = true; };
  }, [kind, country, period, amount]);

  const copy = async (value, label) => {
    try {
      await navigator.clipboard.writeText(value);
      toast({ title: `${label} copied` });
    } catch {
      toast({ title: 'Copy failed', variant: 'destructive' });
    }
  };

  const buy = async () => {
    if (kind !== 'hq') {
      toast({ title: 'Coming soon', description: 'Residential and Mobile are not for sale yet.' });
      return;
    }
    if (!signedIn) {
      setAuthRedirect('/proxy');
      navigate(`/login?next=${encodeURIComponent('/proxy')}`);
      return;
    }
    setBuying(true);
    try {
      const res = await axios.post(
        `${API}/proxy/buy`,
        { country, period, amount, type: proxyType },
        { headers: authHeaders() },
      );
      if (refreshBalance) refreshBalance();
      await loadOrders();
      setTab('rent');
      toast({ title: 'Proxy ready', description: `${res.data.country_name || res.data.country} · ${res.data.period} days` });
    } catch (err) {
      const detail = err.response?.data?.detail;
      const msg = typeof detail === 'string' ? detail : 'Could not rent that proxy.';
      if (err.response?.status === 402) {
        toast({ title: 'Add credits', description: msg, variant: 'destructive' });
        navigate('/buy-credits');
      } else {
        toast({ title: 'Proxy buy failed', description: msg, variant: 'destructive' });
      }
    } finally {
      setBuying(false);
    }
  };

  const countryList = useMemo(() => {
    const q = countryQ.trim().toLowerCase();
    if (!q) return countries;
    return countries.filter((c) => c.name.toLowerCase().includes(q) || c.code.includes(q));
  }, [countries, countryQ]);

  const active = orders.filter(isActive);
  const archived = orders.filter((o) => !isActive(o));
  const pool = tab === 'archive' ? archived : active;
  const shown = pool.filter((o) => {
    if (applied.country && o.country !== applied.country) return false;
    if (applied.type && (o.type || 'dedicated_ipv4') !== applied.type) return false;
    const q = applied.search.trim().toLowerCase();
    if (!q) return true;
    return [o.country, o.country_name, o.host, o.username, o.line, o.http].join(' ').toLowerCase().includes(q);
  });
  const nearest = active
    .map((o) => Date.parse(o.expires_at))
    .filter((t) => Number.isFinite(t) && t > Date.now())
    .sort((a, b) => a - b)[0];
  const nearestLabel = nearest
    ? `${Math.max(1, Math.ceil((nearest - Date.now()) / 86400000))} days`
    : '—';

  const price = quote?.price;
  const canRent = kind === 'hq' && quote?.available && price != null && !buying;

  const tabs = [
    { id: 'rent', label: 'Rent proxy' },
    { id: 'archive', label: 'Archive' },
    { id: 'faq', label: 'FAQ' },
  ];

  const orderCard = (o) => (
    <div key={o.order_id} style={{
      borderRadius: 14, padding: 14, marginBottom: 10,
      background: CARD, border: `1px solid ${LINE}`,
    }}>
      <p style={{ margin: '0 0 6px', fontWeight: 800, color: YELLOW }}>
        {o.country_name || o.country} · IPv4 Dedicated · {o.period} days
      </p>
      {o.expires_at && (
        <p style={{ margin: '0 0 10px', fontSize: 12, color: '#888' }}>Expires {String(o.expires_at).slice(0, 16).replace('T', ' ')}</p>
      )}
      {[['HTTP', o.http], ['SOCKS5', o.socks5], ['host:port:user:pass', o.line]].filter(([, v]) => v).map(([label, value]) => (
        <button
          key={label}
          type="button"
          onClick={() => copy(value, label)}
          style={{
            width: '100%', textAlign: 'left', marginBottom: 8, padding: 12,
            borderRadius: 10, border: `1px solid ${LINE}`, background: BLACK,
            color: '#eee', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', gap: 8,
          }}
        >
          <span>
            <small style={{ color: '#888', display: 'block' }}>{label}</small>
            <span style={{ fontSize: 13, wordBreak: 'break-all' }}>{value}</span>
          </span>
          <Copy size={16} color={YELLOW} />
        </button>
      ))}
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: BLACK, paddingBottom: 80 }}>
      <div style={{ borderBottom: `1px solid ${LINE}`, padding: '12px 16px', background: BLACK }}>
        <div style={{ maxWidth: 560, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          <button type="button" onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', color: YELLOW, cursor: 'pointer' }}>
            <ArrowLeft size={22} />
          </button>
          <div>
            <h1 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: YELLOW }}>Rent proxy</h1>
            <p style={{ margin: 0, fontSize: 12, color: '#b9892a' }}>HQ IPv4 · HTTP + SOCKS5</p>
          </div>
        </div>
        <div style={{ maxWidth: 560, margin: '12px auto 0', display: 'flex', gap: 6 }}>
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              style={{
                flex: 1, padding: '10px 8px', borderRadius: 10, fontWeight: 800, fontSize: 13, cursor: 'pointer',
                border: `1px solid ${YELLOW}`,
                background: tab === t.id ? YELLOW : BLACK,
                color: tab === t.id ? BLACK : YELLOW,
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: 560, margin: '0 auto', padding: 16 }}>
        {tab === 'faq' && FAQS.map((item) => (
          <div key={item.q} style={{ borderRadius: 14, padding: 14, marginBottom: 10, background: CARD, border: `1px solid ${LINE}` }}>
            <p style={{ margin: 0, fontWeight: 800, color: YELLOW }}>{item.q}</p>
            <p style={{ margin: '8px 0 0', fontSize: 14, lineHeight: 1.5, color: '#aaa' }}>{item.a}</p>
          </div>
        ))}

        {tab !== 'faq' && (
          <>
            {tab === 'rent' && (
              <div style={{ borderRadius: 16, padding: 16, marginBottom: 16, background: CARD, border: `1px solid ${LINE}` }}>
                <p style={{ margin: '0 0 10px', fontWeight: 800, color: YELLOW }}>Rent proxy now</p>
                <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                  {KINDS.map((k) => (
                    <button
                      key={k.id}
                      type="button"
                      onClick={() => {
                        setKind(k.id);
                        if (k.soon) toast({ title: 'Coming soon', description: `${k.label} is not for sale yet.` });
                      }}
                      style={{
                        flex: 1, position: 'relative', padding: '12px 8px', borderRadius: 12, fontWeight: 800, fontSize: 12,
                        cursor: 'pointer',
                        border: `1px solid ${YELLOW}`,
                        background: kind === k.id ? YELLOW : BLACK,
                        color: kind === k.id ? BLACK : YELLOW,
                      }}
                    >
                      {k.label}
                      {k.soon && (
                        <span style={{
                          position: 'absolute', top: -8, right: 4, fontSize: 9, fontWeight: 900,
                          background: YELLOW, color: BLACK, borderRadius: 6, padding: '1px 5px',
                          border: `1px solid ${BLACK}`,
                        }}>
                          SOON
                        </span>
                      )}
                    </button>
                  ))}
                </div>

                <label style={labelStyle}>Country</label>
                <div style={{ position: 'relative', marginBottom: 12 }}>
                  <button type="button" onClick={() => setCountryOpen((v) => !v)} style={{ ...field, textAlign: 'left', cursor: 'pointer' }}>
                    {selected ? `${selected.name}` : 'Choose country'}
                  </button>
                  {countryOpen && (
                    <div style={{
                      position: 'absolute', zIndex: 20, left: 0, right: 0, top: '100%',
                      background: BLACK, border: `1px solid ${YELLOW}`, borderRadius: 12, marginTop: 4, maxHeight: 280, overflow: 'auto',
                    }}>
                      <input
                        autoFocus
                        value={countryQ}
                        onChange={(e) => setCountryQ(e.target.value)}
                        placeholder="Search country"
                        style={{ ...field, border: 'none', borderBottom: '1px solid #333', borderRadius: 0 }}
                      />
                      {countryList.map((c) => (
                        <button
                          key={c.code}
                          type="button"
                          onClick={() => { setCountry(c.code); setCountryOpen(false); setCountryQ(''); }}
                          style={{
                            display: 'block', width: '100%', textAlign: 'left', padding: '10px 12px',
                            background: c.code === country ? YELLOW : 'transparent',
                            border: 'none', color: c.code === country ? BLACK : YELLOW, cursor: 'pointer', fontWeight: 700,
                          }}
                        >
                          {c.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <label style={labelStyle}>Type</label>
                <select value={proxyType} onChange={(e) => setProxyType(e.target.value)} style={{ ...field, marginBottom: 12 }}>
                  {TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                </select>

                <label style={labelStyle}>Period</label>
                <select value={period} onChange={(e) => setPeriod(Number(e.target.value))} style={{ ...field, marginBottom: 12 }}>
                  {(catalog.periods || [5, 10, 20, 30]).map((d) => (
                    <option key={d} value={d}>{d} days</option>
                  ))}
                </select>

                <label style={labelStyle}>Quantity</label>
                <select value={amount} onChange={(e) => setAmount(Number(e.target.value))} style={{ ...field, marginBottom: 14 }}>
                  {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>

                <div style={{ display: 'flex', gap: 10, alignItems: 'stretch' }}>
                  <div style={{ flex: 1, borderRadius: 12, border: `1px solid ${YELLOW}`, padding: 12, background: BLACK }}>
                    <p style={{ margin: 0, fontSize: 11, color: YELLOW, fontWeight: 700 }}>Total Price</p>
                    <p style={{ margin: '4px 0 0', fontSize: 22, fontWeight: 800, color: YELLOW }}>
                      {loading || !quote ? '…' : (canRent || (quote?.available && price != null) ? `$${Number(price).toFixed(2)}` : '$0.00')}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={!canRent}
                    onClick={buy}
                    style={{
                      flex: 1, border: 'none', borderRadius: 12, fontWeight: 800, fontSize: 16, cursor: canRent ? 'pointer' : 'not-allowed',
                      background: canRent ? YELLOW : '#222', color: canRent ? BLACK : '#666',
                    }}
                  >
                    {buying ? 'Renting…' : (signedIn ? 'Rent' : 'Sign in')}
                  </button>
                </div>
                {signedIn && balance != null && (
                  <p style={{ margin: '10px 0 0', fontSize: 12, color: '#888' }}>Wallet ${Number(balance).toFixed(2)}</p>
                )}
                {quote && !quote.available && kind === 'hq' && (
                  <p style={{ margin: '10px 0 0', fontSize: 12, color: YELLOW }}>Out of stock for that country / period.</p>
                )}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <p style={{ margin: 0, fontWeight: 800, color: YELLOW }}>{tab === 'archive' ? 'Archive' : 'My active proxies'}</p>
              <button type="button" onClick={loadOrders} style={{ background: BLACK, border: `1px solid ${YELLOW}`, color: YELLOW, borderRadius: 8, padding: '6px 10px', cursor: 'pointer', display: 'flex', gap: 6, alignItems: 'center', fontWeight: 800 }}>
                <RefreshCw size={14} /> Refresh
              </button>
            </div>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Country, IP, login..." style={{ ...field, marginBottom: 8 }} />
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <select value={filterCountry} onChange={(e) => setFilterCountry(e.target.value)} style={{ ...field, marginTop: 0 }}>
                <option value="">All countries</option>
                {countries.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
              </select>
              <select value={filterType} onChange={(e) => setFilterType(e.target.value)} style={{ ...field, marginTop: 0 }}>
                <option value="">All types</option>
                {TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <button type="button" onClick={() => setApplied({ search, country: filterCountry, type: filterType })} style={{ flex: 1, padding: 10, borderRadius: 10, border: 'none', background: YELLOW, color: BLACK, fontWeight: 800, cursor: 'pointer' }}>Filter</button>
              <button type="button" onClick={() => { setSearch(''); setFilterCountry(''); setFilterType(''); setApplied({ search: '', country: '', type: '' }); }} style={{ flex: 1, padding: 10, borderRadius: 10, border: `1px solid ${YELLOW}`, background: BLACK, color: YELLOW, fontWeight: 800, cursor: 'pointer' }}>Reset</button>
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              <div style={{ flex: 1, borderRadius: 12, border: `1px solid ${LINE}`, padding: 12, background: CARD }}>
                <p style={{ margin: 0, fontSize: 11, color: YELLOW }}>Active proxies</p>
                <p style={{ margin: '4px 0 0', fontWeight: 800, color: '#fff' }}>{active.length}</p>
              </div>
              <div style={{ flex: 1, borderRadius: 12, border: `1px solid ${LINE}`, padding: 12, background: CARD }}>
                <p style={{ margin: 0, fontSize: 11, color: YELLOW }}>Nearest expiration</p>
                <p style={{ margin: '4px 0 0', fontWeight: 800, color: '#fff' }}>{nearestLabel}</p>
              </div>
            </div>
            {!signedIn && <p style={{ color: '#aaa', fontSize: 14 }}>Sign in to see rented proxies.</p>}
            {signedIn && shown.length === 0 && (
              <p style={{ color: '#888', fontSize: 14 }}>{loading ? <Loader size={18} /> : 'No proxies found. Try refreshing or changing filters.'}</p>
            )}
            {shown.map(orderCard)}
          </>
        )}
      </div>
      <BottomNav />
    </div>
  );
}
