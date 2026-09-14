package ai.domovina.ulaznice.ui

import ai.domovina.ulaznice.data.ApiClient
import ai.domovina.ulaznice.data.EventView
import ai.domovina.ulaznice.data.TierView
import ai.domovina.ulaznice.util.Format
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.outlined.DateRange
import androidx.compose.material.icons.outlined.Email
import androidx.compose.material.icons.outlined.Person
import androidx.compose.material.icons.outlined.Place
import androidx.compose.material.icons.outlined.VerifiedUser
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun EventDetailScreen(slug: String, onBack: () -> Unit, onKupi: (EventView, TierView) -> Unit) {
    var ev by remember { mutableStateOf<EventView?>(null) }
    var greska by remember { mutableStateOf<String?>(null) }
    LaunchedEffect(slug) { try { ev = ApiClient.dogadjaj(slug) } catch (e: Exception) { greska = e.message } }

    Scaffold(topBar = {
        TopAppBar(
            title = { Text(ev?.title ?: "Događaj", maxLines = 1, overflow = TextOverflow.Ellipsis) },
            navigationIcon = { IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "Natrag") } },
        )
    }) { pad ->
        val e = ev
        when {
            e == null && greska != null -> Prazno("Ne mogu učitati", greska!!)
            e == null -> Ucitavanje()
            else -> Column(Modifier.padding(pad).fillMaxSize().verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Naslovnica(e)
                Kartica(Modifier.padding(horizontal = 16.dp)) {
                    IkonaTekst(Icons.Outlined.DateRange, Format.termin(e.event?.startsAt, e.event?.endsAt, e.event?.timezone))
                    if (e.mjesto.isNotEmpty()) IkonaTekst(Icons.Outlined.Place, e.mjesto)
                    e.event?.venueAddress?.takeIf { it.isNotBlank() }?.let { Text(it, Modifier.padding(start = 21.dp), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant) }
                    e.event?.organizerName?.takeIf { it.isNotBlank() }?.let { IkonaTekst(Icons.Outlined.Person, it) }
                }
                e.event?.descriptionHr?.takeIf { it.isNotBlank() }?.let { Text(it, Modifier.padding(horizontal = 16.dp), style = MaterialTheme.typography.bodyLarge) }

                Column(Modifier.padding(horizontal = 16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    NaslovSekcije("Ulaznice")
                    if (e.tiers.isEmpty()) Text("Organizator još nije objavio cjenik.", color = MaterialTheme.colorScheme.onSurfaceVariant)
                    e.tiers.forEach { t -> TierCard(t, e.kupovno, Brand.boja(e.brand?.accentColor)) { onKupi(e, t) } }
                    if (!e.kupovno && e.tiers.any { it.buyable }) {
                        Text(
                            if (e.stripeConnected) "Organizatorov račun za naplatu još nije aktivan." else "Organizator još nije povezao račun za naplatu.",
                            style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
                Column(Modifier.padding(16.dp, 8.dp, 16.dp, 24.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    IkonaTekst(Icons.Outlined.VerifiedUser, "Plaćate izravno organizatoru, bez naknade posrednika.")
                    IkonaTekst(Icons.Outlined.Email, "Ulaznice stižu e-mailom i u ovu aplikaciju.")
                    e.brand?.termsUrl?.let { Text("Uvjeti organizatora: $it", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.primary) }
                }
            }
        }
    }
}

/** Slika događaja s gradijentom i naslovom preko nje; bez slike — brend gradijent. */
@Composable
private fun Naslovnica(e: EventView) {
    val oblik = RoundedCornerShape(Brand.RadiusKartica)
    Box(Modifier.padding(16.dp, 8.dp, 16.dp, 0.dp).fillMaxWidth().height(220.dp).clip(oblik)) {
        val url = e.event?.coverImageUrl ?: e.brand?.heroUrl
        if (url != null) AsyncImage(model = url, contentDescription = null, contentScale = ContentScale.Crop, modifier = Modifier.fillMaxSize())
        else Box(Modifier.fillMaxSize().background(Brush.linearGradient(listOf(Brand.Zelena, Brand.ZelenaTamna))))
        Box(Modifier.fillMaxSize().background(Brush.verticalGradient(0.4f to Color.Transparent, 1f to Color.Black.copy(alpha = 0.65f))))
        Column(Modifier.align(Alignment.BottomStart).padding(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            e.event?.organizerName?.takeIf { it.isNotBlank() }?.let { Text(it.uppercase(), style = MaterialTheme.typography.labelSmall, color = Color.White.copy(alpha = 0.85f)) }
            Text(e.title, style = MaterialTheme.typography.headlineMedium, color = Color.White, maxLines = 3, overflow = TextOverflow.Ellipsis)
        }
    }
}

@Composable
fun TierCard(t: TierView, kupovno: Boolean, boja: Color = MaterialTheme.colorScheme.primary, onKupi: () -> Unit) {
    val status = when {
        t.soldOut -> "rasprodano" to MaterialTheme.colorScheme.crvena
        t.notStarted -> "prodaja počinje ${Format.datumVrijeme(t.saleStart)}" to Brand.Narancasta
        t.ended -> "prodaja zatvorena" to MaterialTheme.colorScheme.crvena
        t.available != null && t.available <= 20 -> "još ${t.available}" to Brand.Narancasta
        else -> null
    }
    Kartica(padding = PaddingValues(12.dp)) {
        Row(Modifier.height(IntrinsicSize.Min), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Box(Modifier.width(4.dp).fillMaxHeight().padding(vertical = 2.dp).background(boja, RoundedCornerShape(3.dp)))
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(t.title, style = MaterialTheme.typography.titleMedium)
                t.description?.takeIf { it.isNotBlank() }?.let { Text(it, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant) }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                    if (t.imenska) Oznaka("imenska")
                    status?.let { (txt, c) -> Text(txt, style = MaterialTheme.typography.bodySmall, color = c) }
                }
            }
            Column(horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(Format.eur(t.priceCents), style = MaterialTheme.typography.titleMedium)
                SekundarniGumb("Kupi", kompaktan = true, enabled = t.buyable && kupovno, onClick = onKupi)
            }
        }
    }
}
