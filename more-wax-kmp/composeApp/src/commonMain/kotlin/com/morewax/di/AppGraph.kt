package com.morewax.di

import com.morewax.api.MoreWaxClient
import com.morewax.domain.repository.DiscogsRepository
import com.morewax.domain.repository.RecordsRepository
import dev.zacsweers.metro.DependencyGraph
import dev.zacsweers.metro.Provides

/**
 * Root dependency graph for the More'Wax KMP app. Metro generates the implementation at compile
 * time.
 */
@DependencyGraph
abstract class AppGraph {

    @Provides fun provideMoreWaxClient(): MoreWaxClient = MoreWaxClient()

    @Provides
    fun provideRecordsRepository(client: MoreWaxClient): RecordsRepository =
        RecordsRepository(client)

    @Provides
    fun provideDiscogsRepository(client: MoreWaxClient): DiscogsRepository =
        DiscogsRepository(client)

    abstract val recordsRepository: RecordsRepository
    abstract val discogsRepository: DiscogsRepository
    abstract val moreWaxClient: MoreWaxClient
}

/**
 * Create the app graph. Metro generates `createAppGraph()` at compile time. If Metro codegen isn't
 * available yet, this serves as a manual fallback.
 */
fun createAppGraph(): AppGraph = ManualAppGraph()

/** Manual implementation until Metro codegen is wired. */
private class ManualAppGraph : AppGraph() {
    private val _client = MoreWaxClient()
    override val moreWaxClient: MoreWaxClient
        get() = _client

    override val recordsRepository: RecordsRepository
        get() = RecordsRepository(_client)

    override val discogsRepository: DiscogsRepository
        get() = DiscogsRepository(_client)
}
