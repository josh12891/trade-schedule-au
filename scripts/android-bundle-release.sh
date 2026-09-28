#!/usr/bin/env bash
# Sync Capacitor web assets and produce a Play-signed release AAB.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PROPS="$ROOT/android/keystore.properties"
JKS="$ROOT/android/upload-keystore.jks"
AAB="$ROOT/android/app/build/outputs/bundle/release/app-release.aab"

if [[ ! -f "$PROPS" ]]; then
  echo "Missing $PROPS — copy android/keystore.properties.example and fill passwords." >&2
  exit 1
fi
if [[ ! -f "$JKS" ]]; then
  echo "Missing $JKS — create the Play upload keystore first (npm run android:keystore)." >&2
  echo "Then upload that same keystore to Codemagic as trade-schedule-upload." >&2
  exit 1
fi

if [[ ! -f "$ROOT/android/local.properties" ]]; then
  SDK="${ANDROID_SDK_ROOT:-${ANDROID_HOME:-}}"
  if [[ -z "$SDK" ]]; then
    echo "Set ANDROID_HOME / ANDROID_SDK_ROOT or create android/local.properties with sdk.dir=..." >&2
    exit 1
  fi
  printf 'sdk.dir=%s\n' "$SDK" > "$ROOT/android/local.properties"
fi

npm run cap:sync

(
  cd "$ROOT/android"
  ./gradlew :app:bundleRelease --no-daemon
)

if [[ ! -f "$AAB" ]]; then
  echo "Expected AAB was not produced at $AAB" >&2
  exit 1
fi

python3 - "$AAB" <<'PY'
import sys, zipfile

aab = sys.argv[1]
app_id = b"com.josh12891.tradeschedule"
with zipfile.ZipFile(aab) as zf:
    raw = zf.read("base/manifest/AndroidManifest.xml")
if app_id not in raw:
    sys.exit("AAB binary manifest missing com.josh12891.tradeschedule")
print(f"OK: signed AAB {aab}")
print("OK: applicationId com.josh12891.tradeschedule")
PY
