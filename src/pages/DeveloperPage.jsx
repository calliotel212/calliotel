import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Code2, Key, Zap, Globe, Shield, BookOpen, Terminal,
  Phone, MessageSquare, DollarSign, Webhook, ArrowRight,
  Copy, Check, ChevronDown, ChevronRight,
} from 'lucide-react';

const YELLOW = '#f5c518';

const ENDPOINTS = [
  {
    method: 'GET', path: '/v1/balance', category: 'Balance',
    desc: 'Get your current wallet balance in USD.',
    params: [],
    example_req: null,
    example_res: `{\n  "balance": 24.50,\n  "currency": "USD"\n}`,
  },
  {
    method: 'GET', path: '/v1/numbers/search', category: 'Numbers',
    desc: 'Search available virtual numbers by country. Returns up to 50 results with monthly pricing.',
    params: [
      { name: 'country', type: 'string', req: false, desc: 'ISO 3166-1 alpha-2. Default: US. Supported: US, CA, GB, NL, AU, SE, PR' },
      { name: 'limit',   type: 'integer', req: false, desc: 'Max results (1–50). Default: 10' },
    ],
    example_req: null,
    example_res: `{\n  "numbers": [\n    {\n      "number": "+12125557890",\n      "country": "US",\n      "region": "New York",\n      "capabilities": { "sms": true, "voice": true },\n      "monthly_price_usd": 2.50\n    }\n  ],\n  "total": 1,\n  "country": "US",\n  "monthly_price_usd": 2.50\n}`,
  },
  {
    method: 'POST', path: '/v1/numbers/buy', category: 'Numbers',
    desc: 'Purchase a virtual number. The monthly cost is deducted from your wallet instantly.',
    params: [],
    example_req: `{\n  "phone_number": "+12125557890"\n}`,
    example_res: `{\n  "id": "12345-telnyx-id",\n  "phone_number": "+12125557890",\n  "country": "US",\n  "monthly_price_usd": 2.50,\n  "status": "active",\n  "created_at": "2026-07-25T12:00:00Z"\n}`,
  },
  {
    method: 'GET', path: '/v1/numbers', category: 'Numbers',
    desc: 'List all virtual numbers you currently own via the API.',
    params: [
      { name: 'limit',  type: 'integer', req: false, desc: 'Max results (1–200). Default: 50' },
      { name: 'offset', type: 'integer', req: false, desc: 'Pagination offset. Default: 0' },
    ],
    example_req: null,
    example_res: `{\n  "numbers": [ { "phone_number": "+12125557890", "country": "US", "active": true } ],\n  "total": 1,\n  "limit": 50,\n  "offset": 0\n}`,
  },
  {
    method: 'DELETE', path: '/v1/numbers/{phone_number}', category: 'Numbers',
    desc: 'Release a virtual number immediately. No refund for partial months.',
    params: [
      { name: 'phone_number', type: 'path', req: true, desc: 'E.164 number, URL-encoded. e.g. %2B12125557890' },
    ],
    example_req: null,
    example_res: `{\n  "ok": true,\n  "phone_number": "+12125557890",\n  "status": "released"\n}`,
  },
  {
    method: 'POST', path: '/v1/sms/send', category: 'SMS',
    desc: 'Send an outbound SMS. Cost: $0.012 per 160-char segment. Deducted from your wallet.',
    params: [],
    example_req: `{\n  "from_number": "+12125557890",\n  "to": "+19175550001",\n  "text": "Hello from Calliotel!"\n}`,
    example_res: `{\n  "message_id": "msg_01JZX...",\n  "from": "+12125557890",\n  "to": "+19175550001",\n  "segments": 1,\n  "cost_usd": 0.012,\n  "status": "queued"\n}`,
  },
  {
    method: 'POST', path: '/v1/webhooks', category: 'Webhooks',
    desc: 'Set your inbound SMS webhook URL. We POST to this URL when you receive a message.',
    params: [],
    example_req: `{\n  "url": "https://yourapp.com/sms-hook"\n}`,
    example_res: `{\n  "ok": true,\n  "webhook_url": "https://yourapp.com/sms-hook"\n}`,
  },
  {
    method: 'GET', path: '/v1/webhooks', category: 'Webhooks',
    desc: 'Get your currently configured inbound SMS webhook URL.',
    params: [],
    example_req: null,
    example_res: `{\n  "webhook_url": "https://yourapp.com/sms-hook"\n}`,
  },
  {
    method: 'GET', path: '/v1/usage', category: 'Usage',
    desc: 'Get recent API calls, wallet charges, and current balance.',
    params: [
      { name: 'limit', type: 'integer', req: false, desc: 'Number of log entries (max 200). Default: 50' },
    ],
    example_req: null,
    example_res: `{\n  "balance_usd": 24.50,\n  "recent_requests": [ { "endpoint": "POST /v1/sms/send", "status": 201, "ts": "..." } ],\n  "recent_charges": [ { "amount": -0.012, "description": "API v1: SMS ...", "ts": "..." } ]\n}`,
  },
];

const PRICING = [
  { country: '🇺🇸 United States',   code: 'US', price: '$2.50/mo', sms: true,  voice: true },
  { country: '🇨🇦 Canada',          code: 'CA', price: '$2.50/mo', sms: true,  voice: true },
  { country: '🇬🇧 United Kingdom',  code: 'GB', price: '$2.50/mo', sms: true,  voice: true },
  { country: '🇳🇱 Netherlands',     code: 'NL', price: '$2.50/mo', sms: true,  voice: true },
  { country: '🇦🇺 Australia',       code: 'AU', price: '$8.50/mo', sms: true,  voice: true },
  { country: '🇸🇪 Sweden',          code: 'SE', price: '$12.00/mo',sms: false, voice: true },
  { country: '🇵🇷 Puerto Rico',     code: 'PR', price: '$5.00/mo', sms: true,  voice: true },
];

const CODE_SAMPLES = {
  curl: `# Get your balance
curl https://calliotel.com/v1/balance \\
  -H "Authorization: Bearer ct_live_YOUR_KEY"

# Search US numbers
curl "https://calliotel.com/v1/numbers/search?country=US&limit=5" \\
  -H "Authorization: Bearer ct_live_YOUR_KEY"

# Buy a number
curl -X POST https://calliotel.com/v1/numbers/buy \\
  -H "Authorization: Bearer ct_live_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"phone_number": "+12125557890"}'

# Send SMS
curl -X POST https://calliotel.com/v1/sms/send \\
  -H "Authorization: Bearer ct_live_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"from_number":"+12125557890","to":"+19175550001","text":"Hello!"}'`,

  python: `import requests

BASE = "https://calliotel.com/v1"
KEY  = "ct_live_YOUR_KEY"
H    = {"Authorization": f"Bearer {KEY}"}

# Get balance
balance = requests.get(f"{BASE}/balance", headers=H).json()
print(f"Balance: ${balance['balance']}")

# Search available numbers
numbers = requests.get(f"{BASE}/numbers/search", headers=H,
                       params={"country": "US", "limit": 5}).json()

# Buy the first available number
phone = numbers["numbers"][0]["number"]
result = requests.post(f"{BASE}/numbers/buy", headers=H,
                       json={"phone_number": phone}).json()
print(f"Purchased: {result['phone_number']}")

# Set webhook for inbound SMS
requests.post(f"{BASE}/webhooks", headers=H,
              json={"url": "https://yourapp.com/sms-hook"})

# Send an SMS
sms = requests.post(f"{BASE}/sms/send", headers=H, json={
    "from_number": phone,
    "to": "+19175550001",
    "text": "Hello from Calliotel API!"
}).json()
print(f"Message ID: {sms['message_id']}")`,

  node: `const BASE = "https://calliotel.com/v1";
const KEY  = "ct_live_YOUR_KEY";
const h    = { "Authorization": \`Bearer \${KEY}\`, "Content-Type": "application/json" };

const api = (path, opts = {}) =>
  fetch(\`\${BASE}\${path}\`, { headers: h, ...opts }).then(r => r.json());

// Get balance
const { balance } = await api("/balance");
console.log("Balance:", balance);

// Search numbers
const { numbers } = await api("/numbers/search?country=US&limit=5");
const phone = numbers[0].number;

// Buy a number
const num = await api("/numbers/buy", {
  method: "POST",
  body: JSON.stringify({ phone_number: phone }),
});
console.log("Purchased:", num.phone_number);

// Set webhook for inbound SMS
await api("/webhooks", {
  method: "POST",
  body: JSON.stringify({ url: "https://yourapp.com/sms-hook" }),
});

// Send SMS
const sms = await api("/sms/send", {
  method: "POST",
  body: JSON.stringify({ from_number: phone, to: "+19175550001", text: "Hello!" }),
});
console.log("Message ID:", sms.message_id);`,

  php: `<?php
$base = "https://calliotel.com/v1";
$key  = "ct_live_YOUR_KEY";

function calliotel($method, $path, $body = null) {
  global $base, $key;
  $ch = curl_init("$base$path");
  curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => [
      "Authorization: Bearer $key",
      "Content-Type: application/json",
    ],
    CURLOPT_CUSTOMREQUEST => $method,
    CURLOPT_POSTFIELDS => $body ? json_encode($body) : null,
  ]);
  $resp = curl_exec($ch);
  curl_close($ch);
  return json_decode($resp, true);
}

// Get balance
$bal = calliotel("GET", "/balance");
echo "Balance: $" . $bal['balance'] . "\\n";

// Search numbers
$nums = calliotel("GET", "/numbers/search?country=US&limit=5");
$phone = $nums['numbers'][0]['number'];

// Buy a number
$result = calliotel("POST", "/numbers/buy", ["phone_number" => $phone]);
echo "Purchased: " . $result['phone_number'] . "\\n";`,
};

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button onClick={copy} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:bg-white/10 text-gray-400 hover:text-white">
      {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
}

const METHOD_COLORS = {
  GET: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  POST: 'bg-green-500/20 text-green-300 border-green-500/30',
  DELETE: 'bg-red-500/20 text-red-300 border-red-500/30',
  PUT: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
};

function EndpointCard({ ep }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-[#30363d] rounded-xl overflow-hidden mb-3">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-5 py-4 bg-[#1c2333] hover:bg-[#222c3f] transition-colors text-left">
        <span className={`text-[11px] font-bold px-2 py-0.5 rounded border font-mono ${METHOD_COLORS[ep.method] || 'bg-gray-700 text-gray-300'}`}>{ep.method}</span>
        <code className="text-sm text-[#e6edf3] font-mono flex-1">{ep.path}</code>
        <span className="text-xs text-[#8b949e]">{ep.desc.slice(0, 50)}…</span>
        {open ? <ChevronDown className="w-4 h-4 text-[#8b949e] flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-[#8b949e] flex-shrink-0" />}
      </button>
      {open && (
        <div className="px-5 py-5 bg-[#161b22] border-t border-[#30363d] space-y-4">
          <p className="text-sm text-[#8b949e]">{ep.desc}</p>
          {ep.params.length > 0 && (
            <div>
              <div className="text-[11px] uppercase tracking-wider text-[#8b949e] font-bold mb-2">Parameters</div>
              <div className="rounded-lg border border-[#30363d] overflow-hidden">
                {ep.params.map((p, i) => (
                  <div key={p.name} className={`flex items-start gap-4 px-4 py-3 text-sm ${i > 0 ? 'border-t border-[#30363d]' : ''}`}>
                    <code className="text-yellow-400 font-mono w-32 flex-shrink-0">{p.name}</code>
                    <span className="text-[#8b949e] w-16 flex-shrink-0 text-xs">{p.type}</span>
                    <span className={`text-[10px] px-1.5 rounded font-bold flex-shrink-0 ${p.req ? 'bg-red-500/20 text-red-400' : 'bg-gray-700 text-gray-400'}`}>{p.req ? 'required' : 'optional'}</span>
                    <span className="text-[#8b949e] text-xs">{p.desc}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {ep.example_req && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-[11px] uppercase tracking-wider text-[#8b949e] font-bold">Request Body</div>
                  <CopyButton text={ep.example_req} />
                </div>
                <pre className="bg-[#0d1117] border border-[#30363d] rounded-lg px-4 py-3 text-xs text-green-300 overflow-x-auto font-mono">{ep.example_req}</pre>
              </div>
            )}
            {ep.example_res && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-[11px] uppercase tracking-wider text-[#8b949e] font-bold">Response</div>
                  <CopyButton text={ep.example_res} />
                </div>
                <pre className="bg-[#0d1117] border border-[#30363d] rounded-lg px-4 py-3 text-xs text-blue-200 overflow-x-auto font-mono">{ep.example_res}</pre>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function DeveloperPage() {
  const navigate = useNavigate();
  const [codeLang, setCodeLang] = useState('curl');
  const [docSection, setDocSection] = useState('quickstart');

  const categories = [...new Set(ENDPOINTS.map(e => e.category))];

  return (
    <div className="min-h-screen bg-[#0d1117] text-[#e6edf3]">

      {/* ─── HERO ────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden border-b border-[#30363d]">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] opacity-30 blur-3xl rounded-full" style={{ background: `radial-gradient(ellipse, ${YELLOW}55 0%, transparent 70%)` }} />
        </div>
        <div className="max-w-6xl mx-auto px-6 py-20 relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[#f5c518]/30 bg-[#f5c518]/10 text-xs font-semibold mb-6" style={{ color: YELLOW }}>
            <Zap className="w-3.5 h-3.5" /> Now Available
          </div>
          <h1 className="text-5xl md:text-6xl font-black mb-5 leading-tight">
            Build with<br />
            <span style={{ color: YELLOW }}>Calliotel API</span>
          </h1>
          <p className="text-xl text-[#8b949e] max-w-2xl mb-8">
            The same virtual number infrastructure that powers calliotel.com — now as a REST API.
            Get real phone numbers, send & receive SMS, set webhooks. Go live in minutes.
          </p>
          <div className="flex flex-wrap gap-3">
            <button onClick={() => navigate('/dashboard')} className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-black text-sm transition-all hover:opacity-90" style={{ background: YELLOW }}>
              Get API Key <ArrowRight className="w-4 h-4" />
            </button>
            <button onClick={() => setDocSection('reference')} className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm border border-[#30363d] text-[#e6edf3] hover:bg-white/5 transition-all">
              <BookOpen className="w-4 h-4" /> Browse Reference
            </button>
          </div>

          {/* Quick stat pills */}
          <div className="flex flex-wrap gap-4 mt-10 text-sm">
            {[
              ['🔑', 'REST API', 'JSON over HTTPS'],
              ['📍', '7 Countries', 'US · CA · GB · NL · AU · SE · PR'],
              ['💬', 'SMS & Voice', 'Inbound + Outbound'],
              ['⚡', 'Instant', 'Numbers provisioned in seconds'],
              ['💰', 'Pay-as-you-go', 'Top up wallet, no subscription'],
            ].map(([emoji, title, desc]) => (
              <div key={title} className="flex items-center gap-2 bg-[#1c2333] border border-[#30363d] rounded-full px-4 py-2">
                <span>{emoji}</span>
                <span className="font-semibold">{title}</span>
                <span className="text-[#8b949e] text-xs hidden md:block">— {desc}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-12">

        {/* ─── FEATURES ──────────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-16">
          {[
            { icon: Phone,      title: 'Virtual Numbers',  color: '#f5c518', desc: 'Buy real phone numbers in 7 countries. US/CA/GB/NL from just $2.50/mo. Provisioned instantly via Telnyx.' },
            { icon: MessageSquare, title: 'SMS Messaging', color: '#F5A623', desc: 'Send outbound SMS at $0.012/segment. Receive inbound SMS via webhook delivery to your server.' },
            { icon: Webhook,    title: 'Webhooks',         color: '#8b5cf6', desc: 'Set one HTTPS endpoint. We POST inbound messages to you in real-time — no polling needed.' },
            { icon: Shield,     title: 'API Key Auth',     color: '#10b981', desc: 'Bearer token authentication with ct_live_xxx keys. Create up to 5 keys per account. Revoke anytime.' },
            { icon: DollarSign, title: 'Wallet Billing',   color: '#f59e0b', desc: 'Pre-fund your wallet via card or crypto. All API charges deduct instantly — no surprise invoices.' },
            { icon: Globe,      title: 'Global Coverage',  color: '#ef4444', desc: '7 countries with SMS capability today. More coming soon — SE, PL, ZA, TH and beyond.' },
          ].map(f => (
            <div key={f.title} className="bg-[#1c2333] border border-[#30363d] rounded-xl p-5">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: f.color + '22' }}>
                <f.icon className="w-5 h-5" style={{ color: f.color }} />
              </div>
              <h3 className="font-bold mb-1">{f.title}</h3>
              <p className="text-sm text-[#8b949e]">{f.desc}</p>
            </div>
          ))}
        </div>

        {/* ─── DOCS NAV ─────────────────────────────────────────── */}
        <div className="flex gap-1 bg-[#161b22] rounded-xl p-1 mb-8 border border-[#30363d] w-fit">
          {[
            ['quickstart','⚡ Quickstart'],
            ['auth','🔑 Authentication'],
            ['reference','📖 API Reference'],
            ['pricing','💰 Pricing'],
            ['webhooks','🔗 Webhooks'],
            ['errors','⚠ Errors'],
          ].map(([id, label]) => (
            <button key={id} onClick={() => setDocSection(id)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${docSection === id ? 'text-black' : 'text-[#8b949e] hover:text-[#e6edf3]'}`}
              style={docSection === id ? { background: YELLOW } : {}}>
              {label}
            </button>
          ))}
        </div>

        {/* ─── QUICKSTART ───────────────────────────────────────── */}
        {docSection === 'quickstart' && (
          <div className="space-y-8">
            <div>
              <h2 className="text-2xl font-bold mb-2">Quickstart</h2>
              <p className="text-[#8b949e]">Go from zero to a working virtual number in under 5 minutes.</p>
            </div>

            {[
              { step: '01', title: 'Create an account & get an API key',
                body: <>
                  <a href="/signup" className="underline" style={{ color: YELLOW }}>Sign up for Calliotel</a>{' '}
                  (free). Then go to{' '}
                  <a href="/dashboard" className="underline" style={{ color: YELLOW }}>Dashboard → Developer API</a>{' '}
                  and create your first API key. It looks like <code className="text-yellow-400 bg-black/30 px-1 rounded">ct_live_xxxxxxxxxxxxxxxx</code>.
                </> },
              { step: '02', title: 'Add credit to your wallet',
                body: <>
                  Go to <a href="/add-funds" className="underline" style={{ color: YELLOW }}>Add Funds</a> and top up via card or crypto.
                  US numbers cost $2.50/mo. You only pay for what you use — no monthly fee.
                </> },
              { step: '03', title: 'Search & buy a number',
                body: <code className="block bg-[#0d1117] border border-[#30363d] rounded-lg px-4 py-3 text-sm text-green-300 font-mono whitespace-pre">{`curl "https://calliotel.com/v1/numbers/search?country=US&limit=5" \\
  -H "Authorization: Bearer ct_live_YOUR_KEY"

# Then buy one:
curl -X POST https://calliotel.com/v1/numbers/buy \\
  -H "Authorization: Bearer ct_live_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"phone_number": "+12125557890"}'`}</code> },
              { step: '04', title: 'Set your webhook for inbound SMS',
                body: <code className="block bg-[#0d1117] border border-[#30363d] rounded-lg px-4 py-3 text-sm text-green-300 font-mono whitespace-pre">{`curl -X POST https://calliotel.com/v1/webhooks \\
  -H "Authorization: Bearer ct_live_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"url": "https://yourapp.com/sms-hook"}'`}</code> },
              { step: '05', title: 'Receive inbound SMS',
                body: <>
                  <p className="text-[#8b949e] mb-3">When a message arrives on your number, we POST this to your webhook:</p>
                  <pre className="bg-[#0d1117] border border-[#30363d] rounded-lg px-4 py-3 text-sm text-blue-200 font-mono">{`{\n  "event": "sms.received",\n  "to": "+12125557890",\n  "from": "+19175550001",\n  "text": "Hello!",\n  "received_at": "2026-07-25T12:00:00Z"\n}`}</pre>
                </> },
            ].map(({ step, title, body }) => (
              <div key={step} className="flex gap-6">
                <div className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-sm font-black text-black" style={{ background: YELLOW }}>{step}</div>
                <div className="flex-1 pb-8 border-b border-[#30363d] last:border-0">
                  <h3 className="font-bold text-lg mb-3">{title}</h3>
                  <div className="text-[#8b949e] text-sm">{body}</div>
                </div>
              </div>
            ))}

            {/* Code samples */}
            <div>
              <h3 className="text-lg font-bold mb-4">Full Code Example</h3>
              <div className="bg-[#161b22] border border-[#30363d] rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-[#30363d]">
                  <div className="flex gap-1">
                    {['curl', 'python', 'node', 'php'].map(lang => (
                      <button key={lang} onClick={() => setCodeLang(lang)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${codeLang === lang ? 'text-black font-bold' : 'text-[#8b949e] hover:text-white'}`}
                        style={codeLang === lang ? { background: YELLOW } : {}}>
                        {lang === 'curl' ? 'cURL' : lang === 'node' ? 'Node.js' : lang === 'python' ? 'Python' : 'PHP'}
                      </button>
                    ))}
                  </div>
                  <CopyButton text={CODE_SAMPLES[codeLang]} />
                </div>
                <pre className="px-5 py-5 text-sm text-green-200 font-mono overflow-x-auto leading-relaxed">{CODE_SAMPLES[codeLang]}</pre>
              </div>
            </div>
          </div>
        )}

        {/* ─── AUTH ─────────────────────────────────────────────── */}
        {docSection === 'auth' && (
          <div className="space-y-6 max-w-3xl">
            <h2 className="text-2xl font-bold">Authentication</h2>
            <p className="text-[#8b949e]">All API requests must be authenticated using an API key passed as a Bearer token in the <code className="text-yellow-400 bg-black/20 px-1 rounded">Authorization</code> header.</p>

            <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-5 space-y-4">
              <h3 className="font-bold">Authorization Header</h3>
              <pre className="bg-[#0d1117] rounded-lg px-4 py-3 text-sm text-green-300 font-mono">Authorization: Bearer ct_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx</pre>
              <p className="text-sm text-[#8b949e]">Replace <code className="text-yellow-400">ct_live_xxx…</code> with your actual API key from the Developer dashboard.</p>
            </div>

            <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-5">
              <h3 className="font-bold mb-3">Key Types</h3>
              <div className="space-y-3 text-sm">
                <div className="flex items-start gap-3">
                  <code className="text-yellow-400 bg-black/30 px-2 py-1 rounded font-mono text-xs whitespace-nowrap">ct_live_xxx</code>
                  <span className="text-[#8b949e]">Live key — charges real money, provisions real numbers on the Telnyx network.</span>
                </div>
                <div className="flex items-start gap-3">
                  <code className="text-blue-400 bg-black/30 px-2 py-1 rounded font-mono text-xs whitespace-nowrap">ct_test_xxx</code>
                  <span className="text-[#8b949e]">Test key — API responds correctly but no real Telnyx charges are made. Great for development.</span>
                </div>
              </div>
            </div>

            <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-5">
              <h3 className="font-bold mb-3">Error Responses</h3>
              <div className="space-y-2 text-sm">
                {[
                  [401, 'Missing or invalid API key'],
                  [402, 'Insufficient wallet balance'],
                  [403, 'You do not own this resource'],
                  [404, 'Resource not found'],
                  [429, 'Rate limit exceeded (100 req/min)'],
                  [502, 'Upstream provider error (Telnyx)'],
                ].map(([code, msg]) => (
                  <div key={code} className="flex items-center gap-3">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded font-mono ${code < 500 ? 'bg-amber-500/20 text-amber-400' : 'bg-red-500/20 text-red-400'}`}>{code}</span>
                    <span className="text-[#8b949e]">{msg}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ─── REFERENCE ────────────────────────────────────────── */}
        {docSection === 'reference' && (
          <div>
            <h2 className="text-2xl font-bold mb-2">API Reference</h2>
            <p className="text-[#8b949e] mb-6">Base URL: <code className="text-yellow-400">https://calliotel.com/v1</code> — All requests require <code className="text-yellow-400">Authorization: Bearer ct_live_xxx</code></p>
            {categories.map(cat => (
              <div key={cat} className="mb-8">
                <h3 className="text-sm font-bold uppercase tracking-wider text-[#8b949e] mb-3">{cat}</h3>
                {ENDPOINTS.filter(e => e.category === cat).map(ep => (
                  <EndpointCard key={ep.method + ep.path} ep={ep} />
                ))}
              </div>
            ))}
          </div>
        )}

        {/* ─── PRICING ──────────────────────────────────────────── */}
        {docSection === 'pricing' && (
          <div className="space-y-8 max-w-4xl">
            <div>
              <h2 className="text-2xl font-bold mb-2">API Pricing</h2>
              <p className="text-[#8b949e]">No subscription. No monthly fee. Top up your wallet and pay only for what you use.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              {[
                { label: 'Account Fee', value: '$0', desc: 'Free to sign up and create API keys' },
                { label: 'SMS Outbound', value: '$0.012', desc: 'Per 160-char segment. 161–320 chars = 2 segments.' },
                { label: 'SMS Inbound', value: 'Free', desc: 'Receive messages at no charge' },
              ].map(p => (
                <div key={p.label} className="bg-[#1c2333] border border-[#30363d] rounded-xl p-5 text-center">
                  <div className="text-3xl font-black mb-1" style={{ color: YELLOW }}>{p.value}</div>
                  <div className="font-bold mb-1">{p.label}</div>
                  <div className="text-xs text-[#8b949e]">{p.desc}</div>
                </div>
              ))}
            </div>

            <div className="bg-[#1c2333] border border-[#30363d] rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-[#30363d]">
                <h3 className="font-bold">Virtual Numbers — Monthly Pricing</h3>
                <p className="text-xs text-[#8b949e] mt-1">Billed from your wallet on purchase. Renews monthly until you release the number.</p>
              </div>
              <table className="w-full">
                <thead>
                  <tr className="text-[11px] uppercase text-[#8b949e] border-b border-[#30363d]">
                    <th className="text-left px-5 py-3">Country</th>
                    <th className="text-center px-5 py-3">Code</th>
                    <th className="text-center px-5 py-3">SMS</th>
                    <th className="text-center px-5 py-3">Voice</th>
                    <th className="text-right px-5 py-3">Monthly Price</th>
                  </tr>
                </thead>
                <tbody>
                  {PRICING.map((p, i) => (
                    <tr key={p.code} className={`${i > 0 ? 'border-t border-[#30363d]' : ''} hover:bg-white/[0.02]`}>
                      <td className="px-5 py-3 font-medium">{p.country}</td>
                      <td className="px-5 py-3 text-center font-mono text-[#8b949e] text-sm">{p.code}</td>
                      <td className="px-5 py-3 text-center">{p.sms ? '✅' : '—'}</td>
                      <td className="px-5 py-3 text-center">{p.voice ? '✅' : '—'}</td>
                      <td className="px-5 py-3 text-right font-bold" style={{ color: YELLOW }}>{p.price}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ─── WEBHOOKS ─────────────────────────────────────────── */}
        {docSection === 'webhooks' && (
          <div className="space-y-6 max-w-3xl">
            <h2 className="text-2xl font-bold">Inbound SMS Webhooks</h2>
            <p className="text-[#8b949e]">When a message arrives on any of your virtual numbers, Calliotel sends a POST request to your configured webhook URL.</p>

            <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-5 space-y-4">
              <h3 className="font-bold">Setup</h3>
              <pre className="bg-[#0d1117] rounded-lg px-4 py-3 text-sm text-green-300 font-mono">{`POST https://calliotel.com/v1/webhooks
Authorization: Bearer ct_live_YOUR_KEY
Content-Type: application/json

{ "url": "https://yourapp.com/sms-hook" }`}</pre>
              <p className="text-sm text-[#8b949e]">Your webhook URL must use <strong className="text-white">HTTPS</strong> and must return HTTP 2xx within <strong className="text-white">10 seconds</strong>.</p>
            </div>

            <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-5 space-y-4">
              <h3 className="font-bold">Webhook Payload</h3>
              <pre className="bg-[#0d1117] rounded-lg px-4 py-3 text-sm text-blue-200 font-mono">{`{\n  "event": "sms.received",\n  "to": "+12125550000",\n  "from": "+19175550001",\n  "text": "Your OTP is 482901",\n  "received_at": "2026-07-25T12:00:00Z"\n}`}</pre>
            </div>

            <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-5">
              <h3 className="font-bold mb-3">Example Receiver (Node.js / Express)</h3>
              <pre className="bg-[#0d1117] rounded-lg px-4 py-3 text-sm text-green-300 font-mono overflow-x-auto">{`const express = require('express');
const app = express();
app.use(express.json());

app.post('/sms-hook', (req, res) => {
  const { event, to, from, text } = req.body;
  if (event === 'sms.received') {
    console.log(\`SMS to \${to} from \${from}: \${text}\`);
    // Your logic here — OTP extraction, auto-reply, etc.
  }
  res.json({ ok: true }); // must return 2xx
});

app.listen(3000);`}</pre>
            </div>
          </div>
        )}

        {/* ─── ERRORS ───────────────────────────────────────────── */}
        {docSection === 'errors' && (
          <div className="space-y-6 max-w-3xl">
            <h2 className="text-2xl font-bold">Error Codes</h2>
            <p className="text-[#8b949e]">All errors return JSON with a <code className="text-yellow-400">detail</code> field describing the problem.</p>
            <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-5">
              <h3 className="font-bold mb-3">Error Response Format</h3>
              <pre className="bg-[#0d1117] rounded-lg px-4 py-3 text-sm text-red-300 font-mono">{`{\n  "detail": "Insufficient balance. Have $1.00, need $2.50"\n}`}</pre>
            </div>

            <div className="bg-[#161b22] border border-[#30363d] rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[11px] uppercase text-[#8b949e] border-b border-[#30363d]">
                    <th className="text-left px-5 py-3">Status</th>
                    <th className="text-left px-5 py-3">Meaning</th>
                    <th className="text-left px-5 py-3">Common Cause</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    [200, 'OK', 'Request succeeded'],
                    [201, 'Created', 'Resource was created (number bought, SMS sent)'],
                    [400, 'Bad Request', 'Invalid parameters — check the detail message'],
                    [401, 'Unauthorized', 'Missing, invalid, or revoked API key'],
                    [402, 'Payment Required', 'Wallet balance too low — top up first'],
                    [403, 'Forbidden', 'You don\'t own this number or resource'],
                    [404, 'Not Found', 'Number or resource does not exist'],
                    [429, 'Too Many Requests', 'Exceeded 100 req/min rate limit'],
                    [502, 'Bad Gateway', 'Telnyx upstream error — retry after a moment'],
                  ].map(([code, name, cause], i) => (
                    <tr key={code} className={`${i > 0 ? 'border-t border-[#30363d]' : ''} hover:bg-white/[0.02]`}>
                      <td className="px-5 py-3">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded font-mono ${code >= 500 ? 'bg-red-500/20 text-red-400' : code >= 400 ? 'bg-amber-500/20 text-amber-400' : 'bg-green-500/20 text-green-400'}`}>{code}</span>
                      </td>
                      <td className="px-5 py-3 font-semibold">{name}</td>
                      <td className="px-5 py-3 text-[#8b949e]">{cause}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ─── CTA ──────────────────────────────────────────────── */}
        <div className="mt-20 rounded-2xl border border-[#f5c518]/30 p-10 text-center" style={{ background: 'rgba(245,197,24,0.04)' }}>
          <div className="text-4xl mb-4">🚀</div>
          <h2 className="text-3xl font-black mb-3">Ready to build?</h2>
          <p className="text-[#8b949e] mb-6 max-w-xl mx-auto">Create a free account, get your API key, add $5 to your wallet, and you have a working phone number in under 5 minutes.</p>
          <div className="flex justify-center gap-3">
            <button onClick={() => navigate('/signup')} className="flex items-center gap-2 px-8 py-3 rounded-xl font-bold text-black text-sm transition-all hover:opacity-90" style={{ background: YELLOW }}>
              Get Started Free <ArrowRight className="w-4 h-4" />
            </button>
            <button onClick={() => navigate('/dashboard')} className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm border border-[#30363d] text-[#e6edf3] hover:bg-white/5 transition-all">
              <Key className="w-4 h-4" /> Go to Dashboard
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
