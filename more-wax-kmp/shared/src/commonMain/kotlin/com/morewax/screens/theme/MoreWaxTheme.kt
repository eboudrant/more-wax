package com.morewax.screens.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

// More'Wax dark blue palette (matching the web app's dark theme)
private val NavyBlue = Color(0xFF1a2332)
private val DarkBlue = Color(0xFF243447)
private val AccentBlue = Color(0xFF4A90D9)
private val LightBlue = Color(0xFF6BADE0)
private val SurfaceDark = Color(0xFF1e2d3d)
private val CardDark = Color(0xFF243447)
private val TextLight = Color(0xFFe8edf2)
private val TextMuted = Color(0xFF8899aa)

private val DarkColorScheme = darkColorScheme(
    primary = AccentBlue,
    onPrimary = Color.White,
    primaryContainer = NavyBlue,
    onPrimaryContainer = TextLight,
    secondary = LightBlue,
    onSecondary = NavyBlue,
    background = NavyBlue,
    onBackground = TextLight,
    surface = SurfaceDark,
    onSurface = TextLight,
    surfaceVariant = CardDark,
    onSurfaceVariant = TextMuted,
    error = Color(0xFFE57373),
    onError = Color.White,
)

private val LightColorScheme = lightColorScheme(
    primary = AccentBlue,
    onPrimary = Color.White,
    primaryContainer = Color(0xFFE3F0FF),
    onPrimaryContainer = NavyBlue,
    secondary = DarkBlue,
    background = Color(0xFFF8FAFC),
    onBackground = NavyBlue,
    surface = Color.White,
    onSurface = NavyBlue,
    surfaceVariant = Color(0xFFF1F5F9),
    onSurfaceVariant = Color(0xFF64748B),
    error = Color(0xFFD32F2F),
)

@Composable
fun MoreWaxTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit,
) {
    val colorScheme = if (darkTheme) DarkColorScheme else LightColorScheme

    MaterialTheme(
        colorScheme = colorScheme,
        content = content,
    )
}
