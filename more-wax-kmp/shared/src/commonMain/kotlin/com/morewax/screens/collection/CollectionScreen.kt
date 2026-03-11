package com.morewax.screens.collection

import com.morewax.domain.model.Record
import com.morewax.domain.model.SortOption
import com.slack.circuit.runtime.CircuitUiEvent
import com.slack.circuit.runtime.CircuitUiState
import com.slack.circuit.runtime.screen.Screen

/** The main collection grid screen. */
data object CollectionScreen : Screen {

    data class State(
        val records: List<Record> = emptyList(),
        val isLoading: Boolean = true,
        val error: String? = null,
        val sortBy: SortOption = SortOption.ARTIST,
        val filterText: String = "",
        val eventSink: (Event) -> Unit,
    ) : CircuitUiState

    sealed interface Event : CircuitUiEvent {
        data class SetSort(val option: SortOption) : Event
        data class SetFilter(val text: String) : Event
        data class OpenRecord(val id: Int) : Event
        data object OpenAddFlow : Event
        data object Refresh : Event
    }
}
