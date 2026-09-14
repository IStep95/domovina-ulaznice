// Tanki klijent prema Workeru (`/api/*`). Aplikacija NIKAD ne razgovara s
// domovina-api izravno — isto pravilo kao SPA (`src/lib/api.ts`).
package ai.domovina.ulaznice.data

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder

class ApiException(val code: String, val status: Int) : Exception(Poruke.tekst(code))

object ApiClient {
    private val json = Json { ignoreUnknownKeys = true; explicitNulls = false; coerceInputValues = true }

    suspend fun dogadjaji(): List<EventView> = get<EventsResponse>("/api/dogadjaji").events
    suspend fun dogadjaj(slug: String): EventView = get("/api/dogadjaj/${enc(slug)}")
    suspend fun narudzba(id: String): OrderView = get("/api/ulaznice/${enc(id)}")
    suspend fun kreirajNarudzbu(p: CreateOrderRequest): CreateOrderResponse = post("/api/narudzba", json.encodeToString(p))

    /** Prenosi ulaznice u aplikaciju. ⚠️ Ako su tokeni iz e-maila već potrošeni,
     *  jezgra izdaje NOVE i stari QR prestaje vrijediti (`stariQrPonisten`). */
    suspend fun preuzmi(orderId: String, buyerEmail: String): TransferResponse =
        post("/api/ulaznice/${enc(orderId)}/preuzmi", json.encodeToString(mapOf("buyer_email" to buyerEmail)))

    private fun enc(s: String) = URLEncoder.encode(s, "UTF-8")

    private suspend inline fun <reified T> get(path: String): T = send(path, "GET", null)
    private suspend inline fun <reified T> post(path: String, body: String): T = send(path, "POST", body)

    private suspend inline fun <reified T> send(path: String, method: String, body: String?): T = withContext(Dispatchers.IO) {
        val text: String
        val status: Int
        try {
            val conn = URL(Postavke.baseUrl.trimEnd('/') + path).openConnection() as HttpURLConnection
            conn.requestMethod = method
            conn.connectTimeout = 15_000
            conn.readTimeout = 20_000
            conn.setRequestProperty("accept", "application/json")
            if (body != null) {
                conn.doOutput = true
                conn.setRequestProperty("content-type", "application/json")
                conn.outputStream.use { it.write(body.toByteArray()) }
            }
            status = conn.responseCode
            val stream = if (status in 200..299) conn.inputStream else (conn.errorStream ?: conn.inputStream)
            text = stream?.bufferedReader()?.use { it.readText() } ?: ""
            conn.disconnect()
        } catch (e: IOException) {
            throw ApiException("mreza", 0)
        }
        if (status !in 200..299) {
            val code = runCatching { json.decodeFromString<ErrBody>(text).error }.getOrNull() ?: "http_$status"
            throw ApiException(code, status)
        }
        try {
            json.decodeFromString<T>(text)
        } catch (e: Exception) {
            throw ApiException("neispravan_odgovor", status)
        }
    }
}

/** Poruke grešaka na hrvatskom — kod s backenda je strojni (`src/lib/api.ts::PORUKE`). */
object Poruke {
    private val mapa = mapOf(
        "event_not_found" to "Događaj nije pronađen.",
        "tier_not_found" to "Odabrana vrsta ulaznice više ne postoji.",
        "tier_sold_out" to "Ulaznice te vrste su rasprodane.",
        "sale_not_started" to "Prodaja za tu vrstu ulaznice još nije počela.",
        "sale_ended" to "Prodaja za tu vrstu ulaznice je zatvorena.",
        "holders_incomplete" to "Za imenske ulaznice upišite ime i prezime za svaku ulaznicu.",
        "organizer_not_connected" to "Organizator još nije povezao račun za naplatu.",
        "organizer_charges_disabled" to "Organizatorov račun za naplatu još nije aktivan.",
        "invalid_buyer_email" to "Upišite ispravnu e-mail adresu.",
        "invalid_quantity" to "Odaberite između 1 i 10 ulaznica.",
        "invalid_order_id" to "To ne izgleda kao broj narudžbe.",
        "order_not_found" to "Narudžba nije pronađena.",
        "narudzba_nije_placena" to "Narudžba još nije plaćena.",
        "nema_email_adrese" to "Za ovu narudžbu nemamo e-mail adresu.",
        "email_ne_odgovara" to "E-mail se ne podudara s narudžbom.",
        "previse_pokusaja" to "Previše pokušaja — pokušajte za koju minutu.",
        "rotacija_nije_uspjela" to "Nismo uspjeli izdati nove QR kodove. Javite se podršci.",
        "stripe_not_configured" to "Naplata trenutačno nije dostupna.",
        "not_found" to "Ovo okruženje još ne prodaje ulaznice.",
        "mreza" to "Nema veze s poslužiteljem. Provjerite internet.",
        "neispravan_odgovor" to "Poslužitelj je vratio neočekivan odgovor.",
        "nema_vazecih_ulaznica" to "Sve ulaznice iz ove narudžbe su već iskorištene ili poništene.",
    )
    fun tekst(code: String) = mapa[code] ?: "Nešto je pošlo po zlu. Pokušajte ponovno."
}
