/**
 * Guru4pets — Native Google Sign-In bridge.
 * =========================================================================
 *
 * WHY THIS EXISTS
 * ---------------
 * The Guru4pets UI is loaded remotely from https://app.guru4pets.com (Base44)
 * inside a WKWebView. When the user taps "Continue with Google", Base44 tries
 * to open Google's OAuth page *inside* the WebView. Google rejects this with:
 *
 *     Error 403: disallowed_useragent
 *     "Acceso bloqueado: La solicitud de App no cumple con las políticas de Google"
 *
 * Google forbids OAuth inside embedded WebViews. The supported fix is to run
 * sign-in through the NATIVE Google SDK (this is what the
 * `@codetrix-studio/capacitor-google-auth` plugin does), obtain an `idToken`,
 * and hand that token to Supabase/Base44 so it can complete the session
 * WITHOUT ever loading Google's web page in the WebView.
 *
 * HOW IT WORKS
 * ------------
 *  1. On startup we initialize the GoogleAuth plugin (config comes from
 *     capacitor.config.ts -> plugins.GoogleAuth).
 *  2. We expose `window.nativeGoogleSignIn()` so the web app (or our own
 *     click interceptor below) can trigger the native flow and receive the
 *     Google `idToken`.
 *  3. `signInWithSupabase()` feeds that idToken to a Supabase client found on
 *     the page via `supabase.auth.signInWithIdToken({ provider: 'google' })`.
 *  4. A best-effort click interceptor (ENABLE_AUTO_INTERCEPT) detects the
 *     "Continue with Google" button and runs the native flow automatically.
 *
 * IMPORTANT: This file is loaded on the REMOTE page via a native WKUserScript
 * injected by MainViewController.swift (because server.url is remote, the local
 * www/index.html is not actually rendered). It is also referenced by
 * www/index.html for completeness / local testing.
 */
(function () {
  'use strict';

  var TAG = '[Guru4pets/GoogleAuth]';

  // Set to false if you prefer to call window.nativeGoogleSignIn() yourself
  // from the web app instead of auto-intercepting the Google button tap.
  var ENABLE_AUTO_INTERCEPT = true;

  // ----------------------------------------------------------------------
  // Plugin access helpers
  // ----------------------------------------------------------------------
  function getPlugin() {
    if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.GoogleAuth) {
      return window.Capacitor.Plugins.GoogleAuth;
    }
    return null;
  }

  function isNative() {
    return !!(window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function'
      ? window.Capacitor.isNativePlatform()
      : (window.Capacitor && window.Capacitor.isNative));
  }

  // ----------------------------------------------------------------------
  // Initialization
  // ----------------------------------------------------------------------
  var initialized = false;

  function initGoogleAuth() {
    if (initialized) return;
    var plugin = getPlugin();
    if (!plugin) {
      console.warn(TAG, 'GoogleAuth plugin not available yet.');
      return;
    }
    try {
      // On iOS the plugin reads iosClientId / clientId from capacitor.config.ts,
      // so initialize() can be called without arguments. Passing an empty object
      // is safe across plugin versions.
      if (typeof plugin.initialize === 'function') {
        plugin.initialize();
      }
      initialized = true;
      console.log(TAG, 'GoogleAuth initialized.');
    } catch (err) {
      console.error(TAG, 'initialize() failed:', err);
    }
  }

  // ----------------------------------------------------------------------
  // Public API: window.nativeGoogleSignIn()
  // Returns the Google auth payload: { idToken, accessToken, serverAuthCode, user }
  // ----------------------------------------------------------------------
  window.nativeGoogleSignIn = function nativeGoogleSignIn() {
    var plugin = getPlugin();
    if (!plugin) {
      return Promise.reject(new Error('GoogleAuth plugin not available (not running in native app?).'));
    }
    initGoogleAuth();
    return plugin.signIn().then(function (result) {
      // result shape (codetrix plugin):
      // { id, email, name, familyName, givenName, imageUrl,
      //   authentication: { accessToken, idToken, refreshToken } , serverAuthCode }
      var auth = result && result.authentication ? result.authentication : {};
      var payload = {
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
      console.log(TAG, 'Native sign-in success for', payload.user.email);
      return payload;
    });
  };

  // Optional helper: sign out of the native Google session.
  window.nativeGoogleSignOut = function nativeGoogleSignOut() {
    var plugin = getPlugin();
    if (!plugin) return Promise.resolve();
    return plugin.signOut();
  };

  // ----------------------------------------------------------------------
  // Complete the login with Supabase using the native idToken.
  // Looks for a Supabase client already created by the Base44 web app.
  // ----------------------------------------------------------------------
  function findSupabaseClient() {
    // Common places a Supabase client may be exposed on the page.
    var candidates = [
      window.supabase,
      window.supabaseClient,
      window._supabase,
      window.__supabase__
    ];
    for (var i = 0; i < candidates.length; i++) {
      var c = candidates[i];
      if (c && c.auth && typeof c.auth.signInWithIdToken === 'function') {
        return c;
      }
    }
    return null;
  }

  window.signInWithSupabase = function signInWithSupabase() {
    return window.nativeGoogleSignIn().then(function (payload) {
      var sb = findSupabaseClient();
      if (!sb) {
        // No Supabase client found on the page. Hand the token to the web app
        // via a DOM event so Base44 code can finish the login however it wants.
        console.warn(TAG, 'No Supabase client found on page; dispatching guru4pets:googleToken event.');
        window.dispatchEvent(new CustomEvent('guru4pets:googleToken', { detail: payload }));
        return payload;
      }
      return sb.auth.signInWithIdToken({
        provider: 'google',
        token: payload.idToken,
        access_token: payload.accessToken || undefined
      }).then(function (res) {
        if (res && res.error) {
          console.error(TAG, 'Supabase signInWithIdToken error:', res.error);
          throw res.error;
        }
        console.log(TAG, 'Supabase session established via native Google idToken.');
        // Reload so the web app picks up the new authenticated session.
        try { window.location.reload(); } catch (e) {}
        return res;
      });
    });
  };

  // ----------------------------------------------------------------------
  // Best-effort auto-interception of the "Continue with Google" button.
  // ----------------------------------------------------------------------
  function looksLikeGoogleButton(el) {
    if (!el) return false;
    var text = (el.innerText || el.textContent || '').toLowerCase();
    var aria = (el.getAttribute && (el.getAttribute('aria-label') || '') || '').toLowerCase();
    var hay = text + ' ' + aria;
    // Must mention google AND look like a sign-in/continue action.
    var mentionsGoogle = hay.indexOf('google') !== -1;
    var mentionsAuth = /sign|log|continu|acced|iniciar|entrar|conect/.test(hay);
    return mentionsGoogle && mentionsAuth;
  }

  function findClickableAncestor(node) {
    var depth = 0;
    while (node && depth < 5) {
      if (node.nodeType === 1) {
        var tag = node.tagName ? node.tagName.toLowerCase() : '';
        if (tag === 'button' || tag === 'a' || node.getAttribute('role') === 'button') {
          return node;
        }
      }
      node = node.parentNode;
      depth++;
    }
    return null;
  }

  function installInterceptor() {
    if (!ENABLE_AUTO_INTERCEPT) return;
    document.addEventListener('click', function (e) {
      try {
        var clickable = findClickableAncestor(e.target);
        if (!clickable || !looksLikeGoogleButton(clickable)) return;

        // Intercept: stop Base44 from opening Google OAuth in the WebView.
        e.preventDefault();
        e.stopPropagation();
        if (e.stopImmediatePropagation) e.stopImmediatePropagation();

        console.log(TAG, 'Intercepted Google button tap → running native sign-in.');
        window.signInWithSupabase().catch(function (err) {
          console.error(TAG, 'Native Google sign-in failed:', err);
          alert('No se pudo iniciar sesión con Google. Inténtalo de nuevo.');
        });
      } catch (err) {
        console.error(TAG, 'Interceptor error:', err);
      }
    }, true); // capture phase so we run before the web app's own handler
    console.log(TAG, 'Google button interceptor installed (capture).');
  }

  // ----------------------------------------------------------------------
  // Bootstrap
  // ----------------------------------------------------------------------
  function boot() {
    if (!isNative()) {
      // Running in a normal browser (not the native app) — let the web app
      // handle Google login the regular way.
      console.log(TAG, 'Not a native platform; native Google sign-in disabled.');
      return;
    }
    initGoogleAuth();
    installInterceptor();
  }

  document.addEventListener('deviceready', boot, false);
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(boot, 300);
  } else {
    window.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 300); });
    window.addEventListener('load', function () { setTimeout(boot, 800); });
  }
})();
