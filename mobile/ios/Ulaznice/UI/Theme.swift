import SwiftUI
import UIKit

/// Dizajn sustav aplikacije — JEDAN izvor tokena za boje, tipografiju, radijuse.
///
/// Vrijednosti su namjerno iste kao u web SPA-u (`src/styles.css`): zelena
/// `#2F855A`, tamna `#14331F`, pozadina `#F6F7F9`, rub `#E6E8EB`, crvena
/// `#B91C1C`, radius 12. Web i aplikacija tako izgledaju kao jedan proizvod.
///
/// Brend je „Domovina ulaznice", ne organizator: `brand.accent_color` iz D1
/// organizatora se koristi samo kao boja na kartici događaja (`Tema.boja(hex:)`),
/// nikad kao tema cijele aplikacije.
enum Tema {
    // MARK: Boje (svijetla / tamna tema)
    static let zelena = Color(light: 0x2F855A, dark: 0x5DBE8A)
    static let zelenaTamna = Color(light: 0x14331F, dark: 0x0B1A11)
    static let zelenaTint = Color(light: 0xE9F5EE, dark: 0x1C2E24)
    static let pozadina = Color(light: 0xF6F7F9, dark: 0x0F1412)
    static let papir = Color(light: 0xFFFFFF, dark: 0x1A211D)
    static let rub = Color(light: 0xE6E8EB, dark: 0x2A332E)
    static let tekst = Color(light: 0x14331F, dark: 0xF2F5F3)
    static let tekstMutni = Color(light: 0x6B7280, dark: 0x9AA39E)
    static let crvena = Color(light: 0xB91C1C, dark: 0xF07171)
    static let narancasta = Color(light: 0xC05621, dark: 0xF6AD55)

    // MARK: Oblik
    static let radius: CGFloat = 12
    static let radiusKartica: CGFloat = 18
    static let radiusGumb: CGFloat = 14

    enum Razmak {
        static let xs: CGFloat = 4
        static let s: CGFloat = 8
        static let m: CGFloat = 12
        static let l: CGFloat = 16
        static let xl: CGFloat = 24
        static let xxl: CGFloat = 32
    }

    /// Boja organizatora (`brand.accent_color`, „#RRGGBB"); nevaljan unos → zelena.
    static func boja(hex: String?) -> Color {
        guard let hex, let v = UInt32(hex.trimmingCharacters(in: CharacterSet(charactersIn: "# ")), radix: 16),
              hex.count >= 6 else { return zelena }
        return Color(light: v, dark: v)
    }

    /// Navigacija i tab bar u brend fontu. Poziva se jednom iz `UlazniceApp`.
    @MainActor static func primijeniIzgled() {
        let nav = UINavigationBarAppearance()
        nav.configureWithDefaultBackground()
        nav.largeTitleTextAttributes = [.font: UIFont.brand(32, weight: .bold), .foregroundColor: UIColor(tekst)]
        nav.titleTextAttributes = [.font: UIFont.brand(17, weight: .semibold), .foregroundColor: UIColor(tekst)]
        UINavigationBar.appearance().standardAppearance = nav
        UINavigationBar.appearance().scrollEdgeAppearance = nav
        UINavigationBar.appearance().tintColor = UIColor(zelena)

        let tab = UITabBarAppearance()
        tab.configureWithDefaultBackground()
        for item in [tab.stackedLayoutAppearance, tab.inlineLayoutAppearance, tab.compactInlineLayoutAppearance] {
            item.normal.titleTextAttributes = [.font: UIFont.brand(11, weight: .medium)]
            item.selected.titleTextAttributes = [.font: UIFont.brand(11, weight: .semibold)]
        }
        UITabBar.appearance().standardAppearance = tab
        UITabBar.appearance().scrollEdgeAppearance = tab
    }
}

// MARK: - Tipografija (Manrope, s Dynamic Typeom)

extension Font {
    /// Manrope u zadanoj težini; ako font nije u bundleu, SwiftUI tiho padne na sistemski.
    static func brand(_ size: CGFloat, weight: Font.Weight = .regular, relativeTo style: Font.TextStyle = .body) -> Font {
        .custom(UIFont.brandIme(weight), size: size, relativeTo: style)
    }

    static let naslovVeliki = brand(30, weight: .bold, relativeTo: .largeTitle)
    static let naslov = brand(24, weight: .bold, relativeTo: .title)
    static let naslovMali = brand(20, weight: .bold, relativeTo: .title2)
    static let podnaslov = brand(17, weight: .semibold, relativeTo: .headline)
    static let tijelo = brand(16, relativeTo: .body)
    static let tijeloMedium = brand(16, weight: .medium, relativeTo: .body)
    static let sekundarno = brand(14, relativeTo: .subheadline)
    static let sekundarnoMedium = brand(14, weight: .medium, relativeTo: .subheadline)
    static let sitno = brand(12, weight: .medium, relativeTo: .caption)
    static let oznaka = brand(11, weight: .bold, relativeTo: .caption2)
    static let gumb = brand(16, weight: .semibold, relativeTo: .body)
}

extension UIFont {
    static func brandIme(_ weight: Font.Weight) -> String {
        switch weight {
        case .bold, .heavy, .black: "Manrope-Bold"
        case .semibold: "Manrope-SemiBold"
        case .medium: "Manrope-Medium"
        default: "Manrope-Regular"
        }
    }
    static func brand(_ size: CGFloat, weight: Font.Weight) -> UIFont {
        UIFont(name: brandIme(weight), size: size) ?? .systemFont(ofSize: size, weight: weight == .bold ? .bold : weight == .semibold ? .semibold : weight == .medium ? .medium : .regular)
    }
}

// MARK: - Boje iz heksa, s tamnom varijantom

extension Color {
    init(light: UInt32, dark: UInt32) {
        self.init(uiColor: UIColor { tc in
            tc.userInterfaceStyle == .dark ? UIColor(hex: dark) : UIColor(hex: light)
        })
    }
}

extension UIColor {
    convenience init(hex: UInt32) {
        self.init(red: CGFloat((hex >> 16) & 0xFF) / 255, green: CGFloat((hex >> 8) & 0xFF) / 255,
                  blue: CGFloat(hex & 0xFF) / 255, alpha: 1)
    }
}
