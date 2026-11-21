package core

import kotlinx.serialization.json.*

private val fxOrder = listOf("key","blur","motion","temp","light","contrast","sat","glow","rain","frost")
private val fields = listOf("x","y","w","h","angle","opacity","cropX","cropY")
private val stableErrors = setOf("DUPLICATE_ID","DUPLICATE_FIELD","KEY_CLOCK","MISSING_ASSET","STALE_REVISION","UNKNOWN_ID","CUT_MARGIN","TIME_RANGE","LAST_CLIP","BAD_ORDER","NO_KEY","UNDO_EMPTY","REDO_EMPTY","UNKNOWN_OP","REVISION_LIMIT")
private fun obj(p:JsonObject,k:String) = p.getValue(k).jsonObject
private fun layers(p:JsonObject)=p.items("layers")
private fun track(p:JsonObject, clips:List<JsonObject>) = p.with("mainTrack",obj(p,"mainTrack").with("clips",JsonArray(clips)))
private fun pose(item:JsonObject,time:Long)=buildJsonObject { for(k in fields) put(k,Clock.valueAt(obj(item,"transform"),time,k)) }

/** Render intent only. No decoding, pixel rendering, file or clock IO. */
fun scene(p:JsonObject, pts:Long):JsonElement {
    val (index,src)=Clock.locate(p,pts) ?: return JsonNull
    val clip=Clock.clips(p)[index]; val fx=obj(clip,"effects")
    return buildJsonObject {
        put("renderSpecVersion",1);put("projectId",p.s("projectId"));put("revision",p.n("revision"));put("ptsUs",pts)
        put("canvas",p.getValue("canvas"));put("fps",p.getValue("fps"))
        putJsonObject("primary") {
            put("clipId",clip.s("id"));put("assetId",clip.s("assetId"));put("sourceUs",src);put("pose",pose(clip,src))
            put("audioPolicy","source-if-present");putJsonArray("effects") { for(id in fxOrder) fx[id]?.let { add(buildJsonObject { put("id",id);put("params",it) }) } }
        }
        putJsonArray("layers") { for(l in layers(p)) {
            val local=pts-l.n("startUs"); if(local !in 0 until l.n("durationUs")) continue
            add(buildJsonObject { for(k in listOf("id","kind","assetId","text","color","font","effect")) l[k]?.let { put(k,it) }
                put("localUs",local);put("pose",pose(l,local));if(l.s("kind")=="overlay") put("audioPolicy","mute") })
        } }
    }
}

/** One in-memory writer. All candidate states validated before changing state or history. */
class Session(private val validator:ProjectV1, initial:String) {
    var state=validator.parse(initial); private set
    private val past=ArrayDeque<JsonObject>(); private val future=ArrayDeque<JsonObject>()
    fun apply(c:JsonObject) {
        fun stringField(k:String) = c[k]?.jsonPrimitive?.isString == true
        require(stringField("op"));val op=c.s("op")
        val args=when(op){"split"->setOf("id","atUs","rightId");"trimLeft","trimRight","putKey","removeKey"->if(op=="putKey")setOf("id","atUs","value") else setOf("id","atUs");"delete"->setOf("id");"order"->setOf("ids");"undo","redo"->emptySet();else->throw IllegalArgumentException("UNKNOWN_OP")}
        require(c.keys==args+setOf("op","expectedRevision"));for(k in listOf("expectedRevision","atUs")) c[k]?.let {require(!it.jsonPrimitive.isString && it.jsonPrimitive.longOrNull!=null)}
        for(k in listOf("id","rightId")) if(k in args)require(stringField(k))
        val p=state; val rev=p.n("revision"); require(c.n("expectedRevision")==rev){"STALE_REVISION"};require(rev<9007199254740991L){"REVISION_LIMIT"}
        val clips=Clock.clips(p).toMutableList();val ls=layers(p).toMutableList()
        val candidate=when(op){
            "split","trimLeft","trimRight","delete" -> {
                val idx=clips.indexOfFirst{it.s("id")==c.s("id")};require(idx>=0){"UNKNOWN_ID"};val old=clips[idx]
                if(op=="delete"){require(clips.size>1){"LAST_CLIP"};clips.removeAt(idx)} else {
                    val hit=Clock.locate(p,c.n("atUs"));require(hit!=null && hit.first==idx){"TIME_RANGE"};val time=hit.second
                    require(time-old.n("inUs")>=50000 && old.n("outUs")-time>=50000){"CUT_MARGIN"}
                    val left=old.with("outUs",JsonPrimitive(time));val right=old.with("inUs",JsonPrimitive(time));clips[idx]=if(op=="trimLeft") right else left
                    if(op=="split") clips.add(idx+1,right.with("id",c.getValue("rightId")))
                };track(p,clips)
            }
            "order" -> {val ids=c.getValue("ids").jsonArray.map{it.jsonPrimitive.content};val by=ls.associateBy{it.s("id")};require(ids.size==by.size && ids.toSet()==by.keys){"BAD_ORDER"};p.with("layers",JsonArray(ids.map{by.getValue(it)}))}
            "putKey","removeKey" -> {val id=c.s("id");val ci=clips.indexOfFirst{it.s("id")==id};val li=ls.indexOfFirst{it.s("id")==id};require(ci>=0||li>=0){"UNKNOWN_ID"}
                val item=if(ci>=0) clips[ci] else ls[li];val t=c.n("atUs");val tr=obj(item,"transform");val keys=tr.items("keys").toMutableList();val removed=keys.firstOrNull{it.n("atUs")==t};keys.remove(removed)
                var base=tr
                if(op=="putKey")keys.add(buildJsonObject{put("atUs",t);put("value",c.getValue("value"))}) else {require(removed!=null){"NO_KEY"};if(keys.isEmpty())base=tr.with("base",removed.getValue("value"))}
                val next=item.with("transform",base.with("keys",JsonArray(keys.sortedBy{it.n("atUs")})))
                if(ci>=0){clips[ci]=next;track(p,clips)}else{ls[li]=next;p.with("layers",JsonArray(ls))}
            }
            "undo" -> {require(past.isNotEmpty()){"UNDO_EMPTY"};past.last()}
            "redo" -> {require(future.isNotEmpty()){"REDO_EMPTY"};future.last()}
            else -> throw IllegalArgumentException("UNKNOWN_OP")
        }
        val checked=validator.parse(candidate.with("revision",JsonPrimitive(rev+1)).toString())
        when(op){"undo"->{past.removeLast();future.addLast(p)};"redo"->{future.removeLast();past.addLast(p)};else->{past.addLast(p);if(past.size>100)past.removeFirst();future.clear()}}
        state=checked
    }
}

/** String-only harness boundary so JS Number never carries an incoming Long across the ABI. */
class Engine(schema:String) {
    private val validator=ProjectV1(schema)
    fun trace(project:String, commands:String):String {
        var session:Session?=null
        fun result(fn:()->JsonElement):JsonObject = try {buildJsonObject{put("ok",true);put("value",fn());put("state",session?.state?:JsonNull)}} catch(e:Exception){buildJsonObject{put("ok",false);put("error",e.message?.takeIf{it in stableErrors}?:"INVALID_V1_OR_INPUT");put("state",session?.state?:JsonNull)}}
        return buildJsonArray {
            add(result {session=Session(validator,project);JsonNull});val s=session?:return@buildJsonArray
            for(c in Json.parseToJsonElement(commands).jsonArray.map{it.jsonObject}) add(result {when(c.s("op")){
                "scene"->scene(s.state,c.n("atUs"));"duration"->JsonPrimitive(Clock.duration(s.state));"frames"->JsonPrimitive(Clock.frameCount(s.state));"pts"->JsonPrimitive(Clock.pts(obj(s.state,"fps"),c.n("index")))
                else->{s.apply(c);JsonNull}
            }})
        }.toString()
    }
}

/** Minimal public string ABI. Kotlin Long/Js BigInt do not escape this boundary. */
class Handle(schema:String, initial:String) {
    private val session=Session(ProjectV1(schema),initial)
    fun snapshot()=session.state.toString()
    fun edit(command:String):String {
        strictDocument(command); session.apply(Json.parseToJsonElement(command).jsonObject); return session.state.n("revision").toString()
    }
    fun render(ptsUs:String)=scene(session.state,ptsUs.toLong()).toString()
}
