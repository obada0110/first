plugins {
    id("com.android.application")
    id("kotlin-android")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

val requestedCoreFlag = project.providers.gradleProperty("maxCoreEditorEnabled").orNull?.toBooleanStrictOrNull() ?: false

android {
    namespace = "io.github.obada0110.maxeditor"
    compileSdk = flutter.compileSdkVersion
    ndkVersion = flutter.ndkVersion

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = JavaVersion.VERSION_17.toString()
    }

    buildFeatures { buildConfig = true }
    defaultConfig {
        buildConfigField("boolean", "MAX_CORE_EDITOR_ENABLED", "false")
        applicationId = "io.github.obada0110.maxeditor"
        // You can update the following values to match your application needs.
        // For more information, see: https://flutter.dev/to/review-gradle-config.
        minSdk = flutter.minSdkVersion
        targetSdk = flutter.targetSdkVersion
        versionCode = flutter.versionCode
        versionName = flutter.versionName
    }
    buildTypes {
        getByName("debug") {
            buildConfigField("boolean", "MAX_CORE_EDITOR_ENABLED", requestedCoreFlag.toString())
            if (requestedCoreFlag) applicationIdSuffix = ".phase3a"
        }
        getByName("release") { buildConfigField("boolean", "MAX_CORE_EDITOR_ENABLED", "false") }
    }
    sourceSets.getByName("main") {
        java.srcDirs("../../../contract/kotlin", "../../../contract/android")
        assets.srcDir("../../../contract/schema")
    }
}

dependencies {
    implementation(project(":maxCore"))
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.8.1")
    val media3 = "1.6.1"
    implementation("androidx.media3:media3-exoplayer:$media3")
    implementation("androidx.media3:media3-ui:$media3")
    implementation("androidx.media3:media3-transformer:$media3")
}

flutter {
    source = "../.."
}
