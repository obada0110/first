#!/usr/bin/env bash
set -eu
mkdir -p "$QA/fixtures" "$QA/evidence"; cd "$QA/fixtures"
ffmpeg -v error -f lavfi -i 'testsrc2=s=320x180:r=24:d=6' -f lavfi -i 'sine=frequency=660:sample_rate=48000:duration=6' -c:v libx264 -pix_fmt yuv420p -g 48 -bf 0 -c:a aac -movflags +faststart mx-land.mp4
ffmpeg -v error -i mx-land.mp4 -map 0:v -c copy -metadata:s:v:0 rotate=90 mx-tall.mp4
printf 'not a movie' > mx-bad.mp4
adb shell mkdir -p /sdcard/Download; for f in mx*; do adb push "$f" "/sdcard/Download/$f"; adb shell am broadcast -a android.intent.action.MEDIA_SCANNER_SCAN_FILE -d "file:///sdcard/Download/$f" >/dev/null; done
adb shell wm size 600x1080; adb shell wm density 160; adb reverse tcp:8765 tcp:8765
