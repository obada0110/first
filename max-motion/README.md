# Max Motion — test 01

Personal Android video editor, target device POCO X5 Pro. Target final product: less than 100 MB initial download; 1080p/60 export subject to device tests. Each milestone must be tried on the phone before increasing scope. Node Video is a reference for effects, not a requirement to copy a node graph. Requested: glow, rain, motion (exact interpretation pending), light frost, fifth effect TBD.

This first local-processing browser prototype is not an APK or a benchmark of a future native renderer. Import one local video, select an interval up to ten seconds, preview, export and replay with sound. Canvas and Web Audio feed MediaRecorder; MP4 preferred, WebM fallback is explicitly labelled. Recording is real-time, up to 720p/30. Source duration, codecs, encoder output, download/share availability, and performance depend on browser. No uploads, no project persistence in this first experiment. Keep the page foregrounded. `index.html` is standalone; `test01.json` contains the same UI for LiveCodes result mode.

Next test: compare preview smoothness with 1, 4, 7, 8 overlays on the same source; larger counts optional. Record frame times before adding effects. No promise of a fixed layer limit.

## Direct static hosting (no LiveCodes or preview gateway)
The Pages artifact is `docs/max-motion/index.html`. For each new test, copy the updated standalone page there and verify it is byte-identical to `max-motion/index.html`. Preserve the other app at `docs/index.html`. In repository Settings → Pages, select Deploy from a branch, `arena/bff96530-first`, `/docs`. Use the Pages dashboard's published base URL plus `max-motion/`. A commit alone does not enable Pages.
