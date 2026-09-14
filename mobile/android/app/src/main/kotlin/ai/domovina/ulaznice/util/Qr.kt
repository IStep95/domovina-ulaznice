// QR se crta lokalno iz tokena (ZXing matrica → Bitmap). Payload je isti kao
// u e-mailu i skeneru: `dgdj1:<64 hex>` (worker/qr.ts::QR_PREFIX).
package ai.domovina.ulaznice.util

import android.graphics.Bitmap
import android.graphics.Color
import com.google.zxing.BarcodeFormat
import com.google.zxing.EncodeHintType
import com.google.zxing.qrcode.QRCodeWriter
import com.google.zxing.qrcode.decoder.ErrorCorrectionLevel

object Qr {
    const val PREFIX = "dgdj1:"

    fun bitmap(token: String, side: Int = 640): Bitmap? = runCatching {
        val hints = mapOf(EncodeHintType.ERROR_CORRECTION to ErrorCorrectionLevel.M, EncodeHintType.MARGIN to 2)
        val m = QRCodeWriter().encode(PREFIX + token, BarcodeFormat.QR_CODE, side, side, hints)
        val px = IntArray(m.width * m.height) { i -> if (m.get(i % m.width, i / m.width)) Color.BLACK else Color.WHITE }
        Bitmap.createBitmap(px, m.width, m.height, Bitmap.Config.RGB_565)
    }.getOrNull()
}
