import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const API = process.env.REACT_APP_BACKEND_URL || '';
const headers = (token) => ({ Authorization: `Bearer ${token}` });

const bg    = '#0d0d0d';
const card  = '#161616';
const green = '#10b981';
const muted = 'rgba(255,255,255,0.45)';
const border = 'rgba(255,255,255,0.08)';

const STATUS_COLOR = {
  ACTIVE:   { bg:'rgba(16,185,129,0.12)', color:'#10b981' },
  USED:     { bg:'rgba(107,114,128,0.12)', color:'#9ca3af' },
  EXPIRED:  { bg:'rgba(239,68,68,0.10)', color:'#f87171' },
  PENDING:  { bg:'rgba(251,191,36,0.10)', color:'#fbbf24' },
};

export default function MyESIMsPage() {
  const { token } = useAuth();
  const navigate  = useNavigate();
  const [orders, setOrders]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [usage, setUsage] = useState({});   // orderNo -> usage object | 'loading' | 'error'

  const fetchUsage = React.useCallback((orderNo) => {
    setUsage(u => ({ ...u, [orderNo]: u[orderNo] && u[orderNo] !== 'error' ? u[orderNo] : 'loading' }));
    axios.get(`${API}/api/esim/usage/${orderNo}`, { headers: headers(token) })
      .then(r => setUsage(u => ({ ...u, [orderNo]: r.data.usage || 'error' })))
      .catch(() => setUsage(u => ({ ...u, [orderNo]: 'error' })));
  }, [token]);

  useEffect(() => {
    if (!token) { navigate('/login'); return; }
    axios.get(`${API}/api/esim/my-orders`, { headers: headers(token) })
      .then(r => {
        const list = r.data.orders || [];
        setOrders(list);
        // Refresh usage from the provider for each eSIM on page open
        list.forEach(o => { if (o.orderNo) fetchUsage(o.orderNo); });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token, navigate, fetchUsage]);

  if (loading) return (
    <div style={{ minHeight:'100vh', background:bg, display:'flex',
      alignItems:'center', justifyContent:'center', color:muted }}>
      Loading your eSIMs…
    </div>
  );

  return (
    <div style={{ minHeight:'100vh', background:bg, color:'#fff',
      fontFamily:'Inter,sans-serif', paddingBottom:40 }}>
      {/* Header */}
      <div style={{ background:'linear-gradient(135deg,#0d2d1a 0%,#0d0d0d 100%)',
        borderBottom:`1px solid ${border}`, padding:'20px 16px 16px' }}>
        <div style={{ maxWidth:680, margin:'0 auto' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <button onClick={() => navigate(-1)}
              style={{ background:'none', border:'none', color:muted,
                fontSize:20, cursor:'pointer', padding:0, lineHeight:1 }}>←</button>
            <div>
              <div style={{ fontSize:20, fontWeight:800 }}>My eSIMs</div>
              <div style={{ fontSize:13, color:muted }}>{orders.length} plan{orders.length !== 1 ? 's' : ''}</div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth:680, margin:'0 auto', padding:'16px 14px' }}>
        {orders.length === 0 ? (
          <div style={{ textAlign:'center', paddingTop:60 }}>
            <div style={{ fontSize:48, marginBottom:12 }}>📡</div>
            <div style={{ fontSize:16, fontWeight:600, marginBottom:8 }}>No eSIMs yet</div>
            <div style={{ fontSize:13, color:muted, marginBottom:20 }}>
              Browse plans and get connected in seconds
            </div>
            <button onClick={() => navigate('/esim')}
              style={{ background:'#F5A623', color:'#0d0d0d', border:'none',
                borderRadius:10, padding:'10px 24px', fontWeight:700,
                fontSize:14, cursor:'pointer' }}>
              Browse eSIM Plans
            </button>
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {orders.map(order => {
              const st = STATUS_COLOR[order.status] || STATUS_COLOR.ACTIVE;
              const isOpen = expanded === order.orderNo;
              const esim = order.esims?.[0] || {};
              const qr = esim.qrCodeUrl || esim.activationCode || esim.lpa;
              const fmtMB = (mb) => mb >= 1024
                ? (mb / 1024) % 1 === 0 ? (mb / 1024) + ' GB' : (mb / 1024).toFixed(1) + ' GB'
                : mb + ' MB';
              const gb = order.dataAmount ? fmtMB(order.dataAmount) : '? MB';
              const topups = order.topups || [];

              const fmtBytes = (b) => {
                if (!b || b <= 0) return '0 MB';
                const mb = b / (1024 * 1024);
                if (mb >= 1024) {
                  const g = mb / 1024;
                  return (g % 1 === 0 ? g : g.toFixed(2)) + ' GB';
                }
                return Math.round(mb) + ' MB';
              };
              const u = usage[order.orderNo];
              const hasUsage = u && u !== 'loading' && u !== 'error' && u.available && u.totalBytes > 0;
              // Per-eSIM breakdown (an order can hold several eSIMs when quantity > 1)
              const usageRows = hasUsage
                ? (u.esims || []).filter(e => (e.totalVolume || 0) > 0)
                : [];
              const pctColor = (pct) => pct >= 90 ? '#f87171' : pct >= 70 ? '#fbbf24' : green;

              return (
                <div key={order.orderNo} style={{
                  background:card, borderRadius:14,
                  border:`1px solid ${border}`, overflow:'hidden',
                }}>
                  {/* Row */}
                  <div style={{ padding:'14px 16px', display:'flex',
                    alignItems:'center', gap:12, cursor:'pointer' }}
                    onClick={() => {
                      const opening = !isOpen;
                      setExpanded(opening ? order.orderNo : null);
                      if (opening && order.orderNo) fetchUsage(order.orderNo);
                    }}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontWeight:700, fontSize:15, color:'#fff', marginBottom:4 }}>
                        {order.packageName || order.packageCode}
                      </div>
                      <div style={{ display:'flex', gap:6, flexWrap:'wrap', alignItems:'center' }}>
                        <span style={{ fontSize:11, ...st, padding:'1px 7px',
                          borderRadius:5, fontWeight:600 }}>{order.status}</span>
                        <span style={{ fontSize:11, color:muted }}>{gb} · {order.duration} days</span>
                        {topups.length > 0 && (
                          <span style={{ fontSize:11, color:green, fontWeight:600 }}>
                            +{topups.length} top-up{topups.length !== 1 ? 's' : ''}
                          </span>
                        )}
                        <span style={{ fontSize:11, color:muted }}>
                          {new Date(order.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <div style={{ textAlign:'right', flexShrink:0 }}>
                      <div style={{ fontSize:15, fontWeight:800, color:green }}>
                        ${order.retailPrice?.toFixed(2)}
                      </div>
                      <div style={{ fontSize:11, color:muted, marginTop:2 }}>
                        {isOpen ? '▲ Hide' : '▼ QR Code'}
                      </div>
                    </div>
                  </div>

                  {/* Usage bar */}
                  <div style={{ padding:'0 16px 12px' }}>
                    {u === 'loading' && (
                      <div style={{ fontSize:11, color:muted }}>Checking data usage…</div>
                    )}
                    {hasUsage && usageRows.map((e, i) => {
                      const total = e.totalVolume || 0;
                      const used = Math.min(e.orderUsage || 0, total);
                      const remaining = Math.max(total - used, 0);
                      const pct = total > 0 ? Math.min(100, (used / total) * 100) : 0;
                      const color = pctColor(pct);
                      const label = usageRows.length > 1
                        ? `eSIM ${i + 1}${e.iccid ? ` · …${String(e.iccid).slice(-4)}` : ''}`
                        : null;
                      return (
                        <div key={e.iccid || i} style={{ marginBottom: i < usageRows.length - 1 ? 8 : 0 }}>
                          <div style={{ display:'flex', justifyContent:'space-between',
                            fontSize:11, marginBottom:4 }}>
                            <span style={{ color:muted }}>
                              {label && <span style={{ color:'#fff', fontWeight:600 }}>{label} — </span>}
                              Used <span style={{ color:'#fff', fontWeight:600 }}>{fmtBytes(used)}</span> of {fmtBytes(total)}
                            </span>
                            <span style={{ color, fontWeight:700 }}>
                              {fmtBytes(remaining)} left
                            </span>
                          </div>
                          <div style={{ height:6, borderRadius:3,
                            background:'rgba(255,255,255,0.08)', overflow:'hidden' }}>
                            <div style={{ height:'100%', width:`${pct}%`,
                              background:color, borderRadius:3,
                              transition:'width 0.4s ease' }} />
                          </div>
                        </div>
                      );
                    })}
                    {u && u !== 'loading' && !hasUsage && (
                      <div style={{ fontSize:11, color:muted }}>
                        Usage data not available yet — install and use the eSIM first
                      </div>
                    )}
                  </div>

                  {/* Expanded: QR */}
                  {isOpen && (
                    <div style={{ borderTop:`1px solid ${border}`,
                      padding:'16px', background:'rgba(255,255,255,0.02)',
                      textAlign:'center' }}>
                      <div style={{ fontSize:12, color:muted, marginBottom:12 }}>
                        Order # <span style={{ color:'#fff' }}>{order.orderNo}</span>
                      </div>
                      {qr && qr.startsWith('http') ? (
                        <img src={qr} alt="QR" style={{ width:180, height:180,
                          borderRadius:12, border:`2px solid ${green}` }} />
                      ) : qr ? (
                        <div style={{ background:'#fff', borderRadius:12, padding:12,
                          display:'inline-block' }}>
                          <div style={{ fontFamily:'monospace', fontSize:10,
                            color:'#000', wordBreak:'break-all', maxWidth:220 }}>{qr}</div>
                        </div>
                      ) : (
                        <div style={{ color:muted, fontSize:13 }}>
                          QR code was sent to your email
                        </div>
                      )}
                      <div style={{ marginTop:12, fontSize:11, color:muted }}>
                        Open Camera app → point at QR → tap notification → install
                      </div>

                      {topups.length > 0 && (
                        <div style={{ marginTop:16, textAlign:'left' }}>
                          <div style={{ fontSize:12, fontWeight:700, color:'#fff',
                            marginBottom:8, display:'flex', alignItems:'center',
                            justifyContent:'space-between' }}>
                            <span>🔋 Top-up history</span>
                            <span style={{ fontSize:11, fontWeight:600, color:green }}>
                              Total data: {gb}
                            </span>
                          </div>
                          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                            {topups.map((t, i) => (
                              <div key={t.transactionId || i} style={{
                                display:'flex', alignItems:'center', gap:10,
                                background:'rgba(255,255,255,0.03)',
                                border:`1px solid ${border}`, borderRadius:10,
                                padding:'8px 12px' }}>
                                <div style={{ flex:1, minWidth:0 }}>
                                  <div style={{ fontSize:12, fontWeight:600, color:'#fff',
                                    whiteSpace:'nowrap', overflow:'hidden',
                                    textOverflow:'ellipsis' }}>
                                    {t.packageName || t.packageCode}
                                  </div>
                                  <div style={{ fontSize:11, color:muted, marginTop:2 }}>
                                    {t.date ? new Date(t.date).toLocaleDateString() : ''}
                                  </div>
                                </div>
                                <div style={{ textAlign:'right', flexShrink:0 }}>
                                  <div style={{ fontSize:12, fontWeight:700, color:green }}>
                                    +{t.dataAmount ? fmtMB(t.dataAmount) : '—'}
                                  </div>
                                  <div style={{ fontSize:11, color:muted, marginTop:2 }}>
                                    ${(t.retailPrice ?? 0).toFixed(2)}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
