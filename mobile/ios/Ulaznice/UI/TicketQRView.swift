import SwiftUI
import UIKit

/// Ekran za ulaz: QR na bijelom, svjetlina na maksimum dok je otvoren.
/// Bijelo je namjerno i u tamnoj temi — skeneri čitaju kontrast, ne brend.
struct TicketQRView: View {
    let ulaznica: LokalnaUlaznica
    let event: OrderEvent?
    @Environment(\.dismiss) private var dismiss
    @State private var staraSvjetlina: CGFloat = UIScreen.main.brightness
    @State private var prikazano = false

    private let papir = Color(uiColor: UIColor(hex: 0xFFFFFF))
    private let tinta = Color(uiColor: UIColor(hex: 0x14331F))
    private let mutno = Color(uiColor: UIColor(hex: 0x6B7280))
    private let zelena = Color(uiColor: UIColor(hex: 0x2F855A))

    var body: some View {
        ZStack {
            Color(uiColor: UIColor(hex: 0xF6F7F9)).ignoresSafeArea()
            VStack(spacing: Tema.Razmak.l) {
                HStack {
                    HStack(spacing: 6) {
                        Image(systemName: "ticket.fill").foregroundStyle(zelena)
                        Text("Domovina ulaznice").font(.sekundarnoMedium).foregroundStyle(tinta)
                    }
                    Spacer()
                    Button { dismiss() } label: {
                        Image(systemName: "xmark").font(.system(size: 15, weight: .bold)).foregroundStyle(tinta)
                            .frame(width: 36, height: 36).background(papir, in: Circle())
                    }
                    .accessibilityLabel("Zatvori")
                }
                Spacer()
                UlaznicaKartica(boja: papir, pozadina: Color(uiColor: UIColor(hex: 0xF6F7F9))) {
                    VStack(spacing: Tema.Razmak.m) {
                        if let img = QR.slika(token: ulaznica.qrToken) {
                            Image(uiImage: img)
                                .interpolation(.none)
                                .resizable()
                                .scaledToFit()
                                .frame(maxWidth: 280)
                                .padding(Tema.Razmak.s)
                                .background(.white)
                                .accessibilityLabel("QR kod ulaznice \(ulaznica.serial)")
                        } else {
                            Text("QR se ne može iscrtati").foregroundStyle(.red)
                        }
                        Text(ulaznica.serial).font(.sitno.monospaced()).foregroundStyle(mutno)
                    }
                    .frame(maxWidth: .infinity)
                } donji: {
                    VStack(spacing: Tema.Razmak.xs) {
                        Text(ulaznica.holderName ?? "Ulaznica").font(.naslovMali).foregroundStyle(tinta)
                        if let ev = event {
                            Text(ev.title).font(.sekundarnoMedium).foregroundStyle(tinta)
                            Text(Format.termin(ev.startsAt, ev.endsAt, timezone: ev.timezone)).font(.sitno).foregroundStyle(mutno)
                        }
                    }
                    .frame(maxWidth: .infinity)
                    .multilineTextAlignment(.center)
                }
                .shadow(color: .black.opacity(0.08), radius: 24, y: 12)
                .scaleEffect(prikazano ? 1 : 0.94)
                .opacity(prikazano ? 1 : 0)
                Spacer()
                Label("Pokažite kod osoblju na ulazu. Vrijedi jednom.", systemImage: "info.circle")
                    .font(.sitno).foregroundStyle(mutno)
            }
            .padding(Tema.Razmak.xl)
        }
        .onAppear {
            staraSvjetlina = UIScreen.main.brightness
            UIScreen.main.brightness = 1
            withAnimation(.spring(duration: 0.45, bounce: 0.25)) { prikazano = true }
        }
        .onDisappear { UIScreen.main.brightness = staraSvjetlina }
    }
}
