import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../hooks/use-toast';
import { getTelegramWebApp, isTelegramMiniApp } from '../utils/telegramMiniApp';

export default function TelegramMiniAppContinue({ onSuccess }) {
  const { telegramWebAppLogin } = useAuth();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  if (!isTelegramMiniApp()) return null;

  const onClick = async () => {
    const initData = getTelegramWebApp()?.initData;
    if (!initData) {
      toast({
        title: 'Open this from @Calliotelbot',
        description: 'Telegram sign-in only works inside the Mini App, not in Chrome.',
        variant: 'destructive',
      });
      return;
    }
    setBusy(true);
    const result = await telegramWebAppLogin(initData);
    setBusy(false);
    if (result?.success) {
      onSuccess?.(result);
      return;
    }
    toast({
      title: 'Telegram sign-in failed',
      description: result?.error || 'Try closing and opening the Mini App again.',
      variant: 'destructive',
    });
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="w-full flex items-center justify-center gap-2 px-4 py-3 font-semibold rounded-xl disabled:opacity-60"
      style={{ background: '#2AABEE', color: '#fff' }}
    >
      {busy ? 'Signing in…' : 'Continue with Telegram'}
    </button>
  );
}
