import React, { Suspense, lazy, useState, useEffect } from 'react';
import { HelmetProvider } from 'react-helmet-async';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useSearchParams } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { Toaster } from './components/ui/sonner';
import { GoogleOAuthProvider } from '@react-oauth/google';
import ProtectedRoute from './components/ProtectedRoute';
import AuthCallback from './components/AuthCallback';
import TelegramMiniAppBoot from './components/TelegramMiniAppBoot';
import useVersionCheck from './hooks/useVersionCheck';
// Critical auth/landing routes — eager so a broken SW/chunk loader can't blank the site
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import AccountPage from './pages/AccountPage';
import OneOtpPage from './pages/OneOtpPage';
import './App.css';

const GOOGLE_CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID || '';

// Lazy-load non-critical global UI — keeps framer-motion + heavy deps out of initial bundle
const InstallPWA             = lazy(() => import('./components/InstallPWA'));
const PushNotificationBanner = lazy(() => import('./components/PushNotificationBanner'));
const SmsAlertWatcher        = lazy(() => import('./components/SmsAlertWatcher'));
const KeepAliveWatcher       = lazy(() => import('./components/KeepAliveWatcher'));
const AnnouncementBanner     = lazy(() => import('./components/AnnouncementBanner'));
const MobileAppBanner        = lazy(() => import('./components/MobileAppBanner'));

// ── Pages ─────────────────────────────────────────────────────────
const CampaignLandingPage          = lazy(() => import('./pages/CampaignLandingPage'));
const ForgotPasswordPage           = lazy(() => import('./pages/ForgotPasswordPage'));
const ResetPasswordPage            = lazy(() => import('./pages/ResetPasswordPage'));
const VerifyEmailPage              = lazy(() => import('./pages/VerifyEmailPage'));
const EmailVerificationSuccessPage = lazy(() => import('./pages/EmailVerificationSuccessPage'));
const OnboardingPage               = lazy(() => import('./pages/OnboardingPage'));
const FirstHourPage                = lazy(() => import('./pages/FirstHourPage'));

// ── Core Telecom ───────────────────────────────────────────────────
const DashboardPage                = lazy(() => import('./pages/DashboardPage'));
const BrowseNumbersPage            = lazy(() => import('./pages/BrowseNumbersPage'));
// CustomNumberRequestPage removed — only US/CA/GB/AU supported
const MyNumbersPage                = lazy(() => import('./pages/MyNumbersPage'));
const NumberDetailPage             = lazy(() => import('./pages/NumberDetailPage'));
const NumberPoolPage               = lazy(() => import('./pages/NumberPoolPage'));
const ESIMPage                     = lazy(() => import('./pages/ESIMPage'));
const MyESIMsPage                  = lazy(() => import('./pages/MyESIMsPage'));
const SMSPage                      = lazy(() => import('./pages/SMSPage'));
const ScheduledMessagesPage        = lazy(() => import('./pages/ScheduledMessagesPage'));
const CallHistoryPage                   = lazy(() => import('./pages/CallHistoryPage'));
const VoicemailPage                     = lazy(() => import('./pages/VoicemailPage'));
const RecordingsPage                    = lazy(() => import('./pages/RecordingsPage'));

// ── Wallet & Payments ──────────────────────────────────────────────
const WalletPage                   = lazy(() => import('./pages/WalletPage'));
const BuyCreditsPage               = lazy(() => import('./pages/BuyCreditsPage'));
const PaymentSuccessPage           = lazy(() => import('./pages/PaymentSuccessPage'));
const CardVerifySuccessPage        = lazy(() => import('./pages/CardVerifySuccessPage'));
const CardUnlockPage               = lazy(() => import('./pages/CardUnlockPage'));
const ProxyPage                    = lazy(() => import('./pages/ProxyPage'));
const TransferPage                 = lazy(() => import('./pages/TransferPage'));

// ── Account & Settings ─────────────────────────────────────────────
const ProfileSettingsPage          = lazy(() => import('./pages/ProfileSettingsPage'));
const NotificationsPage            = lazy(() => import('./pages/NotificationsPage'));
const NotificationSettingsPage     = lazy(() => import('./pages/NotificationSettingsPage'));

const PrivacySettingsPage          = lazy(() => import('./pages/PrivacySettingsPage'));
const ReferralsPage                = lazy(() => import('./pages/ReferralsPage'));
const ContactsPage                 = lazy(() => import('./pages/ContactsPage'));
const KeypadPage                   = lazy(() => import('./pages/KeypadPage'));
const SetupCallingPage             = lazy(() => import('./pages/SetupCallingPage'));

// ── Analytics & Tools ─────────────────────────────────────────────
const AnalyticsPage                = lazy(() => import('./pages/EnhancedAnalyticsPage'));

// ── Admin ─────────────────────────────────────────────────────────
const AdminDashboardPage           = lazy(() => import('./pages/AdminDashboardPage'));
const AdminDashboardV2             = lazy(() => import('./pages/AdminDashboardV2'));
const AdminResellersPage           = lazy(() => import('./pages/AdminResellersPage'));
const AdminApprovalsPage           = lazy(() => import('./pages/AdminApprovalsPage'));
const AdminTelegramBroadcast       = lazy(() => import('./pages/AdminTelegramBroadcast'));
const AdminWhatsAppBroadcast       = lazy(() => import('./pages/AdminWhatsAppBroadcast'));
const AdminCustomerLookup          = lazy(() => import('./pages/AdminCustomerLookup'));
const AdminVIPConcierge            = lazy(() => import('./pages/AdminVIPConcierge'));
const AdminProviderBalancesPage    = lazy(() => import('./pages/AdminProviderBalancesPage'));
const AdminResellerAPIPage         = lazy(() => import('./pages/AdminResellerAPIPage'));

// u2500u2500 SEO Country Pages u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500
const CountryVirtualNumberPage     = lazy(() => import('./pages/CountryVirtualNumberPage'));
// ── Public Info ───────────────────────────────────────────────────
const PricingPage                  = lazy(() => import('./pages/PricingPage'));
const GlobalPricingPage            = lazy(() => import('./pages/GlobalPricingPage'));
const PremiumNumbersPage           = lazy(() => import('./pages/PremiumNumbersPage'));
const ResellerProgramPage          = lazy(() => import('./pages/ResellerProgramPage'));
const ResellerAPIPage              = lazy(() => import('./pages/ResellerAPIPage'));
const ResellerDashboardPage        = lazy(() => import('./pages/ResellerDashboardPage'));
const DeveloperPage                = lazy(() => import('./pages/DeveloperPage'));
const DeveloperDashboardPage       = lazy(() => import('./pages/DeveloperDashboardPage'));
const CoveragePage                 = lazy(() => import('./pages/CoveragePage'));
const HelpPage                     = lazy(() => import('./pages/HelpPage'));
const SupportPage                  = lazy(() => import('./pages/SupportPage'));
const PrivacyPolicyPage            = lazy(() => import('./pages/PrivacyPolicyPage'));
const TermsOfServicePage           = lazy(() => import('./pages/TermsOfServicePage'));
const RefundPolicyPage             = lazy(() => import('./pages/RefundPolicyPage'));
const ComplianceTemplatesPage      = lazy(() => import('./pages/ComplianceTemplatesPage'));
const MaintenancePage              = lazy(() => import('./pages/MaintenancePage'));


// ── Google OAuth: only load gsi/client script on auth pages ───────
// GoogleOAuthProvider injects the 95 KiB gsi/client script when it mounts.
// Wrapping the entire app meant that script loaded on every page — dashboard,
// SMS inbox, wallet, etc. This boundary restricts it to /login and /signup only.
function GoogleAuthBoundary({ children }) {
  const { pathname } = useLocation();
  const needsGoogle = ['/login', '/signup'].some(p => pathname === p || pathname.startsWith(p + '/'));
  if (!needsGoogle) return <>{children}</>;
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID || 'missing-google-client-id'}>
      {children}
    </GoogleOAuthProvider>
  );
}

// ── Page loading fallback ──────────────────────────────────────────
const PageLoader = () => (
  <div style={{
    minHeight: '60vh', display: 'flex', alignItems: 'center',
    justifyContent: 'center', background: '#080810'
  }}>
    <div style={{
      width: 36, height: 36, borderRadius: '50%',
      border: '3px solid rgba(245,166,35,0.2)',
      borderTopColor: '#F5A623',
      animation: 'spin 0.7s linear infinite'
    }} />
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </div>
);

function PaymentRedirect() {
  const [searchParams] = useSearchParams();
  const method = searchParams.get('method');
  const tab = searchParams.get('tab') || (method === 'crypto' ? 'crypto' : null);
  const qs = tab ? `?tab=${encodeURIComponent(tab)}` : '';
  return <Navigate to={`/buy-credits${qs}`} replace />;
}

function DelayedChrome({ children }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const go = () => setReady(true);
    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(go, { timeout: 4000 });
      return () => window.cancelIdleCallback(id);
    }
    const t = window.setTimeout(go, 2500);
    return () => window.clearTimeout(t);
  }, []);
  if (!ready) return null;
  return children;
}

function App() {
  useVersionCheck();

  return (
    <HelmetProvider>
      <AuthProvider>
        <ThemeProvider>
          <BrowserRouter>
            <TelegramMiniAppBoot />
            <GoogleAuthBoundary>
            <DelayedChrome>
            <Suspense fallback={null}>
              <InstallPWA />
              <PushNotificationBanner />
              <SmsAlertWatcher />
              <KeepAliveWatcher />
              <AnnouncementBanner />
              <MobileAppBanner />
            </Suspense>
            </DelayedChrome>

            <Suspense fallback={<PageLoader />}>
              <Routes>

                {/* ── Landing ── */}
                <Route path="/" element={<LandingPage />} />
                <Route path="/go" element={<CampaignLandingPage />} />

                {/* ── Public Info ── */}
                <Route path="/pricing"               element={<PricingPage />} />
                <Route path="/global-pricing"        element={<GlobalPricingPage />} />
                <Route path="/premium-numbers"       element={<PremiumNumbersPage />} />
                <Route path="/reseller-program"      element={<ResellerProgramPage />} />
                <Route path="/reseller-api"          element={<ResellerAPIPage />} />
                <Route path="/reseller"              element={<ProtectedRoute><ResellerDashboardPage /></ProtectedRoute>} />
                <Route path="/developers"            element={<DeveloperPage />} />
                <Route path="/developer-api"         element={<ProtectedRoute requireVerification={false}><DeveloperDashboardPage /></ProtectedRoute>} />
                <Route path="/help"                  element={<HelpPage />} />
                <Route path="/support"               element={<ProtectedRoute requireVerification={false}><SupportPage /></ProtectedRoute>} />
                <Route path="/privacy"               element={<PrivacyPolicyPage />} />
                <Route path="/terms"                 element={<TermsOfServicePage />} />
                <Route path="/refund-policy"         element={<RefundPolicyPage />} />
                <Route path="/compliance-templates"  element={<ComplianceTemplatesPage />} />
                <Route path="/maintenance"           element={<MaintenancePage />} />
                <Route path="/coverage"              element={<ProtectedRoute requireVerification={false}><CoveragePage /></ProtectedRoute>} />

                {/* ── Auth ── */}
                <Route path="/signup"                element={<SignupPage />} />
                <Route path="/login"                 element={<LoginPage />} />
                <Route path="/forgot-password"       element={<ForgotPasswordPage />} />
                <Route path="/reset-password"        element={<ResetPasswordPage />} />
                <Route path="/auth/callback"         element={<AuthCallback />} />
                <Route path="/verify-email-pending"  element={<VerifyEmailPage />} />
                <Route path="/verify-email"          element={<EmailVerificationSuccessPage />} />
                <Route path="/onboarding"            element={<ProtectedRoute requireVerification={false}><OnboardingPage /></ProtectedRoute>} />
                <Route path="/first-hour"            element={<FirstHourPage />} />

                {/* ── Virtual Numbers ── */}
                <Route path="/virtual-number/:countrySlug"            element={<CountryVirtualNumberPage />} />
                <Route path="/numbers"                             element={<NumberPoolPage />} />

                {/* ── Browse & Buy Numbers (Telnyx) ── */}
                <Route path="/browse-numbers"        element={<BrowseNumbersPage />} />

                {/* ── eSIM Data Plans ── */}
                <Route path="/esim"      element={<ESIMPage />} />
                <Route path="/my-esims" element={<ProtectedRoute requireVerification={false}><MyESIMsPage /></ProtectedRoute>} />
                <Route path="/services"  element={<OneOtpPage />} />
                <Route path="/one-otp"   element={<OneOtpPage />} />
                <Route path="/proxy"     element={<ProxyPage />} />
                {/* Legacy routes removed — /sms-campaign, /number-lookup, /voice-forwarding */}

                {/* ── Protected: Core App ── */}
                <Route path="/dashboard"         element={<ProtectedRoute requireVerification={false}><DashboardPage /></ProtectedRoute>} />
                <Route path="/my-numbers"        element={<ProtectedRoute requireVerification={false}><MyNumbersPage /></ProtectedRoute>} />
                <Route path="/number-detail"    element={<ProtectedRoute requireVerification={false}><NumberDetailPage /></ProtectedRoute>} />
                <Route path="/sms"               element={<ProtectedRoute requireVerification={false}><SMSPage /></ProtectedRoute>} />
                <Route path="/call-history"      element={<ProtectedRoute requireVerification={false}><CallHistoryPage /></ProtectedRoute>} />
                <Route path="/voicemail"          element={<ProtectedRoute requireVerification={false}><VoicemailPage /></ProtectedRoute>} />
                <Route path="/recordings"         element={<ProtectedRoute requireVerification={false}><RecordingsPage /></ProtectedRoute>} />
                <Route path="/scheduled-messages" element={<ProtectedRoute requireVerification={false}><ScheduledMessagesPage /></ProtectedRoute>} />

                {/* ── Protected: Wallet & Payments ── */}
                <Route path="/wallet"            element={<ProtectedRoute requireVerification={false}><WalletPage /></ProtectedRoute>} />
                <Route path="/add-funds"         element={<PaymentRedirect />} />
                <Route path="/buy-credits"       element={<ProtectedRoute requireVerification={false}><BuyCreditsPage /></ProtectedRoute>} />
                <Route path="/payment"           element={<PaymentRedirect />} />
                <Route path="/payment-success"      element={<ProtectedRoute requireVerification={false}><PaymentSuccessPage /></ProtectedRoute>} />
                <Route path="/card-verify-success" element={<ProtectedRoute requireVerification={false}><CardVerifySuccessPage /></ProtectedRoute>} />
                <Route path="/card-unlock" element={<ProtectedRoute requireVerification={false}><CardUnlockPage /></ProtectedRoute>} />
                <Route path="/transfer"             element={<ProtectedRoute requireVerification={false}><TransferPage /></ProtectedRoute>} />

                {/* ── Protected: Account & Settings ── */}
                <Route path="/contacts"               element={<ProtectedRoute requireVerification={false}><ContactsPage /></ProtectedRoute>} />
                <Route path="/account"                element={<ProtectedRoute requireVerification={false}><AccountPage /></ProtectedRoute>} />
                <Route path="/profile/settings"       element={<ProtectedRoute requireVerification={false}><ProfileSettingsPage /></ProtectedRoute>} />
                <Route path="/keypad"                 element={<ProtectedRoute requireVerification={false}><KeypadPage /></ProtectedRoute>} />
                <Route path="/setup-calling"          element={<ProtectedRoute requireVerification={false}><SetupCallingPage /></ProtectedRoute>} />
                <Route path="/referrals"              element={<ProtectedRoute requireVerification={false}><ReferralsPage /></ProtectedRoute>} />
                <Route path="/notifications"          element={<ProtectedRoute requireVerification={false}><NotificationsPage /></ProtectedRoute>} />
                <Route path="/settings/notifications" element={<ProtectedRoute requireVerification={false}><NotificationSettingsPage /></ProtectedRoute>} />
                <Route path="/settings/sms"           element={<Navigate to="/sms" replace />} />
                <Route path="/settings/privacy"       element={<ProtectedRoute requireVerification={false}><PrivacySettingsPage /></ProtectedRoute>} />
                <Route path="/analytics"              element={<ProtectedRoute requireVerification={false}><AnalyticsPage /></ProtectedRoute>} />

                {/* ── Admin ── */}
                <Route path="/admin"                    element={<ProtectedRoute requireVerification={false}><AdminDashboardV2 /></ProtectedRoute>} />
                <Route path="/admin/legacy"             element={<ProtectedRoute requireVerification={false}><AdminDashboardPage /></ProtectedRoute>} />
                <Route path="/admin/resellers"          element={<ProtectedRoute requireVerification={false}><AdminResellersPage /></ProtectedRoute>} />
                <Route path="/admin/reseller-api"       element={<ProtectedRoute requireVerification={false}><AdminResellerAPIPage /></ProtectedRoute>} />
                <Route path="/admin/approvals"          element={<ProtectedRoute requireVerification={false}><AdminApprovalsPage /></ProtectedRoute>} />
                <Route path="/admin/telegram-broadcast" element={<ProtectedRoute requireVerification={false}><AdminTelegramBroadcast /></ProtectedRoute>} />
                <Route path="/admin/whatsapp-broadcast" element={<ProtectedRoute requireVerification={false}><AdminWhatsAppBroadcast /></ProtectedRoute>} />
                <Route path="/admin/customer-lookup"    element={<ProtectedRoute requireVerification={false}><AdminCustomerLookup /></ProtectedRoute>} />
                <Route path="/admin/provider-balances"  element={<ProtectedRoute requireVerification={false}><AdminProviderBalancesPage /></ProtectedRoute>} />
                <Route path="/admin/lookup"             element={<ProtectedRoute requireVerification={false}><AdminCustomerLookup /></ProtectedRoute>} />
                <Route path="/admin/vip"                element={<ProtectedRoute requireVerification={false}><AdminVIPConcierge /></ProtectedRoute>} />
                <Route path="/admin/concierge"          element={<ProtectedRoute requireVerification={false}><AdminVIPConcierge /></ProtectedRoute>} />

                <Route path="*" element={<Navigate to="/" replace />} />

              </Routes>
            </Suspense>

            <Toaster />
            </GoogleAuthBoundary>
          </BrowserRouter>
        </ThemeProvider>
      </AuthProvider>
    </HelmetProvider>
  );
}

export default App;
