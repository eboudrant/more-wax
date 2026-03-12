package com.morewax.screens.detail

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import com.morewax.domain.model.Record
import com.morewax.domain.repository.RecordsRepository
import com.slack.circuit.runtime.Navigator
import com.slack.circuit.runtime.presenter.Presenter
import kotlinx.coroutines.launch

class RecordDetailPresenter(
    private val screen: RecordDetailScreen,
    private val repository: RecordsRepository,
    private val navigator: Navigator,
) : Presenter<RecordDetailScreen.State> {

    @Composable
    override fun present(): RecordDetailScreen.State {
        var record by remember { mutableStateOf<Record?>(null) }
        var isLoading by remember { mutableStateOf(true) }
        var error by remember { mutableStateOf<String?>(null) }
        var showDeleteConfirm by remember { mutableStateOf(false) }
        val scope = rememberCoroutineScope()

        LaunchedEffect(screen.recordId) {
            try {
                record = repository.getRecord(screen.recordId)
            } catch (e: Exception) {
                error = e.message ?: "Failed to load record"
            }
            isLoading = false
        }

        return RecordDetailScreen.State(
            record = record,
            isLoading = isLoading,
            error = error,
            showDeleteConfirm = showDeleteConfirm,
        ) { event ->
            when (event) {
                RecordDetailScreen.Event.Delete -> showDeleteConfirm = true
                RecordDetailScreen.Event.CancelDelete -> showDeleteConfirm = false
                RecordDetailScreen.Event.ConfirmDelete ->
                    scope.launch {
                        repository.deleteRecord(screen.recordId)
                        navigator.pop()
                    }
                RecordDetailScreen.Event.NavigateBack -> navigator.pop()
                RecordDetailScreen.Event.OpenOnDiscogs -> {
                    /* TODO: platform URL open */
                }
            }
        }
    }
}
