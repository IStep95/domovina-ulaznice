// Prikaz novca i termina — port `src/lib/api.ts::eur/terminHr`.
import Foundation

enum Format {
    static func eur(_ cents: Int) -> String {
        let f = NumberFormatter()
        f.numberStyle = .currency
        f.currencyCode = "EUR"
        f.locale = Locale(identifier: "hr_HR")
        return f.string(from: NSDecimalNumber(value: cents).dividing(by: 100)) ?? "\(cents / 100),\(String(format: "%02d", cents % 100)) €"
    }

    private static let iso: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()
    private static let isoBezFrakcije: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime]
        return f
    }()

    static func datum(_ s: String?) -> Date? {
        guard let s else { return nil }
        return iso.date(from: s) ?? isoBezFrakcije.date(from: s)
    }

    private static func fmt(_ d: Date, _ format: String, tz: TimeZone) -> String {
        let f = DateFormatter()
        f.locale = Locale(identifier: "hr_HR")
        f.timeZone = tz
        f.dateFormat = format
        return f.string(from: d)
    }

    /**
     Termin događaja za prikaz. Konvencija: ako je početak točno 00:00 u zoni
     događaja, satnica još nije objavljena → samo datum; višednevni → raspon.
     */
    static func termin(_ startsAt: String?, _ endsAt: String?, timezone: String? = nil) -> String {
        guard let s = datum(startsAt) else { return "termin još nije objavljen" }
        let tz = TimeZone(identifier: timezone ?? "Europe/Zagreb") ?? TimeZone(identifier: "Europe/Zagreb")!
        let e = datum(endsAt)
        let bezSatnice = fmt(s, "HH:mm", tz: tz) == "00:00"
        let istiDan = e.map { fmt(s, "yyyy-MM-dd", tz: tz) == fmt($0, "yyyy-MM-dd", tz: tz) } ?? true

        if bezSatnice {
            if let e, !istiDan {
                let istiMjesec = fmt(s, "yyyy-MM", tz: tz) == fmt(e, "yyyy-MM", tz: tz)
                return istiMjesec
                    ? "\(fmt(s, "d.", tz: tz)) – \(fmt(e, "d. MMMM yyyy.", tz: tz))"
                    : "\(fmt(s, "d. MMMM", tz: tz)) – \(fmt(e, "d. MMMM yyyy.", tz: tz))"
            }
            return fmt(s, "d. MMMM yyyy.", tz: tz)
        }
        let pocetak = fmt(s, "EEEE, dd.MM.yyyy. HH:mm", tz: tz)
        if let e, istiDan { return "\(pocetak) – \(fmt(e, "HH:mm", tz: tz))" }
        if let e { return "\(pocetak) – \(fmt(e, "dd.MM.yyyy.", tz: tz))" }
        return pocetak
    }

    static func datumVrijeme(_ s: String?) -> String {
        guard let d = datum(s) else { return "—" }
        return fmt(d, "dd.MM.yyyy. HH:mm", tz: TimeZone(identifier: "Europe/Zagreb")!)
    }
}

enum Validacija {
    static func email(_ s: String) -> Bool {
        let t = s.trimmingCharacters(in: .whitespaces)
        return t.range(of: #"^[^\s@]+@[^\s@]+\.[^\s@]{2,}$"#, options: .regularExpression) != nil && t.count <= 200
    }
}
