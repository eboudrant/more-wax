plugins {
    alias(libs.plugins.kotlin.multiplatform)
    alias(libs.plugins.compose.multiplatform)
    alias(libs.plugins.compose.compiler)
    alias(libs.plugins.android.library)
    alias(libs.plugins.metro)
    alias(libs.plugins.ksp)
    alias(libs.plugins.ktfmt)
    alias(libs.plugins.detekt)
}

ksp { arg("circuit.codegen.mode", "metro") }

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

    sourceSets {
        commonMain.dependencies {
            @Suppress("DEPRECATION") implementation(compose.runtime)
            @Suppress("DEPRECATION") implementation(compose.foundation)
            @Suppress("DEPRECATION") implementation(compose.material3)
            @Suppress("DEPRECATION") implementation(compose.materialIconsExtended)
            @Suppress("DEPRECATION") implementation(compose.ui)

            implementation(projects.core.navigation)
            implementation(projects.core.domain)
            implementation(projects.core.common)

            implementation(libs.circuit.foundation)
            implementation(libs.circuit.runtime)
            implementation(libs.circuit.codegen.annotations)

            implementation(libs.coil.compose)
            implementation(libs.coil.network.ktor)
        }
    }
}

android {
    namespace = "com.morewax.feature.detail"
    compileSdk = 36
    defaultConfig { minSdk = 26 }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_21
        targetCompatibility = JavaVersion.VERSION_21
    }
}

dependencies {
    kotlin.targets.names.forEach { target ->
        val configName = "ksp${target.replaceFirstChar { it.uppercase() }}"
        try {
            add(configName, libs.circuit.codegen)
        } catch (_: Exception) {
            // Target may not have a KSP configuration
        }
    }
}
