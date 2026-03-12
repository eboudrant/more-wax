plugins {
    alias(libs.plugins.kotlin.multiplatform)
    alias(libs.plugins.kotlin.serialization)
    alias(libs.plugins.compose.multiplatform)
    alias(libs.plugins.compose.compiler)
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.parcelize)
    alias(libs.plugins.ktfmt)
    alias(libs.plugins.metro)
    alias(libs.plugins.ksp)
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

    // ── Targets ────────────────────────────────────────────

    androidTarget()

    jvm("desktop")

    listOf(iosX64(), iosArm64(), iosSimulatorArm64()).forEach { target ->
        target.binaries.framework {
            baseName = "ComposeApp"
            isStatic = true
        }
    }

    compilerOptions { freeCompilerArgs.add("-Xexpect-actual-classes") }

    targets.configureEach {
        if (platformType == org.jetbrains.kotlin.gradle.plugin.KotlinPlatformType.androidJvm) {
            compilations.configureEach {
                compileTaskProvider.configure {
                    compilerOptions {
                        freeCompilerArgs.addAll(
                            "-P",
                            "plugin:org.jetbrains.kotlin.parcelize:additionalAnnotation=com.morewax.platform.CommonParcelize",
                        )
                    }
                }
            }
        }
    }

    // ── Source sets ─────────────────────────────────────────

    sourceSets {
        commonMain.dependencies {
            // Compose Multiplatform
            @Suppress("DEPRECATION") implementation(compose.runtime)
            @Suppress("DEPRECATION") implementation(compose.foundation)
            @Suppress("DEPRECATION") implementation(compose.material3)
            @Suppress("DEPRECATION") implementation(compose.materialIconsExtended)
            @Suppress("DEPRECATION") implementation(compose.ui)
            @Suppress("DEPRECATION") implementation(compose.components.resources)

            // Circuit
            implementation(libs.circuit.foundation)
            implementation(libs.circuit.runtime)
            implementation(libs.circuit.codegen.annotations)
            implementation(libs.circuit.overlay)

            // Networking
            implementation(libs.ktor.client.core)
            implementation(libs.ktor.client.content.negotiation)
            implementation(libs.ktor.serialization.json)
            implementation(libs.ktor.client.logging)

            // Serialization & Coroutines
            implementation(libs.kotlinx.serialization.json)
            implementation(libs.kotlinx.coroutines.core)

            // Image loading
            implementation(libs.coil.compose)
            implementation(libs.coil.network.ktor)
        }

        androidMain.dependencies {
            implementation(libs.ktor.client.okhttp)
            implementation("androidx.activity:activity-compose:1.13.0")
        }

        val desktopMain by getting {
            dependencies {
                implementation(compose.desktop.currentOs)
                implementation(libs.ktor.client.java)
                implementation(libs.kotlinx.coroutines.swing)
            }
        }

        iosMain.dependencies { implementation(libs.ktor.client.darwin) }
    }
}

// Force skiko JVM and native runtime to the same version to avoid UnsatisfiedLinkError
configurations.all {
    resolutionStrategy.force(
        "org.jetbrains.skiko:skiko:0.144.4",
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

// ── KSP circuit-codegen for each target ───────────────────

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
