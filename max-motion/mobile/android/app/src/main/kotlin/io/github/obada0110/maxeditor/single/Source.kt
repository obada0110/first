package io.github.obada0110.maxeditor.single

import android.content.Context
import android.media.MediaExtractor
import android.media.MediaFormat
import android.media.MediaMetadataRetriever
import android.net.Uri
import android.provider.OpenableColumns
import java.io.File
import java.util.UUID
import kotlinx.serialization.json.*
import maxeditor.contract.*

data class Source(val duration:Long, val width:Int, val height:Int, val rotation:Int, val rate:Int?, val audio:Boolean) {
    val displayWidth get()=if(rotation%180==0) width else height
    val displayHeight get()=if(rotation%180==0) height else width
    companion object {
        fun inspect(c:Context, uri:Uri):Source {
            val ex=MediaExtractor(); val meta=MediaMetadataRetriever()
            try {
                ex.setDataSource(c,uri,null); meta.setDataSource(c,uri)
                val tracks=(0 until ex.trackCount).map(ex::getTrackFormat)
                val video=tracks.first { it.getString(MediaFormat.KEY_MIME)?.startsWith("video/")==true }
                val dur=if(video.containsKey(MediaFormat.KEY_DURATION)) video.getLong(MediaFormat.KEY_DURATION) else (meta.extractMetadata(9)?.toLongOrNull()?:0L)*1000
                require(dur in 50_000..86_400_000_000L)
                return Source(dur,video.getInteger(MediaFormat.KEY_WIDTH),video.getInteger(MediaFormat.KEY_HEIGHT),meta.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_ROTATION)?.toIntOrNull()?:0,runCatching {video.getInteger(MediaFormat.KEY_FRAME_RATE)}.getOrNull(),tracks.any{it.getString(MediaFormat.KEY_MIME)?.startsWith("audio/")==true})
            } finally { ex.release(); meta.release() }
        }
    }
}

/** Binding contains only an asset-id -> SAF URI; all edit state lives in the v1 checkpoint. */
class SourceStore(private val c:Context) {
    private val validator=ProjectV1(c.assets.open("project-v1.json").bufferedReader().use{it.readText()})
    private val path=File(c.filesDir,"single-v1.json")
    private val disk=AtomicCheckpoint(path)
    private val bindings=c.getSharedPreferences("single_asset_uris",0)
    fun restore():JsonObject? = try {validator.parse(disk.read())} catch(e:java.io.FileNotFoundException){if(path.exists())throw e else null}
    fun uri(p:JsonObject):Uri=Uri.parse(requireNotNull(bindings.getString(Clock.clips(p).single().s("assetId"),null)))
    fun create(uri:Uri, info:Source):JsonObject {
        val id="a"+UUID.randomUUID(); val old=restore(); val oldId=old?.let{Clock.clips(it).single().s("assetId")}; val oldUri=old?.let{uri(it)}
        val name=c.contentResolver.query(uri,arrayOf(OpenableColumns.DISPLAY_NAME),null,null,null)?.use {if(it.moveToFirst())it.getString(0) else null}?.take(120)?.ifBlank{null}?:"Video"
        val scale=minOf(1.0,3840.0/maxOf(info.displayWidth,info.displayHeight));fun side(n:Int)=((n*scale).toInt()/2*2).coerceIn(64,3840)
        val base=buildJsonObject{ mapOf("x" to 50,"y" to 50,"w" to 100,"h" to 100,"angle" to 0,"opacity" to 100,"cropX" to 0,"cropY" to 0).forEach{(k,v)->put(k,v)} }
        val p=buildJsonObject {
            put("schemaVersion",1);put("revision",0);put("projectId","p"+UUID.randomUUID());put("name",name)
            putJsonObject("canvas"){put("width",side(info.displayWidth));put("height",side(info.displayHeight));put("background","#000000")}
            putJsonObject("fps"){put("num",info.rate?.takeIf{it in listOf(24,30,60)}?:30);put("den",1)}
            putJsonArray("assets"){addJsonObject{put("id",id);put("kind","video");put("durationUs",info.duration)}}
            putJsonObject("mainTrack"){put("id","main");putJsonArray("clips"){addJsonObject{put("id","clip");put("assetId",id);put("inUs",0);put("outUs",info.duration);putJsonObject("transform"){put("base",base);putJsonArray("keys") {}};putJsonObject("effects") {}}}}
            putJsonArray("layers"){}
        }
        validator.parse(p.toString());check(bindings.edit().putString(id,uri.toString()).commit());disk.write(p.toString())
        if(oldId!=null){bindings.edit().remove(oldId).apply();if(oldUri!=uri && oldUri!=null)runCatching{c.contentResolver.releasePersistableUriPermission(oldUri,1)}}
        return p
    }
    fun range(p:JsonObject,start:Long,end:Long):JsonObject {
        val duration=p.items("assets").single().n("durationUs");require(start>=0 && end<=duration && end-start>=50_000 && (start==0L || start>=50_000) && (end==duration || duration-end>=50_000))
        val clip=Clock.clips(p).single().with("inUs",JsonPrimitive(start)).with("outUs",JsonPrimitive(end));val track=p.getValue("mainTrack").jsonObject.with("clips",JsonArray(listOf(clip)))
        val next=validator.parse(p.with("mainTrack",track).with("revision",JsonPrimitive(p.n("revision")+1)).toString());disk.write(next.toString());return next
    }
}
