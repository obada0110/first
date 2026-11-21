package integration

import core.*
import kotlinx.serialization.json.*

// Transport v1. One host-owned, single-writer, in-memory session per Port.
class Port(private val trustedSchema: String) {
    private var session: Session? = null
    private val revision get() = session?.state?.get("revision") ?: JsonNull
    private val codes = setOf("BAD_API", "BAD_REQUEST", "NOT_OPEN", "ALREADY_OPEN", "BAD_METHOD",
        "INVALID_PROJECT", "TOO_LARGE", "DUPLICATE_FIELD", "DUPLICATE_ID", "MISSING_ASSET", "KEY_CLOCK",
        "STALE_REVISION", "REVISION_LIMIT", "UNKNOWN_OP", "UNKNOWN_ID", "CUT_MARGIN", "TIME_RANGE",
        "LAST_CLIP", "BAD_ORDER", "NO_KEY", "UNDO_EMPTY", "REDO_EMPTY")
    private fun response(ok: Boolean, value: JsonElement, error: JsonElement) = buildJsonObject {
        put("api", 1); put("ok", ok); put("revision", revision); put("value", value); put("error", error)
    }.toString()
    fun call(raw: String): String {
        var fallback = "BAD_REQUEST"
        return try {
            require(raw.length <= 2_000_000) { "TOO_LARGE" }; strictDocument(raw)
            val r = Json.parseToJsonElement(raw).jsonObject
            require(r.keys == setOf("api", "method", "data")); require(r["api"] == JsonPrimitive(1)) { "BAD_API" }
            val method = r.getValue("method").jsonPrimitive; require(method.isString)
            val data = r.getValue("data")
            val value = when (method.content) {
                "open" -> {
                    require(session == null) { "ALREADY_OPEN" }; require(data.jsonPrimitive.isString)
                    fallback = "INVALID_PROJECT"
                    session = Session(ProjectV1(trustedSchema), data.jsonPrimitive.content); JsonNull
                }
                "edit", "snapshot", "render" -> {
                    val active = requireNotNull(session) { "NOT_OPEN" }
                    when (method.content) {
                        "edit" -> {
                            val cmd = data.jsonObject
                            if (cmd["op"] == JsonPrimitive("order")) require(cmd.getValue("ids").jsonArray.all { it.jsonPrimitive.isString })
                            active.apply(cmd); JsonNull
                        }
                        "render" -> {
                            val t = data.jsonPrimitive; require(!t.isString)
                            scene(active.state, t.long.also { require(it in -86400000000L..86400000000L) })
                        }
                        else -> { require(data == JsonNull); JsonPrimitive(active.state.toString()) }
                    }
                }
                else -> throw IllegalArgumentException("BAD_METHOD")
            }; response(true, value, JsonNull)
        } catch (e: Exception) {
            response(false, JsonNull, JsonPrimitive(e.message?.takeIf { it in codes } ?: fallback))
        }
    }
}
