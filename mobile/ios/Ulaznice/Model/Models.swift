// Modeli = 1:1 odgovori Workera (`src/lib/api.ts`). Novac je u CENTIMA (Int),
// nikad Double — isto pravilo kao u cijelom repou.
import Foundation

struct TierView: Codable, Identifiable, Hashable {
    let id: String
    let title: String
    let description: String?
    let priceCents: Int
    let imenska: Bool
    let saleStart: String?
    let saleEnd: String?
    let soldOut: Bool
    let notStarted: Bool
    let ended: Bool
    let available: Int?
    let buyable: Bool

    /** Koliko komada smije u jednu narudžbu (Worker: MAX_QTY = 10). */
    var maxPerOrder: Int { min(10, available ?? 10) }
}

struct EventDetails: Codable, Hashable {
    let eventType: String?
    let venueName: String?
    let venueAddress: String?
    let venueCity: String?
    let startsAt: String?
    let endsAt: String?
    let timezone: String?
    let descriptionHr: String?
    let coverImageUrl: String?
    let organizerName: String?
    let organizerEmail: String?
    let organizerWeb: String?
}

struct Brand: Codable, Hashable {
    let accentColor: String?
    let heroUrl: String?
    let introHtml: String?
    let termsUrl: String?
}

struct EventView: Codable, Identifiable, Hashable {
    var id: String { campaignId }
    let campaignId: String
    let slug: String
    let title: String
    let event: EventDetails?
    let tiers: [TierView]
    let stripeConnected: Bool
    let kupovno: Bool
    let brand: Brand?

    var mjesto: String {
        [event?.venueName, event?.venueCity].compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: ", ")
    }
    var najnizaCijena: Int? { tiers.map(\.priceCents).min() }
}

struct EventsResponse: Codable { let events: [EventView] }

struct TicketView: Codable, Identifiable, Hashable {
    var id: String { serial }
    let serial: String
    let holderName: String?
    let state: String
    let checkedInAt: String?
}

enum OrderState: String, Codable {
    case pending, paid, expired, refunded, failed
    /** Nepoznato stanje s backenda ne smije srušiti dekodiranje. */
    init(from decoder: Decoder) throws {
        let raw = try decoder.singleValueContainer().decode(String.self)
        self = OrderState(rawValue: raw) ?? .pending
    }
}

struct OrderEvent: Codable, Hashable {
    let title: String
    let slug: String
    let venueName: String?
    let venueCity: String?
    let startsAt: String?
    let endsAt: String?
    let timezone: String?
}

struct OrderView: Codable, Hashable {
    let orderId: String
    let state: OrderState
    let quantity: Int
    let amountCents: Int
    let currency: String
    let expiresAt: String?
    let paidAt: String?
    let buyerEmail: String?
    let event: OrderEvent?
    let tickets: [TicketView]
}

struct CreateOrderRequest: Codable {
    struct Holder: Codable { let fullName: String; let email: String? }
    let campaignId: String
    let tierId: String
    let quantity: Int
    let buyerEmail: String
    let holders: [Holder]
}

struct CreateOrderResponse: Codable {
    let orderId: String
    let checkoutUrl: String
    let amountCents: Int
}

struct TransferTicket: Codable, Hashable {
    let serial: String
    let holderName: String?
    let state: String
    let qrToken: String?
}

struct TransferResponse: Codable {
    let status: String            // preuzeto | nema_vazecih_ulaznica
    let stariQrPonisten: Bool?
    let qrPrefix: String?
    let event: OrderEvent?
    let tickets: [TransferTicket]?
}
