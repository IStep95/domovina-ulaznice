import SwiftUI

struct OrderDetailView: View {
    let orderId: String
    var cekaPlacanje = false
    @Environment(OrderStore.self) private var store

    @State private var order: OrderView?
    @State private var greska: String?
    @State private var pokusaji = 0
    @State private var prenosi = false
    @State private var potvrdiPrijenos = false
    @State private var poruka: String?
    @State private var qrZa: LokalnaUlaznica?
    @State private var uspjeh = 0 // okidač haptike nakon prijenosa

    private var spremljena: SpremljenaNarudzba? { store.narudzbe.first { $0.orderId == orderId } }
    /// QR tokeni s uređaja; @State (ne computed) da se popis sigurno osvježi nakon prijenosa.
    @State private var lokalne: [LokalnaUlaznica] = []
    private var ceka: Bool { (cekaPlacanje || spremljena?.cekaPlacanje == true) && (order?.state ?? .pending) == .pending }

    var body: some View {
        Group {
            if let order {
                ScrollView {
                    VStack(alignment: .leading, spacing: Tema.Razmak.l) {
                        VStack(alignment: .leading, spacing: Tema.Razmak.s) {
                            Text(order.event?.title ?? "Narudžba").font(.naslov).foregroundStyle(Tema.tekst)
                            if let ev = order.event {
                                Label(Format.termin(ev.startsAt, ev.endsAt, timezone: ev.timezone), systemImage: "calendar")
                                let m = [ev.venueName, ev.venueCity].compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: ", ")
                                if !m.isEmpty { Label(m, systemImage: "mappin.and.ellipse") }
                            }
                        }
                        .font(.sekundarno).foregroundStyle(Tema.tekstMutni)
                        .padding(.top, Tema.Razmak.s)

                        StanjeKartica(order: order, ceka: ceka)

                        VStack(spacing: Tema.Razmak.s) {
                            Redak(kljuc: "Broj ulaznica", vrijednost: "\(order.quantity)")
                            Divider()
                            Redak(kljuc: "Iznos", vrijednost: Format.eur(order.amountCents), istaknuto: true)
                            if let e = order.buyerEmail { Divider(); Redak(kljuc: "E-mail", vrijednost: e) }
                            if order.state == .pending, let x = order.expiresAt {
                                Divider(); Redak(kljuc: "Rezervacija vrijedi do", vrijednost: Format.datumVrijeme(x))
                            }
                        }
                        .kartica()

                        if order.state == .paid {
                            NaslovSekcije(tekst: "Ulaznice")
                            ForEach(order.tickets) { t in
                                UlaznicaRedak(t: t, lokalna: lokalne.first { $0.serial == t.serial }, event: order.event) { qrZa = $0 }
                            }
                            Text(lokalne.isEmpty
                                 ? "QR kodovi su u e-mailu. Prenesite ih u aplikaciju da ih pokažete na ulazu i bez interneta."
                                 : "Preneseno u aplikaciju\(spremljena?.preneseno.map { " " + Format.datumVrijeme(ISO8601DateFormatter().string(from: $0)) } ?? ""). QR iz e-maila više ne vrijedi ako je bio izdan ranije.")
                                .font(.sitno).foregroundStyle(Tema.tekstMutni)

                            VStack(alignment: .leading, spacing: Tema.Razmak.m) {
                                if let poruka {
                                    Label(poruka, systemImage: "checkmark.circle.fill")
                                        .font(.sekundarnoMedium).foregroundStyle(Tema.zelena)
                                        .transition(.move(edge: .top).combined(with: .opacity))
                                }
                                Button {
                                    potvrdiPrijenos = true
                                } label: {
                                    if prenosi { ProgressView().tint(.white) }
                                    else { Label(lokalne.isEmpty ? "Prenesi ulaznice u aplikaciju" : "Ponovno prenesi (novi QR)", systemImage: "arrow.down.to.line") }
                                }
                                .buttonStyle(.primarni)
                                .disabled(prenosi || spremljena == nil)
                                Text("Ako je e-mail s ulaznicama već stigao, prijenos izdaje NOVE QR kodove — stari iz e-maila prestaju vrijediti, uključujući proslijeđene.")
                                    .font(.sitno).foregroundStyle(Tema.tekstMutni)
                            }
                            .animation(.spring(duration: 0.35), value: poruka)
                            .padding(.top, Tema.Razmak.s)
                        }
                    }
                    .padding(.horizontal, Tema.Razmak.l)
                    .padding(.bottom, Tema.Razmak.xxl)
                }
            } else if let greska {
                PraznoStanje(ikona: "exclamationmark.triangle", naslov: "Ne mogu učitati narudžbu", opis: greska) {
                    Button("Pokušaj ponovno") { Task { await ucitaj() } }.buttonStyle(.sekundarni)
                }
            } else {
                ProgressView()
            }
        }
        .brandPozadina()
        .navigationTitle("Narudžba")
        .navigationBarTitleDisplayMode(.inline)
        .task { await ucitaj() }
        .refreshable { await ucitaj() }
        .task(id: "\(ceka)-\(pokusaji)") {
            // Nakon povratka sa Stripea webhook stiže u sekundi-dvije: kratko
            // poll-amo umjesto da lažemo kupcu da je plaćeno.
            guard ceka, pokusaji < 15 else { return }
            try? await Task.sleep(for: .seconds(2))
            guard !Task.isCancelled else { return }
            pokusaji += 1
            await ucitaj()
        }
        .sensoryFeedback(.success, trigger: uspjeh)
        .confirmationDialog("Prenijeti ulaznice u aplikaciju?", isPresented: $potvrdiPrijenos, titleVisibility: .visible) {
            Button("Prenesi") { Task { await prenesi() } }
            Button("Odustani", role: .cancel) {}
        } message: {
            Text("QR kodovi će se spremiti na ovaj uređaj. Ako su već bili poslani e-mailom, stari kodovi prestaju vrijediti.")
        }
        .fullScreenCover(item: $qrZa) { u in
            TicketQRView(ulaznica: u, event: order?.event)
        }
    }

    private func ucitaj() async {
        lokalne = store.ulaznice(za: orderId)
        do {
            let o = try await ApiClient.shared.narudzba(id: orderId)
            order = o
            greska = nil
            store.azuriraj(o)
        } catch {
            if order == nil { greska = error.localizedDescription }
        }
    }

    private func prenesi() async {
        guard let n = spremljena else { return }
        prenosi = true
        defer { prenosi = false }
        poruka = nil
        do {
            let r = try await store.prenesi(n)
            poruka = r.poništenStari
                ? "Preneseno \(r.broj) ulaznica. Vrijede QR kodovi iz aplikacije — oni iz e-maila više ne rade."
                : "Preneseno \(r.broj) ulaznica."
            uspjeh += 1
            await ucitaj()
        } catch let e as ApiError where e.code == "nema_vazecih_ulaznica" {
            poruka = "Sve ulaznice iz ove narudžbe su već iskorištene ili poništene."
        } catch {
            poruka = error.localizedDescription
        }
    }
}

/// Jedna ulaznica u obliku „ulaznice": ime i serijski gore, stanje / QR dolje.
private struct UlaznicaRedak: View {
    let t: TicketView
    let lokalna: LokalnaUlaznica?
    let event: OrderEvent?
    let otvoriQR: (LokalnaUlaznica) -> Void

    var body: some View {
        UlaznicaKartica {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: Tema.Razmak.xs) {
                    Text(t.holderName ?? "Ulaznica").font(.podnaslov).foregroundStyle(Tema.tekst)
                    Text(t.serial).font(.sitno.monospaced()).foregroundStyle(Tema.tekstMutni)
                }
                Spacer()
                Image(systemName: "ticket.fill").foregroundStyle(Tema.zelena.opacity(0.35))
                    .font(.title2)
            }
        } donji: {
            HStack {
                switch t.state {
                case "checked_in": Oznaka(tekst: "ušlo", boja: Tema.zelena)
                case "void": Oznaka(tekst: "poništena", boja: Tema.crvena)
                default:
                    if lokalna != nil { Oznaka(tekst: "QR na uređaju", boja: Tema.zelena) }
                    else { Oznaka(tekst: "vrijedi") }
                }
                Spacer()
                if let lokalna, t.state == "issued" {
                    Button { otvoriQR(lokalna) } label: { Label("Pokaži QR", systemImage: "qrcode") }
                        .buttonStyle(.sekundarniKompaktan)
                }
            }
        }
    }
}

struct StanjeKartica: View {
    let order: OrderView
    let ceka: Bool

    private var sadrzaj: (naslov: String, tekst: String, boja: Color, ikona: String) {
        if ceka {
            return ("Potvrđujemo plaćanje…",
                    "Plaćanje je zaprimljeno kod Stripea. Ulaznice izdajemo čim potvrda stigne — ovaj ekran se osvježava sam.", Tema.narancasta, "clock")
        }
        switch order.state {
        case .pending: return ("Čeka plaćanje", "Mjesta su rezervirana dok rezervacija ne istekne. Ulaznice izdajemo čim plaćanje bude potvrđeno.", Tema.narancasta, "clock")
        case .paid: return ("Plaćeno", "Ulaznice su izdane. Na ulazu pokažite QR kod iz aplikacije ili iz e-maila.", Tema.zelena, "checkmark.seal.fill")
        case .expired: return ("Rezervacija je istekla", "Plaćanje nije stiglo na vrijeme pa su mjesta vraćena u prodaju. Ništa nije naplaćeno.", Tema.tekstMutni, "xmark.circle")
        case .refunded: return ("Vraćeno", "Uplata je vraćena na karticu, a ulaznice su poništene.", Tema.tekstMutni, "arrow.uturn.backward.circle")
        case .failed: return ("Plaćanje nije uspjelo", "Ništa nije naplaćeno. Možete pokušati ponovno sa stranice događaja.", Tema.crvena, "exclamationmark.triangle.fill")
        }
    }

    var body: some View {
        let s = sadrzaj
        HStack(alignment: .top, spacing: Tema.Razmak.m) {
            ZStack {
                Circle().fill(s.boja.opacity(0.15)).frame(width: 40, height: 40)
                if ceka { ProgressView().tint(s.boja) }
                else { Image(systemName: s.ikona).foregroundStyle(s.boja).font(.system(size: 18, weight: .semibold)) }
            }
            VStack(alignment: .leading, spacing: Tema.Razmak.xs) {
                Text(s.naslov).font(.podnaslov).foregroundStyle(Tema.tekst)
                Text(s.tekst).font(.sekundarno).foregroundStyle(Tema.tekstMutni)
            }
        }
        .padding(Tema.Razmak.l)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(s.boja.opacity(0.10), in: RoundedRectangle(cornerRadius: Tema.radiusKartica, style: .continuous))
    }
}
