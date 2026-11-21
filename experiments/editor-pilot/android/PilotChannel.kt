package io.github.obada0110.maxeditor
import android.content.Context
import android.util.AtomicFile
import io.flutter.plugin.common.MethodChannel
import io.flutter.plugin.common.StandardMethodCodec
import io.flutter.plugin.common.BinaryMessenger
import integration.Port
import org.json.JSONObject
import java.io.File

/** No SingleChannel, SourceStore, URI grant or production checkpoint is used by this port. */
class PilotChannel(ctx:Context, messenger:BinaryMessenger){
    private val schema=ctx.assets.open("project-v1.json").bufferedReader().use{it.readText()}
    private val seed=ctx.assets.open("pilot.json").bufferedReader().use{it.readText()}
    private val file=AtomicFile(File(ctx.filesDir,"pilot-v2.json"));private var port=Port(schema)
    private fun call(method:String,data:Any)=port.call(JSONObject().put("api",2).put("method",method).put("data",data).toString())
    private fun open(text:String):String{val n=Port(schema);val r=n.call(JSONObject().put("api",2).put("method","open").put("data",text).toString());if(JSONObject(r).getBoolean("ok")){require(JSONObject(text).getString("projectId")=="parity");port=n};return r}
    init{MethodChannel(messenger,"max_editor/fixture_pilot",StandardMethodCodec.INSTANCE,messenger.makeBackgroundTaskQueue()).setMethodCallHandler{c,r->try{val result=when(c.method){
        "seed"->open(seed);"import"->open(c.arguments as String);"restore"->open(file.readFully().decodeToString());"call"->port.call(c.arguments as String)
        "save"->{val raw=JSONObject(call("snapshot",JSONObject.NULL)).getString("value");val out=file.startWrite();try{out.write(raw.encodeToByteArray());file.finishWrite(out)}catch(e:Exception){file.failWrite(out);throw e};raw};else->error("UNKNOWN_METHOD")};r.success(result)}catch(e:Exception){r.error("LAB_IO",e.message,null)}}}
}
