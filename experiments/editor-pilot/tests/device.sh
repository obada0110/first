#!/usr/bin/env bash
set -euo pipefail
L=$(cd "$(dirname "$0")/.." && pwd);P=${PILOT_DIR:?};W="$P/max-motion";R="$L/proof/records";export NODE_PATH="$RUNNER_TEMP/pilot-node/node_modules"
python "$L/tests/serve.py" "$W" "$R" >"$R/device-http.log" 2>&1 & SERVER=$!;trap 'kill "$SERVER"' EXIT
adb reverse tcp:8974 tcp:8974;pkg=lab.maxeditor.hostpilot
cd "$W/mobile";flutter test --no-pub integration_test/pilot_test.dart -d "${ANDROID_SERIAL:-emulator-5554}" --reporter expanded |tee "$R/flutter.log"
adb exec-out run-as "$pkg" cat files/pilot-v2.json >"$R/android-file.json"
adb shell am start -W -n "$pkg/io.github.obada0110.maxeditor.PilotView";adb shell dumpsys webviewupdate >"$R/webview-provider.txt";adb shell getprop ro.build.fingerprint >"$R/device.txt"
# Bounded wait for real WebView to POST its report. No browser substitution.
for i in $(seq 1 90);do test ! -s "$R/webview.json" || break;sleep 1;done;test -s "$R/webview.json"
node "$L/tests/desktop.cjs" "$W" "$R" return;python "$L/tests/verify.py" "$R" chromium firefox webkit android webview returned
