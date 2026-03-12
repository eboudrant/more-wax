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
    val coverPath: String
        get() = localCover.ifEmpty { coverImageUrl }

    val displayPrice: String?
        get() {
            val p = priceMedian ?: priceLow ?: return null
            val symbol =
                when (priceCurrency) {
                    "USD" -> "$"
                    "EUR" -> "\u20AC"
                    "GBP" -> "\u00A3"
                    "JPY" -> "\u00A5"
                    else -> "$priceCurrency "
                }
            val formatted =
                ((p * 100).toLong() / 100.0).let { rounded ->
                    val whole = rounded.toLong()
                    val frac = ((rounded - whole) * 100 + 0.5).toInt()
                    "$whole.${frac.toString().padStart(2, '0')}"
                }
            return "$symbol$formatted"
        }

    companion object {
        private val json = Json { ignoreUnknownKeys = true }

        fun fromDto(dto: RecordDto): Record =
            Record(
                id = dto.id ?: 0,
                title = dto.title.orEmpty(),
                artist = dto.artist.orEmpty(),
                year = dto.year.orEmpty(),
                label = dto.label.orEmpty(),
                catalogNumber = dto.catalogNumber.orEmpty(),
                format = dto.format.orEmpty(),
                genres = parseJsonList(dto.genres),
                styles = parseJsonList(dto.styles),
                country = dto.country.orEmpty(),
                barcode = dto.barcode.orEmpty(),
                notes = dto.notes.orEmpty(),
                coverImageUrl = dto.coverImageUrl.orEmpty(),
                localCover = dto.localCover.orEmpty(),
                discogsId = dto.discogsId.orEmpty(),
                priceLow = dto.priceLow?.toDoubleOrNull(),
                priceMedian = dto.priceMedian?.toDoubleOrNull(),
                priceHigh = dto.priceHigh?.toDoubleOrNull(),
                priceCurrency = dto.priceCurrency.orEmpty(),
                numForSale = dto.numForSale?.toIntOrNull(),
                addedAt = dto.addedAt.orEmpty(),
            )

        private fun parseJsonList(raw: String?): List<String> {
            if (raw.isNullOrEmpty()) return emptyList()
            return try {
                json.decodeFromString<List<String>>(raw)
            } catch (_: Exception) {
                emptyList()
            }
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
