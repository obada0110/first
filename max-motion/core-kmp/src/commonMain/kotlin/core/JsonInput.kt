package core

import kotlinx.serialization.json.*

// The v1 model rejects structural/type errors. Check syntax and duplicate names
// before constructing JsonObject, which otherwise cannot represent duplicate keys.
internal fun strictDocument(raw: String) {
    var i = 0
    fun ch() = raw.getOrNull(i) ?: '\u0000'
    fun ws() { while (ch() in " \r\n\t") i++ }
    fun take(c: Char) { require(ch() == c); i++ }
    fun string(): String {
        val start = i; take('"')
        while (ch() != '"') {
            require(ch().code >= 32)
            if (ch() == '\\') { i++; val esc = ch(); require(esc in "\"\\/bfnrtu"); i++
                if (esc == 'u') repeat(4) { require(ch() in "0123456789abcdefABCDEF"); i++ }
            } else i++
        }
        i++; return raw.substring(start,i)
    }
    fun value(depth: Int) {
        require(depth <= 128); ws()
        when (ch()) {
            '{' -> { i++; ws(); val keys = mutableSetOf<String>()
                if (ch() != '}') while (true) {
                    ws(); val key = Json.parseToJsonElement(string()).jsonPrimitive.content
                    require(keys.add(key)) { "DUPLICATE_FIELD" }; ws(); take(':'); value(depth+1); ws()
                    if (ch() != ',') break; i++
                }; take('}') }
            '[' -> { i++; ws(); if (ch() != ']') while (true) { value(depth+1); ws(); if (ch() != ',') break; i++ }; take(']') }
            '"' -> string()
            't','f','n' -> { val word=when(ch()){'t'->"true";'f'->"false";else->"null"}; require(raw.startsWith(word,i)); i+=word.length }
            else -> { val start=i; while(ch() in "0123456789+-.eE") i++;require(i>start && number.matches(raw.substring(start,i))) }
        }
    }
    value(0); ws(); require(i==raw.length)
}
private val number=Regex("-?(0|[1-9][0-9]*)(\\.[0-9]+)?([eE][+-]?[0-9]+)?")
