package ai.domovina.ulaznice.ui

import ai.domovina.ulaznice.data.ApiClient
import ai.domovina.ulaznice.data.ApiException
import ai.domovina.ulaznice.data.LokalnaUlaznica
import ai.domovina.ulaznice.data.OrderStore
import ai.domovina.ulaznice.data.OrderView
import ai.domovina.ulaznice.util.Format
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.ConfirmationNumber
import androidx.compose.material.icons.filled.QrCode
import androidx.compose.material.icons.outlined.Cancel
import androidx.compose.material.icons.outlined.DateRange
import androidx.compose.material.icons.outlined.Place
import androidx.compose.material.icons.outlined.Schedule
import androidx.compose.material.icons.outlined.Warning
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.AlertDialog
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
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun OrderDetailScreen(orderId: String, onBack: () -> Unit, onQr: (LokalnaUlaznica) -> Unit) {
    val ctx = LocalContext.current
    val store = remember { OrderStore.get(ctx) }
    val scope = rememberCoroutineScope()
    val narudzbe by store.narudzbe.collectAsStateWithLifecycle()
    val spremljena = narudzbe.firstOrNull { it.orderId == orderId }
    var order by remember { mutableStateOf<OrderView?>(null) }
    var greska by remember { mutableStateOf<String?>(null) }
    var poruka by remember { mutableStateOf<String?>(null) }
    var prenosi by remember { mutableStateOf(false) }
    var potvrdi by remember { mutableStateOf(false) }
    var osvjezava by remember { mutableStateOf(false) }
    var verzija by remember { mutableIntStateOf(0) } // za ponovno čitanje lokalnih ulaznica
    val lokalne = remember(orderId, verzija, spremljena?.preneseno) { store.ulaznice(orderId) }
    val ceka = spremljena?.cekaPlacanje == true && (order?.state ?: "pending") == "pending"

    suspend fun ucitaj() {
        try { val o = ApiClient.narudzba(orderId); order = o; greska = null; store.azuriraj(o) }
        catch (e: Exception) { if (order == null) greska = e.message }
    }
    LaunchedEffect(orderId) { ucitaj() }
    // Nakon povratka sa Stripea webhook stiže u sekundi-dvije: kratko poll-amo
    // umjesto da lažemo kupcu da je plaćeno (redirect NIJE dokaz uplate).
    LaunchedEffect(ceka) { var i = 0; while (ceka && i < 15) { delay(2000); i++; ucitaj() } }

    fun prenesi() = scope.launch {
        val n = spremljena ?: return@launch
        prenosi = true; poruka = null
        try {
            val (ponisten, broj) = store.prenesi(n)
            poruka = if (ponisten) "Preneseno $broj ulaznica. Vrijede QR kodovi iz aplikacije — oni iz e-maila više ne rade." else "Preneseno $broj ulaznica."
            verzija++
            ucitaj()
        } catch (e: ApiException) { poruka = e.message } catch (e: Exception) { poruka = e.message } finally { prenosi = false }
    }

    Scaffold(topBar = {
        TopAppBar(title = { Text("Narudžba") }, navigationIcon = { IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "Natrag") } })
    }) { pad ->
        PullToRefreshBox(isRefreshing = osvjezava, onRefresh = { scope.launch { osvjezava = true; ucitaj(); osvjezava = false } }, modifier = Modifier.padding(pad).fillMaxSize()) {
            val o = order
            when {
                o == null && greska != null -> Prazno("Ne mogu učitati narudžbu", greska!!)
                o == null -> Ucitavanje()
                else -> Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text(o.event?.title ?: "Narudžba", style = MaterialTheme.typography.headlineMedium)
                    o.event?.let { ev ->
                        IkonaTekst(Icons.Outlined.DateRange, Format.termin(ev.startsAt, ev.endsAt, ev.timezone))
                        if (ev.mjesto.isNotEmpty()) IkonaTekst(Icons.Outlined.Place, ev.mjesto)
                    }
                    StanjeKartica(o, ceka)
                    Kartica {
                        Redak("Broj ulaznica", "${o.quantity}")
                        HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
                        Redak("Iznos", Format.eur(o.amountCents), istaknuto = true)
                        o.buyerEmail?.let { HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant); Redak("E-mail", it) }
                        if (o.state == "pending" && o.expiresAt != null) { HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant); Redak("Rezervacija vrijedi do", Format.datumVrijeme(o.expiresAt)) }
                    }
                    if (o.state == "paid") {
                        NaslovSekcije("Ulaznice")
                        o.tickets.forEach { t ->
                            val lok = lokalne.firstOrNull { it.serial == t.serial }
                            UlaznicaKartica(gornji = {
                                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.Top) {
                                    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                                        Text(t.holderName ?: "Ulaznica", style = MaterialTheme.typography.titleMedium)
                                        Text(t.serial, style = MaterialTheme.typography.bodySmall, fontFamily = FontFamily.Monospace, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                    }
                                    Icon(Icons.Filled.ConfirmationNumber, null, tint = MaterialTheme.colorScheme.zelenaTint)
                                }
                            }, donji = {
                                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) {
                                    when {
                                        t.state == "checked_in" -> Oznaka("ušlo", MaterialTheme.colorScheme.primary)
                                        t.state == "void" -> Oznaka("poništena", MaterialTheme.colorScheme.crvena)
                                        lok != null -> Oznaka("QR na uređaju", MaterialTheme.colorScheme.primary)
                                        else -> Oznaka("vrijedi")
                                    }
                                    if (lok != null && t.state == "issued") SekundarniGumb("Pokaži QR", kompaktan = true, ikona = Icons.Filled.QrCode) { onQr(lok) }
                                }
                            })
                        }
                        Text(
                            if (lokalne.isEmpty()) "QR kodovi su u e-mailu. Prenesite ih u aplikaciju da ih pokažete na ulazu i bez interneta."
                            else "Preneseno u aplikaciju ${spremljena?.preneseno?.let { Format.datumVrijeme(it) } ?: ""}. QR iz e-maila više ne vrijedi ako je bio izdan ranije.",
                            style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        poruka?.let {
                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                Icon(Icons.Filled.CheckCircle, null, Modifier.size(18.dp), tint = MaterialTheme.colorScheme.primary)
                                Text(it, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.primary)
                            }
                        }
                        PrimarniGumb(if (lokalne.isEmpty()) "Prenesi ulaznice u aplikaciju" else "Ponovno prenesi (novi QR)", enabled = spremljena != null, radi = prenosi) { potvrdi = true }
                        Text("Ako je e-mail s ulaznicama već stigao, prijenos izdaje NOVE QR kodove — stari iz e-maila prestaju vrijediti, uključujući proslijeđene.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            }
        }
    }
    if (potvrdi) AlertDialog(
        onDismissRequest = { potvrdi = false },
        title = { Text("Prenijeti ulaznice u aplikaciju?") },
        text = { Text("QR kodovi će se spremiti na ovaj uređaj. Ako su već bili poslani e-mailom, stari kodovi prestaju vrijediti.") },
        confirmButton = { TextButton(onClick = { potvrdi = false; prenesi() }) { Text("Prenesi") } },
        dismissButton = { TextButton(onClick = { potvrdi = false }) { Text("Odustani") } },
    )
}

@Composable
fun StanjeKartica(o: OrderView, ceka: Boolean) {
    val mutno = MaterialTheme.colorScheme.onSurfaceVariant
    val (naslov, tekst, boja) = when {
        ceka -> Triple("Potvrđujemo plaćanje…", "Plaćanje je zaprimljeno kod Stripea. Ulaznice izdajemo čim potvrda stigne — ovaj ekran se osvježava sam.", Brand.Narancasta)
        o.state == "paid" -> Triple("Plaćeno", "Ulaznice su izdane. Na ulazu pokažite QR kod iz aplikacije ili iz e-maila.", MaterialTheme.colorScheme.primary)
        o.state == "expired" -> Triple("Rezervacija je istekla", "Plaćanje nije stiglo na vrijeme pa su mjesta vraćena u prodaju. Ništa nije naplaćeno.", mutno)
        o.state == "refunded" -> Triple("Vraćeno", "Uplata je vraćena na karticu, a ulaznice su poništene.", mutno)
        o.state == "failed" -> Triple("Plaćanje nije uspjelo", "Ništa nije naplaćeno. Možete pokušati ponovno sa stranice događaja.", MaterialTheme.colorScheme.crvena)
        else -> Triple("Čeka plaćanje", "Mjesta su rezervirana dok rezervacija ne istekne. Ulaznice izdajemo čim plaćanje bude potvrđeno.", Brand.Narancasta)
    }
    val ikona = when {
        ceka || o.state == "pending" -> Icons.Outlined.Schedule
        o.state == "paid" -> Icons.Filled.CheckCircle
        o.state == "failed" -> Icons.Outlined.Warning
        else -> Icons.Outlined.Cancel
    }
    Row(Modifier.fillMaxWidth().background(boja.copy(alpha = 0.10f), RoundedCornerShape(Brand.RadiusKartica)).padding(16.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        Box(Modifier.size(40.dp).background(boja.copy(alpha = 0.15f), CircleShape), contentAlignment = Alignment.Center) {
            if (ceka) CircularProgressIndicator(Modifier.size(18.dp), strokeWidth = 2.dp, color = boja)
            else Icon(ikona, null, Modifier.size(20.dp), tint = boja)
        }
        Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(naslov, style = MaterialTheme.typography.titleMedium)
            Text(tekst, style = MaterialTheme.typography.bodyMedium, color = mutno)
        }
    }
}
