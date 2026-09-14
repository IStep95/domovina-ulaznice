import SwiftUI

/// Narudžba → Stripe Checkout u SFSafariViewControlleru → polling stanja.
/// Redirect NIJE dokaz uplate (docs/03 §4): tek `state == paid` s Workera.
struct CheckoutView: View {
    let ev: EventView
    let tier: TierView
    @Environment(OrderStore.self) private var store
    @Environment(\.dismiss) private var dismiss

    @State private var kolicina = 1
    @State private var email = UserDefaults.standard.string(forKey: "ulaznice.zadnji_email") ?? ""
    @State private var imena: [String] = [""]
    @State private var salje = false
    @State private var greska: String?
    @State private var checkout: (orderId: String, url: URL)?
    @State private var prikaziSafari = false
    @State private var gotovaNarudzba: OrderRef?

    private var ukupno: Int { tier.priceCents * kolicina }
    private var valjano: Bool {
        Validacija.email(email) && (!tier.imenska || imena.prefix(kolicina).allSatisfy { $0.trimmingCharacters(in: .whitespaces).count >= 2 })
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Tema.Razmak.l) {
                // Što se kupuje
                HStack(spacing: Tema.Razmak.m) {
                    Cover(url: ev.event?.coverImageUrl ?? ev.brand?.heroUrl, size: 56)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(ev.title).font(.podnaslov).foregroundStyle(Tema.tekst).lineLimit(2)
                        Text(tier.title).font(.sekundarno).foregroundStyle(Tema.tekstMutni)
                    }
                }
                .kartica(padding: Tema.Razmak.m)
                .padding(.top, Tema.Razmak.s)

                // Količina
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Količina").font(.tijeloMedium).foregroundStyle(Tema.tekst)
                        Text("\(Format.eur(tier.priceCents)) po ulaznici").font(.sitno).foregroundStyle(Tema.tekstMutni)
                    }
                    Spacer()
                    Stepper(value: $kolicina, in: 1...max(1, tier.maxPerOrder)) {
                        Text("\(kolicina)").font(.naslovMali.monospacedDigit()).foregroundStyle(Tema.tekst)
                            .contentTransition(.numericText())
                            .frame(minWidth: 28)
                    }
                    .fixedSize()
                    .onChange(of: kolicina) { _, n in
                        while imena.count < n { imena.append("") }
                    }
                }
                .kartica()

                // E-mail
                VStack(alignment: .leading, spacing: Tema.Razmak.s) {
                    Text("Vaš e-mail").font(.tijeloMedium).foregroundStyle(Tema.tekst)
                    Polje(placeholder: "ime@primjer.hr", text: $email)
                        .keyboardType(.emailAddress).textContentType(.emailAddress)
                        .textInputAutocapitalization(.never).autocorrectionDisabled()
                    Text("Na ovu adresu stižu ulaznice i račun. Ista adresa otključava prijenos ulaznica u aplikaciju.")
                        .font(.sitno).foregroundStyle(Tema.tekstMutni)
                }
                .kartica()

                // Imena (imenske ulaznice)
                if tier.imenska {
                    VStack(alignment: .leading, spacing: Tema.Razmak.s) {
                        Text("Ime i prezime na ulaznici").font(.tijeloMedium).foregroundStyle(Tema.tekst)
                        ForEach(0..<kolicina, id: \.self) { i in
                            Polje(placeholder: "Ulaznica \(i + 1)", text: Binding(
                                get: { i < imena.count ? imena[i] : "" },
                                set: { v in while imena.count <= i { imena.append("") }; imena[i] = v }
                            ))
                            .textContentType(.name)
                        }
                        Text("Imenska ulaznica vrijedi samo uz ime koje se na ulazu može provjeriti.")
                            .font(.sitno).foregroundStyle(Tema.tekstMutni)
                    }
                    .kartica()
                }

                // Ukupno + plaćanje
                VStack(spacing: Tema.Razmak.m) {
                    HStack {
                        Text("Ukupno").font(.podnaslov).foregroundStyle(Tema.tekst)
                        Spacer()
                        Text(Format.eur(ukupno)).font(.naslovMali.monospacedDigit()).foregroundStyle(Tema.tekst)
                            .contentTransition(.numericText())
                    }
                    .animation(.snappy, value: ukupno)
                    if let greska {
                        Label(greska, systemImage: "exclamationmark.circle").font(.sekundarno).foregroundStyle(Tema.crvena)
                    }
                    Button {
                        Task { await naruci() }
                    } label: {
                        if salje { ProgressView().tint(.white) } else { Label("Plati karticom", systemImage: "creditcard") }
                    }
                    .buttonStyle(.primarni)
                    .disabled(!valjano || salje)
                    Label("Plaćanje obavlja Stripe na računu organizatora. Kartični podaci ne prolaze kroz ovu aplikaciju.", systemImage: "lock.shield")
                        .font(.sitno).foregroundStyle(Tema.tekstMutni)
                }
                .kartica()
                .padding(.bottom, Tema.Razmak.xxl)
            }
            .padding(.horizontal, Tema.Razmak.l)
        }
        .brandPozadina()
        .scrollDismissesKeyboard(.interactively)
        .navigationTitle("Kupnja")
        .navigationBarTitleDisplayMode(.inline)
        .fullScreenCover(isPresented: $prikaziSafari, onDismiss: {
            // Kupac je zatvorio Checkout — pokazujemo narudžbu koja se sama osvježava.
            if let c = checkout { gotovaNarudzba = OrderRef(id: c.orderId) }
        }) {
            if let c = checkout { SafariView(url: c.url).ignoresSafeArea() }
        }
        .navigationDestination(item: $gotovaNarudzba) { ref in
            OrderDetailView(orderId: ref.id, cekaPlacanje: true)
        }
    }

    private func naruci() async {
        greska = nil
        salje = true
        defer { salje = false }
        let mail = email.trimmingCharacters(in: .whitespaces)
        UserDefaults.standard.set(mail, forKey: "ulaznice.zadnji_email")
        let holders = tier.imenska
            ? imena.prefix(kolicina).map { CreateOrderRequest.Holder(fullName: $0.trimmingCharacters(in: .whitespaces), email: nil) }
            : []
        do {
            let r = try await ApiClient.shared.kreirajNarudzbu(CreateOrderRequest(
                campaignId: ev.campaignId, tierId: tier.id, quantity: kolicina, buyerEmail: mail, holders: Array(holders)))
            guard let url = URL(string: r.checkoutUrl) else { greska = Poruke.tekst("neispravan_odgovor"); return }
            // Narudžbu pamtimo PRIJE Checkouta: i ako kupac zatvori sve, zna se što je naručio.
            store.dodaj(orderId: r.orderId, buyerEmail: mail, event: ev, cekaPlacanje: true)
            checkout = (r.orderId, url)
            prikaziSafari = true
        } catch {
            greska = error.localizedDescription
        }
    }
}

/// Tekstualno polje u brend stilu (izvan Forma).
struct Polje: View {
    let placeholder: String
    @Binding var text: String
    var body: some View {
        TextField(placeholder, text: $text)
            .font(.tijelo)
            .padding(.horizontal, Tema.Razmak.m).frame(minHeight: 46)
            .background(Tema.pozadina, in: RoundedRectangle(cornerRadius: Tema.radius, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: Tema.radius, style: .continuous).strokeBorder(Tema.rub))
    }
}

/// Omot za `navigationDestination(item:)` — String sam nije Identifiable.
struct OrderRef: Identifiable, Hashable { let id: String }
