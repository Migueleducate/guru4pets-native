import UIKit
import WebKit
import Capacitor

/// Custom bridge view controller that keeps the entire OAuth login flow
/// (Google / Apple / Facebook / SSO, plus any `target="_blank"` / `window.open`
/// link) INSIDE the in-app WebView instead of kicking the user out to Safari.
///
/// Why this is needed:
/// Capacitor's stock `WebViewDelegationHandler.webView(_:createWebViewWith:…)`
/// ALWAYS calls `UIApplication.shared.open(url)` for any popup / `window.open`
/// / `target="_blank"` navigation. Some Base44 auth providers open the OAuth
/// screen this way, which would bounce the user to Safari and break the login
/// (the session cookie set in Safari never comes back to the WebView).
///
/// This subclass installs a custom `WKUIDelegate` that, for auth-related and
/// in-app domains, loads the request in the SAME WebView (returning `nil`),
/// keeping the whole flow self-contained. Truly external links (maps, phone
/// dialer, third-party sites, etc.) still open in the system browser as before.
class MainViewController: CAPBridgeViewController {

    private var inAppUIDelegate: InAppUIDelegate?

    override func capacitorDidLoad() {
        super.capacitorDidLoad()

        guard let webView = self.webView else { return }

        // Keep a reference to Capacitor's original handler so we can forward
        // the JavaScript alert/confirm/prompt callbacks to it unchanged.
        let originalDelegate = webView.uiDelegate
        let handler = InAppUIDelegate(forwardingTo: originalDelegate, webView: webView)
        self.inAppUIDelegate = handler
        webView.uiDelegate = handler

        // Inject the native Google Sign-In bridge into the REMOTE page.
        //
        // Because server.url points to https://app.guru4pets.com, the local
        // www/index.html is never rendered, so the <script> tag there does not
        // run. We instead inject www/js/google-auth.js (bundled into the app at
        // public/js/google-auth.js) as a WKUserScript so that
        // `window.nativeGoogleSignIn()` and the Google-button interceptor become
        // available on the remote Base44 page.
        injectGoogleAuthBridge(into: webView)
    }

    /// Reads the bundled google-auth.js and installs it as a document-start
    /// user script that runs on every navigation inside the WebView.
    private func injectGoogleAuthBridge(into webView: WKWebView) {
        // Capacitor copies www/ into the app bundle under "public/".
        let candidatePaths = [
            Bundle.main.path(forResource: "google-auth", ofType: "js", inDirectory: "public/js"),
            Bundle.main.path(forResource: "google-auth", ofType: "js", inDirectory: "public/js", forLocalization: nil)
        ].compactMap { $0 }

        var jsSource: String? = nil
        for path in candidatePaths {
            if let contents = try? String(contentsOfFile: path, encoding: .utf8) {
                jsSource = contents
                break
            }
        }

        guard let source = jsSource else {
            print("[Guru4pets] WARNING: google-auth.js not found in bundle; native Google sign-in bridge not injected.")
            return
        }

        let userScript = WKUserScript(source: source,
                                      injectionTime: .atDocumentStart,
                                      forMainFrameOnly: true)
        webView.configuration.userContentController.addUserScript(userScript)

        // The initial remote page may already be loading by the time this runs,
        // so also evaluate it once on the current document.
        webView.evaluateJavaScript(source) { _, error in
            if let error = error {
                print("[Guru4pets] google-auth.js eval error: \(error.localizedDescription)")
            } else {
                print("[Guru4pets] Native Google sign-in bridge injected.")
            }
        }
    }
}

/// A `WKUIDelegate` wrapper that intercepts new-window requests and forwards
/// everything else to Capacitor's original delegate.
private class InAppUIDelegate: NSObject, WKUIDelegate {

    /// Hosts that must remain inside the WebView (auth + app + storage).
    /// Matching is suffix-based so sub-domains are covered automatically.
    private let inAppHostSuffixes: [String] = [
        "guru4pets.com",
        "base44.com",
        "base44.app",
        "google.com",
        "googleapis.com",
        "gstatic.com",
        "googleusercontent.com",
        "youtube.com",
        "apple.com",
        "facebook.com",
        "fbcdn.net",
        "supabase.co",
        "supabase.in",
        "firebaseapp.com",
        "firebaseio.com",
        "firebase.com"
    ]

    private weak var originalDelegate: WKUIDelegate?
    private weak var mainWebView: WKWebView?

    init(forwardingTo originalDelegate: WKUIDelegate?, webView: WKWebView) {
        self.originalDelegate = originalDelegate
        self.mainWebView = webView
        super.init()
    }

    private func shouldKeepInApp(_ url: URL) -> Bool {
        guard let host = url.host?.lowercased() else { return false }
        return inAppHostSuffixes.contains { host == $0 || host.hasSuffix("." + $0) }
    }

    // MARK: - New window / window.open / target="_blank"

    func webView(_ webView: WKWebView,
                 createWebViewWith configuration: WKWebViewConfiguration,
                 for navigationAction: WKNavigationAction,
                 windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let url = navigationAction.request.url {
            if shouldKeepInApp(url) {
                // Load the popup/target=_blank request in the SAME WebView so
                // the OAuth flow stays in-app. Returning nil tells WebKit not
                // to create a separate web view.
                webView.load(navigationAction.request)
            } else {
                // Genuinely external link → open in the system browser.
                UIApplication.shared.open(url, options: [:], completionHandler: nil)
            }
        }
        return nil
    }

    // MARK: - Forward the JS dialog callbacks to Capacitor's handler

    func webView(_ webView: WKWebView,
                 runJavaScriptAlertPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo,
                 completionHandler: @escaping () -> Void) {
        if let original = originalDelegate,
           original.responds(to: #selector(WKUIDelegate.webView(_:runJavaScriptAlertPanelWithMessage:initiatedByFrame:completionHandler:))) {
            original.webView?(webView,
                              runJavaScriptAlertPanelWithMessage: message,
                              initiatedByFrame: frame,
                              completionHandler: completionHandler)
        } else {
            completionHandler()
        }
    }

    func webView(_ webView: WKWebView,
                 runJavaScriptConfirmPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo,
                 completionHandler: @escaping (Bool) -> Void) {
        if let original = originalDelegate,
           original.responds(to: #selector(WKUIDelegate.webView(_:runJavaScriptConfirmPanelWithMessage:initiatedByFrame:completionHandler:))) {
            original.webView?(webView,
                              runJavaScriptConfirmPanelWithMessage: message,
                              initiatedByFrame: frame,
                              completionHandler: completionHandler)
        } else {
            completionHandler(false)
        }
    }

    func webView(_ webView: WKWebView,
                 runJavaScriptTextInputPanelWithPrompt prompt: String,
                 defaultText: String?,
                 initiatedByFrame frame: WKFrameInfo,
                 completionHandler: @escaping (String?) -> Void) {
        if let original = originalDelegate,
           original.responds(to: #selector(WKUIDelegate.webView(_:runJavaScriptTextInputPanelWithPrompt:defaultText:initiatedByFrame:completionHandler:))) {
            original.webView?(webView,
                              runJavaScriptTextInputPanelWithPrompt: prompt,
                              defaultText: defaultText,
                              initiatedByFrame: frame,
                              completionHandler: completionHandler)
        } else {
            completionHandler(nil)
        }
    }
}
