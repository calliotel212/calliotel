import { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import keepAliveManager from '../utils/keepAliveManager';

/**
 * While the user is logged in, keep the session awake (screen wake lock +
 * push subscription heartbeat) so SMS/call alerts keep arriving.
 */
const KeepAliveWatcher = () => {
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    if (!isAuthenticated) {
      keepAliveManager.stop();
      return undefined;
    }

    keepAliveManager.start();

    // Re-request wake lock after first user gesture (browser policy)
    const unlock = () => {
      keepAliveManager.start();
      document.removeEventListener('pointerdown', unlock);
      document.removeEventListener('keydown', unlock);
    };
    document.addEventListener('pointerdown', unlock, { once: true });
    document.addEventListener('keydown', unlock, { once: true });

    return () => {
      document.removeEventListener('pointerdown', unlock);
      document.removeEventListener('keydown', unlock);
      keepAliveManager.stop();
    };
  }, [isAuthenticated]);

  return null;
};

export default KeepAliveWatcher;
