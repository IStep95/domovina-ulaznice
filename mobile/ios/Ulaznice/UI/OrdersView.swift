import SwiftUI

struct OrdersView: View {
    @Binding var otvorenaNarudzba: String?
    @Environment(OrderStore.self) private var store
    @State private var dodaj = false
    @State private var putanja: [OrderRef] = []
    /// Narudžba dodana u sheetu; put se postavlja tek u `onDismiss` — promjena
    /// puta dok se sheet zatvara NavigationStack tiho odbaci (iOS 17/18).
    @State private var otvoriNakonSheeta: String?

    var body: some View {
        NavigationStack(path: $putanja) {
            Group {
                if store.narudzbe.isEmpty {
                    PraznoStanje(ikona: "ticket", naslov: "Još nema ulaznica",
                                 opis: "Kupite ulaznicu ili dodajte narudžbu iz e-maila koji ste već dobili.") {
                        Button("Dodaj narudžbu iz e-maila") { dodaj = true }.buttonStyle(.sekundarni)
                    }
                } else {
                    List {
                        ForEach(store.narudzbe) { n in
                            // NavigationLink skriven u overlayu: chevron crtamo sami unutar kartice,
                            // a swipe-za-brisanje ostaje jer je i dalje List.
                            OrderRow(n: n)
                                .overlay { NavigationLink(value: OrderRef(id: n.orderId)) { EmptyView() }.opacity(0) }
                                .listRowInsets(EdgeInsets(top: 6, leading: Tema.Razmak.l, bottom: 6, trailing: Tema.Razmak.l))
                                .listRowSeparator(.hidden)
                                .listRowBackground(Color.clear)
                        }
                        .onDelete { idx in idx.map { store.narudzbe[$0].orderId }.forEach(store.ukloni) }
                    }
                    .listStyle(.plain)
                    .scrollContentBackground(.hidden)
                }
            }
            .brandPozadina()
            .navigationTitle("Moje ulaznice")
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Button { dodaj = true } label: { Image(systemName: "plus") }
                        .accessibilityLabel("Dodaj narudžbu")
                }
            }
            .navigationDestination(for: OrderRef.self) { ref in OrderDetailView(orderId: ref.id) }
            .sheet(isPresented: $dodaj, onDismiss: {
                if let id = otvoriNakonSheeta { otvoriNakonSheeta = nil; putanja = [OrderRef(id: id)] }
            }) {
                AddOrderView { id in otvoriNakonSheeta = id }
            }
            .onChange(of: otvorenaNarudzba, initial: true) { _, id in
                guard let id else { return }
                otvorenaNarudzba = nil
                if store.narudzbe.contains(where: { $0.orderId == id }) {
                    putanja = [OrderRef(id: id)]
                } else {
                    dodaj = true
                    UserDefaults.standard.set(id, forKey: "ulaznice.link_iz_urla")
                }
            }
        }
    }
}

struct OrderRow: View {
    let n: SpremljenaNarudzba
    var body: some View {
        HStack(spacing: Tema.Razmak.m) {
            VStack(alignment: .leading, spacing: Tema.Razmak.xs) {
                Text(n.eventTitle ?? "Narudžba").font(.podnaslov).foregroundStyle(Tema.tekst).lineLimit(2)
                Text(Format.termin(n.eventStartsAt, nil, timezone: n.eventTimezone)).font(.sekundarno).foregroundStyle(Tema.tekstMutni)
                if let m = n.mjesto, !m.isEmpty { Text(m).font(.sekundarno).foregroundStyle(Tema.tekstMutni).lineLimit(1) }
            }
            Spacer(minLength: Tema.Razmak.s)
            VStack(alignment: .trailing, spacing: Tema.Razmak.s) {
                StanjeOznaka(state: n.state, ceka: n.cekaPlacanje)
                if n.preneseno != nil {
                    Label("QR na uređaju", systemImage: "qrcode").font(.sitno).foregroundStyle(Tema.zelena)
                }
            }
            Image(systemName: "chevron.right").font(.sitno).foregroundStyle(Tema.tekstMutni)
        }
        .kartica(padding: Tema.Razmak.m)
    }
}

struct StanjeOznaka: View {
    let state: OrderState?
    var ceka = false
    var body: some View {
        let (t, c): (String, Color) = {
            if ceka && (state == nil || state == .pending) { return ("potvrđujemo…", Tema.narancasta) }
            switch state {
            case .paid: return ("plaćeno", Tema.zelena)
            case .pending: return ("čeka plaćanje", Tema.narancasta)
            case .expired: return ("isteklo", Tema.tekstMutni)
            case .refunded: return ("vraćeno", Tema.tekstMutni)
            case .failed: return ("neuspjelo", Tema.crvena)
            case nil: return ("nepoznato", Tema.tekstMutni)
            }
        }()
        Oznaka(tekst: t, boja: c)
    }
}
