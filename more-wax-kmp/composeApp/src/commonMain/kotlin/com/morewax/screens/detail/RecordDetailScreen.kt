package com.morewax.screens.detail

import com.morewax.domain.model.Record
import com.slack.circuit.runtime.CircuitUiEvent
import com.slack.circuit.runtime.CircuitUiState
import com.slack.circuit.runtime.screen.Screen
import com.morewax.platform.CommonParcelize

@CommonParcelize
data class RecordDetailScreen(val recordId: Int) : Screen {

    data class State(
        val record: Record? = null,
        val isLoading: Boolean = true,
        val error: String? = null,
        val showDeleteConfirm: Boolean = false,
        val eventSink: (Event) -> Unit,
    ) : CircuitUiState

    sealed interface Event : CircuitUiEvent {
        data object Delete : Event
        data object ConfirmDelete : Event
        data object CancelDelete : Event
        data object NavigateBack : Event
        data object OpenOnDiscogs : Event
    }
}
