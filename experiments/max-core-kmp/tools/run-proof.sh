#!/usr/bin/env bash
set -euo pipefail
mkdir -p proof/{jvm,js,records}
cp build/libs/maxcore-jvm.jar build/runtime/*.jar proof/jvm/
python3 tools/vectors.py proof/fixtures
D=${RUNNER_TEMP:-/tmp}/max-kmp-tools
npm install --prefix "$D" --no-audit --no-fund playwright-core@1.55.0 esbuild@0.25.12
export NODE_PATH="$D/node_modules"
"$D/node_modules/.bin/esbuild" build/compileSync/js/main/productionExecutable/kotlin/maxcore.mjs --bundle --minify --format=esm --platform=browser --outfile=proof/js/max-core.mjs
gzip -n -9 -c proof/js/max-core.mjs > proof/js/max-core.mjs.gz
java -cp 'proof/jvm/*' probe.Probe proof/fixtures proof/records/jvm-trace.json
java -Xmx512m -cp 'proof/jvm/*' probe.Bench proof/fixtures proof/records/jvm-perf.json
node tools/browser.cjs
python3 tools/compare.py jvm browser
{ git rev-parse HEAD; uname -sm; lscpu | grep -E 'Model name|^CPU\(s\):'; java -version 2>&1; google-chrome --version; node -v; } >proof/records/environment.txt
wc -c proof/js/* proof/jvm/* >proof/records/sizes.txt
