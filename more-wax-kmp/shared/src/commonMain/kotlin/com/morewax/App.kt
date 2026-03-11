package com.morewax

import androidx.compose.runtime.Composable
import com.morewax.di.AppGraph
import com.morewax.screens.collection.CollectionPresenter
import com.morewax.screens.collection.CollectionScreen
import com.morewax.screens.collection.CollectionUi
import com.morewax.screens.detail.RecordDetailPresenter
import com.morewax.screens.detail.RecordDetailScreen
import com.morewax.screens.detail.RecordDetailUi
import com.morewax.screens.theme.MoreWaxTheme
import com.slack.circuit.backstack.rememberSaveableBackStack
import com.slack.circuit.foundation.Circuit
import com.slack.circuit.foundation.CircuitCompositionLocals
import com.slack.circuit.foundation.NavigableCircuitContent
import com.slack.circuit.foundation.rememberCircuitNavigator
import com.slack.circuit.runtime.presenter.Presenter
import com.slack.circuit.runtime.screen.Screen
import com.slack.circuit.runtime.ui.Ui
import com.slack.circuit.runtime.ui.ui

/**
 * Root composable for the More'Wax app.
 * Shared across Android, iOS, and Desktop.
 */
@Composable
fun MoreWaxApp(appGraph: AppGraph) {
    val circuit = Circuit.Builder()
        .addPresenterFactory(MoreWaxPresenterFactory(appGraph))
        .addUiFactory(MoreWaxUiFactory())
        .build()

    MoreWaxTheme {
        val backStack = rememberSaveableBackStack(CollectionScreen)
        val navigator = rememberCircuitNavigator(backStack)
        CircuitCompositionLocals(circuit) {
            NavigableCircuitContent(navigator, backStack)
        }
    }
}

/**
 * Factory that creates presenters for each screen.
 * In a production app this would use @CircuitInject code gen,
 * but we wire manually here for clarity and simplicity.
 */
private class MoreWaxPresenterFactory(
    private val appGraph: AppGraph,
) : Presenter.Factory {
    override fun create(
        screen: Screen,
        navigator: com.slack.circuit.runtime.Navigator,
        context: com.slack.circuit.runtime.CircuitContext,
    ): Presenter<*>? = when (screen) {
        is CollectionScreen -> CollectionPresenter(
            repository = appGraph.recordsRepository,
            navigator = navigator,
        )
        is RecordDetailScreen -> RecordDetailPresenter(
            screen = screen,
            repository = appGraph.recordsRepository,
            navigator = navigator,
        )
        else -> null
    }
}

/**
 * Factory that maps each screen to its UI composable.
 */
private class MoreWaxUiFactory : Ui.Factory {
    override fun create(
        screen: Screen,
        context: com.slack.circuit.runtime.CircuitContext,
    ): Ui<*>? = when (screen) {
        is CollectionScreen -> ui<CollectionScreen.State> { state, modifier ->
            CollectionUi(state, modifier)
        }
        is RecordDetailScreen -> ui<RecordDetailScreen.State> { state, modifier ->
            RecordDetailUi(state, modifier)
        }
        else -> null
    }
}
