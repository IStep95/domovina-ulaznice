// „Moje ulaznice" na uređaju.
//
// Aplikacija nema korisnički račun (kupac ga nema ni na webu — docs/02 §5):
// narudžba je `order_id` + e-mail kupca, oboje spremljeno lokalno. Stanje
// narudžbe i popis ulaznica su UVIJEK s Workera (jezgra je izvor istine);
// lokalno je samo popis narudžbi koje ovaj uređaj poznaje i QR tokeni koje je
// jezgra izdala baš ovom uređaju (Keychain).
import Foundation
import Observation

struct SpremljenaNarudzba: Codable, Identifiable, Hashable {
    var id: String { orderId }
    let orderId: String
    var buyerEmail: String
    var eventTitle: String?
    var eventStartsAt: String?
    var eventTimezone: String?
    var mjesto: String?
    var state: OrderState?
    var quantity: Int?
    var amountCents: Int?
    var dodano: Date
    /** true dok se čeka webhook nakon povratka sa Stripea */
    var cekaPlacanje: Bool = false
    /** kad su ulaznice prenesene u aplikaciju (QR u Keychainu) */
    var preneseno: Date?
}

struct LokalnaUlaznica: Codable, Hashable, Identifiable {
    var id: String { serial }
    let serial: String
    let holderName: String?
    let qrToken: String
}

@MainActor
@Observable
final class OrderStore {
    static let shared = OrderStore()

    private(set) var narudzbe: [SpremljenaNarudzba] = []
    private static let kljuc = "ulaznice.narudzbe.v1"

    init() { ucitaj() }

    // MARK: perzistencija popisa (bez tokena!)

    private func ucitaj() {
        guard let data = UserDefaults.standard.data(forKey: Self.kljuc),
              let list = try? JSONDecoder().decode([SpremljenaNarudzba].self, from: data) else { return }
        narudzbe = list.sorted { $0.dodano > $1.dodano }
    }

    private func spremi() {
        if let data = try? JSONEncoder().encode(narudzbe) {
            UserDefaults.standard.set(data, forKey: Self.kljuc)
        }
    }

    // MARK: operacije

    func dodaj(orderId: String, buyerEmail: String, event: EventView? = nil, cekaPlacanje: Bool = false) {
        let id = orderId.lowercased()
        if let i = narudzbe.firstIndex(where: { $0.orderId == id }) {
            narudzbe[i].buyerEmail = buyerEmail
            narudzbe[i].cekaPlacanje = cekaPlacanje || narudzbe[i].cekaPlacanje
        } else {
            narudzbe.insert(SpremljenaNarudzba(
                orderId: id,
                buyerEmail: buyerEmail,
                eventTitle: event?.title,
                eventStartsAt: event?.event?.startsAt,
                eventTimezone: event?.event?.timezone,
                mjesto: event?.mjesto,
                state: nil,
                quantity: nil,
                amountCents: nil,
                dodano: Date(),
                cekaPlacanje: cekaPlacanje
            ), at: 0)
        }
        spremi()
    }

    func azuriraj(_ order: OrderView) {
        guard let i = narudzbe.firstIndex(where: { $0.orderId == order.orderId.lowercased() }) else { return }
        var n = narudzbe[i]
        n.state = order.state
        n.quantity = order.quantity
        n.amountCents = order.amountCents
        if let ev = order.event {
            n.eventTitle = ev.title
            n.eventStartsAt = ev.startsAt
            n.eventTimezone = ev.timezone
            n.mjesto = [ev.venueName, ev.venueCity].compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: ", ")
        }
        if order.state != .pending { n.cekaPlacanje = false }
        narudzbe[i] = n
        spremi()
    }

    func ukloni(_ orderId: String) {
        narudzbe.removeAll { $0.orderId == orderId }
        Keychain.obrisi(orderId)
        spremi()
    }

    func obrisiSve() {
        narudzbe = []
        Keychain.obrisiSve()
        spremi()
    }

    // MARK: QR tokeni (Keychain)

    func ulaznice(za orderId: String) -> [LokalnaUlaznica] {
        guard let data = Keychain.procitaj(orderId),
              let list = try? JSONDecoder().decode([LokalnaUlaznica].self, from: data) else { return [] }
        return list
    }

    /// Vraća false ako Keychain odbije zapis — tokeni tada NISU na uređaju.
    @discardableResult
    func spremiUlaznice(_ list: [LokalnaUlaznica], za orderId: String) -> Bool {
        guard let data = try? JSONEncoder().encode(list), Keychain.spremi(data, za: orderId) else { return false }
        if let i = narudzbe.firstIndex(where: { $0.orderId == orderId }) {
            narudzbe[i].preneseno = Date()
            spremi()
        }
        return true
    }

    /// Prijenos s Workera → Keychain. Vraća je li stari QR (iz e-maila) poništen.
    func prenesi(_ n: SpremljenaNarudzba) async throws -> (poništenStari: Bool, broj: Int) {
        let r = try await ApiClient.shared.preuzmi(orderId: n.orderId, buyerEmail: n.buyerEmail)
        guard r.status == "preuzeto" else {
            throw ApiError(code: r.status, status: 200)
        }
        let list = (r.tickets ?? []).compactMap { t -> LokalnaUlaznica? in
            guard let tok = t.qrToken, t.state == "issued" else { return nil }
            return LokalnaUlaznica(serial: t.serial, holderName: t.holderName, qrToken: tok)
        }
        guard spremiUlaznice(list, za: n.orderId) else { throw ApiError(code: "keychain", status: 0) }
        return (r.stariQrPonisten ?? false, list.count)
    }
}

/// Parsira `order_id` iz UUID-a, linka `…/ulaznice/<id>` ili `domovina-ulaznice://narudzba/<id>`.
enum NarudzbaLink {
    static func orderId(iz text: String) -> String? {
        let re = try! NSRegularExpression(pattern: "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}", options: .caseInsensitive)
        let s = text as NSString
        guard let m = re.firstMatch(in: text, range: NSRange(location: 0, length: s.length)) else { return nil }
        return s.substring(with: m.range).lowercased()
    }
}
