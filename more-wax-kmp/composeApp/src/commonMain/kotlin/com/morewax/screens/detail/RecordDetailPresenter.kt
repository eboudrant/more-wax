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
import com.morewax.platform.openUrlHandler
import com.slack.circuit.codegen.annotations.CircuitInject
import com.slack.circuit.runtime.Navigator
import com.slack.circuit.runtime.presenter.Presenter
import dev.zacsweers.metro.AppScope
import dev.zacsweers.metro.Assisted
import dev.zacsweers.metro.AssistedFactory
import dev.zacsweers.metro.AssistedInject
import io.ktor.client.plugins.ResponseException
import io.ktor.serialization.JsonConvertException
import kotlinx.coroutines.launch
import kotlinx.io.IOException

@AssistedInject
class RecordDetailPresenter(
    @Assisted private val screen: RecordDetailScreen,
    private val repository: RecordsRepository,
    @Assisted private val navigator: Navigator,
) : Presenter<RecordDetailScreen.State> {

    @Composable
    override fun present(): RecordDetailScreen.State {
        var record by remember { mutableStateOf<Record?>(null) }
        var isLoading by remember { mutableStateOf(true) }
        var error by remember { mutableStateOf<String?>(null) }
        var showDeleteConfirm by remember { mutableStateOf(false) }
        val scope = rememberCoroutineScope()
        val openUrl = openUrlHandler()

        LaunchedEffect(screen.recordId) {
            try {
                record = repository.getRecord(screen.recordId)
            } catch (e: ResponseException) {
                error = e.message ?: "Server error"
            } catch (e: JsonConvertException) {
                error = e.message ?: "Invalid response from server"
            } catch (e: IOException) {
                error = e.message ?: "Network error"
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
                        try {
                            // Only navigate back if the server confirmed the delete; a false
                            // success means the server rejected it without throwing an HTTP error.
                            if (repository.deleteRecord(screen.recordId)) {
                                navigator.pop()
                            } else {
                                error = "Server refused to delete the record"
                            }
                        } catch (e: ResponseException) {
                            error = e.message ?: "Failed to delete record"
                        } catch (e: IOException) {
                            error = e.message ?: "Network error"
                        }
                    }
                RecordDetailScreen.Event.NavigateBack -> navigator.pop()
                RecordDetailScreen.Event.OpenOnDiscogs ->
                    record?.discogsId?.let { openUrl("https://www.discogs.com/release/$it") }
            }
        }
    }

    @CircuitInject(RecordDetailScreen::class, AppScope::class)
    @AssistedFactory
    fun interface Factory {
        fun create(screen: RecordDetailScreen, navigator: Navigator): RecordDetailPresenter
    }
}
