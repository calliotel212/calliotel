/**
 * True when the page is running inside the Calliotel iOS App Store shell
 * (React Native WebView). Used to hide Google/Telegram login so Apple 4.8
 * does not apply. Website, Android, and iPhone Safari keep social login.
 */
export default function isIosAppShell() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false;
  }
  if (window.__CALLIOTEL_IOS_APP__ === true) {
    return true;
  }
  const ua = navigator.userAgent || '';
  if (/CalliotelApp/i.test(ua)) {
    return true;
  }
  const ios = /iPhone|iPad|iPod/i.test(ua);
  if (!ios) {
    return false;
  }
  const safari = /Safari\//.test(ua);
  const otherBrowser = /CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua);
  // WKWebView (Expo / RN) has AppleWebKit + Mobile, but no Safari/ token.
  return !safari && !otherBrowser;
}
