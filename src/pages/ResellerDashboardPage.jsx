import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { useToast } from '../hooks/use-toast';
import safeLocalStorage from '../utils/safeLocalStorage';
import {
  TrendingUp, Users, Wallet, Plus, DollarSign, Tag, Sparkles,
  ChevronLeft, Copy, Check, Loader2, Image as ImageIcon, Trash2, Upload,
  Activity, Gift, X,
} from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';
const API = `${BACKEND_URL}/api`;

const TIERS = [
  { value: 1.5, label: '1.5x', subtitle: 'Volume play', desc: 'Sell more at thin margin' },
  { value: 2.0, label: '2x',   subtitle: 'Sweet spot', desc: 'Doubles your money — recommended' },
  { value: 3.0, label: '3x',   subtitle: 'Premium',    desc: 'Maximum profit per customer' },
];

export default function ResellerDashboardPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [showJoin, setShowJoin] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [showFund, setShowFund] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoUrl, setLogoUrl] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [promos, setPromos] = useState([]);
  const [showNewPromo, setShowNewPromo] = useState(false);
  const [showRedeem, setShowRedeem] = useState(null);
  const [showKycForm, setShowKycForm] = useState(false);
  const [kycSubmitting, setKycSubmitting] = useState(false);
  const [kycFullName, setKycFullName] = useState('');
  const [kycIdType, setKycIdType] = useState('Passport');
  const [kycIdFile, setKycIdFile] = useState(null);
  const [kycSelfieFile, setKycSelfieFile] = useState(null);
  const [newPromoCode,  setNewPromoCode]  = useState('');
  const [newPromoBonus, setNewPromoBonus] = useState('5');
  const [newPromoMax,   setNewPromoMax]   = useState('0');
  const [redeemCode,    setRedeemCode]    = useState('');

  const [joinName, setJoinName]     = useState('');
  const [newEmail, setNewEmail]     = useState('');
  const [newPass,  setNewPass]      = useState('');
  const [newDName, setNewDName]     = useState('');
  const [fundAmt,  setFundAmt]      = useState('10');

  const headers = () => ({
    Authorization: `Bearer ${safeLocalStorage.getItem('token')}`,
  });

  const loadAll = async () => {
    try {
      const meResp = await axios.get(`${API}/reseller/me`, { headers: headers() });
      setMe(meResp.data);
      if (meResp.data.is_reseller) {
        const [c, t, p] = await Promise.all([
          axios.get(`${API}/reseller/customers`,    { headers: headers() }),
          axios.get(`${API}/reseller/transactions`, { headers: headers() }),
          axios.get(`${API}/reseller/promo-codes`,  { headers: headers() }),
        ]);
        setCustomers(c.data.customers || []);
        setTransactions(t.data.transactions || []);
        setPromos(p.data.promo_codes || []);
        setLogoUrl(meResp.data.logo_url || null);
      }
    } catch (e) {
      console.error(e);
      toast({ title: 'Error', description: 'Could not load reseller status', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); /* eslint-disable-next-line */ }, []);

  const handleBecome = async () => {
    if (joinName.trim().length < 2) {
      toast({ title: 'Pick a brand name', description: 'Min 2 characters', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      const r = await axios.post(`${API}/reseller/become`, { display_name: joinName.trim() }, { headers: headers() });
      toast({
        title: '📝 Application submitted',
        description: r?.data?.message || 'An admin will review within 24h.',
      });
      setShowJoin(false);
      await loadAll();
    } catch (e) {
      toast({ title: 'Failed', description: e?.response?.data?.detail || 'Try again', variant: 'destructive' });
    } finally { setSubmitting(false); }
  };

  const handleSetTier = async (tier) => {
    try {
      await axios.put(`${API}/reseller/markup-tier`, { tier }, { headers: headers() });
      setMe({ ...me, markup_tier: tier });
      toast({ title: `Markup set to ${tier}x` });
    } catch (e) {
      toast({ title: 'Failed', variant: 'destructive' });
    }
  };

  const handleAddCustomer = async () => {
    if (!newEmail || !newPass || newPass.length < 6) {
      toast({ title: 'Email + password (6+ chars) required', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      await axios.post(`${API}/reseller/customers`,
        { email: newEmail, password: newPass, display_name: newDName || undefined },
        { headers: headers() });
      toast({ title: '✅ Customer created', description: `Send them: calliotel.com/login` });
      setShowAdd(false);
      setNewEmail(''); setNewPass(''); setNewDName('');
      await loadAll();
    } catch (e) {
      toast({ title: 'Failed', description: e?.response?.data?.detail || 'Try again', variant: 'destructive' });
    } finally { setSubmitting(false); }
  };

  const handleFund = async () => {
    const amt = parseFloat(fundAmt);
    if (!amt || amt <= 0) {
      toast({ title: 'Enter a valid amount', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      const r = await axios.post(`${API}/reseller/customers/${encodeURIComponent(showFund.email)}/fund`,
        { amount_usd: amt }, { headers: headers() });
      toast({
        title: `✅ Sent $${r.data.amount_funded_to_customer} to ${showFund.email}`,
        description: `Cost you $${r.data.your_wholesale_cost} • Suggested retail: $${r.data.suggested_retail_to_charge_customer}`,
      });
      setShowFund(null);
      setFundAmt('10');
      await loadAll();
    } catch (e) {
      toast({ title: 'Failed', description: e?.response?.data?.detail || 'Try again', variant: 'destructive' });
    } finally { setSubmitting(false); }
  };

  const handleLogoUpload = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (f.size > 150 * 1024) {
      toast({ title: 'Logo too large', description: `Max 150KB. Yours is ${(f.size/1024).toFixed(0)}KB — try compressing at tinypng.com`, variant: 'destructive' });
      return;
    }
    setLogoUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', f);
      const r = await axios.post(`${API}/reseller/branding/logo`, fd, {
        headers: { ...headers(), 'Content-Type': 'multipart/form-data' },
      });
      setLogoUrl(r.data.logo_url);
      toast({ title: '🎨 Logo uploaded', description: 'Your sub-accounts will see this on login.' });
    } catch (err) {
      toast({ title: 'Upload failed', description: err?.response?.data?.detail || 'Try a smaller file', variant: 'destructive' });
    } finally { setLogoUploading(false); }
  };

  const handleLogoDelete = async () => {
    if (!window.confirm('Remove your brand logo? Sub-accounts will see your text name only.')) return;
    setLogoUploading(true);
    try {
      await axios.delete(`${API}/reseller/branding/logo`, { headers: headers() });
      setLogoUrl(null);
      toast({ title: 'Logo removed' });
    } catch (err) {
      toast({ title: 'Failed', variant: 'destructive' });
    } finally { setLogoUploading(false); }
  };

  const handleCreatePromo = async () => {
    const code = newPromoCode.trim().toUpperCase();
    const bonus = parseFloat(newPromoBonus);
    const max = parseInt(newPromoMax, 10) || 0;
    if (!/^[A-Z0-9_-]{3,20}$/.test(code)) {
      toast({ title: 'Invalid code', description: 'Use 3–20 letters/digits/_/-', variant: 'destructive' });
      return;
    }
    if (!bonus || bonus <= 0) {
      toast({ title: 'Bonus must be > $0', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      await axios.post(`${API}/reseller/promo-codes`,
        { code, bonus_usd: bonus, max_uses: max },
        { headers: headers() });
      toast({ title: `🎁 Promo "${code}" created` });
      setShowNewPromo(false);
      setNewPromoCode(''); setNewPromoBonus('5'); setNewPromoMax('0');
      await loadAll();
    } catch (e) {
      toast({ title: 'Failed', description: e?.response?.data?.detail || 'Try again', variant: 'destructive' });
    } finally { setSubmitting(false); }
  };

  const fileToBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const handleKycSubmit = async () => {
    if (!kycFullName.trim() || kycFullName.trim().length < 2) {
      toast({ title: 'Enter your full legal name', variant: 'destructive' }); return;
    }
    if (!kycIdFile) {
      toast({ title: 'Upload your government ID photo', variant: 'destructive' }); return;
    }
    if (!kycSelfieFile) {
      toast({ title: 'Upload your selfie photo holding the ID', variant: 'destructive' }); return;
    }
    if (kycIdFile.size > 2 * 1024 * 1024) {
      toast({ title: 'ID photo too large', description: 'Max 2MB. Compress at tinypng.com', variant: 'destructive' }); return;
    }
    if (kycSelfieFile.size > 2 * 1024 * 1024) {
      toast({ title: 'Selfie too large', description: 'Max 2MB. Compress at tinypng.com', variant: 'destructive' }); return;
    }
    setKycSubmitting(true);
    try {
      const [idB64, selfieB64] = await Promise.all([fileToBase64(kycIdFile), fileToBase64(kycSelfieFile)]);
      await axios.post(`${API}/reseller/kyc/submit`, {
        full_name: kycFullName.trim(),
        id_type: kycIdType,
        id_image_b64: idB64,
        selfie_b64: selfieB64,
      }, { headers: headers() });
      toast({ title: '📋 Documents submitted!', description: "We'll verify within 24h and email you." });
      setShowKycForm(false);
      await loadAll();
    } catch (e) {
      toast({ title: 'Submission failed', description: e?.response?.data?.detail || 'Try again', variant: 'destructive' });
    } finally { setKycSubmitting(false); }
  };

  const handleDeletePromo = async (code) => {
    if (!window.confirm(`Delete promo code "${code}"?`)) return;
    try {
      await axios.delete(`${API}/reseller/promo-codes/${encodeURIComponent(code)}`, { headers: headers() });
      toast({ title: 'Promo deleted' });
      await loadAll();
    } catch (e) {
      toast({ title: 'Failed', variant: 'destructive' });
    }
  };

  const handleRedeemPromo = async () => {
    if (!redeemCode.trim()) {
      toast({ title: 'Pick a code', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      const r = await axios.post(
        `${API}/reseller/customers/${encodeURIComponent(showRedeem.email)}/redeem-promo`,
        { code: redeemCode.trim().toUpperCase() },
        { headers: headers() });
      toast({
        title: `🎁 ${redeemCode.toUpperCase()} applied`,
        description: `+$${r.data.bonus_credited} to ${showRedeem.email} • Cost you $${r.data.your_cost}`,
      });
      setShowRedeem(null);
      setRedeemCode('');
      await loadAll();
    } catch (e) {
      toast({ title: 'Failed', description: e?.response?.data?.detail || 'Try again', variant: 'destructive' });
    } finally { setSubmitting(false); }
  };

  const copyLogin = (email) => {
    navigator.clipboard.writeText(`https://calliotel.com/login\nEmail: ${email}`);
    setCopied(email);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  // ── Application pending admin review ───────────────────────────────
  if (!me?.is_reseller && me?.reseller_status === 'pending') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950/30 p-4 md:p-8">
        <div className="max-w-2xl mx-auto">
          <Button variant="ghost" onClick={() => navigate('/dashboard')} className="text-white mb-4">
            <ChevronLeft className="h-4 w-4 mr-1" /> Back to Dashboard
          </Button>
          <Card className="bg-slate-900/80 border-yellow-500/40 text-white">
            <CardHeader>
              <div className="flex items-center gap-3">
                <Loader2 className="h-8 w-8 text-yellow-400 animate-spin" />
                <div>
                  <CardTitle className="text-3xl">Application Under Review</CardTitle>
                  <p className="text-slate-300 mt-2">Thanks for applying! An admin will review your reseller application within 24 hours.</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-slate-800/40 rounded-lg p-4 border border-yellow-500/20">
                <p className="text-sm text-slate-300">
                  <b>Why the wait?</b> Reseller accounts can send SMS in bulk on behalf of customers — we manually verify
                  each applicant to keep our carrier reputation clean. This protects your future deliverability.
                </p>
              </div>
              <div className="text-sm text-slate-400">
                Status: <Badge className="bg-yellow-500/20 text-yellow-300 border-yellow-500/40">Pending</Badge>
                {me.reseller_application_display_name && (
                  <span className="ml-2">Applied as <b className="text-white">{me.reseller_application_display_name}</b></span>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // ── Application rejected ───────────────────────────────────────────
  if (!me?.is_reseller && me?.reseller_status === 'rejected') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-red-950/30 p-4 md:p-8">
        <div className="max-w-2xl mx-auto">
          <Button variant="ghost" onClick={() => navigate('/dashboard')} className="text-white mb-4">
            <ChevronLeft className="h-4 w-4 mr-1" /> Back to Dashboard
          </Button>
          <Card className="bg-slate-900/80 border-red-500/40 text-white">
            <CardHeader>
              <CardTitle className="text-2xl">Application Not Approved</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-300">
                Your reseller application wasn't approved at this time. Please contact support@calliotel.com if you'd like more information.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // ── Not a reseller yet ─────────────────────────────────────────────
  if (!me?.is_reseller) {
    const progress = Math.min(100, (me.lifetime_deposit_usd / me.threshold_usd) * 100);
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950/30 p-4 md:p-8">
        <div className="max-w-3xl mx-auto">
          <Button variant="ghost" onClick={() => navigate('/dashboard')} className="text-white mb-4">
            <ChevronLeft className="h-4 w-4 mr-1" /> Back to Dashboard
          </Button>

          <Card className="bg-slate-900/80 border-emerald-500/30 text-white">
            <CardHeader>
              <div className="flex items-center gap-3">
                <Sparkles className="h-8 w-8 text-emerald-400" />
                <div>
                  <CardTitle className="text-3xl">Become a Calliotel Reseller</CardTitle>
                  <p className="text-slate-300 mt-2">Buy credits at <b>30% off</b> wholesale & resell to your own customers under your own brand.</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-slate-800/60 rounded-lg p-4 border border-slate-700">
                  <DollarSign className="h-6 w-6 text-green-400 mb-2" />
                  <h3 className="font-semibold mb-1">30% Wholesale Discount</h3>
                  <p className="text-sm text-slate-400">$1 of credit costs you $0.70</p>
                </div>
                <div className="bg-slate-800/60 rounded-lg p-4 border border-slate-700">
                  <Users className="h-6 w-6 text-blue-400 mb-2" />
                  <h3 className="font-semibold mb-1">Sub-Account Customers</h3>
                  <p className="text-sm text-slate-400">Create accounts under your brand</p>
                </div>
                <div className="bg-slate-800/60 rounded-lg p-4 border border-slate-700">
                  <Tag className="h-6 w-6 text-emerald-400 mb-2" />
                  <h3 className="font-semibold mb-1">Choose Your Markup</h3>
                  <p className="text-sm text-slate-400">1.5x / 2x / 3x — your choice</p>
                </div>
              </div>

              <div className="bg-slate-800/40 rounded-lg p-4 border border-slate-700">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-slate-300">Your lifetime deposits</span>
                  <span className="text-white font-bold">${me.lifetime_deposit_usd.toFixed(2)} / ${me.threshold_usd.toFixed(0)}</span>
                </div>
                <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-emerald-500 to-yellow-400 transition-all"
                       style={{ width: `${progress}%` }} />
                </div>
                {!me.eligible && (
                  <p className="text-xs text-slate-400 mt-2">
                    Top up ${(me.threshold_usd - me.lifetime_deposit_usd).toFixed(2)} more to unlock reseller status.
                  </p>
                )}
              </div>

              {me.eligible ? (
                showJoin ? (
                  <div className="space-y-3 bg-slate-800/40 p-4 rounded-lg border border-emerald-500/30">
                    <Label className="text-white">Your reseller brand name</Label>
                    <Input value={joinName} onChange={e=>setJoinName(e.target.value)}
                      placeholder="e.g. MaxSMS Pro" maxLength={40}
                      className="bg-slate-900 border-slate-700 text-white" />
                    <p className="text-xs text-slate-400">Your customers will see this name when they log in.</p>
                    <div className="flex gap-2">
                      <Button onClick={handleBecome} disabled={submitting}
                        className="bg-emerald-500 hover:bg-emerald-600">
                        {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                        Activate Reseller Status
                      </Button>
                      <Button variant="outline" onClick={() => setShowJoin(false)}>Cancel</Button>
                    </div>
                  </div>
                ) : (
                  <Button size="lg" onClick={() => setShowJoin(true)}
                    className="w-full bg-gradient-to-r from-emerald-500 to-red-500 hover:from-emerald-600 hover:to-red-600 text-white text-lg h-14">
                    <Sparkles className="h-5 w-5 mr-2" /> Become a Reseller — FREE
                  </Button>
                )
              ) : (
                <Button size="lg" onClick={() => navigate('/buy-credits')}
                  className="w-full bg-emerald-500 hover:bg-emerald-600 text-white">
                  Top Up Wallet to Qualify
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // ── Active reseller dashboard ────────────────────────────────────────
  const stats = me.stats || {};
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950/20 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <Button variant="ghost" onClick={() => navigate('/dashboard')} className="text-white mb-4">
          <ChevronLeft className="h-4 w-4 mr-1" /> Back to Dashboard
        </Button>

        {/* Header */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-2">
              <Sparkles className="h-7 w-7 text-emerald-400" />
              {me.display_name}
            </h1>
            <p className="text-slate-400 mt-1">Reseller Dashboard • 30% wholesale • {me.markup_tier}x markup</p>
          </div>
          {me.kyc_verified ? (
            <Badge className="bg-gradient-to-r from-emerald-500 to-red-500 text-white text-base px-3 py-1">
              ✅ VERIFIED RESELLER
            </Badge>
          ) : (
            <Badge className="bg-yellow-500/20 text-yellow-300 border border-yellow-500/40 text-base px-3 py-1">
              ⚠️ PENDING VERIFICATION
            </Badge>
          )}
        </div>

        {/* KYC Verification Banner */}
        {!me.kyc_verified && (
          <div className={`mb-6 rounded-xl border p-5 ${
            me.kyc_doc_status === 'pending_kyc'
              ? 'bg-blue-950/40 border-blue-500/40'
              : me.kyc_doc_status === 'kyc_rejected'
              ? 'bg-red-950/40 border-red-500/40'
              : 'bg-yellow-950/40 border-yellow-500/40'
          }`}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="text-2xl mt-0.5">
                  {me.kyc_doc_status === 'pending_kyc' ? '🔍' : me.kyc_doc_status === 'kyc_rejected' ? '❌' : '🪪'}
                </div>
                <div>
                  <h3 className={`font-bold text-lg ${
                    me.kyc_doc_status === 'pending_kyc' ? 'text-blue-300' : me.kyc_doc_status === 'kyc_rejected' ? 'text-red-300' : 'text-yellow-300'
                  }`}>
                    {me.kyc_doc_status === 'pending_kyc'
                      ? 'Documents Under Review'
                      : me.kyc_doc_status === 'kyc_rejected'
                      ? 'Verification Rejected — Please Resubmit'
                      : 'Complete Verification to Unlock Customer Funding'}
                  </h3>
                  <p className="text-slate-400 text-sm mt-1">
                    {me.kyc_doc_status === 'pending_kyc'
                      ? 'We received your documents and are reviewing them. You\'ll be notified by email within 24 hours.'
                      : me.kyc_doc_status === 'kyc_rejected'
                      ? 'Your documents could not be verified. Please resubmit clear, unedited photos.'
                      : 'Submit a government ID + selfie. Required before you can fund customer accounts. Commissions are tracked in the meantime.'}
                  </p>
                </div>
              </div>
              {me.kyc_doc_status !== 'pending_kyc' && (
                <Button onClick={() => setShowKycForm(!showKycForm)}
                  className={`${me.kyc_doc_status === 'kyc_rejected' ? 'bg-red-600 hover:bg-red-700' : 'bg-yellow-600 hover:bg-yellow-700'} text-white whitespace-nowrap`}>
                  {showKycForm ? 'Cancel' : (me.kyc_doc_status === 'kyc_rejected' ? 'Resubmit Documents' : 'Verify Identity Now →')}
                </Button>
              )}
            </div>

            {showKycForm && (
              <div className="mt-5 pt-5 border-t border-white/10 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-slate-300 text-sm mb-1 block">Full Legal Name</Label>
                    <input
                      type="text"
                      value={kycFullName}
                      onChange={e => setKycFullName(e.target.value)}
                      placeholder="As it appears on your ID"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-slate-300 text-sm mb-1 block">Document Type</Label>
                    <select
                      value={kycIdType}
                      onChange={e => setKycIdType(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
                    >
                      {['Passport', 'National ID Card', "Driver's License", 'Residence Permit'].map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-slate-300 text-sm mb-2 block">📄 Government ID Photo <span className="text-slate-500 font-normal">(max 2MB)</span></Label>
                    <label className="flex items-center gap-2 cursor-pointer bg-slate-900 border border-dashed border-slate-600 rounded-lg px-4 py-3 hover:border-slate-400 transition-colors">
                      <Upload className="h-4 w-4 text-slate-400" />
                      <span className="text-sm text-slate-400">{kycIdFile ? kycIdFile.name : 'Click to upload ID photo'}</span>
                      <input type="file" accept="image/*" className="hidden" onChange={e => setKycIdFile(e.target.files?.[0] || null)} />
                    </label>
                  </div>
                  <div>
                    <Label className="text-slate-300 text-sm mb-2 block">🤳 Selfie Holding ID <span className="text-slate-500 font-normal">(max 2MB)</span></Label>
                    <label className="flex items-center gap-2 cursor-pointer bg-slate-900 border border-dashed border-slate-600 rounded-lg px-4 py-3 hover:border-slate-400 transition-colors">
                      <Upload className="h-4 w-4 text-slate-400" />
                      <span className="text-sm text-slate-400">{kycSelfieFile ? kycSelfieFile.name : 'Click to upload selfie'}</span>
                      <input type="file" accept="image/*" className="hidden" onChange={e => setKycSelfieFile(e.target.files?.[0] || null)} />
                    </label>
                  </div>
                </div>
                <div className="bg-slate-800/40 rounded-lg p-3 text-xs text-slate-400">
                  🔒 Documents are encrypted and stored securely. Used only for identity verification. Never shared with third parties.
                </div>
                <Button onClick={handleKycSubmit} disabled={kycSubmitting}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white">
                  {kycSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Submit for Verification
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card className="bg-slate-900/80 border-slate-800">
            <CardContent className="p-4">
              <Users className="h-5 w-5 text-blue-400 mb-2" />
              <p className="text-2xl font-bold text-white">{stats.customer_count ?? 0}</p>
              <p className="text-xs text-slate-400">Customers</p>
            </CardContent>
          </Card>
          <Card className="bg-slate-900/80 border-slate-800">
            <CardContent className="p-4">
              <DollarSign className="h-5 w-5 text-green-400 mb-2" />
              <p className="text-2xl font-bold text-white">${(stats.credits_delivered_usd ?? 0).toFixed(2)}</p>
              <p className="text-xs text-slate-400">Credits delivered</p>
            </CardContent>
          </Card>
          <Card className="bg-slate-900/80 border-slate-800">
            <CardContent className="p-4">
              <Wallet className="h-5 w-5 text-emerald-400 mb-2" />
              <p className="text-2xl font-bold text-white">${(stats.wholesale_cost_usd ?? 0).toFixed(2)}</p>
              <p className="text-xs text-slate-400">Your wholesale cost</p>
            </CardContent>
          </Card>
          <Card className="bg-slate-900/80 border-slate-800">
            <CardContent className="p-4">
              <TrendingUp className="h-5 w-5 text-yellow-400 mb-2" />
              <p className="text-2xl font-bold text-yellow-400">${(stats.wholesale_savings_usd ?? 0).toFixed(2)}</p>
              <p className="text-xs text-slate-400">Saved (30% off)</p>
            </CardContent>
          </Card>
        </div>

        {/* Markup tier picker */}
        <Card className="bg-slate-900/80 border-slate-800 text-white mb-6">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Tag className="h-5 w-5 text-emerald-400" /> Your retail markup
            </CardTitle>
            <p className="text-sm text-slate-400">What you charge YOUR customer for $1 of Calliotel credit (off-platform).</p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3">
              {TIERS.map(t => (
                <button key={t.value} onClick={() => handleSetTier(t.value)}
                  className={`p-4 rounded-lg border-2 transition-all text-left ${
                    me.markup_tier === t.value
                      ? 'border-emerald-500 bg-emerald-500/10'
                      : 'border-slate-700 bg-slate-800/40 hover:border-slate-500'
                  }`}>
                  <div className="text-2xl font-bold">{t.label}</div>
                  <div className="text-xs text-emerald-400 font-semibold">{t.subtitle}</div>
                  <div className="text-xs text-slate-400 mt-1">{t.desc}</div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Promo Codes */}
        <Card className="bg-slate-900/80 border-slate-800 text-white mb-6">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Gift className="h-5 w-5 text-pink-400" /> Promo Codes ({promos.length})
            </CardTitle>
            <Button onClick={() => setShowNewPromo(true)} size="sm" className="bg-pink-600 hover:bg-pink-700">
              <Plus className="h-4 w-4 mr-1" /> New Code
            </Button>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-400 mb-3">Reusable bonus templates. Apply to any customer with one click — costs you 70% of the bonus value.</p>

            {showNewPromo && (
              <div className="bg-slate-800/40 p-4 rounded-lg border border-pink-500/30 mb-4 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs">Code (e.g. WELCOME)</Label>
                    <Input value={newPromoCode} onChange={e=>setNewPromoCode(e.target.value.toUpperCase())}
                      placeholder="WELCOME" maxLength={20} className="bg-slate-900 border-slate-700 text-white" />
                  </div>
                  <div>
                    <Label className="text-xs">Bonus $</Label>
                    <Input type="number" step="0.5" min="1" value={newPromoBonus}
                      onChange={e=>setNewPromoBonus(e.target.value)} className="bg-slate-900 border-slate-700 text-white" />
                  </div>
                  <div>
                    <Label className="text-xs">Max uses (0 = unlimited)</Label>
                    <Input type="number" min="0" value={newPromoMax}
                      onChange={e=>setNewPromoMax(e.target.value)} className="bg-slate-900 border-slate-700 text-white" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleCreatePromo} disabled={submitting} className="bg-pink-600 hover:bg-pink-700">
                    {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Create
                  </Button>
                  <Button variant="outline" onClick={() => setShowNewPromo(false)}>Cancel</Button>
                </div>
              </div>
            )}

            {promos.length === 0 && !showNewPromo && (
              <div className="text-center py-6 text-slate-500 text-sm">
                <Gift className="h-8 w-8 mx-auto mb-2 opacity-30" />
                No promo codes yet. Create one like "WELCOME5" for $5 signup bonuses.
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {promos.map(p => (
                <div key={p.code} className="bg-slate-800/40 rounded-lg p-3 border border-slate-700 flex justify-between items-center">
                  <div>
                    <div className="font-mono font-bold text-pink-300">{p.code}</div>
                    <div className="text-xs text-slate-400">
                      +${p.bonus_usd} • used {p.uses}{p.max_uses > 0 ? `/${p.max_uses}` : ''}
                    </div>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => handleDeletePromo(p.code)}
                    className="text-red-400 hover:bg-red-950/30 h-8 w-8 p-0">
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="bg-slate-900/80 border-slate-800 text-white mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-cyan-400" /> Recent Activity ({transactions.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {transactions.length === 0 ? (
              <div className="text-center py-6 text-slate-500 text-sm">
                <Activity className="h-8 w-8 mx-auto mb-2 opacity-30" />
                No fundings yet. Add a customer and click "Fund" to get started.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-slate-400 uppercase border-b border-slate-700">
                    <tr>
                      <th className="text-left py-2">Date</th>
                      <th className="text-left py-2">Customer</th>
                      <th className="text-right py-2">Credit</th>
                      <th className="text-right py-2">Cost</th>
                      <th className="text-right py-2">Saved</th>
                      <th className="text-left py-2 pl-3">Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map(t => (
                      <tr key={t.funding_id} className="border-b border-slate-800/50">
                        <td className="py-2 text-slate-400 text-xs">{t.created_at?.slice(0,16).replace('T',' ')}</td>
                        <td className="py-2 truncate max-w-[180px]">{t.customer}</td>
                        <td className="py-2 text-right text-green-400 font-semibold">${t.credits_delivered.toFixed(2)}</td>
                        <td className="py-2 text-right text-slate-300">${t.wholesale_cost.toFixed(2)}</td>
                        <td className="py-2 text-right text-yellow-400">${t.savings.toFixed(2)}</td>
                        <td className="py-2 pl-3">
                          {t.promo_code
                            ? <Badge className="bg-pink-900/50 text-pink-300 text-xs">🎁 {t.promo_code}</Badge>
                            : <Badge className="bg-slate-700 text-slate-300 text-xs">FUND</Badge>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Brand Logo */}
        <Card className="bg-slate-900/80 border-slate-800 text-white mb-6">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <ImageIcon className="h-5 w-5 text-pink-400" /> Your brand logo
            </CardTitle>
            <p className="text-sm text-slate-400">Replaces the Calliotel icon for your customers when they log in. PNG / JPG / WEBP / SVG, max 150KB.</p>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-4">
              <div className="w-24 h-24 rounded-xl bg-slate-800 border-2 border-dashed border-slate-700 flex items-center justify-center overflow-hidden flex-shrink-0">
                {logoUrl
                  ? <img src={logoUrl} alt="Brand logo" className="w-full h-full object-contain" />
                  : <ImageIcon className="h-8 w-8 text-slate-600" />}
              </div>
              <div className="flex flex-col gap-2">
                <label className="cursor-pointer">
                  <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    onChange={handleLogoUpload} disabled={logoUploading} className="hidden" />
                  <span className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 rounded-md text-sm font-semibold transition">
                    {logoUploading
                      ? <><Loader2 className="h-4 w-4 animate-spin" /> Uploading…</>
                      : <><Upload className="h-4 w-4" /> {logoUrl ? 'Replace logo' : 'Upload logo'}</>}
                  </span>
                </label>
                {logoUrl && (
                  <Button variant="outline" size="sm" onClick={handleLogoDelete} disabled={logoUploading}
                    className="text-red-400 border-red-900/50 hover:bg-red-950/30">
                    <Trash2 className="h-3 w-3 mr-1" /> Remove
                  </Button>
                )}
              </div>
              <div className="text-xs text-slate-500 ml-auto max-w-xs">
                💡 Square logos work best (e.g. 256×256). Need to compress? Try
                <a href="https://tinypng.com" target="_blank" rel="noopener noreferrer" className="text-emerald-400 underline ml-1">tinypng.com</a>.
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Customers */}
        <Card className="bg-slate-900/80 border-slate-800 text-white">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-400" /> My Customers ({customers.length})
            </CardTitle>
            <Button onClick={() => setShowAdd(true)} className="bg-emerald-500 hover:bg-emerald-600">
              <Plus className="h-4 w-4 mr-1" /> Add Customer
            </Button>
          </CardHeader>
          <CardContent>
            {showAdd && (
              <div className="bg-slate-800/40 p-4 rounded-lg border border-emerald-500/30 mb-4 space-y-3">
                <h3 className="font-semibold">New Customer Account</h3>
                <Input placeholder="customer email" value={newEmail} onChange={e=>setNewEmail(e.target.value)}
                  className="bg-slate-900 border-slate-700 text-white" />
                <Input type="password" placeholder="password (you choose, min 6 chars)" value={newPass}
                  onChange={e=>setNewPass(e.target.value)} className="bg-slate-900 border-slate-700 text-white" />
                <Input placeholder="display name (optional)" value={newDName} onChange={e=>setNewDName(e.target.value)}
                  className="bg-slate-900 border-slate-700 text-white" />
                <div className="flex gap-2">
                  <Button onClick={handleAddCustomer} disabled={submitting} className="bg-emerald-500 hover:bg-emerald-600">
                    {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Create Account
                  </Button>
                  <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
                </div>
              </div>
            )}

            {customers.length === 0 && !showAdd && (
              <div className="text-center py-12 text-slate-400">
                <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>No customers yet. Click "Add Customer" to create your first sub-account.</p>
              </div>
            )}

            <div className="space-y-2">
              {customers.map(c => (
                <div key={c.email} className="bg-slate-800/40 rounded-lg p-3 flex flex-wrap items-center justify-between gap-3 border border-slate-700">
                  <div className="flex-1 min-w-[200px]">
                    <p className="font-semibold text-white">{c.display_name}</p>
                    <p className="text-xs text-slate-400">{c.email}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-slate-400">Balance</p>
                    <p className="font-bold text-green-400">${c.wallet_balance.toFixed(2)}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => copyLogin(c.email)}>
                      {copied === c.email ? <Check className="h-3 w-3 mr-1 text-green-400" /> : <Copy className="h-3 w-3 mr-1" />}
                      Login link
                    </Button>
                    {promos.length > 0 && (
                      <Button size="sm" variant="outline" onClick={() => setShowRedeem(c)}
                        className="border-pink-500/40 text-pink-300 hover:bg-pink-950/30">
                        <Gift className="h-3 w-3 mr-1" /> Promo
                      </Button>
                    )}
                    {me.kyc_verified ? (
                      <Button size="sm" onClick={() => setShowFund(c)} className="bg-green-600 hover:bg-green-700">
                        <DollarSign className="h-3 w-3 mr-1" /> Fund
                      </Button>
                    ) : (
                      <Button size="sm" disabled title="Complete identity verification to fund customers"
                        className="bg-slate-700 text-slate-500 cursor-not-allowed">
                        🔒 Fund
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {showRedeem && (
              <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={()=>setShowRedeem(null)}>
                <Card className="bg-slate-900 border-pink-500 max-w-md w-full" onClick={e=>e.stopPropagation()}>
                  <CardHeader>
                    <CardTitle className="text-white flex items-center gap-2">
                      <Gift className="h-5 w-5 text-pink-400" /> Apply promo to {showRedeem.email}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label className="text-white">Pick a promo code</Label>
                      <select value={redeemCode} onChange={e=>setRedeemCode(e.target.value)}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 text-white rounded-md px-3 py-2">
                        <option value="">— Select —</option>
                        {promos.filter(p => p.active && (p.max_uses === 0 || p.uses < p.max_uses)).map(p => (
                          <option key={p.code} value={p.code}>
                            {p.code} (+${p.bonus_usd}) {p.max_uses > 0 ? `• ${p.max_uses - p.uses} left` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                    {redeemCode && (() => {
                      const p = promos.find(x => x.code === redeemCode);
                      return p ? (
                        <div className="bg-slate-800 p-3 rounded-lg text-sm space-y-1">
                          <div className="flex justify-between"><span>Customer receives:</span><span className="text-green-400 font-bold">+${p.bonus_usd}</span></div>
                          <div className="flex justify-between"><span>Costs you (30% off):</span><span className="text-emerald-400 font-bold">${(p.bonus_usd * 0.70).toFixed(2)}</span></div>
                        </div>
                      ) : null;
                    })()}
                    <div className="flex gap-2">
                      <Button onClick={handleRedeemPromo} disabled={submitting || !redeemCode}
                        className="bg-pink-600 hover:bg-pink-700 flex-1">
                        {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Apply Promo
                      </Button>
                      <Button variant="outline" onClick={() => setShowRedeem(null)}>Cancel</Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {showFund && (
              <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={()=>setShowFund(null)}>
                <Card className="bg-slate-900 border-emerald-500 max-w-md w-full" onClick={e=>e.stopPropagation()}>
                  <CardHeader>
                    <CardTitle className="text-white">Fund {showFund.email}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label className="text-white">Amount to credit customer (USD)</Label>
                      <Input type="number" step="0.5" min="1" value={fundAmt} onChange={e=>setFundAmt(e.target.value)}
                        className="bg-slate-800 border-slate-700 text-white" />
                    </div>
                    <div className="bg-slate-800 p-3 rounded-lg text-sm space-y-1">
                      <div className="flex justify-between text-slate-300">
                        <span>Customer receives:</span>
                        <span className="text-green-400 font-bold">${parseFloat(fundAmt || 0).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-slate-300">
                        <span>You pay (30% off):</span>
                        <span className="text-emerald-400 font-bold">${(parseFloat(fundAmt || 0) * 0.70).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-slate-300 border-t border-slate-700 pt-1 mt-1">
                        <span>Suggested retail to charge them:</span>
                        <span className="text-yellow-400 font-bold">${(parseFloat(fundAmt || 0) * me.markup_tier).toFixed(2)}</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={handleFund} disabled={submitting} className="bg-green-600 hover:bg-green-700 flex-1">
                        {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Send Credit
                      </Button>
                      <Button variant="outline" onClick={() => setShowFund(null)}>Cancel</Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
