import SwiftUI

struct EventDetailView: View {
    let slug: String
    @State private var ev: EventView?
    @State private var greska: String?
    @State private var odabraniTier: TierView?

    var body: some View {
        Group {
            if let ev {
                ScrollView {
                    VStack(alignment: .leading, spacing: Tema.Razmak.l) {
                        Naslovnica(ev: ev)

                        VStack(alignment: .leading, spacing: Tema.Razmak.s) {
                            Label(Format.termin(ev.event?.startsAt, ev.event?.endsAt, timezone: ev.event?.timezone), systemImage: "calendar")
                            if !ev.mjesto.isEmpty { Label(ev.mjesto, systemImage: "mappin.and.ellipse") }
                            if let a = ev.event?.venueAddress, !a.isEmpty {
                                Text(a).font(.sekundarno).foregroundStyle(Tema.tekstMutni).padding(.leading, 28)
                            }
                            if let org = ev.event?.organizerName, !org.isEmpty {
                                Label(org, systemImage: "person.2")
                            }
                        }
                        .font(.tijeloMedium).foregroundStyle(Tema.tekst)
                        .kartica()

                        if let opis = ev.event?.descriptionHr, !opis.isEmpty {
                            Text(opis).font(.tijelo).foregroundStyle(Tema.tekst).lineSpacing(3)
                        }

                        VStack(alignment: .leading, spacing: Tema.Razmak.m) {
                            NaslovSekcije(tekst: "Ulaznice")
                            if ev.tiers.isEmpty {
                                Text("Organizator još nije objavio cjenik.").font(.sekundarno).foregroundStyle(Tema.tekstMutni)
                            }
                            ForEach(ev.tiers) { t in
                                TierRow(tier: t, kupovno: ev.kupovno, boja: Tema.boja(hex: ev.brand?.accentColor)) { odabraniTier = t }
                            }
                            if !ev.kupovno && ev.tiers.contains(where: \.buyable) {
                                Text(ev.stripeConnected
                                     ? "Organizatorov račun za naplatu još nije aktivan."
                                     : "Organizator još nije povezao račun za naplatu.")
                                .font(.sitno).foregroundStyle(Tema.tekstMutni)
                            }
                        }

                        VStack(alignment: .leading, spacing: Tema.Razmak.xs) {
                            Label("Plaćate izravno organizatoru, bez naknade posrednika.", systemImage: "checkmark.shield")
                            Label("Ulaznice stižu e-mailom i u ovu aplikaciju.", systemImage: "envelope")
                            if let terms = ev.brand?.termsUrl, let u = URL(string: terms) {
                                Link(destination: u) { Label("Uvjeti organizatora", systemImage: "doc.text") }.foregroundStyle(Tema.zelena)
                            }
                        }
                        .font(.sekundarno).foregroundStyle(Tema.tekstMutni)
                        .padding(.bottom, Tema.Razmak.xl)
                    }
                    .padding(.horizontal, Tema.Razmak.l)
                }
                .navigationDestination(item: $odabraniTier) { t in CheckoutView(ev: ev, tier: t) }
            } else if let greska {
                PraznoStanje(ikona: "exclamationmark.triangle", naslov: "Ne mogu učitati", opis: greska) {
                    Button("Pokušaj ponovno") { Task { await ucitaj() } }.buttonStyle(.sekundarni)
                }
            } else {
                ProgressView()
            }
        }
        .brandPozadina()
        .navigationTitle(ev?.title ?? "Događaj")
        .navigationBarTitleDisplayMode(.inline)
        .task { await ucitaj() }
        .refreshable { await ucitaj() }
    }

    private func ucitaj() async {
        do { ev = try await ApiClient.shared.dogadjaj(slug: slug); greska = nil }
        catch { greska = error.localizedDescription }
    }
}

/// Slika događaja s gradijentom i naslovom preko nje; bez slike — brend gradijent.
private struct Naslovnica: View {
    let ev: EventView
    var body: some View {
        ZStack(alignment: .bottomLeading) {
            Group {
                if let url = ev.event?.coverImageUrl ?? ev.brand?.heroUrl, let u = URL(string: url) {
                    AsyncImage(url: u) { img in img.resizable().scaledToFill() } placeholder: { Tema.zelenaTint }
                } else {
                    LinearGradient(colors: [Tema.zelena, Tema.zelenaTamna], startPoint: .topLeading, endPoint: .bottomTrailing)
                }
            }
            .frame(height: 220)
            .clipped()
            LinearGradient(colors: [.clear, .black.opacity(0.65)], startPoint: .center, endPoint: .bottom)
            VStack(alignment: .leading, spacing: Tema.Razmak.xs) {
                if let org = ev.event?.organizerName, !org.isEmpty {
                    Text(org.uppercased()).font(.oznaka).tracking(0.6).foregroundStyle(.white.opacity(0.85))
                }
                Text(ev.title).font(.naslov).foregroundStyle(.white).lineLimit(3)
            }
            .padding(Tema.Razmak.l)
        }
        .frame(height: 220)
        .clipShape(RoundedRectangle(cornerRadius: Tema.radiusKartica, style: .continuous))
        .padding(.top, Tema.Razmak.s)
    }
}

struct TierRow: View {
    let tier: TierView
    let kupovno: Bool
    var boja: Color = Tema.zelena
    let odaberi: () -> Void

    private var status: (String, Color)? {
        if tier.soldOut { return ("rasprodano", Tema.crvena) }
        if tier.notStarted { return ("prodaja počinje \(Format.datumVrijeme(tier.saleStart))", Tema.narancasta) }
        if tier.ended { return ("prodaja zatvorena", Tema.crvena) }
        if let a = tier.available, a <= 20 { return ("još \(a)", Tema.narancasta) }
        return nil
    }

    var body: some View {
        HStack(alignment: .center, spacing: Tema.Razmak.m) {
            RoundedRectangle(cornerRadius: 3).fill(boja).frame(width: 4).padding(.vertical, 2)
            VStack(alignment: .leading, spacing: Tema.Razmak.xs) {
                Text(tier.title).font(.podnaslov).foregroundStyle(Tema.tekst)
                if let d = tier.description, !d.isEmpty { Text(d).font(.sekundarno).foregroundStyle(Tema.tekstMutni) }
                HStack(spacing: Tema.Razmak.s) {
                    if tier.imenska { Oznaka(tekst: "imenska") }
                    if let (t, c) = status { Text(t).font(.sitno).foregroundStyle(c) }
                }
            }
            Spacer(minLength: Tema.Razmak.s)
            VStack(alignment: .trailing, spacing: Tema.Razmak.s) {
                Text(Format.eur(tier.priceCents)).font(.podnaslov.monospacedDigit()).foregroundStyle(Tema.tekst)
                Button("Kupi", action: odaberi)
                    .buttonStyle(.sekundarniKompaktan)
                    .disabled(!(tier.buyable && kupovno))
            }
        }
        .kartica(padding: Tema.Razmak.m)
    }
}
