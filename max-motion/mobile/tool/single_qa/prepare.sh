#!/usr/bin/env bash
set -eu
mkdir -p "$QA/fixtures" "$QA/evidence"; cd "$QA/fixtures"
ffmpeg -v error -f lavfi -i 'testsrc2=s=320x180:r=24:d=6' -f lavfi -i 'sine=frequency=660:sample_rate=48000:duration=6' -c:v libx264 -pix_fmt yuv420p -g 48 -bf 0 -c:a aac -movflags +faststart mx-land.mp4
ffmpeg -v error -display_rotation:v:0 90 -i mx-land.mp4 -map 0:v -c copy mx-tall.mp4
printf 'not a movie' > mx-bad.mp4
adb shell mkdir -p /sdcard/Download; for f in mx*; do adb push "$f" "/sdcard/Download/$f"; adb shell am broadcast -a android.intent.action.MEDIA_SCANNER_SCAN_FILE -d "file:///sdcard/Download/$f" >/dev/null; done
adb shell wm size 600x1080; adb shell wm density 160; adb reverse tcp:8765 tcp:8765

ffprobe -v error -show_streams -show_format -of json mx-tall.mp4 > "$QA/evidence/portrait-input.json"
python3 - <<'PY_CHECK'
import json, os, subprocess, hashlib
from pathlib import Path
out=Path(os.environ['QA'])/'evidence'
v=json.loads((out/'portrait-input.json').read_text())['streams'][0]
assert any(abs(x.get('rotation',0))==90 for x in v.get('side_data_list',[])),v
(out/'before.json').write_text(json.dumps({f:hashlib.sha256(subprocess.check_output(['adb','exec-out','cat','/sdcard/Download/'+f])).hexdigest() for f in ['mx-land.mp4','mx-tall.mp4']},indent=2))
PY_CHECK
