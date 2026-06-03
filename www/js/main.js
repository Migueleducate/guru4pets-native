/**
 * Guru4pets native shell — OneSignal initialization entry point.
 *
 * This file is the main JS entry point for the native Capacitor shell.
 * It is bundled into `www/js/main.js` (see `npm run build`) and runs inside
 * the WebView before the remote app at https://app.guru4pets.com takes over.
 *
 * It uses the `onesignal-cordova-plugin` (v5+, user-centric model) which is
 * Capacitor compatible. The plugin exposes the SDK on `window.plugins.OneSignal`
 * (and also on `window.OneSignal` in some builds) once `deviceready` fires.
 */

// Your OneSignal App ID (OneSignal Dashboard -> Settings -> Keys & IDs).
var ONESIGNAL_APP_ID = '57dcae77-28dc-457d-b3f5-75ed08d73cb5';

function getOneSignal() {
  // The cordova plugin attaches the SDK to one of these globals.
  if (window.plugins && window.plugins.OneSignal) {
    return window.plugins.OneSignal;
  }
  if (window.OneSignal) {
    return window.OneSignal;
  }
  return null;
}

function initOneSignal() {
  var OneSignal = getOneSignal();
  if (!OneSignal) {
    console.warn('[Guru4pets] OneSignal plugin not available yet.');
    return;
  }

  try {
    // Verbose logging is helpful during integration; lower it for production.
    if (OneSignal.Debug && typeof OneSignal.Debug.setLogLevel === 'function') {
      OneSignal.Debug.setLogLevel(6); // 6 = VERBOSE
    }

    // Initialize the SDK with the Guru4pets App ID.
    OneSignal.initialize(ONESIGNAL_APP_ID);

    // Prompt the user for push notification permission.
    // `true` shows the iOS system fallback settings prompt if needed.
    OneSignal.Notifications.requestPermission(true).then(function (accepted) {
      console.log('[Guru4pets] Push permission accepted:', accepted);
    });

    // Optional: react to notification clicks.
    OneSignal.Notifications.addEventListener('click', function (event) {
      console.log('[Guru4pets] Notification clicked:', JSON.stringify(event));
    });

    console.log('[Guru4pets] OneSignal initialized with App ID', ONESIGNAL_APP_ID);
  } catch (err) {
    console.error('[Guru4pets] OneSignal initialization failed:', err);
  }
}

// Cordova/Capacitor fire `deviceready` once native plugins are available.
document.addEventListener('deviceready', initOneSignal, false);

// Fallback: if `deviceready` already fired or is unavailable, try shortly after load.
window.addEventListener('load', function () {
  setTimeout(function () {
    if (getOneSignal()) {
      initOneSignal();
    }
  }, 1500);
});
