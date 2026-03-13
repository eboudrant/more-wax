package com.morewax.platform

import androidx.compose.runtime.Composable
import java.awt.Desktop
import java.net.URI

@Composable
actual fun openUrlHandler(): (String) -> Unit {
    return { url -> Desktop.getDesktop().browse(URI(url)) }
}
