package maxeditor.contract

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import kotlinx.serialization.json.*
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File
import java.io.IOException

@RunWith(AndroidJUnit4::class)
class ContractTest {
    private val device = InstrumentationRegistry.getInstrumentation()
    private fun asset(name: String) = device.context.assets.open(name).bufferedReader().use { it.readText() }
    private val codec = ProjectV1(asset("project-v1.json"))
    private val input = asset("project.json")
    private val original = codec.parse(input)
    private val gold = Json.parseToJsonElement(asset("vectors.json")).jsonObject
    private val cmd = gold.getValue("split").jsonObject
    private fun split(s: EditSession) = s.cut(s.revision,Cut.SPLIT,cmd.s("id"),cmd.n("timeUs"),cmd.s("rightId"))
    private fun ranges(p: JsonObject) = JsonArray(Clock.clips(p).map { JsonArray(listOf(it.getValue("inUs"),it.getValue("outUs"))) })
    private fun samePayload(a: JsonObject,b: JsonObject) = assertEquals(a - "revision",b - "revision")
    private fun rejected(block: () -> Unit) { try { block(); fail("Invalid data accepted") } catch (_: IllegalArgumentException) {} }

    @Test fun sharedGoldenClockAndLayers() {
        assertEquals(gold.n("durationUs"),Clock.duration(original)); assertEquals(gold.n("frames"),Clock.frameCount(original))
        assertNull(Clock.locate(original,-1)); assertNull(Clock.locate(original,Clock.duration(original)))
        for (sample in gold.getValue("frameSamples").jsonArray) {
            val pair=sample.jsonArray; assertEquals(pair[1].jsonPrimitive.long,Clock.pts(original.getValue("fps").jsonObject,pair[0].jsonPrimitive.long))
        }
        for(v in gold.items("samples")) {
            val t=v.n("timeUs"); val (i,source)=Clock.locate(original,t)!!
            assertEquals(v.n("index").toInt(),i); assertEquals(v.n("sourceUs"),source)
            assertEquals(v.n("x").toDouble(),Clock.valueAt(Clock.clips(original)[i].getValue("transform").jsonObject,source,"x"),1e-9)
            val layers=original.items("layers").filter { t in it.n("startUs") until it.n("startUs")+it.n("durationUs") }
            assertEquals(v.getValue("layers").jsonArray.map { it.jsonPrimitive.content },layers.map { it.s("id") })
            layers.firstOrNull { it.s("kind")=="text" }?.let { assertEquals(v.n("titleX").toDouble(),Clock.valueAt(it.getValue("transform").jsonObject,t-it.n("startUs"),"x"),1e-9) }
        }
    }

    @Test fun splitUndoRedoAndDurableRestore() {
        val dir=File(device.targetContext.filesDir,"contract-test-${System.nanoTime()}"); check(dir.mkdir())
        try {
            val disk=AtomicCheckpoint(File(dir,"project.json")); disk.write(input)
            val s=EditSession(codec,disk.read(),disk::write); assertEquals(gold["rangesBefore"],ranges(original)); split(s)
            val after=codec.parse(s.snapshot); assertEquals(gold["rangesAfter"],ranges(after))
            assertEquals(original["layers"],after["layers"]); assertEquals(Clock.duration(original),Clock.duration(after))
            for (i in 1..2) for (field in listOf("effects","transform","assetId")) assertEquals(Clock.clips(original)[1][field],Clock.clips(after)[i][field])
            assertEquals("cB",Clock.clips(after)[2].s("id")); assertEquals(2 to 6000000L,Clock.locate(after,3000000))
            s.undo(1); samePayload(original,codec.parse(s.snapshot)); s.redo(2); samePayload(after,codec.parse(s.snapshot))
            val restored=EditSession(codec,AtomicCheckpoint(File(dir,"project.json")).read(),disk::write)
            assertEquals(s.snapshot,restored.snapshot); assertEquals(3L,restored.revision); rejected {restored.undo(3)}
        } finally {dir.deleteRecursively()}
    }

    @Test fun trimsRippleDeleteAndDiscardRedo() {
        val s=EditSession(codec,input){}; s.cut(0,Cut.TRIM_LEFT,"cA",3000000)
        assertEquals(6000000L,Clock.clips(codec.parse(s.snapshot))[1].n("inUs")); s.undo(1)
        s.cut(2,Cut.TRIM_RIGHT,"cA",3000000); assertEquals(3000000L,Clock.duration(codec.parse(s.snapshot))); rejected {s.redo(3)}
        s.cut(3,Cut.DELETE,"intro"); val p=codec.parse(s.snapshot); assertEquals(1000000L,Clock.duration(p)); assertEquals(original["layers"],p["layers"])
        rejected {s.cut(4,Cut.DELETE,"cA")}; assertEquals(4L,s.revision)
    }

    @Test fun invalidCommandIsAtomic() {
        val s=EditSession(codec,input){};val before=s.snapshot
        for(t in listOf(2000000L,2049999L,5950001L,6000000L)) rejected {s.cut(0,Cut.SPLIT,"cA",t,"right")}
        rejected {s.cut(0,Cut.SPLIT,"cA",3000000,"intro")}; rejected {s.cut(9,Cut.DELETE,"intro")}
        assertEquals(before,s.snapshot); rejected {s.undo(0)}; s.cut(0,Cut.SPLIT,"cA",2050000,"right"); assertEquals(1L,s.revision)
    }

    @Test fun failedSavePreservesBothHistoryAndRevision() {
        var broken=false; val s=EditSession(codec,input){if(broken)throw IOException("simulated full volume")};split(s);val before=s.snapshot
        broken=true;try {s.undo(1);fail()}catch(_:IOException){};assertEquals(before,s.snapshot);broken=false;s.undo(1);samePayload(original,codec.parse(s.snapshot))
        broken=true;try{s.cut(2,Cut.DELETE,"intro");fail()}catch(_:IOException){};broken=false;s.redo(2);samePayload(codec.parse(before),codec.parse(s.snapshot))
    }

    @Test fun rejectMalformedProjects() {
        val track=original.getValue("mainTrack").jsonObject;val c=Clock.clips(original)[1]
        fun change(c2:JsonObject)=original.with("mainTrack",track.with("clips",JsonArray(listOf(Clock.clips(original)[0],c2))))
        val bad=listOf(original.with("schemaVersion",JsonPrimitive(2)),original.with("typo",JsonNull),original.with("fps",buildJsonObject {put("num",30);put("den",0)}),
            change(c.with("id",JsonPrimitive("title"))),change(c.with("assetId",JsonPrimitive("unknown"))),change(c.with("outUs",JsonPrimitive(300L))),change(c.with("outUs",JsonPrimitive(10000001))),
            change(c.with("inUs",JsonPrimitive("5000000"))),change(c.with("effects",buildJsonObject{put("fake",JsonObject(emptyMap()))})),
            change(c.with("transform",c.getValue("transform").jsonObject.let {it.with("keys",JsonArray(it.getValue("keys").jsonArray.reversed()))})))
        for(p in bad) rejected {codec.parse(p.toString())}
    }
}
