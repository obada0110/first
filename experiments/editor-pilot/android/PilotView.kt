package io.github.obada0110.maxeditor
import android.app.Activity
import android.os.Bundle
import android.webkit.WebView
// Fixed loopback endpoint supplied by `adb reverse` only. No JS/native interface.
class PilotView:Activity(){override fun onCreate(s:Bundle?){super.onCreate(s); val w=WebView(this); w.settings.javaScriptEnabled=true;w.settings.domStorageEnabled=true;w.settings.allowFileAccess=false;setContentView(w);w.loadUrl("http://127.0.0.1:8974/probe.html")}}
