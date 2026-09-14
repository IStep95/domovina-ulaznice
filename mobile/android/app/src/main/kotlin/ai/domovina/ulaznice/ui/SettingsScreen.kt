package ai.domovina.ulaznice.ui

import ai.domovina.ulaznice.data.Okruzenje
import ai.domovina.ulaznice.data.OrderStore
import ai.domovina.ulaznice.data.Postavke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
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

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen() {
    val ctx = LocalContext.current
    val store = remember { OrderStore.get(ctx) }
    var okruzenje by remember { mutableStateOf(Postavke.okruzenje) }
    var vlastiti by remember { mutableStateOf(Postavke.vlastitiUrl) }
    var potvrdi by remember { mutableStateOf(false) }

    Scaffold(topBar = { TopAppBar(title = { Text("Postavke") }) }) { pad ->
        Column(Modifier.padding(pad).fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text("Poslužitelj", style = MaterialTheme.typography.titleMedium)
            Okruzenje.entries.forEach { o ->
                Row(Modifier.fillMaxWidth().selectable(selected = okruzenje == o, onClick = { okruzenje = o; Postavke.okruzenje = o }).padding(vertical = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                    RadioButton(selected = okruzenje == o, onClick = null)
                    Text(o.naziv, Modifier.padding(start = 8.dp))
                }
            }
            if (okruzenje == Okruzenje.VLASTITO) {
                OutlinedTextField(value = vlastiti, onValueChange = { vlastiti = it; Postavke.vlastitiUrl = it }, label = { Text("https://…") }, singleLine = true, modifier = Modifier.fillMaxWidth())
            }
            Text("Adresa: ${Postavke.baseUrl}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Text("Produkcija je zasad samo najava; prodaja radi na stagingu sa Stripe sandboxom (testne kartice).", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)

            Text("Podaci na uređaju", style = MaterialTheme.typography.titleMedium, modifier = Modifier.padding(top = 12.dp))
            OutlinedButton(onClick = { potvrdi = true }, modifier = Modifier.fillMaxWidth()) { Text("Obriši sve narudžbe i QR kodove s uređaja") }
            Text("Narudžbe ostaju dostupne preko linka iz e-maila. QR kodovi preneseni u aplikaciju se brišu s ovog uređaja.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)

            Text("O aplikaciji", style = MaterialTheme.typography.titleMedium, modifier = Modifier.padding(top = 12.dp))
            Text("Ulaznice bez posrednika: organizator prodaje sa svoje stranice, novac ide izravno njemu.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
    if (potvrdi) AlertDialog(
        onDismissRequest = { potvrdi = false },
        title = { Text("Obrisati sve s uređaja?") },
        confirmButton = { TextButton(onClick = { store.obrisiSve(); potvrdi = false }) { Text("Obriši") } },
        dismissButton = { TextButton(onClick = { potvrdi = false }) { Text("Odustani") } },
    )
}
