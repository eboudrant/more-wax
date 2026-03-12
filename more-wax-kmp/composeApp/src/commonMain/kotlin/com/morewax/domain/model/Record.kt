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
            return formatPrice(p, priceCurrency)
        }

    companion object {
        private const val CENTS = 100
        private const val CENTS_DOUBLE = 100.0
        private const val ROUND_HALF = 0.5
        private val json = Json { ignoreUnknownKeys = true }

        /** Formats [price] with its [currency] symbol and 2 decimal places. */
        fun formatPrice(price: Double, currency: String): String {
            val symbol =
                when (currency) {
                    "USD" -> "$"
                    "EUR" -> "\u20AC"
                    "GBP" -> "\u00A3"
                    "JPY" -> "\u00A5"
                    else -> "$currency "
                }
            val formatted =
                ((price * CENTS).toLong() / CENTS_DOUBLE).let { rounded ->
                    val whole = rounded.toLong()
                    val frac = ((rounded - whole) * CENTS + ROUND_HALF).toInt()
                    "$whole.${frac.toString().padStart(2, '0')}"
                }
            return "$symbol$formatted"
        }

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

        @Suppress("TooGenericExceptionCaught")
        private fun parseJsonList(raw: String?): List<String> {
            if (raw.isNullOrEmpty()) return emptyList()
            return try {
                json.decodeFromString<List<String>>(raw)
            } catch (e: Exception) {
                // The server occasionally stores genres/styles as a plain comma-separated
                // string rather than a JSON array; returning empty is preferable to crashing
                // the entire record mapping over a non-critical field.
                println("parseJsonList: failed to decode '$raw': $e")
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
