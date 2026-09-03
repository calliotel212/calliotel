import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  X, User, Wallet, Phone, Settings, LogOut, Gift, Shield,
  Lock, Bell, HelpCircle, Copy, Check, ChevronRight,
  CreditCard, ArrowLeftRight, Key, Camera, Loader,
  ShieldCheck, ShieldOff, Smartphone, Download, Share, PlayCircle, MessageSquare
} from 'lucide-react';
import HowItWorksVideo from './HowItWorksVideo';
import axios from 'axios';
import safeLocalStorage from '../utils/safeLocalStorage';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const PasswordStrength = ({ password }) => {
  const checks = [
    { label: 'At least 8 characters', pass: password.length >= 8 },
    { label: 'Uppercase letter', pass: /[A-Z]/.test(password) },
    { label: 'Lowercase letter', pass: /[a-z]/.test(password) },
    { label: 'Number', pass: /[0-9]/.test(password) },
    { label: 'Special character', pass: /[^A-Za-z0-9]/.test(password) },
  ];
  const score = checks.filter(c => c.pass).length;
  const label = ['', 'Very Weak', 'Weak', 'Fair', 'Strong', 'Very Strong'][score];
  const color = ['', 'bg-red-500', 'bg-emerald-500', 'bg-yellow-500', 'bg-green-500', 'bg-emerald-500'][score];

  return (
    <div className="mt-2">
      <div className="flex gap-1 mb-1">
        {[1,2,3,4,5].map(i => (
          <div key={i} className={`h-1 flex-1 rounded-full transition-all ${i <= score ? color : 'bg-gray-700'}`} />
        ))}
      </div>
      {password && <p className={`text-xs ${['','text-red-400','text-emerald-400','text-yellow-400','text-green-400','text-emerald-400'][score]}`}>{label}</p>}
    </div>
  );
};

const AppDrawer = ({ isOpen, onClose }) => {
  const { user, logout, refreshUser } = useAuth();
  const navigate = useNavigate();
  const fileRef = useRef();
  const [copied, setCopied] = useState(false);
  const [view, setView] = useState('main');
  const [uploading, setUploading] = useState(false);

  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwLoading, setPwLoading] = useState(false);
  const [pwMsg, setPwMsg] = useState('');
  const [pwError, setPwError] = useState('');

  const [twoFaData, setTwoFaData] = useState(null);
  const [twoFaCode, setTwoFaCode] = useState('');
  const [twoFaLoading, setTwoFaLoading] = useState(false);
  const [twoFaMsg, setTwoFaMsg] = useState('');

  const [installing, setInstalling] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);

  const token = () => safeLocalStorage.getItem('token');
  const headers = () => ({ Authorization: `Bearer ${token()}` });

  const copyClientId = () => {
    if (user?.client_id) {
      navigator.clipboard.writeText(user.client_id);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleUploadPhoto = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      await axios.post(`${API}/profile/upload-avatar`, fd, {
        headers: { ...headers(), 'Content-Type': 'multipart/form-data' }
      });
      await refreshUser();
    } catch (err) {
      console.error(err);
    } finally {
      setUploading(false);
    }
  };

  const handleChangePassword = async () => {
    setPwError(''); setPwMsg('');
    if (newPw !== confirmPw) return setPwError('Passwords do not match');
    if (newPw.length < 8) return setPwError('Password must be at least 8 characters');
    setPwLoading(true);
    try {
      await axios.post(`${API}/auth/change-password`, { current_password: currentPw, new_password: newPw }, { headers: headers() });
      setPwMsg('Password changed successfully!');
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
    } catch (err) {
      setPwError(err.response?.data?.detail || 'Failed to change password');
    } finally {
      setPwLoading(false);
    }
  };

  const handle2FaSetup = async () => {
    setTwoFaLoading(true); setTwoFaMsg('');
    try {
      const res = await axios.post(`${API}/auth/2fa/setup`, {}, { headers: headers() });
      setTwoFaData(res.data);
    } catch (err) {
      setTwoFaMsg('Failed to start 2FA setup');
    } finally {
      setTwoFaLoading(false);
    }
  };

  const handle2FaEnable = async () => {
    setTwoFaLoading(true); setTwoFaMsg('');
    try {
      await axios.post(`${API}/auth/2fa/enable`, { code: twoFaCode }, { headers: headers() });
      await refreshUser();
      setTwoFaMsg('2FA enabled successfully!');
      setTwoFaData(null); setTwoFaCode('');
    } catch (err) {
      setTwoFaMsg(err.response?.data?.detail || 'Invalid code');
    } finally {
      setTwoFaLoading(false);
    }
  };

  const handle2FaDisable = async () => {
    setTwoFaLoading(true); setTwoFaMsg('');
    try {
      await axios.post(`${API}/auth/2fa/disable`, { code: twoFaCode }, { headers: headers() });
      await refreshUser();
      setTwoFaMsg('2FA disabled.');
      setTwoFaCode('');
    } catch (err) {
      setTwoFaMsg(err.response?.data?.detail || 'Invalid code');
    } finally {
      setTwoFaLoading(false);
    }
  };

  const navTo = (path) => { onClose(); navigate(path); };

  /* ── Add to Home Screen (PWA install) ─────────────────── */
  const isStandalone = typeof window !== 'undefined' && (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.navigator?.standalone
  );

  const handleAddToHomeScreen = async () => {
    if (installing) return;
    const promptEvent = typeof window !== 'undefined' ? window.__pwaPrompt : null;

    if (promptEvent) {
      setInstalling(true);
      try {
        promptEvent.prompt();
        const { outcome } = await promptEvent.userChoice;
        if (outcome === 'accepted') {
          safeLocalStorage.setItem('pwa-installed-permanently', 'true');
        }
        window.__pwaPrompt = null;
        onClose();
      } catch {
        setView('install');
      } finally {
        setInstalling(false);
      }
    } else {
      setView('install');
    }
  };

  const initials = user?.full_name
    ? user.full_name.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase()
    : user?.email?.[0]?.toUpperCase() || '?';

  if (!isOpen && !showTutorial) return null;

  return (
    <>
      {showTutorial && (
        <div
          role="dialog"
          aria-label="How Calliotel works — video tutorial"
          className="fixed inset-0 z-[100] bg-black/95 flex flex-col"
          onClick={() => setShowTutorial(false)}
        >
          <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
            <button
              onClick={(e) => { e.stopPropagation(); setShowTutorial(false); navigate('/browse-numbers'); onClose(); }}
              className="px-4 py-2 rounded-xl font-bold text-white text-sm hidden sm:flex items-center gap-2"
              style={{ background: 'linear-gradient(135deg, #10b981, #059669)', boxShadow: '0 4px 20px rgba(16,185,129,0.4)' }}
            >
              Get My First Number →
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setShowTutorial(false); }}
              className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
              aria-label="Close tutorial"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex-1 flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
            <div className="w-full" style={{ maxWidth: '100vw' }}>
              <HowItWorksVideo />
            </div>
          </div>
          <div className="absolute bottom-3 left-0 right-0 text-center text-white/40 text-xs px-4">
            Tap anywhere outside the video to close
          </div>
        </div>
      )}

      {!isOpen ? null : <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40" onClick={onClose} />
      <div className={`fixed top-0 right-0 h-full w-full max-w-xs bg-gray-950 border-l border-gray-800 z-50 shadow-2xl flex flex-col transition-transform duration-300 ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>

        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <span className="text-white font-bold text-lg">Menu</span>
          <button onClick={onClose} className="p-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">

          {view === 'main' && (
            <>
              <div className="p-4 border-b border-gray-800">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div
                      className="w-14 h-14 rounded-full bg-gradient-to-br from-emerald-500 to-amber-600 flex items-center justify-center overflow-hidden cursor-pointer"
                      onClick={() => fileRef.current?.click()}
                    >
                      {user?.profile_picture
                        ? <img src={`${BACKEND_URL}${user.profile_picture}`} alt="avatar" className="w-full h-full object-cover" />
                        : <span className="text-white font-bold text-xl">{initials}</span>
                      }
                      {uploading && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                          <Loader className="w-5 h-5 text-white animate-spin" />
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => fileRef.current?.click()}
                      className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center border-2 border-gray-950"
                    >
                      <Camera className="w-2.5 h-2.5 text-white" />
                    </button>
                    <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleUploadPhoto} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-bold truncate">{user?.full_name || 'User'}</p>
                    <p className="text-gray-400 text-xs truncate">{user?.email}</p>
                    <button onClick={copyClientId} className="flex items-center gap-1 mt-1 text-emerald-400 text-xs font-mono hover:text-emerald-300">
                      {user?.client_id}
                      {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                </div>
                {user?.two_factor_enabled && (
                  <div className="flex items-center gap-1 mt-2 text-xs text-green-400">
                    <ShieldCheck className="w-3.5 h-3.5" /> 2FA Active
                  </div>
                )}
              </div>

              <div className="p-2">
                {[
                  { icon: User,          label: 'Profile',       path: '/account' },
                  { icon: Wallet,        label: 'Wallet',        path: '/wallet' },
                  { icon: Phone,         label: 'My Numbers',    path: '/my-numbers' },
                  { icon: ArrowLeftRight,label: 'Transfer',      path: '/transfer' },
                  { icon: Gift,          label: 'Referrals',     path: '/referrals' },
                  { icon: Bell,          label: 'Notifications', path: '/notifications' },
                  { icon: Settings,      label: 'Push Alerts',   path: '/settings/notifications', isNew: true },
                  { icon: HelpCircle,    label: 'Help & Support',path: '/help' },
                ].map(item => (
                  <button key={item.path} onClick={() => navTo(item.path)}
                    className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-gray-800 text-gray-300 hover:text-white transition-colors text-sm">
                    <item.icon className={`w-4 h-4 ${item.isNew ? 'text-purple-400' : 'text-emerald-400'}`} />
                    <span className="flex-1 text-left">{item.label}</span>
                    {item.isNew && (
                      <span className="px-2 py-0.5 text-[9px] font-bold rounded-full text-white mr-1"
                        style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)' }}>NEW</span>
                    )}
                    <ChevronRight className="w-4 h-4 text-gray-600" />
                  </button>
                ))}

                <div className="my-2 border-t border-gray-800" />

                {/* ── How to Use video ── */}
                <button onClick={() => setShowTutorial(true)}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-gray-800 text-gray-300 hover:text-white transition-colors text-sm">
                  <PlayCircle className="w-4 h-4 text-emerald-400" />
                  <span className="flex-1 text-left">How to Use</span>
                  <span className="text-[10px] uppercase tracking-wider text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full font-bold">Video</span>
                  <ChevronRight className="w-4 h-4 text-gray-600" />
                </button>

                {/* ── Add to Home Screen (PWA install) ── */}
                {!isStandalone && (
                  <button onClick={handleAddToHomeScreen} disabled={installing}
                    className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-gray-800 text-gray-300 hover:text-white transition-colors text-sm group relative overflow-hidden disabled:opacity-60 disabled:cursor-wait">
                    <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/0 via-emerald-500/10 to-emerald-500/0 opacity-0 group-hover:opacity-100 transition-opacity" />
                    {installing
                      ? <Loader className="w-4 h-4 text-emerald-400 relative animate-spin" />
                      : <Smartphone className="w-4 h-4 text-emerald-400 relative" />}
                    <span className="flex-1 text-left relative">{installing ? 'Installing…' : 'Add to Home Screen'}</span>
                    {!installing && <span className="text-[10px] uppercase tracking-wider text-amber-300 bg-amber-300/10 px-2 py-0.5 rounded-full font-bold relative">✨ Shine</span>}
                    <ChevronRight className="w-4 h-4 text-gray-600 relative" />
                  </button>
                )}

                <div className="my-2 border-t border-gray-800" />

                <button onClick={() => setView('password')}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-gray-800 text-gray-300 hover:text-white transition-colors text-sm">
                  <Lock className="w-4 h-4 text-emerald-400" />
                  <span className="flex-1 text-left">Change Password</span>
                  <ChevronRight className="w-4 h-4 text-gray-600" />
                </button>

                <button onClick={() => setView('2fa')}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-gray-800 text-gray-300 hover:text-white transition-colors text-sm">
                  <Shield className="w-4 h-4 text-emerald-400" />
                  <span className="flex-1 text-left">Two-Factor Auth (2FA)</span>
                  <div className="flex items-center gap-2">
                    {user?.two_factor_enabled
                      ? <span className="text-xs text-green-400 bg-green-400/10 px-2 py-0.5 rounded-full">On</span>
                      : <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full">Off</span>
                    }
                    <ChevronRight className="w-4 h-4 text-gray-600" />
                  </div>
                </button>

                <div className="my-2 border-t border-gray-800" />

                <button onClick={() => { logout(); onClose(); navigate('/login'); }}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-red-500/10 text-red-400 transition-colors text-sm">
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out</span>
                </button>
              </div>
            </>
          )}

          {view === 'install' && (
            <div className="p-4">
              <button onClick={() => setView('main')} className="flex items-center gap-2 text-gray-400 hover:text-white text-sm mb-4 transition-colors">
                <ChevronRight className="w-4 h-4 rotate-180" /> Back
              </button>

              <div className="rounded-2xl overflow-hidden mb-4" style={{ background: 'linear-gradient(135deg, #059669, #10b981)' }}>
                <div className="p-5 flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                    <Smartphone className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-white font-bold text-lg leading-tight">Install Calliotel</h3>
                    <p className="text-white/85 text-xs">Add to your home screen — let it shine ✨</p>
                  </div>
                </div>
              </div>

              {(() => {
                const ua = (typeof navigator !== 'undefined' ? navigator.userAgent : '').toLowerCase();
                const isIOS = /iphone|ipad|ipod/.test(ua);
                const isAndroid = /android/.test(ua);

                if (isIOS) {
                  return (
                    <div>
                      <p className="text-gray-300 text-sm mb-4">Install on your iPhone or iPad in 3 quick steps:</p>
                      <div className="space-y-3 mb-4">
                        {[
                          { n: 1, txt: <>Tap the <Share className="inline w-4 h-4 mx-1 text-emerald-400" /> <strong className="text-white">Share</strong> button in Safari</> },
                          { n: 2, txt: <>Scroll down and tap <strong className="text-white">"Add to Home Screen"</strong></> },
                          { n: 3, txt: <>Tap <strong className="text-white">"Add"</strong> in the top-right to confirm</> },
                        ].map(({ n, txt }) => (
                          <div key={n} className="flex items-start gap-3">
                            <div className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-bold text-xs flex-shrink-0">{n}</div>
                            <p className="text-gray-300 text-sm pt-1">{txt}</p>
                          </div>
                        ))}
                      </div>
                      <div className="rounded-lg p-3 text-xs text-blue-300 bg-blue-500/10 border border-blue-500/20">
                        💡 The Share icon looks like a square with an arrow pointing up at the bottom of Safari.
                      </div>
                    </div>
                  );
                }

                return (
                  <div>
                    <p className="text-gray-300 text-sm mb-4">
                      {isAndroid
                        ? 'Add Calliotel to your home screen for the fastest experience — no browser tabs, push notifications, and offline access.'
                        : 'Install Calliotel as a desktop app for instant access without opening a browser.'}
                    </p>
                    <div className="space-y-3 mb-4">
                      {(isAndroid
                        ? [
                            { n: 1, txt: <>Tap the <strong className="text-white">⋮ menu</strong> in the top-right of Chrome</> },
                            { n: 2, txt: <>Choose <strong className="text-white">"Add to Home screen"</strong> or <strong className="text-white">"Install app"</strong></> },
                            { n: 3, txt: <>Tap <strong className="text-white">"Install"</strong> to confirm</> },
                          ]
                        : [
                            { n: 1, txt: <>Look for the <strong className="text-white">install icon ⊕</strong> in your browser's address bar</> },
                            { n: 2, txt: <>Or open the browser menu and choose <strong className="text-white">"Install Calliotel"</strong></> },
                            { n: 3, txt: <>Click <strong className="text-white">"Install"</strong> to confirm</> },
                          ]
                      ).map(({ n, txt }) => (
                        <div key={n} className="flex items-start gap-3">
                          <div className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-bold text-xs flex-shrink-0">{n}</div>
                          <p className="text-gray-300 text-sm pt-1">{txt}</p>
                        </div>
                      ))}
                    </div>
                    <div className="rounded-lg p-3 text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20">
                      💡 If your browser supports one-tap install, the prompt will pop up automatically.
                    </div>
                  </div>
                );
              })()}

              <div className="grid grid-cols-2 gap-2 mt-5">
                {['⚡ Instant access', '📵 Works offline', '🔔 Push alerts', '🖥️ Full-screen'].map(b => (
                  <span key={b} className="text-xs text-gray-400 px-2 py-2 bg-gray-900 rounded-lg text-center">{b}</span>
                ))}
              </div>
            </div>
          )}

          {view === 'password' && (
            <div className="p-4">
              <button onClick={() => { setView('main'); setPwMsg(''); setPwError(''); }} className="flex items-center gap-2 text-gray-400 hover:text-white text-sm mb-4 transition-colors">
                <ChevronRight className="w-4 h-4 rotate-180" /> Back
              </button>
              <h3 className="text-white font-bold text-lg mb-4">Change Password</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-gray-400 text-xs mb-1 block">Current Password</label>
                  <input type="password" value={currentPw} onChange={e => setCurrentPw(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-emerald-500" placeholder="••••••••" />
                </div>
                <div>
                  <label className="text-gray-400 text-xs mb-1 block">New Password</label>
                  <input type="password" value={newPw} onChange={e => setNewPw(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-emerald-500" placeholder="••••••••" />
                  {newPw && <PasswordStrength password={newPw} />}
                </div>
                <div>
                  <label className="text-gray-400 text-xs mb-1 block">Confirm New Password</label>
                  <input type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-emerald-500" placeholder="••••••••" />
                </div>
                {pwError && <p className="text-red-400 text-sm">{pwError}</p>}
                {pwMsg && <p className="text-green-400 text-sm">{pwMsg}</p>}
                <button onClick={handleChangePassword} disabled={pwLoading}
                  className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white py-3 rounded-xl font-bold text-sm transition-colors flex items-center justify-center gap-2">
                  {pwLoading ? <><Loader className="w-4 h-4 animate-spin" /> Saving...</> : 'Update Password'}
                </button>
              </div>
            </div>
          )}

          {view === '2fa' && (
            <div className="p-4">
              <button onClick={() => { setView('main'); setTwoFaMsg(''); setTwoFaData(null); setTwoFaCode(''); }} className="flex items-center gap-2 text-gray-400 hover:text-white text-sm mb-4 transition-colors">
                <ChevronRight className="w-4 h-4 rotate-180" /> Back
              </button>
              <h3 className="text-white font-bold text-lg mb-1">Two-Factor Auth</h3>
              <p className="text-gray-400 text-xs mb-4">Secure your account with Google Authenticator or any TOTP app.</p>

              {!user?.two_factor_enabled ? (
                <>
                  {!twoFaData ? (
                    <button onClick={handle2FaSetup} disabled={twoFaLoading}
                      className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2">
                      {twoFaLoading ? <><Loader className="w-4 h-4 animate-spin" />Setting up...</> : <><ShieldCheck className="w-4 h-4" /> Set Up 2FA</>}
                    </button>
                  ) : (
                    <div className="space-y-4">
                      <div className="bg-white p-3 rounded-xl flex items-center justify-center">
                        <img src={`data:image/png;base64,${twoFaData.qr_code}`} alt="QR Code" className="w-40 h-40" />
                      </div>
                      <p className="text-gray-400 text-xs text-center">Scan with Google Authenticator, Authy, or any TOTP app</p>
                      <div className="bg-gray-800 rounded-xl p-3">
                        <p className="text-gray-500 text-xs mb-1">Manual entry key:</p>
                        <p className="text-white font-mono text-xs break-all">{twoFaData.secret}</p>
                      </div>
                      <div>
                        <label className="text-gray-400 text-xs mb-1 block">Enter 6-digit code from app</label>
                        <input type="text" maxLength={6} value={twoFaCode} onChange={e => setTwoFaCode(e.target.value.replace(/\D/g,''))}
                          className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-center text-xl font-mono tracking-widest focus:outline-none focus:border-emerald-500" placeholder="000000" />
                      </div>
                      {twoFaMsg && <p className={`text-sm ${twoFaMsg.includes('success') ? 'text-green-400' : 'text-red-400'}`}>{twoFaMsg}</p>}
                      <button onClick={handle2FaEnable} disabled={twoFaLoading || twoFaCode.length < 6}
                        className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2">
                        {twoFaLoading ? <><Loader className="w-4 h-4 animate-spin" />Verifying...</> : 'Activate 2FA'}
                      </button>
                      <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3">
                        <p className="text-amber-400 text-xs font-semibold mb-1">Save your backup codes:</p>
                        <div className="grid grid-cols-2 gap-1">
                          {twoFaData.backup_codes.map((c,i) => (
                            <span key={i} className="text-white font-mono text-xs bg-gray-800 px-2 py-1 rounded">{c}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/30 rounded-xl p-3">
                    <ShieldCheck className="w-5 h-5 text-green-400" />
                    <p className="text-green-400 text-sm font-semibold">2FA is active on your account</p>
                  </div>
                  <div>
                    <label className="text-gray-400 text-xs mb-1 block">Enter code to disable 2FA</label>
                    <input type="text" maxLength={6} value={twoFaCode} onChange={e => setTwoFaCode(e.target.value.replace(/\D/g,''))}
                      className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-center text-xl font-mono tracking-widest focus:outline-none focus:border-emerald-500" placeholder="000000" />
                  </div>
                  {twoFaMsg && <p className={`text-sm ${twoFaMsg.includes('disabled') ? 'text-green-400' : 'text-red-400'}`}>{twoFaMsg}</p>}
                  <button onClick={handle2FaDisable} disabled={twoFaLoading || twoFaCode.length < 6}
                    className="w-full bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2">
                    {twoFaLoading ? <><Loader className="w-4 h-4 animate-spin" />...</> : <><ShieldOff className="w-4 h-4" /> Disable 2FA</>}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      </>}
    </>
  );
};

export default AppDrawer;
