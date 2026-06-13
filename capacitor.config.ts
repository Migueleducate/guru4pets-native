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
  ios: {
    // Required so OneSignal receives the APNs delegate callbacks.
    // Without this, the "APNS Delegate Never Fired" issue can occur.
    handleApplicationNotifications: false,
    contentInset: 'always',
    // Must stay false: app-bound domains (WKAppBoundDomains) would otherwise
    // restrict navigation to a tiny allow-list and break OAuth redirects to
    // Google/Apple/Base44.
    limitsNavigationsToAppBoundDomains: false,
  },
  plugins: {
    // Native Google Sign-In (resolves Google "Error 403: disallowed_useragent",
    // which Google returns when OAuth runs inside an embedded WebView).
    //
    // Instead of letting Google's OAuth page load inside the WebView (blocked),
    // we trigger the native Google Sign-In SDK via this plugin and hand the
    // resulting idToken back to the web app so Supabase/Base44 can complete login.
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
