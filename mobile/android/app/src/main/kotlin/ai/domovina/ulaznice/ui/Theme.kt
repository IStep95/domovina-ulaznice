package ai.domovina.ulaznice.ui

import ai.domovina.ulaznice.R
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/**
 * Dizajn sustav — JEDAN izvor tokena, isti kao iOS `Theme.swift` i web `styles.css`:
 * zelena #2F855A, tamna #14331F, pozadina #F6F7F9, rub #E6E8EB, crvena #B91C1C.
 *
 * Brend je „Domovina ulaznice", ne organizator: `brand.accent_color` se koristi
 * samo kao boja na kartici događaja (`Brand.boja(hex)`), nikad kao tema.
 */
object Brand {
    val Zelena = Color(0xFF2F855A)
    val ZelenaSvijetla = Color(0xFF5DBE8A)
    val ZelenaTamna = Color(0xFF14331F)
    val ZelenaTint = Color(0xFFE9F5EE)
    val ZelenaTintTamna = Color(0xFF1C2E24)
    val Pozadina = Color(0xFFF6F7F9)
    val PozadinaTamna = Color(0xFF0F1412)
    val Papir = Color(0xFFFFFFFF)
    val PapirTamni = Color(0xFF1A211D)
    val Rub = Color(0xFFE6E8EB)
    val RubTamni = Color(0xFF2A332E)
    val Tekst = Color(0xFF14331F)
    val TekstSvijetli = Color(0xFFF2F5F3)
    val TekstMutni = Color(0xFF6B7280)
    val TekstMutniTamni = Color(0xFF9AA39E)
    val Crvena = Color(0xFFB91C1C)
    val Narancasta = Color(0xFFC05621)

    val Radius = 12.dp
    val RadiusKartica = 18.dp
    val RadiusGumb = 14.dp

    /** Boja organizatora (`brand.accent_color`, „#RRGGBB"); nevaljan unos → zelena. */
    fun boja(hex: String?): Color {
        val h = hex?.trim()?.removePrefix("#") ?: return Zelena
        if (h.length != 6) return Zelena
        return h.toLongOrNull(16)?.let { Color(0xFF000000 or it) } ?: Zelena
    }
}

val Manrope = FontFamily(
    Font(R.font.manrope_regular, FontWeight.Normal),
    Font(R.font.manrope_medium, FontWeight.Medium),
    Font(R.font.manrope_semibold, FontWeight.SemiBold),
    Font(R.font.manrope_bold, FontWeight.Bold),
)

private fun st(size: Int, weight: FontWeight, lineHeight: Int, letterSpacing: Float = 0f) =
    TextStyle(fontFamily = Manrope, fontSize = size.sp, fontWeight = weight, lineHeight = lineHeight.sp, letterSpacing = letterSpacing.sp)

private val Tipografija = Typography(
    displaySmall = st(30, FontWeight.Bold, 36),
    headlineMedium = st(24, FontWeight.Bold, 30),
    headlineSmall = st(20, FontWeight.Bold, 26),
    titleLarge = st(20, FontWeight.Bold, 26),
    titleMedium = st(17, FontWeight.SemiBold, 22),
    titleSmall = st(15, FontWeight.SemiBold, 20),
    bodyLarge = st(16, FontWeight.Normal, 23),
    bodyMedium = st(14, FontWeight.Normal, 20),
    bodySmall = st(12, FontWeight.Medium, 16),
    labelLarge = st(16, FontWeight.SemiBold, 20),
    labelMedium = st(14, FontWeight.Medium, 18),
    labelSmall = st(11, FontWeight.Bold, 14, 0.4f),
)

private val Oblici = Shapes(
    extraSmall = RoundedCornerShape(8.dp),
    small = RoundedCornerShape(10.dp),
    medium = RoundedCornerShape(Brand.Radius),
    large = RoundedCornerShape(Brand.RadiusKartica),
    extraLarge = RoundedCornerShape(28.dp),
)

private val Light = lightColorScheme(
    primary = Brand.Zelena, onPrimary = Color.White,
    primaryContainer = Brand.ZelenaTint, onPrimaryContainer = Brand.ZelenaTamna,
    secondary = Brand.ZelenaTamna, onSecondary = Color.White,
    secondaryContainer = Brand.ZelenaTint, onSecondaryContainer = Brand.ZelenaTamna,
    background = Brand.Pozadina, onBackground = Brand.Tekst,
    surface = Brand.Pozadina, onSurface = Brand.Tekst,
    surfaceVariant = Brand.Papir, onSurfaceVariant = Brand.TekstMutni,
    surfaceContainer = Brand.Papir, surfaceContainerLow = Brand.Papir, surfaceContainerHigh = Brand.Papir,
    surfaceContainerHighest = Brand.Papir, surfaceContainerLowest = Brand.Papir,
    outline = Brand.Rub, outlineVariant = Brand.Rub,
    error = Brand.Crvena, onError = Color.White,
)

private val Dark = darkColorScheme(
    primary = Brand.ZelenaSvijetla, onPrimary = Brand.ZelenaTamna,
    primaryContainer = Brand.ZelenaTintTamna, onPrimaryContainer = Brand.ZelenaSvijetla,
    secondary = Brand.ZelenaSvijetla, onSecondary = Brand.ZelenaTamna,
    secondaryContainer = Brand.ZelenaTintTamna, onSecondaryContainer = Brand.ZelenaSvijetla,
    background = Brand.PozadinaTamna, onBackground = Brand.TekstSvijetli,
    surface = Brand.PozadinaTamna, onSurface = Brand.TekstSvijetli,
    surfaceVariant = Brand.PapirTamni, onSurfaceVariant = Brand.TekstMutniTamni,
    surfaceContainer = Brand.PapirTamni, surfaceContainerLow = Brand.PapirTamni, surfaceContainerHigh = Brand.PapirTamni,
    surfaceContainerHighest = Brand.PapirTamni, surfaceContainerLowest = Brand.PapirTamni,
    outline = Brand.RubTamni, outlineVariant = Brand.RubTamni,
    error = Color(0xFFF07171), onError = Brand.ZelenaTamna,
)

@Composable
fun UlazniceTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = if (isSystemInDarkTheme()) Dark else Light,
        typography = Tipografija,
        shapes = Oblici,
        content = content,
    )
}

/** Tint boja u trenutnoj temi (svijetla/tamna). */
val androidx.compose.material3.ColorScheme.zelenaTint: Color
    @Composable get() = if (isSystemInDarkTheme()) Brand.ZelenaTintTamna else Brand.ZelenaTint
val androidx.compose.material3.ColorScheme.narancasta: Color get() = Brand.Narancasta
val androidx.compose.material3.ColorScheme.crvena: Color
    @Composable get() = if (isSystemInDarkTheme()) Color(0xFFF07171) else Brand.Crvena
