import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import axios from 'axios';
import safeLocalStorage from '../utils/safeLocalStorage';

export const AuthContext = createContext(null);

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;
const USER_CACHE_KEY = 'calliotel_user_cache';

// ── Helpers ──────────────────────────────────────────────────────────────────
const getCachedUser = () => {
  try {
    const raw = safeLocalStorage.getItem(USER_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
};

const setCachedUser = (user) => {
  try {
    if (user) safeLocalStorage.setItem(USER_CACHE_KEY, JSON.stringify(user));
    else safeLocalStorage.removeItem(USER_CACHE_KEY);
  } catch {}
};

// ── Provider ──────────────────────────────────────────────────────────────────
export const AuthProvider = ({ children }) => {
  const storedToken = safeLocalStorage.getItem('token');
  const cachedUser  = getCachedUser();

  // If we have both a token AND a cached user, start already authenticated
  // so the app opens instantly without a loading flash or redirect to login.
  const [user,    setUser]    = useState(storedToken && cachedUser ? cachedUser : null);
  const [branding, setBranding] = useState(null);
  const [balance, setBalance] = useState(null);
  // Only show the spinner if there is NO cached user to fall back on.
  const [loading, setLoading] = useState(!(storedToken && cachedUser));
  const [token,   setToken]   = useState(storedToken);

  useEffect(() => {
    if (token) {
      verifyToken();
    } else {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    import('../utils/utmTracking').then(({ captureAttribution }) => {
      try { captureAttribution(); } catch {}
    }).catch(() => {});
  }, []);

  const logout = useCallback(() => {
    safeLocalStorage.removeItem('token');
    safeLocalStorage.removeItem('rememberToken');
    safeLocalStorage.removeItem('pendingNumberPurchase');
    safeLocalStorage.removeItem('auth_redirect');
    setCachedUser(null);
    setToken(null);
    setUser(null);
    setBranding(null);
    setBalance(null);
  }, []);

  // Silently subscribe to push if permission is already granted (user enabled it before)
  const autoRegisterPush = () => {
    try {
      if (!('Notification' in window) || Notification.permission !== 'granted') return;
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
      import('../utils/pushNotificationManager').then(({ default: pm }) => {
        pm.initialize().then(() => {
          pm.isSubscribed().then((already) => {
            if (!already) pm.subscribe().catch(() => {});
          });
        });
      }).catch(() => {});
    } catch {}
  };

  /**
   * Verify token with the server.
   * - If it succeeds  → update user + cache
   * - If 401          → token invalid/expired → logout
   * - Any other error → keep the cached user, don't logout
   *                     (server restart, offline, brief network hiccup)
   */
  const refreshBalance = async () => {
    try {
      const t = safeLocalStorage.getItem('token');
      if (!t) return;
      const r = await axios.get(`${API}/wallet/balance`, {
        headers: { Authorization: `Bearer ${t}` },
      });
      setBalance(r.data.balance ?? null);
    } catch {}
  };

  const verifyToken = async () => {
    const attemptVerify = async () => {
      const t = safeLocalStorage.getItem('token');
      if (!t) throw Object.assign(new Error('No token'), { noToken: true });
      const [meRes] = await Promise.all([
        axios.get(`${API}/auth/me`, { headers: { Authorization: `Bearer ${t}` } }),
        axios.get(`${API}/wallet/balance`, { headers: { Authorization: `Bearer ${t}` } })
          .then(r => setBalance(r.data.balance ?? null))
          .catch(() => {}),
      ]);
      return meRes.data;
    };

    try {
      const freshUser = await attemptVerify();
      setUser(freshUser);
      setCachedUser(freshUser);
      fetchBranding();
      autoRegisterPush();
    } catch (error) {
      if (error.noToken) { setLoading(false); return; }
      const status = error?.response?.status;
      if (status === 401) {
        // Wait 3 s and retry once — guards against transient server hiccups
        // that incorrectly return 401 (e.g. DB briefly unreachable on startup)
        await new Promise(r => setTimeout(r, 3000));
        try {
          const freshUser = await attemptVerify();
          setUser(freshUser);
          setCachedUser(freshUser);
          fetchBranding();
          autoRegisterPush();
        } catch (retryErr) {
          if (retryErr?.response?.status === 401) {
            // Confirmed invalid token — log out
            logout();
          } else {
            // Still a transient error — keep cached user, stay logged in
            console.warn('Session verify failed (transient). Keeping cached credentials.');
            if (getCachedUser()) fetchBranding();
          }
        }
      } else {
        // Network error, server restart, 5xx — keep cached user
        console.warn('Could not verify session (server unreachable?). Using cached credentials.');
        if (getCachedUser()) fetchBranding();
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchBranding = async () => {
    try {
      const t = safeLocalStorage.getItem('token');
      if (!t) return;
      const r = await axios.get(`${API}/reseller/branding/me`, {
        headers: { Authorization: `Bearer ${t}` },
      });
      setBranding(r.data || null);
    } catch {
      setBranding(null);
    }
  };

  const signup = async (email, password, fullName, birthday, referralCode = null, termsAccepted = false, turnstileToken = '') => {
    try {
      const payload = {
        email: (email || '').trim().toLowerCase(),
        password,
        full_name: fullName,
        terms_accepted: !!termsAccepted,
      };
      if (turnstileToken) payload.turnstile_token = turnstileToken;
      // Only send birthday when set — empty string previously caused API 422.
      if (birthday && String(birthday).trim()) payload.birthday = String(birthday).trim();
      if (referralCode) payload.referral_code = referralCode;
      try {
        const { getAttribution } = await import('../utils/utmTracking');
        const attribution = getAttribution();
        if (attribution && Object.keys(attribution).length > 0) Object.assign(payload, attribution);
      } catch {}

      const response = await axios.post(`${API}/auth/signup`, payload);
      const { access_token, user: userData } = response.data;
      safeLocalStorage.setItem('token', access_token);
      safeLocalStorage.removeItem('pwa-install-dismissed');
      safeLocalStorage.removeItem('pwa-install-dismissed-date');
      setCachedUser(userData);
      setToken(access_token);
      setUser(userData);
      return { success: true };
    } catch (error) {
      const detail = error.response?.data?.detail || 'Signup failed';
      const detailText = typeof detail === 'string' ? detail : 'Signup failed';
      const lower = detailText.toLowerCase();
      const emailExists =
        lower.includes('already registered') ||
        lower.includes('already exists') ||
        lower.includes('already have');
      if (emailExists) {
        return {
          success: false,
          code: 'email_exists',
          error: 'This email already has an account. Please log in instead.',
        };
      }
      return { success: false, error: detailText };
    }
  };

  const login = async (email, password, totpCode) => {
    try {
      const payload = {
        email: (email || '').trim().toLowerCase(),
        password,
      };
      if (totpCode && String(totpCode).trim()) {
        payload.totp_code = String(totpCode).trim();
      }
      const response = await axios.post(`${API}/auth/login`, payload);
      const { access_token, user: userData } = response.data;
      safeLocalStorage.setItem('token', access_token);
      setCachedUser(userData);
      setToken(access_token);
      setUser(userData);
      return { success: true };
    } catch (error) {
      const detail = error.response?.data?.detail || error.message || 'Login failed';
      return { success: false, error: typeof detail === 'string' ? detail : 'Login failed' };
    }
  };

  const googleLogin = async (tokens) => {
    try {
      const payload = {};
      if (typeof tokens === 'string') {
        payload.credential = tokens;
      } else if (tokens && typeof tokens === 'object') {
        if (tokens.credential)    payload.credential    = tokens.credential;
        if (tokens.access_token)  payload.access_token  = tokens.access_token;
      }
      try {
        const { getAttribution } = await import('../utils/utmTracking');
        const attribution = getAttribution();
        if (attribution && Object.keys(attribution).length > 0) Object.assign(payload, attribution);
      } catch {}

      const response = await axios.post(`${API}/auth/google`, payload);
      const { access_token, user: userData } = response.data;
      safeLocalStorage.setItem('token', access_token);
      setCachedUser(userData);
      setToken(access_token);
      setUser(userData);
      return { success: true, user: userData, isNewUser: response.data.is_new_user };
    } catch (error) {
      return { success: false, error: error.response?.data?.detail || error.message || 'Google sign-in failed' };
    }
  };

  const telegramLogin = async (telegramPayload) => {
    try {
      const payload = { ...telegramPayload };
      try {
        const { getAttribution } = await import('../utils/utmTracking');
        const attribution = getAttribution();
        if (attribution && Object.keys(attribution).length > 0) Object.assign(payload, attribution);
      } catch {}
      const response = await axios.post(`${API}/auth/telegram`, payload);
      const { access_token, user: userData } = response.data;
      safeLocalStorage.setItem('token', access_token);
      setCachedUser(userData);
      setToken(access_token);
      setUser(userData);
      return { success: true, user: userData, isNewUser: response.data.is_new_user };
    } catch (error) {
      return { success: false, error: error.response?.data?.detail || error.message || 'Telegram sign-in failed' };
    }
  };

  const telegramWebAppLogin = async (initData) => {
    try {
      const payload = { init_data: initData };
      try {
        const { getAttribution } = await import('../utils/utmTracking');
        const attribution = getAttribution();
        if (attribution && Object.keys(attribution).length > 0) Object.assign(payload, attribution);
      } catch {}
      const response = await axios.post(`${API}/auth/telegram-webapp`, payload);
      const { access_token, user: userData } = response.data;
      safeLocalStorage.setItem('token', access_token);
      setCachedUser(userData);
      setToken(access_token);
      setUser(userData);
      return { success: true, user: userData, isNewUser: response.data.is_new_user };
    } catch (error) {
      return { success: false, error: error.response?.data?.detail || error.message || 'Telegram Mini App sign-in failed' };
    }
  };

  const refreshUser = async () => {
    try {
      const t = safeLocalStorage.getItem('token');
      if (!t) return;
      const response = await axios.get(`${API}/auth/me`, { headers: { Authorization: `Bearer ${t}` } });
      setUser(response.data);
      setCachedUser(response.data);
    } catch (error) {
      console.error('Failed to refresh user:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, branding, loading, balance, refreshBalance, signup, login, googleLogin, telegramLogin, telegramWebAppLogin, logout, refreshUser, fetchBranding, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
