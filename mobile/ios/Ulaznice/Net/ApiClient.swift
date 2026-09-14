// Tanki klijent prema Workeru (`/api/*`). Aplikacija NIKAD ne razgovara s
// domovina-api izravno — isto pravilo kao SPA (`src/lib/api.ts`).
import Foundation

struct ApiError: Error, LocalizedError {
    let code: String
    let status: Int
    var errorDescription: String? { Poruke.tekst(code) }
}

final class ApiClient {
    static let shared = ApiClient()

    private let session: URLSession
    private let decoder: JSONDecoder = {
        let d = JSONDecoder()
        d.keyDecodingStrategy = .convertFromSnakeCase
        return d
    }()
    private let encoder: JSONEncoder = {
        let e = JSONEncoder()
        e.keyEncodingStrategy = .convertToSnakeCase
        return e
    }()

    init() {
        let cfg = URLSessionConfiguration.default
        cfg.timeoutIntervalForRequest = 20
        cfg.waitsForConnectivity = false
        session = URLSession(configuration: cfg)
    }

    var baseURL: URL { Postavke.baseURL }

    // MARK: pozivi

    func dogadjaji() async throws -> [EventView] {
        try await get("/api/dogadjaji", as: EventsResponse.self).events
    }

    func dogadjaj(slug: String) async throws -> EventView {
        try await get("/api/dogadjaj/\(slug.urlPath)", as: EventView.self)
    }

    func narudzba(id: String) async throws -> OrderView {
        try await get("/api/ulaznice/\(id.urlPath)", as: OrderView.self)
    }

    func kreirajNarudzbu(_ p: CreateOrderRequest) async throws -> CreateOrderResponse {
        try await post("/api/narudzba", body: p, as: CreateOrderResponse.self)
    }

    /// Prenosi ulaznice u aplikaciju. ⚠️ Ako su tokeni iz e-maila već potrošeni,
    /// jezgra izdaje NOVE i stari QR prestaje vrijediti (`stariQrPonisten`).
    func preuzmi(orderId: String, buyerEmail: String) async throws -> TransferResponse {
        struct Body: Codable { let buyerEmail: String }
        return try await post("/api/ulaznice/\(orderId.urlPath)/preuzmi", body: Body(buyerEmail: buyerEmail), as: TransferResponse.self)
    }

    // MARK: transport

    private func get<T: Decodable>(_ path: String, as: T.Type) async throws -> T {
        var req = URLRequest(url: baseURL.appending(path: path))
        req.httpMethod = "GET"
        return try await send(req)
    }

    private func post<B: Encodable, T: Decodable>(_ path: String, body: B, as: T.Type) async throws -> T {
        var req = URLRequest(url: baseURL.appending(path: path))
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "content-type")
        req.httpBody = try encoder.encode(body)
        return try await send(req)
    }

    private func send<T: Decodable>(_ req: URLRequest) async throws -> T {
        let (data, resp): (Data, URLResponse)
        do {
            (data, resp) = try await session.data(for: req)
        } catch {
            throw ApiError(code: "mreza", status: 0)
        }
        let status = (resp as? HTTPURLResponse)?.statusCode ?? 0
        guard (200..<300).contains(status) else {
            let code = (try? decoder.decode(ErrBody.self, from: data))?.error ?? "http_\(status)"
            throw ApiError(code: code, status: status)
        }
        do {
            return try decoder.decode(T.self, from: data)
        } catch {
            throw ApiError(code: "neispravan_odgovor", status: status)
        }
    }
}

private struct ErrBody: Decodable { let error: String? }

private extension String {
    var urlPath: String { addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? self }
}

/// Poruke grešaka na hrvatskom — kod s backenda je strojni (`src/lib/api.ts::PORUKE`).
enum Poruke {
    static let mapa: [String: String] = [
        "event_not_found": "Događaj nije pronađen.",
        "tier_not_found": "Odabrana vrsta ulaznice više ne postoji.",
        "tier_sold_out": "Ulaznice te vrste su rasprodane.",
        "sale_not_started": "Prodaja za tu vrstu ulaznice još nije počela.",
        "sale_ended": "Prodaja za tu vrstu ulaznice je zatvorena.",
        "holders_incomplete": "Za imenske ulaznice upišite ime i prezime za svaku ulaznicu.",
        "organizer_not_connected": "Organizator još nije povezao račun za naplatu.",
        "organizer_charges_disabled": "Organizatorov račun za naplatu još nije aktivan.",
        "invalid_buyer_email": "Upišite ispravnu e-mail adresu.",
        "invalid_quantity": "Odaberite između 1 i 10 ulaznica.",
        "invalid_order_id": "To ne izgleda kao broj narudžbe.",
        "order_not_found": "Narudžba nije pronađena.",
        "narudzba_nije_placena": "Narudžba još nije plaćena.",
        "nema_email_adrese": "Za ovu narudžbu nemamo e-mail adresu.",
        "email_ne_odgovara": "E-mail se ne podudara s narudžbom.",
        "previse_pokusaja": "Previše pokušaja — pokušajte za koju minutu.",
        "rotacija_nije_uspjela": "Nismo uspjeli izdati nove QR kodove. Javite se podršci.",
        "stripe_not_configured": "Naplata trenutačno nije dostupna.",
        "not_found": "Ovo okruženje još ne prodaje ulaznice.",
        "mreza": "Nema veze s poslužiteljem. Provjerite internet.",
        "neispravan_odgovor": "Poslužitelj je vratio neočekivan odgovor.",
        "keychain": "Uređaj nije dopustio spremanje ulaznica. Ponovite prijenos.",
    ]
    static func tekst(_ code: String) -> String { mapa[code] ?? "Nešto je pošlo po zlu. Pokušajte ponovno." }
}
