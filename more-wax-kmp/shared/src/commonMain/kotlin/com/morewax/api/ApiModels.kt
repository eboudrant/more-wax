package com.morewax.api

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement

// ── Collection Record ──────────────────────────────────────

@Serializable
data class RecordDto(
    val id: Int? = null,
    val title: String = "",
    val artist: String = "",
    val year: String = "",
    val label: String = "",
    @SerialName("catalog_number") val catalogNumber: String = "",
    val format: String = "",
    val genres: String = "[]",       // JSON-encoded list from server
    val styles: String = "[]",       // JSON-encoded list from server
    val country: String = "",
    val barcode: String = "",
    val notes: String = "",
    @SerialName("cover_image_url") val coverImageUrl: String = "",
    @SerialName("local_cover") val localCover: String = "",
    @SerialName("discogs_id") val discogsId: String = "",
    @SerialName("price_low") val priceLow: String = "",
    @SerialName("price_median") val priceMedian: String = "",
    @SerialName("price_high") val priceHigh: String = "",
    @SerialName("price_currency") val priceCurrency: String = "USD",
    @SerialName("num_for_sale") val numForSale: String = "",
    @SerialName("added_at") val addedAt: String = "",
    @SerialName("already_in_discogs") val alreadyInDiscogs: Boolean = false,
)

// ── Add Record Response ────────────────────────────────────

@Serializable
data class AddRecordResponse(
    val id: Int? = null,
    val success: Boolean = false,
    val duplicate: Boolean = false,
    val existing: RecordDto? = null,
)

@Serializable
data class SimpleResponse(
    val success: Boolean = false,
)

// ── Discogs Search ─────────────────────────────────────────

@Serializable
data class SearchResponse(
    val results: List<SearchResultDto> = emptyList(),
)

@Serializable
data class SearchResultDto(
    val id: Int = 0,
    val title: String = "",
    val year: String? = null,
    val label: List<String> = emptyList(),
    val format: List<String> = emptyList(),
    @SerialName("cover_image") val coverImage: String = "",
    val thumb: String = "",
)

// ── Discogs Release ────────────────────────────────────────

/** Full release details returned by /api/discogs/release/{id} */
@Serializable
data class ReleaseDto(
    @SerialName("discogs_id") val discogsId: String = "",
    val title: String = "",
    val artist: String = "",
    val year: String = "",
    val label: String = "",
    @SerialName("catalog_number") val catalogNumber: String = "",
    val format: String = "",
    val genres: String = "[]",
    val styles: String = "[]",
    val country: String = "",
    @SerialName("cover_image_url") val coverImageUrl: String = "",
    val barcode: String = "",
    @SerialName("price_low") val priceLow: String = "",
    @SerialName("price_median") val priceMedian: String = "",
    @SerialName("price_high") val priceHigh: String = "",
    @SerialName("price_currency") val priceCurrency: String = "USD",
    @SerialName("num_for_sale") val numForSale: String = "",
    @SerialName("already_in_discogs") val alreadyInDiscogs: Boolean = false,
)

// ── Prices ─────────────────────────────────────────────────

@Serializable
data class PricesDto(
    @SerialName("price_low") val priceLow: String = "",
    @SerialName("price_median") val priceMedian: String = "",
    @SerialName("price_high") val priceHigh: String = "",
    @SerialName("price_currency") val priceCurrency: String = "USD",
    @SerialName("num_for_sale") val numForSale: String = "",
)

@Serializable
data class RefreshPricesResponse(
    val updated: String = "",
    @SerialName("total_stale") val totalStale: Int = 0,
)

// ── Image Endpoints ────────────────────────────────────────

@Serializable
data class UploadCoverResponse(
    val path: String = "",
    val success: Boolean = false,
)

@Serializable
data class ConvertImageResponse(
    val image: String = "",
    val success: Boolean = false,
    val error: String = "",
)

@Serializable
data class IdentifyCoverResponse(
    val success: Boolean = false,
    val artist: String = "",
    val title: String = "",
    val label: String = "",
    @SerialName("catalog_number") val catalogNumber: String = "",
    val country: String = "",
    val year: String = "",
    val barcode: String = "",
    @SerialName("format_details") val formatDetails: String = "",
    val error: String = "",
)
