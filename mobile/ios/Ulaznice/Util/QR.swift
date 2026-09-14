// QR se crta lokalno iz tokena (CoreImage, bez ovisnosti). Payload je isti kao
// u e-mailu i skeneru: `dgdj1:<64 hex>` (worker/qr.ts::QR_PREFIX).
import CoreImage
import CoreImage.CIFilterBuiltins
import UIKit

enum QR {
    static let prefix = "dgdj1:"

    static func slika(token: String, strana: CGFloat = 640) -> UIImage? {
        let filter = CIFilter.qrCodeGenerator()
        filter.message = Data((prefix + token).utf8)
        filter.correctionLevel = "M"
        guard let out = filter.outputImage else { return nil }
        let scale = strana / out.extent.width
        let scaled = out.transformed(by: CGAffineTransform(scaleX: scale, y: scale))
        let ctx = CIContext()
        guard let cg = ctx.createCGImage(scaled, from: scaled.extent) else { return nil }
        return UIImage(cgImage: cg)
    }
}
