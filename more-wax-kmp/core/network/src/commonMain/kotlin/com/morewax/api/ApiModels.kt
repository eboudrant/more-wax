package com.morewax.api

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

// ── Collection Record ──────────────────────────────────────

@Serializable
data class RecordDto(
    val id: Int? = null,
    val title: String? = null,
    val artist: String? = null,
    val year: String? = null,
    val label: String? = null,
    @SerialName("catalog_number") val catalogNumber: String? = null,
    val format: String? = null,
    val genres: String? = null,
    val styles: String? = null,
    val country: String? = null,
    val barcode: String? = null,
    val notes: String? = null,
    @SerialName("cover_image_url") val coverImageUrl: String? = null,
    @SerialName("local_cover") val localCover: String? = null,
    @SerialName("discogs_id") val discogsId: String? = null,
    @SerialName("price_low") val priceLow: String? = null,
    @SerialName("price_median") val priceMedian: String? = null,
    @SerialName("price_high") val priceHigh: String? = null,
    @SerialName("price_currency") val priceCurrency: String? = null,
    @SerialName("num_for_sale") val numForSale: String? = null,
    @SerialName("added_at") val addedAt: String? = null,
    @SerialName("already_in_discogs") val alreadyInDiscogs: Boolean = false,
)

@Serializable
data class AddRecordResponse(
    val id: Int? = null,
    val success: Boolean = false,
    val duplicate: Boolean = false,
    val existing: RecordDto? = null,
)

@Serializable data class SimpleResponse(val success: Boolean = false)

// ── Discogs Search ─────────────────────────────────────────

@Serializable data class SearchResponse(val results: List<SearchResultDto> = emptyList())

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

@Serializable
data class ReleaseDto(
    @SerialName("discogs_id") val discogsId: String? = null,
    val title: String? = null,
    val artist: String? = null,
    val year: String? = null,
    val label: String? = null,
    @SerialName("catalog_number") val catalogNumber: String? = null,
    val format: String? = null,
    val genres: String? = null,
    val styles: String? = null,
    val country: String? = null,
    @SerialName("cover_image_url") val coverImageUrl: String? = null,
    val barcode: String? = null,
    @SerialName("price_low") val priceLow: String? = null,
    @SerialName("price_median") val priceMedian: String? = null,
    @SerialName("price_high") val priceHigh: String? = null,
    @SerialName("price_currency") val priceCurrency: String? = null,
    @SerialName("num_for_sale") val numForSale: String? = null,
    @SerialName("already_in_discogs") val alreadyInDiscogs: Boolean = false,
)

// ── Prices ─────────────────────────────────────────────────

@Serializable
data class PricesDto(
    @SerialName("price_low") val priceLow: String? = null,
    @SerialName("price_median") val priceMedian: String? = null,
    @SerialName("price_high") val priceHigh: String? = null,
    @SerialName("price_currency") val priceCurrency: String? = null,
    @SerialName("num_for_sale") val numForSale: String? = null,
)

@Serializable
data class RefreshPricesResponse(
    val updated: String = "",
    @SerialName("total_stale") val totalStale: Int = 0,
)

// ── Image Endpoints ────────────────────────────────────────

@Serializable data class UploadCoverResponse(val path: String = "", val success: Boolean = false)

@Serializable
data class ConvertImageResponse(
    val image: String = "",
    val success: Boolean = false,
    val error: String = "",
)

@Serializable
data class IdentifyCoverResponse(
    val success: Boolean = false,
    val artist: String? = null,
    val title: String? = null,
    val label: String? = null,
    @SerialName("catalog_number") val catalogNumber: String? = null,
    val country: String? = null,
    val year: String? = null,
    val barcode: String? = null,
    @SerialName("format_details") val formatDetails: String? = null,
    val error: String? = null,
)
