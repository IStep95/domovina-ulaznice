import SwiftUI

struct EventsListView: View {
    @State private var events: [EventView] = []
    @State private var greska: String?
    @State private var ucitava = false

    var body: some View {
        NavigationStack {
            Group {
                if let greska, events.isEmpty {
                    PraznoStanje(ikona: "wifi.slash", naslov: "Nema veze", opis: greska) {
                        Button("Pokušaj ponovno") { Task { await ucitaj() } }.buttonStyle(.sekundarni)
                    }
                } else if events.isEmpty && !ucitava {
                    PraznoStanje(ikona: "calendar.badge.exclamationmark", naslov: "Nema objavljenih događaja",
                                 opis: "Kad organizator objavi događaj, pojavit će se ovdje.") { EmptyView() }
                } else {
                    ScrollView {
                        LazyVStack(spacing: Tema.Razmak.m) {
                            ForEach(events) { ev in
                                NavigationLink(value: ev.slug) { EventRow(ev: ev) }
                                    .buttonStyle(.plain)
                            }
                        }
                        .padding(.horizontal, Tema.Razmak.l)
                        .padding(.vertical, Tema.Razmak.s)
                    }
                }
            }
            .brandPozadina()
            .navigationTitle("Događaji")
            .navigationDestination(for: String.self) { slug in EventDetailView(slug: slug) }
            .refreshable { await ucitaj() }
            .task { if events.isEmpty { await ucitaj() } }
            .overlay { if ucitava && events.isEmpty { ProgressView() } }
        }
    }

    private func ucitaj() async {
        ucitava = true
        defer { ucitava = false }
        do {
            events = try await ApiClient.shared.dogadjaji()
            greska = nil
        } catch {
            greska = error.localizedDescription
        }
    }
}

struct EventRow: View {
    let ev: EventView
    var body: some View {
        HStack(alignment: .top, spacing: Tema.Razmak.m) {
            Cover(url: ev.event?.coverImageUrl ?? ev.brand?.heroUrl, size: 76)
            VStack(alignment: .leading, spacing: Tema.Razmak.xs) {
                Text(ev.title).font(.podnaslov).foregroundStyle(Tema.tekst).lineLimit(2)
                Label(Format.termin(ev.event?.startsAt, ev.event?.endsAt, timezone: ev.event?.timezone), systemImage: "calendar")
                    .font(.sekundarno).foregroundStyle(Tema.tekstMutni).lineLimit(2)
                if !ev.mjesto.isEmpty {
                    Label(ev.mjesto, systemImage: "mappin.and.ellipse").font(.sekundarno).foregroundStyle(Tema.tekstMutni).lineLimit(1)
                }
                HStack(spacing: Tema.Razmak.s) {
                    if let c = ev.najnizaCijena {
                        Text("od \(Format.eur(c))").font(.sekundarnoMedium.monospacedDigit()).foregroundStyle(Tema.zelena)
                    }
                    StanjeProdaje(ev: ev)
                }
                .padding(.top, 2)
            }
            Spacer(minLength: 0)
            Image(systemName: "chevron.right").font(.sitno).foregroundStyle(Tema.tekstMutni).padding(.top, Tema.Razmak.xs)
        }
        .kartica(padding: Tema.Razmak.m)
    }
}

struct StanjeProdaje: View {
    let ev: EventView
    var body: some View {
        if ev.kupovno {
            EmptyView()
        } else if ev.tiers.allSatisfy(\.soldOut) && !ev.tiers.isEmpty {
            Oznaka(tekst: "rasprodano", boja: Tema.crvena)
        } else if ev.tiers.contains(where: \.notStarted) {
            Oznaka(tekst: "uskoro u prodaji", boja: Tema.narancasta)
        } else {
            Oznaka(tekst: "nije u prodaji")
        }
    }
}
