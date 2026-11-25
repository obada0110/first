#!/usr/bin/env bash
# Run exactly the JVM artifact (dexed), without installing the editor or an APK.
set -euo pipefail
SDK="${ANDROID_HOME:?}"; DC=$(find "$SDK/build-tools" -name d8 |sort -V|tail -1)
mkdir -p proof/android
"$DC" --release --min-api 26 --lib "$SDK/platforms/android-35/android.jar" --output proof/android/max-core-dex.jar proof/jvm/*.jar
P=/data/local/tmp/max-kmp-proof
adb shell mkdir -p "$P"
adb push proof/android/max-core-dex.jar proof/fixtures/{schema,cases}.json "$P/"
adb shell chmod 444 "$P/max-core-dex.jar"
adb shell "CLASSPATH=$P/max-core-dex.jar app_process /system/bin probe.Probe $P $P/art.json"
adb pull "$P/art.json" proof/records/art-trace.json
adb shell getprop ro.build.fingerprint > proof/records/art-environment.txt
python3 tools/compare.py jvm browser art
