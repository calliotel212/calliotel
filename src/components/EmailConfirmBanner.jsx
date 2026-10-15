import React, { useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function EmailConfirmBanner() {
  const { user, refreshUser } = useAuth();
  const [state, setState] = useState('idle');
  const [note, setNote] = useState('');

  if (!user || !user.email_confirmation_required) return null;

  const resend = async () => {
    setState('sending');
    try {
      await axios.post(`${API}/email/resend?email=${encodeURIComponent(user.email)}`);
      setState('sent');
      setNote('Link sent. Check your inbox and spam folder.');
    } catch (err) {
      setState('idle');
      setNote(err?.response?.data?.detail || 'Could not send right now. Please try again in a minute.');
    }
  };

  const recheck = async () => {
    setNote('');
    await refreshUser();
  };

  return (
    <div
      className="w-full px-4 py-3 text-sm flex flex-wrap items-center justify-center gap-3"
      style={{ background: 'rgba(245,166,35,0.14)', borderBottom: '1px solid rgba(245,166,35,0.35)', color: '#fcd34d' }}
    >
      <span>
        Confirm your email <strong>{user.email}</strong> to buy numbers and top-up services.
      </span>
      <button
        type="button"
        onClick={resend}
        disabled={state !== 'idle'}
        className="px-3 py-1 rounded-md font-semibold disabled:opacity-60"
        style={{ background: '#F5A623', color: '#000' }}
      >
        {state === 'sending' ? 'Sending…' : state === 'sent' ? 'Sent' : 'Resend link'}
      </button>
      <button type="button" onClick={recheck} className="underline">
        I confirmed it
      </button>
      {note && <span className="w-full text-center text-xs opacity-90">{note}</span>}
    </div>
  );
}
