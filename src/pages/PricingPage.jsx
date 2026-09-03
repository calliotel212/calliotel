import React from 'react';
import Navbar from '../components/Navbar';
import InteractivePricingCalculator from '../components/InteractivePricingCalculator';
import ProfessionalFooter from '../components/ProfessionalFooter';
import SEOHead, { faqSchema } from '../components/SEOHead';
import { Shield, Zap, Globe, HeadphonesIcon } from 'lucide-react';
import { KineticHeading, KineticText } from '../components/KineticTypography';
import TalkOfferSection from '../components/TalkOfferSection';
import TalkOfferModal from '../components/TalkOfferModal';

const PricingPage = () => {
  const benefits = [
    {
      icon: <Shield className="w-8 h-8" />,
      title: "No Hidden Fees",
      description: "What you see is what you pay. Zero surprise charges."
    },
    {
      icon: <Zap className="w-8 h-8" />,
      title: "Instant Activation",
      description: "Numbers activated within seconds of purchase."
    },
    {
      icon: <Globe className="w-8 h-8" />,
      title: "Global Coverage",
      description: "Virtual numbers from 6 countries — US, CA, GB, NL, SE, PR."
    },
    {
      icon: <HeadphonesIcon className="w-8 h-8" />,
      title: "24/7 Support",
      description: "Expert support team ready to help anytime."
    }
  ];

  return (
    <div className="min-h-screen bg-gray-950">
      <SEOHead
        title="Pricing — Virtual Numbers from $1.35/mo | Calliotel"
        description="Virtual phone numbers from $1.35/month with annual prepay (32% off). Monthly from $1.99. No setup fee, no contracts. Volume discounts up to 32% off. Cancel anytime."
        keywords="cheapest virtual number, annual virtual number plan, virtual number no setup fee, buy virtual number $1.35, long term virtual phone number, virtual number pricing, bulk virtual numbers, calliotel pricing"
        path="/pricing"
        schema={faqSchema([
          { q: 'How does billing work?', a: 'Choose 1, 3, 6, or 12-month prepaid plans. Longer terms unlock bigger discounts (up to 32% off on annual). Your subscription renews automatically unless cancelled. No setup fees or hidden charges.' },
          { q: 'How much do I save with annual?', a: 'Annual (12 months) is 32% off. A US number drops from $1.99/mo to just $1.35/mo when you prepay 12 months — that is $16.24 for an entire year.' },
          { q: 'Can I cancel anytime?', a: 'Yes. Cancel any number at any time from your dashboard. No questions asked, no cancellation fees.' },
          { q: 'Do bulk discounts apply to existing numbers?', a: 'Yes! When you reach a new volume tier the discount applies to your entire portfolio, including previously purchased numbers.' },
          { q: 'What payment methods do you accept?', a: 'We accept Visa, Mastercard, Amex, Apple Pay and Google Pay via Stripe, plus major cryptocurrencies (BTC, ETH, USDT, LTC, XRP, and more) via NOWPayments.' },
        ])}
      />
      <Navbar />

      {/* Hero */}
      <div className="pt-32 pb-12 bg-gradient-to-b from-gray-900 to-gray-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <KineticHeading size="hero" className="mb-6">
            Simple, Transparent Pricing
          </KineticHeading>
          <KineticText variant="fade" as="p" className="text-xl text-gray-400 max-w-3xl mx-auto">
            Up to <span className="text-emerald-500 font-bold">32% OFF</span> with annual prepay.
            Plus volume discounts up to <span className="text-emerald-500 font-bold">32% OFF</span>.
            No contracts, no setup fees, cancel anytime.
          </KineticText>
        </div>
      </div>

      {/* Annual Plan Tiers */}
      <div className="py-12 bg-gray-950">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <h2 className="text-3xl sm:text-4xl font-black text-white mb-3">
              Prepay & Save — Up to 32% Off
            </h2>
            <p className="text-gray-400 max-w-2xl mx-auto">
              The longer you commit, the bigger the discount. Example shown:
              <span className="text-white font-semibold"> US virtual number ($1.99/mo base)</span>.
            </p>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { months: 1,  total: 1.99,  perMo: 1.99, off: 0,  badge: 'Standard' },
              { months: 3,  total: 5.07,  perMo: 1.69, off: 15, badge: 'Save 15%' },
              { months: 6,  total: 9.54,  perMo: 1.59, off: 20, badge: 'Save 20%' },
              { months: 12, total: 16.24, perMo: 1.35, off: 32, badge: 'Best Value', highlight: true },
            ].map(plan => (
              <div
                key={plan.months}
                className={`relative p-6 rounded-2xl border-2 transition-transform hover:scale-105 ${
                  plan.highlight
                    ? 'bg-gradient-to-br from-emerald-600/20 to-emerald-700/10 border-emerald-500'
                    : 'bg-gray-900 border-gray-800'
                }`}
              >
                {plan.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-emerald-500 text-white text-xs font-bold rounded-full whitespace-nowrap">
                    KILLS call.com
                  </div>
                )}
                <div className="text-sm text-gray-400 mb-2 font-semibold">
                  {plan.months}-month plan
                </div>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className={`text-4xl font-black ${plan.highlight ? 'text-emerald-400' : 'text-white'}`}>
                    ${plan.perMo.toFixed(2)}
                  </span>
                  <span className="text-gray-400 text-sm">/mo</span>
                </div>
                <div className="text-xs text-gray-500 mb-3">
                  ${plan.total.toFixed(2)} total
                </div>
                {plan.off > 0 ? (
                  <div className="inline-block px-2 py-1 text-xs font-bold rounded bg-green-500/15 text-green-400">
                    {plan.badge}
                  </div>
                ) : (
                  <div className="inline-block px-2 py-1 text-xs font-bold rounded bg-gray-700 text-gray-300">
                    {plan.badge}
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="mt-4 text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-sm font-semibold mb-3">
              ✅ Flat-rate per number, per month. No per-minute fees. Unlimited inbound minutes included.
            </div>
          </div>
          <div className="mt-2 text-center text-xs text-gray-500">
            Pricing scales with country wholesale cost. Higher-cost countries (e.g. Sweden, Netherlands)
            still get the same percentage discounts. Choose your plan length on the
            <a href="/browse-numbers" className="text-emerald-400 hover:underline mx-1">number browse page</a>.
          </div>
        </div>
      </div>

      <TalkOfferSection />

      {/* SMS & Call Usage Rates */}
      <div className="py-12 bg-gray-900">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <h2 className="text-3xl sm:text-4xl font-black text-white mb-3">
              SMS &amp; Call Usage Rates
            </h2>
            <p className="text-gray-400 max-w-xl mx-auto">
              Pay-as-you-go from your wallet balance. No monthly caps, no surprises.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                icon: '📨',
                label: 'Outbound SMS',
                sublabel: 'US &amp; Canada',
                price: '$0.05',
                unit: 'per message',
                note: 'Telnyx carrier-grade delivery',
                color: 'emerald',
              },
              {
                icon: '🌍',
                label: 'Outbound SMS',
                sublabel: 'International',
                price: '$0.15',
                unit: 'per message',
                note: 'UK, NL, SE, PR &amp; more',
                color: 'blue',
              },
              {
                icon: '📞',
                label: 'Outbound Calls',
                sublabel: 'US &amp; Canada',
                price: '$0.02',
                unit: 'per minute',
                note: 'First $5 = 60 free minutes. Other countries vary.',
                color: 'purple',
              },
              {
                icon: '🎁',
                label: 'Inbound SMS &amp; Calls',
                sublabel: 'Always',
                price: 'FREE',
                unit: 'no charge',
                note: 'Receive unlimited, never pay',
                color: 'green',
              },
            ].map((item, i) => (
              <div key={i} className={`bg-gray-800 border border-gray-700 rounded-2xl p-6 text-center hover:border-${item.color}-500/50 transition-colors`}>
                <div className="text-3xl mb-3">{item.icon}</div>
                <div className="text-sm font-semibold text-gray-400 mb-1">{item.label}</div>
                <div className={`text-xs font-bold text-${item.color}-400 mb-3`} dangerouslySetInnerHTML={{ __html: item.sublabel }} />
                <div className={`text-3xl font-black ${item.price === 'FREE' ? 'text-green-400' : 'text-white'} mb-1`}>
                  {item.price}
                </div>
                <div className="text-xs text-gray-500 mb-2">{item.unit}</div>
                <div className="text-xs text-gray-500 leading-snug" dangerouslySetInnerHTML={{ __html: item.note }} />
              </div>
            ))}
          </div>
          <p className="text-center text-xs text-gray-600 mt-6">
            Rates shown include all fees — no hidden carrier surcharges. Wallet balance is deducted per use.
          </p>
        </div>
      </div>

      {/* Pricing Calculator */}
      <InteractivePricingCalculator />

      {/* Benefits Grid */}
      <div className="py-20 bg-gray-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl sm:text-4xl font-black text-center mb-12 text-white">
            Why Choose Calliotel?
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {benefits.map((benefit, index) => (
              <div
                key={index}
                className="p-6 rounded-2xl text-center transition-transform hover:scale-105 bg-gray-900 border border-gray-800"
              >
                <div className="flex justify-center mb-4 text-emerald-500">
                  {benefit.icon}
                </div>
                <h3 className="text-xl font-bold mb-2 text-white">{benefit.title}</h3>
                <p className="text-gray-400">{benefit.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* FAQ */}
      <div className="py-20 bg-gray-900">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl sm:text-4xl font-black text-center mb-12 text-white">
            Pricing FAQs
          </h2>
          <div className="space-y-4">
            {[
              {
                q: "How does billing work?",
                a: "Pick a plan length when you buy: 1, 3, 6, or 12 months. The full plan amount is charged upfront from your wallet, then auto-renews at the same length. Longer plans unlock bigger discounts (up to 32% off on annual). No setup fees, no hidden charges."
              },
              {
                q: "How much do I save with annual?",
                a: "Annual (12 months) is 32% off the monthly rate. A US number drops from $1.99/mo to $1.35/mo when you prepay 12 months — that's just $16.24 for an entire year."
              },
              {
                q: "Can I cancel anytime?",
                a: "Yes! Cancel any number at any time from your dashboard. No questions asked, no cancellation fees. Prepaid time stays active until the plan expires."
              },
              {
                q: "Do bulk discounts apply to existing numbers?",
                a: "Absolutely! When you reach a new tier, the discount applies to your entire portfolio, including previously purchased numbers."
              },
              {
                q: "What payment methods do you accept?",
                a: "We accept Visa, Mastercard, and American Express via Viva Wallet, plus major cryptocurrencies (BTC, ETH, USDT, LTC, XRP, TRX, and more) via NOWPayments. Crypto works in every country."
              }
            ].map((item, i) => (
              <div key={i} className="p-6 rounded-2xl bg-gray-800 border border-gray-700">
                <h3 className="text-lg font-bold mb-2 text-white">{item.q}</h3>
                <p className="text-gray-400 leading-relaxed">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <ProfessionalFooter />
      <TalkOfferModal />
    </div>
  );
};

export default PricingPage;
