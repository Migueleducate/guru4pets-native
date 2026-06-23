package com.base687f9c98d3ac2e92d4ffa192.app;

import android.os.Bundle;
import android.util.Log;

import com.getcapacitor.BridgeActivity;

import com.onesignal.OneSignal;
import com.onesignal.Continue;
import com.onesignal.debug.LogLevel;

/**
 * MainActivity — Capacitor bridge activity for Guru4pets.
 *
 * OneSignal is initialized NATIVELY here (not from JavaScript) for the exact
 * same reason as on iOS: the entire UI is served from the remote Base44 web app
 * (server.url = https://app.guru4pets.com), so the local www/js/main.js bridge
 * never executes and the Cordova OneSignal JS init never runs. Initializing in
 * onCreate guarantees the SDK starts and the Android 13+ notification
 * permission prompt is shown.
 */
public class MainActivity extends BridgeActivity {

    private static final String TAG = "Guru4pets";
    // Same OneSignal App ID used on iOS / in src/main.js.
    private static final String ONESIGNAL_APP_ID = "57dcae77-28dc-457d-b3f5-75ed08d73cb5";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Verbose logging while we validate push delivery. Lower to .NONE later.
        OneSignal.getDebug().setLogLevel(LogLevel.VERBOSE);

        // Initialize the OneSignal SDK with the app context.
        OneSignal.initWithContext(this, ONESIGNAL_APP_ID);

        // Prompt for the notification permission (Android 13+ requires the
        // runtime POST_NOTIFICATIONS prompt; older versions grant it implicitly).
        // fallbackToSettings is handled by passing `true` to requestPermission.
        OneSignal.getNotifications().requestPermission(true, Continue.none());

        Log.d(TAG, "OneSignal initialized natively with App ID " + ONESIGNAL_APP_ID);
    }
}
