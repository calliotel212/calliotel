import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Search, Phone, Loader, ArrowLeft, ChevronDown, CheckCircle, X, Zap, CreditCard } from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../hooks/use-toast';
import useGoBack from '../hooks/useGoBack';
import { useNavigate, useSearchParams } from 'react-router-dom';
import safeLocalStorage from '../utils/safeLocalStorage';
import { savePendingNumberPurchase, setAuthRedirect } from '../utils/authRedirect';
import { pathAfterNumberLive } from '../utils/firstHour';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const isoToFlag = (iso) => {
  if (!iso || iso.length !== 2) return '🌐';
  return String.fromCodePoint(
    ...iso.toUpperCase().split('').map(c => 0x1F1E6 - 65 + c.charCodeAt(0))
  );
};

const CALLING_CODES = {
  US:'1',GB:'44',CA:'1',AU:'61',DE:'49',FR:'33',NL:'31',SE:'46',ES:'34',IT:'39',
  BR:'55',MX:'52',IN:'91',JP:'81',PH:'63',ZA:'27',NG:'234',KE:'254',AE:'971',
  SA:'966',EG:'20',MA:'212',GH:'233',TZ:'255',UG:'256',DZ:'213',SN:'221',
  AR:'54',CL:'56',CO:'57',PE:'51',VE:'58',EC:'593',PY:'595',UY:'598',BO:'591',
  RU:'7',UA:'380',PL:'48',CZ:'420',HU:'36',RO:'40',BG:'359',HR:'385',SK:'421',
  PT:'351',GR:'30',TR:'90',IL:'972',LB:'961',JO:'962',IQ:'964',PK:'92',
  BD:'880',LK:'94',NP:'977',TH:'66',VN:'84',ID:'62',MY:'60',SG:'65',
  KR:'82',CN:'86',TW:'886',HK:'852',NZ:'64',NO:'47',FI:'358',DK:'45',
  CH:'41',AT:'43',BE:'32',IE:'353',CY:'357',LS:'266',BW:'267',ZW:'263',
};

// Subscription duration options — must match backend DURATION_DISCOUNTS in didww_routes.py.
// Discounts displayed here are advisory only — backend recomputes from its own table on purchase,
// so a UI/backend mismatch will surface as a price discrepancy, not a security issue.
const DURATION_PLANS = [
  { months: 1,  label: '1 mo',  badge: null,         tag: 'Monthly' },
  { months: 3,  label: '3 mo',  badge: 'Save 15%',   tag: 'Quarterly' },
  { months: 6,  label: '6 mo',  badge: 'Save 20%',   tag: 'Half-year' },
  { months: 12, label: '12 mo', badge: 'Save 32%',   tag: 'Annual — Best Value' },
];

// Pull a tier from a (possibly-stale) area-code object, with a safe fallback
// to the legacy single-price field so older API responses still render.
const getTier = (ac, months) => {
  const tier = ac.pricing_tiers?.find(t => t.months === months);
  if (tier) return tier;
  const monthly = Number(ac.monthly_cost) || 0;
  return {
    months,
    monthly_equivalent: monthly,
    total_price: monthly * months,
    discount_pct: 0,
    savings_vs_monthly: 0,
  };
};

const TOPUP_CARD_AMOUNTS = [
  { id: 'two', price: 2 },
  { id: 'three', price: 3 },
  { id: 'five', price: 5 },
  { id: 'ten', price: 10 },
  { id: 'twenty', price: 20 },
];

function TopUpModal({ numberCost, numberLabel, onClose, navigate }) {
  const payAmount = Math.max(2, Number(numberCost) || 2);
  const suggested = TOPUP_CARD_AMOUNTS.find((a) => a.price >= payAmount)?.price || Math.ceil(payAmount);
  const title = numberLabel ? `Buy ${numberLabel}` : 'Complete your purchase';
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: 'var(--bg-card)', borderRadius: 24, width: '100%', maxWidth: 480, padding: 24, border: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <p style={{ color: 'var(--text-1)', fontWeight: 800, fontSize: 17 }}>{title}</p>
            {numberCost > 0 && (
              <p style={{ color: 'var(--text-2)', fontSize: 12, marginTop: 2 }}>
                ${Number(numberCost).toFixed(2)} for this number · pay ${suggested} to activate now
              </p>
            )}
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid var(--soft-border)', borderRadius: 10, padding: '6px 10px', color: 'var(--text-2)', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>✕</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button
            onClick={() => { onClose(); navigate('/first-hour'); }}
            style={{
              width: '100%', padding: '16px', borderRadius: 14, border: 'none',
              background: 'linear-gradient(135deg, #F5A623, #e8940f)',
              color: '#111', fontWeight: 800, fontSize: 15, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            }}
          >
            <CreditCard size={18} /> Pay ${suggested} — get this number
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: 12 }}>
            <p style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.4, margin: 0 }}>
              Card or TRX — we put the method that works in your country first. Same wallet.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function BrowseNumbersPage() {
  const [countries, setCountries]             = useState([]);
  const [selectedCountry, setSelectedCountry] = useState({ iso: 'US', name: 'United States' });
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [countrySearch, setCountrySearch]     = useState('');
  const [areaCodes, setAreaCodes]             = useState([]);
  const [areaSearch, setAreaSearch]           = useState('');
  const [loadingCountries, setLoadingCountries] = useState(true);
  const [loadingAreas, setLoadingAreas]       = useState(false);
  const [purchasing, setPurchasing]           = useState(null);
  const [cardPurchasing, setCardPurchasing]   = useState(null);
  const [purchasedNumber, setPurchasedNumber] = useState(null);
  const [selectedMonths, setSelectedMonths]   = useState(1);
  const [topUpModal, setTopUpModal]           = useState(null);
  const [activationSlow, setActivationSlow]   = useState(false);

  const { user, balance } = useAuth();
  const { darkMode } = useTheme();
  const { toast }   = useToast();
  const navigate    = useNavigate();
  const [searchParams] = useSearchParams();
  const goBack      = useGoBack('/');
  const pickerRef   = useRef(null);
  const searchRef   = useRef(null);
  const justFunded  = searchParams.get('funded') === '1';
  const fundedAmount = searchParams.get('amount');
  const firstHour   = searchParams.get('first') === '1';

  useEffect(() => {
    if (!purchasing) {
      setActivationSlow(false);
      return undefined;
    }
    const timer = setTimeout(() => setActivationSlow(true), 15000);
    return () => clearTimeout(timer);
  }, [purchasing]);

  // Load countries once
  useEffect(() => {
    axios.get(`${API}/didww/countries`)
      .then(r => setCountries(r.data.countries || []))
      .catch(() => {})
      .finally(() => setLoadingCountries(false));
  }, []);

  // Auto-purchase: resumes a number purchase that was interrupted by a top-up
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('autopurchase') !== '1') return;
    if (!user) return;
    const raw = safeLocalStorage.getItem('pendingNumberPurchase');
    if (!raw) return;
    let pending;
    try { pending = JSON.parse(raw); } catch { return; }
    if (!pending?.area_code) return;

    // Clear intent + URL immediately to prevent re-trigger on refresh
    safeLocalStorage.removeItem('pendingNumberPurchase');
    window.history.replaceState({}, '', '/browse-numbers');

    const autoPurchase = async () => {
      setPurchasing(pending.area_code);
      try {
        const token = safeLocalStorage.getItem('token');
        const res = await axios.post(
          `${API}/didww/auto-purchase`,
          {
            area_code: pending.area_code,
            country_code: pending.country_code,
            country: pending.country,
            did_group_id: pending.did_group_id || null,
            sku_id: pending.sku_id || null,
            months: pending.months || 1,
          },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setPurchasedNumber(res.data.phone_number);
        const planLabel = (pending.months || 1) > 1
          ? `${pending.months}-month plan — ${res.data.message || ''}`
          : res.data.message || 'Your number is ready.';
        toast({ title: '✅ Number activated!', description: planLabel });
        try {
          const { trackPurchase, trackNumberActivated } = await import('../utils/gtagConversions');
          trackPurchase({ value: pending.price || 1.0, currency: 'USD', transactionId: res.data.phone_number || '' });
          trackNumberActivated();
        } catch {}
        setTimeout(() => navigate(pathAfterNumberLive(res.data.phone_number)), 900);
      } catch (err) {
        const detail = err.response?.data?.detail || 'Could not complete purchase. Please try again.';
        const isInsufficient = String(detail).includes('Insufficient') || String(detail).includes('balance');
        if (isInsufficient) {
          savePendingNumberPurchase(pending);
          navigate(`/buy-credits?amount=${Math.max(2, Math.ceil(Number(pending.price || pending.amount || 2)))}&resume=1&pay=1`, { replace: true });
          return;
        }
        toast({ title: 'Purchase failed', description: detail, variant: 'destructive' });
      } finally {
        setPurchasing(null);
      }
    };
    autoPurchase();
  }, [user]); // runs once user is loaded

  // Load area codes whenever country changes
  const fetchAreas = useCallback(async (iso) => {
    setLoadingAreas(true);
    setAreaCodes([]);
    setAreaSearch('');
    try {
      const res = await axios.get(`${API}/didww/area-codes`, { params: { country: iso, limit: 200 } });
      setAreaCodes(res.data?.area_codes || []);
    } catch {
      toast({ title: 'Could not load numbers', description: 'Please try again', variant: 'destructive' });
    } finally {
      setLoadingAreas(false);
    }
  }, [toast]);

  useEffect(() => { fetchAreas(selectedCountry.iso); }, [selectedCountry]);

  // Close picker when clicking outside
  useEffect(() => {
    if (!showCountryPicker) return;
    const handler = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) {
        setShowCountryPicker(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showCountryPicker]);

  const openCountryPicker = () => {
    setCountrySearch('');
    setShowCountryPicker(v => !v);
    setTimeout(() => searchRef.current?.focus(), 60);
  };

  const pickCountry = (c) => {
    setSelectedCountry(c);
    setShowCountryPicker(false);
  };

  const buildPending = (ac) => {
    const tier = getTier(ac, selectedMonths);
    return {
      area_code: ac.area_code,
      country_code: CALLING_CODES[selectedCountry.iso] || '1',
      country: selectedCountry.iso,
      did_group_id: ac._did_group_id || null,
      sku_id: ac._sku_id || null,
      months: selectedMonths,
      label: ac.city
        ? `${ac.area_code} (${ac.city}${ac.state ? ', ' + ac.state : ''})`
        : ac.area_code,
      price: tier.total_price || tier.monthly_equivalent || 0,
      amount: tier.total_price || tier.monthly_equivalent || 0,
    };
  };

  const requireAuthForPurchase = (ac) => {
    const pending = buildPending(ac);
    savePendingNumberPurchase(pending);
    setAuthRedirect('/first-hour');
    navigate('/signup?next=/first-hour');
  };

  const handlePurchase = async (ac) => {
    if (!user) { requireAuthForPurchase(ac); return; }
    setPurchasing(ac.area_code);
    try {
      const token = safeLocalStorage.getItem('token');
      const res = await axios.post(
        `${API}/didww/auto-purchase`,
        {
          area_code: ac.area_code,
          country_code: CALLING_CODES[selectedCountry.iso] || '1',
          country: selectedCountry.iso,
          did_group_id: ac._did_group_id || null,
          sku_id: ac._sku_id || null,
          months: selectedMonths,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setPurchasedNumber(res.data.phone_number);
      const planLabel = selectedMonths > 1
        ? `${selectedMonths}-month plan ($${res.data.total_paid?.toFixed(2)} total — $${res.data.monthly_equivalent?.toFixed(2)}/mo, ${res.data.discount_pct}% off)`
        : res.data.message;
      toast({ title: '✅ Number assigned!', description: planLabel });
      try {
        const { trackPurchase, trackNumberActivated } = await import('../utils/gtagConversions');
        trackPurchase({
          value: res.data.price || res.data.monthly_price || 1.0,
          currency: 'USD',
          transactionId: res.data.subscription_id || res.data.phone_number || '',
        });
        trackNumberActivated();
      } catch (e) { /* tracking failure must never break UX */ }
      setTimeout(() => navigate(pathAfterNumberLive(res.data.phone_number)), 800);
    } catch (err) {
      const detail = err.response?.data?.detail || 'Purchase failed. Please try again.';
      const isInsufficient = detail.includes('Insufficient') || detail.includes('balance');
      if (isInsufficient) {
        const tier = getTier(ac, selectedMonths);
        // Save purchase intent so we can auto-resume after top-up
        savePendingNumberPurchase(buildPending(ac));
        setTopUpModal({
          cost: tier.total_price || tier.monthly_equivalent || 0,
          label: ac.city
            ? `${ac.area_code} (${ac.city}${ac.state ? ', ' + ac.state : ''})`
            : ac.area_code,
        });
      } else {
        toast({ title: 'Purchase failed', description: detail, variant: 'destructive' });
      }
    } finally {
      setPurchasing(null);
    }
  };

  const handleCardPurchase = (ac) => {
    if (!user) { requireAuthForPurchase(ac); return; }
    savePendingNumberPurchase(buildPending(ac));
    navigate('/first-hour');
  };

  const filteredCountries = countries.filter(c => {
    const q = countrySearch.toLowerCase();
    return !q || c.name.toLowerCase().includes(q) || c.iso.toLowerCase().includes(q);
  });

  const filteredAreas = areaCodes.filter(ac => {
    const q = areaSearch.toLowerCase();
    return !q || ac.area_code.includes(q) || (ac.city || '').toLowerCase().includes(q) || (ac.state || '').toLowerCase().includes(q);
  });

  const popular = filteredAreas.filter(a => a.is_popular);
  const rest    = filteredAreas.filter(a => !a.is_popular);
  const ordered = areaSearch ? filteredAreas : [...popular, ...rest];

  const callingCode = CALLING_CODES[selectedCountry.iso] || '';

  const bg   = 'var(--bg-page)';
  const card = 'var(--bg-card)';
  const border= 'var(--soft-border)';
  const text  = 'var(--text-1)';
  const muted = 'var(--text-2)';

  return (
    <div style={{ minHeight: '100vh', background: bg, paddingBottom: 80 }}>

      {/* ── Dark Header ──────────────────────────────────────────── */}
      <div style={{ background: 'var(--bg-page)', borderBottom: '1px solid var(--soft-border-2)', position: 'relative', overflow: 'visible' }}>
        <div style={{ maxWidth: 680, margin: '0 auto', padding: '16px 16px 20px' }}>
          {/* Top bar */}
          <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:14 }}>
            <button onClick={goBack} style={{
              padding:8, borderRadius:12, background:'var(--soft-fill)',
              border:'1px solid var(--soft-border)', cursor:'pointer', display:'flex', alignItems:'center', color:'var(--text-1)'
            }}>
              <ArrowLeft size={20} />
            </button>
            <div style={{ flex:1 }}>
              <h1 style={{ fontWeight:800, fontSize:17, color:'var(--text-1)', letterSpacing:'-0.3px', margin:0, padding:0 }}>
                {firstHour ? 'Step 1 · Pick your number' : 'Get a Phone Number'}
              </h1>
              <div style={{ fontSize:12, color:'var(--text-3)' }}>
                {firstHour ? 'Pay once after you choose · then SMS is ready' : 'Instant activation · No contracts'}
              </div>
            </div>
            <button onClick={() => navigate('/my-numbers')} style={{
              padding:'6px 14px', borderRadius:12, background:'var(--soft-fill)',
              border:'1px solid var(--soft-border)', cursor:'pointer', color:'var(--text-2)', fontWeight:700, fontSize:13
            }}>
              My Numbers
            </button>
          </div>

          {justFunded && (
            <div style={{
              marginBottom: 14,
              padding: '12px 14px',
              borderRadius: 14,
              background: 'rgba(34,197,94,0.12)',
              border: '1px solid rgba(34,197,94,0.35)',
            }}>
              <p style={{ margin: 0, fontWeight: 800, fontSize: 14, color: '#86efac' }}>
                {fundedAmount ? `$${fundedAmount} added` : 'Funds added'} — choose a number below
              </p>
              <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-2)' }}>
                {typeof balance === 'number'
                  ? `Wallet balance $${balance.toFixed(2)}. Numbers from ~$2/mo.`
                  : 'Pick any area code you can afford with your balance.'}
              </p>
            </div>
          )}

          {/* ── Country Selector + inline dropdown ─────────────── */}
          <div ref={pickerRef} style={{ position:'relative', zIndex:300 }}>
            {/* Selector button */}
            <button onClick={openCountryPicker} style={{
              width:'100%', display:'flex', alignItems:'center', gap:12,
              background:'var(--soft-fill)', border:'1px solid var(--soft-border)',
              borderRadius:14, padding:'11px 14px', cursor:'pointer', textAlign:'left'
            }}>
              <span style={{ fontSize:26, lineHeight:1 }}>{isoToFlag(selectedCountry.iso)}</span>
              <div style={{ flex:1 }}>
                <div style={{ color:'var(--text-1)', fontWeight:700, fontSize:15 }}>{selectedCountry.name}</div>
                <div style={{ color:'var(--text-2)', fontSize:12 }}>
                  {loadingAreas ? 'Loading…' : `${filteredAreas.length} area codes available`}
                </div>
              </div>
              <ChevronDown size={18} color="rgba(255,255,255,0.7)"
                style={{ transform: showCountryPicker ? 'rotate(180deg)' : 'none', transition:'0.2s' }} />
            </button>

            {/* ── Compact inline dropdown ─────────────────────── */}
            {showCountryPicker && (
              <div style={{
                position:'absolute', top:'calc(100% + 6px)', left:0, right:0, zIndex:9999,
                background: 'var(--bg-card)',
                border:`1px solid ${border}`,
                borderRadius:14,
                boxShadow:'0 8px 32px rgba(0,0,0,0.28)',
                overflow:'hidden',
              }}>
                {/* Search */}
                <div style={{ padding:'8px 10px', borderBottom:`1px solid ${border}` }}>
                  <div style={{ position:'relative' }}>
                    <Search size={14} style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color: muted }} />
                    <input
                      ref={searchRef}
                      value={countrySearch}
                      onChange={e => setCountrySearch(e.target.value)}
                      placeholder="Search country…"
                      style={{
                        width:'100%', paddingLeft:32, paddingRight:10, paddingTop:7, paddingBottom:7,
                        borderRadius:8, border:`1px solid ${border}`,
                        background: '#2a2a2c',
                        color: text, fontSize:13, outline:'none', boxSizing:'border-box'
                      }}
                    />
                  </div>
                </div>

                {/* List — compact, max 280px scroll */}
                <div style={{ maxHeight:280, overflowY:'auto' }}>
                  {loadingCountries ? (
                    <div style={{ display:'flex', justifyContent:'center', padding:20 }}>
                      <Loader size={18} style={{ color:'#10b981', animation:'spin 1s linear infinite' }} />
                    </div>
                  ) : filteredCountries.length === 0 ? (
                    <div style={{ textAlign:'center', padding:'14px 0', color:muted, fontSize:13 }}>No results</div>
                  ) : filteredCountries.map(c => {
                    const isSelected = selectedCountry.iso === c.iso;
                    return (
                      <button key={c.iso} onClick={() => pickCountry(c)} style={{
                        width:'100%', display:'flex', alignItems:'center', gap:10,
                        padding:'7px 14px', border:'none', cursor:'pointer', textAlign:'left',
                        background: isSelected ? 'rgba(16,185,129,0.12)' : 'transparent',
                        transition:'background 0.1s',
                      }}
                      onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                      onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                      >
                        <span style={{ fontSize:20, lineHeight:1, width:26, textAlign:'center' }}>{isoToFlag(c.iso)}</span>
                        <span style={{ flex:1, fontSize:13, fontWeight: isSelected ? 600 : 400, color: isSelected ? '#10b981' : text }}>
                          {c.name}
                        </span>
                        {isSelected && <CheckCircle size={14} color="#10b981" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Area code search */}
          <div style={{ position:'relative', marginTop:10 }}>
            <Search size={15} style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', color:'var(--text-2)' }} />
            <input
              type="text"
              value={areaSearch}
              onChange={e => setAreaSearch(e.target.value)}
              placeholder="Search city or area code…"
              style={{
                width:'100%', paddingLeft:38, paddingRight:14, paddingTop:11, paddingBottom:11,
                borderRadius:12, border:'1px solid var(--soft-border)',
                background:'var(--soft-fill)', color:'var(--text-1)',
                fontSize:14, outline:'none', boxSizing:'border-box',
              }}
            />
          </div>
        </div>
      </div>

      {/* ── Numbers List ─────────────────────────────────────────── */}
      <div style={{ maxWidth:680, margin:'0 auto', padding:'16px 14px' }}>

        {loadingAreas && (
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', paddingTop:60, gap:12 }}>
            <Loader size={28} style={{ color:'#10b981', animation:'spin 1s linear infinite' }} />
            <span style={{ color:muted, fontSize:14 }}>Loading numbers for {selectedCountry.name}…</span>
          </div>
        )}

        {!loadingAreas && ordered.length === 0 && (
          <div style={{ background:card, border:`1px solid ${border}`, borderRadius:16,
            textAlign:'center', padding:'48px 24px' }}>
            <div style={{ fontSize:48, marginBottom:12 }}>{isoToFlag(selectedCountry.iso)}</div>
            <div style={{ fontWeight:700, fontSize:16, color:text, marginBottom:6 }}>No numbers available</div>
            <div style={{ color:muted, fontSize:13 }}>Try a different city or select another country.</div>
          </div>
        )}

        {!loadingAreas && ordered.length > 0 && (
          <>
            {/* Count row */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
              <span style={{ display:'flex', alignItems:'center', gap:6, color:muted, fontSize:12, fontWeight:600 }}>
                <Zap size={13} color="#F5A623" />
                {areaSearch ? `${ordered.length} results` : `${ordered.length} numbers in ${selectedCountry.name}`}
              </span>
              <span style={{ display:'flex', alignItems:'center', gap:4, fontSize:12, color:'#F5A623', fontWeight:600 }}>
                <CheckCircle size={13} /> Instant activation
              </span>
            </div>

            {/* ── Duration plan picker (1mo / 3mo / 6mo / 12mo) ───── */}
            <div style={{
              background: card, border:`1px solid ${border}`, borderRadius:14,
              padding:'10px 12px', marginBottom:12,
            }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8, gap:8, flexWrap:'wrap' }}>
                <div style={{ fontSize:12, fontWeight:700, color:text }}>
                  Plan length
                </div>
                <div style={{ fontSize:11, color: '#22c55e', fontWeight:700 }}>
                  Save up to 32% with annual prepay
                </div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:6 }}>
                {DURATION_PLANS.map(plan => {
                  const isActive = selectedMonths === plan.months;
                  return (
                    <button
                      key={plan.months}
                      onClick={() => setSelectedMonths(plan.months)}
                      style={{
                        position:'relative',
                        padding:'9px 6px 11px', borderRadius:10,
                        border: isActive ? '2px solid #F5A623' : `1px solid ${border}`,
                        background: isActive
                          ? 'rgba(245,166,35,0.18)'
                          : '#252525',
                        cursor:'pointer',
                        display:'flex', flexDirection:'column', alignItems:'center', gap:2,
                        transition:'all 0.15s',
                      }}
                    >
                      <span style={{ fontWeight:800, fontSize:14, color: isActive ? '#F5A623' : text }}>
                        {plan.label}
                      </span>
                      {plan.badge && (
                        <span style={{
                          fontSize:9, fontWeight:700, color:'#22c55e',
                          background: 'rgba(34,197,94,0.15)',
                          padding:'1px 5px', borderRadius:4,
                        }}>
                          {plan.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              {selectedMonths === 12 && (
                <div style={{ marginTop:8, padding:'7px 10px', borderRadius:8,
                  background: 'rgba(34,197,94,0.10)',
                  border: '1px solid rgba(34,197,94,0.3)',
                  fontSize:11, color: '#86efac', fontWeight:600,
                }}>
                  💸 Annual = best deal. US drops to <strong>$1.35/mo</strong> — 19% cheaper than call.com's annual ($1.67/mo).
                </div>
              )}
            </div>

            {/* Service info card */}
            <div style={{
              display:'flex', alignItems:'flex-start', gap:10,
              background: 'rgba(16,185,129,0.08)',
              border:'1px solid rgba(16,185,129,0.30)',
              borderRadius:12, padding:'10px 14px', marginBottom:10,
            }}>
              <span style={{ fontSize:18, lineHeight:1, marginTop:1 }}>📞</span>
              <div style={{ fontSize:12, color: '#fdba74', lineHeight:1.5 }}>
                <strong>Voice IN/OUT + SMS IN/OUT.</strong> These are carrier-grade virtual numbers —
                perfect for business presence, calls, and person-to-person messaging.
                Instant activation, no documents required.
              </div>
            </div>

            {/* Number cards — real inventory only */}
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              {ordered.map((ac) => {
                const isBuying = purchasing === ac.area_code;
                const city = ac.city || `Area ${ac.area_code}`;
                const region = ac.state || ac.region || '';
                const tier = getTier(ac, selectedMonths);
                const showSavings = tier.discount_pct > 0;
                const dueToday = Number(tier.total_price || tier.monthly_equivalent || 0);
                return (
                  <div key={ac.area_code} style={{
                    display:'flex', alignItems:'center', gap:12,
                    background:'var(--soft-fill-2)',
                    border:'1px solid rgba(255,255,255,0.12)',
                    borderLeft: ac.is_popular && !areaSearch ? '3px solid #F5A623' : '1px solid rgba(255,255,255,0.12)',
                    borderRadius:14, padding:'12px 14px',
                  }}>
                    <span style={{ fontSize:22, lineHeight:1 }}>{isoToFlag(selectedCountry.iso)}</span>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap', marginBottom:3 }}>
                        <span style={{ fontWeight:800, fontSize:14, color: 'var(--text-1)' }}>{city}</span>
                        {region && <span style={{ fontSize:12, color:'var(--text-2)' }}>{region}</span>}
                        {ac.is_popular && !areaSearch && (
                          <span style={{ fontSize:9, padding:'2px 7px', borderRadius:20, fontWeight:800,
                            background:'rgba(245,166,35,0.15)', color:'#F5A623', border:'1px solid rgba(245,166,35,0.3)', letterSpacing:'0.4px' }}>POPULAR</span>
                        )}
                      </div>
                      <div style={{ display:'flex', alignItems:'center', gap:5, flexWrap:'wrap' }}>
                        <span style={{ fontSize:11, fontFamily:'monospace', color:'var(--text-3)' }}>+{callingCode} ({ac.area_code})</span>
                        {ac.supports_sms && <span style={{ fontSize:9, padding:'1px 6px', borderRadius:4, fontWeight:700, background:'rgba(245,166,35,0.15)', color:'#F5A623', border:'1px solid rgba(245,166,35,0.2)' }}>SMS</span>}
                        <span style={{ fontSize:9, padding:'1px 6px', borderRadius:4, fontWeight:700, background:'var(--soft-fill)', color:'var(--text-2)', border:'1px solid var(--soft-border)' }}>CALLS</span>
                      </div>
                    </div>
                    <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:5, flexShrink:0 }}>
                      <span style={{ fontSize:15, fontWeight:900, color: 'var(--text-1)', lineHeight:1 }}>
                        ${dueToday.toFixed(2)}
                        <span style={{ fontSize:10, fontWeight:500, color:'var(--text-2)' }}> today</span>
                      </span>
                      {selectedMonths > 1 && (
                        <span style={{ fontSize:9, color:'var(--text-2)', fontWeight:600 }}>
                          ${tier.monthly_equivalent.toFixed(2)}/mo
                          {showSavings ? ` · save ${tier.discount_pct}%` : ''}
                        </span>
                      )}
                      <button
                        onClick={() => handlePurchase(ac)}
                        disabled={!!purchasing}
                        style={{
                          display:'flex', alignItems:'center', gap:4,
                          padding:'8px 16px', borderRadius:10, border:'none',
                          cursor: purchasing ? 'not-allowed' : 'pointer',
                          fontWeight:800, fontSize:12, justifyContent:'center',
                          marginTop:2,
                          background: isBuying ? 'rgba(245,166,35,0.15)' : 'linear-gradient(135deg,#F5A623,#e8940f)',
                          color: isBuying ? '#F5A623' : '#111',
                          opacity: purchasing && !isBuying ? 0.4 : 1,
                          boxShadow: isBuying ? 'none' : '0 4px 12px rgba(245,166,35,0.28)',
                        }}
                      >
                        {isBuying ? <Loader size={13} style={{ animation:'spin 1s linear infinite' }} /> : <><Phone size={12}/> Buy</>}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <p style={{ textAlign:'center', fontSize:11, color:'rgba(255,255,255,0.2)', marginTop:20, letterSpacing:'0.3px' }}>
              ⚡ Numbers activate instantly · Cancel anytime
            </p>
          </>
        )}
      </div>

      {/* spin keyframe */}
      <style>{`
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        @keyframes activationProgress{from{transform:translateX(-100%)}to{transform:translateX(250%)}}
      `}</style>

      {purchasing && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position:'fixed', inset:0, zIndex:10000, background:'rgba(8,8,16,0.94)',
            display:'flex', alignItems:'center', justifyContent:'center', padding:20,
          }}
        >
          <div style={{
            width:'100%', maxWidth:380, padding:'30px 24px', borderRadius:24,
            background:'var(--bg-card)', border:'1px solid var(--soft-border)',
            textAlign:'center', boxShadow:'0 24px 80px rgba(0,0,0,0.45)',
          }}>
            <Loader size={42} style={{ color:'#F5A623', animation:'spin 1s linear infinite', margin:'0 auto 18px' }} />
            <h2 style={{ margin:0, color:'var(--text-1)', fontSize:20, fontWeight:900 }}>
              Activating your number…
            </h2>
            <p style={{ margin:'9px 0 18px', color:'var(--text-2)', fontSize:13, lineHeight:1.55 }}>
              We are reserving the number with the carrier. Keep this screen open.
            </p>
            <div style={{
              height:7, overflow:'hidden', borderRadius:999,
              background:'rgba(245,166,35,0.14)',
            }}>
              <div style={{
                width:'42%', height:'100%', borderRadius:999,
                background:'linear-gradient(90deg,#F5A623,#facc15)',
                animation:'activationProgress 1.35s ease-in-out infinite',
              }} />
            </div>
            <p style={{ margin:'14px 0 0', color: activationSlow ? '#fbbf24' : 'var(--text-3)', fontSize:12, lineHeight:1.45 }}>
              {activationSlow
                ? 'The carrier is taking longer than usual. Your request is still processing—please do not buy again.'
                : 'Most activations finish within a few seconds.'}
            </p>
          </div>
        </div>
      )}

      {/* Top-up modal — shown when balance is insufficient */}
      {topUpModal !== null && (
        <TopUpModal
          numberCost={topUpModal.cost ?? topUpModal}
          numberLabel={topUpModal.label}
          onClose={() => setTopUpModal(null)}
          navigate={navigate}
        />
      )}

    </div>
  );
}
