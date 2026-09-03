import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, CheckCircle } from 'lucide-react';

const SEARCH_DATA = [
  { label: 'United States',  tag: 'Country · US', emoji: '🇺🇸', route: '/browse-numbers', hint: 'US virtual numbers from $1.99/mo' },
  { label: 'United Kingdom', tag: 'Country · UK', emoji: '🇬🇧', route: '/browse-numbers', hint: 'UK virtual numbers from $1.99/mo' },
  { label: 'Canada',         tag: 'Country · CA', emoji: '🇨🇦', route: '/browse-numbers', hint: 'Canadian numbers from $1.99/mo' },
  { label: 'Netherlands',    tag: 'Country · NL', emoji: '🇳🇱', route: '/browse-numbers', hint: 'Dutch numbers from $1.99/mo' },
  { label: 'Sweden',         tag: 'Country · SE', emoji: '🇸🇪', route: '/browse-numbers', hint: 'Swedish numbers from $1.99/mo' },
  { label: 'Puerto Rico',    tag: 'Country · PR', emoji: '🇵🇷', route: '/browse-numbers', hint: 'Puerto Rican numbers from $1.99/mo' },
];

const TAG_COLORS = {
  'Virtual Number': 'bg-blue-500/15 text-blue-400 border-blue-500/25',
};
function tagColor(tag) {
  const key = Object.keys(TAG_COLORS).find(k => tag.startsWith(k));
  return key ? TAG_COLORS[key] : 'bg-gray-700/50 text-gray-400 border-gray-600';
}

const SearchBox = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const searchRef = useRef(null);

  const searchResults = searchQuery.trim().length > 0
    ? SEARCH_DATA.filter(item =>
        item.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.tag.toLowerCase().includes(searchQuery.toLowerCase())
      ).slice(0, 7)
    : [];

  useEffect(() => {
    const handler = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) setShowDropdown(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="relative max-w-2xl mx-auto mt-16" ref={searchRef}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '14px 20px', borderRadius: 18,
        background: 'rgba(255,255,255,0.04)',
        border: showDropdown && searchResults.length > 0 ? '1px solid rgba(245,166,35,0.4)' : '1px solid rgba(255,255,255,0.1)',
        boxShadow: showDropdown && searchResults.length > 0 ? '0 0 0 3px rgba(245,166,35,0.08)' : 'none',
        transition: 'background-color 0.2s, border-color 0.2s',
      }}>
        <Search style={{ width: 18, height: 18, color: '#F5A623', flexShrink: 0 }} />
        <input
          type="text"
          value={searchQuery}
          onChange={e => { setSearchQuery(e.target.value); setShowDropdown(true); }}
          onFocus={() => setShowDropdown(true)}
          placeholder="Search — WhatsApp, Instagram, US numbers..."
          style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: '#fff', fontSize: 15, minWidth: 0 }}
        />
        {searchQuery ? (
          <button onClick={() => { setSearchQuery(''); setShowDropdown(false); }}
            style={{ background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: '50%', width: 24, height: 24, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <X style={{ width: 14, height: 14, color: 'rgba(255,255,255,0.5)' }} />
          </button>
        ) : (
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.06)', padding: '4px 10px', borderRadius: 8, flexShrink: 0, whiteSpace: 'nowrap' }}>
            800+ services
          </span>
        )}
      </div>

      {showDropdown && searchResults.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 8,
          background: 'rgba(12,12,24,0.98)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 16, boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
          zIndex: 50, overflow: 'hidden',
        }}>
          {searchResults.map((item, i) => (
            <button key={i}
              onMouseDown={() => { navigate(item.route); setShowDropdown(false); setSearchQuery(''); }}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 16px', background: 'transparent', border: 'none',
                borderBottom: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer',
                textAlign: 'left', transition: 'background 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(245,166,35,0.08)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <span style={{ fontSize: 20, width: 28, textAlign: 'center', flexShrink: 0 }}>{item.emoji}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>{item.label}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${tagColor(item.tag)}`}>{item.tag}</span>
                </div>
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.hint}</p>
              </div>
              <CheckCircle style={{ width: 16, height: 16, color: '#10b981', flexShrink: 0 }} />
            </button>
          ))}
          <div style={{ padding: '10px 16px', background: 'rgba(255,255,255,0.02)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>Showing {searchResults.length} results</span>
            <button onMouseDown={() => navigate('/browse-numbers')}
              style={{ fontSize: 12, color: '#F5A623', fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer' }}>
              Browse all countries →
            </button>
          </div>
        </div>
      )}
      {showDropdown && searchQuery.trim().length > 0 && searchResults.length === 0 && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 8, background: 'rgba(12,12,24,0.99)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: '20px', zIndex: 50, textAlign: 'center' }}>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', marginBottom: 8 }}>No match for "<span style={{ color: '#fff' }}>{searchQuery}</span>"</p>
          <button onMouseDown={() => navigate('/browse-numbers')} style={{ fontSize: 13, color: '#F5A623', fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer' }}>Browse all countries →</button>
        </div>
      )}
    </div>
  );
};

export default SearchBox;
