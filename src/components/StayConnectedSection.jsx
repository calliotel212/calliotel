import React from 'react';
import { MessageSquare, Phone, PhoneForwarded, Globe, Shield, Zap } from 'lucide-react';

const features = [
  {
    icon: '📱',
    title: 'Real Virtual Numbers',
    desc: 'US, UK, Canada, Netherlands, Sweden & more. Actual phone numbers — not VoIP apps.',
    badge: 'From $2/mo',
    color: 'from-emerald-50 to-emerald-100',
    border: 'hover:border-emerald-400',
  },
  {
    icon: '💬',
    title: 'Receive SMS',
    desc: 'Get verification codes and messages from anywhere in the world instantly.',
    badge: 'Real-time inbox',
    color: 'from-blue-50 to-blue-100',
    border: 'hover:border-blue-400',
  },
  {
    icon: '📞',
    title: 'Call Forwarding',
    desc: 'Forward inbound calls to any real phone. Your Calliotel number rings your actual phone.',
    badge: 'Live now',
    color: 'from-green-50 to-green-100',
    border: 'hover:border-green-400',
  },
  {
    icon: '🔒',
    title: 'Stay Private',
    desc: 'Use a virtual number for signups, dating apps, marketplaces — keep your real number private.',
    badge: '100% anonymous',
    color: 'from-purple-50 to-purple-100',
    border: 'hover:border-purple-400',
  },
  {
    icon: '🌍',
    title: 'Global Coverage',
    desc: 'Numbers from 8+ countries with more added regularly. Receive calls and SMS globally.',
    badge: 'US · UK · CA · NL · SE +',
    color: 'from-cyan-50 to-cyan-100',
    border: 'hover:border-cyan-400',
  },
  {
    icon: '⚡',
    title: 'Instant Activation',
    desc: 'Buy a number and it\'s ready in seconds. No paperwork, no ID, no waiting.',
    badge: 'Under 10 seconds',
    color: 'from-yellow-50 to-yellow-100',
    border: 'hover:border-yellow-400',
  },
];

const StayConnectedSection = () => {
  return (
    <section id="features" className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">Everything Your Virtual Number Needs</h2>
          <p className="text-xl text-gray-500 max-w-2xl mx-auto">One number. SMS inbox, call forwarding, privacy protection — all in one dashboard.</p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f) => (
            <div
              key={f.title}
              className={`bg-gradient-to-br ${f.color} rounded-2xl p-6 border-2 border-transparent ${f.border} transition-all hover:shadow-lg hover:scale-[1.02]`}
            >
              <div className="text-4xl mb-4">{f.icon}</div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">{f.title}</h3>
              <p className="text-gray-600 text-sm mb-4">{f.desc}</p>
              <span className="text-xs font-semibold text-gray-500 bg-white/70 px-3 py-1 rounded-full">{f.badge}</span>
            </div>
          ))}
        </div>

        <div className="mt-14 text-center">
          <a
            href="/browse-numbers"
            className="inline-flex items-center space-x-2 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white px-10 py-4 rounded-full font-bold text-lg shadow-lg hover:shadow-emerald-200 hover:scale-105 transition-all"
          >
            <span>Get Your Number Now</span>
            <span>→</span>
          </a>
          <p className="text-gray-400 text-sm mt-3">No contract · Cancel anytime · Instant activation</p>
        </div>
      </div>
    </section>
  );
};

export default StayConnectedSection;
