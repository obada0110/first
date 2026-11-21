# Pocket Door — offline Android demo

The launcher loads the original standalone `../index.html` from `file:///android_asset/Play.html` inside Android System WebView. There is no INTERNET permission, file picker, external navigation flow, or JavaScript bridge. Android 7+ and a current Android System WebView are recommended.

For a local build, copy this Android source directory to a temporary project, copy `../index.html` into that project's `assets/Play.html`, and run `apktool b <project> -o unsigned.apk` (built with apktool 2.4.1). Sign the output with your own Android signing key. Do not commit private signing keys. The distributed demo is signed and its embedded game is self-contained.
