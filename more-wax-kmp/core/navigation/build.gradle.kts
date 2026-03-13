plugins {
    alias(libs.plugins.kotlin.multiplatform)
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

    // Tell the parcelize compiler plugin to treat @CommonParcelize as @Parcelize on Android
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

    sourceSets {
        commonMain.dependencies {
            implementation(projects.core.common)
            implementation(projects.core.domain)
            implementation(libs.circuit.runtime)
        }
    }
}

android {
    namespace = "com.morewax.core.navigation"
    compileSdk = 36
    defaultConfig { minSdk = 26 }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_21
        targetCompatibility = JavaVersion.VERSION_21
    }
}
