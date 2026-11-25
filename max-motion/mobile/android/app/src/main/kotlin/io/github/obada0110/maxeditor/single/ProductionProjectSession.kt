package io.github.obada0110.maxeditor.single

import core.ProjectV1
import core.Session
import kotlinx.serialization.json.*
import maxeditor.contract.Clock

/** Project-only coordinator: v1 validation, revisions, edit history and durable ACKs. No views or media player. */
internal class ProductionProjectSession(
    private val store: SourceStore,
    schema: String,
    private val enabled: Boolean,
) {
    private val validator = ProjectV1(schema)
    @Volatile private var active: Session? = null

    fun isEnabled() = enabled
    fun install(project: JsonObject?) {
        active = if (enabled && project != null) Session(validator, project.toString()) { raw ->
            store.save(Json.parseToJsonElement(raw).jsonObject)
        } else null
    }
    fun snapshot(): String? = active?.state?.toString()

    fun edit(raw: String): String {
        check(enabled) { "FEATURE_DISABLED" }
        val session = requireNotNull(active) { "NO_PROJECT" }
        session.apply(Json.parseToJsonElement(raw).jsonObject)
        return session.state.toString()
    }

    fun trimRange(fromUs: Long, toUs: Long, expectedRevision: Long): JsonObject {
        val session = requireNotNull(active) { "NO_PROJECT" }
        val clip = Clock.clips(session.state).first()
        session.apply(buildJsonObject {
            put("op", "trimRange"); put("id", clip.getValue("id").jsonPrimitive.content)
            put("fromUs", fromUs); put("toUs", toUs); put("expectedRevision", expectedRevision)
        })
        return session.state
    }

    fun reopen(): JsonObject {
        check(enabled) { "FEATURE_DISABLED" }
        val project = requireNotNull(store.restore()) { "NO_PROJECT" }
        val replacement = Session(validator, project.toString()) { raw ->
            store.save(Json.parseToJsonElement(raw).jsonObject)
        }
        active = replacement // a new open is a deliberate empty-history boundary
        return replacement.state
    }
}
