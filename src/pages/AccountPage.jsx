import React, { useState } from 'react';
import { Copy, Check, ChevronRight, LogOut, Sun, Moon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import BottomNav from '../components/BottomNav';

const ORANGE = '#FF6600';

const MenuRow = ({ emoji, label, onClick, badge }) => (
  <button
    onClick={onClick}
    className="w-full flex items-center gap-4 px-5 active:bg-gray-900 transition-colors"
    style={{ background: 'transparent', border: 'none', paddingTop: 16, paddingBottom: 16 }}>
    <span style={{ fontSize: 22, lineHeight: 1, width: 32, textAlign: 'center' }}>{emoji}</span>
    <span className="flex-1 text-left" style={{ minWidth: 0 }}>
      {badge && (
        <span style={{
          display: 'inline-block',
          fontSize: 9,
          fontWeight: 800,
          letterSpacing: '0.08em',
          color: '#111',
          background: '#F5A623',
          borderRadius: 4,
          padding: '1px 6px',
          marginBottom: 3,
          lineHeight: 1.4,
        }}>
          {badge}
        </span>
      )}
      <span className="font-semibold block" style={{ fontSize: 15, color: 'var(--text-1)' }}>{label}</span>
    </span>
    <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--text-3)' }} />
  </button>
);

const Divider = () => <div style={{ height: 1, background: '#1e1e1e', marginLeft: 64 }} />;

const AccountPage = () => {
  const [copied, setCopied] = useState(false);
  const { user, logout, balance } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { darkMode, toggleDarkMode } = useTheme();

  const copyClientId = () => {
    if (user?.client_id) {
      navigator.clipboard.writeText(user.client_id).catch(() => {});
      setCopied(true);
      toast({ title: 'Copied!', description: 'Client ID copied to clipboard' });
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleLogout = () => { logout(); navigate('/'); };

  const displayNumber = user?.phone_number || user?.client_id || user?.email || '';

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-page)', paddingBottom: 72 }}>

      {/* Header */}
      <div style={{ background: 'var(--bg-page)', borderBottom: '1px solid #1e1e1e' }}>
        <div className="px-5 h-14 flex items-center justify-between">
          <h1 className="text-lg font-bold" style={{ color: 'var(--text-1)' }}>My Account</h1>
          <button onClick={handleLogout} className="p-2" style={{ color: '#555' }}>
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Profile card */}
      <div className="px-5 pt-6 pb-6" style={{ background: 'var(--bg-card)', borderBottom: '1px solid #2a2a2a' }}>
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full" style={{ background: '#22c55e', flexShrink: 0 }} />
              <span className="font-bold text-sm" style={{ color: '#22c55e' }}>Online</span>
            </div>
            <div className="flex items-center gap-2">
              <p className="font-mono text-sm" style={{ color: '#999' }}>
                User: {displayNumber}
              </p>
              <button onClick={copyClientId} className="p-0.5">
                {copied
                  ? <Check className="w-4 h-4" style={{ color: '#22c55e' }} />
                  : <Copy className="w-4 h-4" style={{ color: '#555' }} />
                }
              </button>
            </div>
          </div>

          {/* Balance pill */}
          {balance !== null && (
            <div style={{
              background: 'rgba(255,102,0,0.12)',
              border: '1px solid rgba(255,102,0,0.3)',
              borderRadius: 12,
              padding: '8px 16px',
              textAlign: 'center',
            }}>
              <p style={{ fontSize: 11, color: ORANGE, fontWeight: 600, marginBottom: 2 }}>BALANCE</p>
              <p style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-1)', lineHeight: 1 }}>
                ${balance.toFixed(2)}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Menu groups */}
      <div style={{ background: 'var(--bg-card)', borderBottom: '1px solid #2a2a2a', marginTop: 8 }}>
        <MenuRow emoji="🪙" label="Buy Credits"         onClick={() => navigate('/buy-credits')} />
        <Divider />
        <MenuRow emoji="↔️" label="Balance Transfer"    onClick={() => navigate('/transfer')} />
        <Divider />
        <MenuRow emoji="🕐" label="Transaction History" onClick={() => navigate('/wallet')} />
      </div>

      <div style={{ background: 'var(--bg-card)', borderBottom: '1px solid #2a2a2a', marginTop: 8 }}>
        <MenuRow emoji="📶" label="Buy a Number"        onClick={() => navigate('/browse-numbers')} />
        <Divider />
        <MenuRow emoji="🔢" label="One-time OTP · 800+ apps" badge="NEW" onClick={() => navigate('/one-otp')} />
        <Divider />
        <MenuRow emoji="🌐" label="Calliotel Proxy" badge="NEW" onClick={() => navigate('/proxy')} />
        <Divider />
        <MenuRow emoji="🌐" label="My Numbers"          onClick={() => navigate('/my-numbers')} />
        <Divider />
        <MenuRow emoji="📬" label="Voicemail"           onClick={() => navigate('/voicemail')} />
        <Divider />
        <MenuRow emoji="🎙️" label="Call Recordings"    onClick={() => navigate('/recordings')} />
        <Divider />
        <MenuRow emoji="📡" label="eSIM Data Plans"     onClick={() => navigate('/esim')} />
        <Divider />
        <MenuRow emoji="💾" label="My esim"             onClick={() => navigate('/my-esims')} />
      </div>

      <div style={{ background: 'var(--bg-card)', borderBottom: '1px solid #2a2a2a', marginTop: 8 }}>
        <MenuRow emoji="🔔" label="Notifications"       onClick={() => navigate('/notifications')} />
        <Divider />
        <MenuRow emoji="⚙️" label="Push Alerts"         badge="NEW" onClick={() => navigate('/settings/notifications')} />
        <Divider />
        <MenuRow emoji="🎫" label="Support tickets"     onClick={() => navigate('/support')} />
        <Divider />
        <MenuRow emoji="❓" label="Help"                onClick={() => navigate('/help')} />
      </div>

      {/* Appearance */}
      <div style={{ background: 'var(--bg-card)', borderBottom: '1px solid #2a2a2a', marginTop: 8 }}>
        <button
          onClick={toggleDarkMode}
          className="w-full flex items-center gap-4 px-5 active:bg-gray-900 transition-colors"
          style={{ background: 'transparent', border: 'none', paddingTop: 16, paddingBottom: 16 }}
        >
          <span style={{ fontSize: 22, lineHeight: 1, width: 32, textAlign: 'center' }}>
            {darkMode ? '🌙' : '☀️'}
          </span>
          <span className="flex-1 text-left font-semibold" style={{ fontSize: 15, color: 'var(--text-1)' }}>
            {darkMode ? 'Dark Mode' : 'Light Mode'}
          </span>
          {/* Toggle pill */}
          <div style={{
            width: 48, height: 26, borderRadius: 13, padding: 3,
            background: darkMode ? '#F5A623' : '#555',
            display: 'flex', alignItems: 'center',
            justifyContent: darkMode ? 'flex-end' : 'flex-start',
            transition: 'background 0.2s, justify-content 0.2s',
            flexShrink: 0,
          }}>
            <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
          </div>
        </button>
      </div>

      <p className="text-center text-xs py-5" style={{ color: '#333' }}>Calliotel v1.0</p>

      <BottomNav />
    </div>
  );
};

export default AccountPage;
