import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Phone, Shield, Zap, Globe, MessageSquare, Check, ArrowRight, Star } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const CampaignLandingPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [promoInfo, setPromoInfo] = useState(null);

  const source = searchParams.get('utm_source') || '';
  const promo = searchParams.get('promo') || '';

  useEffect(() => {
    const utm = {};
    ['utm_source','utm_medium','utm_campaign','utm_content','utm_term'].forEach(k => {
      const v = searchParams.get(k);
      if (v) utm[k] = v;
    });
    if (Object.keys(utm).length > 0) {
      try { sessionStorage.setItem('calliotel_utm', JSON.stringify(utm)); } catch {}
    }

    if (promo) {
      fetch(`${BACKEND_URL}/api/promo/validate/${promo}`)
        .then(r => r.json())
        .then(d => { if (d.valid) setPromoInfo(d); })
        .catch(() => {});
    }
  }, [searchParams, promo]);

  const goSignup = () => {
    const params = new URLSearchParams();
    if (promo) params.set('promo', promo);
    ['utm_source','utm_medium','utm_campaign','utm_content','utm_term'].forEach(k => {
      const v = searchParams.get(k);
      if (v) params.set(k, v);
    });
    navigate(`/signup?${params.toString()}`);
  };

  const isTikTok = source.toLowerCase().includes('tiktok');
  const isGoogle = source.toLowerCase().includes('google');

  const headline = isTikTok
    ? 'Get a US Number in 30 Seconds'
    : isGoogle
      ? 'Private Virtual Numbers for Any App'
      : 'Your Own Virtual Phone Number';

  const subheadline = isTikTok
    ? 'WhatsApp, Telegram, Instagram — verify any app with a real US number. No SIM card needed.'
    : isGoogle
      ? 'Receive SMS verifications, calls & messages. 6 countries. Instant setup.'
      : 'Get a real phone number from 6 countries. Receive SMS, calls & verifications instantly.';

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {promoInfo && (
        <div className="bg-gradient-to-r from-green-600 to-emerald-600 py-2 text-center">
          <p className="text-sm font-semibold">
            🎁 Use code <span className="font-mono bg-white/20 px-2 py-0.5 rounded">{promo.toUpperCase()}</span> and get <span className="text-yellow-200">${promoInfo.discount_value} FREE credit</span> on signup!
          </p>
        </div>
      )}

      <div className="max-w-6xl mx-auto px-4">
        <header className="flex items-center justify-between py-5">
          <div className="flex items-center space-x-2">
            <div className="w-9 h-9 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg flex items-center justify-center">
              <Phone className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-orange-400">CALLIOTEL</span>
          </div>
          <button onClick={goSignup}
            className="px-5 py-2 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-lg transition-all text-sm">
            Get Started
          </button>
        </header>

        <section className="pt-16 pb-20 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-orange-500/10 border border-orange-500/30 rounded-full text-orange-400 text-sm font-medium mb-6">
            <Zap className="w-4 h-4" /> Instant Activation — No ID Required
          </div>

          <h1 className="text-4xl md:text-6xl font-black leading-tight mb-6 max-w-3xl mx-auto">
            {headline}
          </h1>
          <p className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto mb-10">
            {subheadline}
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button onClick={goSignup}
              className="px-8 py-4 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-bold rounded-xl text-lg transition-all shadow-[0_0_30px_rgba(234,88,12,0.3)] flex items-center gap-2">
              Get Your Number Now <ArrowRight className="w-5 h-5" />
            </button>
            <button onClick={() => navigate('/pricing')}
              className="px-8 py-4 border border-gray-700 hover:border-orange-500/50 text-gray-300 font-semibold rounded-xl text-lg transition-all">
              View Pricing
            </button>
          </div>

          <div className="flex items-center justify-center gap-6 mt-8 text-sm text-gray-500">
            <span className="flex items-center gap-1"><Check className="w-4 h-4 text-green-500" /> No contracts</span>
            <span className="flex items-center gap-1"><Check className="w-4 h-4 text-green-500" /> Cancel anytime</span>
            <span className="flex items-center gap-1"><Check className="w-4 h-4 text-green-500" /> From $2/mo</span>
          </div>
        </section>

        <section className="py-16 grid md:grid-cols-3 gap-6">
          {[
            { icon: Shield, title: 'Privacy First', desc: 'Keep your real number private. Use a virtual number for dating apps, marketplaces, and more.' },
            { icon: MessageSquare, title: 'SMS & Calls', desc: 'Receive verification codes from WhatsApp, Telegram, Instagram, and 200+ apps.' },
            { icon: Globe, title: '8 Countries', desc: 'US, UK, Canada, Brazil, Mexico, Puerto Rico, Thailand, Nigeria. Mobile numbers only.' },
          ].map((f, i) => (
            <div key={i} className="bg-gray-800/50 border border-gray-700/50 rounded-2xl p-6 hover:border-orange-500/30 transition-all">
              <div className="w-12 h-12 bg-orange-500/10 rounded-xl flex items-center justify-center mb-4">
                <f.icon className="w-6 h-6 text-orange-400" />
              </div>
              <h3 className="text-lg font-bold mb-2">{f.title}</h3>
              <p className="text-gray-400 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </section>

        <section className="py-16">
          <h2 className="text-3xl font-bold text-center mb-12">How It Works</h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { step: '1', title: 'Sign Up', desc: 'Create your account in 30 seconds. Email only — no ID, no credit card required to browse.' },
              { step: '2', title: 'Choose a Number', desc: 'Pick from hundreds of available mobile numbers across 6 countries.' },
              { step: '3', title: 'Start Receiving', desc: 'Get SMS, calls, and verification codes instantly on your dashboard.' },
            ].map((s, i) => (
              <div key={i} className="text-center">
                <div className="w-14 h-14 bg-gradient-to-br from-orange-500 to-orange-600 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
                  {s.step}
                </div>
                <h3 className="text-lg font-bold mb-2">{s.title}</h3>
                <p className="text-gray-400 text-sm">{s.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="py-16">
          <h2 className="text-3xl font-bold text-center mb-12">What Our Users Say</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { name: 'Alex M.', text: 'Got a US number for WhatsApp verification in literally 30 seconds. Works perfectly!', rating: 5 },
              { name: 'Sarah K.', text: 'I use Calliotel for my online business. Keeps my personal number private and professional.', rating: 5 },
              { name: 'David R.', text: 'Best virtual number service I\'ve tried. Clean interface, instant setup, great support.', rating: 5 },
            ].map((r, i) => (
              <div key={i} className="bg-gray-800/50 border border-gray-700/50 rounded-2xl p-6">
                <div className="flex items-center gap-1 mb-3">
                  {Array.from({ length: r.rating }, (_, j) => (
                    <Star key={j} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <p className="text-gray-300 text-sm mb-4 leading-relaxed">"{r.text}"</p>
                <p className="text-sm font-semibold text-orange-400">— {r.name}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="py-16 text-center">
          <div className="bg-gradient-to-br from-orange-500/10 to-orange-600/5 border border-orange-500/20 rounded-3xl p-12 max-w-2xl mx-auto">
            <h2 className="text-3xl font-bold mb-4">Ready to Get Started?</h2>
            <p className="text-gray-400 mb-8">
              Join thousands of users who trust Calliotel for their virtual number needs.
              {promoInfo && ` Use code ${promo.toUpperCase()} for $${promoInfo.discount_value} free credit!`}
            </p>
            <button onClick={goSignup}
              className="px-10 py-4 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-bold rounded-xl text-lg transition-all shadow-[0_0_30px_rgba(234,88,12,0.3)] inline-flex items-center gap-2">
              Create Free Account <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </section>

        <footer className="border-t border-gray-800 py-8 text-center text-gray-500 text-sm">
          <p>&copy; {new Date().getFullYear()} Calliotel LLC. All rights reserved.</p>
          <div className="flex items-center justify-center gap-4 mt-2">
            <a href="/privacy" className="hover:text-orange-400 transition-colors">Privacy Policy</a>
            <a href="/terms" className="hover:text-orange-400 transition-colors">Terms of Service</a>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default CampaignLandingPage;
