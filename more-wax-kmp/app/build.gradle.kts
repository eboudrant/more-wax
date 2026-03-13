plugins {
    alias(libs.plugins.kotlin.multiplatform)
    alias(libs.plugins.compose.multiplatform)
    alias(libs.plugins.compose.compiler)
    alias(libs.plugins.android.application)
    alias(libs.plugins.metro)
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

    // ── Targets ────────────────────────────────────────────

    androidTarget()

    jvm("desktop")

    listOf(iosX64(), iosArm64(), iosSimulatorArm64()).forEach { target ->
        target.binaries.framework {
            baseName = "ComposeApp"
            isStatic = true
        }
    }

    // ── Source sets ─────────────────────────────────────────

    sourceSets {
        commonMain.dependencies {
            @Suppress("DEPRECATION") implementation(compose.runtime)
            @Suppress("DEPRECATION") implementation(compose.foundation)
            @Suppress("DEPRECATION") implementation(compose.material3)
            @Suppress("DEPRECATION") implementation(compose.ui)

            // Internal modules
            implementation(projects.core.common)
            implementation(projects.core.network)
            implementation(projects.core.domain)
            implementation(projects.core.navigation)
            implementation(projects.feature.collection)
            implementation(projects.feature.detail)

            // Circuit — needed for App.kt wiring and DI providers
            implementation(libs.circuit.foundation)
            implementation(libs.circuit.runtime)
        }

        androidMain.dependencies { implementation("androidx.activity:activity-compose:1.13.0") }

        val desktopMain by getting {
            dependencies {
                implementation(compose.desktop.currentOs)
                implementation(libs.kotlinx.coroutines.swing)
            }
        }
    }
}

// Force skiko JVM and native runtime to the same version to avoid UnsatisfiedLinkError
configurations.all {
    resolutionStrategy.force(
        "org.jetbrains.skiko:skiko:0.9.37.3",
        "org.jetbrains.skiko:skiko-awt:0.9.37.3",
    )
}

// ── Android config ─────────────────────────────────────────

android {
    namespace = "com.morewax"
    compileSdk = 36
    defaultConfig {
        applicationId = "com.morewax"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "1.0.0"
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_21
        targetCompatibility = JavaVersion.VERSION_21
    }
}

// ── Desktop config ─────────────────────────────────────────

compose.desktop {
    application {
        mainClass = "com.morewax.desktop.MainKt"

        nativeDistributions {
            targetFormats(
                org.jetbrains.compose.desktop.application.dsl.TargetFormat.Dmg,
                org.jetbrains.compose.desktop.application.dsl.TargetFormat.Msi,
                org.jetbrains.compose.desktop.application.dsl.TargetFormat.Deb,
            )
            packageName = "MoreWax"
            packageVersion = "1.0.0"
        }
    }
}
