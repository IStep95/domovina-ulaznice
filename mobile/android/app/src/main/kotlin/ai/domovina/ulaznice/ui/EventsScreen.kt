package ai.domovina.ulaznice.ui

import ai.domovina.ulaznice.data.ApiClient
import ai.domovina.ulaznice.data.EventView
import ai.domovina.ulaznice.util.Format
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.filled.ConfirmationNumber
import androidx.compose.material.icons.outlined.DateRange
import androidx.compose.material.icons.outlined.Place
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun EventsScreen(onOpen: (String) -> Unit) {
    var events by remember { mutableStateOf<List<EventView>?>(null) }
    var greska by remember { mutableStateOf<String?>(null) }
    var osvjezava by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    suspend fun ucitaj() {
        try { events = ApiClient.dogadjaji(); greska = null } catch (e: Exception) { greska = e.message }
    }
    LaunchedEffect(Unit) { if (events == null) ucitaj() }

    Scaffold(topBar = { TopAppBar(title = { Text("Događaji") }) }) { pad ->
        PullToRefreshBox(
            isRefreshing = osvjezava,
            onRefresh = { scope.launch { osvjezava = true; ucitaj(); osvjezava = false } },
            modifier = Modifier.padding(pad).fillMaxSize(),
        ) {
            val list = events
            when {
                list == null && greska != null -> Prazno("Nema veze", greska!!, "Pokušaj ponovno", Icons.Outlined.DateRange) { scope.launch { ucitaj() } }
                list == null -> Ucitavanje()
                list.isEmpty() -> Prazno("Nema objavljenih događaja", "Kad organizator objavi događaj, pojavit će se ovdje.", ikona = Icons.Outlined.DateRange)
                else -> LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(16.dp, 8.dp, 16.dp, 24.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    items(list, key = { it.campaignId }) { ev -> EventRow(ev) { onOpen(ev.slug) } }
                }
            }
        }
    }
}

@Composable
fun EventRow(ev: EventView, onClick: () -> Unit) {
    val oblik = RoundedCornerShape(Brand.RadiusKartica)
    Row(
        Modifier.fillMaxWidth().clip(oblik).background(MaterialTheme.colorScheme.surfaceContainer)
            .border(1.dp, MaterialTheme.colorScheme.outlineVariant, oblik).clickable(onClick = onClick).padding(12.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Cover(ev.event?.coverImageUrl ?: ev.brand?.heroUrl, 76)
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(ev.title, style = MaterialTheme.typography.titleMedium, maxLines = 2, overflow = TextOverflow.Ellipsis)
            IkonaTekst(Icons.Outlined.DateRange, Format.termin(ev.event?.startsAt, ev.event?.endsAt, ev.event?.timezone))
            if (ev.mjesto.isNotEmpty()) IkonaTekst(Icons.Outlined.Place, ev.mjesto)
            Row(Modifier.padding(top = 2.dp), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                ev.najnizaCijena?.let { Text("od ${Format.eur(it)}", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.primary) }
                when {
                    ev.kupovno -> {}
                    ev.tiers.isNotEmpty() && ev.tiers.all { it.soldOut } -> Oznaka("rasprodano", MaterialTheme.colorScheme.crvena)
                    ev.tiers.any { it.notStarted } -> Oznaka("uskoro u prodaji", Brand.Narancasta)
                    else -> Oznaka("nije u prodaji")
                }
            }
        }
        Icon(Icons.AutoMirrored.Filled.KeyboardArrowRight, null, Modifier.size(18.dp), tint = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

@Composable
fun IkonaTekst(ikona: ImageVector, tekst: String) {
    Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
        Icon(ikona, null, Modifier.size(15.dp), tint = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(tekst, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 2, overflow = TextOverflow.Ellipsis)
    }
}

@Composable
fun Cover(url: String?, sizeDp: Int) {
    Box(Modifier.size(sizeDp.dp).clip(RoundedCornerShape(14.dp)), contentAlignment = Alignment.Center) {
        if (url != null) {
            AsyncImage(model = url, contentDescription = null, contentScale = ContentScale.Crop, modifier = Modifier.fillMaxSize())
        } else {
            Box(Modifier.fillMaxSize().background(Brush.linearGradient(listOf(Brand.Zelena, Brand.ZelenaTamna))))
            Icon(Icons.Filled.ConfirmationNumber, contentDescription = null, Modifier.size((sizeDp * 0.4).dp), tint = Color.White.copy(alpha = 0.9f))
        }
    }
}
