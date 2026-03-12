package com.morewax

import androidx.compose.runtime.Composable
import com.morewax.di.AppGraph
import com.morewax.screens.collection.CollectionScreen
import com.morewax.screens.theme.MoreWaxTheme
import com.slack.circuit.backstack.rememberSaveableBackStack
import com.slack.circuit.foundation.CircuitCompositionLocals
import com.slack.circuit.foundation.NavigableCircuitContent
import com.slack.circuit.foundation.rememberCircuitNavigator

@Composable
fun MoreWaxApp(appGraph: AppGraph) {
    MoreWaxTheme {
        val backStack = rememberSaveableBackStack(CollectionScreen)
        val navigator = rememberCircuitNavigator(backStack, onRootPop = {})
        CircuitCompositionLocals(appGraph.circuit) { NavigableCircuitContent(navigator, backStack) }
    }
}
