import React, { useState, useEffect } from 'react';
import { CheckCircle, Loader, ArrowRight, Home, Phone } from 'lucide-react';
import { trackWalletTopup, trackPurchase, trackNumberActivated } from '../utils/gtagConversions';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../hooks/use-toast';
import { useNavigate, useSearchParams } from 'react-router-dom';
import BottomNav from '../components/BottomNav';
import safeLocalStorage from '../utils/safeLocalStorage';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const PaymentSuccessPage = () => {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState('checking');
  const [paymentDetails, setPaymentDetails] = useState(null);
  const [numberDetails, setNumberDetails] = useState(null);
  const [loading, setLoading] = useState(true);

  const { user } = useAuth();
  const { darkMode } = useTheme();
  const { toast } = useToast();
  const navigate = useNavigate();

  // Handle Viva's double-domain redirect bug:
  // Viva sometimes redirects to calliotel.com/https://calliotel.com/payment-success?t=..&s=..
  // Detect this and extract the real params from the mangled URL
  const rawPath = window.location.pathname;
  const isDoubleUrl = rawPath.startsWith('/https://') || rawPath.startsWith('/http://');
  const effectiveSearch = isDoubleUrl
    ? '?' + (rawPath.split('?')[1] || '') + (window.location.search ? '&' + window.location.search.slice(1) : '')
    : window.location.search;
  const effectiveParams = new URLSearchParams(effectiveSearch);

  const sessionId = searchParams.get('session_id');
  // Paddle appends ?_ptxn=<transaction_id> on return
  const paddleTxn      = searchParams.get('_ptxn');
  // Affirm: we embed affirm_ref in the return URL
  const affirmRef       = searchParams.get('affirm_ref');
  // Affirm also appends checkout_token after user approves
  const affirmToken     = searchParams.get('checkout_token');
  const tcoOrder        = effectiveParams.get('tco_order') || searchParams.get('tco_order');
  const isNumberPurchase = searchParams.get('type') === 'number';
  const isPaddle       = Boolean(paddleTxn);
  const isAffirm       = Boolean(affirmRef);
  const isTco          = Boolean(tcoOrder);

  useEffect(() => {
    if (isNumberPurchase) {
      completeNumberPurchase();
    } else if (isTco) {
      checkTcoStatus(tcoOrder);
    } else if (isAffirm) {
      checkAffirmStatus(affirmRef, affirmToken);
    } else if (isPaddle) {
      checkPaddleStatus(paddleTxn);
    } else if (sessionId) {
      checkPaymentStatus();
    } else {
      setStatus('error');
      setLoading(false);
    }
  }, [sessionId, paddleTxn, affirmRef, tcoOrder]);

  // Auto-resume pending number purchase after any wallet top-up success
  useEffect(() => {
    if (status !== 'success' || isNumberPurchase) return;
    const raw = safeLocalStorage.getItem('pendingNumberPurchase');
    if (!raw) return;
    try {
      const pending = JSON.parse(raw);
      if (pending?.area_code) {
        const timer = setTimeout(() => navigate('/first-hour', { replace: true }), 300);
        return () => clearTimeout(timer);
      }
    } catch {}
  }, [status, isNumberPurchase]);

  const checkTcoStatus = async (orderRef) => {
    try {
      const token = safeLocalStorage.getItem('token');
      // Poll /status until complete (IPN fires asynchronously)
      let attempts = 0;
      const poll = async () => {
        attempts++;
        try {
          const s = await axios.get(`${API}/payments/twocheckout/status/${orderRef}`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          if (s.data.complete) {
            const amt = s.data.amount;
            setPaymentDetails({ amount: amt, credits_added: amt });
            setStatus('success');
            trackWalletTopup({ value: amt || 0, currency: 'USD', method: 'twocheckout', transactionId: orderRef });
            setLoading(false);
            return;
          }
        } catch (_) {}
        if (attempts < 15) {
          setTimeout(poll, 3000);
        } else {
          // After 45s still pending — show pending state, IPN will credit eventually
          setStatus('pending');
          setLoading(false);
        }
      };
      setStatus('pending');
      await poll();
    } catch (error) {
      setStatus('pending');
      setLoading(false);
    }
  };


  const checkPaddleStatus = async (txnId) => {
    try {
      const token = safeLocalStorage.getItem('token');
      const response = await axios.get(`${API}/payments/paddle-status/${txnId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setPaymentDetails(response.data);
      if (response.data.payment_status === 'paid') {
        setStatus('success');
        trackWalletTopup({
          value: response.data.amount || 0,
          currency: 'USD',
          method: 'paddle',
          transactionId: txnId,
        });
      } else {
        setStatus('pending');
      }
    } catch (error) {
      setStatus('error');
      toast({ title: 'Error', description: 'Could not verify payment status', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const checkAffirmStatus = async (orderRef, checkoutToken) => {
    try {
      const token = safeLocalStorage.getItem('token');
      // First try to confirm the charge if we have a checkout_token
      if (checkoutToken) {
        await axios.post(`${API}/payments/affirm/confirm`,
          { checkout_token: checkoutToken, order_ref: orderRef },
          { headers: { Authorization: `Bearer ${token}` } }
        );
      }
      // Then check the order status
      const response = await axios.get(`${API}/payments/affirm/status/${orderRef}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setPaymentDetails({
        amount: response.data.amount,
        credits_added: response.data.amount,
      });
      if (response.data.processed) {
        setStatus('success');
        trackWalletTopup({
          value: response.data.amount || 0,
          currency: 'USD',
          method: 'affirm',
          transactionId: response.data.charge_id || orderRef,
        });
      } else {
        setStatus('pending');
      }
    } catch (error) {
      setStatus('pending');
    } finally {
      setLoading(false);
    }
  };

  const checkPaymentStatus = async () => {
    try {
      const token = safeLocalStorage.getItem('token');
      const response = await axios.get(`${API}/payments/checkout-status/${sessionId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setPaymentDetails(response.data);
      if (response.data.payment_status === 'paid') {
        setStatus('success');
        trackWalletTopup({
          value: response.data.amount || 0,
          currency: (response.data.currency || 'USD').toUpperCase(),
          method: 'stripe',
          transactionId: response.data.session_id || sessionId || '',
        });
      } else {
        setStatus('pending');
      }
    } catch (error) {
      setStatus('error');
      toast({ title: 'Error', description: 'Could not verify payment status', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const completeNumberPurchase = async () => {
    try {
      const token = safeLocalStorage.getItem('token');
      const response = await axios.post(
        `${API}/didww/complete-card-purchase`,
        { session_id: sessionId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setNumberDetails(response.data);
      setStatus('number_success');
      try {
        trackPurchase({
          value: response.data.total_paid || 0,
          currency: 'USD',
          transactionId: response.data.phone_number || sessionId || '',
        });
        trackNumberActivated();
      } catch (e) {}
    } catch (error) {
      const detail = error.response?.data?.detail || 'Could not complete number purchase.';
      // If payment was received but provisioning failed, show error with support info
      setStatus('number_error');
      setPaymentDetails({ error: detail });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
        <div style={{ background: '#fff', borderRadius: 20, padding: '40px 48px', textAlign: 'center', boxShadow: '0 4px 24px rgba(0,0,0,0.08)', maxWidth: 360 }}>
          <Loader style={{ width: 44, height: 44, color: '#10b981', animation: 'spin 1s linear infinite', marginBottom: 16 }} />
          <p style={{ color: '#111', fontSize: 17, fontWeight: 700, marginBottom: 8 }}>
            {isNumberPurchase ? 'Activating your number…' : 'Payment received — crediting your wallet…'}
          </p>
          <p style={{ color: '#666', fontSize: 13, lineHeight: 1.5 }}>
            This usually takes just a few seconds.<br />Please don't close this tab.
          </p>
        </div>
        <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  // ── Number purchase success ──────────────────────────────────────────────────
  if (status === 'number_success' && numberDetails) {
    return (
      <div style={{ minHeight: '100vh', background: '#0d0d0d', paddingBottom: 100 }}>
        <div style={{ maxWidth: 520, margin: '0 auto', padding: '60px 20px 0' }}>
          <div style={{ background: '#1c1c1e', borderRadius: 24, padding: 32, textAlign: 'center', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ width: 80, height: 80, borderRadius: 40, background: 'rgba(16,185,129,0.15)', border: '2px solid #10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <CheckCircle style={{ width: 40, height: 40, color: '#10b981' }} />
            </div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: '#fff', marginBottom: 8 }}>Number Activated! 🎉</h1>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, marginBottom: 24 }}>Your virtual number is ready to use</p>

            <div style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: 16, padding: '20px 24px', marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 12 }}>
                <Phone style={{ width: 20, height: 20, color: '#10b981' }} />
                <span style={{ fontSize: 22, fontWeight: 900, color: '#10b981', fontFamily: 'monospace', letterSpacing: 1 }}>
                  {numberDetails.phone_number}
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>Monthly</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>${numberDetails.monthly_equivalent?.toFixed(2) || numberDetails.monthly_cost?.toFixed(2)}/mo</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>Total Paid</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>${numberDetails.total_paid?.toFixed(2)}</div>
                </div>
              </div>
            </div>

            <button
              onClick={() => navigate('/my-numbers')}
              style={{
                width: '100%', padding: '14px 0', borderRadius: 12, border: 'none',
                background: 'linear-gradient(135deg,#10b981,#059669)',
                color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 10,
              }}
            >
              <Phone style={{ width: 17, height: 17 }} /> View My Numbers
            </button>
            <button
              onClick={() => navigate('/sms')}
              style={{
                width: '100%', padding: '13px 0', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)',
                background: 'transparent', color: 'rgba(255,255,255,0.7)', fontWeight: 600, fontSize: 14, cursor: 'pointer',
              }}
            >
              Go to Home
            </button>
          </div>

          {/* eSIM upsell */}
          <div onClick={() => navigate('/esim')} style={{
            marginTop: 16, background: 'linear-gradient(135deg,#0d2d1a,#0a1a2e)',
            border: '1px solid rgba(16,185,129,0.3)', borderRadius: 16,
            padding: '16px 20px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14,
          }}>
            <div style={{ fontSize: 32, flexShrink: 0 }}>📡</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#fff', marginBottom: 3 }}>
                ✈️ Traveling soon? Get eSIM data
              </div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
                180+ countries · 4G/5G · from $0.54 · instant QR code
              </div>
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#10b981', flexShrink: 0 }}>Browse →</div>
          </div>
        </div>
        <BottomNav />
      </div>
    );
  }

  // ── Number purchase error ────────────────────────────────────────────────────
  if (status === 'number_error') {
    return (
      <div style={{ minHeight: '100vh', background: '#0d0d0d', paddingBottom: 100 }}>
        <div style={{ maxWidth: 520, margin: '0 auto', padding: '60px 20px 0' }}>
          <div style={{ background: '#1c1c1e', borderRadius: 24, padding: 32, textAlign: 'center', border: '1px solid rgba(239,68,68,0.3)' }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>⚠️</div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: '#fff', marginBottom: 8 }}>Payment Received</h1>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, marginBottom: 16 }}>
              Your payment went through but we couldn't activate the number automatically.
            </p>
            <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 12, padding: '14px 16px', marginBottom: 24, fontSize: 13, color: 'rgba(255,255,255,0.6)', textAlign: 'left' }}>
              {paymentDetails?.error}
            </div>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 20 }}>
              Your wallet has been refunded. Contact <a href="mailto:support@calliotel.com" style={{ color: '#10b981' }}>support@calliotel.com</a> with your session ID: <code style={{ fontSize: 11 }}>{sessionId?.slice(0, 20)}</code>
            </p>
            <button
              onClick={() => navigate('/browse-numbers')}
              style={{ width: '100%', padding: '13px 0', borderRadius: 12, border: 'none', background: '#10b981', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
            >
              Try Again
            </button>
          </div>
        </div>
        <BottomNav />
      </div>
    );
  }

  // ── Wallet top-up success ────────────────────────────────────────────────────
  if (status === 'success') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-blue-50 to-ember-light/5 pb-24">
        <div className="max-w-2xl mx-auto px-4 py-16">
          <div className="bg-white rounded-3xl shadow-2xl p-8 text-center">
            <div className="relative mb-6">
              <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto animate-bounce">
                <CheckCircle className="w-16 h-16 text-green-600" />
              </div>
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-32 bg-green-200 rounded-full opacity-20 animate-ping"></div>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-3">Payment Successful! 🎉</h1>
            <p className="text-lg text-gray-600 mb-8">Your credits have been added to your wallet</p>
            {paymentDetails && (
              <div className="bg-gradient-to-r from-ember/5 to-ember-light/5 rounded-2xl p-6 mb-8">
                <div className="grid grid-cols-2 gap-6">
                  <div className="text-center">
                    <p className="text-sm text-gray-600 mb-1">Amount Paid</p>
                    <p className="text-2xl font-bold text-gray-900">${paymentDetails.amount?.toFixed(2) || '0.00'}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-gray-600 mb-1">Credits Added</p>
                    <p className="text-2xl font-bold text-green-600">${paymentDetails.credits_added?.toFixed(2) || '0.00'}</p>
                  </div>
                </div>
              </div>
            )}
            <div className="space-y-3">
              <button onClick={() => navigate('/browse-numbers')} className="w-full py-4 bg-gradient-to-r from-ember to-ember-dark text-white rounded-xl font-semibold hover:shadow-lg transition-all flex items-center justify-center space-x-2">
                <Phone className="w-5 h-5" /><span>Get Your Number Now</span>
              </button>
              <button onClick={() => navigate('/wallet')} className="w-full py-4 bg-gray-100 text-gray-900 rounded-xl font-semibold hover:bg-gray-200 transition-all flex items-center justify-center space-x-2">
                <ArrowRight className="w-5 h-5" /><span>View Wallet</span>
              </button>
              <button onClick={() => navigate('/sms')} className="w-full py-4 bg-gray-100 text-gray-900 rounded-xl font-semibold hover:bg-gray-200 transition-all flex items-center justify-center space-x-2">
                <Home className="w-5 h-5" /><span>Go to Home</span>
              </button>
            </div>
            <div className="mt-8 pt-6 border-t border-gray-200">
              <p className="text-sm text-gray-500">A receipt has been sent to your email</p>
            </div>
          </div>
        </div>
        <BottomNav />
      </div>
    );
  }

  if (status === 'pending') {
    return (
      <div className="min-h-screen bg-gray-50 pb-24">
        <div className="max-w-2xl mx-auto px-4 py-16">
          <div className="bg-white rounded-3xl shadow-xl p-8 text-center">
            <Loader className="w-16 h-16 text-yellow-600 animate-spin mx-auto mb-6" />
            <h1 className="text-2xl font-bold text-gray-900 mb-3">Payment Processing</h1>
            <p className="text-gray-600 mb-8">Your payment is being processed. Please check back in a few moments.</p>
            <button onClick={() => {
              setLoading(true);
              if (isNumberPurchase) completeNumberPurchase();
              else if (isTco) checkTcoStatus(tcoOrder);
              else if (isAffirm) checkAffirmStatus(affirmRef, affirmToken);
              else checkPaymentStatus();
            }} className="px-6 py-3 bg-ember text-black rounded-lg hover:bg-ember-light transition-all">
              Check Status Again
            </button>
            <p style={{ marginTop: 12, fontSize: 13, color: '#888' }}>
              If your card was charged and this persists, contact support — your balance will be credited manually.
            </p>
          </div>
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="max-w-2xl mx-auto px-4 py-16">
        <div className="bg-white rounded-3xl shadow-xl p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-4xl">❌</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-3">Payment Verification Failed</h1>
          <p className="text-gray-600 mb-8">We couldn't verify your payment. Please contact support if you were charged.</p>
          <div className="space-y-3">
            <button onClick={() => navigate('/buy-credits')} className="w-full py-3 bg-ember text-black rounded-lg hover:bg-ember-light transition-all">Try Again</button>
            <button onClick={() => navigate('/wallet')} className="w-full py-3 bg-gray-100 text-gray-900 rounded-lg hover:bg-gray-200 transition-all">Go to Wallet</button>
          </div>
        </div>
      </div>
      <BottomNav />
    </div>
  );
};

export default PaymentSuccessPage;
