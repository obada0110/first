package io.github.obada0110.maxeditor.single

import android.content.*
import android.net.Uri
import android.os.*
import android.provider.*
import android.media.MediaMetadataRetriever
import androidx.media3.common.*
import androidx.media3.transformer.*
import java.io.*
import java.util.UUID
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

/** Transform to private scratch, verify, then publish. Never open the source for writing. */
class Export(private val c:Context) {
    private val main=Handler(Looper.getMainLooper());private val worker=Executors.newSingleThreadExecutor()
    private var transformer:Transformer?=null;private var scratch:File?=null
    private var stopped=AtomicBoolean();private var copying=false
    var state="idle";private set
    var destination="";private set
    private val holder=ProgressHolder()
    val busy get()=state=="exporting" || state=="publishing"
    fun percent():Int?=if(transformer?.getProgress(holder)==Transformer.PROGRESS_STATE_AVAILABLE) holder.progress else null
    init {c.cacheDir.listFiles()?.filter{it.name.startsWith("mx-clip-") && it.lastModified()<System.currentTimeMillis()-86400000}?.forEach{it.delete()}}
    fun start(uri:Uri,from:Long,to:Long,info:Source,tree:Uri?) {
        check(!busy);destination="";stopped=AtomicBoolean();val flag=stopped
        if(c.cacheDir.usableSpace<1024*1024){state="space";return}
        val tmp=try {File.createTempFile("mx-clip-",".mp4",c.cacheDir)} catch(e:IOException){state=failure(e);return}
        scratch=tmp;state="exporting"
        try {
            val clip=MediaItem.ClippingConfiguration.Builder().setStartPositionUs(from).setEndPositionUs(to).build()
            val tr=Transformer.Builder(c).setVideoMimeType(MimeTypes.VIDEO_H264).setAudioMimeType(MimeTypes.AUDIO_AAC).addListener(object:Transformer.Listener{
                override fun onCompleted(composition:Composition,exportResult:ExportResult){
                    if(flag.get())return
                    transformer=null;copying=true;state="publishing"
                    worker.execute {
                        var target:Uri?=null;var published=false
                        try {
                            val fileUri=Uri.fromFile(tmp);val result=Source.inspect(c,fileUri)
                            check(result.audio==info.audio && kotlin.math.abs(result.duration-(to-from))<maxOf(150000L,2_000_000L/(info.rate?:24)))
                            // The codec may bake the rotation into pixels or retain a rotation tag.
                            val aspect=result.displayWidth.toDouble()/result.displayHeight
                            check(kotlin.math.abs(aspect/(info.displayWidth.toDouble()/info.displayHeight)-1.0)<0.03)
                            val retriever=MediaMetadataRetriever();try{retriever.setDataSource(tmp.path);checkNotNull(retriever.getFrameAtTime(0,MediaMetadataRetriever.OPTION_CLOSEST_SYNC)).recycle()}finally{retriever.release()}
                            check(!flag.get());val name="MAX-${UUID.randomUUID()}.mp4"
                            val resolver=c.contentResolver
                            target=if(Build.VERSION.SDK_INT>=29) checkNotNull(resolver.insert(MediaStore.Video.Media.EXTERNAL_CONTENT_URI,ContentValues().apply {put(MediaStore.MediaColumns.DISPLAY_NAME,name);put(MediaStore.MediaColumns.MIME_TYPE,"video/mp4");put(MediaStore.MediaColumns.RELATIVE_PATH,"Movies/MAX EDITOR");put(MediaStore.MediaColumns.IS_PENDING,1)})) else {
                                val dir=requireNotNull(tree);checkNotNull(DocumentsContract.createDocument(resolver,DocumentsContract.buildDocumentUriUsingTree(dir,DocumentsContract.getTreeDocumentId(dir)),"video/mp4",name))
                            }
                            checkNotNull(resolver.openOutputStream(target,"w")).use{out->tmp.inputStream().use{input->val buf=ByteArray(128*1024);while(true){check(!flag.get());val n=input.read(buf);if(n<0)break;out.write(buf,0,n)}}}
                            synchronized(flag){check(!flag.get());if(Build.VERSION.SDK_INT>=29)check(resolver.update(target,ContentValues().apply{put(MediaStore.MediaColumns.IS_PENDING,0)},null,null)==1);published=true}
                            main.post{destination=if(Build.VERSION.SDK_INT>=29)"Movies/MAX EDITOR/$name" else name;state="done"}
                        }catch(e:Exception){if(target!=null && !published)runCatching{if(Build.VERSION.SDK_INT>=29)c.contentResolver.delete(target,null,null) else DocumentsContract.deleteDocument(c.contentResolver,target)};main.post{state=if(flag.get())"cancelled" else failure(e)}}finally{tmp.delete();main.post{copying=false;scratch=null}}
                    }
                }
                override fun onError(composition:Composition,exportResult:ExportResult,exportException:ExportException){transformer=null;tmp.delete();state=failure(exportException)}
            }).build();transformer=tr;tr.start(MediaItem.Builder().setUri(uri).setClippingConfiguration(clip).build(),tmp.path)
        }catch(e:Exception){transformer=null;tmp.delete();state=failure(e)}
    }
    private fun failure(e:Throwable):String {android.util.Log.w("MaxExport","Export failed",e);return if(generateSequence(e){it.cause}.any{it.message?.contains("ENOSPC")==true || it.message?.contains("No space left",true)==true} || c.cacheDir.usableSpace<1024*1024)"space" else "exportError"}
    fun cancel(){if(!busy)return;synchronized(stopped){stopped.set(true)};if(!copying){transformer?.cancel();transformer=null;scratch?.delete();state="cancelled"}}
    fun clearResult(){if(!busy){state="idle";destination=""}}
    fun close(){cancel();worker.shutdown()}
}
