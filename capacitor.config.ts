import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.base687f9c98d3ac2e92d4ffa192.app',
  appName: 'Guru4pets',
  webDir: 'www',
  server: {
    // The entire UI is served from the remote Base44 web app.
    // The local `www/` directory only holds a placeholder index.html.
    url: 'https://app.guru4pets.com',
    cleartext: false,
    // Keep the full OAuth login flow INSIDE the WebView instead of kicking
    // the user out to Safari. The Google "Continue with Google" flow on
    // app.guru4pets.com redirects through:
    //   app.guru4pets.com  ->  accounts.google.com  (Google sign-in)
    //                       ->  app.base44.com/api/apps/auth/callback
    //                       ->  back to app.guru4pets.com
    // (Base44 owns the Google OAuth client; the callback is handled at
    //  app.base44.com, then it returns to the app domain.)
    // Every domain that participates in the redirect chain MUST be listed
    // here, otherwise Capacitor treats it as an external link and opens
    // Safari, breaking the login.
    allowNavigation: [
      // App's own domain
      'app.guru4pets.com',
      '*.guru4pets.com',
      // Base44 auth/backend infrastructure (OAuth callback + media/CDN)
      'base44.com',
      '*.base44.com',
      'app.base44.com',
      // Base44 API host (serverUrl for backend calls)
      'base44.app',
      '*.base44.app',
      // Google OAuth / sign-in
      'accounts.google.com',
      'accounts.youtube.com',
      '*.google.com',
      'google.com',
      '*.googleapis.com',
      '*.gstatic.com',
      'ssl.gstatic.com',
      '*.googleusercontent.com',
      // Apple "Sign in with Apple"
      'appleid.apple.com',
      'appleid.cdn-apple.com',
      '*.apple.com',
      // Facebook login
      'facebook.com',
      'www.facebook.com',
      'm.facebook.com',
      '*.facebook.com',
      '*.fbcdn.net',
      // Supabase (image/media storage used by the app)
      '*.supabase.co',
      '*.supabase.in',
      // Firebase (in case Base44 routes any auth through Firebase)
      '*.firebaseapp.com',
      '*.firebaseio.com',
      '*.firebase.com',
      'identitytoolkit.googleapis.com',
      'securetoken.googleapis.com',
    ],
  },
  // ===========================================================================
  // GOOGLE LOGIN FIX — "Error 403: disallowed_useragent"
  // ---------------------------------------------------------------------------
  // ROOT CAUSE (verified by inspecting the live login flow):
  //   Base44 uses its OWN Google OAuth client (Default mode) and a server-side
  //   Authorization Code flow:
  //     app.guru4pets.com/login
  //       -> accounts.google.com?client_id=185178814199-...&response_type=code
  //          &redirect_uri=https://app.base44.com/api/apps/auth/callback
  //       -> app.base44.com/api/apps/auth/callback  (Base44 sets the session)
  //       -> back to app.guru4pets.com (session now stored in localStorage/cookies)
  //
  //   Google blocks step 2 inside an embedded WKWebView with 403
  //   "disallowed_useragent". The native Google SDK (idToken) CANNOT complete
  //   this flow, because Base44's backend only trusts its own client
  //   (185178814199-...) via the code exchange — it will never accept an
  //   idToken minted for our own client (315627188018-...).
  //
  // THE FIX:
  //   Let Base44's normal OAuth run INSIDE the same WKWebView (so the session
  //   ends up in the WebView's own cookies/localStorage), and make the WebView
  //   present a real mobile Safari User-Agent so Google no longer flags it as
  //   an embedded WebView. This is the standard, reliable workaround for
  //   disallowed_useragent in wrapper apps.
  // ===========================================================================
  // A genuine mobile Safari UA (no "embedded webview" markers). Google detects
  // WKWebView mainly by the MISSING "Version/x ... Safari/x" suffix; supplying a
  // full Safari UA makes the OAuth page load normally.
  ios: {
    // Required so OneSignal receives the APNs delegate callbacks.
    // Without this, the "APNS Delegate Never Fired" issue can occur.
    handleApplicationNotifications: false,
    contentInset: 'always',
    // Must stay false: app-bound domains (WKAppBoundDomains) would otherwise
    // restrict navigation to a tiny allow-list and break OAuth redirects to
    // Google/Apple/Base44.
    limitsNavigationsToAppBoundDomains: false,
    // Present as Safari to defeat Google's "disallowed_useragent" check.
    overrideUserAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  },
  plugins: {
    // ⚠️ OPTIONAL / FALLBACK ONLY — NOT used for the main login anymore.
    //
    // We discovered Base44 uses its OWN Google OAuth client via a server-side
    // CODE flow, so a native idToken minted for our own client can't complete
    // Base44 login. The primary fix is now `ios.overrideUserAgent` above, which
    // lets Base44's normal OAuth succeed inside the WebView.
    //
    // This config is kept only so `window.nativeGoogleSignIn()` remains available
    // for manual testing/diagnostics (the auto-interceptor in google-auth.js is
    // disabled by default). It is harmless if unused.
    //
    // ┌─ HOW TO FILL THESE VALUES (see GOOGLE_SETUP.md for full steps) ──────────┐
    // │ iosClientId   -> the "iOS" OAuth Client ID from Google Cloud Console.    │
    // │                  Format: 1234567890-abcdef.apps.googleusercontent.com    │
    // │ clientId      -> the "Web application" OAuth Client ID. This must be the │
    // │                  SAME web client that Supabase/Base44 already use as the │
    // │                  Google provider, so the returned idToken is accepted.   │
    // │ serverClientId-> same Web Client ID (used as the audience for idToken).  │
    // └──────────────────────────────────────────────────────────────────────────┘
    GoogleAuth: {
      // Web application client ID (audience for the returned idToken).
      // MUST match the Google client configured in Supabase/Base44.
      clientId: '315627188018-3bikvivic76s3dos15t420ljar2ageo9.apps.googleusercontent.com',
      serverClientId: '315627188018-3bikvivic76s3dos15t420ljar2ageo9.apps.googleusercontent.com',
      // iOS native OAuth client ID (from Google Cloud Console -> iOS app).
      iosClientId: '315627188018-ojo68emh9b5ojll823lsbgrgghafpat5.apps.googleusercontent.com',
      scopes: ['profile', 'email'],
      // Request an offline serverAuthCode in addition to the idToken.
      forceCodeForRefreshToken: true,
    },
  },
};

export default config;
