# Guru4Pets — Configuración de Build Android

Esta guía describe todo lo necesario para compilar, firmar y publicar la app Android de Guru4Pets en Google Play.

- **Application ID:** `com.base687f9c98d3ac2e92d4ffa192.app`
- **OneSignal App ID:** `57dcae77-28dc-457d-b3f5-75ed08d73cb5`
- **versionCode / versionName:** definidos en `android/app/build.gradle` (inicial: `1` / `1.0`)

---

## 1. Compilación local (opcional)

Requisitos: Node 22, JDK 17, Android SDK (platform-android-34, build-tools 34.0.0).

```bash
npm ci
npx cap sync android
cd android
./gradlew bundleRelease   # genera el .aab
./gradlew assembleRelease # genera el .apk
```

Salida:
- AAB: `android/app/build/outputs/bundle/release/app-release.aab`
- APK: `android/app/build/outputs/apk/release/app-release.apk`

> La firma local requiere el archivo `android/key.properties` y el keystore `android/guru4pets-release.jks` (ambos están en `.gitignore` y **no** se suben al repositorio).

---

## 2. Keystore (firma de la app)

El keystore de release ya fue generado. Es **crítico** conservarlo: Google Play exige que todas las actualizaciones se firmen con la misma clave.

| Dato | Valor |
|------|-------|
| Archivo | `guru4pets-release.jks` |
| Alias | `guru4pets` |
| Contraseña store / key | `Guru4pets2024!` |
| Validez | hasta 2053-11-08 |
| SHA1 | `23:A9:C3:EC:21:0E:09:7C:41:A2:74:56:4A:F8:CE:99:2A:90:25:A6` |
| SHA256 | `F0:4B:2C:D0:55:DD:93:C7:8B:C3:6E:16:19:58:03:1A:17:EC:05:9D:D5:E2:49:8E:63:4A:16:74:4A:1D:C5:E7` |

> **Guarda una copia segura del archivo `.jks` y de su contraseña.** Si se pierde, no podrás volver a publicar actualizaciones de la app con la misma identidad (salvo que uses Play App Signing, ver más abajo).

---

## 3. Secrets de GitHub (para el workflow automático)

El workflow `.github/workflows/build-android.yml` compila el `.aab` en `ubuntu-latest`. Necesita estos **Repository Secrets** (Settings → Secrets and variables → Actions → New repository secret):

| Secret | Valor |
|--------|-------|
| `KEYSTORE_BASE64` | Contenido del keystore en base64 (ver abajo cómo obtenerlo) |
| `KEYSTORE_PASSWORD` | `Guru4pets2024!` |
| `KEY_ALIAS` | `guru4pets` |
| `KEY_PASSWORD` | `Guru4pets2024!` |

### Obtener `KEYSTORE_BASE64`

```bash
base64 -w0 guru4pets-release.jks
```

Copia toda la cadena resultante y pégala como valor del secret `KEYSTORE_BASE64`.

### Ejecutar el workflow

GitHub → pestaña **Actions** → **Build Android App** → **Run workflow**. Al terminar, descarga el artefacto `Guru4pets-Android-AAB` (y `Guru4pets-Android-APK` si lo necesitas).

---

## 4. Notificaciones push (OneSignal + Firebase FCM)

Android entrega push a través de **Firebase Cloud Messaging (FCM)**. OneSignal necesita las credenciales de tu proyecto Firebase.

1. Crea un proyecto en [Firebase Console](https://console.firebase.google.com/).
2. Agrega una app **Android** con el package `com.base687f9c98d3ac2e92d4ffa192.app`.
3. Descarga el archivo **`google-services.json`** y colócalo en `android/app/google-services.json`.
   - Está en `.gitignore`. Para el build en CI, súbelo como secret adicional o inclúyelo manualmente según prefieras.
   - El `build.gradle` ya aplica el plugin de Google Services automáticamente si el archivo existe.
4. En Firebase → **Project settings → Cloud Messaging**, habilita la **Firebase Cloud Messaging API (V1)** y genera/obtén la **Service Account JSON** (Cloud Messaging API V1) o la Server Key (legacy).
5. En el [Dashboard de OneSignal](https://dashboard.onesignal.com/) → tu app → **Settings → Push & In-App → Google Android (FCM)**:
   - Sube el **Service Account JSON** (método V1, recomendado).
6. Verifica que el OneSignal App ID en la app coincida: `57dcae77-28dc-457d-b3f5-75ed08d73cb5`.

> La inicialización de OneSignal se hace de forma **nativa** en `MainActivity.java` (porque la app carga una URL remota y el puente JS no se ejecuta), igual que en iOS. El permiso `POST_NOTIFICATIONS` (Android 13+) ya está declarado y se solicita al abrir la app.

---

## 5. Publicación en Google Play

1. Crea una cuenta de **[Google Play Console](https://play.google.com/console/)** (pago único de $25 USD).
2. Crea una nueva aplicación con el package `com.base687f9c98d3ac2e92d4ffa192.app`.
3. **Play App Signing:** Google recomienda que ellos gestionen la clave de firma de la app. Al subir tu primer `.aab` firmado con `guru4pets-release.jks`, Play lo aceptará como tu "upload key". Conserva igualmente el `.jks`.
4. Sube el `.aab` a un **track de pruebas internas** (Internal testing) primero.
5. Completa las fichas obligatorias: política de privacidad, clasificación de contenido, público objetivo, declaración de datos (Data safety), capturas de pantalla, ícono, descripción.
6. Envía a revisión. Una vez aprobado, promociona a producción.

---

## 6. Checklist rápido

- [ ] Subir los 4 secrets a GitHub (`KEYSTORE_BASE64`, `KEYSTORE_PASSWORD`, `KEY_ALIAS`, `KEY_PASSWORD`)
- [ ] Crear proyecto Firebase + `google-services.json` + subir credenciales FCM a OneSignal
- [ ] Ejecutar workflow **Build Android App** y descargar el `.aab`
- [ ] Crear cuenta Google Play Console ($25)
- [ ] Subir `.aab` a pruebas internas
- [ ] Completar fichas de la tienda y enviar a revisión
