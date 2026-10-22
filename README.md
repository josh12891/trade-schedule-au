# Trade Schedule

Offline job schedule board for Australian tradies. Drag tasks across the dates, reorder the list, and download a PDF. The board is the Grok Trade Schedule UI, wrapped as a Capacitor app. No login, no cloud database, no ads.

| | |
| --- | --- |
| Display name | Trade Schedule |
| Seller / publisher | Australian Dynamics (Australia) |
| Support email | australiancomsnetwork@gmail.com |
| Package / app ID | `com.josh12891.tradeschedule` |
| Store version | Marketing **1.0.0**. Android `versionCode` **1**. iOS `CFBundleShortVersionString` **1.0.0**, `CFBundleVersion` **1** (Codemagic replaces the iOS build number from the latest TestFlight build once `APP_STORE_APPLE_ID` is set). |
| Privacy policy | `public/privacy.html`, copied to `docs/privacy.html` on build. Enable GitHub Pages on `docs/` for **https://josh12891.github.io/trade-schedule-au/privacy.html** |
| Theme | Navy `#0B1F33` and orange `#F5A623` on the header, icon, and splash. Task bars keep their own trade colours. |

Public surfaces use **Australian Dynamics** and **australiancomsnetwork@gmail.com** only.

Sister apps, listed on the About screen: **Tradies Toolbox** and **AU Roof Carpenter**. Store links stay as “Search the App Store / Play Store” until those listings have live URLs.

## What is on device

The schedule lives in `localStorage` under the key `yardline-v1` (same store as the original board). Creating, editing, dragging, and reordering tasks does not call a server. The PDF is built in the browser. On Android and iOS the WebView opens the system share sheet so the file can be saved; in a desktop browser it downloads directly.

There is no account and no in-app purchase.

## Requirements

- Node.js 20+ (Codemagic uses Node 22)
- Android Studio for local Play builds, with JDK 21 (Capacitor 7)
- Xcode 16+ on macOS for local App Store builds, or Codemagic — [docs/ios-codemagic.md](docs/ios-codemagic.md)

## Scripts

```bash
npm install
npm run dev            # Vite SPA at http://localhost:5173
npm run build          # copy privacy into docs/, typecheck, production dist/
npm run cap:sync       # build web assets and copy into android/ + ios/
npm run cap:android    # sync then open Android Studio
npm run cap:ios        # sync then open Xcode (macOS)
npm run assets         # redraw the navy/orange icon and run capacitor-assets
npm run android:keystore   # one-time Play upload key (before the first AAB)
npm run android:bundle     # cap sync + signed Play AAB (needs the keystore)
```

## Capacitor

```bash
npm ci
npm run build
npx cap sync
```

`webDir` is `dist`. App id is `com.josh12891.tradeschedule`. Platforms `android/` and `ios/` are committed the same way as AU Roof Carpenter.

## Codemagic / Play / ASC

Two workflows in `codemagic.yaml`:

| Workflow | What it does | Still manual |
| --- | --- | --- |
| `ios-app-store` | Signed IPA. `PUBLISH_TESTFLIGHT` is `true`. Uses Team integration **tradies-toolbox-asc**. | Create the App Store Connect app for `com.josh12891.tradeschedule`, then set Application variable `APP_STORE_APPLE_ID` to the numeric Apple ID. The yaml leaves that id empty on purpose. |
| `android-play` | Signed AAB. Manual trigger. Java 21, Node 22. Package `com.josh12891.tradeschedule`. | Upload the first Play upload keystore to Codemagic as code-signing identity **trade-schedule-upload**. Play has not accepted an AAB for this package yet, so that first key is the upload key. |

Do not commit `.p8`, `.p12`, `.jks`, or passwords.

Local keystore helper:

```bash
npm run android:keystore
# writes android/upload-keystore.jks, android/keystore.properties, and UPLOAD_KEYSTORE.md
# those three files are gitignored
```

Then upload `android/upload-keystore.jks` in the Codemagic UI under the name `trade-schedule-upload`, with the alias and passwords from `UPLOAD_KEYSTORE.md`.

## Layout

```
src/components/schedule-app.tsx   board UI
src/lib/schedule.ts               tasks, trades, localStorage
src/lib/schedule-pdf.ts           hand-rolled PDF (no jsPDF)
src/lib/save-schedule.ts          browser download, or share sheet on device
src/pages/AboutPage.tsx           publisher, support, sister apps
public/privacy.html               store listing policy
android/  ios/                    Capacitor 7 shells
codemagic.yaml
```

The stylesheet keeps every board token the UI actually uses (canvas, paper, ink, muted, line, hazard stripe, weekend hatch, today column). Ink and the highlight were retinted to navy and orange so the header matches the rest of the Australian Dynamics apps. Trade-bar colours stay in `PALETTE`.
