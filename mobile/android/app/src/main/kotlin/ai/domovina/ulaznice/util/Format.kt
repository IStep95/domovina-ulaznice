// Prikaz novca i termina — port `src/lib/api.ts::eur/terminHr`.
package ai.domovina.ulaznice.util

import java.math.BigDecimal
import java.text.NumberFormat
import java.time.OffsetDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Currency
import java.util.Locale

object Format {
    private val hr = Locale.forLanguageTag("hr-HR")

    fun eur(cents: Int): String {
        val f = NumberFormat.getCurrencyInstance(hr)
        f.currency = Currency.getInstance("EUR")
        return f.format(BigDecimal(cents).movePointLeft(2))
    }

    fun datum(s: String?): OffsetDateTime? = s?.let { runCatching { OffsetDateTime.parse(it) }.getOrNull() }

    private fun fmt(d: OffsetDateTime, pattern: String, zone: ZoneId): String =
        d.atZoneSameInstant(zone).format(DateTimeFormatter.ofPattern(pattern, hr))

    /**
     * Termin događaja za prikaz. Konvencija: ako je početak točno 00:00 u zoni
     * događaja, satnica još nije objavljena → samo datum; višednevni → raspon.
     */
    fun termin(startsAt: String?, endsAt: String?, timezone: String? = null): String {
        val s = datum(startsAt) ?: return "termin još nije objavljen"
        val zone = runCatching { ZoneId.of(timezone ?: "Europe/Zagreb") }.getOrDefault(ZoneId.of("Europe/Zagreb"))
        val e = datum(endsAt)
        val bezSatnice = fmt(s, "HH:mm", zone) == "00:00"
        val istiDan = e == null || fmt(s, "yyyy-MM-dd", zone) == fmt(e, "yyyy-MM-dd", zone)
        if (bezSatnice) {
            if (e != null && !istiDan) {
                val istiMjesec = fmt(s, "yyyy-MM", zone) == fmt(e, "yyyy-MM", zone)
                return if (istiMjesec) "${fmt(s, "d.", zone)} – ${fmt(e, "d. MMMM yyyy.", zone)}"
                else "${fmt(s, "d. MMMM", zone)} – ${fmt(e, "d. MMMM yyyy.", zone)}"
            }
            return fmt(s, "d. MMMM yyyy.", zone)
        }
        val pocetak = fmt(s, "EEEE, dd.MM.yyyy. HH:mm", zone)
        if (e != null && istiDan) return "$pocetak – ${fmt(e, "HH:mm", zone)}"
        if (e != null) return "$pocetak – ${fmt(e, "dd.MM.yyyy.", zone)}"
        return pocetak
    }

    fun datumVrijeme(s: String?): String = datum(s)?.let { fmt(it, "dd.MM.yyyy. HH:mm", ZoneId.of("Europe/Zagreb")) } ?: "—"
    fun datumVrijeme(epochMs: Long): String =
        java.time.Instant.ofEpochMilli(epochMs).atZone(ZoneId.of("Europe/Zagreb")).format(DateTimeFormatter.ofPattern("dd.MM.yyyy. HH:mm", hr))
}

object Validacija {
    private val re = Regex("^[^\\s@]+@[^\\s@]+\\.[^\\s@]{2,}$")
    fun email(s: String) = s.trim().let { re.matches(it) && it.length <= 200 }
}
