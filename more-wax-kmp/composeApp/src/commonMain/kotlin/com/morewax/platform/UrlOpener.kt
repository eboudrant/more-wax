package com.morewax.platform

import androidx.compose.runtime.Composable

/**
 * Returns a lambda that opens a URL in the platform's default browser. The lambda captures the
 * platform context at composition time (Activity on Android), so no static context is needed.
 */
@Composable expect fun openUrlHandler(): (String) -> Unit
