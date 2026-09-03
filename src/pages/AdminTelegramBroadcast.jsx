import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Send, Users, AlertCircle, CheckCircle, Loader, ArrowLeft, MessageSquare, Eye, History } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import safeLocalStorage from '../utils/safeLocalStorage';

const API = process.env.REACT_APP_BACKEND_URL || '';

const PRESETS = [
  {
    label: '🔥 Flash deal',
    text: '🔥 <b>Flash deal — today only!</b>\n\n📲 Get a virtual phone number from <b>US, UK, Canada</b> and more.\n\nPerfect for WhatsApp, Telegram, Instagram and business.\n\nFrom <b>$1.99/mo</b> — cancel anytime 👇',
    button_text: '⚡ Browse Numbers',
    button_url: 'https://calliotel.com/browse-numbers',
  },
  {
    label: '🌍 New country',
    text: '🌍 <b>New country available!</b>\n\nVirtual numbers now available for more regions — activate instantly, no ID required.\n\nFrom <b>$1.99/mo</b>. Receive SMS + calls.',
    button_text: '📲 Browse Numbers',
    button_url: 'https://calliotel.com/browse-numbers',
  },
  {
    label: '📱 Annual deal',
    text: '📱 <b>Save up to 40% with annual plans!</b>\n\nGet a virtual number for a full year and save big:\n• 3 months: 15% off\n• 6 months: 25% off\n• 12 months: 40% off\n\nActivate in seconds, no ID required.',
    button_text: '🚀 Get Annual Plan',
    button_url: 'https://calliotel.com/browse-numbers',
  },
  {
    label: '💎 Crypto reminder',
    text: '💳 Card not working? <b>Pay with USDT (TRON)</b> instead.\n\n✅ Instant\n✅ ~$1 fee\n✅ Works worldwide, no bank checks\n\nTop up wallet now 👇',
    button_text: '💎 Pay with Crypto',
    button_url: 'https://calliotel.com/wallet',
  },
];

export default function AdminTelegramBroadcast() {
  const navigate = useNavigate();
  const [counts, setCounts] = useState(null);
  const [history, setHistory] = useState([]);
  const [text, setText] = useState('');
  const [buttonText, setButtonText] = useState('');
  const [buttonUrl, setButtonUrl] = useState('');
  const [parseMode, setParseMode] = useState('HTML');
  const [disablePreview, setDisablePreview] = useState(false);
  const [sending, setSending] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const headers = () => ({
    Authorization: `Bearer ${safeLocalStorage.getItem('token')}`,
  });

  useEffect(() => {
    refreshAll();
  }, []);

  const refreshAll = async () => {
    try {
      const [c, h] = await Promise.all([
        axios.get(`${API}/api/admin/telegram/subscribers/count`, { headers: headers() }),
        axios.get(`${API}/api/admin/telegram/broadcasts?limit=10`, { headers: headers() }),
      ]);
      setCounts(c.data);
      setHistory(h.data.items || []);
    } catch (e) {
      setError(e?.response?.data?.detail || 'Failed to load. Are you admin?');
    }
  };

  const send = async (testOnly) => {
    setSending(true);
    setError(null);
    setResult(null);
    try {
      const body = {
        message: text,
        parse_mode: parseMode || null,
        disable_web_page_preview: disablePreview,
        test_only: testOnly,
      };
      if (buttonText && buttonUrl) {
        body.button_text = buttonText;
        body.button_url = buttonUrl;
      }
      const r = await axios.post(`${API}/api/admin/telegram/broadcast`, body, { headers: headers() });
      setResult(r.data);
      setConfirm(false);
      refreshAll();
    } catch (e) {
      setError(e?.response?.data?.detail || String(e));
    } finally {
      setSending(false);
    }
  };

  const applyPreset = (p) => {
    setText(p.text);
    setButtonText(p.button_text || '');
    setButtonUrl(p.button_url || '');
    setParseMode('HTML');
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-4xl mx-auto">
        <button onClick={() => navigate('/admin')} className="flex items-center gap-2 text-gray-400 hover:text-white mb-6 text-sm">
          <ArrowLeft className="w-4 h-4" /> Back to Admin
        </button>

        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-sky-500/20 border border-sky-500/40 flex items-center justify-center">
            <Send className="w-5 h-5 text-sky-400" />
          </div>
          <h1 className="text-3xl font-bold">Telegram Broadcast</h1>
        </div>
        <p className="text-gray-400 text-sm mb-8">Message opted-in <code className="text-sky-400">/start</code> subscribers of <a className="underline" href="https://t.me/Calliotelbot" target="_blank" rel="noreferrer">@Calliotelbot</a>.</p>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <Stat icon={<Users />} label="Opted in" value={counts?.opted_in ?? '—'} color="text-emerald-400" />
          <Stat icon={<Users />} label="Total subscribers" value={counts?.total ?? '—'} color="text-sky-400" />
          <Stat icon={<Users />} label="Opted out" value={counts?.opted_out ?? '—'} color="text-gray-400" />
        </div>

        {/* Presets */}
        <div className="mb-6">
          <label className="text-xs uppercase tracking-wide text-gray-500 font-bold mb-2 block">Quick presets</label>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button key={p.label} onClick={() => applyPreset(p)}
                className="px-3 py-1.5 rounded-full text-xs font-semibold bg-white/5 border border-white/10 hover:bg-sky-500/15 hover:border-sky-500/40 transition">
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Composer */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-6 space-y-4">
          <div>
            <label className="text-xs uppercase tracking-wide text-gray-500 font-bold mb-2 flex items-center gap-2">
              <MessageSquare className="w-3 h-3" /> Message
              <span className="ml-auto text-gray-600 normal-case font-normal">{text.length}/4000</span>
            </label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={8}
              maxLength={4000}
              placeholder="🔥 Today's deal: WA Indonesia OTP $0.20 only..."
              className="w-full bg-gray-900 border border-white/10 rounded-xl p-3 text-sm font-mono text-white focus:border-sky-500 outline-none"
            />
            <div className="flex items-center gap-4 mt-2 text-xs">
              <label className="flex items-center gap-2 text-gray-400">
                Format:
                <select value={parseMode || ''} onChange={(e) => setParseMode(e.target.value || null)}
                  className="bg-gray-900 border border-white/10 rounded px-2 py-1 text-white">
                  <option value="HTML">HTML (&lt;b&gt;, &lt;i&gt;)</option>
                  <option value="MarkdownV2">MarkdownV2</option>
                  <option value="">Plain text</option>
                </select>
              </label>
              <label className="flex items-center gap-2 text-gray-400">
                <input type="checkbox" checked={disablePreview} onChange={(e) => setDisablePreview(e.target.checked)} />
                Hide link preview
              </label>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs uppercase tracking-wide text-gray-500 font-bold mb-2 block">Button text (optional)</label>
              <input value={buttonText} onChange={(e) => setButtonText(e.target.value)}
                placeholder="⚡ Get OTP"
                className="w-full bg-gray-900 border border-white/10 rounded-xl p-2.5 text-sm text-white focus:border-sky-500 outline-none" />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wide text-gray-500 font-bold mb-2 block">Button URL (optional)</label>
              <input value={buttonUrl} onChange={(e) => setButtonUrl(e.target.value)}
                placeholder="https://calliotel.com/verification"
                className="w-full bg-gray-900 border border-white/10 rounded-xl p-2.5 text-sm text-white focus:border-sky-500 outline-none" />
            </div>
          </div>

          {/* Preview */}
          {text && (
            <div>
              <label className="text-xs uppercase tracking-wide text-gray-500 font-bold mb-2 flex items-center gap-2">
                <Eye className="w-3 h-3" /> Telegram preview
              </label>
              <div className="bg-[#17212b] rounded-2xl p-4 max-w-md border border-white/5">
                <div className="text-sm text-white whitespace-pre-wrap leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: parseMode === 'HTML' ? text : escapeHtml(text) }} />
                {buttonText && buttonUrl && (
                  <button className="mt-3 w-full bg-[#2b5278] hover:bg-[#3a6ea5] text-white text-sm font-semibold py-2.5 rounded-lg transition">
                    {buttonText}
                  </button>
                )}
                <div className="text-[10px] text-gray-500 mt-2 text-right">@Calliotelbot</div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-3 pt-2">
            <button onClick={() => send(true)} disabled={!text || sending}
              className="px-4 py-2.5 rounded-xl text-sm font-semibold bg-white/5 border border-white/15 hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2">
              {sending ? <Loader className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
              Test send (only me)
            </button>
            <button onClick={() => setConfirm(true)} disabled={!text || sending || !counts?.opted_in}
              className="ml-auto px-5 py-2.5 rounded-xl text-sm font-bold bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg shadow-sky-500/30">
              <Send className="w-4 h-4" /> Send to {counts?.opted_in ?? 0} subscribers
            </button>
          </div>
        </div>

        {/* Result / error */}
        {result && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 mb-4 flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div className="text-sm">
              <div className="font-bold text-emerald-300">Broadcast sent!</div>
              <div className="text-gray-300 mt-1">
                Attempted: {result.attempted} · ✅ {result.sent} delivered · ❌ {result.failed} failed
              </div>
              {result.errors_sample?.length > 0 && (
                <details className="mt-2 text-xs text-gray-400">
                  <summary className="cursor-pointer">Show error samples</summary>
                  <pre className="mt-1 whitespace-pre-wrap">{result.errors_sample.join('\n')}</pre>
                </details>
              )}
            </div>
          </div>
        )}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div className="text-sm text-red-300">{error}</div>
          </div>
        )}

        {/* History */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
          <h3 className="font-bold mb-3 flex items-center gap-2"><History className="w-4 h-4" /> Recent broadcasts</h3>
          {history.length === 0 ? (
            <p className="text-sm text-gray-500">No broadcasts yet.</p>
          ) : (
            <div className="space-y-2">
              {history.map((h, i) => (
                <div key={i} className="bg-black/30 rounded-lg p-3 text-sm">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-500">{new Date(h.sent_at).toLocaleString()}</span>
                    <span className="text-xs">
                      <span className="text-emerald-400">✓ {h.sent_ok}</span>
                      {' / '}
                      <span className="text-red-400">✗ {h.sent_fail}</span>
                      {h.test_only && <span className="ml-2 px-1.5 py-0.5 rounded bg-yellow-500/15 text-yellow-300 text-[10px]">TEST</span>}
                    </span>
                  </div>
                  <div className="text-gray-300 text-xs line-clamp-2">{h.message_preview}</div>
                  <div className="text-[10px] text-gray-600 mt-1">by {h.sent_by}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Confirm modal */}
      {confirm && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-white/10 rounded-2xl p-6 max-w-md w-full">
            <h3 className="text-xl font-bold mb-2">Send to {counts?.opted_in} subscribers?</h3>
            <p className="text-sm text-gray-400 mb-5">This will broadcast immediately. Cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirm(false)} disabled={sending}
                className="flex-1 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-sm font-semibold">
                Cancel
              </button>
              <button onClick={() => send(false)} disabled={sending}
                className="flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-sm font-bold flex items-center justify-center gap-2">
                {sending ? <Loader className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {sending ? 'Sending...' : 'Send now'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ icon, label, value, color }) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
      <div className={`flex items-center gap-2 ${color} mb-2`}>{icon}</div>
      <div className="text-2xl font-bold text-white">{value}</div>
      <div className="text-xs text-gray-500 uppercase tracking-wide">{label}</div>
    </div>
  );
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}
