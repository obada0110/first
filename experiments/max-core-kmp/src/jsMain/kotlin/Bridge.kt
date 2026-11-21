@file:OptIn(kotlin.js.ExperimentalJsExport::class)
import core.Engine

@JsExport
class MaxCore(schema:String) {
    private val engine=Engine(schema)
    fun trace(project:String, commands:String):String = engine.trace(project,commands)
}

@JsExport
class MaxSession(schema:String, project:String) {
    private val handle=core.Handle(schema,project)
    fun snapshot()=handle.snapshot()
    fun edit(command:String)=handle.edit(command)
    fun render(ptsUs:String)=handle.render(ptsUs)
}
