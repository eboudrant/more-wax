package com.morewax.screens.detail

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Album
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.OpenInBrowser
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.AssistChip
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import coil3.compose.AsyncImage
import com.morewax.domain.model.Record

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun RecordDetailUi(state: RecordDetailScreen.State, modifier: Modifier = Modifier) {
    val onEvent = state.eventSink

    Scaffold(
        modifier = modifier,
        topBar = {
            TopAppBar(
                title = { Text("Record Detail") },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.primaryContainer,
                ),
                navigationIcon = {
                    IconButton(onClick = { onEvent(RecordDetailScreen.Event.NavigateBack) }) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back")
                    }
                },
            )
        },
    ) { padding ->
        when {
            state.isLoading -> Box(Modifier.fillMaxSize().padding(padding), Alignment.Center) {
                CircularProgressIndicator()
            }
            state.error != null -> Box(Modifier.fillMaxSize().padding(padding), Alignment.Center) {
                Text(state.error!!, color = MaterialTheme.colorScheme.error)
            }
            state.record != null -> RecordContent(state.record!!, onEvent, Modifier.padding(padding))
        }

        if (state.showDeleteConfirm) {
            AlertDialog(
                onDismissRequest = { onEvent(RecordDetailScreen.Event.CancelDelete) },
                title = { Text("Remove record?") },
                text = { Text("This will remove the record from your collection.") },
                confirmButton = {
                    TextButton(onClick = { onEvent(RecordDetailScreen.Event.ConfirmDelete) }) {
                        Text("Remove", color = MaterialTheme.colorScheme.error)
                    }
                },
                dismissButton = {
                    TextButton(onClick = { onEvent(RecordDetailScreen.Event.CancelDelete) }) {
                        Text("Cancel")
                    }
                },
            )
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun RecordContent(record: Record, onEvent: (RecordDetailScreen.Event) -> Unit, modifier: Modifier) {
    Column(modifier.fillMaxSize().verticalScroll(rememberScrollState())) {
        // Cover
        if (record.coverPath.isNotEmpty()) {
            AsyncImage(
                model = record.coverPath,
                contentDescription = "${record.artist} \u2013 ${record.title}",
                contentScale = ContentScale.Crop,
                modifier = Modifier.fillMaxWidth().height(300.dp),
            )
        } else {
            Box(Modifier.fillMaxWidth().height(200.dp), Alignment.Center) {
                Icon(Icons.Default.Album, null, Modifier.size(80.dp),
                    tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.3f))
            }
        }

        Column(Modifier.padding(16.dp)) {
            Text(record.artist, style = MaterialTheme.typography.titleMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant)
            Text(record.title, style = MaterialTheme.typography.headlineSmall
                .copy(fontWeight = FontWeight.Bold))

            Spacer(Modifier.height(12.dp))
            MetaRow("Year", record.year)
            MetaRow("Label", record.label)
            MetaRow("Catalog #", record.catalogNumber)
            MetaRow("Format", record.format)
            MetaRow("Country", record.country)
            MetaRow("Barcode", record.barcode)

            if (record.genres.isNotEmpty()) {
                Spacer(Modifier.height(12.dp))
                Text("Genres", style = MaterialTheme.typography.labelLarge)
                FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    record.genres.forEach { AssistChip(onClick = {}, label = { Text(it) }) }
                }
            }
            if (record.styles.isNotEmpty()) {
                Spacer(Modifier.height(8.dp))
                Text("Styles", style = MaterialTheme.typography.labelLarge)
                FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    record.styles.forEach { AssistChip(onClick = {}, label = { Text(it) }) }
                }
            }

            // Prices
            if (record.priceLow != null || record.priceMedian != null || record.priceHigh != null) {
                Spacer(Modifier.height(12.dp))
                HorizontalDivider()
                Spacer(Modifier.height(12.dp))
                Text("Marketplace", style = MaterialTheme.typography.labelLarge)
                Spacer(Modifier.height(4.dp))
                PriceRow("Low", record.priceLow, record.priceCurrency)
                PriceRow("Median", record.priceMedian, record.priceCurrency)
                PriceRow("High", record.priceHigh, record.priceCurrency)
                record.numForSale?.let {
                    Text("$it for sale", style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }

            if (record.notes.isNotEmpty()) {
                Spacer(Modifier.height(12.dp))
                HorizontalDivider()
                Spacer(Modifier.height(12.dp))
                Text("Notes", style = MaterialTheme.typography.labelLarge)
                Text(record.notes, style = MaterialTheme.typography.bodyMedium)
            }

            Spacer(Modifier.height(20.dp))
            HorizontalDivider()
            Spacer(Modifier.height(12.dp))

            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceEvenly) {
                if (record.discogsId.isNotEmpty()) {
                    Button(onClick = { onEvent(RecordDetailScreen.Event.OpenOnDiscogs) }) {
                        Icon(Icons.Default.OpenInBrowser, null, Modifier.size(18.dp))
                        Spacer(Modifier.width(6.dp))
                        Text("Discogs")
                    }
                }
                Button(
                    onClick = { onEvent(RecordDetailScreen.Event.Delete) },
                    colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error),
                ) {
                    Icon(Icons.Default.Delete, null, Modifier.size(18.dp))
                    Spacer(Modifier.width(6.dp))
                    Text("Remove")
                }
            }
            Spacer(Modifier.height(24.dp))
        }
    }
}

@Composable
private fun MetaRow(label: String, value: String) {
    if (value.isNotEmpty()) {
        Row(Modifier.fillMaxWidth().padding(vertical = 2.dp),
            horizontalArrangement = Arrangement.SpaceBetween) {
            Text(label, style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant)
            Text(value, style = MaterialTheme.typography.bodySmall)
        }
    }
}

@Composable
private fun PriceRow(label: String, price: Double?, currency: String) {
    if (price != null) {
        val symbol = when (currency) {
            "USD" -> "$"; "EUR" -> "\u20AC"; "GBP" -> "\u00A3"; "JPY" -> "\u00A5"
            else -> "$currency "
        }
        Row(Modifier.fillMaxWidth().padding(vertical = 1.dp),
            horizontalArrangement = Arrangement.SpaceBetween) {
            Text(label, style = MaterialTheme.typography.bodySmall)
            Text("$symbol${"%.2f".format(price)}", style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.primary)
        }
    }
}
