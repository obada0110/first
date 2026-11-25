#!/usr/bin/env bash
set -euo pipefail
export QA="$RUNNER_TEMP/core-qa";mkdir -p "$QA/evidence" "$QA/fixtures"
ffmpeg -v error -f lavfi -i 'testsrc2=s=320x180:r=24:d=6' -f lavfi -i 'sine=frequency=660:sample_rate=48000:duration=6' -c:v libx264 -pix_fmt yuv420p -g 48 -bf 0 -c:a aac -movflags +faststart "$QA/fixtures/mx-land.mp4"
adb shell wm size 600x1080;adb shell wm density 160;adb shell mkdir -p /sdcard/Download
adb push "$QA/fixtures/mx-land.mp4" /sdcard/Download/mx-land.mp4 >/dev/null
adb shell am broadcast -a android.intent.action.MEDIA_SCANNER_SCAN_FILE -d file:///sdcard/Download/mx-land.mp4 >/dev/null
adb reverse tcp:8765 tcp:8765
python3 -u tool/core_qa/host.py >"$QA/evidence/host.log" 2>&1 & host=$!;trap 'kill "$host" || true;adb logcat -d -t 2500 > "$QA/evidence/android.log"' EXIT
publish_failure_summary(){
  if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
    { printf '## Android QA failure details\n\n```text\n'; tail -c 16000 "$QA/evidence/failure.log"; printf '\n```\n'; } >> "$GITHUB_STEP_SUMMARY"
  fi
}
if ! flutter test --no-pub integration_test/core_edit_android_test.dart -d emulator-5554 --reporter expanded 2>&1 | tee "$QA/evidence/integration.log"; then
  { printf '\n=== integration ===\n'; cat "$QA/evidence/integration.log"; printf '\n=== QA bridge ===\n'; cat "$QA/evidence/host.log"; printf '\n=== relevant Android logcat ===\n'; adb logcat -d -t 1200 | grep -E 'FATAL EXCEPTION|AndroidRuntime|MaxVideo|E/flutter|Exception|Caused by' | tail -60; } > "$QA/evidence/failure.log" 2>&1 || true
  python3 tool/core_qa/ci_diagnostic.py "$QA/evidence/failure.log" "Android emulator integration"
  publish_failure_summary
  exit 1
fi
# flutter test's Android runner removes its temporary target package on teardown. Reinstall the same isolated debug APK and restore the exact v1 checkpoint captured from the app before exercising real cold-start and SAF repair.
app=io.github.obada0110.maxeditor.phase3a
checkpoint_failure(){
  printf 'Checkpoint reinstallation/restore failed at: %s\n' "$1" > "$QA/evidence/failure.log"
  printf '\n=== installed MAX EDITOR packages ===\n' >> "$QA/evidence/failure.log"
  adb shell pm list packages | grep maxeditor >> "$QA/evidence/failure.log" 2>&1 || true
  printf '\n=== Android package/install diagnostics ===\n' >> "$QA/evidence/failure.log"
  adb logcat -d -t 500 | grep -E 'PackageManager|INSTALL_FAILED|run-as|AndroidRuntime|FATAL EXCEPTION' | tail -60 >> "$QA/evidence/failure.log" 2>&1 || true
  python3 tool/core_qa/ci_diagnostic.py "$QA/evidence/failure.log" "Android checkpoint restore"
  publish_failure_summary
  exit 1
}
[[ -s "$QA/evidence/project-v1.json" ]] || checkpoint_failure 'captured v1 file missing'
adb install -r "$RUNNER_TEMP/MAX-EDITOR-Phase-3A-Core-Debug.apk" >/dev/null || checkpoint_failure 'install isolated core APK'
adb shell run-as "$app" sh -c 'cat > files/single-v1.json' < "$QA/evidence/project-v1.json" || checkpoint_failure 'write v1 checkpoint into isolated app data'
adb exec-out run-as "$app" cat files/single-v1.json > "$QA/evidence/restored-v1.json" || checkpoint_failure 'read restored v1 checkpoint'
python3 - "$QA/evidence/project-v1.json" "$QA/evidence/restored-v1.json" <<'PY' || checkpoint_failure 'compare restored v1 checkpoint'
import json,sys
assert json.load(open(sys.argv[1]))==json.load(open(sys.argv[2])), 'restored checkpoint differs from app-captured v1 state'
PY
if ! python3 tool/core_qa/cold.py 2>&1 | tee "$QA/evidence/cold-reopen.log"; then
  { printf '\n=== cold reopen ===\n'; cat "$QA/evidence/cold-reopen.log"; printf '\n=== QA bridge ===\n'; cat "$QA/evidence/host.log"; printf '\n=== relevant Android logcat ===\n'; adb logcat -d -t 1200 | grep -E 'FATAL EXCEPTION|AndroidRuntime|MaxVideo|E/flutter|Exception|Caused by' | tail -60; } > "$QA/evidence/failure.log" 2>&1 || true
  python3 tool/core_qa/ci_diagnostic.py "$QA/evidence/failure.log" "Android cold-reopen and relink"
  publish_failure_summary
  exit 1
fi
# Explicit rollback validation: reinstall the default-off APK, clear only this disposable emulator, and run the existing production Android suite.
unset ORG_GRADLE_PROJECT_maxCoreEditorEnabled
cp "$RUNNER_TEMP/max-editor-legacy-debug.apk" "$RUNNER_TEMP/normal.apk"
adb install -r "$RUNNER_TEMP/normal.apk" >/dev/null;adb shell pm clear io.github.obada0110.maxeditor >/dev/null
bash tool/single_qa/device.sh
