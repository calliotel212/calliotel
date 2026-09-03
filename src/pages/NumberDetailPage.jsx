import React, { useState } from 'react';
import { ArrowLeft, Pencil, Check, X, Loader } from 'lucide-react';
import axios from 'axios';
import { useLocation, useNavigate } from 'react-router-dom';
import { useToast } from '../hooks/use-toast';
import safeLocalStorage from '../utils/safeLocalStorage';
import BottomNav from '../components/BottomNav';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const getFlag = (phone) => {
  if (!phone) return '📞';
  if (phone.startsWith('+61')) return '🇦🇺';
  if (phone.startsWith('+44')) return '🇬🇧';
  if (phone.startsWith('+1')) return '🇺🇸';
  return '📞';
};

const fmtExpiry = (d) => {
  if (!d) return null;
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

const Toggle = ({ on, onChange, disabled }) => (
  <button
    type="button"
    onClick={onChange}
    disabled={disabled}
    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${on ? 'bg-emerald-500' : 'bg-gray-700'} ${disabled ? 'opacity-50' : ''}`}
  >
    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${on ? 'translate-x-6' : 'translate-x-1'}`} />
  </button>
);

const NumberDetailPage = () => {
  const { state } = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const number = state?.number;

  const [label, setLabel] = useState(number?.label || '');
  const [editingLabel, setEditingLabel] = useState(false);
  const [dnd, setDnd] = useState(!!number?.do_not_disturb);
  const [savingLabel, setSavingLabel] = useState(false);
  const [togglingDnd, setTogglingDnd] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [transferClientId, setTransferClientId] = useState('');
  const [transferring, setTransferring] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [showRenew, setShowRenew] = useState(false);
  const [renewing, setRenewing] = useState(false);

  if (!number) {
    navigate('/my-numbers');
    return null;
  }

  const phone = number.phone_number;
  const expiry = number.expires_at || number.next_renewal_date || number.next_billing_date;
  const monthlyCost = number.monthly_cost || number.provider_cost || 1.99;

  const doRenew = async () => {
    setRenewing(true);
    try {
      const token = safeLocalStorage.getItem('token');
      const encoded = encodeURIComponent(phone.replace(/^\+/, ''));
      const res = await axios.post(
        `${API}/numbers/renew/${encoded}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const newExp = new Date(res.data.new_expiry).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
      toast({ title: '✅ Number extended!', description: `Active until ${newExp}. New balance: $${res.data.new_balance.toFixed(2)}` });
      setShowRenew(false);
      navigate('/my-numbers');
    } catch (err) {
      const msg = err.response?.data?.detail || 'Renewal failed. Please try again.';
      if (msg.includes('Insufficient')) {
        toast({ title: '💰 Not enough balance', description: msg, variant: 'destructive' });
        setShowRenew(false);
        navigate('/buy-credits');
      } else {
        toast({ title: 'Error', description: msg, variant: 'destructive' });
      }
    } finally {
      setRenewing(false);
    }
  };

  const saveLabel = async () => {
    setSavingLabel(true);
    try {
      const token = safeLocalStorage.getItem('token');
      await axios.patch(
        `${API}/didww/numbers/${encodeURIComponent(phone)}`,
        { label: label.trim() },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setEditingLabel(false);
      toast({ title: 'Saved!', description: 'Profile name updated.' });
    } catch {
      toast({ title: 'Error', description: 'Could not save name.', variant: 'destructive' });
    } finally {
      setSavingLabel(false);
    }
  };

  const toggleDnd = async () => {
    setTogglingDnd(true);
    const next = !dnd;
    try {
      const token = safeLocalStorage.getItem('token');
      await axios.patch(
        `${API}/didww/numbers/${encodeURIComponent(phone)}`,
        { do_not_disturb: next },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setDnd(next);
      toast({ title: next ? 'Do Not Disturb ON' : 'Do Not Disturb OFF' });
    } catch {
      toast({ title: 'Error', description: 'Could not update.', variant: 'destructive' });
      setTogglingDnd(false);
      return;
    }
    setTogglingDnd(false);
  };

  const doTransfer = async () => {
    if (!transferClientId.trim()) return;
    setTransferring(true);
    try {
      const token = safeLocalStorage.getItem('token');
      const res = await axios.post(
        `${API}/numbers/transfer`,
        { phone_number: phone, recipient_client_id: transferClientId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast({ title: 'Transferred!', description: `Sent to ${res.data.recipient_email}. Cost: $${res.data.transfer_cost}` });
      setShowTransfer(false);
      navigate('/my-numbers');
    } catch (err) {
      toast({ title: 'Transfer Failed', description: err.response?.data?.detail || 'Could not transfer.', variant: 'destructive' });
    } finally {
      setTransferring(false);
    }
  };

  const doCancel = async () => {
    setCancelling(true);
    try {
      const token = safeLocalStorage.getItem('token');
      await axios.post(`${API}/numbers/cancel/${phone}`, {}, { headers: { Authorization: `Bearer ${token}` } });
      toast({ title: 'Cancellation Scheduled', description: 'Number active until end of billing period.' });
      setShowCancel(false);
      navigate('/my-numbers');
    } catch (err) {
      toast({ title: 'Error', description: err.response?.data?.detail || 'Could not cancel.', variant: 'destructive' });
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white pb-28">
      <header className="bg-gray-900/95 backdrop-blur border-b border-gray-800 sticky top-0 z-30">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center gap-3">
          <button
            onClick={() => navigate('/my-numbers')}
            className="w-9 h-9 rounded-xl bg-gray-800 flex items-center justify-center hover:bg-gray-700 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <h1 className="text-lg font-bold text-white">Phone Number</h1>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 pt-6 space-y-3">

        {/* Number card */}
        <div className="bg-gray-900 rounded-2xl p-6 text-center border border-gray-800">
          <div className="text-5xl mb-3">{getFlag(phone)}</div>
          <p className="text-2xl font-bold text-white tracking-wide font-mono">{phone}</p>
          {number.status === 'active' && !number.cancel_requested && (
            <span className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/15 text-emerald-400 rounded-full text-xs font-semibold">
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
              Active
            </span>
          )}
          {number.cancel_requested && (
            <span className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 bg-yellow-500/15 text-yellow-400 rounded-full text-xs font-semibold">
              ⏳ Cancellation scheduled
            </span>
          )}
        </div>

        {/* Profile Name */}
        <div className="bg-gray-900 rounded-2xl border border-gray-800 px-5 py-4 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-500 mb-0.5">Profile Name</p>
            {editingLabel ? (
              <input
                autoFocus
                value={label}
                onChange={e => setLabel(e.target.value.toUpperCase().slice(0, 30))}
                placeholder="e.g. AMAZON, BANK, WORK"
                className="bg-transparent text-white font-semibold text-[15px] outline-none border-b border-emerald-500 pb-0.5 w-full"
              />
            ) : (
              <p className="text-white font-semibold text-[15px] truncate">
                {label || <span className="text-gray-500 font-normal italic">No label set</span>}
              </p>
            )}
          </div>
          {editingLabel ? (
            <div className="flex gap-2 flex-shrink-0">
              <button
                onClick={saveLabel}
                disabled={savingLabel}
                className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center"
              >
                {savingLabel ? <Loader className="w-3.5 h-3.5 text-white animate-spin" /> : <Check className="w-4 h-4 text-white" />}
              </button>
              <button
                onClick={() => { setEditingLabel(false); setLabel(number?.label || ''); }}
                className="w-8 h-8 bg-gray-700 rounded-lg flex items-center justify-center"
              >
                <X className="w-4 h-4 text-gray-300" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setEditingLabel(true)}
              className="w-8 h-8 bg-gray-800 rounded-lg flex items-center justify-center hover:bg-gray-700 transition-colors flex-shrink-0"
            >
              <Pencil className="w-4 h-4 text-gray-400" />
            </button>
          )}
        </div>

        {/* Subscription / Expiry */}
        <div className="bg-gray-900 rounded-2xl border border-gray-800 px-5 py-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500 mb-0.5">Subscription</p>
            <p className="text-white font-medium text-[15px]">
              {number.subscription_months > 1 ? `${number.subscription_months}-month plan` : 'Monthly Subscription'}
            </p>
          </div>
          {expiry && (
            <div className="text-right">
              <p className="text-xs text-gray-500 mb-0.5">Expires</p>
              <p className="text-red-400 font-semibold text-sm">{fmtExpiry(expiry)}</p>
            </div>
          )}
        </div>

        {/* Do Not Disturb */}
        <div className="bg-gray-900 rounded-2xl border border-gray-800 px-5 py-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-white font-medium text-[15px]">Do Not Disturb</p>
            <Toggle on={dnd} onChange={toggleDnd} disabled={togglingDnd} />
          </div>
          <p className="text-gray-500 text-sm leading-relaxed">
            When enabled, incoming calls skip your phone and go straight to voicemail (with transcript).
          </p>
        </div>

        {/* Action buttons */}
        <div className="space-y-3 pt-1">
          <button
            onClick={() => setShowRenew(true)}
            className="w-full py-4 rounded-2xl border-2 border-blue-500 text-blue-400 font-bold text-[15px] hover:bg-blue-500/10 active:scale-[0.98] transition-all"
          >
            Extend Subscription
          </button>

          <button
            onClick={() => setShowTransfer(true)}
            className="w-full py-4 rounded-2xl border-2 border-orange-500 text-orange-400 font-bold text-[15px] hover:bg-orange-500/10 active:scale-[0.98] transition-all"
          >
            Transfer Number
          </button>

          {!number.cancel_requested && (
            <button
              onClick={() => setShowCancel(true)}
              className="w-full py-4 rounded-2xl border-2 border-red-500 text-red-400 font-bold text-[15px] hover:bg-red-500/10 active:scale-[0.98] transition-all"
            >
              Cancel Number
            </button>
          )}
        </div>
      </div>

      {/* Renew Modal */}
      {showRenew && (
        <div className="fixed inset-0 bg-black/75 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-gray-900 rounded-3xl w-full max-w-lg p-6 border border-gray-800">
            <h3 className="text-lg font-bold text-white mb-1">Extend Subscription</h3>
            <p className="text-gray-400 text-sm mb-5">
              This will renew <span className="text-white font-medium">{phone}</span> for 30 days.
              Your wallet will be charged <span className="text-emerald-400 font-bold">${Number(monthlyCost).toFixed(2)}</span>.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowRenew(false)}
                className="flex-1 py-3 rounded-xl border border-gray-700 text-gray-400 font-semibold hover:bg-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={doRenew}
                disabled={renewing}
                className="flex-1 py-3 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-bold disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
              >
                {renewing && <Loader className="w-4 h-4 animate-spin" />}
                Extend (${Number(monthlyCost).toFixed(2)})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transfer Modal */}
      {showTransfer && (
        <div className="fixed inset-0 bg-black/75 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-gray-900 rounded-3xl w-full max-w-lg p-6 border border-gray-800">
            <h3 className="text-lg font-bold text-white mb-1">Transfer Number</h3>
            <p className="text-gray-500 text-sm mb-5">Enter the recipient's Calliotel Client ID. Transfer costs $1.00.</p>
            <input
              value={transferClientId}
              onChange={e => setTransferClientId(e.target.value.trim())}
              placeholder="Recipient Client ID"
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 mb-4"
            />
            <div className="flex gap-3">
              <button
                onClick={() => { setShowTransfer(false); setTransferClientId(''); }}
                className="flex-1 py-3 rounded-xl border border-gray-700 text-gray-400 font-semibold hover:bg-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={doTransfer}
                disabled={transferring || !transferClientId.trim()}
                className="flex-1 py-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-semibold disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
              >
                {transferring && <Loader className="w-4 h-4 animate-spin" />}
                Transfer ($1.00)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Modal */}
      {showCancel && (
        <div className="fixed inset-0 bg-black/75 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-gray-900 rounded-3xl w-full max-w-lg p-6 border border-gray-800">
            <h3 className="text-lg font-bold text-white mb-2">Cancel Number?</h3>
            <p className="text-gray-400 text-sm mb-1">
              <span className="text-white font-mono">{phone}</span> will remain active until the end of your billing period.
            </p>
            <p className="text-red-400 text-xs mb-5">This cannot be undone.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowCancel(false)}
                className="flex-1 py-3 rounded-xl border border-gray-700 text-gray-300 font-semibold hover:bg-gray-800 transition-colors"
              >
                Keep Number
              </button>
              <button
                onClick={doCancel}
                disabled={cancelling}
                className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
              >
                {cancelling && <Loader className="w-4 h-4 animate-spin" />}
                Yes, Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
};

export default NumberDetailPage;
