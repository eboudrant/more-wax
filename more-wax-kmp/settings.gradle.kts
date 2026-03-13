pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}

dependencyResolutionManagement {
    repositories {
        google()
        mavenCentral()
    }
}

enableFeaturePreview("TYPESAFE_PROJECT_ACCESSORS")

rootProject.name = "more-wax-kmp"

include(":app")

include(":core:common")
include(":core:network")
include(":core:domain")
include(":core:navigation")
include(":feature:collection")
include(":feature:detail")
