import SwiftUI

@main
struct UlazniceApp: App {
    @State private var store = OrderStore.shared
    @State private var otvorenaNarudzba: String?

    init() { Tema.primijeniIzgled() }

    var body: some Scene {
        WindowGroup {
            RootView(otvorenaNarudzba: $otvorenaNarudzba)
                .environment(store)
                .tint(Tema.zelena)
                .onOpenURL { url in
                    // domovina-ulaznice://narudzba/<id>  ili  https://…/ulaznice/<id>
                    if let id = NarudzbaLink.orderId(iz: url.absoluteString) {
                        otvorenaNarudzba = id
                    }
                }
        }
    }
}

struct RootView: View {
    @Binding var otvorenaNarudzba: String?
    @State private var tab = 0

    var body: some View {
        TabView(selection: $tab) {
            EventsListView()
                .tabItem { Label("Događaji", systemImage: "calendar") }
                .tag(0)
            OrdersView(otvorenaNarudzba: $otvorenaNarudzba)
                .tabItem { Label("Moje ulaznice", systemImage: "ticket") }
                .tag(1)
            SettingsView()
                .tabItem { Label("Postavke", systemImage: "gearshape") }
                .tag(2)
        }
        .onChange(of: otvorenaNarudzba) { _, v in
            if v != nil { tab = 1 }
        }
    }
}
