package com.morewax.di

import com.morewax.api.MoreWaxClient
import com.morewax.domain.repository.DiscogsRepository
import com.morewax.domain.repository.RecordsRepository
import com.slack.circuit.foundation.Circuit

/**
 * Common interface for the app's dependency graph. Platform source sets provide the implementation.
 */
interface AppGraph {
    val circuit: Circuit
    val recordsRepository: RecordsRepository
    val discogsRepository: DiscogsRepository
    val moreWaxClient: MoreWaxClient
}
