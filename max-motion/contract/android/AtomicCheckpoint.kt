package maxeditor.contract

import android.util.AtomicFile
import java.io.File
import java.io.IOException

/** A caller supplies an app-private file and serializes all writers for this project. */
class AtomicCheckpoint(path: File) {
    private val file = AtomicFile(path)
    fun read(): String = file.openRead().bufferedReader(Charsets.UTF_8).use { it.readText() }
    fun write(json: String) {
        val out = file.startWrite()
        try {
            out.write(json.toByteArray(Charsets.UTF_8)); out.fd.sync(); file.finishWrite(out)
        } catch (e: Exception) { file.failWrite(out); throw e }
        // Android AtomicFile can log a failed rename instead of throwing. Do not ACK it.
        if (read() != json) throw IOException("Checkpoint revision was not published")
    }
}
