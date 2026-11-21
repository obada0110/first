# Max Motion — browser editor

Personal Android video editor, target device POCO X5 Pro. Target final product: less than 100 MB initial download; 1080p/60 export subject to device tests. Each milestone must be tried on the phone before increasing scope. Node Video is a reference for effects, not a requirement to copy a node graph. Requested: glow, rain, motion (exact interpretation pending), light frost, fifth effect TBD.

This first local-processing browser prototype is not an APK or a benchmark of a future native renderer. Import one local video, select an interval up to ten seconds, preview, export and replay with sound. Canvas and Web Audio feed MediaRecorder; MP4 preferred, WebM fallback is explicitly labelled. Recording is real-time, up to 720p/30. Source duration, codecs, encoder output, download/share availability, and performance depend on browser. No uploads, no project persistence in this first experiment. Keep the page foregrounded. `index.html` is standalone; `test01.json` contains the same UI for LiveCodes result mode.

Next test: compare preview smoothness with 1, 4, 7, 8 overlays on the same source; larger counts optional. Record frame times before adding effects. No promise of a fixed layer limit.

## Direct static hosting (no LiveCodes or preview gateway)
The Pages artifact is `docs/max-motion/index.html`. For each new test, copy the updated standalone page there and verify it is byte-identical to `max-motion/index.html`. Preserve the other app at `docs/index.html`. In repository Settings → Pages, select Deploy from a branch, `arena/bff96530-first`, `/docs`. Use the Pages dashboard's published base URL plus `max-motion/`. A commit alone does not enable Pages.

## Test 02 — non-destructive timeline cuts
The current standalone page and Pages mirror supersede Test 01. Import the full source, scrub left-to-right and cut the selected piece. Split preserves both sides; trim left/right drops the earlier/later side of that piece only. Delete closes the gap; up to 100 undo snapshots restore the edit and cursor. Preview and export play the surviving source intervals in order, coalescing adjacent intervals and pausing the recorder across skipped sections. Original media is never modified. `test01.json` remains the historical first browser prototype.

## Test 03 — per-piece effects
`effects.js` is the local shader/parameter catalog. Publish it alongside `index.html` in `docs/max-motion/`; no CDN or external model is required. Edits are per piece, compose in a fixed order, inherit on split and share the edit undo stack. Compare-original is a preview control only. Effects require WebGL; with no effects the existing video/canvas path stays available. See FEATURE-REVIEW.md for the reference review and the reproducible fixture/browser/decoder checks.

## Test 04 — phone editing workspace
One preview, transport strip, horizontal tool shelf, contextual drawer and thumbnail timeline. The six-second bundled silent demo is an AI-generated landscape animated with a slow push-in; it is a real editable video. Import via + or الوسائط to replace it with one local file (replacing clears the session). Tap the ruler or filmstrip to position the playhead and select its piece. At fit zoom, drag to scrub; at higher zoom, drag to scroll time under the playhead. Use the arrows or Home/End with the focused timeline for keyboard editing.

Deploy `index.html`, `studio.css`, `editor.js`, `studio.js`, `effects.js` and `media/` together. The updated `tests/effects.cjs` drives the visible categories before checking the ten tools on a simulated 393px touch viewport. Test 04 changes the interface, not the export resolution or layer limit.
