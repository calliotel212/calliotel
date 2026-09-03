import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Phone, Mail, MapPin, Send, MessageCircle, Star, Instagram, Facebook } from 'lucide-react';

const ProfessionalFooter = () => {
  const navigate = useNavigate();
  const currentYear = new Date().getFullYear();

  const footerLinks = {
    product: [
      { name: 'Virtual Numbers', path: '/browse-numbers' },
      { name: 'eSIM Data Plans', path: '/esim' },
      { name: 'Pricing', path: '/pricing' },
    ],
    company: [
      { name: 'About Us', path: '/help' },
      { name: 'Reseller API', path: '/reseller-api' },
      { name: 'Reseller Program', path: '/reseller-program' },
      { name: 'Privacy Policy', path: '/privacy' },
      { name: 'Terms of Service', path: '/terms' },
    ],
    legal: [
      { name: 'Privacy Policy', path: '/privacy' },
      { name: 'Terms of Service', path: '/terms' },
    ],
    support: [
      { name: '✈️ Open in Telegram', path: 'https://t.me/Calliotelbot/app', external: true },
      { name: '💬 Telegram Community', path: 'https://t.me/calliotel', external: true },
      { name: 'Help Center', path: '/help' },
      { name: 'Contact Support', path: '/help' },
      { name: 'System Status', path: '/maintenance' },
      { name: 'Live Chat', path: '/help' }
    ]
  };

  const cardMarks = [
    {
      name: 'Visa',
      logo: (
        <svg viewBox="0 0 48 32" width="48" height="32" aria-hidden="true">
          <rect width="48" height="32" rx="5" fill="#fff" />
          <path fill="#1A1F71" d="M21.05 21.4l2.02-12.05h3.23L24.28 21.4h-3.23zm14.95-11.8c-.64-.25-1.65-.52-2.9-.52-3.2 0-5.45 1.64-5.47 3.99-.02 1.73 1.61 2.7 2.84 3.28 1.26.59 1.69.97 1.68 1.5-.01.81-1.01 1.18-1.95 1.18-1.3 0-2-.19-3.06-.64l-.42-.2-.46 2.75c.76.34 2.18.64 3.65.65 3.44 0 5.67-1.62 5.7-4.13.02-1.37-.85-2.41-2.72-3.26-1.13-.56-1.83-.93-1.82-1.5 0-.5.58-1.03 1.84-1.03 1.05 0 1.81.22 2.4.46l.29.14.4-2.67zm7.97-.25h-2.5c-.78 0-1.36.22-1.7.99l-4.81 11.06h3.4s.56-1.48.68-1.81h4.16c.1.43.4 1.81.4 1.81h3.05L44 9.35h.01l-.04 0zm-4 7.78c.27-.72 1.32-3.45 1.32-3.45-.02.04.27-.71.44-1.17l.22 1.06s.64 2.96.77 3.56h-2.75zM16.3 9.35l-3.18 8.23-.34-1.67c-.59-1.93-2.42-4.01-4.47-5.05l2.9 10.54h3.42l5.09-12.05H16.3z" />
          <path fill="#F7B600" d="M7.4 9.35H2.2l-.05.24c4.03.99 6.7 3.38 7.8 6.24l-1.13-5.5c-.2-.76-.76-.98-1.42-.98z" />
        </svg>
      ),
    },
    {
      name: 'Mastercard',
      logo: (
        <svg viewBox="0 0 48 32" width="48" height="32" aria-hidden="true">
          <rect width="48" height="32" rx="5" fill="#fff" />
          <circle cx="20" cy="16" r="8" fill="#EB001B" />
          <circle cx="28" cy="16" r="8" fill="#F79E1B" />
          <path fill="#FF5F00" d="M24 9.7a8 8 0 0 1 0 12.6 8 8 0 0 1 0-12.6z" />
        </svg>
      ),
    },
    {
      name: 'American Express',
      logo: (
        <svg viewBox="0 0 48 32" width="48" height="32" aria-hidden="true">
          <rect width="48" height="32" rx="5" fill="#2E77BC" />
          <path fill="#fff" d="M8.2 13.1h3.15l.72 1.66.72-1.66h3.1v5.8h-1.85v-3.7l-1.15 2.55h-1.5l-1.15-2.55v3.7H8.2v-5.8zm10.4 0h5.55v1.5h-3.7v.9h3.5v1.45h-3.5v.95h3.75v1.5h-5.6v-6.3zm7.15 0h2.05l2.15 2.45 2.15-2.45h2.05v5.8h-1.85v-3.15l-2.35 2.55-2.35-2.55v3.15h-1.85v-5.8z" />
        </svg>
      ),
    },
  ];

  const cryptoMarks = [
    {
      name: 'USDT',
      logo: (
        <svg viewBox="0 0 32 32" width="28" height="28" aria-hidden="true">
          <circle cx="16" cy="16" r="16" fill="#26A17B" />
          <path fill="#fff" d="M17.3 13.7v-2.2h4.1V8.4H10.6v3.1h4.1v2.2c-3.3.15-5.8.8-5.8 1.58 0 .78 2.5 1.43 5.8 1.58v5.64h2.6v-5.64c3.3-.15 5.8-.8 5.8-1.58 0-.78-2.5-1.43-5.8-1.58zm0 2.7v.01c-.1 0-.22.01-.34.01h-.52c-.12 0-.23 0-.34-.01v-.01c-2.74-.12-4.78-.6-4.78-1.17s2.04-1.05 4.78-1.17v1.86c.11.01.22.02.34.02h.52c.12 0 .23-.01.34-.02v-1.86c2.74.12 4.78.6 4.78 1.17s-2.04 1.05-4.78 1.17z" />
        </svg>
      ),
    },
    {
      name: 'Bitcoin',
      logo: (
        <svg viewBox="0 0 32 32" width="28" height="28" aria-hidden="true">
          <circle cx="16" cy="16" r="16" fill="#F7931A" />
          <path fill="#fff" d="M21.3 14.3c.28-1.86-1.14-2.86-3.08-3.53l.63-2.52-1.54-.38-.61 2.46c-.4-.1-.82-.2-1.24-.29l.62-2.48-1.54-.38-.63 2.52c-.34-.08-.67-.15-1-.23l.01-.03-2.12-.53-.41 1.64s1.14.26 1.12.28c.62.16.73.57.71.9l-.71 2.86c.04.01.1.03.16.06l-.16-.04-.99 3.99c-.08.19-.27.47-.66.36.01.02-1.12-.28-1.12-.28l-.76 1.76 2 .5c.37.09.74.19 1.1.28l-.64 2.57 1.54.38.63-2.53c.42.11.83.22 1.23.32l-.63 2.51 1.54.38.64-2.56c2.64.5 4.63.3 5.46-2.09.67-1.93-.03-3.04-1.42-3.76 1.01-.23 1.77-.9 1.97-2.27zm-3.52 4.94c-.48 1.93-3.72.89-4.77.62l.85-3.41c1.05.26 4.42.79 3.92 2.79zm.48-4.97c-.44 1.76-3.15.86-4.03.65l.77-3.1c.88.22 3.71.63 3.26 2.45z" />
        </svg>
      ),
    },
    {
      name: 'TRON',
      logo: (
        <svg viewBox="0 0 32 32" width="28" height="28" aria-hidden="true">
          <circle cx="16" cy="16" r="16" fill="#EF0027" />
          <path fill="#fff" d="M8.6 9.2 21.8 7.4l1.6 2.2-8.7 15.1L8.6 9.2zm2.3 1.2 6.2 11.3 6.4-11.1-12.6-.2zm1.4.9 9.3.2-4.5 7.8-4.8-8z" />
        </svg>
      ),
    },
  ];

  return (
    <>
      <footer style={{ background: '#111114', borderTop: '1px solid rgba(245,166,35,0.2)' }} className="pt-16 pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Main Footer Content */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 mb-12">
          {/* Company Info */}
          <div className="lg:col-span-2">
            <div className="flex items-center space-x-2 mb-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#F5A623' }}>
                <Phone className="w-6 h-6 text-black" />
              </div>
              <span className="text-2xl font-bold text-white">
                CALLIOTEL
              </span>
            </div>
            <p className="mb-6" style={{ color: '#c9c9d0' }}>
              Virtual phone numbers &amp; eSIM data plans. Instant activation, no ID required, no contracts.
            </p>

            {/* Contact Info */}
            <div className="space-y-3">
              <div className="flex items-center space-x-3">
                <Send className="w-5 h-5 flex-shrink-0" style={{ color: '#F5A623' }} />
                <a href="https://t.me/Calliotelbot/app" target="_blank" rel="noopener noreferrer" title="Opens in a new tab" className="text-sm font-semibold transition-colors" style={{ color: '#F5A623', textDecoration: 'none' }}>
                  t.me/Calliotelbot/app
                </a>
              </div>
              <div className="flex items-center space-x-3">
                <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" fill="#c9c9d0"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                <a href="https://x.com/calliotelsms" target="_blank" rel="noopener noreferrer" title="Opens in a new tab" className="text-sm transition-colors" style={{ color: '#e2e2e8', textDecoration: 'none' }}>
                  @calliotelsms
                </a>
              </div>
              <div className="flex items-center space-x-3">
                <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" fill="#c9c9d0"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                <a href="https://www.facebook.com/profile.php?id=61592602614979" target="_blank" rel="noopener noreferrer" title="Opens in a new tab" className="text-sm transition-colors" style={{ color: '#e2e2e8', textDecoration: 'none' }}>
                  Calliotel on Facebook
                </a>
              </div>
              <div className="flex items-center space-x-3">
                <Mail className="w-5 h-5 flex-shrink-0" style={{ color: '#c9c9d0' }} />
                <a href="mailto:support@calliotel.com" className="text-sm transition-colors" style={{ color: '#e2e2e8', textDecoration: 'none' }}>
                  support@calliotel.com
                </a>
              </div>
              <div className="flex items-start space-x-3">
                <MapPin className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: '#c9c9d0' }} />
                <span className="text-sm leading-relaxed" style={{ color: '#e2e2e8' }}>
                  Calliotel LLC<br />
                  30 N Gould Ste 225<br />
                  Sheridan, WY 82801<br />
                  United States
                </span>
              </div>
            </div>
          </div>

          {/* Product Links */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-widest mb-5" style={{ color: '#F5A623' }}>
              Product
            </h3>
            <ul className="space-y-1">
              {footerLinks.product.map((link, index) => (
                <li key={index}>
                  <a
                    href={link.path}
                    className="text-sm py-2 px-1 block min-h-[44px] flex items-center transition-colors hover:text-white"
                    style={{ color: '#e2e2e8', textDecoration: 'none' }}
                  >
                    {link.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Company Links */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-widest mb-5" style={{ color: '#F5A623' }}>
              Company
            </h3>
            <ul className="space-y-1">
              {footerLinks.company.map((link, index) => (
                <li key={index}>
                  <a
                    href={link.path}
                    className="text-sm py-2 px-1 block min-h-[44px] flex items-center transition-colors hover:text-white"
                    style={{ color: '#e2e2e8', textDecoration: 'none' }}
                  >
                    {link.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Support Links */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-widest mb-5" style={{ color: '#F5A623' }}>
              Support
            </h3>
            <ul className="space-y-1">
              {footerLinks.support.map((link, index) => (
                <li key={index}>
                  <a
                    href={link.path}
                    target={link.external ? '_blank' : undefined}
                    rel={link.external ? 'noopener noreferrer' : undefined}
                    className="text-sm py-2 px-1 block min-h-[44px] flex items-center transition-colors hover:text-white"
                    style={{ color: link.external ? '#F5A623' : '#e2e2e8', textDecoration: 'none' }}
                  >
                    {link.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Country Pages */}
        <div className="py-8" style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: '#F5A623' }}>
            Virtual Numbers by Country
          </p>
          <div className="flex flex-wrap gap-2">
            {[
              { flag: '🇺🇸', name: 'USA', slug: 'us' },
              { flag: '🇬🇧', name: 'UK', slug: 'uk' },
              { flag: '🇨🇦', name: 'Canada', slug: 'ca' },
              { flag: '🇳🇱', name: 'Netherlands', slug: 'nl' },
              { flag: '🇸🇪', name: 'Sweden', slug: 'se' },
              { flag: '🇵🇷', name: 'Puerto Rico', slug: 'pr' },
            ].map(({ flag, name, slug }) => (
              <a
                key={slug}
                href={`/virtual-number/${slug}`}
                className="text-xs px-3 py-1.5 rounded-full border transition-colors hover:border-amber-400 hover:text-white"
                style={{ textDecoration: 'none', color: '#e2e2e8', borderColor: 'rgba(255,255,255,0.2)' }}
              >
                {flag} {name}
              </a>
            ))}
          </div>
          <p className="text-xs mt-3" style={{ color: '#c9c9d0' }}>eSIM data plans available in 180+ countries →&nbsp;
            <a href="/esim" style={{ color:'#10b981', fontSize:12, fontWeight:600, textDecoration:'none' }}>Browse eSIM Plans</a>
          </p>
        </div>

        {/* Payment Methods */}
        <div className="py-8" style={{ borderTop: '1px solid rgba(255,255,255,0.1)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <p className="text-center text-xs font-bold uppercase tracking-widest mb-4" style={{ color: '#9a9aa8' }}>
            Cards
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2.5">
            {cardMarks.map((method) => (
              <div
                key={method.name}
                title={method.name}
                style={{
                  borderRadius: 8,
                  overflow: 'hidden',
                  border: '1px solid rgba(255,255,255,0.12)',
                  lineHeight: 0,
                }}
              >
                {method.logo}
              </div>
            ))}
          </div>

          <p className="text-center text-sm font-bold mt-7 mb-3" style={{ color: '#fff' }}>
            We accept crypto
          </p>
          <p className="text-center text-xs mb-4" style={{ color: '#9a9aa8' }}>
            USDT, TRX, Bitcoin and more — from $5
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {cryptoMarks.map((method) => (
              <div key={method.name} title={method.name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {method.logo}
                <span style={{ fontSize: 12, fontWeight: 700, color: '#e2e2e8' }}>{method.name}</span>
              </div>
            ))}
          </div>
          <div className="text-center mt-4">
            <a
              href="/buy-credits?tab=crypto"
              style={{ color: '#F5A623', fontSize: 13, fontWeight: 700, textDecoration: 'none' }}
            >
              Pay with crypto →
            </a>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 flex flex-col md:flex-row items-center justify-between space-y-4 md:space-y-0">
          {/* Copyright */}
          <div className="text-sm" style={{ color: '#c9c9d0' }}>
            © {currentYear} Calliotel. All rights reserved.
          </div>

          {/* Legal Links */}
          <div className="flex flex-wrap items-center justify-center gap-2">
            {footerLinks.legal.map((link, index) => (
              <a
                key={index}
                href={link.path}
                className="text-sm py-2 px-3 min-h-[44px] flex items-center transition-colors hover:text-white"
                style={{ color: '#e2e2e8', textDecoration: 'none' }}
              >
                {link.name}
              </a>
            ))}
          </div>

          {/* Connect With Us */}
          <div className="flex items-center space-x-3">
            <a
              href="https://t.me/Calliotelbot/app"
              target="_blank"
              rel="noopener noreferrer"
              title="Open Calliotel Mini App in Telegram (opens in a new tab)"
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-full text-xs font-semibold bg-sky-500/10 border border-sky-500/30 text-sky-400 hover:bg-sky-500/20 transition min-h-[44px]"
            >
              <Send className="w-4 h-4" /> Open in Telegram
            </a>
            <a
              href="https://www.instagram.com/calliotelofficial?utm_source=qr&igsh=MThnYTlyOGF2M3RwbA=="
              target="_blank"
              rel="noopener noreferrer"
              title="Follow on Instagram (opens in a new tab)"
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-full text-xs font-semibold bg-pink-500/10 border border-pink-500/30 text-pink-400 hover:bg-pink-500/20 transition min-h-[44px]"
            >
              <Instagram className="w-4 h-4" /> Instagram
            </a>
            <a
              href="https://www.facebook.com/share/1EGnhUmVVK/"
              target="_blank"
              rel="noopener noreferrer"
              title="Follow on Facebook (opens in a new tab)"
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-full text-xs font-semibold bg-blue-500/10 border border-blue-500/30 text-blue-400 hover:bg-blue-500/20 transition min-h-[44px]"
            >
              <Facebook className="w-4 h-4" /> Facebook
            </a>
            <a
              href="https://www.trustpilot.com/review/calliotel.com"
              target="_blank"
              rel="noopener noreferrer"
              title="Review us on Trustpilot (opens in a new tab)"
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-full text-xs font-semibold bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 transition min-h-[44px]"
            >
              <Star className="w-4 h-4 fill-current" /> Trustpilot
            </a>
          </div>
        </div>

        {/* Compliance Notice */}
        <div className="mt-8 pt-6 border-t border-gray-800">
          <p className="text-xs text-center text-gray-400">
            Calliotel is a registered telecommunications service provider. All services are subject to our Terms of Service and Privacy Policy. 
            Virtual numbers are provided for legitimate business and personal use only. We comply with all applicable telecommunications regulations 
            and data protection laws including GDPR, CCPA, and TCPA.
          </p>
        </div>
      </div>
    </footer>
    </>
  );
};

export default ProfessionalFooter;
