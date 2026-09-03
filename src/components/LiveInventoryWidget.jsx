import React, { useState, useEffect } from 'react';
import { X, TrendingUp, Zap, Globe, Phone } from 'lucide-react';

const activities = [
  { flag: '🇺🇸', text: 'USA number added', sub: '2 min ago' },
  { flag: '📊', text: '1,240+ USA numbers', sub: 'available now' },
  { flag: '🔥', text: '15 UK numbers claimed', sub: 'in the last hour' },
  { flag: '🇬🇧', text: 'UK number added', sub: '5 min ago' },
  { flag: '✨', text: '50+ Germany numbers', sub: 'just added' },
  { flag: '🇨🇦', text: 'Canada number added', sub: '1 min ago' },
];

const LiveInventoryWidget = ({ compact = false }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [current, setCurrent] = useState(0);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    if (localStorage.getItem('liveInventoryDismissed')) {
      setIsDismissed(true);
      return;
    }
    const t = setTimeout(() => setIsVisible(true), 3000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!isVisible || isDismissed) return;
    const interval = setInterval(() => {
      setFading(true);
      setTimeout(() => {
        setCurrent(p => (p + 1) % activities.length);
        setFading(false);
      }, 300);
    }, 8000);
    return () => clearInterval(interval);
  }, [isVisible, isDismissed]);

  const dismiss = () => {
    setFading(true);
    setTimeout(() => {
      setIsDismissed(true);
      localStorage.setItem('liveInventoryDismissed', 'true');
    }, 300);
  };

  if (isDismissed || !isVisible) return null;

  const act = activities[current];

  if (compact) {
    return (
      <div className={`fixed bottom-4 right-4 z-50 transition-all duration-300 ${fading ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0'}`}>
        <div className="flex items-center gap-2 px-3 py-2 bg-gray-900/90 border border-gray-700/80 rounded-xl shadow-lg backdrop-blur-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse flex-shrink-0" />
          <span className="text-sm">{act.flag}</span>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-white leading-tight truncate max-w-[140px]">{act.text}</p>
            <p className="text-[10px] text-gray-500 leading-tight">{act.sub}</p>
          </div>
          <button onClick={dismiss} className="ml-1 text-gray-600 hover:text-gray-300 transition-colors flex-shrink-0">
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`fixed bottom-6 right-6 z-50 transition-all duration-300 ${fading ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'}`}>
      <div className="relative w-72 rounded-2xl border border-gray-700/80 bg-gray-900/90 shadow-2xl backdrop-blur-sm">
        <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-2xl bg-gradient-to-r from-emerald-500 to-amber-400" />
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-xs font-bold uppercase tracking-wide text-gray-400">Live Activity</span>
            </div>
            <button onClick={dismiss} className="text-gray-600 hover:text-gray-300 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xl">{act.flag}</span>
            <div>
              <p className="font-bold text-white text-sm">{act.text}</p>
              <p className="text-xs text-gray-400">{act.sub}</p>
            </div>
          </div>
          <div className="mt-3 flex gap-1">
            {activities.map((_, i) => (
              <div key={i} className={`h-0.5 flex-1 rounded-full transition-all duration-300 ${i === current ? 'bg-emerald-400' : 'bg-gray-700'}`} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LiveInventoryWidget;
