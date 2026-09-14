package ai.domovina.ulaznice.ui

import ai.domovina.ulaznice.data.ApiClient
import ai.domovina.ulaznice.data.CreateOrderRequest
import ai.domovina.ulaznice.data.EventView
import ai.domovina.ulaznice.data.Holder
import ai.domovina.ulaznice.data.OrderStore
import ai.domovina.ulaznice.data.Postavke
import ai.domovina.ulaznice.data.TierView
import ai.domovina.ulaznice.util.Format
import ai.domovina.ulaznice.util.Validacija
import android.net.Uri
import androidx.browser.customtabs.CustomTabsIntent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.launch

/** Narudžba → Stripe Checkout u Custom Tabu → polling stanja na ekranu narudžbe.
 *  Redirect NIJE dokaz uplate (docs/03 §4): tek `state == paid` s Workera. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CheckoutScreen(ev: EventView, tier: TierView, onBack: () -> Unit, onNarudzba: (String) -> Unit) {
    val ctx = LocalContext.current
    val store = remember { OrderStore.get(ctx) }
    val scope = rememberCoroutineScope()
    var kolicina by remember { mutableStateOf(1) }
    var email by remember { mutableStateOf(Postavke.zadnjiEmail) }
    val imena = remember { mutableStateListOf("") }
    var salje by remember { mutableStateOf(false) }
    var greska by remember { mutableStateOf<String?>(null) }
    val max = maxOf(1, tier.maxPerOrder)
    val ukupno = tier.priceCents * kolicina
    val valjano = Validacija.email(email) && (!tier.imenska || (0 until kolicina).all { (imena.getOrNull(it) ?: "").trim().length >= 2 })

    fun naruci() = scope.launch {
        greska = null; salje = true
        val mail = email.trim()
        Postavke.zadnjiEmail = mail
        try {
            val holders = if (tier.imenska) (0 until kolicina).map { Holder(imena[it].trim()) } else emptyList()
            val r = ApiClient.kreirajNarudzbu(CreateOrderRequest(ev.campaignId, tier.id, kolicina, mail, holders))
            // Narudžbu pamtimo PRIJE Checkouta: i ako kupac zatvori sve, zna se što je naručio.
            store.dodaj(r.orderId, mail, ev, cekaPlacanje = true)
            CustomTabsIntent.Builder().setShowTitle(true).build().launchUrl(ctx, Uri.parse(r.checkoutUrl))
            onNarudzba(r.orderId)
        } catch (e: Exception) {
            greska = e.message
        } finally { salje = false }
    }

    Scaffold(topBar = {
        TopAppBar(title = { Text("Kupnja") }, navigationIcon = { IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "Natrag") } })
    }) { pad ->
        Column(Modifier.padding(pad).fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text(ev.title, style = MaterialTheme.typography.titleMedium)
            Text("${tier.title} · ${Format.eur(tier.priceCents)} po ulaznici", color = MaterialTheme.colorScheme.onSurfaceVariant)

            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Text("Količina", Modifier.weight(1f))
                OutlinedButton(onClick = { if (kolicina > 1) kolicina-- }, enabled = kolicina > 1) { Text("−") }
                Text("$kolicina", style = MaterialTheme.typography.titleMedium)
                OutlinedButton(onClick = { if (kolicina < max) { kolicina++; while (imena.size < kolicina) imena.add("") } }, enabled = kolicina < max) { Text("+") }
            }

            OutlinedTextField(
                value = email, onValueChange = { email = it }, label = { Text("Vaš e-mail") }, singleLine = true, modifier = Modifier.fillMaxWidth(),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email, capitalization = KeyboardCapitalization.None),
                supportingText = { Text("Na ovu adresu stižu ulaznice i račun. Ista adresa otključava prijenos ulaznica u aplikaciju.") },
            )
            if (tier.imenska) {
                Text("Ime i prezime na ulaznici", style = MaterialTheme.typography.titleSmall)
                (0 until kolicina).forEach { i ->
                    OutlinedTextField(
                        value = imena.getOrNull(i) ?: "", onValueChange = { v -> while (imena.size <= i) imena.add(""); imena[i] = v },
                        label = { Text("Ulaznica ${i + 1}") }, singleLine = true, modifier = Modifier.fillMaxWidth(),
                        keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Words),
                    )
                }
                Text("Imenska ulaznica vrijedi samo uz ime koje se na ulazu može provjeriti.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }

            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text("Ukupno", style = MaterialTheme.typography.titleMedium)
                Text(Format.eur(ukupno), style = MaterialTheme.typography.titleMedium)
            }
            greska?.let { Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall) }
            Button(onClick = { naruci() }, enabled = valjano && !salje, modifier = Modifier.fillMaxWidth()) {
                Text(if (salje) "Rezerviram…" else "Plati karticom")
            }
            Text("Plaćanje obavlja Stripe na računu organizatora. Kartični podaci ne prolaze kroz ovu aplikaciju.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}
