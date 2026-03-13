plugins {
    alias(libs.plugins.kotlin.multiplatform)
    alias(libs.plugins.compose.multiplatform)
    alias(libs.plugins.compose.compiler)
    alias(libs.plugins.android.library)
    alias(libs.plugins.kotlin.parcelize)
    alias(libs.plugins.ktfmt)
    alias(libs.plugins.detekt)
}

detekt {
    source.setFrom(files("src/"))
    buildUponDefaultConfig = true
    config.setFrom(rootProject.files("detekt.yml"))
}

tasks.withType<io.gitlab.arturbosch.detekt.Detekt>().configureEach {
    exclude { it.file.absolutePath.contains("/build/") }
}

ktfmt { kotlinLangStyle() }

kotlin {
    jvmToolchain(21)

    androidTarget()
    jvm("desktop")
    iosX64()
    iosArm64()
    iosSimulatorArm64()

    compilerOptions { freeCompilerArgs.add("-Xexpect-actual-classes") }

    sourceSets {
        commonMain.dependencies {
            @Suppress("DEPRECATION") implementation(compose.runtime)
            @Suppress("DEPRECATION") implementation(compose.foundation)
            @Suppress("DEPRECATION") implementation(compose.material3)
            @Suppress("DEPRECATION") implementation(compose.ui)
        }
    }
}

android {
    namespace = "com.morewax.core.common"
    compileSdk = 36
    defaultConfig { minSdk = 26 }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_21
        targetCompatibility = JavaVersion.VERSION_21
    }
}
