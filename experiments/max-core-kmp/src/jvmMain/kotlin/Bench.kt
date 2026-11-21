package probe

import core.Handle
import kotlinx.serialization.json.*
import java.io.File

object Bench {
    @JvmStatic fun main(args:Array<String>) {
        val dir=File(args[0]);val schema=File(dir,"schema.json").readText()
        val commands=Json.parseToJsonElement(File(dir,"bench-ops.json").readText()).jsonArray.map {it.toString()}
        val r=Runtime.getRuntime(); fun heap()=r.totalMemory()-r.freeMemory()
        val report=buildJsonObject {
            put("runtime",System.getProperty("java.runtime.version"));put("commandsPerBatch",commands.size)
            for(file in listOf("project.json","large.json")) {
                val project=File(dir,file).readText();val times=mutableListOf<Double>();val heaps=mutableListOf<Long>()
                repeat(18){i->
                    val session=Handle(schema,project);if(i==3)System.gc();val before=heap()
                    val start=System.nanoTime();var revision="";for(op in commands)revision=session.edit(op)
                    val end=System.nanoTime();val after=heap();check(revision==commands.size.toString())
                    if(i>=3){times.add((end-start)/1e6);heaps.add(after-before)}
                }
                putJsonObject(file){put("batchMs",JsonArray(times.map{JsonPrimitive(it)}));put("heapDeltaBytes",JsonArray(heaps.map{JsonPrimitive(it)}))}
            }
        }; File(args[1]).writeText(report.toString())
    }
}
