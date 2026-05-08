# 📦 Panda Proof — Guía de App Instalable

Esta guía explica cómo correr y empaquetar Panda Proof como **app instalable** para Android, iOS, Windows y macOS, manteniendo intacta la versión web.

---

## Arquitectura de la solución

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│   ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│   │  Web (PWA)   │  │  Mobile      │  │  Desktop                 │  │
│   │              │  │              │  │                          │  │
│   │  Netlify     │  │  Capacitor   │  │  Tauri                   │  │
│   │  HTTPS       │  │  Android+iOS │  │  Win .exe / .msi         │  │
│   │              │  │              │  │  macOS .dmg              │  │
│   └──────┬───────┘  └──────┬───────┘  └──────────┬───────────────┘  │
│          │                  │                    │                  │
│          └──────────────────┴────────────────────┘                  │
│                             │                                       │
│                             ▼                                       │
│                   ┌──────────────────┐                              │
│                   │  Backend Render  │  ← OpenAI, Anthropic, Canva  │
│                   │  panda-proof     │     (API keys SOLO acá)      │
│                   │  .onrender.com   │                              │
│                   └──────────────────┘                              │
│                             │                                       │
│                             ▼                                       │
│                   ┌──────────────────┐                              │
│                   │  Supabase        │  ← Auth + DB (analyses)      │
│                   └──────────────────┘                              │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**Punto clave:** las 4 plataformas (web, Android, iOS, desktop) son la **misma app web** envuelta en distintos shells. Todas hablan con el mismo backend Render. Las API keys nunca tocan el cliente.

---

## 1. Variables de entorno

Copia el ejemplo y rellena:

```bash
cp .env.example .env
```

**Backend (Render)** — secretas, jamás en el cliente:
- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`

**Frontend (Netlify + apps nativas)** — públicas, bakeadas en el bundle:
- `VITE_API_BASE` → URL del backend Render
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

⚠️ Antes de buildear cualquier app nativa, asegurate de que `.env` tenga las `VITE_*` correctas — quedarán compiladas en el bundle final.

---

## 2. Web (PWA) — ya funciona

```bash
npm run dev      # desarrollo (vite + server.js a la vez)
npm run build    # build de producción
npm run preview  # ver el build localmente
```

Producción: `https://stirring-speculoos-ca869c.netlify.app/` — instalable como PWA en iPhone Safari (Compartir → Añadir a Inicio) y en Chrome/Edge desktop.

---

## 3. Android (Capacitor)

### Requisitos

- **Android Studio** instalado: https://developer.android.com/studio
- JDK 17+ (Android Studio lo trae)
- SDK Platform 34+
- (Opcional) Un dispositivo físico con depuración USB activada

### Correr la app en un emulador o dispositivo

```bash
npm run android
```

Esto:
1. Hace `npm run build` (Vite → `dist/`)
2. Hace `npx cap sync` (copia `dist/` al folder `android/`)
3. Abre Android Studio con el proyecto

En Android Studio: **Run** → Selecciona dispositivo → ▶️

### Generar APK de prueba (firmado debug, para mandar por WhatsApp)

```bash
npm run cap:sync
cd android
.\gradlew.bat assembleDebug
```

APK queda en: `android/app/build/outputs/apk/debug/app-debug.apk`

### Generar AAB para Google Play Store (release, firmado)

```bash
npm run build:android:bundle
```

AAB queda en: `android/app/build/outputs/bundle/release/app-release.aab`

⚠️ **Antes de subir a Play Store** necesitás:
1. Crear un **keystore** para firmar la app:
   ```bash
   keytool -genkey -v -keystore panda-proof.keystore -alias pandaproof -keyalg RSA -keysize 2048 -validity 10000
   ```
2. Configurar `android/app/build.gradle` con la firma. Hay docs oficiales: https://capacitorjs.com/docs/android/deploying-to-google-play
3. Cuenta de Google Play Developer ($25 USD una sola vez): https://play.google.com/console

---

## 4. iOS (Capacitor)

### Requisitos (solo macOS)

- **macOS** (necesario, iOS no se puede buildear en Windows)
- **Xcode** 15+ desde la App Store
- **CocoaPods**: `sudo gem install cocoapods`
- Cuenta de **Apple Developer** ($99 USD/año) — solo para subir a App Store/TestFlight

### Primera vez en una Mac

Después de clonar el repo en macOS:
```bash
npm install
cd ios/App
pod install
cd ../..
```

### Abrir el proyecto en Xcode

```bash
npm run ios
```

Esto hace `npm run build`, `npx cap sync` y abre Xcode.

### Probar en un iPhone físico

1. En Xcode, elegí tu dispositivo (USB-C / Lightning)
2. **Signing & Capabilities** → seleccioná tu Team de Apple Developer
3. Run ▶️
4. En el iPhone, ve a **Configuración → General → Gestión de dispositivos** y autoriza el certificado

### Subir a TestFlight

1. **Product → Archive** en Xcode
2. **Distribute App → App Store Connect → Upload**
3. Esperar procesamiento (10-30 min)
4. En App Store Connect → TestFlight, agregar testers

### Subir a App Store

Mismo flujo que TestFlight pero crear una **release** en App Store Connect, agregar screenshots, descripción, y mandar a revisión (24-48h).

---

## 5. Desktop (Tauri)

### Requisitos

- **Rust toolchain** instalado: https://www.rust-lang.org/tools/install
  - En Windows: descargar `rustup-init.exe` y correrlo
  - Verificar: `rustc --version` y `cargo --version`
- **Windows**: WebView2 (viene preinstalado en Windows 10/11)
- **macOS**: Xcode Command Line Tools (`xcode-select --install`)

### Correr en modo desarrollo

```bash
npm run desktop
```

Esto levanta Vite + abre la app de escritorio con hot reload.

### Generar instaladores de producción

```bash
npm run desktop:build
```

Outputs (según el SO donde corras):

**Windows:**
- `src-tauri/target/release/bundle/msi/Panda Proof_0.1.0_x64_en-US.msi`
- `src-tauri/target/release/bundle/nsis/Panda Proof_0.1.0_x64-setup.exe`

**macOS** (solo se puede generar EN una Mac):
- `src-tauri/target/release/bundle/dmg/Panda Proof_0.1.0_x64.dmg`
- `src-tauri/target/release/bundle/macos/Panda Proof.app`

### Tamaño esperado

- Tauri instalador Windows: **~6-12 MB**
- Tauri instalador macOS: **~8-15 MB**
- (Comparado con Electron que sería ~150 MB+)

### (Opcional) Regenerar íconos de Tauri con calidad pro

```bash
npm run tauri:icon
```

Genera `icon.ico`, `icon.icns` y todos los PNGs desde `public/icon-512.png`.

---

## 6. Lista de scripts disponibles

| Comando | Qué hace |
|---|---|
| `npm run dev` | Web dev (vite + backend Express en paralelo) |
| `npm run build` | Build de Vite a `dist/` |
| `npm run preview` | Preview del build local |
| `npm run cap:sync` | Build + copiar `dist/` a Android/iOS |
| `npm run android` | Build + abrir en Android Studio |
| `npm run android:run` | Build + correr en dispositivo Android |
| `npm run ios` | Build + abrir en Xcode (solo Mac) |
| `npm run ios:run` | Build + correr en iPhone (solo Mac) |
| `npm run build:android` | APK debug |
| `npm run build:android:bundle` | AAB release (Play Store) |
| `npm run desktop` | Tauri dev |
| `npm run desktop:build` | Tauri build (instaladores) |
| `npm run build:desktop` | Alias de `desktop:build` |
| `npm run tauri:icon` | Regenera íconos desde `public/icon-512.png` |

---

## 7. Funcionalidades verificadas

Las siguientes funciones siguen trabajando idénticamente en las 4 plataformas:

- ✅ Subida de imagen (drag-drop en web/desktop, picker nativo en Android/iOS)
- ✅ Análisis de arte → backend Render → Claude Opus
- ✅ Panda Score 1-100
- ✅ Recomendaciones de mejora
- ✅ Regenerar arte con OpenAI gpt-image-1
- ✅ Editar en Canva (share sheet nativo en mobile, clipboard en desktop)
- ✅ Guardar análisis (Supabase con RLS)
- ✅ Login / Crear cuenta (Supabase Auth)
- ✅ Historial de análisis
- ✅ Navegación: Subir → Resultado → Historial
- ✅ Botones de "Volver al resultado" y "Nuevo análisis"

---

## 8. Seguridad

✅ **Lo que está bien:**
- API keys de OpenAI/Anthropic viven en Render (`process.env`), NUNCA en el cliente
- Frontend solo conoce `VITE_API_BASE` y la anon key pública de Supabase
- Supabase tiene RLS — la anon key sola no permite leer/escribir nada sin sesión válida
- HTTPS en producción para todo el tráfico

🛡️ **Reglas de oro al expandir:**
- Cualquier API paga (Canva Connect, Stripe, etc.) → el OAuth/Client Secret va en `server.js`
- El cliente solo recibe **tokens temporales** del backend, nunca claves
- Antes de hacer commit, revisar `.gitignore` — `.env` está protegido pero un `.env.production` mal nombrado se sube

---

## 9. Próximos pasos para publicar oficialmente

### Google Play Store
- [ ] Generar keystore de firma y guardarlo seguro
- [ ] Configurar `android/app/build.gradle` con la firma release
- [ ] Crear cuenta Play Developer ($25)
- [ ] Crear ficha de la app: screenshots (mínimo 2), ícono 512×512, banner 1024×500
- [ ] Política de privacidad pública (URL hosteada)
- [ ] Subir AAB inicial → revisión interna → producción

### Apple App Store
- [ ] Cuenta Apple Developer ($99/año)
- [ ] Crear App ID en developer.apple.com
- [ ] Crear app en App Store Connect
- [ ] Configurar firma con Team ID y Provisioning Profile en Xcode
- [ ] Screenshots para todos los tamaños obligatorios (6.7", 6.5", 5.5", iPad)
- [ ] Política de privacidad y "Privacy Manifest" (`PrivacyInfo.xcprivacy`)
- [ ] Archive → Upload → TestFlight → Producción

### Microsoft Store (opcional, Windows)
- [ ] Cuenta Microsoft Partner Center ($19 una vez)
- [ ] Convertir el `.msi` a `.msix` con MSIX Packaging Tool
- [ ] Subir a Partner Center

### Mac App Store (opcional)
- [ ] Apple Developer (mismo $99)
- [ ] Configurar entitlements y sandbox en Tauri
- [ ] Notarización con `xcrun notarytool`
- [ ] Subir vía Transporter

---

## 10. Troubleshooting

**`npx cap sync` falla con "TypeScript not found"** → Ya resuelto en este proyecto. Si vuelve a pasar: `npm install -D typescript`.

**Android Studio no encuentra el SDK** → Crear `android/local.properties` con: `sdk.dir=C:\\Users\\TU_USUARIO\\AppData\\Local\\Android\\Sdk`

**iOS: "No such module 'Capacitor'"** → `cd ios/App && pod install`

**Tauri: "rustc not found"** → Instalar Rust desde rust-lang.org. Cerrar y reabrir terminal.

**Tauri build muy lento la primera vez** → Normal. La primera compilación de Rust descarga y compila ~300 dependencias. Tarda 5-15 min. Las siguientes son segundos.

**Android dice "App not installed"** → Probablemente firmado con debug y release a la vez. Desinstalá la versión anterior antes de instalar el nuevo APK.

---

## 11. Mantenimiento

Cada vez que cambies código del frontend:

```bash
npm run cap:sync   # propaga los cambios a Android e iOS
```

Para versiones nuevas en stores, subir el `versionCode`/`versionName` en:
- Android: `android/app/build.gradle`
- iOS: en Xcode → General → Identity → Version & Build
- Desktop: `src-tauri/tauri.conf.json` → `version`
