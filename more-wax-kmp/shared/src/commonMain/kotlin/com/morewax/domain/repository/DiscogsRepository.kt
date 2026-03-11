package com.morewax.domain.repository

import com.morewax.api.MoreWaxClient
import com.morewax.api.ReleaseDto
import com.morewax.api.SearchResultDto
import dev.zacsweers.metro.Inject

/** Repository for Discogs search and release operations. */
class DiscogsRepository @Inject constructor(
    private val client: MoreWaxClient,
) {
    suspend fun search(query: String): List<SearchResultDto> =
        client.searchDiscogs(query).results

    suspend fun searchByBarcode(barcode: String): List<SearchResultDto> =
        client.searchByBarcode(barcode).results

    suspend fun getRelease(id: String): ReleaseDto =
        client.getReleaseFull(id)

    suspend fun addToCollection(releaseId: String): Boolean =
        client.addToDiscogsCollection(releaseId).success
}
