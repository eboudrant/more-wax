package com.morewax.di

import com.morewax.api.MoreWaxClient
import com.morewax.domain.repository.DiscogsRepository
import com.morewax.domain.repository.RecordsRepository
import dev.zacsweers.metro.AppScope
import dev.zacsweers.metro.ContributesTo
import dev.zacsweers.metro.Provides
import dev.zacsweers.metro.SingleIn

@ContributesTo(AppScope::class)
interface AppProviders {

    @SingleIn(AppScope::class) @Provides fun provideMoreWaxClient(): MoreWaxClient = MoreWaxClient()

    @SingleIn(AppScope::class)
    @Provides
    fun provideRecordsRepository(client: MoreWaxClient): RecordsRepository =
        RecordsRepository(client)

    @SingleIn(AppScope::class)
    @Provides
    fun provideDiscogsRepository(client: MoreWaxClient): DiscogsRepository =
        DiscogsRepository(client)
}
