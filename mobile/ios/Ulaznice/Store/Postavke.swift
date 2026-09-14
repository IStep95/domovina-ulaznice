// Okruženje prema kojem aplikacija gađa. Zadano: staging (produkcija je danas
// samo najava — CLAUDE.md). Mijenja se u Postavkama.
import Foundation

enum Okruzenje: String, CaseIterable, Identifiable {
    case staging, produkcija, lokalno, mock, vlastito
    var id: String { rawValue }

    var naziv: String {
        switch self {
        case .staging: return "Staging (Stripe sandbox)"
        case .produkcija: return "Produkcija"
        case .lokalno: return "Lokalno (wrangler dev, 8787)"
        case .mock: return "Mock API (mobile/mock-api.mjs, 8797)"
        case .vlastito: return "Vlastita adresa"
        }
    }

    var url: URL? {
        switch self {
        case .staging: return URL(string: "https://ulaznice-staging.domovina.ai")
        case .produkcija: return URL(string: "https://ulaznice.domovina.ai")
        case .lokalno: return URL(string: "http://localhost:8787")
        case .mock: return URL(string: "http://localhost:8797")
        case .vlastito: return nil
        }
    }
}

enum Postavke {
    private static let kOkruzenje = "ulaznice.okruzenje"
    private static let kVlastito = "ulaznice.vlastiti_url"

    static var okruzenje: Okruzenje {
        get { Okruzenje(rawValue: UserDefaults.standard.string(forKey: kOkruzenje) ?? "") ?? .staging }
        set { UserDefaults.standard.set(newValue.rawValue, forKey: kOkruzenje) }
    }

    static var vlastitiURL: String {
        get { UserDefaults.standard.string(forKey: kVlastito) ?? "" }
        set { UserDefaults.standard.set(newValue, forKey: kVlastito) }
    }

    static var baseURL: URL {
        if okruzenje == .vlastito, let u = URL(string: vlastitiURL), u.scheme != nil { return u }
        return okruzenje.url ?? Okruzenje.staging.url!
    }
}
