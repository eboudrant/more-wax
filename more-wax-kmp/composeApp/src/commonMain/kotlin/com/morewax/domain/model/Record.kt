package com.morewax.domain.model

import com.morewax.api.RecordDto
import kotlinx.serialization.json.Json

/** Domain model for a vinyl record in the collection. */
data class Record(
    val id: Int,
    val title: String,
    val artist: String,
    val year: String,
    val label: String,
    val catalogNumber: String,
    val format: String,
    val genres: List<String>,
    val styles: List<String>,
    val country: String,
    val barcode: String,
    val notes: String,
    val coverImageUrl: String,
    val localCover: String,
    val discogsId: String,
    val priceLow: Double?,
    val priceMedian: Double?,
    val priceHigh: Double?,
    val priceCurrency: String,
    val numForSale: Int?,
    val addedAt: String,
) {
    val coverPath: String get() = localCover.ifEmpty { coverImageUrl }

    val displayPrice: String?
        get() {
            val p = priceMedian ?: priceLow ?: return null
            val symbol = when (priceCurrency) {
                "USD" -> "$"; "EUR" -> "\u20AC"; "GBP" -> "\u00A3"; "JPY" -> "\u00A5"
                else -> "$priceCurrency "
            }
            return "$symbol${"%.2f".format(p)}"
        }

    companion object {
        private val json = Json { ignoreUnknownKeys = true }

        fun fromDto(dto: RecordDto): Record = Record(
            id = dto.id ?: 0,
            title = dto.title,
            artist = dto.artist,
            year = dto.year,
            label = dto.label,
            catalogNumber = dto.catalogNumber,
            format = dto.format,
            genres = parseJsonList(dto.genres),
            styles = parseJsonList(dto.styles),
            country = dto.country,
            barcode = dto.barcode,
            notes = dto.notes,
            coverImageUrl = dto.coverImageUrl,
            localCover = dto.localCover,
            discogsId = dto.discogsId,
            priceLow = dto.priceLow.toDoubleOrNull(),
            priceMedian = dto.priceMedian.toDoubleOrNull(),
            priceHigh = dto.priceHigh.toDoubleOrNull(),
            priceCurrency = dto.priceCurrency,
            numForSale = dto.numForSale.toIntOrNull(),
            addedAt = dto.addedAt,
        )

        private fun parseJsonList(raw: String): List<String> = try {
            json.decodeFromString<List<String>>(raw)
        } catch (_: Exception) {
            emptyList()
        }
    }
}

enum class SortOption(val label: String) {
    ARTIST("Artist"),
    TITLE("Title"),
    YEAR("Year"),
    RECENT("Recent"),
    PRICE("Price"),
}
