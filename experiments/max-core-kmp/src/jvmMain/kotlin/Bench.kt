package probe
import core.*
import kotlinx.serialization.json.*
import java.io.File
object Bench {
    @JvmStatic fun main(args:Array<String>) {
        val dir=File(args[0]);val engine=Engine(File(dir,"schema.json").readText());val p=File(dir,"project.json").readText();val ops=File(dir,"bench-ops.json").readText();val r=Runtime.getRuntime()
        fun heap()=r.totalMemory()-r.freeMemory();
        repeat(3){engine.trace(p,ops)};System.gc();val before=heap();val elapsed=mutableListOf<Double>();var maxUsed=before
        repeat(15){val t=System.nanoTime();engine.trace(p,ops);elapsed.add((System.nanoTime()-t)/1e6);maxUsed=maxOf(maxUsed,heap())}
        File(args[1]).writeText(buildJsonObject{put("runtime",System.getProperty("java.runtime.version"));put("batchMs",JsonArray(elapsed.map{JsonPrimitive(it)}));put("heapBeforeBytes",before);put("heapMaxSampledAfterBatchBytes",maxUsed)}.toString())
    }
}
