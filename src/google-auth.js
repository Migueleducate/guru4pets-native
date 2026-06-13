/**
 * Guru4pets — Google login helper + on-screen debug overlay.
 * =========================================================================
 *
 * IMPORTANT CONTEXT (verified against the live app)
 * -------------------------------------------------
 * Base44 logs users in with ITS OWN Google OAuth client using a server-side
 * Authorization Code flow:
 *
 *   app.guru4pets.com/login
 *     -> accounts.google.com?client_id=185178814199-...&response_type=code
 *        &redirect_uri=https://app.base44.com/api/apps/auth/callback
 *     -> app.base44.com/api/apps/auth/callback   (Base44 establishes session)
 *     -> back to app.guru4pets.com               (session in localStorage/cookies)
 *
 * Because Base44 owns the OAuth client and exchanges an authorization CODE on
 * its backend, a NATIVE Google idToken (minted for OUR client 315627188018-…)
 * can NOT complete Base44 login. That is why the earlier "intercept the button
 * and call Supabase" approach left the user stuck on the login screen — there
 * is no Supabase client on the page and Base44 never receives a usable token.
 *
 * THE REAL FIX lives in the native layer:
 *   `ios.overrideUserAgent` (capacitor.config.ts) + `customUserAgent`
 *   (MainViewController.swift) make the WKWebView present a real mobile Safari
 *   User-Agent. Google then stops returning "Error 403: disallowed_useragent",
 *   so Base44's normal OAuth runs INSIDE the WebView and the session is stored
 *   in the WebView's own cookies/localStorage — exactly what Base44 expects.
 *
 * THIS FILE therefore:
 *   1. Does NOT hijack the Google button by default (ENABLE_AUTO_INTERCEPT=false).
 *   2. Provides an on-screen DEBUG OVERLAY so you can SEE, on the phone, what is
 *      happening (UA, platform, Base44 storage keys, each step of any native
 *      sign-in you trigger manually). Enable it by setting localStorage
 *      `g4p_debug = "1"`, adding `#g4pdebug` to the URL, or tapping the top-left
 *      corner of the screen 5 times quickly.
 *   3. Keeps `window.nativeGoogleSignIn()` available for manual diagnostics.
 *
 * This script is injected into the REMOTE page by MainViewController.swift.
 */
(function () {
  'use strict';

  var TAG = '[Guru4pets/GoogleAuth]';

  // The button interceptor is OFF: Base44's own OAuth (run in-WebView with the
  // Safari UA) is the correct path. Flip to true only for experiments.
  var ENABLE_AUTO_INTERCEPT = false;

  // ----------------------------------------------------------------------
  // Tiny logger that mirrors to console AND (optionally) an on-screen panel.
  // ----------------------------------------------------------------------
  var overlay = null;
  var logBuffer = [];

  function ts() {
    var d = new Date();
    return d.toTimeString().slice(0, 8) + '.' + String(d.getMilliseconds()).padStart(3, '0');
  }

  function log(msg, data) {
    var line = ts() + '  ' + msg + (data !== undefined ? '  ' + safeStringify(data) : '');
    logBuffer.push(line);
    if (logBuffer.length > 200) logBuffer.shift();
    try { console.log(TAG, msg, data !== undefined ? data : ''); } catch (e) {}
    renderOverlay();
  }

  function safeStringify(v) {
    try {
      if (typeof v === 'string') return v;
      return JSON.stringify(v);
    } catch (e) { return String(v); }
  }

  // ----------------------------------------------------------------------
  // Platform / plugin helpers
  // ----------------------------------------------------------------------
  function isNative() {
    return !!(window.Capacitor && (typeof window.Capacitor.isNativePlatform === 'function'
      ? window.Capacitor.isNativePlatform()
      : window.Capacitor.isNative));
  }

  function getPlugin() {
    if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.GoogleAuth) {
      return window.Capacitor.Plugins.GoogleAuth;
    }
    return null;
  }

  function base44StorageSnapshot() {
    var snap = {};
    try {
      Object.keys(localStorage).forEach(function (k) {
        if (/base44|auth|token|user|session/i.test(k)) {
          var val = localStorage.getItem(k);
          snap[k] = (val && val.length > 40) ? (val.slice(0, 37) + '…') : val;
        }
      });
    } catch (e) { snap._err = String(e); }
    return snap;
  }

  // ----------------------------------------------------------------------
  // Debug overlay UI
  // ----------------------------------------------------------------------
  function debugEnabled() {
    try {
      if (location.hash.indexOf('g4pdebug') !== -1) return true;
      if (localStorage.getItem('g4p_debug') === '1') return true;
    } catch (e) {}
    return false;
  }

  function buildOverlay() {
    if (overlay || !document.body) return;
    overlay = document.createElement('div');
    overlay.id = 'g4p-debug-overlay';
    overlay.style.cssText = [
      'position:fixed', 'left:0', 'right:0', 'bottom:0', 'z-index:2147483647',
      'max-height:45%', 'overflow:auto', 'background:rgba(0,0,0,0.88)',
      'color:#0f0', 'font:11px/1.35 monospace', 'padding:8px 8px 10px',
      'white-space:pre-wrap', 'word-break:break-word',
      'border-top:2px solid #0f0', '-webkit-overflow-scrolling:touch'
    ].join(';');

    var bar = document.createElement('div');
    bar.style.cssText = 'display:flex;gap:8px;margin-bottom:6px;position:sticky;top:0;background:rgba(0,0,0,0.95);padding-bottom:4px';
    bar.innerHTML =
      '<b style="color:#fff">Guru4pets DEBUG</b>' +
      '<button id="g4p-test" style="color:#000;background:#0f0;border:0;padding:2px 6px;border-radius:3px">Probar Google nativo</button>' +
      '<button id="g4p-snap" style="color:#000;background:#ff0;border:0;padding:2px 6px;border-radius:3px">Snapshot</button>' +
      '<button id="g4p-clear" style="color:#fff;background:#444;border:0;padding:2px 6px;border-radius:3px">Limpiar</button>' +
      '<button id="g4p-close" style="color:#fff;background:#a00;border:0;padding:2px 6px;border-radius:3px">X</button>';
    overlay.appendChild(bar);

    var pre = document.createElement('div');
    pre.id = 'g4p-debug-log';
    overlay.appendChild(pre);

    document.body.appendChild(overlay);

    bar.querySelector('#g4p-test').onclick = function () {
      log('[manual] nativeGoogleSignIn() solicitado…');
      window.nativeGoogleSignIn().then(function (p) {
        log('[manual] idToken recibido (NOTA: Base44 NO lo aceptará):', { email: p.user.email, idTokenLen: p.idToken ? p.idToken.length : 0 });
      }).catch(function (e) { log('[manual] ERROR:', String(e && e.message || e)); });
    };
    bar.querySelector('#g4p-snap').onclick = dumpDiagnostics;
    bar.querySelector('#g4p-clear').onclick = function () { logBuffer = []; renderOverlay(); };
    bar.querySelector('#g4p-close').onclick = function () {
      try { localStorage.setItem('g4p_debug', '0'); } catch (e) {}
      if (overlay) { overlay.remove(); overlay = null; }
    };
  }

  function renderOverlay() {
    if (!overlay) return;
    var pre = overlay.querySelector('#g4p-debug-log');
    if (pre) {
      pre.textContent = logBuffer.join('\n');
      overlay.scrollTop = overlay.scrollHeight;
    }
  }

  function dumpDiagnostics() {
    log('platform.isNative =', isNative());
    log('navigator.userAgent =', navigator.userAgent);
    log('GoogleAuth plugin =', !!getPlugin());
    log('location =', location.href);
    log('base44 storage =', base44StorageSnapshot());
    log('window globals (auth-ish) =',
      Object.keys(window).filter(function (k) { return /base44|supabase|auth|google|gsi|firebase/i.test(k); }));
  }

  // ----------------------------------------------------------------------
  // Public API (manual / fallback use only)
  // ----------------------------------------------------------------------
  window.nativeGoogleSignIn = function nativeGoogleSignIn() {
    var plugin = getPlugin();
    if (!plugin) return Promise.reject(new Error('GoogleAuth plugin not available'));
    try { if (typeof plugin.initialize === 'function') plugin.initialize(); } catch (e) {}
    return plugin.signIn().then(function (result) {
      var auth = (result && result.authentication) || {};
      return {
        idToken: auth.idToken || null,
        accessToken: auth.accessToken || null,
        serverAuthCode: result ? result.serverAuthCode : null,
        user: {
          id: result ? result.id : null,
          email: result ? result.email : null,
          name: result ? result.name : null,
          imageUrl: result ? result.imageUrl : null
        }
      };
    });
  };

  window.nativeGoogleSignOut = function () {
    var plugin = getPlugin();
    return plugin ? plugin.signOut() : Promise.resolve();
  };

  // Expose a manual debug toggle for support sessions.
  window.__g4pDebug = function (on) {
    try { localStorage.setItem('g4p_debug', on === false ? '0' : '1'); } catch (e) {}
    if (on === false) { if (overlay) { overlay.remove(); overlay = null; } }
    else { buildOverlay(); dumpDiagnostics(); }
  };

  // ----------------------------------------------------------------------
  // Optional auto-interceptor (disabled by default — see ENABLE_AUTO_INTERCEPT)
  // ----------------------------------------------------------------------
  function installInterceptor() {
    if (!ENABLE_AUTO_INTERCEPT) {
      log('Auto-interceptor DISABLED — Base44 OAuth runs in-WebView with Safari UA.');
      return;
    }
    document.addEventListener('click', function (e) {
      var t = e.target;
      var depth = 0, el = null;
      while (t && depth < 5) {
        if (t.nodeType === 1) {
          var tag = (t.tagName || '').toLowerCase();
          if (tag === 'button' || tag === 'a' || t.getAttribute('role') === 'button') { el = t; break; }
        }
        t = t.parentNode; depth++;
      }
      if (!el) return;
      var hay = ((el.innerText || '') + ' ' + (el.getAttribute('aria-label') || '')).toLowerCase();
      if (hay.indexOf('google') === -1 || !/sign|log|continu|acced|iniciar|entrar/.test(hay)) return;
      e.preventDefault(); e.stopPropagation();
      if (e.stopImmediatePropagation) e.stopImmediatePropagation();
      log('Intercepted Google button → native sign-in (experimental).');
      window.nativeGoogleSignIn()
        .then(function (p) { log('native idToken (won\'t complete Base44):', p.user.email); })
        .catch(function (err) { log('native sign-in error:', String(err)); });
    }, true);
  }

  // ----------------------------------------------------------------------
  // Tap top-left corner 5x to reveal the overlay even without the flag.
  // ----------------------------------------------------------------------
  function installGesture() {
    var taps = 0, timer = null;
    document.addEventListener('touchend', function (e) {
      var x = (e.changedTouches && e.changedTouches[0]) ? e.changedTouches[0].clientX : 999;
      var y = (e.changedTouches && e.changedTouches[0]) ? e.changedTouches[0].clientY : 999;
      if (x < 60 && y < 60) {
        taps++;
        clearTimeout(timer);
        timer = setTimeout(function () { taps = 0; }, 1200);
        if (taps >= 5) {
          taps = 0;
          try { localStorage.setItem('g4p_debug', '1'); } catch (er) {}
          buildOverlay(); dumpDiagnostics();
        }
      }
    }, true);
  }

  // ----------------------------------------------------------------------
  // Bootstrap
  // ----------------------------------------------------------------------
  function boot() {
    if (debugEnabled()) {
      buildOverlay();
      dumpDiagnostics();
    }
    installGesture();
    if (isNative()) {
      installInterceptor();
      log('Native shell ready. UA =', navigator.userAgent);
    } else {
      log('Not native platform; nothing to do.');
    }
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(boot, 300);
  } else {
    window.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 300); });
  }
  document.addEventListener('deviceready', boot, false);
})();
