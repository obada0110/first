#!/usr/bin/env bash
set -euo pipefail
L=$(cd "$(dirname "$0")/.." && pwd);P=${PILOT_DIR:?};W="$P/max-motion";R="$L/proof/records";export NODE_PATH="$RUNNER_TEMP/pilot-node/node_modules"
python "$L/tests/serve.py" "$W" "$R" >"$R/device-http.log" 2>&1 & SERVER=$!;trap 'kill "$SERVER"' EXIT
adb reverse tcp:8974 tcp:8974;pkg=lab.maxeditor.hostpilot
cd "$W/mobile"; test -f "$P/ordinary-pilot.apk" || cp build/app/outputs/flutter-apk/app-debug.apk "$P/ordinary-pilot.apk";flutter test --no-pub integration_test/pilot_test.dart -d "${ANDROID_SERIAL:-emulator-5554}" --reporter expanded |tee "$R/flutter.log"
test -s "$R/android-file.json" # Collected by the host while the real test package was still alive.
node "$L/tests/desktop.cjs" "$W" "$R" return;python "$L/tests/verify.py" "$R" chromium firefox webkit android returned
adb install -r "$P/ordinary-pilot.apk"
adb shell am start -W -n "$pkg/io.github.obada0110.maxeditor.PilotView";adb shell dumpsys webviewupdate >"$R/webview-provider.txt";adb shell getprop ro.build.fingerprint >"$R/device.txt"
# Bounded wait for real WebView to POST its report. No browser substitution.
for i in $(seq 1 90);do test ! -s "$R/webview.json" || break;sleep 1;done;adb logcat -d -t 2000 |grep -iE "chromium|WebView|PilotView" |tail -100 >"$R/webview-log.txt" || true
python "$L/tests/verify.py" "$R" chromium firefox webkit android webview returned
# Separate monitor observation. A black frame is evidence against release, not an ignored test.
if [[ ${RUN_PAUSED_PROBE:-0} == 1 ]]; then
 mkdir -p "$R/monitor"; adb shell mkdir -p /sdcard/Download; adb install -r "$P/ordinary-pilot.apk";adb push "$W/mx-land.mp4" /sdcard/Download/mx-land.mp4
 adb shell am broadcast -a android.intent.action.MEDIA_SCANNER_SCAN_FILE -d file:///sdcard/Download/mx-land.mp4 >/dev/null
 python "$L/tests/paused_probe.py" "$W" "$R/monitor" 2>&1 | tee "$R/monitor/probe.log"
fi

python "$L/tests/verify.py" "$R" chromium firefox webkit android webview returned
