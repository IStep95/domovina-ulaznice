package ai.domovina.ulaznice.ui

import ai.domovina.ulaznice.data.ApiClient
import ai.domovina.ulaznice.data.OrderStore
import ai.domovina.ulaznice.data.Postavke
import ai.domovina.ulaznice.util.Validacija
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.launch

/** Dodavanje narudžbe kupljene na webu: link iz e-maila (ili sam `order_id`) +
 *  e-mail kupca. Bez e-maila Worker ne izdaje QR tokene. */
@Composable
fun AddOrderDialog(pocetniLink: String, onDismiss: () -> Unit, onDodano: (String) -> Unit) {
    val ctx = LocalContext.current
    val store = remember { OrderStore.get(ctx) }
    val scope = rememberCoroutineScope()
    var link by remember { mutableStateOf(pocetniLink) }
    var email by remember { mutableStateOf(Postavke.zadnjiEmail) }
    var greska by remember { mutableStateOf<String?>(null) }
    var provjerava by remember { mutableStateOf(false) }
    val orderId = OrderStore.orderIdIz(link)

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Dodaj narudžbu") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(
                    value = link, onValueChange = { link = it }, label = { Text("Link „Moje ulaznice“ iz e-maila") }, modifier = Modifier.fillMaxWidth(),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri, capitalization = KeyboardCapitalization.None),
                    isError = link.isNotBlank() && orderId == null,
                    supportingText = { if (link.isNotBlank() && orderId == null) Text("U tekstu nema broja narudžbe.") },
                )
                OutlinedTextField(
                    value = email, onValueChange = { email = it }, label = { Text("E-mail kojim ste kupili") }, singleLine = true, modifier = Modifier.fillMaxWidth(),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email, capitalization = KeyboardCapitalization.None),
                )
                greska?.let { Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall) }
            }
        },
        confirmButton = {
            TextButton(
                enabled = orderId != null && Validacija.email(email) && !provjerava,
                onClick = {
                    scope.launch {
                        provjerava = true
                        try {
                            val o = ApiClient.narudzba(orderId!!)
                            val mail = email.trim()
                            store.dodaj(orderId, mail)
                            store.azuriraj(o)
                            Postavke.zadnjiEmail = mail
                            onDodano(orderId)
                        } catch (e: Exception) { greska = e.message } finally { provjerava = false }
                    }
                },
            ) { Text(if (provjerava) "Provjeravam…" else "Dodaj") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Odustani") } },
    )
}
