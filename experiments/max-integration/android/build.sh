#!/usr/bin/env bash
# Standalone debug lab, independent application id & ephemeral signing key. No production APK.
set -euo pipefail
sdk=${ANDROID_HOME:?}; bt=$(dirname "$(find "$sdk/build-tools" -name d8 | sort -V | tail -1)"); platform="$sdk/platforms/android-35/android.jar"
d=build/android; mkdir -p "$d"/{classes,assets} proof/android
cp ../max-core-kmp/fixtures/project.json "$d/assets/"; cp web/schema.json "$d/assets/"
javac --release 8 -cp "$platform:build/libs/maxintegration-jvm.jar:build/runtime/*" -d "$d/classes" android/Lab.java
jar cf "$d/activity.jar" -C "$d/classes" .
"$bt/d8" --release --min-api 26 --lib "$platform" --output "$d" "$d/activity.jar" build/libs/maxintegration-jvm.jar build/runtime/*.jar
"$bt/aapt2" link -I "$platform" --manifest android/AndroidManifest.xml -A "$d/assets" -o "$d/plain.apk"
(cd "$d" && zip -q plain.apk classes*.dex)
"$bt/zipalign" -f 4 "$d/plain.apk" "$d/aligned.apk"
if [[ ! -f $d/lab.p12 ]]; then keytool -genkeypair -keystore "$d/lab.p12" -alias lab -storepass test-only -keypass test-only -dname CN=FixtureLab -keyalg RSA -validity 30; fi
"$bt/apksigner" sign --ks "$d/lab.p12" --ks-pass pass:test-only --out proof/android/transfer-lab.apk "$d/aligned.apk"
"$bt/apksigner" verify proof/android/transfer-lab.apk
