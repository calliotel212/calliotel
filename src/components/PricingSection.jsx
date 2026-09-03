import React from 'react';
import { Check, ArrowRight, Award } from 'lucide-react';

const PricingSection = () => {
  // Pricing reflects live backend tier ladder (DURATION_DISCOUNTS):
  //   1mo = 0% off, 3mo = 15% off, 6mo = 20% off, 12mo = 32% off.
  const pricingPlans = [
    {
      country: 'United States',
      flag: '🇺🇸',
      monthly: '$1.99',
      annualTotal: '$16.24',
      annualPerMo: '$1.35/mo',
      savings: 'Save 32% (12-mo)',
      setupFee: 'No setup fee',
      features: [
        'Unlimited incoming calls & SMS',
        'Same-day activation',
        '1, 3, 6 or 12-month plans',
        'Cancel anytime'
      ]
    },
    {
      country: 'Canada',
      flag: '🇨🇦',
      monthly: '$1.99',
      annualTotal: '$16.24',
      annualPerMo: '$1.35/mo',
      savings: 'Save 32% (12-mo)',
      setupFee: 'No setup fee',
      features: [
        'Unlimited incoming calls & SMS',
        'Same-day activation',
        '1, 3, 6 or 12-month plans',
        'Cancel anytime'
      ]
    },
    {
      country: 'United Kingdom',
      flag: '🇬🇧',
      monthly: '$1.99',
      annualTotal: '$16.24',
      annualPerMo: '$1.35/mo',
      savings: 'Save 32% (12-mo)',
      setupFee: 'No setup fee',
      features: [
        'Unlimited incoming calls & SMS',
        'Same-day activation',
        '1, 3, 6 or 12-month plans',
        'Cancel anytime'
      ]
    },
    {
      country: 'Netherlands',
      flag: '🇳🇱',
      monthly: '$3.75',
      annualTotal: '$30.60',
      annualPerMo: '$2.55/mo',
      savings: 'Save 32% (12-mo)',
      setupFee: 'No setup fee',
      features: [
        'Unlimited incoming calls & SMS',
        'Same-day activation',
        '1, 3, 6 or 12-month plans',
        'Cancel anytime'
      ]
    }
  ];

  return (
    <section id="pricing" className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-4">
            Calliotel Pricing Plans
          </h2>
          <p className="text-xl text-gray-600">
            Flexible plans for every need. Choose your country and get started in minutes.
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {pricingPlans.map((plan, index) => (
            <div key={index} className="bg-white border-2 border-gray-200 rounded-2xl p-8 hover:border-ember hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2">
              <div className="text-center mb-6">
                <div className="text-5xl mb-3">{plan.flag}</div>
                <h3 className="text-2xl font-bold text-gray-900">{plan.country}</h3>
              </div>
              
              <div className="space-y-4 mb-6">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Monthly</p>
                  <p className="text-3xl font-bold text-gray-900">{plan.monthly}<span className="text-sm font-normal text-gray-500">/mo</span></p>
                </div>
                <div className="bg-green-50 border-2 border-green-500 rounded-xl p-3 -mx-1">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs font-bold text-green-700 uppercase tracking-wide">12-Month Plan</p>
                    <span className="text-[10px] font-bold bg-green-500 text-white px-2 py-0.5 rounded-full">BEST VALUE</span>
                  </div>
                  <p className="text-3xl font-bold text-green-700">{plan.annualPerMo}</p>
                  <p className="text-xs text-gray-600 mt-1">{plan.annualTotal} total · <span className="text-green-700 font-semibold">{plan.savings}</span></p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1">Setup Fee</p>
                  <p className="text-base font-semibold text-gray-700">{plan.setupFee}</p>
                </div>
              </div>

              <div className="space-y-3 mb-6">
                {plan.features.map((feature, idx) => (
                  <div key={idx} className="flex items-start space-x-2">
                    <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-gray-700">{feature}</span>
                  </div>
                ))}
              </div>

              <button className="w-full py-3 text-ember font-semibold hover:text-ember-light transition-colors flex items-center justify-center space-x-1 group">
                <span>View Details</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          ))}
        </div>

        {/* Premium Number Section */}
        <div className="bg-gradient-to-r from-ember/5 to-ember-light/5 rounded-3xl p-8 lg:p-12">
          <div className="grid lg:grid-cols-2 gap-8 items-center">
            <div>
              <h3 className="text-3xl font-bold text-gray-900 mb-4">
                Upgrade to Premium<br />Number Selection
              </h3>
              <ul className="space-y-3 mb-6">
                <li className="flex items-start space-x-2">
                  <span className="text-ember font-bold">•</span>
                  <span className="text-gray-700">One-time premium upgrade: <strong>$15</strong></span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="text-ember font-bold">•</span>
                  <span className="text-gray-700">Standard monthly/annual rates apply per country</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="text-ember font-bold">•</span>
                  <span className="text-gray-700">Select memorable, easy-to-remember numbers</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="text-ember font-bold">•</span>
                  <span className="text-gray-700">Perfect for business branding and marketing</span>
                </li>
              </ul>
              <button className="text-ember font-semibold hover:text-ember-light transition-colors flex items-center space-x-1 group">
                <span>Explore Premium Options</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
            <div className="flex justify-center">
              <div className="relative w-48 h-48 bg-gradient-to-br from-ember to-ember-light rounded-3xl flex items-center justify-center shadow-2xl transform hover:scale-105 transition-transform">
                <div className="text-white text-center">
                  <Award className="w-24 h-24 mx-auto mb-2" />
                  <p className="font-bold text-xl">PREMIUM</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default PricingSection;