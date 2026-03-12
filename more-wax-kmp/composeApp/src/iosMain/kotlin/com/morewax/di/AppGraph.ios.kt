package com.morewax.di

import dev.zacsweers.metro.AppScope
import dev.zacsweers.metro.DependencyGraph
import dev.zacsweers.metro.createGraph

@DependencyGraph(scope = AppScope::class)
interface IosAppGraph : AppGraph {

    companion object {
        fun create(): AppGraph = createGraph<IosAppGraph>()
    }
}
