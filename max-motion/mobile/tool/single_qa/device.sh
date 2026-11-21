#!/usr/bin/env bash
set -euo pipefail
export QA="$RUNNER_TEMP/single-qa"
bash tool/single_qa/prepare.sh

python3 -u tool/single_qa/host.py >"$QA/evidence/host.log" 2>&1 & host=$!
trap 'kill "$host" || true; adb logcat -d -t 2000 > "$QA/evidence/android.log"' EXIT
flutter test --no-pub integration_test/single_android_test.dart -d emulator-5554 --reporter expanded 2>&1 | tee "$QA/evidence/integration.log"
adb install -r "$RUNNER_TEMP/normal.apk"; adb shell pm clear io.github.obada0110.maxeditor
python3 tool/single_qa/cold.py 2>&1 | tee "$QA/evidence/restart.log"
