# Phase 2 — isolated integration lab (not an editor upgrade)

**No production dependency, migration or storage adapter.** `../max-core-kmp/src/commonMain/kotlin` is compiled into both artifacts unchanged; `common/Port.kt` adds a single transport boundary. The web adapter translates file input, stateless button intents and downloads. The tiny native Android Activity translates native button intents and private lab fixture files. Neither host computes a cut, interpolates values, or rewrites v1 itself. Android intentionally displays no video. Asset bindings, content URIs, undo history and renderer internals never cross the boundary. The production web/Flutter/native UIs do not load either binary.

## Wire ABI 1 (freeze candidate)

Request object has **exactly** `api` (integer 1), `method` (string), and `data`. Reply always has `api,ok,revision,value,error`. `revision` is current, including after refusal; null if not opened. Unknown methods and API versions are rejected without mutation. One caller serializes operations of one session. The prototype factory accepts a schema only from its packaged assets. Request limit: 2,000,000 UTF-16 code units; JSON nesting limit: 128. Hosts should cap file/transport bytes before allocating. Do not interpret a successful edit response as durable storage.

|method|data|success value|
|---|---|---|
|open|raw project v1 string; once per port|`null`, revision from input|
|snapshot|`null`|full v1 JSON **string**|
|render|integer project µs in ±one day|RenderSpec **object** or `null` outside timeline|
|edit|exact command object defined in design report, including `expectedRevision`|`null`, incremented revision|

Example: `{"api":1,"method":"edit","data":{"op":"split","id":"cA","rightId":"cB","atUs":3000000,"expectedRevision":0}}` → `{"api":1,"ok":true,"revision":1,"value":null,"error":null}`. A repeat with revision 0 → `ok:false,error:"STALE_REVISION",revision:1`. Snapshot, re-evaluate intent, never silently replay. ABI version is independent of document version and RenderSpec version. A future durable adapter needs prepare/persist/ack or rollback; this API is not that protocol.

| error code | host action |
|---|---|
| BAD_API / BAD_METHOD / UNKNOWN_OP | incompatible caller; stop, no fallback rewrite |
| BAD_REQUEST / TOO_LARGE / DUPLICATE_FIELD | reject malformed, ambiguous or oversized request |
| INVALID_PROJECT / MISSING_ASSET / DUPLICATE_ID / KEY_CLOCK | report invalid field/version/unsupported FX, missing project ref, collision or key range; preserve original, never save lossy copy |
| NOT_OPEN / ALREADY_OPEN | use a fresh session for another document |
| STALE_REVISION / REVISION_LIMIT | refresh or stop; never wrap revision |
| TIME_RANGE / CUT_MARGIN / LAST_CLIP / UNKNOWN_ID / BAD_ORDER / NO_KEY | invalid target/intent; leave current state and history untouched |
| UNDO_EMPTY / REDO_EMPTY | unavailable command |

An unrecognized effect in a document currently produces `INVALID_PROJECT` (not a fake renderer and not a precise field diagnosis). A missing media *binding* on the host is distinct from a nonexistent v1 asset ID. Known FX stay intact even when the Android host cannot preview them. Error-path details, forward opaque extension support and capability negotiation require a reviewed ABI change/addition before release. Never submit untrusted user projects to the prototype.

## Replay

Linux, JDK 17, Gradle wrapper in the sibling Phase 1 experiment, Node 22, Android SDK platform 35 + build-tools, adb, Chrome, and network for tool installs. From this folder:

```sh
bash build.sh
D=${RUNNER_TEMP:-/tmp}/max-integration-tools
node "$D/node_modules/playwright-core/cli.js" install --with-deps firefox webkit
# Use a disposable API 35 emulator. If multiple devices exist specify ANDROID_SERIAL.
adb install proof/android/transfer-lab.apk
NODE_PATH="$D/node_modules" node tests/transfer.cjs
```

The web build is `proof/web/` (serve as a static directory). Use the provided `project.json` fixture only. The Android debug APK has its own id `lab.maxeditor.transfer`, no permissions and no editor project storage. The replay stages data through `adb run-as` **only** under that package's private `files/`, and tests the Activity's real button handlers. Fixed sequence per direction: Web split → Android reorder → Web key; Android reorder → Web split → Android key. The driver checks every transferred document, not only final revisions. Every browser reads through an actual file input and downloads through a Blob. Probe-only timing is not frame timing.

**Physical-device gate:** use an explicitly selected, consenting test phone with USB debugging, Android 8+; ensure the lab package is not already installed. Record model/OS and operator confirmation that it is physical (qemu props alone aren't proof). Run the commands above with `ANDROID_SERIAL=<selected serial>` and `PHYSICAL=1` on the last command; preserve `proof/records/`, and `adb uninstall lab.maxeditor.transfer` afterwards if desired. Do not clear/install over any editor or touch its DB. Physical preview/rotate/restore tests for the existing editor must separately use a disposable test profile and synthetic asset. Safari and Android WebView still require actual device/browser tests; Playwright WebKit is not a Safari release.
