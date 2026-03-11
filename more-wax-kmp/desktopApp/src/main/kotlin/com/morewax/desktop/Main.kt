package com.morewax.desktop

import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Window
import androidx.compose.ui.window.application
import androidx.compose.ui.window.rememberWindowState
import com.morewax.MoreWaxApp
import com.morewax.di.createAppGraph

fun main() = application {
    val appGraph = createAppGraph()

    Window(
        onCloseRequest = ::exitApplication,
        title = "More'Wax",
        state = rememberWindowState(width = 1024.dp, height = 768.dp),
    ) {
        MoreWaxApp(appGraph)
    }
}
