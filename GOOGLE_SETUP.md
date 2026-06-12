# Configuración de Google Sign-In nativo (Guru4pets iOS)

Esta guía resuelve el error que aparece al iniciar sesión con Google desde la app de TestFlight:

> **Acceso bloqueado: La solicitud de App no cumple con las políticas de Google**
> **Error 403: `disallowed_useragent`**

Google **prohíbe** ejecutar su pantalla de OAuth dentro de un WebView embebido (que es lo que hace
Base44 dentro de la app de Capacitor). La solución soportada por Google es usar el **SDK nativo de
Google Sign-In**, obtener un `idToken`, y entregárselo a Supabase/Base44 para completar la sesión —
sin que la página de Google se cargue nunca dentro del WebView.

Ya dejamos todo el código implementado. **Solo te faltan 3 valores que debes obtener de Google Cloud
Console** y pegarlos en 2 archivos. Sigue los pasos.

---

## 🧩 Resumen de lo que ya está implementado

| Componente | Archivo | Estado |
|---|---|---|
| Plugin nativo | `@codetrix-studio/capacitor-google-auth@3.4.0-rc.4` en `package.json` | ✅ instalado |
| Configuración del plugin | `capacitor.config.ts` → `plugins.GoogleAuth` | ⚠️ faltan tus Client IDs |
| Puente JS | `src/google-auth.js` → `www/js/google-auth.js` | ✅ listo |
| Inyección en página remota | `ios/App/App/MainViewController.swift` | ✅ listo |
| URL scheme de retorno | `ios/App/App/Info.plist` → `CFBundleURLTypes` | ⚠️ falta el Reversed Client ID |

---

## 🔑 Paso 1 — Crear los OAuth Client IDs en Google Cloud Console

Ve a **https://console.cloud.google.com/apis/credentials** (selecciona el proyecto que usa Supabase/Base44
para el login con Google — debe ser el **mismo proyecto**, de lo contrario el `idToken` será rechazado).

### 1A. Client ID de tipo **iOS** (nuevo)

1. Clic en **+ CREAR CREDENCIALES → ID de cliente de OAuth**.
2. Tipo de aplicación: **iOS**.
3. **Bundle ID**: `com.base687f9c98d3ac2e92d4ffa192.app`
4. (Opcional) App Store ID y Team ID `5XSLH8NRQ6`.
5. Crear. Copia el **iOS Client ID**, con formato:
   ```
   123456789012-abcdefghijklmnop.apps.googleusercontent.com
   ```

### 1B. Client ID de tipo **Web application** (probablemente ya existe)

- Este es el que Supabase/Base44 ya usa como proveedor de Google.
- En Supabase lo ves en: **Authentication → Providers → Google → "Client ID (for OAuth)"**.
- Cópialo. Tiene el mismo formato `....apps.googleusercontent.com`.

> ⚠️ **Muy importante:** el `idToken` que devuelve el SDK nativo debe tener como *audience* el
> **Web Client ID** que Supabase/Base44 espera. Por eso configuramos `clientId` y `serverClientId`
> con el **Web Client ID**, NO con el iOS Client ID.

---

## 🔁 Paso 2 — Calcular el "Reversed Client ID" del iOS Client ID

Toma tu **iOS Client ID** del Paso 1A y dale la vuelta:

```
iOS Client ID:        123456789012-abcdefghijklmnop.apps.googleusercontent.com
Reversed Client ID:   com.googleusercontent.apps.123456789012-abcdefghijklmnop
```

Es decir: quita `.apps.googleusercontent.com`, y antepón `com.googleusercontent.apps.`.

---

## ✏️ Paso 3 — Pegar los valores en el proyecto

### 3A. `capacitor.config.ts`

Reemplaza los marcadores dentro de `plugins.GoogleAuth`:

```ts
GoogleAuth: {
  clientId: 'TU_WEB_CLIENT_ID.apps.googleusercontent.com',        // ← Web Client ID (Paso 1B)
  serverClientId: 'TU_WEB_CLIENT_ID.apps.googleusercontent.com',  // ← el MISMO Web Client ID
  iosClientId: 'TU_IOS_CLIENT_ID.apps.googleusercontent.com',     // ← iOS Client ID (Paso 1A)
  scopes: ['profile', 'email'],
  forceCodeForRefreshToken: true,
},
```

- `YOUR_WEB_CLIENT_ID_HERE` → tu **Web Client ID** (en 2 lugares: `clientId` y `serverClientId`).
- `YOUR_IOS_CLIENT_ID_HERE` → tu **iOS Client ID**.

### 3B. `ios/App/App/Info.plist`

Busca el bloque `CFBundleURLTypes` y reemplaza el marcador por tu **Reversed Client ID** (Paso 2):

```xml
<key>CFBundleURLTypes</key>
<array>
    <dict>
        <key>CFBundleURLSchemes</key>
        <array>
            <string>com.googleusercontent.apps.123456789012-abcdefghijklmnop</string>
        </array>
    </dict>
</array>
```

> Pega el Reversed Client ID **completo**, incluyendo el prefijo `com.googleusercontent.apps.`.

---

## 🚀 Paso 4 — Reconstruir y subir a TestFlight

Después de pegar los valores, ejecuta localmente (o deja que GitHub Actions lo haga):

```bash
npm run sync     # build + npx cap sync ios  (regenera config y assets en el proyecto iOS)
```

Luego haz **commit + push** y crea un tag `v*` (o lanza el workflow manual) para que GitHub Actions
compile y suba el nuevo build a TestFlight, igual que antes.

> El workflow ya ejecuta `npm ci` + `cap sync` + `pod install`, así que el plugin nativo de Google
> y su pod (`CodetrixStudioCapacitorGoogleAuth`) se compilan automáticamente.

---

## 🧠 Cómo funciona el flujo (referencia técnica)

1. La UI remota (Base44) se carga dentro del WebView.
2. `MainViewController.swift` inyecta `www/js/google-auth.js` en la página remota como *user script*
   (porque al usar `server.url` remoto, el `index.html` local no se renderiza).
3. El script:
   - Inicializa el plugin `GoogleAuth`.
   - Expone **`window.nativeGoogleSignIn()`** → devuelve `{ idToken, accessToken, serverAuthCode, user }`.
   - Expone **`window.signInWithSupabase()`** → llama al nativo y luego a
     `supabase.auth.signInWithIdToken({ provider: 'google', token: idToken })` si encuentra un cliente
     Supabase en la página.
   - Instala un **interceptor** (en fase de captura) que detecta el botón "Continuar con Google" y
     dispara el flujo nativo automáticamente, evitando el error 403.
4. El usuario ve la hoja nativa de Google (sin error 403), elige su cuenta, y la sesión se completa.

### Si el interceptor automático no detecta el botón

El interceptor busca botones cuyo texto mencione "Google" + una acción (sign/continuar/iniciar…).
Si el botón de tu UI es distinto, tienes 2 opciones:

- **Opción A (recomendada):** que el equipo de la web app llame directamente a
  `window.signInWithSupabase()` (o `window.nativeGoogleSignIn()`) en el `onClick` del botón cuando
  detecte que corre dentro de la app nativa (`window.Capacitor?.isNativePlatform()`).
- **Opción B:** si no hay un cliente Supabase global en la página, el script dispara el evento
  `guru4pets:googleToken` con el `idToken` en `event.detail`. La web app puede escucharlo:
  ```js
  window.addEventListener('guru4pets:googleToken', (e) => {
    const { idToken } = e.detail;
    // completar login con tu propio cliente Supabase/Base44
  });
  ```

Para desactivar la interceptación automática, pon `ENABLE_AUTO_INTERCEPT = false` en
`src/google-auth.js` y vuelve a ejecutar `npm run sync`.

---

## ✅ Checklist final

- [ ] Creé el **iOS Client ID** en Google Cloud Console con el Bundle ID correcto.
- [ ] Tengo el **Web Client ID** que usa Supabase/Base44.
- [ ] Pegué ambos en `capacitor.config.ts` (Web en `clientId`/`serverClientId`, iOS en `iosClientId`).
- [ ] Pegué el **Reversed Client ID** en `Info.plist` → `CFBundleURLTypes`.
- [ ] Ejecuté `npm run sync`, hice commit/push y disparé el build.
- [ ] Probé en TestFlight: el botón de Google ya no muestra el error 403.
