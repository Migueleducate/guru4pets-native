import UIKit
import Capacitor
import OneSignalFramework

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    /// OneSignal App ID (OneSignal Dashboard -> Settings -> Keys & IDs).
    private let oneSignalAppId = "57dcae77-28dc-457d-b3f5-75ed08d73cb5"

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // =====================================================================
        // OneSignal — NATIVE initialization (the only reliable path here).
        // ---------------------------------------------------------------------
        // WHY NATIVE INSTEAD OF JS:
        //   This app loads its UI from a REMOTE url (server.url =
        //   https://app.guru4pets.com), so the local www/index.html — and the
        //   `js/main.js` that used to call OneSignal.initialize() — is never
        //   rendered. On top of that, the OneSignal Cordova plugin's JS bridge
        //   (window.OneSignal) is NOT injected into remote pages by Capacitor.
        //   Result: the old JS init never ran, so the iOS permission prompt
        //   never appeared.
        //
        //   The OneSignal Cordova plugin pulls in the native OneSignalXCFramework
        //   pod (module `OneSignalFramework`), so we initialize the SDK directly
        //   here in Swift. This runs on every launch regardless of the WebView
        //   contents and is OneSignal's recommended integration for iOS.
        // =====================================================================
        OneSignal.Debug.setLogLevel(.LL_VERBOSE) // lower to .LL_WARN for production
        OneSignal.initialize(oneSignalAppId, withLaunchOptions: launchOptions)
        NSLog("[Guru4pets] OneSignal.initialize called with appId=%@", oneSignalAppId)

        // Ask for push permission. We delay slightly so the prompt appears once
        // the first screen is visible (better UX and avoids racing app launch).
        // `fallbackToSettings: true` sends the user to iOS Settings if they
        // previously denied permission.
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) {
            let alreadyGranted = OneSignal.Notifications.permission
            NSLog("[Guru4pets] OneSignal current push permission = %@", alreadyGranted ? "true" : "false")
            OneSignal.Notifications.requestPermission({ accepted in
                NSLog("[Guru4pets] OneSignal push permission accepted = %@", accepted ? "true" : "false")
            }, fallbackToSettings: true)
        }

        // Log the subscription / push token so we can confirm registration in
        // device logs while testing from TestFlight.
        OneSignal.User.pushSubscription.addObserver(self)

        // Log when a notification is tapped.
        OneSignal.Notifications.addClickListener(self)

        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {
        // Sent when the application is about to move from active to inactive state. This can occur for certain types of temporary interruptions (such as an incoming phone call or SMS message) or when the user quits the application and it begins the transition to the background state.
        // Use this method to pause ongoing tasks, disable timers, and invalidate graphics rendering callbacks. Games should use this method to pause the game.
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // Use this method to release shared resources, save user data, invalidate timers, and store enough application state information to restore your application to its current state in case it is terminated later.
        // If your application supports background execution, this method is called instead of applicationWillTerminate: when the user quits.
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Called as part of the transition from the background to the active state; here you can undo many of the changes made on entering the background.
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        // Restart any tasks that were paused (or not yet started) while the application was inactive. If the application was previously in the background, optionally refresh the user interface.
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        // Called when the app was launched with a url. Feel free to add additional processing here,
        // but if you want the App API to support tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        // Called when the app was launched with an activity, including Universal Links.
        // Feel free to add additional processing here, but if you want the App API to support
        // tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }

}

// MARK: - OneSignal observers (debug/diagnostics)

extension AppDelegate: OSPushSubscriptionObserver {
    /// Fires whenever the push subscription changes (e.g. when the device
    /// finally gets a push token after the user accepts permission). Logging
    /// these values lets us confirm, from TestFlight device logs, that the
    /// device registered with OneSignal.
    func onPushSubscriptionDidChange(state: OSPushSubscriptionChangedState) {
        NSLog("[Guru4pets] OneSignal pushSubscription changed: optedIn=%@ id=%@ token=%@",
              state.current.optedIn ? "true" : "false",
              state.current.id ?? "(nil)",
              state.current.token ?? "(nil)")
    }
}

extension AppDelegate: OSNotificationClickListener {
    /// Fires when the user taps a delivered notification.
    func onClick(event: OSNotificationClickEvent) {
        NSLog("[Guru4pets] OneSignal notification clicked: %@", event.notification.notificationId ?? "(no id)")
    }
}
