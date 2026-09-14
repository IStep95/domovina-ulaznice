// Okruženje prema kojem aplikacija gađa. Zadano: staging (produkcija je danas
// samo najava — CLAUDE.md). Mijenja se u Postavkama.
package ai.domovina.ulaznice.data

import android.content.Context
import android.content.SharedPreferences

enum class Okruzenje(val naziv: String, val url: String?) {
    STAGING("Staging (Stripe sandbox)", "https://ulaznice-staging.domovina.ai"),
    PRODUKCIJA("Produkcija", "https://ulaznice.domovina.ai"),
    LOKALNO("Lokalno (wrangler dev, 8787)", "http://10.0.2.2:8787"),
    MOCK("Mock API (mobile/mock-api.mjs, 8797)", "http://10.0.2.2:8797"),
    VLASTITO("Vlastita adresa", null),
}

object Postavke {
    private lateinit var prefs: SharedPreferences
    fun init(ctx: Context) { prefs = ctx.applicationContext.getSharedPreferences("ulaznice.postavke", Context.MODE_PRIVATE) }

    var okruzenje: Okruzenje
        get() = runCatching { Okruzenje.valueOf(prefs.getString("okruzenje", "") ?: "") }.getOrDefault(Okruzenje.STAGING)
        set(v) = prefs.edit().putString("okruzenje", v.name).apply()

    var vlastitiUrl: String
        get() = prefs.getString("vlastiti_url", "") ?: ""
        set(v) = prefs.edit().putString("vlastiti_url", v).apply()

    var zadnjiEmail: String
        get() = prefs.getString("zadnji_email", "") ?: ""
        set(v) = prefs.edit().putString("zadnji_email", v).apply()

    val baseUrl: String
        get() {
            if (okruzenje == Okruzenje.VLASTITO && vlastitiUrl.startsWith("http")) return vlastitiUrl
            return okruzenje.url ?: Okruzenje.STAGING.url!!
        }
}
