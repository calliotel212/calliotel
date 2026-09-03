import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import safeLocalStorage from '../utils/safeLocalStorage';
import { peekPendingNumberPurchase } from '../utils/authRedirect';

/** First-hour: this screen is no longer a room. Go pick a number or finish a pending buy. */
const OnboardingPage = () => {
  const navigate = useNavigate();

  useEffect(() => {
    safeLocalStorage.removeItem('calliotel_show_onboarding');
    safeLocalStorage.setItem('onboarding_seen_v3', '1');
    const pending = peekPendingNumberPurchase();
    navigate(pending ? '/first-hour' : '/browse-numbers?first=1', { replace: true });
  }, [navigate]);

  return (
    <div style={{
      minHeight: '60vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: '#080810',
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: '50%',
        border: '3px solid rgba(245,166,35,0.2)',
        borderTopColor: '#F5A623',
        animation: 'spin 0.7s linear infinite',
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default OnboardingPage;
