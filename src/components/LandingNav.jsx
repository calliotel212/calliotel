import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import { TELEGRAM_MINI_APP_URL } from '../utils/telegramMiniApp';

const LandingNav = () => {
  const navigate = useNavigate();
  const [productsMenuOpen, setProductsMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const products = [
    { icon: '📱', color: '#F5A623', label: 'Virtual Numbers', desc: 'US · UK · CA · NL · SE — from $1.99/mo', route: '/browse-numbers' },
    { icon: '🔢', color: '#F5A623', label: '180+ Services', desc: 'Search WhatsApp, Instagram and 180+ more — from $0.99', route: '/services' },
    { icon: '📡', color: '#10b981', label: 'eSIM', desc: 'Buy mobile data — 180+ countries from $0.54', route: '/esim' },
    { icon: '📞', color: '#3b82f6', label: 'Calling Plans', desc: 'Talk Starter $5 — 60 min US/CA, then $0.02/min', route: '/buy-credits?amount=5&offer=talk' },
  ];

  return (
    <nav className="sticky top-0 z-[100] border-b border-white/[.07] backdrop-blur-[12px]"
      style={{ background: 'rgba(6,6,16,0.97)' }}>
      <div className="max-w-[1280px] mx-auto px-5 h-16 flex items-center justify-between">

        {/* Logo */}
        <div className="flex items-center gap-[10px] cursor-pointer flex-shrink-0" onClick={() => navigate('/')}>
          <img src="/logo.png" alt="Calliotel" className="w-9 h-9 rounded-[10px]" />
          <span className="text-lg font-black tracking-[-0.5px] text-white">CALLIOTEL</span>
        </div>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-0.5">
          {/* Products dropdown */}
          <div className="relative"
            onMouseEnter={() => setProductsMenuOpen(true)}
            onMouseLeave={() => setProductsMenuOpen(false)}>
            <button className={`px-[13px] py-[7px] rounded-[10px] text-sm font-medium border-none cursor-pointer flex items-center gap-1 transition-colors ${productsMenuOpen ? 'text-white bg-white/[.07]' : 'text-white/60 bg-transparent'}`}>
              Products <ChevronDown className="w-[14px] h-[14px]" style={{ transform: productsMenuOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
            </button>
            {productsMenuOpen && (
              <div className="absolute top-full left-0 mt-2 min-w-[300px] flex flex-col gap-1 p-[10px] rounded-2xl"
                style={{ background: 'rgba(12,12,24,0.99)', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 24px 60px rgba(0,0,0,0.6)' }}>
                {products.map(p => (
                  <button key={p.route}
                    onClick={() => { navigate(p.route); setProductsMenuOpen(false); }}
                    className="flex items-center gap-3 px-3 py-[10px] rounded-[10px] bg-transparent border-none cursor-pointer text-left hover:bg-white/[.05] transition-colors">
                    <div className="w-9 h-9 rounded-[10px] flex items-center justify-center text-lg flex-shrink-0"
                      style={{ background: `${p.color}22` }}>{p.icon}</div>
                    <div>
                      <div className="text-sm font-bold text-white mb-0.5">{p.label}</div>
                      <div className="text-xs text-white/50">{p.desc}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {[
            { label: 'Pricing', route: '/pricing' },
            { label: 'Developers', route: '/reseller-api' },
            { label: 'Help', route: '/help' },
          ].map(item => (
            <button key={item.route} onClick={() => navigate(item.route)}
              className="px-[13px] py-[7px] rounded-[10px] text-sm text-white/60 font-medium bg-transparent border-none cursor-pointer hover:text-white hover:bg-white/[.07] transition-colors">
              {item.label}
            </button>
          ))}
        </div>

        {/* Right CTAs */}
        <div className="flex items-center gap-2">
          <a href="https://www.facebook.com/profile.php?id=61592602614979" target="_blank" rel="noopener noreferrer"
            aria-label="Calliotel on Facebook (opens in a new tab)"
            className="hidden md:flex items-center gap-[5px] px-[11px] py-[7px] rounded-[10px] text-[13px] font-bold text-white/75 no-underline hover:bg-white/[.1] transition-colors"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
          </a>
          <a href="https://x.com/calliotelsms" target="_blank" rel="noopener noreferrer"
            aria-label="Calliotel on X (Twitter) (opens in a new tab)"
            className="hidden md:flex items-center gap-[5px] px-[11px] py-[7px] rounded-[10px] text-[13px] font-bold text-white/75 no-underline hover:bg-white/[.1] transition-colors"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
          </a>
          <a href={TELEGRAM_MINI_APP_URL} target="_blank" rel="noopener noreferrer"
            aria-label="Open Calliotel Mini App in Telegram (opens in a new tab)"
            className="hidden md:flex items-center gap-[5px] px-[13px] py-[7px] rounded-[10px] text-[13px] font-bold no-underline transition-colors"
            style={{ color: '#fff', background: '#2AABEE', border: '1px solid rgba(42,171,238,0.5)' }}
            onMouseEnter={e => { e.currentTarget.style.background = '#229ED9'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#2AABEE'; }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12l-6.871 4.326-2.962-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.833.941z"/></svg>
            Open in Telegram
          </a>
          <button onClick={() => navigate('/login')} className="hidden md:block px-4 py-[7px] rounded-[10px] text-sm text-white/70 font-medium bg-transparent cursor-pointer hover:text-white hover:bg-white/[.07] transition-colors"
            style={{ border: '1px solid rgba(255,255,255,0.12)' }}>Login</button>
          <button onClick={() => navigate('/signup')} className="hidden md:block px-4 py-[7px] rounded-[10px] text-sm text-white/70 font-medium bg-transparent cursor-pointer hover:text-white hover:bg-white/[.07] transition-colors"
            style={{ border: '1px solid rgba(255,255,255,0.12)' }}>Sign up</button>
          <button onClick={() => navigate('/browse-numbers?first=1')} className="hidden md:block px-5 py-2 rounded-[10px] text-sm font-bold text-white border-none cursor-pointer"
            style={{ background: '#F5A623', color: '#000', boxShadow: '0 4px 16px rgba(245,166,35,0.4)' }}>Get Started →</button>

          {/* Mobile */}
          <button onClick={() => navigate('/login')} className="md:hidden px-3 py-[7px] rounded-[10px] text-[13px] font-semibold bg-transparent text-white/80 cursor-pointer"
            style={{ border: '1px solid rgba(255,255,255,0.22)' }}>Login</button>
          <button onClick={() => navigate('/signup')} className="md:hidden px-[14px] py-[7px] rounded-[10px] text-[13px] font-bold text-white border-none cursor-pointer"
            style={{ background: '#F5A623', color: '#000' }}>Sign up</button>
          <button onClick={() => setMobileMenuOpen(v => !v)}
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileMenuOpen}
            className="md:hidden w-[38px] h-[38px] rounded-[10px] cursor-pointer flex flex-col items-center justify-center gap-1"
            style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <span className="block rounded-sm bg-white transition-transform duration-200" style={{ width: 18, height: 2, transform: mobileMenuOpen ? 'rotate(45deg) translateY(6px)' : 'none' }} />
            <span className="block rounded-sm bg-white transition-opacity duration-200" style={{ width: 18, height: 2, opacity: mobileMenuOpen ? 0 : 1 }} />
            <span className="block rounded-sm bg-white transition-transform duration-200" style={{ width: 18, height: 2, transform: mobileMenuOpen ? 'rotate(-45deg) translateY(-6px)' : 'none' }} />
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="md:hidden flex flex-col gap-0.5 px-3 pb-4 pt-2"
          style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="text-[11px] font-bold text-white/35 tracking-[2px] px-4 pt-[10px] pb-1">PRODUCTS</div>
          {products.map(p => (
            <button key={p.route} onClick={() => { navigate(p.route); setMobileMenuOpen(false); }}
              className="w-full px-4 py-[11px] rounded-xl text-[15px] text-white font-semibold bg-transparent border-none cursor-pointer text-left flex gap-3 items-center hover:bg-white/[.05] transition-colors">
              <span className="text-xl">{p.icon}</span>
              <div>
                <div className="text-sm font-bold">{p.label}</div>
                <div className="text-[11px] text-white/40 font-normal">{p.desc}</div>
              </div>
            </button>
          ))}
          <div className="my-2 mx-4 h-px" style={{ background: 'rgba(255,255,255,0.07)' }} />
          {[
            { label: '💰 Pricing', route: '/pricing' },
            { label: '⚡ Developers / API', route: '/reseller-api' },
            { label: '❓ Help Center', route: '/help' },
            { label: '✈️ Open in Telegram', route: TELEGRAM_MINI_APP_URL, external: true },
            { label: '💬 Telegram Community', route: 'https://t.me/calliotel', external: true },
          ].map(item => (
            item.external ? (
              <a key={item.route} href={item.route} target="_blank" rel="noopener noreferrer"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full px-4 py-[13px] rounded-xl text-[15px] text-yellow-400 font-semibold bg-transparent no-underline block">
                {item.label}
              </a>
            ) : (
              <button key={item.route} onClick={() => { navigate(item.route); setMobileMenuOpen(false); }}
                className="w-full px-4 py-[13px] rounded-xl text-[15px] text-white font-semibold bg-transparent border-none cursor-pointer text-left hover:bg-white/[.05] transition-colors">
                {item.label}
              </button>
            )
          ))}
        </div>
      )}
    </nav>
  );
};

export default LandingNav;
