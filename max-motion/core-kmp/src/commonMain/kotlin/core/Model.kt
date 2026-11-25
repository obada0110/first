// Sandbox-only port of v1 validator and clock, baseline 7c13420. No production dependency.
package core

import kotlinx.serialization.json.*

private const val DAY = 86_400_000_000L
private const val SECOND = 1_000_000L
internal fun JsonObject.n(key: String) = getValue(key).jsonPrimitive.long
internal fun JsonObject.s(key: String) = getValue(key).jsonPrimitive.content
internal fun JsonObject.items(key: String) = getValue(key).jsonArray.map { it.jsonObject }
internal fun JsonObject.with(key: String, value: JsonElement) = JsonObject(this + (key to value))

/** Only the vocabulary used by the bundled v1 schema; not a general JSON Schema service. */
class ProjectV1(schemaText: String) {
    private val schema = Json.parseToJsonElement(schemaText).jsonObject
    private fun matches(v: JsonElement, r: JsonObject): Boolean {
        r["\$ref"]?.let { return matches(v, schema.getValue("\$defs").jsonObject.getValue(it.jsonPrimitive.content.substringAfterLast('/')).jsonObject) }
        r["oneOf"]?.let { return it.jsonArray.count { branch -> matches(v, branch.jsonObject) } == 1 }
        r["enum"]?.let { return v in it.jsonArray }
        return when (r.s("type")) {
            "object" -> if (v !is JsonObject) false else {
                val props = r.getValue("properties").jsonObject
                r["required"]?.jsonArray.orEmpty().all { it.jsonPrimitive.content in v } &&
                    v.all { (k, x) -> props[k]?.let { matches(x, it.jsonObject) } == true }
            }
            "array" -> v is JsonArray && v.size >= r.n("minItems") && v.all { matches(it, r.getValue("items").jsonObject) }
            "string" -> if (v !is JsonPrimitive || !v.isString) false else {
                val text = v.content
                val size = text.length - (1 until text.length).count { text[it].isLowSurrogate() && text[it-1].isHighSurrogate() }
                size >= (r["minLength"]?.jsonPrimitive?.int ?: 0) && size <= (r["maxLength"]?.jsonPrimitive?.int ?: Int.MAX_VALUE) &&
                    (r["pattern"]?.let { Regex(it.jsonPrimitive.content).matches(text) } ?: true)
            }
            "integer", "number" -> v is JsonPrimitive && !v.isString &&
                (r.s("type") != "integer" || v.longOrNull != null) &&
                v.doubleOrNull?.let { it in r.getValue("minimum").jsonPrimitive.double..r.getValue("maximum").jsonPrimitive.double } == true
            else -> error("Unsupported schema vocabulary")
        }
    }

    fun parse(text: String): JsonObject {
        strictDocument(text)
        val p = Json.parseToJsonElement(text).jsonObject
        require(matches(p, schema)) { "Invalid v1 structure, field, effect or version" }
        val canvas = p.getValue("canvas").jsonObject
        require(canvas.n("width") % 2 == 0L && canvas.n("height") % 2 == 0L)
        val ids = mutableSetOf(p.s("projectId"))
        fun unique(o: JsonObject) = require(ids.add(o.s("id"))) { "DUPLICATE_ID" }
        fun keys(o: JsonObject, limit: Long) {
            var previous = -1L
            for (k in o.getValue("transform").jsonObject.items("keys")) {
                val t = k.n("atUs"); require(t > previous && t <= limit) { "KEY_CLOCK" }; previous = t
            }
        }
        val assets = p.items("assets").associateBy { a ->
            unique(a); require((a.s("kind") == "image") == (a.n("durationUs") == 0L)); a.s("id")
        }
        val track = p.getValue("mainTrack").jsonObject; unique(track)
        var length = 0L
        for (c in track.items("clips")) {
            unique(c); val a = requireNotNull(assets[c.s("assetId")]) { "MISSING_ASSET" }; require(a.s("kind") == "video")
            require(c.n("inUs") < c.n("outUs") && c.n("outUs") <= a.n("durationUs")); keys(c, a.n("durationUs"))
            length += c.n("outUs") - c.n("inUs"); require(length <= DAY)
        }
        for (l in p.items("layers")) {
            unique(l); require(l.n("startUs") + l.n("durationUs") <= DAY); keys(l,l.n("durationUs"))
            if (l.s("kind") == "overlay") {
                val a = requireNotNull(assets[l.s("assetId")]) { "MISSING_ASSET" }; require(a.s("kind") == "image" || l.n("durationUs") <= a.n("durationUs"))
            }
        }
        return p
    }
}

object Clock {
    fun clips(p: JsonObject) = p.getValue("mainTrack").jsonObject.items("clips")
    fun duration(p: JsonObject) = clips(p).sumOf { it.n("outUs") - it.n("inUs") }
    fun locate(p: JsonObject, t: Long): Pair<Int, Long>? {
        if (t < 0) return null
        var start = 0L
        for ((i,c) in clips(p).withIndex()) {
            val end = start + c.n("outUs") - c.n("inUs")
            if (t < end) return i to (c.n("inUs") + t - start)
            start = end
        }
        return null
    }
    fun frameCount(p: JsonObject): Long {
        val f = p.getValue("fps").jsonObject; val scale = SECOND * f.n("den")
        return (duration(p) * f.n("num") + scale - 1) / scale
    }
    fun pts(f: JsonObject, frame: Long): Long {
        require(frame in 0..5_184_000L) // max 24 hours at 60 fps
        return frame * SECOND * f.n("den") / f.n("num")
    }
    fun valueAt(tr: JsonObject, t: Long, field: String): Double {
        val keys = tr.items("keys")
        fun value(o: JsonObject) = o.getValue("value").jsonObject.getValue(field).jsonPrimitive.double
        if (keys.isEmpty()) return tr.getValue("base").jsonObject.getValue(field).jsonPrimitive.double
        val i = keys.indexOfFirst { it.n("atUs") >= t }
        if (i < 0) return value(keys.last()); if (i == 0) return value(keys.first())
        val a = keys[i-1]; val b = keys[i]
        return value(a) + (value(b)-value(a)) * (t-a.n("atUs")).toDouble() / (b.n("atUs")-a.n("atUs"))
    }
}

