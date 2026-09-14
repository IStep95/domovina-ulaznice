package ai.domovina.ulaznice.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.foundation.Canvas
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp

// Komponente u kojima se brend stvarno vidi: kartica, gumbi, oznaka, ulaznica.
// Sve ostalo je Material 3 s brend temom (Theme.kt).

/** Bijela kartica s tankim rubom — osnovna površina na brend pozadini. */
@Composable
fun Kartica(modifier: Modifier = Modifier, padding: PaddingValues = PaddingValues(16.dp), content: @Composable ColumnScope.() -> Unit) {
    val oblik = RoundedCornerShape(Brand.RadiusKartica)
    Column(
        modifier
            .fillMaxWidth()
            .clip(oblik)
            .background(MaterialTheme.colorScheme.surfaceContainer)
            .border(1.dp, MaterialTheme.colorScheme.outlineVariant, oblik)
            .padding(padding),
        verticalArrangement = Arrangement.spacedBy(8.dp),
        content = content,
    )
}

/** Puni zeleni gumb za glavnu radnju ekrana. */
@Composable
fun PrimarniGumb(tekst: String, modifier: Modifier = Modifier, enabled: Boolean = true, radi: Boolean = false, ikona: ImageVector? = null, onClick: () -> Unit) {
    Button(
        onClick = onClick, enabled = enabled && !radi,
        modifier = modifier.fillMaxWidth().height(52.dp),
        shape = RoundedCornerShape(Brand.RadiusGumb),
        colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.primary, disabledContainerColor = MaterialTheme.colorScheme.primary.copy(alpha = 0.45f), disabledContentColor = Color.White),
    ) {
        if (radi) CircularProgressIndicator(Modifier.size(20.dp), color = Color.White, strokeWidth = 2.dp)
        else {
            if (ikona != null) { Icon(ikona, null, Modifier.size(18.dp)); Text("  ") }
            Text(tekst, style = MaterialTheme.typography.labelLarge)
        }
    }
}

/** Tintirani gumb za sporednu radnju („Kupi", „Pokaži QR"). */
@Composable
fun SekundarniGumb(tekst: String, modifier: Modifier = Modifier, enabled: Boolean = true, kompaktan: Boolean = false, ikona: ImageVector? = null, onClick: () -> Unit) {
    Button(
        onClick = onClick, enabled = enabled,
        modifier = if (kompaktan) modifier.height(38.dp) else modifier.fillMaxWidth().height(52.dp),
        shape = RoundedCornerShape(if (kompaktan) 10.dp else Brand.RadiusGumb),
        contentPadding = PaddingValues(horizontal = if (kompaktan) 14.dp else 20.dp),
        colors = ButtonDefaults.buttonColors(
            containerColor = MaterialTheme.colorScheme.zelenaTint, contentColor = MaterialTheme.colorScheme.primary,
            disabledContainerColor = MaterialTheme.colorScheme.zelenaTint.copy(alpha = 0.5f), disabledContentColor = MaterialTheme.colorScheme.primary.copy(alpha = 0.45f),
        ),
    ) {
        if (ikona != null) { Icon(ikona, null, Modifier.size(18.dp)); Text("  ") }
        Text(tekst, style = if (kompaktan) MaterialTheme.typography.labelMedium else MaterialTheme.typography.labelLarge)
    }
}

@Composable
fun Prazno(naslov: String, opis: String, akcija: String? = null, ikona: ImageVector? = null, onAkcija: (() -> Unit)? = null) {
    Box(Modifier.fillMaxSize().padding(32.dp), contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp)) {
            if (ikona != null) Box(Modifier.size(84.dp).background(MaterialTheme.colorScheme.zelenaTint, CircleShape), contentAlignment = Alignment.Center) {
                Icon(ikona, null, Modifier.size(36.dp), tint = MaterialTheme.colorScheme.primary)
            }
            Text(naslov, style = MaterialTheme.typography.headlineSmall, textAlign = TextAlign.Center)
            Text(opis, style = MaterialTheme.typography.bodyMedium, textAlign = TextAlign.Center, color = MaterialTheme.colorScheme.onSurfaceVariant)
            if (akcija != null && onAkcija != null) SekundarniGumb(akcija, Modifier.padding(top = 8.dp), onClick = onAkcija)
        }
    }
}

@Composable
fun Ucitavanje() {
    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
}

@Composable
fun Oznaka(tekst: String, boja: Color = MaterialTheme.colorScheme.onSurfaceVariant) {
    Text(
        tekst.uppercase(),
        style = MaterialTheme.typography.labelSmall,
        color = boja,
        modifier = Modifier.background(boja.copy(alpha = 0.13f), CircleShape).padding(horizontal = 8.dp, vertical = 4.dp),
    )
}

@Composable
fun NaslovSekcije(tekst: String) {
    Text(tekst, style = MaterialTheme.typography.titleLarge, color = MaterialTheme.colorScheme.onBackground)
}

@Composable
fun Redak(k: String, v: String, istaknuto: Boolean = false) {
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
        Text(k, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(v, style = if (istaknuto) MaterialTheme.typography.titleMedium else MaterialTheme.typography.bodyLarge, color = MaterialTheme.colorScheme.onSurface)
    }
}

/** Boja + tekst stanja narudžbe (`OrderView.state`). */
@Composable
fun stanjeOznaka(state: String?, ceka: Boolean): Pair<String, Color> = when {
    ceka && (state == null || state == "pending") -> "potvrđujemo…" to Brand.Narancasta
    state == "paid" -> "plaćeno" to MaterialTheme.colorScheme.primary
    state == "pending" -> "čeka plaćanje" to Brand.Narancasta
    state == "expired" -> "isteklo" to MaterialTheme.colorScheme.onSurfaceVariant
    state == "refunded" -> "vraćeno" to MaterialTheme.colorScheme.onSurfaceVariant
    state == "failed" -> "neuspjelo" to MaterialTheme.colorScheme.crvena
    else -> "nepoznato" to MaterialTheme.colorScheme.onSurfaceVariant
}

@Composable
fun Perforacija(modifier: Modifier = Modifier) {
    val boja = MaterialTheme.colorScheme.outlineVariant
    Canvas(modifier.fillMaxWidth().height(2.dp)) {
        drawLine(boja, Offset(0f, size.height / 2), Offset(size.width, size.height / 2), strokeWidth = 1.5f * density,
            pathEffect = PathEffect.dashPathEffect(floatArrayOf(5f * density, 5f * density)))
    }
}

/**
 * Kartica u obliku ulaznice: gornji dio, perforacija s urezima sa strane, donji dio.
 * Urezi su nacrtani na visini perforacije (ne fiksnim omjerom), pa su uvijek poravnati.
 * `pozadina` mora odgovarati pozadini ekrana jer urezi „pokazuju" nju.
 */
@Composable
fun UlaznicaKartica(modifier: Modifier = Modifier, boja: Color = MaterialTheme.colorScheme.surfaceContainer,
                    pozadina: Color = MaterialTheme.colorScheme.background,
                    gornji: @Composable ColumnScope.() -> Unit, donji: @Composable ColumnScope.() -> Unit) {
    val oblik = RoundedCornerShape(Brand.RadiusKartica)
    val rub = MaterialTheme.colorScheme.outlineVariant
    Column(modifier.fillMaxWidth().clip(oblik).background(boja).border(BorderStroke(1.dp, rub), oblik)) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp), content = gornji)
        Box(Modifier.fillMaxWidth()) {
            Perforacija(Modifier.padding(horizontal = 16.dp).align(Alignment.Center))
            Urez(pozadina, rub, Modifier.align(Alignment.CenterStart).offset(x = (-11).dp))
            Urez(pozadina, rub, Modifier.align(Alignment.CenterEnd).offset(x = 11.dp))
        }
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp), content = donji)
    }
}

@Composable
private fun Urez(pozadina: Color, rub: Color, modifier: Modifier) {
    Box(modifier.size(22.dp).background(pozadina, CircleShape).border(1.dp, rub, CircleShape))
}
