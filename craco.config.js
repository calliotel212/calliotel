// craco.config.js
const path = require("path");
require("dotenv").config();

// Webpack plugin: converts render-blocking CSS links to preload pattern.
// Before: <link href="main.css" rel="stylesheet">  ← blocks first paint
// After:  <link rel="preload" href="main.css" as="style" onload="this.rel='stylesheet'">
//         <noscript><link rel="stylesheet" href="main.css"></noscript>
// Browser fetches CSS in parallel with HTML parse instead of blocking render.
class PreloadCSSPlugin {
  apply(compiler) {
    compiler.hooks.compilation.tap("PreloadCSSPlugin", (compilation) => {
      // HtmlWebpackPlugin v5 API
      const HtmlWebpackPlugin = compiler.options.plugins
        .flatMap((p) => (p.constructor && p.constructor.name === "HtmlWebpackPlugin" ? [p] : []))
        .find(Boolean);
      if (!HtmlWebpackPlugin || !HtmlWebpackPlugin.constructor.getHooks) return;
      HtmlWebpackPlugin.constructor.getHooks(compilation).beforeEmit.tapAsync(
        "PreloadCSSPlugin",
        (data, cb) => {
          data.html = data.html.replace(
            /<link href="([^"]+\.css[^"]*)" rel="stylesheet">/g,
            (_, href) =>
              `<link rel="preload" href="${href}" as="style" onload="this.onload=null;this.rel='stylesheet'">` +
              `<noscript><link rel="stylesheet" href="${href}"></noscript>`
          );
          cb(null, data);
        }
      );
    });
  }
}

// Check if we're in development/preview mode (not production build)
// Craco sets NODE_ENV=development for start, NODE_ENV=production for build
const isDevServer = process.env.NODE_ENV !== "production";

// Environment variable overrides
const config = {
  enableHealthCheck: process.env.ENABLE_HEALTH_CHECK === "true",
};

// Conditionally load health check modules only if enabled
let WebpackHealthPlugin;
let setupHealthEndpoints;
let healthPluginInstance;

if (config.enableHealthCheck) {
  WebpackHealthPlugin = require("./plugins/health-check/webpack-health-plugin");
  setupHealthEndpoints = require("./plugins/health-check/health-endpoints");
  healthPluginInstance = new WebpackHealthPlugin();
}

let webpackConfig = {
  eslint: {
    configure: {
      extends: ["plugin:react-hooks/recommended"],
      rules: {
        "react-hooks/rules-of-hooks": "error",
        "react-hooks/exhaustive-deps": "warn",
      },
    },
  },
  webpack: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
    configure: (webpackConfig) => {

      // Add ignored patterns to reduce watched directories
        webpackConfig.watchOptions = {
          ...webpackConfig.watchOptions,
          ignored: [
            '**/node_modules/**',
            '**/.git/**',
            '**/build/**',
            '**/dist/**',
            '**/coverage/**',
            '**/public/**',
        ],
      };

      // Add health check plugin to webpack if enabled
      if (config.enableHealthCheck && healthPluginInstance) {
        webpackConfig.plugins.push(healthPluginInstance);
      }

      // Production only: convert render-blocking CSS links to async preload
      if (process.env.NODE_ENV === "production") {
        webpackConfig.plugins.push(new PreloadCSSPlugin());
      }

      return webpackConfig;
    },
  },
};

webpackConfig.devServer = (devServerConfig) => {
  // Add health check endpoints if enabled
  if (config.enableHealthCheck && setupHealthEndpoints && healthPluginInstance) {
    const originalSetupMiddlewares = devServerConfig.setupMiddlewares;

    devServerConfig.setupMiddlewares = (middlewares, devServer) => {
      // Call original setup if exists
      if (originalSetupMiddlewares) {
        middlewares = originalSetupMiddlewares(middlewares, devServer);
      }

      // Setup health endpoints
      setupHealthEndpoints(devServer, healthPluginInstance);

      return middlewares;
    };
  }

  return devServerConfig;
};

// Wrap with visual edits (automatically adds babel plugin, dev server, and overlay in dev mode)
if (isDevServer) {
  try {
    const { withVisualEdits } = require("@emergentbase/visual-edits/craco");
    webpackConfig = withVisualEdits(webpackConfig);
  } catch (err) {
    if (err.code === 'MODULE_NOT_FOUND' && err.message.includes('@emergentbase/visual-edits/craco')) {
      console.warn(
        "[visual-edits] @emergentbase/visual-edits not installed — visual editing disabled."
      );
    } else {
      throw err;
    }
  }
}

module.exports = webpackConfig;
