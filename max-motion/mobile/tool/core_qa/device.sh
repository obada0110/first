#!/usr/bin/env bash
set -euo pipefail
export QA="$RUNNER_TEMP/core-qa";mkdir -p "$QA/evidence" "$QA/fixtures"
ffmpeg -v error -f lavfi -i 'testsrc2=s=320x180:r=24:d=6' -f lavfi -i 'sine=frequency=660:sample_rate=48000:duration=6' -c:v libx264 -pix_fmt yuv420p -g 48 -bf 0 -c:a aac -movflags +faststart "$QA/fixtures/mx-land.mp4"
adb shell wm size 600x1080;adb shell wm density 160;adb shell mkdir -p /sdcard/Download
adb push "$QA/fixtures/mx-land.mp4" /sdcard/Download/mx-land.mp4 >/dev/null
adb shell am broadcast -a android.intent.action.MEDIA_SCANNER_SCAN_FILE -d file:///sdcard/Download/mx-land.mp4 >/dev/null
adb reverse tcp:8765 tcp:8765
python3 -u tool/core_qa/host.py >"$QA/evidence/host.log" 2>&1 & host=$!;trap 'kill "$host" || true;adb logcat -d -t 2500 > "$QA/evidence/android.log"' EXIT
if ! flutter test --no-pub integration_test/core_edit_android_test.dart -d emulator-5554 --reporter expanded 2>&1 | tee "$QA/evidence/integration.log"; then
  { printf '\\n=== integration ===\\n'; cat "$QA/evidence/integration.log"; printf '\\n=== QA bridge ===\\n'; cat "$QA/evidence/host.log"; printf '\\n=== relevant Android logcat ===\\n'; adb logcat -d -t 1200 | grep -E 'FATAL EXCEPTION|AndroidRuntime|MaxVideo|E/flutter|Exception|Caused by' | tail -60; } > "$QA/evidence/failure.log" 2>&1 || true
  python3 tool/core_qa/ci_diagnostic.py "$QA/evidence/failure.log" "Android emulator integration"
  exit 1
fi
if ! python3 tool/core_qa/cold.py 2>&1 | tee "$QA/evidence/cold-reopen.log"; then
  { printf '\\n=== cold reopen ===\\n'; cat "$QA/evidence/cold-reopen.log"; printf '\\n=== QA bridge ===\\n'; cat "$QA/evidence/host.log"; printf '\\n=== relevant Android logcat ===\\n'; adb logcat -d -t 1200 | grep -E 'FATAL EXCEPTION|AndroidRuntime|MaxVideo|E/flutter|Exception|Caused by' | tail -60; } > "$QA/evidence/failure.log" 2>&1 || true
  python3 tool/core_qa/ci_diagnostic.py "$QA/evidence/failure.log" "Android cold-reopen and relink"
  exit 1
fi
# Explicit rollback validation: reinstall the default-off APK, clear only this disposable emulator, and run the existing production Android suite.
unset ORG_GRADLE_PROJECT_maxCoreEditorEnabled
cp "$RUNNER_TEMP/max-editor-legacy-debug.apk" "$RUNNER_TEMP/normal.apk"
adb install -r "$RUNNER_TEMP/normal.apk" >/dev/null;adb shell pm clear io.github.obada0110.maxeditor >/dev/null
bash tool/single_qa/device.sh
