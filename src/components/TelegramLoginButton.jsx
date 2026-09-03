import React, { useEffect, useRef } from 'react';

/**
 * Telegram Login Widget — official Telegram-hosted button.
 *
 * Renders the @Calliotelbot login widget. When the user authorizes inside
 * Telegram, the global window.onTelegramAuth callback is fired with the
 * signed payload, which we forward to the parent via `onAuth`.
 *
 * Docs: https://core.telegram.org/widgets/login
 *
 * Note: the bot's domain MUST be set with @BotFather (/setdomain → calliotel.com)
 * for this widget to appear; otherwise Telegram silently refuses to render.
 */
const TelegramLoginButton = ({
  botUsername = 'Calliotelbot',
  onAuth,
  size = 'large',
  cornerRadius = 8,
  requestAccess = 'write',
  className = '',
}) => {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    container.innerHTML = '';

    // Expose a stable global callback that Telegram will invoke
    window.onTelegramAuth = (user) => {
      try {
        if (typeof onAuth === 'function') onAuth(user);
      } catch (e) {
        // swallow — caller handles errors via toast
      }
    };

    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.setAttribute('data-telegram-login', botUsername);
    script.setAttribute('data-size', size);
    script.setAttribute('data-radius', String(cornerRadius));
    script.setAttribute('data-onauth', 'onTelegramAuth(user)');
    script.setAttribute('data-request-access', requestAccess);
    container.appendChild(script);

    return () => {
      try { container.innerHTML = ''; } catch {}
    };
  }, [botUsername, size, cornerRadius, requestAccess, onAuth]);

  return (
    <div
      ref={containerRef}
      className={`flex items-center justify-center ${className}`}
      aria-label="Login with Telegram"
    />
  );
};

export default TelegramLoginButton;
