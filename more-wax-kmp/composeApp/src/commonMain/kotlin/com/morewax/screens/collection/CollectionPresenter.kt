package com.morewax.screens.collection

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import com.morewax.domain.model.Record
import com.morewax.domain.model.SortOption
import com.morewax.domain.repository.RecordsRepository
import com.morewax.screens.detail.RecordDetailScreen
import com.slack.circuit.codegen.annotations.CircuitInject
import com.slack.circuit.runtime.Navigator
import com.slack.circuit.runtime.presenter.Presenter
import dev.zacsweers.metro.AppScope
import dev.zacsweers.metro.Assisted
import dev.zacsweers.metro.AssistedFactory
import dev.zacsweers.metro.AssistedInject
import kotlinx.coroutines.launch
import kotlinx.io.IOException

@AssistedInject
class CollectionPresenter(
    private val repository: RecordsRepository,
    @Assisted private val navigator: Navigator,
) : Presenter<CollectionScreen.State> {

    @Composable
    override fun present(): CollectionScreen.State {
        var records by remember { mutableStateOf(emptyList<Record>()) }
        var isLoading by remember { mutableStateOf(true) }
        var error by remember { mutableStateOf<String?>(null) }
        var sortBy by remember { mutableStateOf(SortOption.ARTIST) }
        var filterText by remember { mutableStateOf("") }
        val scope = rememberCoroutineScope()

        LaunchedEffect(Unit) {
            try {
                records = repository.getCollection()
            } catch (e: IOException) {
                error = e.message ?: "Failed to load collection"
            }
            isLoading = false
        }

        val displayRecords =
            remember(records, sortBy, filterText) {
                records
                    .filter { r ->
                        if (filterText.isBlank()) true
                        else {
                            val q = filterText.lowercase()
                            r.artist.lowercase().contains(q) ||
                                r.title.lowercase().contains(q) ||
                                r.label.lowercase().contains(q) ||
                                r.year.contains(q)
                        }
                    }
                    .sortedWith(
                        when (sortBy) {
                            SortOption.ARTIST ->
                                compareBy(String.CASE_INSENSITIVE_ORDER) { it.artist }
                            SortOption.TITLE ->
                                compareBy(String.CASE_INSENSITIVE_ORDER) { it.title }
                            SortOption.YEAR -> compareByDescending { it.year }
                            SortOption.RECENT -> compareByDescending { it.addedAt }
                            SortOption.PRICE -> compareByDescending { it.priceMedian ?: 0.0 }
                        }
                    )
            }

        return CollectionScreen.State(
            records = displayRecords,
            isLoading = isLoading,
            error = error,
            sortBy = sortBy,
            filterText = filterText,
        ) { event ->
            when (event) {
                is CollectionScreen.Event.SetSort -> sortBy = event.option
                is CollectionScreen.Event.SetFilter -> filterText = event.text
                is CollectionScreen.Event.OpenRecord -> navigator.goTo(RecordDetailScreen(event.id))
                is CollectionScreen.Event.OpenAddFlow -> {
                    /* TODO Phase 3 */
                }
                is CollectionScreen.Event.Refresh ->
                    scope.launch {
                        isLoading = true
                        try {
                            records = repository.getCollection()
                        } catch (e: IOException) {
                            error = e.message
                        }
                        isLoading = false
                    }
            }
        }
    }

    @CircuitInject(CollectionScreen::class, AppScope::class)
    @AssistedFactory
    fun interface Factory {
        fun create(navigator: Navigator): CollectionPresenter
    }
}
