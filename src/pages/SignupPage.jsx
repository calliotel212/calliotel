import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { trackSignup } from '../utils/gtagConversions';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Mail, Lock, User, ArrowRight, Gift, Eye, EyeOff, Key } from 'lucide-react';
import { useGoogleLogin } from '@react-oauth/google';
import { useToast } from '../hooks/use-toast';
import TelegramLoginButton from '../components/TelegramLoginButton';
import {
  captureNextFromSearchParams,
  resolvePostAuthRoute,
} from '../utils/authRedirect';
import isIosAppShell from '../utils/isIosAppShell';
import TelegramMiniAppContinue from '../components/TelegramMiniAppContinue';
import { isTelegramMiniApp } from '../utils/telegramMiniApp';
import TurnstileWidget, { TURNSTILE_SITE_KEY } from '../components/TurnstileWidget';

// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const SignupPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState('');
  const birthday = '';
  const [referralCode, setReferralCode] = useState('');
  const termsAccepted = true; // implied by proceeding — shown as notice below
  const [loading, setLoading] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState('');
  const { signup } = useAuth();
  const { darkMode } = useTheme();
  const navigate = useNavigate();
  const afterAuthRoute = (isNewUser) => resolvePostAuthRoute({ isNewUser });
  const { toast } = useToast();
  const [searchParams] = useSearchParams();

  // Generate strong random password
  const generatePassword = () => {
    const length = 12;
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const symbols = '!@#$%^&*';
    const allChars = uppercase + lowercase + numbers + symbols;
    
    let generatedPassword = '';
    // Ensure at least one of each type
    generatedPassword += uppercase[Math.floor(Math.random() * uppercase.length)];
    generatedPassword += lowercase[Math.floor(Math.random() * lowercase.length)];
    generatedPassword += numbers[Math.floor(Math.random() * numbers.length)];
    generatedPassword += symbols[Math.floor(Math.random() * symbols.length)];
    
    // Fill the rest randomly
    for (let i = generatedPassword.length; i < length; i++) {
      generatedPassword += allChars[Math.floor(Math.random() * allChars.length)];
    }
    
    // Shuffle the password
    generatedPassword = generatedPassword.split('').sort(() => Math.random() - 0.5).join('');
    
    setPassword(generatedPassword);
    setShowPassword(true); // Show the generated password
    
    toast({
      title: "🔐 Strong Password Generated!",
      description: "A secure password has been created for you",
    });
  };

  const [promoCode, setPromoCode] = useState('');
  const [promoValid, setPromoValid] = useState(null);
  const [formError, setFormError] = useState(null);
  const [emailExists, setEmailExists] = useState(false);

  useEffect(() => {
    // Honor ?next=/browse-numbers (and similar) across email + Google/Telegram signup
    captureNextFromSearchParams(searchParams);

    const refCode = searchParams.get('ref');
    if (refCode) setReferralCode(refCode);

    const promo = searchParams.get('promo');
    if (promo) {
      setPromoCode(promo.toUpperCase());
      fetch(`${BACKEND_URL}/api/promo/validate/${promo}`)
        .then(r => r.json())
        .then(d => setPromoValid(d.valid ? d : null))
        .catch(() => {});
    }

    const utm = {};
    ['utm_source','utm_medium','utm_campaign','utm_content','utm_term'].forEach(k => {
      const v = searchParams.get(k);
      if (v) utm[k] = v;
    });
    if (Object.keys(utm).length > 0) {
      try { sessionStorage.setItem('calliotel_utm', JSON.stringify(utm)); } catch {}
    }
  }, [searchParams]);

  const { googleLogin, telegramLogin } = useAuth();
  const inTelegramMiniApp = isTelegramMiniApp();
  const [googleLoading, setGoogleLoading] = useState(false);
  const hideSocialLogin = isIosAppShell();

  const handleTelegramAuth = async (tgUser) => {
    const result = await telegramLogin(tgUser);
    if (result.success) {
      if (result.isNewUser) trackSignup({ email: result.user?.email });
      toast({
        title: result.isNewUser ? '🎉 Welcome to Calliotel!' : '✅ Signed in with Telegram',
        description: result.isNewUser
          ? `Account created via Telegram. Add a real email in Account Settings to receive notifications.`
          : `Welcome back, ${result.user?.full_name || result.user?.username || ''}!`,
      });
      navigate(afterAuthRoute(!!result.isNewUser), { replace: true });
    } else {
      toast({ title: 'Telegram sign-in failed', description: result.error, variant: 'destructive' });
    }
  };

  const handleGoogleSignup = useGoogleLogin({
    flow: 'implicit',
    onSuccess: async (tokenResponse) => {
      setGoogleLoading(true);
      const result = await googleLogin({ access_token: tokenResponse.access_token });
      setGoogleLoading(false);
      if (result.success) {
        // Only fire the Sign-Up conversion when this Google login actually
        // CREATED a new account — never fires for repeat sign-ins of existing users.
        if (result.isNewUser) {
          trackSignup({ email: result.user?.email });
        }
        toast({
          title: result.isNewUser ? '🎉 Welcome to Calliotel!' : '✅ Signed in with Google',
          description: result.isNewUser
            ? `Account created for ${result.user?.email}. Check your inbox!`
            : `Welcome back, ${result.user?.full_name || result.user?.email}!`,
        });
        navigate(afterAuthRoute(!!result.isNewUser), { replace: true });
      } else {
        toast({ title: 'Google sign-in failed', description: result.error, variant: 'destructive' });
      }
    },
    onError: () => {
      toast({ title: 'Google sign-in failed', description: 'Could not authenticate with Google.', variant: 'destructive' });
    },
  });


  const getPasswordStrength = (pwd) => {
    if (!pwd) return { score: 0, label: '', color: '' };
    let score = 0;
    if (pwd.length >= 8) score++;
    if (pwd.length >= 12) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;
    if (score <= 1) return { score, label: 'Very Weak', color: 'bg-red-500' };
    if (score === 2) return { score, label: 'Weak', color: 'bg-emerald-500' };
    if (score === 3) return { score, label: 'Fair', color: 'bg-yellow-500' };
    if (score === 4) return { score, label: 'Strong', color: 'bg-green-400' };
    return { score, label: 'Very Strong', color: 'bg-green-500' };
  };
  const strength = getPasswordStrength(password);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    setLoading(true);
    setFormError(null);
    setEmailExists(false);

    const result = await signup(email, password, fullName, birthday, referralCode, termsAccepted, turnstileToken);
    
    if (result.success) {
      if (promoCode && promoValid) {
        try { sessionStorage.setItem('pending_promo', promoCode); } catch {}
      }
      try {
        const utm = sessionStorage.getItem('calliotel_utm');
        if (utm) sessionStorage.setItem('signup_utm', utm);
      } catch {}
      const bonusMsg = promoCode
        ? `Account created! Your $${promoValid?.discount_value || 5} promo credit will be applied after email verification.`
        : "We've sent a verification email! Check your inbox and spam/junk folder.";
      toast({
        title: "✅ Account Created!",
        description: bonusMsg,
        duration: 8000,
      });
      trackSignup({ email });
      // Prefer pending number / ?next= over generic onboarding
      try { localStorage.setItem('calliotel_show_onboarding', '1'); } catch {}
      navigate(afterAuthRoute(true), { replace: true });
    } else if (result.code === 'email_exists') {
      setEmailExists(true);
      setFormError(result.error);
      toast({
        title: 'This email already has an account',
        description: 'Please log in instead — or use Forgot password if you need a reset.',
        variant: 'destructive',
        duration: 8000,
      });
    } else {
      setFormError(result.error || 'Signup failed');
      toast({
        title: 'Signup failed',
        description: result.error,
        variant: 'destructive',
      });
    }
    
    setLoading(false);
  };

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
        {promoValid && (
          <div className="mb-4 p-3 bg-green-900/30 border border-green-500/40 rounded-xl text-center">
            <p className="text-green-400 text-sm font-semibold">
              🎁 Promo code <span className="text-white font-mono">{promoCode}</span> applied — Get ${promoValid.discount_value} free credit!
            </p>
          </div>
        )}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center space-x-2 mb-4">
            <img src="/logo.png" alt="Calliotel" className="w-12 h-12 rounded-xl" />
            <span className="text-3xl font-black tracking-wide" style={{ color: '#2563EB' }}>CALLIOTEL</span>
          </div>
          <h2 className="text-2xl font-bold text-white">
            Create your Calliotel account
          </h2>
          <p className="mt-2" style={{ color: 'var(--text-2)' }}>
            Get a virtual number in 60 seconds — no ID required
          </p>
          <p className="text-xs mt-2" style={{ color: 'var(--text-2)' }}>
            Works with Outlook, Hotmail, Yahoo, iCloud, Proton — any email, not only Gmail
          </p>
        </div>

        {/* ToS notice — same legal coverage, zero friction (Google/Apple/X pattern) */}
        <p className="text-xs text-gray-500 text-center mb-5 leading-relaxed">
          By creating an account you agree to Calliotel's{' '}
          <Link to="/terms" target="_blank" rel="noopener noreferrer" className="text-ember underline hover:text-ember-light">Terms of Service</Link>
          {' '}and{' '}
          <Link to="/privacy" target="_blank" rel="noopener noreferrer" className="text-ember underline hover:text-ember-light">Privacy Policy</Link>
          .
        </p>

        {!hideSocialLogin && (
        <div className="space-y-2 mb-6">
          {inTelegramMiniApp && (
            <div className="space-y-2">
              <TelegramMiniAppContinue
                onSuccess={(result) => {
                  if (result.isNewUser) trackSignup({ email: result.user?.email });
                  toast({
                    title: result.isNewUser ? 'Welcome to Calliotel!' : 'Signed in with Telegram',
                    description: result.isNewUser
                      ? 'Account created via Telegram.'
                      : `Welcome back, ${result.user?.full_name || result.user?.username || ''}!`,
                  });
                  navigate(afterAuthRoute(!!result.isNewUser), { replace: true });
                }}
              />
              <p className="text-xs text-center text-gray-400">
                Google / Gmail sign-in does not work inside Telegram. Use the button above, or email.
              </p>
            </div>
          )}
          {!inTelegramMiniApp && (
          <button type="button" onClick={() => handleGoogleSignup()} disabled={googleLoading}
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
        <div className="flex items-center my-6">
          <div className="flex-1 border-t border-ember/20"></div>
          <span className="px-4 text-sm text-gray-400">or sign up with email</span>
          <div className="flex-1 border-t border-ember/20"></div>
        </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {(emailExists || formError) && (
            <div
              className={`rounded-xl px-4 py-3 text-sm border ${
                emailExists
                  ? 'bg-amber-500/10 border-amber-500/40 text-amber-200'
                  : 'bg-red-500/10 border-red-500/40 text-red-300'
              }`}
              role="alert"
            >
              <p className="font-semibold mb-1">
                {emailExists ? 'This email already has an account' : 'Couldn’t create account'}
              </p>
              <p className="opacity-90 mb-2">
                {emailExists
                  ? 'You already signed up with this email. Log in to continue — or reset your password if you forgot it.'
                  : formError}
              </p>
              {emailExists && (
                <div className="flex flex-wrap gap-3 mt-1">
                  <Link
                    to={`/login${email ? `?email=${encodeURIComponent(email.trim().toLowerCase())}` : ''}`}
                    className="font-bold text-ember hover:underline"
                  >
                    Log in instead →
                  </Link>
                  <Link to="/forgot-password" className="text-gray-400 hover:text-white underline">
                    Forgot password?
                  </Link>
                </div>
              )}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Full Name (Optional)
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 w-5 h-5" />
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-obsidian-light border border-ember/20 text-white placeholder-gray-500 rounded-lg focus:ring-2 focus:ring-ember focus:border-ember transition-all"
                placeholder="John Doe"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Email Address *
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 w-5 h-5" />
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (emailExists || formError) {
                    setEmailExists(false);
                    setFormError(null);
                  }
                }}
                required
                className={`w-full pl-10 pr-4 py-3 bg-obsidian-light border text-white placeholder-gray-500 rounded-lg focus:ring-2 focus:ring-ember focus:border-ember transition-all ${
                  emailExists ? 'border-amber-500/60' : 'border-ember/20'
                }`}
                placeholder="you@outlook.com / you@gmail.com"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-300">
                Password *
              </label>
              <button
                type="button"
                onClick={generatePassword}
                className="flex items-center space-x-1 text-xs text-ember hover:text-ember-light font-semibold transition-colors"
              >
                <Key className="w-3.5 h-3.5" />
                <span>Generate Strong Password</span>
              </button>
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 w-5 h-5" />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full pl-10 pr-12 py-3 bg-obsidian-light border border-ember/20 text-white placeholder-gray-500 rounded-lg focus:ring-2 focus:ring-ember focus:border-ember transition-all"
                placeholder="Minimum 6 characters"
              />
              {/* Show/Hide Password Toggle */}
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 hover:opacity-70 transition-opacity"
                title={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <EyeOff className="w-5 h-5 text-gray-500" />
                ) : (
                  <Eye className="w-5 h-5 text-gray-500" />
                )}
              </button>
            </div>
            {/* Password strength meter */}
            {password && (
              <div className="mt-2">
                <div className="flex gap-1 mb-1">
                  {[1,2,3,4,5].map(i => (
                    <div key={i} className={`h-1 flex-1 rounded-full transition-all ${i <= strength.score ? strength.color : 'bg-gray-700'}`} />
                  ))}
                </div>
                <p className={`text-xs font-medium ${strength.score <= 1 ? 'text-red-400' : strength.score === 2 ? 'text-emerald-400' : strength.score === 3 ? 'text-yellow-400' : 'text-green-400'}`}>
                  {strength.label}
                </p>
              </div>
            )}
          </div>

          {/* Referral Code (Optional) */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Referral Code (Optional)
            </label>
            <div className="relative">
              <Gift className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 w-5 h-5" />
              <input
                type="text"
                value={referralCode}
                onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                className="w-full pl-10 pr-4 py-3 bg-obsidian-light border border-ember/20 text-white placeholder-gray-500 rounded-lg focus:ring-2 focus:ring-ember focus:border-ember transition-all"
                placeholder="ABCD1234"
              />
            </div>
            {referralCode && (
              <p className="text-xs text-gray-400 mt-1">Referral code applied.</p>
            )}
          </div>

          <TurnstileWidget onToken={setTurnstileToken} />

          <button
            type="submit"
            disabled={loading || (!!TURNSTILE_SITE_KEY && !turnstileToken)}
            className="w-full py-3 bg-ember text-black font-bold rounded-lg hover:bg-ember-light transition-all transform hover:scale-105 shadow-[0_0_20px_rgba(245,166,35,0.4)] hover:shadow-[0_0_30px_rgba(245,166,35,0.6)] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center space-x-2"
          >
            {loading ? (
              <span>Creating account...</span>
            ) : (
              <>
                <span>Sign Up</span>
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </form>

        <p className="text-center mt-6 text-gray-400">
          Already have an account?{' '}
          <Link to="/login" className="text-ember font-semibold hover:text-ember-light transition-colors">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
};

export default SignupPage;