import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Mail, Clock, Grid3x3, UserCircle2, Coins } from 'lucide-react';

const AMBER = '#F5A623';

const BottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { icon: Mail,        label: 'SMS',      path: '/sms' },
    { icon: Clock,       label: 'History',  path: '/call-history' },
    { icon: Grid3x3,     label: 'Keypad',   path: '/keypad' },
    { icon: UserCircle2, label: 'Contacts', path: '/contacts' },
    { icon: Coins,       label: 'Account',  path: '/account' },
  ];

  const isActive = (path) => {
    if (path === '/account') {
      return ['/account', '/wallet', '/profile/settings', '/my-numbers', '/browse-numbers', '/buy-credits', '/one-otp', '/services', '/proxy'].includes(location.pathname);
    }
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50"
      style={{
        background: 'var(--bottom-nav-bg)',
        borderTop: '1px solid var(--bottom-nav-border)',
        boxShadow: '0 -4px 24px var(--bottom-nav-shadow)',
        transition: 'background 0.2s, border-color 0.2s',
      }}
    >
      <div
        className="flex justify-around items-center px-1"
        style={{ paddingTop: '10px', paddingBottom: 'calc(10px + max(env(safe-area-inset-bottom), var(--tg-safe-area-inset-bottom, 0px)))' }}
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              aria-label={item.label}
              aria-current={active ? 'page' : undefined}
              className="flex flex-col items-center justify-center flex-1 py-1 transition-all"
              style={{ minWidth: 0, background: 'none', border: 'none' }}
            >
              <div style={{
                padding: '5px 14px',
                borderRadius: 20,
                background: active ? 'rgba(245,166,35,0.22)' : 'transparent',
                transition: 'background 0.2s',
              }}>
                <Icon
                  style={{ width: 24, height: 24, color: AMBER }}
                  strokeWidth={active ? 2.6 : 2.15}
                />
              </div>
              <span style={{
                fontSize: 11,
                fontWeight: active ? 800 : 700,
                color: AMBER,
                marginTop: 2,
                lineHeight: 1,
                letterSpacing: '0.2px',
              }}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
