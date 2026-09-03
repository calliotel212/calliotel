import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Key, Plus, Trash2, Copy, Check, Eye, EyeOff, RefreshCw,
  Webhook, BarChart2, Code2, ExternalLink, AlertCircle, Zap,
  Globe, Activity,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import BottomNav from '../components/BottomNav';
import AppDrawer from '../components/AppDrawer';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';
const API = `${BACKEND_URL}/api`;
const YELLOW = '#f5c518';

const apiFetch = async (path, opts = {}) => {
  const t = localStorage.getItem('token');
  const r = await fetch(`${API}${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}`, ...(opts.headers || {}) },
  });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).detail || `HTTP ${r.status}`);
  return r.json();
};

function CopyBtn({ text, small }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };
  return (
    <button onClick={copy} className={`flex items-center gap-1 rounded-lg font-medium transition-all hover:bg-white/10 text-gray-400 hover:text-white ${small ? 'px-2 py-1 text-[11px]' : 'px-3 py-1.5 text-xs'}`}>
      {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

function KeyCard({ rec, onRevoke }) {
  const [visible, setVisible] = useState(false);
  const preview = rec.key ? (visible ? rec.key : rec.key.slice(0, 16) + '•'.repeat(24)) : rec.key_preview;
  const isLive = rec.env === 'live';

  return (
    <div className="bg-gray-800/50 border border-gray-700/50 rounded-2xl p-5">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-bold text-white">{rec.label}</span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isLive ? 'bg-yellow-400/10 text-yellow-400' : 'bg-blue-400/10 text-blue-400'}`}>
              {isLive ? '⚡ LIVE' : '🧪 TEST'}
            </span>
          </div>
          <div className="text-xs text-gray-400">Created {new Date(rec.created_at).toLocaleDateString()} · {rec.requests || 0} requests</div>
          {rec.last_used && <div className="text-xs text-gray-500">Last used {new Date(rec.last_used).toLocaleDateString()}</div>}
        </div>
        <button onClick={() => onRevoke(rec.key || rec.key_preview)}
          className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs text-red-400 border border-red-400/20 hover:bg-red-500/10 transition-all">
          <Trash2 className="w-3 h-3" /> Revoke
        </button>
      </div>

      <div className="flex items-center gap-2 bg-black/30 rounded-xl px-4 py-2.5">
        <code className="flex-1 font-mono text-sm text-green-300 truncate">{preview}</code>
        {rec.key && (
          <button onClick={() => setVisible(v => !v)} className="text-gray-400 hover:text-white transition-colors">
            {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        )}
        <CopyBtn text={rec.key || rec.key_preview} small />
      </div>
    </div>
  );
}

export default function DeveloperDashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [keys, setKeys] = useState([]);
  const [usage, setUsage] = useState(null);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookSaving, setWebhookSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newEnv, setNewEnv] = useState('live');
  const [showCreate, setShowCreate] = useState(false);
  const [tab, setTab] = useState('keys');

  const load = async () => {
    setLoading(true);
    try {
      const [kd, ud, wd] = await Promise.all([
        apiFetch('/developer/keys'),
        apiFetch('/developer/usage').catch(() => null),
        apiFetch('/developer/webhook').catch(() => null),
      ]);
      setKeys(kd.keys || []);
      setUsage(ud);
      setWebhookUrl(wd?.webhook_url || '');
    } catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (user) load(); }, [user]);

  const createKey = async () => {
    if (!newLabel.trim()) { toast.error('Enter a label'); return; }
    setCreating(true);
    try {
      const r = await apiFetch('/developer/keys', {
        method: 'POST', body: JSON.stringify({ label: newLabel, env: newEnv }),
      });
      toast.success('API key created!');
      setNewLabel(''); setShowCreate(false);
      setKeys(k => [{ ...r, requests: 0 }, ...k]);
    } catch (e) { toast.error(e.message); }
    finally { setCreating(false); }
  };

  const revokeKey = async (keyOrPreview) => {
    if (!window.confirm('Revoke this key? Apps using it will stop working immediately.')) return;
    try {
      await apiFetch(`/developer/keys/${keyOrPreview.slice(0, 16)}`, { method: 'DELETE' });
      toast.success('Key revoked');
      setKeys(k => k.filter(r => (r.key || r.key_preview) !== keyOrPreview));
    } catch (e) { toast.error(e.message); }
  };

  const saveWebhook = async () => {
    setWebhookSaving(true);
    try {
      await apiFetch('/developer/webhook', { method: 'PUT', body: JSON.stringify({ url: webhookUrl }) });
      toast.success('Webhook URL saved!');
    } catch (e) { toast.error(e.message); }
    finally { setWebhookSaving(false); }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <AppDrawer />

      <div className="max-w-3xl mx-auto px-4 py-8 pb-32">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Code2 className="w-5 h-5" style={{ color: YELLOW }} />
              <h1 className="text-2xl font-black text-white">Developer API</h1>
            </div>
            <p className="text-sm text-gray-400">Manage your API keys, webhooks, and usage</p>
          </div>
          <a href="/developers" target="_blank" rel="noreferrer"
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm border border-gray-700 text-gray-300 hover:bg-white/5 transition-all">
            <ExternalLink className="w-3.5 h-3.5" /> Docs
          </a>
        </div>

        {/* Stats row */}
        {usage && (
          <div className="grid grid-cols-3 gap-3 mb-6">
            {[
              { label: 'Active Keys', value: keys.length, icon: Key },
              { label: 'Total Requests', value: usage.total_requests?.toLocaleString() || '0', icon: Activity },
              { label: 'Numbers via API', value: usage.api_numbers || '0', icon: Globe },
            ].map(s => (
              <div key={s.label} className="bg-gray-800/50 border border-gray-700/50 rounded-2xl p-4 text-center">
                <s.icon className="w-4 h-4 mx-auto mb-1" style={{ color: YELLOW }} />
                <div className="text-xl font-black" style={{ color: YELLOW }}>{s.value}</div>
                <div className="text-[10px] text-gray-400 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-800/60 rounded-xl p-1 mb-6 border border-gray-700/50">
          {[['keys', '🔑 API Keys'], ['webhook', '🔗 Webhook'], ['usage', '📊 Usage']].map(([id, lbl]) => (
            <button key={id} onClick={() => setTab(id)}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${tab === id ? 'text-black' : 'text-gray-400 hover:text-white'}`}
              style={tab === id ? { background: YELLOW } : {}}>
              {lbl}
            </button>
          ))}
        </div>

        {/* ── Keys Tab ── */}
        {tab === 'keys' && (
          <div className="space-y-4">
            {/* Create button */}
            <button onClick={() => setShowCreate(s => !s)}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-bold text-black transition-all hover:opacity-90"
              style={{ background: YELLOW }}>
              <Plus className="w-4 h-4" /> Create New API Key
            </button>

            {/* Create form */}
            {showCreate && (
              <div className="bg-gray-800/60 border border-gray-700/50 rounded-2xl p-5 space-y-4">
                <h3 className="font-bold">New API Key</h3>
                <div>
                  <label className="text-xs text-gray-400 font-semibold uppercase tracking-wider block mb-1.5">Label</label>
                  <input value={newLabel} onChange={e => setNewLabel(e.target.value)}
                    placeholder="e.g. My Production App"
                    className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-yellow-400" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 font-semibold uppercase tracking-wider block mb-1.5">Environment</label>
                  <div className="flex gap-2">
                    {[['live', '⚡ Live', 'Real charges, real numbers'], ['test', '🧪 Test', 'No charges, safe for dev']].map(([val, lbl, desc]) => (
                      <button key={val} onClick={() => setNewEnv(val)}
                        className={`flex-1 py-2 px-3 rounded-xl border text-sm text-left transition-all ${newEnv === val ? 'border-yellow-400/50 bg-yellow-400/5' : 'border-gray-700 hover:border-gray-600'}`}>
                        <div className="font-semibold">{lbl}</div>
                        <div className="text-xs text-gray-400">{desc}</div>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={createKey} disabled={creating}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold text-black disabled:opacity-50"
                    style={{ background: YELLOW }}>
                    {creating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    Create Key
                  </button>
                  <button onClick={() => setShowCreate(false)} className="px-4 py-2.5 rounded-xl border border-gray-700 text-sm text-gray-400 hover:text-white">Cancel</button>
                </div>
                <div className="flex items-start gap-2 p-3 bg-amber-400/5 border border-amber-400/20 rounded-xl text-xs text-amber-300">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                  <span>Your key is shown <strong>only once</strong> after creation. Copy and store it securely.</span>
                </div>
              </div>
            )}

            {/* Key list */}
            {loading ? (
              <div className="text-center py-12 text-gray-400">Loading…</div>
            ) : keys.length === 0 ? (
              <div className="text-center py-12">
                <Key className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400 text-sm">No API keys yet — create one above</p>
                <p className="text-gray-500 text-xs mt-1">You can have up to 5 active keys</p>
              </div>
            ) : keys.map(rec => (
              <KeyCard key={rec.key || rec.key_preview} rec={rec} onRevoke={revokeKey} />
            ))}

            {/* Base URL box */}
            <div className="bg-gray-800/30 border border-gray-700/40 rounded-2xl p-4">
              <div className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-2">Base URL</div>
              <div className="flex items-center gap-2">
                <code className="flex-1 font-mono text-sm text-green-300 bg-black/30 px-3 py-2 rounded-lg">https://calliotel.com/v1</code>
                <CopyBtn text="https://calliotel.com/v1" small />
              </div>
              <p className="text-xs text-gray-500 mt-2">All requests: <code className="text-gray-400">Authorization: Bearer ct_live_xxx</code></p>
            </div>
          </div>
        )}

        {/* ── Webhook Tab ── */}
        {tab === 'webhook' && (
          <div className="space-y-4">
            <div className="bg-gray-800/50 border border-gray-700/50 rounded-2xl p-5 space-y-4">
              <div>
                <h3 className="font-bold mb-1">Inbound SMS Webhook</h3>
                <p className="text-sm text-gray-400">When you receive an SMS on any of your virtual numbers, we POST the payload to this URL in real-time.</p>
              </div>
              <div>
                <label className="text-xs text-gray-400 font-semibold uppercase tracking-wider block mb-1.5">Webhook URL</label>
                <input value={webhookUrl} onChange={e => setWebhookUrl(e.target.value)}
                  placeholder="https://yourapp.com/sms-hook"
                  className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-yellow-400" />
                <p className="text-xs text-gray-500 mt-1">Must start with https://. Leave blank to disable.</p>
              </div>
              <button onClick={saveWebhook} disabled={webhookSaving}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-black disabled:opacity-50"
                style={{ background: YELLOW }}>
                {webhookSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Webhook className="w-4 h-4" />}
                Save Webhook URL
              </button>
            </div>

            <div className="bg-gray-800/50 border border-gray-700/50 rounded-2xl p-5">
              <h3 className="font-bold mb-3">Payload Format</h3>
              <pre className="bg-black/40 rounded-xl px-4 py-3 text-xs text-blue-200 font-mono overflow-x-auto">{`{
  "event": "sms.received",
  "to": "+12125550000",
  "from": "+19175550001",
  "text": "Your OTP is 482901",
  "received_at": "2026-07-25T12:00:00Z"
}`}</pre>
              <p className="text-xs text-gray-400 mt-3">Your endpoint must return <strong>HTTP 2xx</strong> within <strong>10 seconds</strong>.</p>
            </div>
          </div>
        )}

        {/* ── Usage Tab ── */}
        {tab === 'usage' && (
          <div className="space-y-4">
            {!usage ? (
              <div className="text-center py-12 text-gray-400">Loading usage data…</div>
            ) : (
              <>
                {usage.recent_requests?.length > 0 ? (
                  <div className="bg-gray-800/50 border border-gray-700/50 rounded-2xl overflow-hidden">
                    <div className="px-5 py-4 border-b border-gray-700/50 font-bold text-sm">Recent API Calls</div>
                    {usage.recent_requests.slice(0, 20).map((log, i) => (
                      <div key={i} className={`flex items-center gap-3 px-5 py-3 text-sm ${i > 0 ? 'border-t border-gray-700/30' : ''}`}>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded font-mono ${log.status < 400 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>{log.status}</span>
                        <code className="text-gray-300 flex-1 text-xs">{log.endpoint}</code>
                        <span className="text-gray-500 text-xs">{log.latency_ms}ms</span>
                        <span className="text-gray-500 text-xs">{log.ts ? new Date(log.ts).toLocaleTimeString() : ''}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-gray-800/50 border border-gray-700/50 rounded-2xl p-12 text-center">
                    <BarChart2 className="w-10 h-10 text-gray-600 mx-auto mb-3" />
                    <p className="text-gray-400 text-sm">No API calls yet</p>
                    <p className="text-gray-500 text-xs mt-1">Create an API key and make your first request</p>
                  </div>
                )}

                {usage.recent_charges?.length > 0 && (
                  <div className="bg-gray-800/50 border border-gray-700/50 rounded-2xl overflow-hidden">
                    <div className="px-5 py-4 border-b border-gray-700/50 font-bold text-sm">Recent Charges (API)</div>
                    {usage.recent_charges.slice(0, 10).map((tx, i) => (
                      <div key={i} className={`flex items-center gap-3 px-5 py-3 text-sm ${i > 0 ? 'border-t border-gray-700/30' : ''}`}>
                        <span className="flex-1 text-gray-300 text-xs truncate">{tx.description}</span>
                        <span className="font-mono text-red-400 font-bold">{tx.amount < 0 ? '-' : ''}${Math.abs(tx.amount).toFixed(4)}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="bg-gray-800/30 border border-gray-700/40 rounded-2xl p-5 text-center">
                  <div className="text-xs text-gray-400 mb-1">Need more data?</div>
                  <code className="text-xs text-green-300 font-mono">GET https://calliotel.com/v1/usage?limit=200</code>
                </div>
              </>
            )}
          </div>
        )}

        {/* Quick start banner */}
        <div className="mt-6 rounded-2xl p-5 flex items-center gap-4" style={{ background: `${YELLOW}10`, border: `1px solid ${YELLOW}30` }}>
          <Zap className="w-8 h-8 flex-shrink-0" style={{ color: YELLOW }} />
          <div className="flex-1 min-w-0">
            <div className="font-bold text-sm" style={{ color: YELLOW }}>Full API Documentation</div>
            <div className="text-xs text-gray-400 mt-0.5">Quickstart, code examples, endpoint reference, webhooks, and more.</div>
          </div>
          <a href="/developers" target="_blank" rel="noreferrer"
            className="flex-shrink-0 flex items-center gap-1 px-4 py-2 rounded-xl text-xs font-bold text-black whitespace-nowrap"
            style={{ background: YELLOW }}>
            View Docs <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
