# OneSignal Push Notifications — Guru4Pets iOS

## Problema (causa raíz)

La app **no mostraba nunca el diálogo de permiso de notificaciones** de iOS
("¿Permitir notificaciones?") al instalarla desde TestFlight, porque OneSignal
**nunca se inicializaba**.

Motivo técnico:

1. La app carga su interfaz desde una **URL remota**
   (`server.url = https://app.guru4pets.com` en `capacitor.config.ts`).
2. Por eso el archivo local `www/index.html` **nunca se renderiza**, y el
   `src/main.js` —que llamaba a `OneSignal.initialize()` mediante el puente JS
   del plugin de Cordova— **nunca se ejecutaba**.
3. Además, el puente JS del plugin de OneSignal (`window.OneSignal`) **no se
   inyecta** en páginas remotas con Capacitor, así que aunque main.js se hubiera
   cargado en la página remota, `window.OneSignal` no existiría.

Resultado: OneSignal no arrancaba → no se pedía permiso → no llegaban pushes.

## Solución

Inicializar OneSignal de forma **NATIVA** en `ios/App/App/AppDelegate.swift`,
de manera independiente del WebView y del JavaScript.

El plugin `onesignal-cordova-plugin` ya incluye el framework nativo
`OneSignalXCFramework` (módulo `OneSignalFramework`), por lo que podemos usar el
SDK directamente desde Swift:

```swift
import OneSignalFramework
// ...
OneSignal.Debug.setLogLevel(.LL_VERBOSE)
OneSignal.initialize("57dcae77-28dc-457d-b3f5-75ed08d73cb5", withLaunchOptions: launchOptions)

DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) {
    OneSignal.Notifications.requestPermission({ accepted in
        NSLog("[Guru4pets] OneSignal push permission accepted = \(accepted)")
    }, fallbackToSettings: true)
}
```

Esto se ejecuta en **cada arranque**, sin depender del contenido del WebView.
El diálogo de permiso aparece ~2 segundos después de abrir la app.

> Nota: `src/main.js` queda como código muerto respecto a OneSignal (ya no es
> la vía de inicialización), pero se deja intacto para no romper otras partes.

## Requisitos ya presentes en el proyecto

- **App ID de OneSignal:** `57dcae77-28dc-457d-b3f5-75ed08d73cb5`
- **Capability Push Notifications** → `App.entitlements` con
  `aps-environment = production`.
- **Background Modes → Remote notifications** → `Info.plist` contiene
  `UIBackgroundModes = [remote-notification]`.
- **Pod:** `OneSignalXCFramework 5.5.2` (lo arrastra el plugin de Cordova).
- `use_frameworks!` está en el `Podfile`, así que `import OneSignalFramework`
  compila correctamente.

## Cómo probar (paso a paso)

1. En GitHub, vuelve a ejecutar el workflow **"Build iOS App"** (Actions) para
   generar un nuevo build firmado y subirlo a TestFlight.
2. Instala la nueva versión desde **TestFlight** en un iPhone real
   (los simuladores NO reciben push remoto).
3. Abre la app. A los ~2 segundos debe aparecer el diálogo nativo
   **"Guru4Pets" desea enviarte notificaciones**. Pulsa **Permitir**.
4. En el **panel de OneSignal** → *Audience → Subscriptions*, deberías ver tu
   dispositivo como suscrito (Subscribed) en pocos segundos.

## Enviar una notificación de prueba

1. Entra en https://dashboard.onesignal.com → tu app **Guru4Pets**.
2. **Messages → Push → New Push**.
3. Escribe título y mensaje, en *Audience* elige **Send to Subscribed Users**
   (o segmenta por tu dispositivo de prueba).
4. **Review → Send Message**. La notificación debe llegar al iPhone.

## Leer los logs de diagnóstico (depuración)

El código añade logs con el prefijo `[Guru4pets]`. Para verlos:

- **Console.app en un Mac** (Window → Devices, selecciona el iPhone) — filtra
  por `Guru4pets`. Verás:
  - `OneSignal.initialize called with appId=...`
  - `OneSignal current push permission = true/false`
  - `OneSignal push permission accepted = true/false`
  - `OneSignal pushSubscription changed: optedIn=... id=... token=...`
    (confirma que el dispositivo obtuvo el push token y se registró)

Si no tienes Mac, sube el nivel de log a producción cambiando
`.LL_VERBOSE` por `.LL_WARN` en `AppDelegate.swift` antes del release final.

## Archivos modificados

- `ios/App/App/AppDelegate.swift` — inicialización nativa de OneSignal +
  solicitud de permiso + observadores de diagnóstico.
