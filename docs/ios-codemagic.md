# iOS on Codemagic

Trade Schedule ships as a Capacitor app. The `ios-app-store` workflow in `codemagic.yaml` builds a signed IPA on a Codemagic Mac mini and can upload it to TestFlight.

## Before the first iOS build

1. In App Store Connect, create the app with bundle id `com.josh12891.tradeschedule` and name **Trade Schedule**. That app does not exist yet.
2. Copy the numeric Apple ID from App Store Connect → App Information into a Codemagic Application variable named `APP_STORE_APPLE_ID`. The yaml does not hard-code an id.
3. Team integrations → Developer Portal already uses **tradies-toolbox-asc** (same Apple team as Tradies Toolbox and AU Roof Carpenter). The yaml references that key. Do not commit the `.p8`.
4. `PUBLISH_TESTFLIGHT` defaults to `true`. Set it to `false` on the Application if you only want the IPA artifact.

## Android

The `android-play` workflow is manual. It signs with the Codemagic Android keystore named **trade-schedule-upload**.

Play has not accepted an AAB for this package yet. Create the upload key once (`npm run android:keystore`), store the `.jks` and passwords, and upload that file in Codemagic as `trade-schedule-upload` before starting the workflow. Do not generate a second key after the first Play upload.
