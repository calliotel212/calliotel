import React, { useState, useEffect } from 'react';
import { Download, Plus, Send, Instagram, Facebook } from 'lucide-react';

const GooglePlayIcon = () => (
  <svg viewBox="0 0 24 24" className="w-8 h-8" fill="currentColor">
    <path d="M3.18 23.76c.3.17.64.24.99.2l13.12-7.57-2.83-2.83L3.18 23.76zM.6 1.27C.23 1.67 0 2.28 0 3.06v17.88c0 .78.23 1.39.6 1.79l.1.09 10.02-10.02v-.24L.7 1.18l-.1.09zM20.43 10.37l-2.85-1.65-3.17 3.17 3.17 3.17 2.87-1.66c.82-.47.82-1.56-.02-2.03zM4.17.24L17.29 7.8l-2.83 2.83L3.18.28c.31-.22.69-.22.99-.04z"/>
  </svg>
);

const AppleIcon = () => (
  <svg viewBox="0 0 24 24" className="w-8 h-8" fill="currentColor">
    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
  </svg>
);

const DownloadSection = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstallable, setIsInstallable] = useState(false);

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstallable(false);
    }
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleAddToHome = async () => {
    if (!deferredPrompt) {
      alert(
        'To add Calliotel to your home screen:\n\n' +
        'iOS: Tap the Share button and select "Add to Home Screen"\n' +
        'Android: Tap the menu (⋮) and select "Add to Home screen"'
      );
      return;
    }
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      console.log('User accepted the install prompt');
    }
    setDeferredPrompt(null);
    setIsInstallable(false);
  };

  return (
    <section className="py-20 bg-obsidian">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-4xl lg:text-5xl font-bold text-white mb-4">
            Get the Calliotel App
          </h2>
          <p className="text-xl text-gray-400 max-w-3xl mx-auto">
            Download now and get a real virtual phone number in seconds — no SIM card, no contracts.
          </p>
        </div>

        <div className="flex flex-col md:flex-row items-center justify-center gap-8">
          {/* Phone Mockup */}
          <div className="relative">
            <div className="relative w-72 h-[600px] bg-gray-900 rounded-[3rem] p-3 shadow-2xl">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-40 h-7 bg-gray-900 rounded-b-3xl z-10"></div>
              <div className="w-full h-full bg-gradient-to-br from-ember via-ember to-ember-light/50 rounded-[2.5rem] overflow-hidden relative">
                <div className="absolute top-10 left-5 w-32 h-32 bg-ember/40 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-blob"></div>
                <div className="absolute top-20 right-5 w-32 h-32 bg-ember/40 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-blob animation-delay-2000"></div>
                <div className="flex justify-between items-center px-6 pt-8 pb-4 text-white text-xs relative z-10">
                  <span className="font-semibold">9:41</span>
                  <div className="flex items-center gap-1">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
                    </svg>
                    <div className="w-4 h-3 border border-white rounded-sm relative">
                      <div className="absolute inset-0.5 bg-white rounded-sm"></div>
                    </div>
                  </div>
                </div>
                <div className="px-6 space-y-6 relative z-10">
                  <div className="text-center mb-6">
                    <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-lg animate-float">
                      <svg className="w-12 h-12 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                      </svg>
                    </div>
                    <h3 className="text-white text-2xl font-bold mb-1">CALLIOTEL</h3>
                    <p className="text-ember-100 text-sm">Virtual Phone Numbers</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-4">
                      <div className="text-white text-2xl font-bold">2</div>
                      <div className="text-ember-100 text-xs">Active Numbers</div>
                    </div>
                    <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-4">
                      <div className="text-white text-2xl font-bold">48</div>
                      <div className="text-ember-100 text-xs">Messages</div>
                    </div>
                  </div>
                  <button className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-bold py-4 rounded-2xl shadow-lg animate-pulse-slow">
                    Get Started Now
                  </button>
                  <div className="space-y-3 pt-2">
                    {['US · UK · CA · NL · SE numbers', 'SMS + Calls included', 'Instant setup — 60 seconds', 'No SIM card needed'].map(f => (
                      <div key={f} className="flex items-center gap-3 text-white text-sm">
                        <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                        <span className="font-medium">{f}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Download Buttons */}
          <div className="space-y-4">
            {/* Google Play — PRIMARY */}
            <a
              href="https://play.google.com/store/apps/details?id=app.calliotel"
              target="_blank"
              rel="noopener noreferrer"
              title="Get it on Google Play (opens in a new tab)"
              className="flex items-center space-x-4 bg-black hover:bg-gray-900 text-white px-8 py-4 rounded-xl transition-all transform hover:scale-105 shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_30px_rgba(16,185,129,0.5)] border border-gray-700 w-full md:w-auto"
            >
              <GooglePlayIcon />
              <div className="text-left">
                <p className="text-xs text-gray-400">Get it on</p>
                <p className="text-xl font-semibold">Google Play</p>
              </div>
            </a>

            {/* App Store — PRIMARY */}
            <a
              href="https://apps.apple.com/app/id6761994577"
              target="_blank"
              rel="noopener noreferrer"
              title="Download on the App Store (opens in a new tab)"
              className="flex items-center space-x-4 bg-black hover:bg-gray-900 text-white px-8 py-4 rounded-xl transition-all transform hover:scale-105 shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_30px_rgba(16,185,129,0.5)] border border-gray-700 w-full md:w-auto"
            >
              <AppleIcon />
              <div className="text-left">
                <p className="text-xs text-gray-400">Download on the</p>
                <p className="text-xl font-semibold">App Store</p>
              </div>
            </a>

            {/* Divider */}
            <div className="flex items-center gap-3 py-1">
              <div className="flex-1 h-px bg-gray-700"></div>
              <span className="text-gray-500 text-xs uppercase tracking-widest">or</span>
              <div className="flex-1 h-px bg-gray-700"></div>
            </div>

            {/* PWA Install */}
            <button
              onClick={handleAddToHome}
              className="flex items-center space-x-4 bg-ember hover:bg-ember-light text-black px-8 py-4 rounded-xl transition-all transform hover:scale-105 shadow-[0_0_20px_rgba(245,166,35,0.4)] w-full md:w-auto"
            >
              <Plus className="w-8 h-8" />
              <div className="text-left">
                <p className="text-xs">Add to Home Screen</p>
                <p className="text-xl font-semibold">Web App</p>
              </div>
            </button>

            {/* Telegram */}
            <a
              href="https://t.me/calliotel"
              target="_blank"
              rel="noopener noreferrer"
              title="Join our Telegram Channel (opens in a new tab)"
              className="flex items-center space-x-4 bg-gradient-to-r from-[#0088cc] to-[#0077b5] hover:from-[#0077b5] hover:to-[#006699] text-white px-8 py-4 rounded-xl transition-all transform hover:scale-105 shadow-lg w-full md:w-auto"
            >
              <Send className="w-8 h-8" />
              <div className="text-left">
                <p className="text-xs">Join our</p>
                <p className="text-xl font-semibold">Telegram Channel</p>
              </div>
            </a>

            {/* Instagram */}
            <a
              href="https://www.instagram.com/calliotelofficial?utm_source=qr&igsh=MThnYTlyOGF2M3RwbA=="
              target="_blank"
              rel="noopener noreferrer"
              title="Follow us on Instagram (opens in a new tab)"
              className="flex items-center space-x-4 bg-gradient-to-tr from-[#f09433] via-[#dc2743] to-[#bc1888] hover:opacity-90 text-white px-8 py-4 rounded-xl transition-all transform hover:scale-105 shadow-lg w-full md:w-auto"
            >
              <Instagram className="w-8 h-8" />
              <div className="text-left">
                <p className="text-xs">Follow us on</p>
                <p className="text-xl font-semibold">Instagram</p>
              </div>
            </a>

            {/* Facebook */}
            <a
              href="https://www.facebook.com/share/1EGnhUmVVK/"
              target="_blank"
              rel="noopener noreferrer"
              title="Like us on Facebook (opens in a new tab)"
              className="flex items-center space-x-4 bg-gradient-to-r from-[#1877F2] to-[#0d65d9] hover:from-[#0d65d9] hover:to-[#0a52b8] text-white px-8 py-4 rounded-xl transition-all transform hover:scale-105 shadow-lg w-full md:w-auto"
            >
              <Facebook className="w-8 h-8" />
              <div className="text-left">
                <p className="text-xs">Like us on</p>
                <p className="text-xl font-semibold">Facebook</p>
              </div>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
};

export default DownloadSection;
