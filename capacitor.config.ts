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
    // Keep navigation to the app domain (and subdomains) inside the WebView
    // instead of kicking the user out to Safari.
    allowNavigation: ['app.guru4pets.com', '*.guru4pets.com'],
  },
  ios: {
    // Required so OneSignal receives the APNs delegate callbacks.
    // Without this, the "APNS Delegate Never Fired" issue can occur.
    handleApplicationNotifications: false,
    contentInset: 'always',
    limitsNavigationsToAppBoundDomains: false,
  },
};

export default config;
