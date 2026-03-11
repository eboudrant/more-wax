package com.morewax.di

import com.morewax.api.MoreWaxClient
import com.morewax.domain.repository.DiscogsRepository
import com.morewax.domain.repository.RecordsRepository
import com.morewax.screens.collection.CollectionPresenter
import com.morewax.screens.detail.RecordDetailPresenter
import dev.zacsweers.metro.DependencyGraph
import dev.zacsweers.metro.Provides

/**
 * Root dependency graph for the More'Wax KMP app.
 * Metro generates the implementation at compile time.
 */
@DependencyGraph
abstract class AppGraph {

    @Provides
    fun provideMoreWaxClient(): MoreWaxClient = MoreWaxClient()

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
