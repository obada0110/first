package coretests

import core.*
import kotlinx.serialization.json.*
import java.io.File

/** Production operation semantics + durable-writer failure gate; run on the actual KMP JVM artifact. */
object ProductionOps {
 @JvmStatic fun main(args:Array<String>) {
  val schema=File(args[0]).readText();val project=File(args[1]).readText();val validator=ProjectV1(schema);var disk=validator.parse(project).toString();val rows=mutableListOf<String>()
  val session=Session(validator,disk){candidate->disk=validator.parse(candidate).toString()}
  fun apply(op:String,vararg args:Pair<String,JsonElement>){val c=buildJsonObject{put("op",op);put("expectedRevision",session.state.n("revision"));for((k,v) in args)put(k,v)};session.apply(c);check(disk==session.state.toString());validator.parse(disk);rows+=op}
  val source=Clock.clips(session.state).first{it.s("id")=="cA"};apply("addClip","clip" to (source.with("id",JsonPrimitive("newClip"))))
  apply("trimRight","id" to JsonPrimitive("newClip"),"atUs" to JsonPrimitive(8_000_000))
  apply("split","id" to JsonPrimitive("newClip"),"atUs" to JsonPrimitive(7_000_000),"rightId" to JsonPrimitive("splitClip"))
  apply("orderClips","ids" to JsonArray(Clock.clips(session.state).reversed().map{JsonPrimitive(it.s("id"))}))
  apply("undo");apply("redo");apply("delete","id" to JsonPrimitive("splitClip"))
  val before=session.state.toString();try{session.apply(buildJsonObject{put("op","undo");put("expectedRevision",0)});error("stale command unexpectedly succeeded")}catch(e:IllegalArgumentException){check(e.message=="STALE_REVISION")};check(session.state.toString()==before && disk==before)
  val restored=Session(validator,disk);try{restored.apply(buildJsonObject{put("op","undo");put("expectedRevision",restored.state.n("revision"))});error("history survived restore")}catch(e:IllegalArgumentException){check(e.message=="UNDO_EMPTY")}
  val failedDisk=disk;val durable=Session(validator,disk){throw IllegalStateException("disk-full")};val initial=durable.state.toString()
  try{durable.apply(buildJsonObject{put("op","addClip");put("expectedRevision",durable.state.n("revision"));put("clip",Clock.clips(durable.state).first().with("id",JsonPrimitive("notPublished")))});error("failed save acknowledged")}catch(e:IllegalStateException){check(e.message=="disk-full")};check(durable.state.toString()==initial && failedDisk==disk)
  println(buildJsonObject{put("passed",true);put("schemaVersion",1);put("durableAck",true);put("failedSaveLeavesStateAndHistory",true);put("undoResetsOnRestore",true);put("operations",JsonArray(rows.map { JsonPrimitive(it) }));put("finalRevision",session.state.n("revision"))})
 }
}
