package io.github.obada0110.maxeditor

import android.content.Context
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

class MainActivity : FlutterActivity() {
    private lateinit var video: io.github.obada0110.maxeditor.single.SingleChannel
    override fun onActivityResult(requestCode:Int,resultCode:Int,data:android.content.Intent?){super.onActivityResult(requestCode,resultCode,data);if(::video.isInitialized)video.result(requestCode,resultCode,data)}
    override fun onPause(){if(::video.isInitialized)video.pause();super.onPause()}
    override fun cleanUpFlutterEngine(flutterEngine:FlutterEngine){if(::video.isInitialized)video.close();super.cleanUpFlutterEngine(flutterEngine)}
    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        video=io.github.obada0110.maxeditor.single.SingleChannel(this,flutterEngine)
        val prefs = getSharedPreferences("ui_settings", Context.MODE_PRIVATE)
        val messenger = flutterEngine.dartExecutor.binaryMessenger
        // Keep synchronous disk writes off the Android UI thread; only report success after commit.
        MethodChannel(messenger, "max_editor/settings", io.flutter.plugin.common.StandardMethodCodec.INSTANCE, messenger.makeBackgroundTaskQueue())
            .setMethodCallHandler { call, result ->
                when (call.method) {
                    "readLocale" -> result.success(prefs.getString("locale", null))
                    "writeLocale" -> {
                        val tag = call.arguments as? String
                        if (tag.isNullOrBlank() || tag.length > 64) {
                            result.error("invalid_locale", null, null)
                        } else if (prefs.edit().putString("locale", tag).commit()) {
                            result.success(null)
                        } else {
                            result.error("write_failed", null, null)
                        }
                    }
                    else -> result.notImplemented()
                }
            }
    }
}
