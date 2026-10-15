import React, { useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Mail, Lock, ArrowRight, Loader, AlertCircle, Eye, EyeOff, UserCheck } from 'lucide-react';
import { useGoogleLogin } from '@react-oauth/google';
import TelegramLoginButton from '../components/TelegramLoginButton';
import { trackSignup } from '../utils/gtagConversions';
import { useToast } from '../hooks/use-toast';
import safeLocalStorage from '../utils/safeLocalStorage';
import {
  captureNextFromSearchParams,
  resolvePostAuthRoute,
} from '../utils/authRedirect';
import isIosAppShell from '../utils/isIosAppShell';
import TelegramMiniAppContinue from '../components/TelegramMiniAppContinue';
import { isTelegramMiniApp } from '../utils/telegramMiniApp';

const LOCAL_OTP_DEMO = /localhost|127\.0\.0\.1/.test(process.env.REACT_APP_BACKEND_URL || '');

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [quickLoading, setQuickLoading] = useState(false);
  const [searchParams] = useSearchParams();
  const { login, googleLogin, telegramLogin } = useAuth();
  const inTelegramMiniApp = isTelegramMiniApp();
  const hideSocialLogin = isIosAppShell();

  const handleTelegramAuth = async (tgUser) => {
    const result = await telegramLogin(tgUser);
    if (result.success) {
      if (result.isNewUser) trackSignup({ email: result.user?.email });
      toast({
        title: result.isNewUser ? '🎉 Welcome to Calliotel!' : 'Welcome back!',
        description: result.isNewUser
          ? 'Account created via Telegram. Add a real email in Account Settings to receive notifications.'
          : `Signed in as ${result.user?.full_name || result.user?.username || ''}`,
      });
      navigate(resolvePostAuthRoute({ isNewUser: !!result.isNewUser }), { replace: true });
    } else {
      toast({ title: 'Telegram sign-in failed', description: result.error, variant: 'destructive' });
    }
  };
  const [googleLoading, setGoogleLoading] = useState(false);
  const navigate = useNavigate();
  const afterLoginRoute = (isNewUser = false) => resolvePostAuthRoute({ isNewUser });
  const { toast } = useToast();

  const savedQuickEmail = safeLocalStorage.getItem('rememberedEmail');
  const savedQuickToken = safeLocalStorage.getItem('rememberToken');
  const hasQuickLogin = !!(savedQuickEmail && savedQuickToken);

  React.useEffect(() => {
    captureNextFromSearchParams(searchParams);

    const error = searchParams.get('error');
    const reason = searchParams.get('reason');
    if (error === 'authentication_failed') {
      toast({
        title: "Authentication Failed",
        description: "Unable to complete sign in. Please try again.",
        variant: "destructive",
      });
      window.history.replaceState({}, '', '/login');
    }

    const emailFromQuery = searchParams.get('email');
    if (emailFromQuery) {
      setEmail(emailFromQuery);
    }

    const savedEmail = localStorage.getItem('rememberedEmail');
    const savedRememberMe = localStorage.getItem('rememberMe') === 'true';
    
    if (!emailFromQuery && savedEmail && savedRememberMe) {
      setEmail(savedEmail);
      setRememberMe(true);
    }
  }, [searchParams, toast]);

  const handleQuickLogin = async () => {
    if (!savedQuickToken) return;
    setQuickLoading(true);
    try {
      safeLocalStorage.setItem('token', savedQuickToken);
      window.location.href = '/sms';
    } catch (e) {
      safeLocalStorage.removeItem('rememberToken');
      toast({ title: "Quick login expired", description: "Please sign in with your password.", variant: "destructive" });
      setQuickLoading(false);
    }
  };

  const handleGoogleLogin = useGoogleLogin({
    flow: 'implicit',
    onSuccess: async (tokenResponse) => {
      setGoogleLoading(true);
      const result = await googleLogin({ access_token: tokenResponse.access_token });
      setGoogleLoading(false);
      if (result.success) {
        // If a brand-new account was created from the login screen via Google,
        // fire the Sign-Up conversion (otherwise it's just a returning login).
        if (result.isNewUser) {
          try {
            const { trackSignup } = await import('../utils/gtagConversions');
            trackSignup({ email: result.user?.email });
          } catch (_e) { /* analytics best-effort */ }
        }
        toast({
          title: result.isNewUser ? '🎉 Welcome to Calliotel!' : 'Welcome back!',
          description: result.isNewUser
            ? `Account created for ${result.user?.email}. Check your inbox!`
            : `Signed in as ${result.user?.email}`,
        });
        navigate(afterLoginRoute(!!result.isNewUser), { replace: true });
      } else {
        toast({ title: 'Google sign-in failed', description: result.error, variant: 'destructive' });
      }
    },
    onError: () => {
      toast({ title: 'Google sign-in failed', description: 'Could not authenticate with Google.', variant: 'destructive' });
    },
  });


  const handleSubmit = async (e) => {
    e.preventDefault();
    
    console.log('Login attempt started');
    console.log('Email:', email);
    
    setLoading(true);

    try {
      const result = await login(email, password, totpCode);
      
      console.log('Login result:', result);
      
      if (result.success) {
        if (rememberMe) {
          localStorage.setItem('rememberedEmail', email);
          localStorage.setItem('rememberMe', 'true');
          const currentToken = safeLocalStorage.getItem('token');
          if (currentToken) safeLocalStorage.setItem('rememberToken', currentToken);
        } else {
          localStorage.removeItem('rememberedEmail');
          localStorage.removeItem('rememberMe');
          safeLocalStorage.removeItem('rememberToken');
        }

        toast({
          title: "Welcome back!",
          description: "You've successfully logged in",
        });
        
        setTimeout(() => {
          // Pending number / ?next= always win over stale onboarding flag
          navigate(afterLoginRoute(false), { replace: true });
        }, 100);
      } else {
        const err = result.error || '';
        const errLower = err.toLowerCase();

        if (errLower.includes('google sign-in') || errLower.includes('continue with google')) {
          toast({
            title: "Use Google to sign in",
            description: err,
            variant: "destructive",
            duration: 7000,
          });
        } else if (errLower.includes('telegram')) {
          toast({
            title: "Use Telegram to sign in",
            description: err,
            variant: "destructive",
            duration: 7000,
          });
        } else if (errLower.includes('no password set')) {
          toast({
            title: "Password not set",
            description: err,
            variant: "destructive",
            duration: 7000,
          });
        } else if (errLower.includes('no account') || errLower.includes('not found')) {
          toast({
            title: "Account not found",
            description: (
              <div>
                <p className="mb-2">No account exists with that email address.</p>
                <Link
                  to="/signup"
                  className="text-emerald-400 hover:text-emerald-300 underline font-semibold"
                >
                  Create an account →
                </Link>
              </div>
            ),
            variant: "destructive",
            duration: 7000,
          });
        } else if (errLower.includes('two-factor')) {
          toast({
            title: "Authenticator code needed",
            description: "Enter the 6-digit code from your authenticator app (or a backup code).",
            variant: "destructive",
            duration: 7000,
          });
        } else if (errLower.includes('incorrect password')) {
          toast({
            title: "Wrong password",
            description: (
              <div>
                <p className="mb-2">The password you entered is incorrect.</p>
                <Link
                  to="/forgot-password"
                  className="text-emerald-400 hover:text-emerald-300 underline font-semibold"
                >
                  Forgot password? Reset it →
                </Link>
              </div>
            ),
            variant: "destructive",
            duration: 7000,
          });
        } else {
          toast({
            title: "Login failed",
            description: err || "Something went wrong. Please try again.",
            variant: "destructive",
          });
        }
      }
    } catch (error) {
      console.error('Login error:', error);
      toast({
        title: "Login error",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const BRAND = '#F5A623';

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--bg-page)' }}>
      <div
        className="max-w-md w-full rounded-2xl p-8"
        style={{
          background: 'var(--bg-card)',
          border: '1px solid rgba(245,166,35,0.28)',
          boxShadow: '0 0 40px rgba(245,166,35,0.18)',
        }}
      >
        <div className="text-center mb-8">
          <div className="flex items-center justify-center space-x-2 mb-4">
            <img src="/logo.png" alt="Calliotel" className="w-12 h-12 rounded-xl" />
            <span className="text-3xl font-black tracking-wide" style={{ color: '#2563EB' }}>CALLIOTEL</span>
          </div>
          <h2 className="text-2xl font-bold text-white">Welcome back</h2>
          <p className="mt-2" style={{ color: 'var(--text-2)' }}>
            Sign in to manage your numbers and wallet
          </p>
        </div>

        {hasQuickLogin && (
          <div className="mb-6">
            <button
              type="button"
              onClick={handleQuickLogin}
              disabled={quickLoading}
              className="w-full flex items-center gap-3 px-4 py-4 font-semibold rounded-xl transition-all disabled:opacity-50"
              style={{ background: `linear-gradient(135deg, ${BRAND}, #d4901d)`, color: '#000', boxShadow: '0 8px 24px rgba(245,166,35,0.35)' }}
            >
              {quickLoading ? (
                <Loader className="w-5 h-5 animate-spin" />
              ) : (
                <UserCheck className="w-5 h-5" />
              )}
              <div className="flex-1 text-left">
                <p className="text-sm font-bold">Quick Login as {savedQuickEmail}</p>
                <p className="text-xs" style={{ color: 'rgba(0,0,0,0.65)' }}>One click — no password needed</p>
              </div>
              <ArrowRight className="w-5 h-5" />
            </button>
            <div className="flex items-center my-4">
              <div className="flex-1 border-t" style={{ borderColor: 'rgba(255,255,255,0.1)' }} />
              <span className="px-3 text-xs" style={{ color: 'var(--text-2)' }}>or use another account</span>
              <div className="flex-1 border-t" style={{ borderColor: 'rgba(255,255,255,0.1)' }} />
            </div>
          </div>
        )}

        {LOCAL_OTP_DEMO && (
          <p className="mb-4 text-[13px] leading-snug text-amber-200">
            Local OTP demo — skip Google. Any email + any password signs you in with a $20 test wallet.
          </p>
        )}

        {!LOCAL_OTP_DEMO && !hideSocialLogin && (
        <div className="space-y-2 mb-6">
          {inTelegramMiniApp && (
            <div className="space-y-2">
              <TelegramMiniAppContinue
                onSuccess={(result) => {
                  if (result.isNewUser) trackSignup({ email: result.user?.email });
                  toast({
                    title: result.isNewUser ? 'Welcome to Calliotel!' : 'Welcome back!',
                    description: result.isNewUser
                      ? 'Signed in with Telegram.'
                      : `Signed in as ${result.user?.full_name || result.user?.username || ''}`,
                  });
                  navigate(resolvePostAuthRoute({ isNewUser: !!result.isNewUser }), { replace: true });
                }}
              />
              <p className="text-xs text-center" style={{ color: 'var(--text-2)' }}>
                Google / Gmail sign-in does not work inside Telegram. Use the button above, or email.
              </p>
            </div>
          )}
          {!inTelegramMiniApp && (
          <button type="button" onClick={() => handleGoogleLogin()} disabled={googleLoading}
            className="w-full flex items-center gap-3 px-4 py-3 bg-white hover:bg-gray-100 disabled:opacity-60 text-gray-800 font-semibold rounded-xl transition-all border border-gray-200 shadow-sm">
            <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            <span className="flex-1 text-center">Continue with Google</span>
          </button>
          )}
          {!inTelegramMiniApp && (
          <div className="flex justify-center">
            <TelegramLoginButton botUsername="Calliotelbot" onAuth={handleTelegramAuth} size="large" cornerRadius={10} />
          </div>
          )}
        </div>
        )}

        {!hideSocialLogin && (
        <div className="flex items-center my-4">
          <div className="flex-1 border-t" style={{ borderColor: 'rgba(255,255,255,0.1)' }} />
          <span className="px-3 text-xs" style={{ color: 'var(--text-2)' }}>or sign in with email</span>
          <div className="flex-1 border-t" style={{ borderColor: 'rgba(255,255,255,0.1)' }} />
        </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-2)' }}>
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5" style={{ color: 'var(--text-3)' }} />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full pl-10 pr-4 py-3 rounded-lg text-white placeholder-gray-500 outline-none"
                style={{ background: 'var(--bg-input)', border: '1px solid rgba(255,255,255,0.12)' }}
                onFocus={(e) => { e.target.style.borderColor = 'rgba(245,166,35,0.55)'; }}
                onBlur={(e) => { e.target.style.borderColor = 'rgba(255,255,255,0.12)'; }}
                placeholder="you@example.com"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-2)' }}>
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5" style={{ color: 'var(--text-3)' }} />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full pl-10 pr-12 py-3 rounded-lg text-white placeholder-gray-500 outline-none"
                style={{ background: 'var(--bg-input)', border: '1px solid rgba(255,255,255,0.12)' }}
                onFocus={(e) => { e.target.style.borderColor = 'rgba(245,166,35,0.55)'; }}
                onBlur={(e) => { e.target.style.borderColor = 'rgba(255,255,255,0.12)'; }}
                placeholder="Enter your password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 hover:opacity-70 transition-opacity"
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <EyeOff className="w-5 h-5" style={{ color: 'var(--text-2)' }} />
                ) : (
                  <Eye className="w-5 h-5" style={{ color: 'var(--text-2)' }} />
                )}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-2)' }}>
              Authenticator code <span className="font-normal opacity-70">(only if you turned on 2FA)</span>
            </label>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value)}
              className="w-full px-4 py-3 rounded-lg text-white placeholder-gray-500 outline-none"
              style={{ background: 'var(--bg-input)', border: '1px solid rgba(255,255,255,0.12)' }}
              placeholder="Optional 6-digit code"
            />
          </div>

          <div className="flex items-center justify-between">
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="rounded cursor-pointer"
                style={{ accentColor: BRAND }}
              />
              <span className="ml-2 text-sm" style={{ color: 'var(--text-2)' }}>
                Remember me
              </span>
            </label>
            <Link to="/forgot-password" className="text-sm font-semibold hover:underline" style={{ color: BRAND }}>
              Forgot password?
            </Link>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            style={{ background: BRAND, color: '#000', boxShadow: '0 8px 28px rgba(245,166,35,0.4)' }}
          >
            {loading ? (
              <>
                <Loader className="w-5 h-5 animate-spin" />
                <span>Signing in...</span>
              </>
            ) : (
              <>
                <span>Sign In</span>
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </form>

        <p className="text-center mt-6" style={{ color: 'var(--text-2)' }}>
          Don't have an account?{' '}
          <Link to="/signup" className="font-semibold hover:underline" style={{ color: BRAND }}>
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
};

export default LoginPage;