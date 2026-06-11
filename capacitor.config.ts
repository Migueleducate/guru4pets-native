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
};

export default config;
