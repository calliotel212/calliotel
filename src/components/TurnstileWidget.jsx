import { useEffect, useRef, useState } from 'react';

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
export const TURNSTILE_SITE_KEY = process.env.REACT_APP_TURNSTILE_SITE_KEY || '';

let scriptPromise = null;
function loadScript() {
  if (window.turnstile) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = SCRIPT_SRC;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => {
      scriptPromise = null;
      reject(new Error('turnstile script failed'));
    };
    document.head.appendChild(s);
  });
  return scriptPromise;
}

/**
 * Renders nothing when REACT_APP_TURNSTILE_SITE_KEY is unset, so signup keeps
 * working before the Cloudflare keys are configured.
 */
export default function TurnstileWidget({ onToken }) {
  const box = useRef(null);
  const widgetId = useRef(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) return undefined;
    let cancelled = false;
    loadScript()
      .then(() => {
        if (cancelled || !box.current || !window.turnstile) return;
        widgetId.current = window.turnstile.render(box.current, {
          sitekey: TURNSTILE_SITE_KEY,
          theme: 'dark',
          appearance: 'interaction-only',
          callback: (token) => onToken(token),
          'expired-callback': () => onToken(''),
          'error-callback': () => onToken(''),
        });
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      if (widgetId.current && window.turnstile) {
        try { window.turnstile.remove(widgetId.current); } catch { /* already gone */ }
      }
    };
  }, [onToken]);

  if (!TURNSTILE_SITE_KEY) return null;
  return (
    <div>
      <div ref={box} />
      {failed && (
        <p className="text-xs text-red-400 mt-1">
          The security check could not load. Please disable ad-blockers for this page or refresh.
        </p>
      )}
    </div>
  );
}
