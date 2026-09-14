// Modeli = 1:1 odgovori Workera (`src/lib/api.ts`). Novac je u CENTIMA (Int).
package ai.domovina.ulaznice.data

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class TierView(
    val id: String,
    val title: String,
    val description: String? = null,
    @SerialName("price_cents") val priceCents: Int,
    val imenska: Boolean = false,
    @SerialName("sale_start") val saleStart: String? = null,
    @SerialName("sale_end") val saleEnd: String? = null,
    @SerialName("sold_out") val soldOut: Boolean = false,
    @SerialName("not_started") val notStarted: Boolean = false,
    val ended: Boolean = false,
    val available: Int? = null,
    val buyable: Boolean = false,
) {
    /** Koliko komada smije u jednu narudžbu (Worker: MAX_QTY = 10). */
    val maxPerOrder: Int get() = minOf(10, available ?: 10)
}

@Serializable
data class EventDetails(
    @SerialName("event_type") val eventType: String? = null,
    @SerialName("venue_name") val venueName: String? = null,
    @SerialName("venue_address") val venueAddress: String? = null,
    @SerialName("venue_city") val venueCity: String? = null,
    @SerialName("starts_at") val startsAt: String? = null,
    @SerialName("ends_at") val endsAt: String? = null,
    val timezone: String? = null,
    @SerialName("description_hr") val descriptionHr: String? = null,
    @SerialName("cover_image_url") val coverImageUrl: String? = null,
    @SerialName("organizer_name") val organizerName: String? = null,
    @SerialName("organizer_email") val organizerEmail: String? = null,
    @SerialName("organizer_web") val organizerWeb: String? = null,
)

@Serializable
data class Brand(
    @SerialName("accent_color") val accentColor: String? = null,
    @SerialName("hero_url") val heroUrl: String? = null,
    @SerialName("intro_html") val introHtml: String? = null,
    @SerialName("terms_url") val termsUrl: String? = null,
)

@Serializable
data class EventView(
    @SerialName("campaign_id") val campaignId: String,
    val slug: String,
    val title: String,
    val event: EventDetails? = null,
    val tiers: List<TierView> = emptyList(),
    @SerialName("stripe_connected") val stripeConnected: Boolean = false,
    val kupovno: Boolean = false,
    val brand: Brand? = null,
) {
    val mjesto: String get() = listOfNotNull(event?.venueName, event?.venueCity).filter { it.isNotBlank() }.joinToString(", ")
    val najnizaCijena: Int? get() = tiers.minOfOrNull { it.priceCents }
}

@Serializable data class EventsResponse(val events: List<EventView>)

@Serializable
data class TicketView(
    val serial: String,
    @SerialName("holder_name") val holderName: String? = null,
    val state: String,
    @SerialName("checked_in_at") val checkedInAt: String? = null,
)

@Serializable
data class OrderEvent(
    val title: String,
    val slug: String = "",
    @SerialName("venue_name") val venueName: String? = null,
    @SerialName("venue_city") val venueCity: String? = null,
    @SerialName("starts_at") val startsAt: String? = null,
    @SerialName("ends_at") val endsAt: String? = null,
    val timezone: String? = null,
) {
    val mjesto: String get() = listOfNotNull(venueName, venueCity).filter { it.isNotBlank() }.joinToString(", ")
}

@Serializable
data class OrderView(
    @SerialName("order_id") val orderId: String,
    /** pending | paid | expired | refunded | failed — string da nepoznato stanje ne sruši parser */
    val state: String,
    val quantity: Int,
    @SerialName("amount_cents") val amountCents: Int,
    val currency: String = "eur",
    @SerialName("expires_at") val expiresAt: String? = null,
    @SerialName("paid_at") val paidAt: String? = null,
    @SerialName("buyer_email") val buyerEmail: String? = null,
    val event: OrderEvent? = null,
    val tickets: List<TicketView> = emptyList(),
)

@Serializable
data class Holder(@SerialName("full_name") val fullName: String, val email: String? = null)

@Serializable
data class CreateOrderRequest(
    @SerialName("campaign_id") val campaignId: String,
    @SerialName("tier_id") val tierId: String,
    val quantity: Int,
    @SerialName("buyer_email") val buyerEmail: String,
    val holders: List<Holder>,
)

@Serializable
data class CreateOrderResponse(
    @SerialName("order_id") val orderId: String,
    @SerialName("checkout_url") val checkoutUrl: String,
    @SerialName("amount_cents") val amountCents: Int,
)

@Serializable
data class TransferTicket(
    val serial: String,
    @SerialName("holder_name") val holderName: String? = null,
    val state: String,
    @SerialName("qr_token") val qrToken: String? = null,
)

@Serializable
data class TransferResponse(
    val status: String,
    @SerialName("stari_qr_ponisten") val stariQrPonisten: Boolean = false,
    @SerialName("qr_prefix") val qrPrefix: String? = null,
    val event: OrderEvent? = null,
    val tickets: List<TransferTicket> = emptyList(),
)

@Serializable data class ErrBody(val error: String? = null)
