package ai.domovina.ulaznice.ui

import ai.domovina.ulaznice.data.OrderStore
import ai.domovina.ulaznice.data.SpremljenaNarudzba
import ai.domovina.ulaznice.util.Format
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.filled.ConfirmationNumber
import androidx.compose.ui.draw.clip
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.QrCode
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun OrdersScreen(dodajLink: String?, onOpen: (String) -> Unit, onLinkPotrosen: () -> Unit) {
    val ctx = LocalContext.current
    val store = remember { OrderStore.get(ctx) }
    val narudzbe by store.narudzbe.collectAsStateWithLifecycle()
    var dodaj by remember { mutableStateOf(false) }

    // Link iz e-maila / deep linka: poznata narudžba → otvori; nepoznata → dijalog s upisanim linkom.
    if (dodajLink != null && !dodaj) {
        val id = OrderStore.orderIdIz(dodajLink)
        if (id != null && store.nadji(id) != null) { onLinkPotrosen(); onOpen(id) } else dodaj = true
    }

    Scaffold(topBar = {
        TopAppBar(title = { Text("Moje ulaznice") }, actions = { IconButton(onClick = { dodaj = true }) { Icon(Icons.Filled.Add, "Dodaj narudžbu") } })
    }) { pad ->
        if (narudzbe.isEmpty()) {
            Column(Modifier.padding(pad)) {
                Prazno("Još nema ulaznica", "Kupite ulaznicu ili dodajte narudžbu iz e-maila koji ste već dobili.", "Dodaj narudžbu iz e-maila", Icons.Filled.ConfirmationNumber) { dodaj = true }
            }
        } else {
            LazyColumn(Modifier.padding(pad).fillMaxSize(), contentPadding = PaddingValues(16.dp, 8.dp, 16.dp, 24.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                items(narudzbe, key = { it.orderId }) { n -> OrderRow(n) { onOpen(n.orderId) } }
            }
        }
    }
    if (dodaj) AddOrderDialog(
        pocetniLink = dodajLink ?: "",
        onDismiss = { dodaj = false; onLinkPotrosen() },
        onDodano = { id -> dodaj = false; onLinkPotrosen(); onOpen(id) },
    )
}

@Composable
fun OrderRow(n: SpremljenaNarudzba, onClick: () -> Unit) {
    val oblik = RoundedCornerShape(Brand.RadiusKartica)
    Row(
        Modifier.fillMaxWidth().clip(oblik).background(MaterialTheme.colorScheme.surfaceContainer)
            .border(1.dp, MaterialTheme.colorScheme.outlineVariant, oblik).clickable(onClick = onClick).padding(12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
            Text(n.eventTitle ?: "Narudžba", style = MaterialTheme.typography.titleMedium)
            Text(Format.termin(n.eventStartsAt, null, n.eventTimezone), style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            n.mjesto?.takeIf { it.isNotBlank() }?.let { Text(it, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant) }
        }
        Column(horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(4.dp)) {
            val (t, c) = stanjeOznaka(n.state, n.cekaPlacanje)
            Oznaka(t, c)
            if (n.preneseno != null) Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                Icon(Icons.Filled.QrCode, contentDescription = null, Modifier.size(14.dp), tint = MaterialTheme.colorScheme.primary)
                Text("QR na uređaju", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.primary)
            }
        }
    }
}
