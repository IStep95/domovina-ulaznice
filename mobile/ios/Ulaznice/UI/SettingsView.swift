import SwiftUI

struct SettingsView: View {
    @Environment(OrderStore.self) private var store
    @State private var okruzenje = Postavke.okruzenje
    @State private var vlastiti = Postavke.vlastitiURL
    @State private var potvrdiBrisanje = false

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Picker("Okruženje", selection: $okruzenje) {
                        ForEach(Okruzenje.allCases) { Text($0.naziv).tag($0) }
                    }
                    .onChange(of: okruzenje) { _, v in Postavke.okruzenje = v }
                    if okruzenje == .vlastito {
                        TextField("https://…", text: $vlastiti)
                            .keyboardType(.URL).textInputAutocapitalization(.never).autocorrectionDisabled()
                            .onChange(of: vlastiti) { _, v in Postavke.vlastitiURL = v }
                    }
                    LabeledContent("Adresa", value: Postavke.baseURL.absoluteString)
                        .font(.footnote)
                } header: {
                    Text("Poslužitelj")
                } footer: {
                    Text("Produkcija je zasad samo najava; prodaja radi na stagingu sa Stripe sandboxom (testne kartice).")
                }
                Section {
                    Button("Obriši sve narudžbe i QR kodove s uređaja", role: .destructive) { potvrdiBrisanje = true }
                } footer: {
                    Text("Narudžbe ostaju dostupne preko linka iz e-maila. QR kodovi preneseni u aplikaciju se brišu s ovog uređaja.")
                }
                Section("O aplikaciji") {
                    HStack(spacing: Tema.Razmak.m) {
                        Image("LaunchLogo").resizable().scaledToFit().frame(width: 44, height: 44)
                            .padding(6).background(Tema.zelena, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Domovina ulaznice").font(.podnaslov).foregroundStyle(Tema.tekst)
                            Text("Verzija \(Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "—")")
                                .font(.sitno).foregroundStyle(Tema.tekstMutni)
                        }
                    }
                    Text("Ulaznice bez posrednika: organizator prodaje sa svoje stranice, novac ide izravno njemu.")
                        .font(.sekundarno).foregroundStyle(Tema.tekstMutni)
                    Text("Font Manrope, SIL Open Font License.").font(.sitno).foregroundStyle(Tema.tekstMutni)
                }
            }
            .scrollContentBackground(.hidden)
            .brandPozadina()
            .navigationTitle("Postavke")
            .confirmationDialog("Obrisati sve s uređaja?", isPresented: $potvrdiBrisanje, titleVisibility: .visible) {
                Button("Obriši", role: .destructive) { store.obrisiSve() }
                Button("Odustani", role: .cancel) {}
            }
        }
    }
}
