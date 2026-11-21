package probe
import core.Engine
import kotlinx.serialization.json.*
import java.io.File

object Probe {
    @JvmStatic fun main(args:Array<String>) {
        val dir=File(args[0]);val engine=Engine(File(dir,"schema.json").readText());val cases=Json.parseToJsonElement(File(dir,"cases.json").readText()).jsonArray
        val rows=buildJsonObject {for(row in cases){val c=row.jsonObject;put(c.getValue("name").jsonPrimitive.content,Json.parseToJsonElement(engine.trace(c.getValue("input").jsonPrimitive.content,c.getValue("ops").toString())))}}
        File(args[1]).writeText(rows.toString())
    }
}
