#!/usr/bin/env bash
set -euo pipefail
mkdir -p proof/records
../max-core-kmp/gradlew --no-daemon --console=plain jvmJar runtimeDeps compileProductionExecutableKotlinJs
D=${RUNNER_TEMP:-/tmp}/max-integration-tools; mkdir -p "$D"; cp ../max-core-kmp/tools/package{,-lock}.json "$D/";npm ci --prefix "$D" --no-audit --no-fund
"$D/node_modules/.bin/esbuild" build/compileSync/js/main/productionExecutable/kotlin/maxintegration.mjs --bundle --minify --format=esm --platform=browser --outfile=web/core.mjs
cp ../max-core-kmp/fixtures/project-v1.json web/schema.json;mkdir -p proof/web;cp web/* proof/web/
bash android/build.sh
