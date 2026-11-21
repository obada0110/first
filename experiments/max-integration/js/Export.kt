@file:OptIn(ExperimentalJsExport::class)
import integration.Port
@JsExport
class EditorPort(schema: String) {
    private val port = Port(schema)
    fun call(json: String) = port.call(json)
}
