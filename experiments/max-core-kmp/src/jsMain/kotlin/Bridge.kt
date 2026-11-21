@file:OptIn(kotlin.js.ExperimentalJsExport::class)
import core.Engine

@JsExport
class MaxCore(schema:String) {
    private val engine=Engine(schema)
    fun trace(project:String, commands:String):String = engine.trace(project,commands)
}
