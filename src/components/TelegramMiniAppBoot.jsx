import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../hooks/use-toast';
import { bootTelegramWebApp, isMiniAppServicesStart, isTelegramMiniApp } from '../utils/telegramMiniApp';
import { resolvePostAuthRoute, setAuthRedirect } from '../utils/authRedirect';

const GATE_PATHS = new Set(['/', '/login', '/signup']);
const SHOP_PATHS = new Set(['/services', '/one-otp']);

export default function TelegramMiniAppBoot() {
  const { telegramWebAppLogin, loading } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const started = useRef(false);

  useEffect(() => {
    bootTelegramWebApp();
  }, []);

  useEffect(() => {
    if (loading || started.current) return;
    if (!isTelegramMiniApp()) return;
    const initData = window.Telegram?.WebApp?.initData;
    if (!initData) return;
    started.current = true;
    (async () => {
      const result = await telegramWebAppLogin(initData);
      if (!result?.success) {
        started.current = false;
        if (!GATE_PATHS.has(location.pathname)) {
          setAuthRedirect(`${location.pathname}${location.search}`);
        }
        toast({
          title: 'Telegram sign-in needs attention',
          description: result?.error || 'Tap Continue with Telegram to reconnect securely.',
          variant: 'destructive',
        });
        if (location.pathname !== '/login') {
          navigate('/login', { replace: true });
        }
        return;
      }
      if (SHOP_PATHS.has(location.pathname)) return;
      if (isMiniAppServicesStart()) {
        navigate('/services', { replace: true });
        return;
      }
      if (GATE_PATHS.has(location.pathname)) {
        navigate(resolvePostAuthRoute({ isNewUser: !!result.isNewUser }), { replace: true });
      }
    })();
  }, [loading, telegramWebAppLogin, navigate, location.pathname, location.search, toast]);

  return null;
}
