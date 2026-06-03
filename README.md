# Guru4pets — App nativa iOS (Capacitor)

App nativa de iOS construida con **Capacitor 6** que envuelve la aplicación web remota
[`https://app.guru4pets.com`](https://app.guru4pets.com) y añade **notificaciones push con
OneSignal**. El build del `.ipa` firmado se hace en la nube con **GitHub Actions** (runner
`macos-latest`), de modo que **no necesitas un Mac** para generar la app.

| Dato | Valor |
|------|-------|
| Nombre de la app | Guru4pets |
| Bundle ID | `com.base687f9c98d3ac2e92d4ffa192.app` |
| URL remota | `https://app.guru4pets.com` |
| OneSignal App ID | `57dcae77-28dc-457d-b3f5-75ed08d73cb5` |
| Apple Team ID | `5XSLH8NRQ6` |
| APNs Key ID | `4UV58DP3F7` (ya configurada en OneSignal con el `.p8`) |

---

## Índice

1. [Estructura del proyecto](#1-estructura-del-proyecto)
2. [Requisitos previos (cuenta de Apple Developer)](#2-requisitos-previos-cuenta-de-apple-developer)
3. [Generar el CSR y el certificado `.p12` SIN un Mac (con OpenSSL)](#3-generar-el-csr-y-el-certificado-p12-sin-un-mac-con-openssl)
4. [Crear el perfil de aprovisionamiento (provisioning profile)](#4-crear-el-perfil-de-aprovisionamiento)
5. [Configurar los secretos de GitHub](#5-configurar-los-secretos-de-github)
6. [Lanzar el build en GitHub Actions](#6-lanzar-el-build-en-github-actions)
7. [Descargar el `.ipa` y subirlo a App Store Connect](#7-descargar-el-ipa-y-subirlo-a-app-store-connect)
8. [Desarrollo local (opcional)](#8-desarrollo-local-opcional)
9. [Solución de problemas](#9-solución-de-problemas)

---

## 1. Estructura del proyecto

```
guru4pets-native/
├── capacitor.config.ts          # Config de Capacitor (appId, server.url, etc.)
├── package.json                 # Dependencias y scripts npm
├── scripts/build.js             # Copia src/main.js -> www/js/main.js
├── src/main.js                  # Punto de entrada: inicializa OneSignal
├── www/                         # webDir (placeholder; la UI real es remota)
│   ├── index.html
│   └── js/main.js
├── ios/                         # Proyecto nativo de Xcode (generado por Capacitor)
│   └── App/
│       ├── App/Info.plist       # Incluye UIBackgroundModes: remote-notification
│       ├── App/App.entitlements # aps-environment = production (push)
│       └── App.xcodeproj
├── ExportOptions.plist          # Opciones de exportación para xcodebuild
├── .github/workflows/build-ios.yml  # Pipeline de build en macOS
└── README.md
```

> La UI completa se sirve desde `https://app.guru4pets.com` gracias a `server.url` en
> `capacitor.config.ts`. La carpeta `www/` solo contiene un placeholder porque Capacitor
> exige que el `webDir` exista y tenga al menos un archivo.

---

## 2. Requisitos previos (cuenta de Apple Developer)

Necesitas una **membresía activa del Apple Developer Program** (99 USD/año). Desde el
[portal de Apple Developer](https://developer.apple.com/account) deberás disponer de:

1. **App ID explícito** `com.base687f9c98d3ac2e92d4ffa192.app` con la capacidad
   **Push Notifications** activada.
   - Ve a *Certificates, Identifiers & Profiles → Identifiers*. Si la app ya existe en la
     App Store, el App ID ya estará creado; solo verifica que **Push Notifications** esté
     habilitado.
2. **Certificado de distribución de Apple** (lo generaremos en el paso 3).
3. **Perfil de aprovisionamiento de App Store** (lo generaremos en el paso 4).
4. **App Store Connect API Key** (opcional, solo si quieres automatizar la subida a
   TestFlight). Se crea en *App Store Connect → Users and Access → Integrations*.

> La clave APNs `.p8` (Key ID `4UV58DP3F7`) ya está cargada en OneSignal, así que las
> notificaciones push ya están conectadas del lado del servidor.

---

## 3. Generar el CSR y el certificado `.p12` SIN un Mac (con OpenSSL)

En Windows puedes usar **Git Bash**, **WSL**, o el binario de **OpenSSL para Windows**.
Abre una terminal con OpenSSL disponible y ejecuta:

### 3.1 Crear la clave privada y el CSR

```bash
# 1) Clave privada RSA de 2048 bits — ¡GUÁRDALA BIEN!
openssl genrsa -out guru4pets_ios_distribution.key 2048

# 2) Crear el CSR (Certificate Signing Request)
openssl req -new -key guru4pets_ios_distribution.key \
  -out guru4pets_ios_distribution.certSigningRequest \
  -subj "/emailAddress=TU_EMAIL@dominio.com/CN=Guru4pets iOS Distribution/C=US"
```

> ⚠️ **Importante:** si pierdes `guru4pets_ios_distribution.key`, el certificado que
> emita Apple quedará inservible y tendrás que revocarlo y volver a empezar.

### 3.2 Solicitar el certificado de distribución a Apple

1. Entra a <https://developer.apple.com/account> → *Certificates, Identifiers & Profiles
   → Certificates → +*.
2. Selecciona **Apple Distribution** (sirve para App Store y Ad-Hoc).
3. Sube el archivo `guru4pets_ios_distribution.certSigningRequest`.
4. Descarga el certificado resultante: `distribution.cer`.

### 3.3 Convertir `.cer` + clave privada en un `.p12`

```bash
# Apple entrega el .cer en formato DER. Conviértelo a PEM:
openssl x509 -inform DER -in distribution.cer -out distribution.pem

# Empaqueta certificado + clave privada en un .p12.
# Elige una contraseña fuerte: la usarás como secreto P12_PASSWORD.
openssl pkcs12 -export -legacy \
  -inkey guru4pets_ios_distribution.key \
  -in distribution.pem \
  -name "Apple Distribution: Guru4pets" \
  -out guru4pets_distribution.p12
```

> El flag `-legacy` es **imprescindible** con OpenSSL 3.x. Sin él, el runner de macOS
> puede fallar con `MAC verification failed` al importar el `.p12`.

### 3.4 Verificar el `.p12`

```bash
openssl pkcs12 -in guru4pets_distribution.p12 -info -nodes -legacy
```

Debes ver tanto un *Certificate bag* como un *Key bag*.

---

## 4. Crear el perfil de aprovisionamiento

1. En el portal de Apple Developer → *Profiles → + → Distribution → App Store*.
2. Selecciona el **App ID** `com.base687f9c98d3ac2e92d4ffa192.app`.
3. Selecciona el **certificado Apple Distribution** que creaste en el paso 3.
4. Dale un nombre claro, por ejemplo **`Guru4pets AppStore`**, y genera el perfil.
5. Descarga el archivo `.mobileprovision`.

> El perfil hereda automáticamente la capacidad de Push Notifications (`aps-environment =
> production`) porque el App ID la tiene habilitada. Por eso el App ID debe ser **explícito**
> y no comodín (wildcard).

> 📝 El nombre del perfil (`Guru4pets AppStore`) se detecta automáticamente en el
> workflow, así que no necesitas editarlo manualmente. Si lo usas para exportar de forma
> local con el `ExportOptions.plist`, asegúrate de que el nombre coincida exactamente.

---

## 5. Configurar los secretos de GitHub

Primero, codifica en **Base64** los archivos binarios. En **Windows PowerShell**:

```powershell
# Certificado .p12
[Convert]::ToBase64String([IO.File]::ReadAllBytes("guru4pets_distribution.p12")) | Set-Clipboard
# (pega el resultado en el secreto P12_BASE64)

# Perfil de aprovisionamiento
[Convert]::ToBase64String([IO.File]::ReadAllBytes("Guru4pets_AppStore.mobileprovision")) | Set-Clipboard
# (pega el resultado en el secreto PROVISIONING_PROFILE_BASE64)
```

En **Git Bash / WSL / Linux / macOS**:

```bash
base64 -w0 guru4pets_distribution.p12 > p12_base64.txt
base64 -w0 Guru4pets_AppStore.mobileprovision > profile_base64.txt
```

Luego ve a tu repositorio en GitHub → **Settings → Secrets and variables → Actions →
New repository secret** y crea estos **4 secretos**:

| Secreto | Contenido |
|---------|-----------|
| `P12_BASE64` | El `.p12` (certificado + clave) codificado en Base64. |
| `P12_PASSWORD` | La contraseña que elegiste al exportar el `.p12` (paso 3.3). |
| `PROVISIONING_PROFILE_BASE64` | El perfil `.mobileprovision` codificado en Base64. |
| `KEYCHAIN_PASSWORD` | Una cadena aleatoria cualquiera (no es de Apple). Sirve para crear un keychain temporal en el runner. |

> El **Team ID** (`5XSLH8NRQ6`) y el **Bundle ID** ya están escritos como variables `env`
> dentro del workflow, así que no hace falta ponerlos como secretos.

---

## 6. Lanzar el build en GitHub Actions

Sube este proyecto al repositorio
[`https://github.com/Migueleducate/guru-4-pets`](https://github.com/Migueleducate/guru-4-pets):

```bash
git remote add origin https://github.com/Migueleducate/guru-4-pets.git
git add .
git commit -m "Proyecto Capacitor iOS con OneSignal y build en GitHub Actions"
git push -u origin main
```

Tienes **dos formas** de disparar el build (definidas en `.github/workflows/build-ios.yml`):

- **Manual:** ve a la pestaña **Actions → Build iOS IPA → Run workflow**.
- **Por tag:** crea un tag que empiece con `v`:
  ```bash
  git tag v1.0.0
  git push origin v1.0.0
  ```

El workflow:
1. Instala dependencias (`npm ci`), genera `www/` (`npm run build`) y sincroniza Capacitor.
2. Ejecuta `pod install`.
3. Importa el certificado `.p12` en un keychain temporal.
4. Instala el perfil de aprovisionamiento.
5. Archiva con `xcodebuild` (firma manual con *Apple Distribution*).
6. Exporta el `.ipa` firmado (método `app-store`).
7. Sube el `.ipa` como **artifact** de la ejecución.

---

## 7. Descargar el `.ipa` y subirlo a App Store Connect

1. Cuando termine el workflow, abre la ejecución en la pestaña **Actions**.
2. En la sección **Artifacts** descarga **`Guru4pets-ipa`** (es un `.zip` que contiene el
   `.ipa`).
3. Sube el `.ipa` a **App Store Connect / TestFlight**. Como no tienes Mac, usa una de
   estas opciones:
   - **Transporter (recomendado, gratis):** instala
     [Apple Transporter](https://apps.apple.com/app/transporter/id1450874784) — *solo
     existe para macOS*. Si no tienes Mac, usa la opción siguiente.
   - **App Store Connect API + `altool` en el propio CI:** descomenta/añade un paso al
     workflow que use `xcrun altool --upload-app` con una **App Store Connect API Key**
     (`.p8`). Necesitarías los secretos `ASC_API_KEY_BASE64`, `ASC_KEY_ID` y
     `ASC_ISSUER_ID`. Con esto la subida a TestFlight se hace 100% en la nube, sin Mac.

> Si quieres, puedo añadir el paso de subida automática a TestFlight al workflow; solo
> dímelo y configuro los secretos de la App Store Connect API.

---

## 8. Desarrollo local (opcional)

```bash
npm install          # instala dependencias
npm run build        # regenera www/js/main.js
npx cap sync ios     # sincroniza el proyecto iOS
```

Para abrir el proyecto en Xcode (si algún día tienes acceso a un Mac):

```bash
npx cap open ios
```

---

## 9. Solución de problemas

| Problema | Solución |
|----------|----------|
| `MAC verification failed` al importar el `.p12` | Regenera el `.p12` con el flag `-legacy` (paso 3.3). |
| `APNS Delegate Never Fired` | Ya está mitigado: `handleApplicationNotifications: false` en `capacitor.config.ts`. |
| Las notificaciones no llegan en el simulador | APNs **no** funciona en simuladores; prueba en un dispositivo físico. |
| `No profiles for 'com.base...' were found` | Verifica que el `PROVISIONING_PROFILE_BASE64` corresponde al Bundle ID correcto y que el App ID tiene Push Notifications habilitado. |
| El build no se firma / `codesign` pide contraseña | El workflow ya ejecuta `security set-key-partition-list` para evitarlo; revisa que `KEYCHAIN_PASSWORD` esté definido. |
| App rechazada por *Guideline 4.2* | Una app que solo envuelve una web puede ser rechazada. Las push de OneSignal ayudan; considera añadir más funciones nativas (deep links, splash nativo, etc.). |

---

### Notas sobre OneSignal

OneSignal se inicializa en `src/main.js` usando el plugin `onesignal-cordova-plugin` (v5,
modelo *user-centric*). El App ID está fijado a `57dcae77-28dc-457d-b3f5-75ed08d73cb5`.
La app pide permiso de notificaciones al arrancar. Como la UI es remota, si quieres que la
web (`app.guru4pets.com`) controle OneSignal (etiquetas, eventos, login de usuario), puedes
exponer un puente JavaScript; pídemelo y lo añadimos.
