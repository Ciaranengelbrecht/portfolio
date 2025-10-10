# Android TWA Setup (LiftLog at /progress)

This guide packages the existing PWA at `https://ciaranengelbrecht.com/progress/` into an Android app using Trusted Web Activity (TWA).

## 1) Prerequisites checklist

- PWA installable (Lighthouse passes) and served over HTTPS
- Manifest
  - `start_url: /progress/dist/index.html`
  - `scope: /progress/dist/`
  - `display: standalone`
  - `icons`: 192/512 (+maskable)
- Service worker controls `/progress/dist/` (Vite PWA generates `dist/sw.js`)
- Digital Asset Links file hosted at origin root:
  - `https://ciaranengelbrecht.com/.well-known/assetlinks.json`
- Privacy policy URL:
  - `https://ciaranengelbrecht.com/progress/privacy.html`

## 2) Install Bubblewrap CLI

```bash
npm i -g @bubblewrap/cli
```

## 3) Initialize the TWA project

Use your live manifest URL:

```bash
bubblewrap init --manifest=https://ciaranengelbrecht.com/progress/manifest.webmanifest
```

During prompts:

- Application ID (package): use Play-compliant format, e.g. `com.ciaranengelbrecht.liftlog` (do not use `liftlog.app`)
- Host name: `ciaranengelbrecht.com`
- Launch URL: `https://ciaranengelbrecht.com/progress/`
- Enable notifications if desired (optional)

This will create an Android project folder locally (outside this repo).

## 4) Generate your signing key (if you don’t have one)

```bash
keytool -genkey -v -keystore keystore.jks -alias upload -keyalg RSA -keysize 2048 -validity 10000
```

Export SHA-256 for the Digital Asset Links (example shown uses your alias `upload`):

```bash
keytool -list -v -keystore keystore.jks -alias upload | grep SHA256:
```

## 5) Update assetlinks.json

Edit both files in this repo:

- `/.well-known/assetlinks.json`
- `/public/.well-known/assetlinks.json`

Replace placeholders with your package name and SHA-256 fingerprint.

For your app, set a Play-compliant package, e.g. `com.ciaranengelbrecht.liftlog`. We will also align `assetlinks.json` with the same package and your upload-key fingerprint:

```
A7:E8:18:9C:92:C9:1F:42:93:7A:43:F1:8A:4E:E0:4A:19:29:C4:58:2E:E1:26:0B:AD:E0:B7:A2:86:99:68:06
```

If you later enable Google Play App Signing, add the Play App Signing certificate fingerprint alongside your upload key fingerprint in the same array.

After deploy, verify:

```
https://ciaranengelbrecht.com/.well-known/assetlinks.json
```

returns your JSON.

## 6) Build the Android app bundle (AAB)

From the Bubblewrap Android project directory:

```bash
bubblewrap build
```

The output `.aab` lives under `./output/`. Upload this to Play Console.

## 7) Play Console steps

- Create an app (app name matches your listing)
- Package name must match the one used during `bubblewrap init`
- Upload the AAB to internal testing
- Set up testers & review warnings
- Provide Store listing assets
  - Screenshots (phone), feature graphic
  - Short & full description
  - Privacy policy URL: `https://ciaranengelbrecht.com/progress/privacy.html`
- Content rating questionnaire
- App category & contact details
- Submit for review (internal → open testing → production over time)

## 8) Link handling recommendations

- Keep in-app links within `/progress/` to stay in scope
- Open external links in browser: `target="_blank" rel="noopener"`

## 9) Common gotchas

- If TWA shows Chrome UI bar, scope/launch URL may be outside manifest scope
- `assetlinks.json` must be at the ROOT origin, not under `/progress`
- Fingerprint must match the `upload` (or signing) key used for your release
- Clear Chrome cache or uninstall debug app if testing updated asset links

## 10) Updating the app

- Update the web app and deploy
- If no Android project changes, no app update is required (web is served live)
- If you change package name or signing key, you must update asset links and re-release
