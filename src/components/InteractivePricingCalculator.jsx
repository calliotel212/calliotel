import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, TrendingDown, ShoppingCart } from 'lucide-react';

const InteractivePricingCalculator = () => {
  const navigate = useNavigate();
  const [quantity, setQuantity] = useState(10);

  const getPricePerNumber = (qty) => {
    if (qty >= 31) return 1.19;
    if (qty >= 16) return 1.49;
    if (qty >= 6)  return 1.69;
    return 1.99;
  };

  const regularPrice       = 1.99;
  const pricePerNumber     = getPricePerNumber(quantity);
  const totalCost          = (pricePerNumber * quantity).toFixed(2);
  const totalSavings       = ((regularPrice - pricePerNumber) * quantity).toFixed(2);
  const discountPercentage = Math.round(((regularPrice - pricePerNumber) / regularPrice) * 100);

  const pricingTiers = [
    { min: 1,  max: 5,  price: 1.99, discount: 0,  label: 'Starter'    },
    { min: 6,  max: 15, price: 1.69, discount: 15, label: 'Growth'     },
    { min: 16, max: 30, price: 1.49, discount: 25, label: 'Business'   },
    { min: 31, max: 50, price: 1.19, discount: 40, label: 'Enterprise' },
  ];

  const currentTier = pricingTiers.find(t => quantity >= t.min && quantity <= t.max);

  return (
    <div className="py-24 relative overflow-hidden bg-gray-900">
      {/* Ambient blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 right-20 w-72 h-72 bg-emerald-600 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-pulse" />
        <div className="absolute bottom-20 left-20 w-72 h-72 bg-emerald-500 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-pulse delay-700" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-block mb-4">
            <span className="px-4 py-2 rounded-full text-sm font-bold bg-emerald-500/20 text-emerald-400">
              💰 VOLUME DISCOUNTS
            </span>
          </div>
          <h2 className="text-4xl sm:text-5xl font-black mb-4 text-white">
            Save More With Bulk Pricing
          </h2>
          <p className="text-xl text-gray-400 max-w-3xl mx-auto">
            The more numbers you need, the less you pay. Calculate your savings instantly.
          </p>
        </div>

        {/* Calculator Card */}
        <div className="max-w-4xl mx-auto p-8 md:p-12 rounded-3xl border border-gray-700 bg-gray-800/60 backdrop-blur-xl">
          {/* Tier Badge */}
          {currentTier && (
            <div className="flex justify-center mb-8">
              <div className="px-6 py-3 rounded-full bg-gradient-to-r from-emerald-500 to-amber-500 text-white font-bold text-lg shadow-lg shadow-emerald-500/20">
                <Sparkles className="inline w-5 h-5 mr-2" />
                {currentTier.label} Tier
                {currentTier.discount > 0 && <span className="ml-2">• {currentTier.discount}% OFF</span>}
              </div>
            </div>
          )}

          {/* Quantity Display */}
          <div className="text-center mb-8">
            <div className="text-7xl font-black mb-2 text-white">{quantity}</div>
            <div className="text-xl text-gray-400">Virtual Numbers</div>
          </div>

          {/* Slider */}
          <div className="mb-12">
            <input
              type="range"
              min="1"
              max="50"
              value={quantity}
              onChange={e => setQuantity(parseInt(e.target.value))}
              className="w-full h-3 rounded-full appearance-none cursor-pointer"
              style={{
                background: `linear-gradient(to right, #A855F7 0%, #F97316 ${(quantity / 50) * 100}%, #374151 ${(quantity / 50) * 100}%)`,
              }}
            />
            <div className="flex justify-between mt-2">
              <span className="text-sm text-gray-500">1</span>
              <span className="text-sm text-gray-500">50+</span>
            </div>
          </div>

          {/* Pricing Breakdown */}
          <div className="grid md:grid-cols-3 gap-6 mb-8">
            <div className="text-center">
              <div className="text-sm font-semibold mb-2 text-gray-400">Price Per Number</div>
              <div className="flex items-center justify-center space-x-2">
                {discountPercentage > 0 && (
                  <span className="text-2xl line-through text-gray-600">${regularPrice}</span>
                )}
                <span className="text-4xl font-black bg-gradient-to-r from-emerald-500 to-amber-500 bg-clip-text text-transparent">
                  ${pricePerNumber}
                </span>
              </div>
              <div className="text-xs mt-1 text-gray-500">per month</div>
            </div>

            <div className="text-center">
              <div className="text-sm font-semibold mb-2 text-gray-400">Total Monthly Cost</div>
              <div className="text-4xl font-black text-white">${totalCost}</div>
              <div className="text-xs mt-1 text-gray-500">billed monthly</div>
            </div>

            <div className="text-center">
              <div className="text-sm font-semibold mb-2 text-gray-400">You Save</div>
              <div className="flex items-center justify-center space-x-2">
                <TrendingDown className="w-6 h-6 text-green-400" />
                <span className="text-4xl font-black text-green-400">${totalSavings}</span>
              </div>
              <div className="text-xs mt-1 text-gray-500">per month</div>
            </div>
          </div>

          {/* Tiers Table */}
          <div className="p-6 rounded-2xl mb-8 bg-gray-900/80">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {pricingTiers.map((tier, i) => (
                <div
                  key={i}
                  className={`text-center p-4 rounded-xl transition-all ${
                    quantity >= tier.min && quantity <= tier.max
                      ? 'bg-gradient-to-br from-emerald-500 to-amber-500 text-white scale-105 shadow-lg shadow-emerald-500/20'
                      : 'bg-gray-800 text-gray-400 border border-gray-700'
                  }`}
                >
                  <div className="font-bold text-sm mb-1">{tier.label}</div>
                  <div className="text-xs mb-2">{tier.min}–{tier.max} numbers</div>
                  <div className="text-lg font-black">${tier.price}</div>
                  {tier.discount > 0 && <div className="text-xs mt-1">{tier.discount}% OFF</div>}
                </div>
              ))}
            </div>
          </div>

          {/* CTA */}
          <button
            onClick={() => navigate('/browse-numbers')}
            className="w-full py-4 px-8 bg-gradient-to-r from-emerald-500 to-amber-500 text-white font-bold text-lg rounded-xl hover:shadow-2xl hover:shadow-emerald-500/20 transition-all duration-300 hover:scale-[1.02] flex items-center justify-center space-x-2"
          >
            <ShoppingCart className="w-6 h-6" />
            <span>Get Started with {quantity} Numbers</span>
          </button>

          <div className="text-center mt-6 text-sm text-gray-500">
            ✓ Instant activation &nbsp;•&nbsp; ✓ No setup fees &nbsp;•&nbsp; ✓ Cancel anytime
          </div>
        </div>

        <div className="text-center mt-12">
          <p className="text-sm text-gray-500">
            🏢 Need 50+ numbers?{' '}
            <span
              className="text-emerald-400 font-semibold cursor-pointer hover:underline"
              onClick={() => navigate('/help')}
            >
              Contact us
            </span>{' '}
            for enterprise pricing
          </p>
        </div>
      </div>
    </div>
  );
};

export default InteractivePricingCalculator;
