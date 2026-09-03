import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Send, AlertCircle, CheckCircle, Loader, ArrowLeft, MessageSquare, RefreshCw, Phone, FileText, Megaphone } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import safeLocalStorage from '../utils/safeLocalStorage';

const API = process.env.REACT_APP_BACKEND_URL || '';

export default function AdminWhatsAppBroadcast() {
  const navigate = useNavigate();
  const [status, setStatus] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [outboundLog, setOutboundLog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState('single'); // single | broadcast

  // single message state
  const [sendType, setSendType] = useState('text'); // text | template
  const [singleTo, setSingleTo] = useState('');
  const [singleText, setSingleText] = useState('');
  const [singleTemplate, setSingleTemplate] = useState('');
  const [singleLang, setSingleLang] = useState('en_US');
  const [singleParams, setSingleParams] = useState('');
  const [singleSending, setSingleSending] = useState(false);
  const [singleResult, setSingleResult] = useState(null);

  // broadcast state
  const [bcTemplate, setBcTemplate] = useState('');
  const [bcLang, setBcLang] = useState('en_US');
  const [bcRecipients, setBcRecipients] = useState('');
  const [bcSending, setBcSending] = useState(false);
  const [bcResult, setBcResult] = useState(null);
  const [bcConfirm, setBcConfirm] = useState(false);

  const headers = () => ({ Authorization: `Bearer ${safeLocalStorage.getItem('token')}` });

  useEffect(() => { refreshAll(); }, []);

  const refreshAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, t, l] = await Promise.allSettled([
        axios.get(`${API}/api/whatsapp-business/status`, { headers: headers() }),
        axios.get(`${API}/api/whatsapp-business/templates`, { headers: headers() }),
        axios.get(`${API}/api/whatsapp-business/outbound-log?limit=50`, { headers: headers() }),
      ]);
      if (s.status === 'fulfilled') setStatus(s.value.data); else setError(s.reason?.response?.data?.detail || 'Status fetch failed');
      if (t.status === 'fulfilled') setTemplates(t.value.data.templates || []);
      if (l.status === 'fulfilled') setOutboundLog(l.value.data.messages || []);
    } catch (e) {
      setError(e?.response?.data?.detail || 'Load failed');
    }
    setLoading(false);
  };

  const sendSingle = async () => {
    setSingleSending(true);
    setSingleResult(null);
    try {
      let res;
      if (sendType === 'text') {
        res = await axios.post(`${API}/api/whatsapp-business/send-text`, {
          to: singleTo, text: singleText,
        }, { headers: headers() });
      } else {
        const params = singleParams.split('|').map(s => s.trim()).filter(Boolean);
        res = await axios.post(`${API}/api/whatsapp-business/send-template`, {
          to: singleTo,
          template_name: singleTemplate,
          language_code: singleLang,
          body_params: params.length ? params : null,
        }, { headers: headers() });
      }
      setSingleResult({ ok: true, msg: 'Message sent ✅' });
      refreshAll();
    } catch (e) {
      setSingleResult({ ok: false, msg: e?.response?.data?.detail || 'Send failed' });
    }
    setSingleSending(false);
  };

  const runBroadcast = async () => {
    setBcSending(true);
    setBcResult(null);
    try {
      const recipients = bcRecipients.split(/[\s,;\n]+/).map(s => s.trim()).filter(Boolean);
      const res = await axios.post(`${API}/api/whatsapp-business/broadcast`, {
        template_name: bcTemplate,
        language_code: bcLang,
        recipients,
      }, { headers: headers() });
      setBcResult({ ok: true, ...res.data });
      setBcConfirm(false);
      refreshAll();
    } catch (e) {
      setBcResult({ ok: false, msg: e?.response?.data?.detail || 'Broadcast failed' });
    }
    setBcSending(false);
  };

  const recipientsCount = bcRecipients.split(/[\s,;\n]+/).filter(Boolean).length;

  return (
    <div className="min-h-screen bg-obsidian text-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        <button onClick={() => navigate('/admin')} className="flex items-center gap-2 text-gray-400 hover:text-white mb-4">
          <ArrowLeft className="w-4 h-4" /> Back to Admin
        </button>

        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">WhatsApp Business — Sender</h1>
              <p className="text-sm text-gray-400">Meta WABA Cloud API · admin only</p>
            </div>
          </div>
          <button onClick={refreshAll} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm">
            {loading ? <Loader className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Refresh
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-900/30 border border-red-500/40 rounded-lg flex items-start gap-2 text-sm">
            <AlertCircle className="w-4 h-4 mt-0.5 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Status panel */}
        <div className="grid sm:grid-cols-3 gap-3 mb-6">
          <div className="bg-olive border border-white/10 rounded-xl p-4">
            <div className="text-xs text-gray-400 uppercase mb-1">Configured</div>
            <div className={`text-lg font-bold ${status?.configured ? 'text-green-400' : 'text-red-400'}`}>
              {status?.configured ? '✅ Yes' : '❌ No'}
            </div>
            {!status?.configured && <div className="text-xs text-gray-500 mt-1">Set WHATSAPP_* env vars</div>}
          </div>
          <div className="bg-olive border border-white/10 rounded-xl p-4">
            <div className="text-xs text-gray-400 uppercase mb-1">Phone Number</div>
            <div className="text-lg font-bold text-white">{status?.phone?.display_phone_number || '—'}</div>
            <div className="text-xs text-gray-400">{status?.phone?.verified_name || '—'}</div>
          </div>
          <div className="bg-olive border border-white/10 rounded-xl p-4">
            <div className="text-xs text-gray-400 uppercase mb-1">Quality Rating</div>
            <div className="text-lg font-bold text-white">{status?.phone?.quality_rating || '—'}</div>
            <div className="text-xs text-gray-400">{status?.phone?.code_verification_status || ''}</div>
          </div>
        </div>

        {/* Templates */}
        <div className="bg-olive border border-white/10 rounded-xl p-4 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <FileText className="w-4 h-4 text-blue-400" />
            <span className="font-bold">Approved Templates ({templates.length})</span>
          </div>
          {templates.length === 0 ? (
            <div className="text-sm text-gray-400">
              No templates loaded. Set <code className="bg-black/40 px-2 py-0.5 rounded">WHATSAPP_BUSINESS_ACCOUNT_ID</code> env var, or create templates in Meta Business Manager first.
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {templates.map((t, i) => (
                <div key={i} className="bg-black/30 border border-white/5 rounded-lg p-3">
                  <div className="font-mono text-sm text-white">{t.name}</div>
                  <div className="flex gap-2 mt-1 text-xs">
                    <span className={`px-2 py-0.5 rounded ${t.status === 'APPROVED' ? 'bg-green-900/50 text-green-400' : 'bg-yellow-900/50 text-yellow-400'}`}>{t.status}</span>
                    <span className="text-gray-500">{t.language}</span>
                    <span className="text-gray-500">{t.category}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-4 border-b border-white/10">
          <button onClick={() => setTab('single')}
            className={`px-4 py-2 text-sm font-semibold border-b-2 transition ${tab === 'single' ? 'border-green-500 text-green-400' : 'border-transparent text-gray-400'}`}>
            <Phone className="w-4 h-4 inline mr-1" /> Single Send
          </button>
          <button onClick={() => setTab('broadcast')}
            className={`px-4 py-2 text-sm font-semibold border-b-2 transition ${tab === 'broadcast' ? 'border-green-500 text-green-400' : 'border-transparent text-gray-400'}`}>
            <Megaphone className="w-4 h-4 inline mr-1" /> Broadcast
          </button>
          <button onClick={() => setTab('log')}
            className={`px-4 py-2 text-sm font-semibold border-b-2 transition ${tab === 'log' ? 'border-green-500 text-green-400' : 'border-transparent text-gray-400'}`}>
            <FileText className="w-4 h-4 inline mr-1" /> Outbound Log
          </button>
        </div>

        {/* Single Send */}
        {tab === 'single' && (
          <div className="bg-olive border border-white/10 rounded-xl p-5 space-y-4">
            <div className="flex gap-2">
              <button onClick={() => setSendType('text')} className={`px-3 py-1.5 rounded text-sm ${sendType === 'text' ? 'bg-green-600 text-white' : 'bg-white/5 text-gray-300'}`}>Free Text (24h window)</button>
              <button onClick={() => setSendType('template')} className={`px-3 py-1.5 rounded text-sm ${sendType === 'template' ? 'bg-green-600 text-white' : 'bg-white/5 text-gray-300'}`}>Template (anytime)</button>
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1">Recipient (E.164, no +)</label>
              <input value={singleTo} onChange={e => setSingleTo(e.target.value)}
                placeholder="14155551234"
                className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white" />
            </div>

            {sendType === 'text' ? (
              <div>
                <label className="block text-xs text-gray-400 mb-1">Message</label>
                <textarea value={singleText} onChange={e => setSingleText(e.target.value)}
                  rows={4} maxLength={4000}
                  className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white" />
                <div className="text-xs text-gray-500 mt-1">{singleText.length}/4000 · Only works within 24h of customer's last message.</div>
              </div>
            ) : (
              <>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Template Name</label>
                    <select value={singleTemplate} onChange={e => setSingleTemplate(e.target.value)}
                      className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white">
                      <option value="">— pick template —</option>
                      {templates.filter(t => t.status === 'APPROVED').map((t, i) => (
                        <option key={i} value={t.name}>{t.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Language</label>
                    <input value={singleLang} onChange={e => setSingleLang(e.target.value)}
                      className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Body params (pipe-separated, for {'{{1}}'}, {'{{2}}'}, …)</label>
                  <input value={singleParams} onChange={e => setSingleParams(e.target.value)}
                    placeholder="John | $5.00"
                    className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white" />
                </div>
              </>
            )}

            <button onClick={sendSingle} disabled={singleSending || !singleTo || (sendType === 'text' ? !singleText : !singleTemplate)}
              className="w-full py-3 bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-bold flex items-center justify-center gap-2">
              {singleSending ? <Loader className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Send Message
            </button>

            {singleResult && (
              <div className={`p-3 rounded-lg flex items-start gap-2 text-sm ${singleResult.ok ? 'bg-green-900/30 border border-green-500/40 text-green-300' : 'bg-red-900/30 border border-red-500/40 text-red-300'}`}>
                {singleResult.ok ? <CheckCircle className="w-4 h-4 mt-0.5" /> : <AlertCircle className="w-4 h-4 mt-0.5" />}
                {singleResult.msg}
              </div>
            )}
          </div>
        )}

        {/* Broadcast */}
        {tab === 'broadcast' && (
          <div className="bg-olive border border-white/10 rounded-xl p-5 space-y-4">
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Template Name</label>
                <select value={bcTemplate} onChange={e => setBcTemplate(e.target.value)}
                  className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white">
                  <option value="">— pick approved template —</option>
                  {templates.filter(t => t.status === 'APPROVED').map((t, i) => (
                    <option key={i} value={t.name}>{t.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Language</label>
                <input value={bcLang} onChange={e => setBcLang(e.target.value)}
                  className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white" />
              </div>
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1">
                Recipients (one per line, comma- or space-separated; E.164 no +) — <span className="text-green-400 font-bold">{recipientsCount}</span> total
              </label>
              <textarea value={bcRecipients} onChange={e => setBcRecipients(e.target.value)}
                rows={8}
                placeholder="14155551234&#10;447700900123&#10;6281234567890"
                className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white font-mono text-sm" />
              <div className="text-xs text-gray-500 mt-1">Max 5000 per broadcast · ~5 messages/sec · idempotent campaign log.</div>
            </div>

            {!bcConfirm ? (
              <button onClick={() => setBcConfirm(true)}
                disabled={!bcTemplate || recipientsCount === 0}
                className="w-full py-3 bg-green-600 hover:bg-green-500 disabled:opacity-50 rounded-lg font-bold flex items-center justify-center gap-2">
                <Megaphone className="w-4 h-4" /> Review Broadcast
              </button>
            ) : (
              <div className="space-y-3">
                <div className="p-3 bg-yellow-900/20 border border-yellow-500/30 rounded-lg text-sm text-yellow-300">
                  About to send template <b>{bcTemplate}</b> to <b>{recipientsCount}</b> recipients via WhatsApp Business. Each Meta-conversation costs ~$0.005–$0.08 depending on country. Confirm?
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setBcConfirm(false)} className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 rounded-lg">Cancel</button>
                  <button onClick={runBroadcast} disabled={bcSending}
                    className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 disabled:opacity-50 rounded-lg font-bold flex items-center justify-center gap-2">
                    {bcSending ? <Loader className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    SEND TO {recipientsCount}
                  </button>
                </div>
              </div>
            )}

            {bcResult && (
              <div className={`p-4 rounded-lg text-sm ${bcResult.ok ? 'bg-green-900/30 border border-green-500/40 text-green-300' : 'bg-red-900/30 border border-red-500/40 text-red-300'}`}>
                {bcResult.ok ? (
                  <>
                    <div className="font-bold mb-1">✅ Broadcast complete · <span className="font-mono text-xs">{bcResult.campaign_id}</span></div>
                    <div>Sent: <b>{bcResult.sent}</b> / {bcResult.total} · Failed: <b>{bcResult.failed}</b></div>
                    {bcResult.errors?.length > 0 && (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-xs">Show {bcResult.errors.length} errors</summary>
                        <pre className="mt-2 text-xs bg-black/30 p-2 rounded overflow-auto max-h-40">{JSON.stringify(bcResult.errors, null, 2)}</pre>
                      </details>
                    )}
                  </>
                ) : bcResult.msg}
              </div>
            )}
          </div>
        )}

        {/* Outbound Log */}
        {tab === 'log' && (
          <div className="bg-olive border border-white/10 rounded-xl p-5">
            {outboundLog.length === 0 ? (
              <div className="text-center text-gray-400 py-8">No outbound messages yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-gray-400 uppercase border-b border-white/10">
                    <tr>
                      <th className="text-left py-2">Time</th>
                      <th className="text-left py-2">To</th>
                      <th className="text-left py-2">Type</th>
                      <th className="text-left py-2">Template / Text</th>
                      <th className="text-left py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {outboundLog.map((m, i) => (
                      <tr key={i} className="border-b border-white/5">
                        <td className="py-2 text-xs text-gray-400">{(m.timestamp || '').slice(0, 19).replace('T', ' ')}</td>
                        <td className="py-2 font-mono">+{m.to}</td>
                        <td className="py-2">{m.type}</td>
                        <td className="py-2 max-w-xs truncate text-gray-300">{m.template_name || m.text || '—'}</td>
                        <td className="py-2">
                          {m.ok === false ? <span className="text-red-400">✗</span> : <span className="text-green-400">✓</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
