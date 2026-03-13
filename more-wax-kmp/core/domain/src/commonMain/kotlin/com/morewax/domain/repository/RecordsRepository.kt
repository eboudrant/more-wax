package com.morewax.domain.repository

import com.morewax.api.MoreWaxClient
import com.morewax.api.RecordDto
import com.morewax.domain.model.Record

class RecordsRepository(private val client: MoreWaxClient) {

    suspend fun getCollection(): List<Record> =
        client.listCollection().map { dto -> Record.fromDto(dto).withFullCoverUrl(client) }

    suspend fun getRecord(id: Int): Record =
        Record.fromDto(client.getRecord(id)).withFullCoverUrl(client)

    suspend fun addRecord(dto: RecordDto): Result<Int> {
        val resp = client.addRecord(dto)
        return if (resp.duplicate) {
            Result.failure(
                DuplicateRecordException(
                    resp.existing?.let { Record.fromDto(it).withFullCoverUrl(client) }
                )
            )
        } else if (resp.success && resp.id != null) {
            Result.success(resp.id!!)
        } else {
            Result.failure(Exception("Failed to add record"))
        }
    }

    suspend fun deleteRecord(id: Int): Boolean = client.deleteRecord(id).success

    suspend fun refreshPrices(): Int = client.refreshPrices().totalStale

    private fun Record.withFullCoverUrl(client: MoreWaxClient): Record {
        val fullLocal = if (localCover.isNotEmpty()) client.coverUrl(localCover) else ""
        return copy(localCover = fullLocal)
    }
}

class DuplicateRecordException(val existing: Record?) : Exception("Duplicate record")
