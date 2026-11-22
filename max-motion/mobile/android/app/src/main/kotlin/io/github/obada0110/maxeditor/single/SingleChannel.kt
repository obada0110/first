package io.github.obada0110.maxeditor.single

import android.app.Activity
import android.content.*
import android.net.Uri
import android.os.Build
import android.view.LayoutInflater
import androidx.media3.common.*
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.analytics.AnalyticsListener
import java.util.concurrent.atomic.AtomicInteger
import androidx.media3.ui.PlayerView
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.*
import io.flutter.plugin.platform.*
import io.github.obada0110.maxeditor.R
import kotlinx.serialization.json.*
import maxeditor.contract.*
import java.util.concurrent.Executors

class SingleChannel(private val a:Activity,e:FlutterEngine) {
    private val context=a.applicationContext;private val store=SourceStore(context);private val exporter=Export(context)
    private val player=ExoPlayer.Builder(context).build();private val io=Executors.newSingleThreadExecutor();private val renderedFrames=AtomicInteger()
    private val channel=MethodChannel(e.dartExecutor.binaryMessenger,"max_editor/single/v1")
    private val projectChannel=MethodChannel(e.dartExecutor.binaryMessenger,"max_editor/project_core/v1")
    private val coreSchema=context.assets.open("project-v1.json").bufferedReader().use{it.readText()}
    private val projects=ProductionProjectSession(store,coreSchema,BuildConfig.MAX_CORE_EDITOR_ENABLED)
    private var p:JsonObject?=null;private var info:Source?=null;private var uri:Uri?=null;private var pending:MethodChannel.Result?=null;private var working=false;private var closed=false;private var issue=""
    init {
        projectChannel.setMethodCallHandler({ call, result ->
            if (call.method == "enabled") { result.success(projects.isEnabled()); return@setMethodCallHandler }
            if (!projects.isEnabled()) { result.error("FEATURE_DISABLED", null, null); return@setMethodCallHandler }
            when(call.method) {
                "reload" -> io.execute { try {
                    val restored=projects.reopen()
                    val source=store.uri(restored);val metadata=Source.inspect(context,source);p=restored;uri=source;info=metadata
                    a.runOnUiThread { if(!closed){player.setMediaItem(MediaItem.fromUri(source));player.prepare();result.success(restored.toString())} }
                } catch(ex:Exception) { a.runOnUiThread { result.error("RESTORE_FAILED",ex.message,null) } } }
                "snapshot" -> io.execute { val value=projects.snapshot(); a.runOnUiThread { result.success(value) } }
                "revokePermissionForQa" -> {
                    check(BuildConfig.DEBUG && uri!=null)
                    context.contentResolver.releasePersistableUriPermission(requireNotNull(uri),Intent.FLAG_GRANT_READ_URI_PERMISSION)
                    result.success(null)
                }
                "edit" -> io.execute { try {
                    val next=projects.edit(call.arguments as String)
                    p=Json.parseToJsonElement(next).jsonObject
                    a.runOnUiThread { result.success(next) }
                } catch(ex:Exception) { a.runOnUiThread { result.error(ex.message?.takeIf { it in setOf("BAD_ORDER","CUT_MARGIN","TIME_RANGE","LAST_CLIP","UNDO_EMPTY","REDO_EMPTY","STALE_REVISION","REVISION_LIMIT","UNKNOWN_ID","DUPLICATE_ID") } ?: "EDIT_FAILED", ex.message, null) } } }
                else -> result.notImplemented()
            }
        }, e.dartExecutor.binaryMessenger.makeBackgroundTaskQueue())
        e.platformViewsController.registry.registerViewFactory("max_editor/preview",object:PlatformViewFactory(StandardMessageCodec.INSTANCE){override fun create(c:Context,id:Int,args:Any?):PlatformView {
            val view=LayoutInflater.from(c).inflate(R.layout.single_preview,null) as PlayerView;view.player=player
            // A paused READY player may retain decoder position while TextureView has a new surface after restore/rotation.
            // Re-seek the same source position only after the newly attached view is posted; never auto-play.
            view.post { if(!player.isPlaying && player.playbackState==Player.STATE_READY) player.seekTo(player.currentPosition) }
            return object:PlatformView{override fun getView()=view;override fun dispose(){view.player=null}}
        }})
        player.addListener(object:Player.Listener{override fun onPlayerError(error:PlaybackException){issue="playError"}})
        player.addAnalyticsListener(object:AnalyticsListener {
            override fun onRenderedFirstFrame(eventTime:AnalyticsListener.EventTime,output:Any,renderTimeMs:Long){renderedFrames.incrementAndGet()}
        })
        channel.setMethodCallHandler {call,r->try {
            fun num(k:String)=requireNotNull(call.argument<Number>(k)).toLong()
            when(call.method){
                "state"->r.success(state())
                "close"->{player.pause();r.success(null)}
                "cancel"->{exporter.cancel();r.success(null)}
                else->{check(!working && pending==null && !exporter.busy);when(call.method){
                    "open"->pick(710,Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("video/*").addFlags(65),r)
                    "relink"->pick(712,Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("video/*").addFlags(65),r)
                    "restore"->load(null,r)
                    "range"->{val old=requireNotNull(p);check(num("revision")==old.n("revision"));val from=num("from");val to=num("to");working=true;io.execute{try{val next=if(BuildConfig.MAX_CORE_EDITOR_ENABLED){projects.trimRange(from,to,old.n("revision"))}else store.range(old,from,to);a.runOnUiThread{working=false;p=next;r.success(state())}}catch(ex:Exception){a.runOnUiThread{working=false;r.error(if(ex is IllegalArgumentException || ex is IllegalStateException)"range" else "save",null,null)}}}}
                    "seek"->{player.seekTo(num("us")/1000);r.success(null)}
                    "play"->{check(Clock.clips(requireNotNull(p)).size<=1){"multiPreviewUnavailable"};if(player.isPlaying)player.pause() else{if(player.playbackState==Player.STATE_ENDED)player.seekTo(0);player.play()};r.success(null)}
                    "export"->{player.pause();if(Build.VERSION.SDK_INT<29)pick(711,Intent(Intent.ACTION_OPEN_DOCUMENT_TREE),r) else {startExport(null);r.success(null)}}
                    else->r.notImplemented()
                }}
            }
        }catch(ex:Exception){android.util.Log.w("MaxVideo",call.method,ex);r.error("unavailable",ex.javaClass.simpleName,null)}}
    }
    private fun pick(code:Int,intent:Intent,r:MethodChannel.Result){player.pause();a.startActivityForResult(intent,code);pending=r}
    fun result(code:Int,status:Int,data:Intent?){if(code !in 710..712)return;val r=pending?:return;pending=null;val selected=data?.data;if(status!=Activity.RESULT_OK || selected==null){r.success(null);return};try{if(code==711){startExport(selected);r.success(null)}else if(code==712)relink(selected,r) else load(selected,r)}catch(ex:Exception){r.error("invalid",null,null)}}
    private fun relink(selected:Uri,r:MethodChannel.Result){working=true;io.execute{
        var acquired=false
        try {
            acquired=!context.contentResolver.persistedUriPermissions.any{it.uri==selected && it.isReadPermission}
            context.contentResolver.takePersistableUriPermission(selected,Intent.FLAG_GRANT_READ_URI_PERMISSION)
            val metadata=Source.inspect(context,selected);val project=store.relink(selected,metadata);projects.install(project)
            a.runOnUiThread{working=false;if(!closed){p=project;uri=selected;info=metadata;issue="";player.setMediaItem(MediaItem.fromUri(selected));player.prepare();player.seekTo(Clock.clips(project).first().n("inUs")/1000);r.success(state())}}
        }catch(ex:Exception){if(acquired)runCatching{context.contentResolver.releasePersistableUriPermission(selected,Intent.FLAG_GRANT_READ_URI_PERMISSION)};a.runOnUiThread{working=false;r.error(if(ex is IllegalArgumentException || ex is SecurityException)"invalid" else "save",ex.javaClass.simpleName,null)}}
    }}
    private fun load(selected:Uri?,r:MethodChannel.Result){working=true;io.execute{
        var project:JsonObject?=null;var acquired=false
        try {
            project=if(selected==null)store.restore() else null
            val src=selected?:project?.let(store::uri);val metadata=src?.let{Source.inspect(context,it)}
            if(selected!=null){acquired=!context.contentResolver.persistedUriPermissions.any{it.uri==selected && it.isReadPermission};context.contentResolver.takePersistableUriPermission(selected,Intent.FLAG_GRANT_READ_URI_PERMISSION);project=store.create(selected,requireNotNull(metadata));acquired=false}
            a.runOnUiThread{working=false;if(!closed){exporter.clearResult();p=project;projects.install(project);uri=src;info=metadata;issue="";if(src!=null){player.setMediaItem(MediaItem.fromUri(src));player.prepare();player.seekTo(Clock.clips(requireNotNull(project)).first().n("inUs")/1000)};r.success(state())}}
        }catch(ex:Exception){if(acquired && selected!=null)runCatching{context.contentResolver.releasePersistableUriPermission(selected,1)};a.runOnUiThread{working=false;if(!closed){if(selected==null){p=project;info=null;issue=if(project!=null)"missing" else "save"};r.error(if(selected!=null)"invalid" else issue,null,null)}}}
    }}
    private fun startExport(tree:Uri?){val clip=Clock.clips(requireNotNull(p)).singleOrNull() ?: error("multiExportUnavailable");exporter.start(requireNotNull(uri),clip.n("inUs"),clip.n("outUs"),requireNotNull(info),tree)}
    private fun state():Map<String,Any?> {val clips=p?.let(Clock::clips).orEmpty();val clip=clips.firstOrNull();return mapOf("clipCount" to clips.size,"playbackAvailable" to (clips.size<=1),"working" to working,"name" to p?.s("name"),"revision" to p?.n("revision"),"from" to clip?.n("inUs"),"to" to clip?.n("outUs"),"duration" to info?.duration,"w" to info?.displayWidth,"h" to info?.displayHeight,"rot" to info?.rotation,"fps" to info?.rate,"audio" to info?.audio,"position" to player.currentPosition*1000,"playing" to player.isPlaying,"issue" to if(issue.isNotEmpty())issue else if(clips.size>1)"multiPreviewUnavailable" else "","export" to exporter.state,"percent" to exporter.percent(),"destination" to exporter.destination,"renderedFrames" to renderedFrames.get(),"sourcePermissionPersisted" to (uri?.let{u->context.contentResolver.persistedUriPermissions.any{it.uri==u && it.isReadPermission}}?:false))}
    fun pause(){player.pause()}
    fun close(){closed=true;channel.setMethodCallHandler(null);projectChannel.setMethodCallHandler(null);player.release();exporter.close();io.shutdown()}
}
