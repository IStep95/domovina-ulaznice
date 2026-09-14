// „Moje ulaznice" na uređaju.
//
// Aplikacija nema korisnički račun (kupac ga nema ni na webu — docs/02 §5):
// narudžba je `order_id` + e-mail kupca, oboje spremljeno lokalno. Stanje
// narudžbe i popis ulaznica su UVIJEK s Workera (jezgra je izvor istine);
// lokalno je samo popis narudžbi koje ovaj uređaj poznaje i QR tokeni koje je
// jezgra izdala baš ovom uređaju (SecureStore).
package ai.domovina.ulaznice.data

import android.content.Context
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

@Serializable
data class SpremljenaNarudzba(
    @SerialName("order_id") val orderId: String,
    @SerialName("buyer_email") val buyerEmail: String,
    @SerialName("event_title") val eventTitle: String? = null,
    @SerialName("event_starts_at") val eventStartsAt: String? = null,
    @SerialName("event_timezone") val eventTimezone: String? = null,
    val mjesto: String? = null,
    val state: String? = null,
    val quantity: Int? = null,
    @SerialName("amount_cents") val amountCents: Int? = null,
    val dodano: Long,
    /** true dok se čeka webhook nakon povratka sa Stripea */
    @SerialName("ceka_placanje") val cekaPlacanje: Boolean = false,
    /** epoch ms kad su ulaznice prenesene u aplikaciju (QR u SecureStoreu) */
    val preneseno: Long? = null,
)

@Serializable
data class LokalnaUlaznica(val serial: String, @SerialName("holder_name") val holderName: String? = null, @SerialName("qr_token") val qrToken: String)

class OrderStore private constructor(ctx: Context) {
    companion object {
        @Volatile private var inst: OrderStore? = null
        fun get(ctx: Context): OrderStore = inst ?: synchronized(this) { inst ?: OrderStore(ctx.applicationContext).also { inst = it } }
        val UUID_RE = Regex("[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}", RegexOption.IGNORE_CASE)
        /** Parsira `order_id` iz UUID-a, linka `…/ulaznice/<id>` ili `domovina-ulaznice://narudzba/<id>`. */
        fun orderIdIz(text: String): String? = UUID_RE.find(text)?.value?.lowercase()
    }

    private val json = Json { ignoreUnknownKeys = true }
    private val prefs = ctx.getSharedPreferences("ulaznice.narudzbe", Context.MODE_PRIVATE)
    private val secure = SecureStore(ctx)

    private val _narudzbe = MutableStateFlow(ucitaj())
    val narudzbe: StateFlow<List<SpremljenaNarudzba>> = _narudzbe

    private fun ucitaj(): List<SpremljenaNarudzba> =
        runCatching { json.decodeFromString<List<SpremljenaNarudzba>>(prefs.getString("v1", "[]") ?: "[]") }
            .getOrDefault(emptyList()).sortedByDescending { it.dodano }

    private fun spremi(list: List<SpremljenaNarudzba>) {
        _narudzbe.value = list
        prefs.edit().putString("v1", json.encodeToString(list)).apply()
    }

    fun nadji(orderId: String) = _narudzbe.value.firstOrNull { it.orderId == orderId }

    fun dodaj(orderId: String, buyerEmail: String, event: EventView? = null, cekaPlacanje: Boolean = false) {
        val id = orderId.lowercase()
        val cur = _narudzbe.value
        val i = cur.indexOfFirst { it.orderId == id }
        spremi(
            if (i >= 0) cur.toMutableList().also { it[i] = it[i].copy(buyerEmail = buyerEmail, cekaPlacanje = cekaPlacanje || it[i].cekaPlacanje) }
            else listOf(
                SpremljenaNarudzba(
                    orderId = id, buyerEmail = buyerEmail, eventTitle = event?.title, eventStartsAt = event?.event?.startsAt,
                    eventTimezone = event?.event?.timezone, mjesto = event?.mjesto, dodano = System.currentTimeMillis(), cekaPlacanje = cekaPlacanje,
                ),
            ) + cur,
        )
    }

    fun azuriraj(o: OrderView) {
        val cur = _narudzbe.value
        val i = cur.indexOfFirst { it.orderId == o.orderId.lowercase() }
        if (i < 0) return
        val n = cur[i].copy(
            state = o.state, quantity = o.quantity, amountCents = o.amountCents,
            eventTitle = o.event?.title ?: cur[i].eventTitle, eventStartsAt = o.event?.startsAt ?: cur[i].eventStartsAt,
            eventTimezone = o.event?.timezone ?: cur[i].eventTimezone, mjesto = o.event?.mjesto ?: cur[i].mjesto,
            cekaPlacanje = if (o.state != "pending") false else cur[i].cekaPlacanje,
        )
        spremi(cur.toMutableList().also { it[i] = n })
    }

    fun ukloni(orderId: String) {
        secure.remove(orderId)
        spremi(_narudzbe.value.filter { it.orderId != orderId })
    }

    fun obrisiSve() {
        secure.clear()
        spremi(emptyList())
    }

    fun ulaznice(orderId: String): List<LokalnaUlaznica> =
        secure.get(orderId)?.let { runCatching { json.decodeFromString<List<LokalnaUlaznica>>(it) }.getOrNull() } ?: emptyList()

    /** Prijenos s Workera → SecureStore. Vraća (je li stari QR poništen, broj ulaznica). */
    suspend fun prenesi(n: SpremljenaNarudzba): Pair<Boolean, Int> {
        val r = ApiClient.preuzmi(n.orderId, n.buyerEmail)
        if (r.status != "preuzeto") throw ApiException(r.status, 200)
        val list = r.tickets.filter { it.qrToken != null && it.state == "issued" }
            .map { LokalnaUlaznica(it.serial, it.holderName, it.qrToken!!) }
        secure.put(n.orderId, json.encodeToString(list))
        val cur = _narudzbe.value
        val i = cur.indexOfFirst { it.orderId == n.orderId }
        if (i >= 0) spremi(cur.toMutableList().also { it[i] = it[i].copy(preneseno = System.currentTimeMillis()) })
        return r.stariQrPonisten to list.size
    }
}
