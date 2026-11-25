#!/usr/bin/env bash
set -euo pipefail
L=$(cd "$(dirname "$0")" && pwd); P=${PILOT_DIR:?}; R="$L/proof/records";mkdir -p "$R"
python "$L/prepare.py" "$P"; cd "$P/experiments/max-integration"; ../max-core-kmp/gradlew --no-daemon --console=plain jvmJar compileProductionExecutableKotlinJs
W="$P/max-motion";cp build/libs/maxintegration-jvm.jar "$W/mobile/android/app/libs/core-pilot.jar";D="$RUNNER_TEMP/pilot-node"; mkdir -p "$D";cp ../max-core-kmp/tools/package{,-lock}.json "$D/";npm ci --prefix "$D" --no-audit --no-fund;"$D/node_modules/.bin/esbuild" build/compileSync/js/main/productionExecutable/kotlin/maxintegration.mjs --bundle --minify --format=esm --outfile="$W/core-pilot.mjs";cp "$L/tests/probe.html" "$W/";cp "$W/contract/fixtures/project.json" "$R/seed.json"
ffmpeg -v error -f lavfi -i 'testsrc2=s=160x96:r=12' -t 10 -c:v libvpx -b:v 120k "$W/pilot.webm"
