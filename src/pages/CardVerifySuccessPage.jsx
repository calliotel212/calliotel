import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import safeLocalStorage from '../utils/safeLocalStorage';
import { CheckCircle, Loader, XCircle } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function CardVerifySuccessPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const sessionId = searchParams.get('session_id');
  const [status, setStatus] = useState('checking');

  useEffect(() => {
    if (!sessionId) { navigate('/sms'); return; }
    const token = safeLocalStorage.getItem('token');
    let attempts = 0;

    const poll = async () => {
      try {
        const res = await axios.get(
          `${API}/wallet/card-verify-status?session_id=${sessionId}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (res.data.status === 'completed') {
          setStatus('success');
          setTimeout(() => navigate('/sms'), 3500);
        } else if (attempts < 10) {
          attempts++;
          setTimeout(poll, 2000);
        } else {
          setStatus('error');
        }
      } catch {
        setStatus('error');
      }
    };

    poll();
  }, [sessionId, navigate]);

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="text-center max-w-sm w-full">
        <div className="bg-gray-900 border border-gray-800 rounded-3xl p-10">

          {status === 'checking' && (
            <>
              <Loader className="w-14 h-14 text-blue-400 animate-spin mx-auto mb-5" />
              <h2 className="text-xl font-bold text-white mb-2">Verifying your card…</h2>
              <p className="text-gray-400 text-sm">Hang tight, this takes just a second.</p>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="w-20 h-20 rounded-full bg-green-500/15 flex items-center justify-center mx-auto mb-5">
                <CheckCircle className="w-12 h-12 text-green-400" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Card Verified! 🎉</h2>
              <p className="text-gray-300 mb-1 text-base">
                Your card is confirmed. Now <span className="font-bold text-emerald-400">top up $2+</span> to unlock your <span className="font-bold text-emerald-400">$0.99 bonus</span>!
              </p>
              <p className="text-gray-500 text-sm mt-3">Redirecting to dashboard…</p>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="w-20 h-20 rounded-full bg-red-500/15 flex items-center justify-center mx-auto mb-5">
                <XCircle className="w-12 h-12 text-red-400" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Something went wrong</h2>
              <p className="text-gray-400 text-sm mb-6">
                The credit may still be applied. Check your wallet balance.
              </p>
              <button
                onClick={() => navigate('/sms')}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-semibold transition-colors w-full"
              >
                Go to Home
              </button>
            </>
          )}

        </div>
      </div>
    </div>
  );
}
