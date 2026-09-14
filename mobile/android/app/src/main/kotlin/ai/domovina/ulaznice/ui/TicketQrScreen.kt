package ai.domovina.ulaznice.ui

import ai.domovina.ulaznice.data.LokalnaUlaznica
import ai.domovina.ulaznice.util.Qr
import android.app.Activity
import android.view.WindowManager
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.material.icons.Icons
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.ConfirmationNumber
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.FilterQuality
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp

/** Ekran za ulaz: QR na bijelom, svjetlina na maksimum dok je otvoren. */
@Composable
fun TicketQrScreen(u: LokalnaUlaznica, eventTitle: String?, termin: String?, onClose: () -> Unit) {
    val ctx = LocalContext.current
    val bmp = remember(u.qrToken) { Qr.bitmap(u.qrToken) }
    DisposableEffect(Unit) {
        val w = (ctx as? Activity)?.window
        val stara = w?.attributes?.screenBrightness
        w?.attributes = w?.attributes?.apply { screenBrightness = WindowManager.LayoutParams.BRIGHTNESS_OVERRIDE_FULL }
        onDispose { w?.attributes = w?.attributes?.apply { screenBrightness = stara ?: WindowManager.LayoutParams.BRIGHTNESS_OVERRIDE_NONE } }
    }
    val papir = Color.White; val tinta = Brand.ZelenaTamna; val mutno = Brand.TekstMutni
    Column(Modifier.fillMaxSize().background(Brand.Pozadina).safeDrawingPadding().padding(24.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Icon(Icons.Filled.ConfirmationNumber, null, Modifier.size(18.dp), tint = Brand.Zelena)
            Text("  Domovina ulaznice", style = MaterialTheme.typography.labelMedium, color = tinta)
            Spacer(Modifier.weight(1f))
            IconButton(onClick = onClose, modifier = Modifier.background(papir, CircleShape)) { Icon(Icons.Filled.Close, "Zatvori", tint = tinta) }
        }
        Spacer(Modifier.weight(1f))
        UlaznicaKartica(boja = papir, pozadina = Brand.Pozadina, gornji = {
            Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp)) {
                if (bmp != null) {
                    Image(
                        bitmap = bmp.asImageBitmap(), contentDescription = "QR kod ulaznice ${u.serial}",
                        modifier = Modifier.fillMaxWidth(0.82f).aspectRatio(1f), contentScale = ContentScale.Fit, filterQuality = FilterQuality.None,
                    )
                } else Text("QR se ne može iscrtati", color = Color.Red)
                Text(u.serial, style = MaterialTheme.typography.bodySmall, fontFamily = FontFamily.Monospace, color = mutno)
            }
        }, donji = {
            Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(u.holderName ?: "Ulaznica", style = MaterialTheme.typography.headlineSmall, color = tinta, textAlign = TextAlign.Center)
                eventTitle?.let { Text(it, style = MaterialTheme.typography.labelMedium, color = tinta, textAlign = TextAlign.Center) }
                termin?.let { Text(it, style = MaterialTheme.typography.bodySmall, color = mutno, textAlign = TextAlign.Center) }
            }
        })
        Spacer(Modifier.weight(1f))
        Text("Pokažite kod osoblju na ulazu. Vrijedi jednom.", style = MaterialTheme.typography.bodySmall, color = mutno)
    }
}
