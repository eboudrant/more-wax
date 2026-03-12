package com.morewax.ios

import androidx.compose.ui.window.ComposeUIViewController
import com.morewax.MoreWaxApp
import com.morewax.di.IosAppGraph

/** Entry point for iOS. Called from Swift via: MainViewControllerKt.MainViewController() */
fun MainViewController() = ComposeUIViewController { MoreWaxApp(IosAppGraph.create()) }
