# MuscleGrid Staff App — install & packaging

The app ships two ways: an installable **PWA** (works today) and a **Capacitor
Android** project (build an APK on a machine with the Android toolchain).

## Icons & splash
Source art: `resources/icon.png` (1024²) and `resources/splash[-dark].png`
(2732²), composed from the Stitch icon by `gen-assets.mjs`. Regenerate with:

```bash
node gen-assets.mjs                 # icons + splash + PWA icons (public/icons)
npx capacitor-assets generate --android   # -> android/.../res (icons + splash, all densities)
```

## PWA (installable now)
`public/manifest.webmanifest` + `public/sw.js` + meta in `index.html`. Served by
the CRM nginx at `/staff/` (manifest MIME set to `application/manifest+json`).

- **Android Chrome / iOS Safari:** open the CRM URL + `/staff/`, then
  "Add to Home Screen" — installs with the MG icon and opens standalone.
- ⚠️ The automatic install prompt + service worker need a **secure context
  (HTTPS)**. Over plain `http://<ip>:8080` you get manual add-to-home-screen
  only. Serve `/staff/` over HTTPS for full PWA installability.

## Android APK (Capacitor)
The `android/` project is generated (gitignored — recreate with
`npx cap add android`). Building an APK needs the Android toolchain, which is
**not installed on the CRM server**. On a machine with JDK 17 + Android Studio:

```bash
npm install
npm run build           # web build -> dist/
npx cap sync android    # copy web assets + plugins into android/
npx cap open android    # open in Android Studio  (or:)
cd android && ./gradlew assembleDebug   # -> app/build/outputs/apk/debug/app-debug.apk
```

`capacitor.config.ts`: appId `in.musclegrid.staff`, appName "MuscleGrid Staff",
webDir `dist`.

## Backend / write flag
`/api` is proxied to the CRM backend. Mutating actions are gated by
`VITE_WRITE_ACTIONS` (see `.env.example`) — read-only until set to `true`.
