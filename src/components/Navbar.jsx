import React, { useState } from 'react';
import { Menu, X, Sun, Moon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const Navbar = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const navigate = useNavigate();
  const { isAuthenticated, branding } = useAuth();
  const { darkMode, toggleDarkMode } = useTheme();

  const go = (path) => { navigate(path); setIsMenuOpen(false); };

  const isSubAccount = !!(branding && branding.branded);
  const brandName = isSubAccount ? branding.display_name : 'Calliotel';

  const navLinks = isSubAccount ? [] : [
    { label: '📱 Virtual Numbers', path: '/browse-numbers' },
    { label: '💰 Pricing',          path: '/pricing' },
  ];

  return (
    <nav style={{
      position: 'fixed', top: 0, left: 0, right: 0,
      background: 'var(--nav-bg)',
      borderBottom: '1px solid var(--nav-border)',
      zIndex: 50,
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      transition: 'background 0.2s, border-color 0.2s',
    }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 20px', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>

        {/* Logo */}
        <div onClick={() => go(isSubAccount ? '/dashboard' : '/')} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', flexShrink: 0 }}>
          {isSubAccount && branding?.logo_url ? (
            <img src={branding.logo_url} alt={brandName} style={{
              width: 38, height: 38, borderRadius: 10, objectFit: 'contain',
              background: '#fff', padding: 2,
              boxShadow: '0 0 20px rgba(255,255,255,0.15)'
            }} />
          ) : (
            <div style={{
              width: 38, height: 38, borderRadius: 10,
              background: 'linear-gradient(135deg, #F5A623 0%, #d4901d 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 20px rgba(245,166,35,0.4)'
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                <path d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56a.977.977 0 0 0-1.01.24l-1.57 1.97c-2.83-1.35-5.48-3.9-6.89-6.83l1.95-1.66c.27-.28.35-.67.24-1.02-.37-1.11-.56-2.3-.56-3.53 0-.54-.45-.99-.99-.99H4.19C3.65 3 3 3.24 3 3.99 3 13.28 10.73 21 20.01 21c.71 0 .99-.63.99-1.18v-3.45c0-.54-.45-.99-.99-.99z"/>
              </svg>
            </div>
          )}
          <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-1)', letterSpacing: '-0.5px' }}>{brandName}</span>
        </div>

        {/* Desktop Nav */}
        <div className="hidden lg:flex" style={{ alignItems: 'center', gap: 6 }}>
          {navLinks.map(l => (
            <button key={l.path} onClick={() => go(l.path)} style={{
              padding: '8px 14px', borderRadius: 8, fontSize: 13.5, fontWeight: 600,
              color: 'var(--nav-text)', background: 'transparent', border: 'none',
              cursor: 'pointer', transition: 'color 0.15s, background-color 0.15s', whiteSpace: 'nowrap'
            }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-1)'; e.currentTarget.style.background = 'var(--nav-text-hover-bg)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--nav-text)'; e.currentTarget.style.background = 'transparent'; }}
            >
              {l.label}
            </button>
          ))}

          <div style={{ width: 1, height: 20, background: 'var(--divider)', margin: '0 6px' }} />

          {/* Theme toggle */}
          <button
            onClick={toggleDarkMode}
            title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            style={{
              height: 34, borderRadius: 8, padding: '0 12px',
              background: 'var(--hamburger-bg)',
              border: '1px solid rgba(245,166,35,0.25)',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
              color: 'var(--text-1)',
              transition: 'background 0.15s',
              flexShrink: 0,
              fontSize: 12, fontWeight: 600,
            }}
          >
            {darkMode
              ? <><Sun size={14} strokeWidth={2} /><span>Light</span></>
              : <><Moon size={14} strokeWidth={2} /><span>Dark</span></>
            }
          </button>

          <div style={{ width: 1, height: 20, background: 'var(--divider)', margin: '0 6px' }} />

          {isAuthenticated ? (
            <button onClick={() => go('/dashboard')} style={{
              padding: '8px 20px', borderRadius: 8, fontSize: 13.5, fontWeight: 700,
              color: '#000', background: 'linear-gradient(135deg, #F5A623, #d4901d)',
              border: 'none', cursor: 'pointer', boxShadow: '0 2px 12px rgba(245,166,35,0.35)',
              transition: 'opacity 0.15s'
            }}>
              Dashboard →
            </button>
          ) : (
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => go('/login')} style={{
                padding: '8px 16px', borderRadius: 8, fontSize: 13.5, fontWeight: 600,
                color: 'var(--login-btn-color)', background: 'transparent',
                border: '1px solid var(--login-btn-border)',
                cursor: 'pointer', transition: 'color 0.15s, background-color 0.15s'
              }}>
                Log In
              </button>
              <button onClick={() => go('/signup')} style={{
                padding: '8px 20px', borderRadius: 8, fontSize: 13.5, fontWeight: 700,
                color: '#000', background: 'linear-gradient(135deg, #F5A623, #d4901d)',
                border: 'none', cursor: 'pointer', boxShadow: '0 2px 12px rgba(245,166,35,0.35)',
                transition: 'opacity 0.15s'
              }}>
                Get Started
              </button>
            </div>
          )}
        </div>

        {/* Mobile: theme toggle + hamburger */}
        <div className="lg:hidden" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={toggleDarkMode}
            title={darkMode ? 'Light mode' : 'Dark mode'}
            style={{
              width: 36, height: 36, borderRadius: 8,
              background: 'var(--hamburger-bg)',
              border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--hamburger-color)',
            }}
          >
            {darkMode ? <Sun size={17} strokeWidth={2} /> : <Moon size={17} strokeWidth={2} />}
          </button>
          <button onClick={() => setIsMenuOpen(v => !v)} style={{
            padding: 8, borderRadius: 8,
            background: 'var(--hamburger-bg)',
            border: 'none', cursor: 'pointer',
            color: 'var(--hamburger-color)',
          }}>
            {isMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {isMenuOpen && (
        <div className="lg:hidden" style={{
          borderTop: '1px solid var(--nav-border)',
          padding: '12px 16px 16px',
          display: 'flex', flexDirection: 'column', gap: 6,
          background: 'var(--mobile-menu-bg)',
        }}>
          {navLinks.map(l => (
            <button key={l.path} onClick={() => go(l.path)} style={{
              width: '100%', padding: '13px 16px', borderRadius: 10, fontSize: 15,
              fontWeight: 600, color: 'var(--text-1)',
              background: 'var(--mobile-menu-btn-bg)',
              border: '1px solid var(--mobile-menu-btn-border)',
              cursor: 'pointer', textAlign: 'left', transition: 'background-color 0.15s'
            }}>
              {l.label}
            </button>
          ))}
          <div style={{ height: 1, background: 'var(--mobile-menu-divider)', margin: '4px 0' }} />
          {isAuthenticated ? (
            <button onClick={() => go('/dashboard')} style={{
              width: '100%', padding: '13px 16px', borderRadius: 10, fontSize: 15,
              fontWeight: 700, color: '#000', background: 'linear-gradient(135deg, #F5A623, #d4901d)',
              border: 'none', cursor: 'pointer', textAlign: 'left'
            }}>
              Dashboard →
            </button>
          ) : (
            <>
              <button onClick={() => go('/login')} style={{
                width: '100%', padding: '13px 16px', borderRadius: 10, fontSize: 15,
                fontWeight: 600, color: 'var(--login-btn-color)',
                background: 'var(--mobile-menu-btn-bg)',
                border: '1px solid var(--login-btn-border)',
                cursor: 'pointer', textAlign: 'left'
              }}>
                Log In
              </button>
              <button onClick={() => go('/signup')} style={{
                width: '100%', padding: '13px 16px', borderRadius: 10, fontSize: 15,
                fontWeight: 700, color: '#000', background: 'linear-gradient(135deg, #F5A623, #d4901d)',
                border: 'none', cursor: 'pointer', textAlign: 'left'
              }}>
                Get Started — It's Free
              </button>
            </>
          )}
        </div>
      )}
    </nav>
  );
};

export default Navbar;
