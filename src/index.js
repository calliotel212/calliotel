import React from "react";
import ReactDOM from "react-dom/client";
import { HelmetProvider } from 'react-helmet-async';
import "./index.css";
import App from "./App";

// Ultra-safe error catching for mobile
window.onerror = function(msg, url, lineNo, columnNo, error) {
  console.error('Global error:', msg, url, lineNo, columnNo, error);
  return false;
};

window.addEventListener('unhandledrejection', function(event) {
  console.error('Unhandled promise rejection:', event.reason);
});

// ── Auto-reload on new deploy (version polling) ───────────────────────────
// Silently reloads the page when a new frontend build is detected.
// Works for all users automatically — no cache clearing required.
(function initVersionWatcher() {
  var _storedVersion = null;
  var _versionCheckFailed = false;

  function fetchVersion(callback) {
    fetch('/version.json?_=' + Date.now(), { cache: 'no-store' })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (data && data.version) callback(data.version);
      })
      .catch(function() { _versionCheckFailed = true; });
  }

  // Record the version the app was loaded with
  fetchVersion(function(v) { _storedVersion = v; });

  function checkVersion() {
    if (_versionCheckFailed) return;
    fetchVersion(function(v) {
      if (_storedVersion && v !== _storedVersion) {
        // New deploy detected — reload once
        window.location.reload(true);
      }
    });
  }

  // Check every 5 minutes
  setInterval(checkVersion, 5 * 60 * 1000);

  // Check when user returns to the tab (catches overnight or background cases)
  document.addEventListener('visibilitychange', function() {
    if (!document.hidden) checkVersion();
  });
})();

function clearSwAndReload() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(function(regs) {
      var unregPromises = regs.map(function(r) { return r.unregister(); });
      Promise.all(unregPromises).then(function() {
        if ('caches' in window) {
          caches.keys().then(function(names) {
            Promise.all(names.map(function(n) { return caches.delete(n); })).then(function() {
              window.location.reload(true);
            });
          });
        } else {
          window.location.reload(true);
        }
      });
    });
  } else {
    window.location.reload(true);
  }
}

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    const retryCount = parseInt(sessionStorage.getItem('eb_retry_count') || '0', 10);
    this.state = { hasError: false, error: null, errorInfo: null, retryCount };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('React Error Boundary caught:', error, errorInfo);
    this.setState({ error, errorInfo });

    const isChunkError =
      error.name === 'ChunkLoadError' ||
      (error.message && (
        error.message.includes('Loading chunk') ||
        error.message.includes('dynamically imported module') ||
        error.message.includes('Failed to fetch dynamically')
      ));

    const retryCount = parseInt(sessionStorage.getItem('eb_retry_count') || '0', 10);

    if (retryCount < 2) {
      const next = retryCount + 1;
      sessionStorage.setItem('eb_retry_count', String(next));
      if (isChunkError || next >= 1) {
        clearSwAndReload();
      } else {
        setTimeout(function() { window.location.reload(true); }, 1000);
      }
    }
  }

  render() {
    if (this.state.hasError) {
      const msg = (this.state.error && this.state.error.message) || 'Unknown error';
      return (
        <div style={{ 
          padding: '20px', 
          fontFamily: 'system-ui, -apple-system, sans-serif',
          maxWidth: '600px',
          margin: '40px auto',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '32px', marginBottom: '16px' }}>
            <div style={{ 
              width: '40px', height: '40px', border: '4px solid #F5A623', borderTopColor: 'transparent',
              borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px'
            }} />
          </div>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <h2 style={{ color: '#F5A623', fontSize: '18px', marginBottom: '8px' }}>
            {this.state.retryCount >= 2 ? 'Something went wrong' : 'Loading latest version...'}
          </h2>
          <p style={{ color: '#666', fontSize: '14px', marginBottom: '20px' }}>
            {this.state.retryCount >= 2
              ? msg
              : 'The page will reload automatically.'}
          </p>
          <button 
            onClick={() => { sessionStorage.removeItem('eb_retry_count'); clearSwAndReload(); }}
            style={{
              background: '#F5A623',
              color: 'white',
              padding: '12px 24px',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 'bold',
              cursor: 'pointer'
            }}
          >
            Reload Now
          </button>
        </div>
      );
    }

    sessionStorage.removeItem('eb_retry_count');
    return this.props.children;
  }
}

// Safe rendering with fallback
function renderApp() {
  try {
    const rootElement = document.getElementById("root");
    
    if (!rootElement) {
      document.body.innerHTML = `
        <div style="padding: 20px; text-align: center; font-family: system-ui;">
          <h1>Error: Root element not found</h1>
          <p>Please contact support.</p>
        </div>
      `;
      return;
    }

    const root = ReactDOM.createRoot(rootElement);
    
    root.render(
      <React.StrictMode>
        <ErrorBoundary>
          <HelmetProvider>
            <App />
          </HelmetProvider>
        </ErrorBoundary>
      </React.StrictMode>
    );
    
    console.log('✓ React app mounted successfully');
    
  } catch (error) {
    console.error('Fatal error rendering app:', error);
    
    // Last resort fallback UI
    const rootElement = document.getElementById("root");
    if (rootElement) {
      rootElement.innerHTML = `
        <div style="
          padding: 20px;
          font-family: system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
          max-width: 600px;
          margin: 40px auto;
          text-align: center;
        ">
          <div style="font-size: 48px; margin-bottom: 20px;">🚫</div>
          <h1 style="color: #e53e3e; font-size: 24px; margin-bottom: 16px;">
            Unable to load Calliotel
          </h1>
          <p style="margin-bottom: 20px; line-height: 1.6; color: #4a5568;">
            We're experiencing technical difficulties. This could be due to:
          </p>
          <ul style="
            text-align: left;
            margin: 0 auto 24px;
            max-width: 400px;
            line-height: 1.8;
            color: #4a5568;
          ">
            <li>Browser compatibility issues</li>
            <li>Network connectivity problems</li>
            <li>Temporary server issues</li>
          </ul>
          <button 
            onclick="window.location.reload()"
            style="
              background: linear-gradient(to right, #EA580C, #F97316);
              color: white;
              padding: 14px 32px;
              border: none;
              border-radius: 8px;
              font-size: 16px;
              font-weight: bold;
              cursor: pointer;
              box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            "
          >
            🔄 Reload Page
          </button>
          <p style="margin-top: 24px; font-size: 14px; color: #718096;">
            Error: ${error.message || 'Unknown error'}
          </p>
        </div>
      `;
    }
  }
}

// Wait for DOM to be ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', renderApp);
} else {
  renderApp();
}

// Prevent scroll restoration on page load
if ('scrollRestoration' in window.history) {
  window.history.scrollRestoration = 'manual';
}
