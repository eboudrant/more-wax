package com.morewax.platform

import androidx.compose.runtime.Composable
import platform.Foundation.NSURL
import platform.UIKit.UIApplication

@Composable
actual fun openUrlHandler(): (String) -> Unit {
    return { url -> UIApplication.sharedApplication.openURL(NSURL.URLWithString(url)!!) }
}
