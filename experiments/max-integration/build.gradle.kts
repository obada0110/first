plugins { kotlin("multiplatform") version "2.2.20" }
kotlin {
    jvm { compilerOptions { jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_1_8) } }
    js(IR) { browser(); useEsModules(); binaries.executable() }
    sourceSets.commonMain { kotlin.srcDirs("../max-core-kmp/src/commonMain/kotlin", "common") }
    sourceSets.jsMain { kotlin.srcDir("js") }
    sourceSets.commonMain.dependencies { implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.8.1") }
}
// Copy the actual JVM runtime classpath alongside the slim JAR for standalone runs.
tasks.register<Copy>("runtimeDeps") { from(configurations.named("jvmRuntimeClasspath")); into(layout.buildDirectory.dir("runtime")) }
