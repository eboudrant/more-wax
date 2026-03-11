package com.morewax.api

import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.client.plugins.defaultRequest
import io.ktor.client.plugins.logging.LogLevel
import io.ktor.client.plugins.logging.Logging
import io.ktor.client.request.delete
import io.ktor.client.request.get
import io.ktor.client.request.parameter
import io.ktor.client.request.post
import io.ktor.client.request.put
import io.ktor.client.request.setBody
import io.ktor.http.ContentType
import io.ktor.http.contentType
import io.ktor.serialization.kotlinx.json.json
import kotlinx.serialization.json.Json

/**
 * HTTP client for the More'Wax Python server API.
 * All methods are suspend functions that return typed responses.
 */
class MoreWaxClient(
    val baseUrl: String = "http://localhost:8765",
) {
    private val json = Json {
        ignoreUnknownKeys = true
        isLenient = true
    }

    private val http = HttpClient {
        install(ContentNegotiation) { json(json) }
        install(Logging) { level = LogLevel.HEADERS }
        defaultRequest {
            url(baseUrl)
            contentType(ContentType.Application.Json)
        }
    }

    // ── Collection CRUD ────────────────────────────────────

    suspend fun listCollection(): List<RecordDto> =
        http.get("/api/collection").body()

    suspend fun getRecord(id: Int): RecordDto =
        http.get("/api/collection/$id").body()

    suspend fun addRecord(record: RecordDto): AddRecordResponse =
        http.post("/api/collection") { setBody(record) }.body()

    suspend fun updateRecord(id: Int, fields: Map<String, String>): SimpleResponse =
        http.put("/api/collection/$id") { setBody(fields) }.body()

    suspend fun deleteRecord(id: Int): SimpleResponse =
        http.delete("/api/collection/$id").body()

    // ── Discogs Search & Release ───────────────────────────

    suspend fun searchDiscogs(query: String): SearchResponse =
        http.get("/api/discogs/search") { parameter("q", query) }.body()

    suspend fun searchByBarcode(barcode: String): SearchResponse =
        http.get("/api/discogs/search") { parameter("barcode", barcode) }.body()

    suspend fun getReleaseFull(id: String): ReleaseDto =
        http.get("/api/discogs/release/$id").body()

    suspend fun getReleasePrices(id: String): PricesDto =
        http.get("/api/discogs/prices/$id").body()

    suspend fun addToDiscogsCollection(id: String): SimpleResponse =
        http.post("/api/discogs/add-to-collection/$id") { setBody("{}") }.body()

    suspend fun refreshPrices(): RefreshPricesResponse =
        http.post("/api/collection/refresh-prices") { setBody("{}") }.body()

    // ── Images ─────────────────────────────────────────────

    suspend fun uploadCover(base64Image: String, recordId: String): UploadCoverResponse =
        http.post("/api/upload-cover") {
            setBody(mapOf("image" to base64Image, "record_id" to recordId))
        }.body()

    suspend fun convertImage(base64Image: String): ConvertImageResponse =
        http.post("/api/convert-image") {
            setBody(mapOf("image" to base64Image))
        }.body()

    suspend fun identifyCover(base64Image: String): IdentifyCoverResponse =
        http.post("/api/identify-cover") {
            setBody(mapOf("image" to base64Image))
        }.body()

    /** Build a full URL for a cover image path from the server. */
    fun coverUrl(path: String): String {
        if (path.startsWith("http")) return path
        return "$baseUrl$path"
    }

    fun close() = http.close()
}
