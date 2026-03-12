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
import com.slack.circuit.runtime.CircuitContext
import com.slack.circuit.runtime.Navigator
import com.slack.circuit.runtime.presenter.Presenter
import com.slack.circuit.runtime.screen.Screen
import com.slack.circuit.runtime.ui.Ui
import com.slack.circuit.runtime.ui.ui

/**
 * Root composable shared across Android, iOS, and Desktop.
 * Wires Circuit navigation with Metro-provided dependencies.
 */
@Composable
fun MoreWaxApp(appGraph: AppGraph) {
    val circuit = Circuit.Builder()
        .addPresenterFactory(MoreWaxPresenterFactory(appGraph))
        .addUiFactory(MoreWaxUiFactory())
        .build()

    MoreWaxTheme {
        val backStack = rememberSaveableBackStack(CollectionScreen)
        val navigator = rememberCircuitNavigator(backStack, onRootPop = {})
        CircuitCompositionLocals(circuit) {
            NavigableCircuitContent(navigator, backStack)
        }
    }
}

private class MoreWaxPresenterFactory(private val graph: AppGraph) : Presenter.Factory {
    override fun create(
        screen: Screen,
        navigator: Navigator,
        context: CircuitContext,
    ): Presenter<*>? = when (screen) {
        is CollectionScreen -> CollectionPresenter(graph.recordsRepository, navigator)
        is RecordDetailScreen -> RecordDetailPresenter(screen, graph.recordsRepository, navigator)
        else -> null
    }
}

private class MoreWaxUiFactory : Ui.Factory {
    override fun create(screen: Screen, context: CircuitContext): Ui<*>? = when (screen) {
        is CollectionScreen -> ui<CollectionScreen.State> { state, modifier ->
            CollectionUi(state, modifier)
        }
        is RecordDetailScreen -> ui<RecordDetailScreen.State> { state, modifier ->
            RecordDetailUi(state, modifier)
        }
        else -> null
    }
}
