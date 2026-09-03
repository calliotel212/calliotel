import { useNavigate } from 'react-router-dom';

/**
 * Safe back navigation — uses browser history when available,
 * otherwise redirects to a fallback route.
 * Prevents "dead end" back buttons on direct-link or ad-traffic arrivals.
 */
const useGoBack = (fallback = '/dashboard') => {
  const navigate = useNavigate();
  return () => {
    if (window.history.state?.idx > 0) {
      navigate(-1);
    } else {
      navigate(fallback, { replace: true });
    }
  };
};

export default useGoBack;
