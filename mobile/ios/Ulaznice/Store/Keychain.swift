// QR tokeni žive SAMO ovdje. Nikad u UserDefaults, nikad u logu.
// `kSecAttrAccessibleWhenUnlockedThisDeviceOnly`: ne ide u iCloud backup —
// token = ulaznica, a ulaznica se ne smije klonirati na drugi uređaj.
import Foundation
import Security

enum Keychain {
    private static let service = "ai.domovina.ulaznice.tokeni"

    @discardableResult
    static func spremi(_ data: Data, za key: String) -> Bool {
        let q: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
        ]
        SecItemDelete(q as CFDictionary)
        var add = q
        add[kSecValueData as String] = data
        add[kSecAttrAccessible as String] = kSecAttrAccessibleWhenUnlockedThisDeviceOnly
        let st = SecItemAdd(add as CFDictionary, nil)
        if st != errSecSuccess { print("[keychain] spremanje nije uspjelo: OSStatus \(st)") }
        return st == errSecSuccess
    }

    static func procitaj(_ key: String) -> Data? {
        let q: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        var out: CFTypeRef?
        guard SecItemCopyMatching(q as CFDictionary, &out) == errSecSuccess else { return nil }
        return out as? Data
    }

    static func obrisi(_ key: String) {
        let q: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
        ]
        SecItemDelete(q as CFDictionary)
    }

    static func obrisiSve() {
        let q: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
        ]
        SecItemDelete(q as CFDictionary)
    }
}
