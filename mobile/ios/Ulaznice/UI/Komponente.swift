import SwiftUI

// Komponente u kojima se brend stvarno vidi: gumbi, kartica, oznaka, ulaznica.
// Sve ostalo je nativni SwiftUI — HIG i Liquid Glass rade posao bolje od kita.

// MARK: - Gumbi

/// Puni zeleni gumb za glavnu radnju ekrana („Kupi", „Plati", „Prenesi").
struct PrimarniGumb: ButtonStyle {
    @Environment(\.isEnabled) private var enabled
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.gumb)
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity, minHeight: 50)
            .padding(.horizontal, Tema.Razmak.l)
            .background(Tema.zelena, in: RoundedRectangle(cornerRadius: Tema.radiusGumb, style: .continuous))
            .opacity(enabled ? 1 : 0.45)
            .scaleEffect(configuration.isPressed ? 0.98 : 1)
            .animation(.spring(duration: 0.25), value: configuration.isPressed)
    }
}

/// Tintirani gumb za sporednu radnju („Dodaj narudžbu", „QR").
struct SekundarniGumb: ButtonStyle {
    @Environment(\.isEnabled) private var enabled
    var kompaktan = false
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(kompaktan ? .sekundarnoMedium : .gumb)
            .foregroundStyle(Tema.zelena)
            .frame(maxWidth: kompaktan ? nil : .infinity, minHeight: kompaktan ? 36 : 50)
            .padding(.horizontal, kompaktan ? Tema.Razmak.m : Tema.Razmak.l)
            .background(Tema.zelenaTint, in: RoundedRectangle(cornerRadius: kompaktan ? 10 : Tema.radiusGumb, style: .continuous))
            .opacity(enabled ? 1 : 0.45)
            .scaleEffect(configuration.isPressed ? 0.97 : 1)
            .animation(.spring(duration: 0.25), value: configuration.isPressed)
    }
}

extension ButtonStyle where Self == PrimarniGumb {
    static var primarni: PrimarniGumb { PrimarniGumb() }
}
extension ButtonStyle where Self == SekundarniGumb {
    static var sekundarni: SekundarniGumb { SekundarniGumb() }
    static var sekundarniKompaktan: SekundarniGumb { SekundarniGumb(kompaktan: true) }
}

// MARK: - Kartica

struct Kartica: ViewModifier {
    var padding: CGFloat = Tema.Razmak.l
    func body(content: Content) -> some View {
        content
            .padding(padding)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Tema.papir, in: RoundedRectangle(cornerRadius: Tema.radiusKartica, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: Tema.radiusKartica, style: .continuous).strokeBorder(Tema.rub, lineWidth: 1))
    }
}

extension View {
    func kartica(padding: CGFloat = Tema.Razmak.l) -> some View { modifier(Kartica(padding: padding)) }
    /// Pozadina cijelog ekrana u brend tonu (umjesto sistemske grupirane sive).
    func brandPozadina() -> some View { background(Tema.pozadina.ignoresSafeArea()) }
}

// MARK: - Oznaka (pilula)

struct Oznaka: View {
    let tekst: String
    var boja: Color = Tema.tekstMutni
    var body: some View {
        Text(tekst)
            .font(.oznaka)
            .textCase(.uppercase)
            .tracking(0.4)
            .foregroundStyle(boja)
            .padding(.horizontal, 8).padding(.vertical, 4)
            .background(boja.opacity(0.13), in: Capsule())
    }
}

// MARK: - Naslov sekcije

struct NaslovSekcije: View {
    let tekst: String
    var body: some View {
        Text(tekst).font(.naslovMali).foregroundStyle(Tema.tekst)
            .frame(maxWidth: .infinity, alignment: .leading)
    }
}

// MARK: - Redak ključ/vrijednost

struct Redak: View {
    let kljuc: String
    let vrijednost: String
    var istaknuto = false
    var body: some View {
        HStack(alignment: .firstTextBaseline) {
            Text(kljuc).font(.sekundarno).foregroundStyle(Tema.tekstMutni)
            Spacer(minLength: Tema.Razmak.m)
            Text(vrijednost)
                .font(istaknuto ? .podnaslov : .tijeloMedium)
                .foregroundStyle(Tema.tekst)
                .multilineTextAlignment(.trailing)
        }
    }
}

// MARK: - Ulaznica (oblik s urezima)

/// Isprekidana crta perforacije.
struct Perforacija: View {
    var boja: Color = Tema.rub
    var body: some View {
        Line().stroke(style: StrokeStyle(lineWidth: 1.5, dash: [5, 5]))
            .foregroundStyle(boja)
            .frame(height: 1.5)
    }
    private struct Line: Shape {
        func path(in r: CGRect) -> Path { var p = Path(); p.move(to: CGPoint(x: r.minX, y: r.midY)); p.addLine(to: CGPoint(x: r.maxX, y: r.midY)); return p }
    }
}

struct UlaznicaKartica<Gornji: View, Donji: View>: View {
    var boja: Color = Tema.papir
    /// Boja iza kartice — urezi je „pokazuju" pa mora odgovarati pozadini ekrana.
    var pozadina: Color = Tema.pozadina
    @ViewBuilder var gornji: () -> Gornji
    @ViewBuilder var donji: () -> Donji

    private let urez: CGFloat = 11

    var body: some View {
        VStack(spacing: 0) {
            gornji().padding(Tema.Razmak.l)
            // Urezi su overlay na perforaciji, pa su uvijek poravnati s njom
            // bez obzira na visinu gornjeg dijela.
            Perforacija()
                .padding(.horizontal, Tema.Razmak.l)
                .overlay(alignment: .leading) { Urez(pozadina: pozadina, r: urez).offset(x: -urez) }
                .overlay(alignment: .trailing) { Urez(pozadina: pozadina, r: urez).offset(x: urez) }
            donji().padding(Tema.Razmak.l)
        }
        .background(boja, in: RoundedRectangle(cornerRadius: Tema.radiusKartica, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: Tema.radiusKartica, style: .continuous).strokeBorder(Tema.rub, lineWidth: 1))
        .clipShape(RoundedRectangle(cornerRadius: Tema.radiusKartica, style: .continuous))
    }

    private struct Urez: View {
        let pozadina: Color
        let r: CGFloat
        var body: some View {
            Circle().fill(pozadina)
                .overlay(Circle().strokeBorder(Tema.rub, lineWidth: 1))
                .frame(width: r * 2, height: r * 2)
        }
    }
}

// MARK: - Naslovnica događaja

struct Cover: View {
    let url: String?
    var size: CGFloat = 72
    var body: some View {
        Group {
            if let url, let u = URL(string: url) {
                AsyncImage(url: u) { img in
                    img.resizable().scaledToFill()
                } placeholder: {
                    Tema.zelenaTint
                }
            } else {
                ZStack {
                    LinearGradient(colors: [Tema.zelena, Tema.zelenaTamna], startPoint: .topLeading, endPoint: .bottomTrailing)
                    Image(systemName: "ticket.fill").font(.system(size: size * 0.38)).foregroundStyle(.white.opacity(0.9))
                }
            }
        }
        .frame(width: size, height: size)
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
    }
}

// MARK: - Prazna stanja

struct PraznoStanje<Akcija: View>: View {
    let ikona: String
    let naslov: String
    let opis: String
    @ViewBuilder var akcija: () -> Akcija

    var body: some View {
        VStack(spacing: Tema.Razmak.m) {
            ZStack {
                Circle().fill(Tema.zelenaTint).frame(width: 84, height: 84)
                Image(systemName: ikona).font(.system(size: 34, weight: .medium)).foregroundStyle(Tema.zelena)
            }
            .padding(.bottom, Tema.Razmak.xs)
            Text(naslov).font(.naslovMali).foregroundStyle(Tema.tekst)
            Text(opis).font(.sekundarno).foregroundStyle(Tema.tekstMutni).multilineTextAlignment(.center)
            akcija().padding(.top, Tema.Razmak.s)
        }
        .padding(Tema.Razmak.xxl)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}
