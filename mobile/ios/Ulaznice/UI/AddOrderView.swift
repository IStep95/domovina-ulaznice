import SwiftUI

/// Dodavanje narudžbe koja je kupljena na webu: link iz e-maila (ili sam
/// `order_id`) + e-mail kupca. Bez e-maila Worker ne izdaje QR tokene.
struct AddOrderView: View {
    var otvori: (String) -> Void
    @Environment(OrderStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @State private var link = UserDefaults.standard.string(forKey: "ulaznice.link_iz_urla") ?? ""
    @State private var email = UserDefaults.standard.string(forKey: "ulaznice.zadnji_email") ?? ""
    @State private var greska: String?
    @State private var provjerava = false

    private var orderId: String? { NarudzbaLink.orderId(iz: link) }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: Tema.Razmak.l) {
                    VStack(alignment: .leading, spacing: Tema.Razmak.s) {
                        Text("Link „Moje ulaznice“ iz e-maila").font(.tijeloMedium).foregroundStyle(Tema.tekst)
                        TextField("https://…/ulaznice/…", text: $link, axis: .vertical)
                            .font(.tijelo)
                            .textInputAutocapitalization(.never).autocorrectionDisabled().keyboardType(.URL)
                            .padding(Tema.Razmak.m)
                            .background(Tema.pozadina, in: RoundedRectangle(cornerRadius: Tema.radius, style: .continuous))
                            .overlay(RoundedRectangle(cornerRadius: Tema.radius, style: .continuous).strokeBorder(Tema.rub))
                        if !link.isEmpty && orderId == nil {
                            Text("U tekstu nema broja narudžbe.").font(.sitno).foregroundStyle(Tema.crvena)
                        }
                    }
                    .kartica()
                    .padding(.top, Tema.Razmak.s)

                    VStack(alignment: .leading, spacing: Tema.Razmak.s) {
                        Text("E-mail kojim ste kupili").font(.tijeloMedium).foregroundStyle(Tema.tekst)
                        Polje(placeholder: "ime@primjer.hr", text: $email)
                            .keyboardType(.emailAddress).textContentType(.emailAddress)
                            .textInputAutocapitalization(.never).autocorrectionDisabled()
                        Text("Isti e-mail kojim je narudžba plaćena. Bez njega QR kodovi se ne izdaju.")
                            .font(.sitno).foregroundStyle(Tema.tekstMutni)
                    }
                    .kartica()

                    if let greska {
                        Label(greska, systemImage: "exclamationmark.circle").font(.sekundarno).foregroundStyle(Tema.crvena)
                    }

                    Button { Task { await dodaj() } } label: {
                        if provjerava { ProgressView().tint(.white) } else { Text("Dodaj narudžbu") }
                    }
                    .buttonStyle(.primarni)
                    .disabled(orderId == nil || !Validacija.email(email) || provjerava)
                }
                .padding(.horizontal, Tema.Razmak.l)
            }
            .brandPozadina()
            .scrollDismissesKeyboard(.interactively)
            .navigationTitle("Dodaj narudžbu")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Odustani") { dismiss() } }
            }
        }
    }

    private func dodaj() async {
        guard let id = orderId else { return }
        provjerava = true
        defer { provjerava = false }
        do {
            let o = try await ApiClient.shared.narudzba(id: id)
            let mail = email.trimmingCharacters(in: .whitespaces)
            store.dodaj(orderId: id, buyerEmail: mail)
            store.azuriraj(o)
            UserDefaults.standard.removeObject(forKey: "ulaznice.link_iz_urla")
            UserDefaults.standard.set(mail, forKey: "ulaznice.zadnji_email")
            dismiss()
            otvori(id)
        } catch {
            greska = error.localizedDescription
        }
    }
}
