#!/usr/bin/env bash
set -eu
find build -name '*.mjs' -o -name '*.jar' | tee proof/records/build-products.txt
echo 'Build layout probe only; not a parity pass.'
