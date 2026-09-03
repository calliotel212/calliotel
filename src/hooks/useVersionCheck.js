import { useEffect } from 'react';

/**
 * Version Check Hook
 * Silently records the current app version.
 * Does NOT clear localStorage, sessionStorage, or force reloads —
 * users should never be logged out due to a version bump.
 */
export const useVersionCheck = () => {
  useEffect(() => {
    const CURRENT_VERSION = 'v1.0.1_fortress';
    localStorage.setItem('app_version', CURRENT_VERSION);
  }, []);
};

export default useVersionCheck;
