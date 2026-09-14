package ai.domovina.ulaznice

import ai.domovina.ulaznice.data.LokalnaUlaznica
import ai.domovina.ulaznice.data.OrderStore
import ai.domovina.ulaznice.data.Postavke
import ai.domovina.ulaznice.ui.CheckoutScreen
import ai.domovina.ulaznice.ui.EventDetailScreen
import ai.domovina.ulaznice.ui.EventsScreen
import ai.domovina.ulaznice.ui.OrderDetailScreen
import ai.domovina.ulaznice.ui.OrdersScreen
import ai.domovina.ulaznice.ui.SettingsScreen
import ai.domovina.ulaznice.ui.TicketQrScreen
import ai.domovina.ulaznice.ui.UlazniceTheme
import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ConfirmationNumber
import androidx.compose.material.icons.filled.DateRange
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.foundation.layout.padding
import androidx.compose.ui.unit.dp
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument

class MainActivity : ComponentActivity() {
    /** Link iz e-maila / povratka s Checkouta koji čeka da ga ekran „Moje ulaznice" potroši. */
    private var link by mutableStateOf<String?>(null)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        Postavke.init(this)
        enableEdgeToEdge()
        link = intent?.dataString
        setContent { UlazniceTheme { Root(link) { link = null } } }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        link = intent.dataString
    }
}

@Composable
private fun Root(link: String?, onLinkPotrosen: () -> Unit) {
    val nav = rememberNavController()
    val back by nav.currentBackStackEntryAsState()
    val ruta = back?.destination?.route ?: "dogadjaji"
    var qr by androidx.compose.runtime.remember { mutableStateOf<Pair<LokalnaUlaznica, String>?>(null) }
    val tabovi = listOf(
        Triple("dogadjaji", "Događaji", Icons.Filled.DateRange),
        Triple("narudzbe", "Moje ulaznice", Icons.Filled.ConfirmationNumber),
        Triple("postavke", "Postavke", Icons.Filled.Settings),
    )
    val prikaziTabove = ruta in tabovi.map { it.first }

    // deep link → tab „Moje ulaznice"
    if (link != null && ruta != "narudzbe") nav.navigate("narudzbe") { launchSingleTop = true; popUpTo("dogadjaji") }

    val q = qr
    if (q != null) {
        TicketQrScreen(q.first, eventTitle = q.second, termin = null) { qr = null }
        return
    }

    Scaffold(bottomBar = {
        if (prikaziTabove) NavigationBar {
            tabovi.forEach { (r, naziv, ikona) ->
                NavigationBarItem(selected = ruta == r, onClick = { nav.navigate(r) { launchSingleTop = true; popUpTo("dogadjaji") { saveState = true }; restoreState = true } },
                    icon = { Icon(ikona, null) }, label = { Text(naziv) })
            }
        }
    }) { pad ->
        NavHost(nav, startDestination = "dogadjaji", modifier = Modifier.padding(bottom = if (prikaziTabove) pad.calculateBottomPadding() else 0.dp)) {
            composable("dogadjaji") { EventsScreen(onOpen = { nav.navigate("dogadjaj/$it") }) }
            composable("dogadjaj/{slug}", arguments = listOf(navArgument("slug") { type = NavType.StringType })) { e ->
                EventDetailScreen(e.arguments!!.getString("slug")!!, onBack = { nav.popBackStack() }) { ev, tier ->
                    Odabir.ev = ev; Odabir.tier = tier
                    nav.navigate("kupnja")
                }
            }
            composable("kupnja") {
                val ev = Odabir.ev; val tier = Odabir.tier
                if (ev == null || tier == null) { nav.popBackStack(); return@composable }
                CheckoutScreen(ev, tier, onBack = { nav.popBackStack() }) { id ->
                    nav.navigate("narudzba/$id") { popUpTo("dogadjaji") }
                }
            }
            composable("narudzbe") {
                OrdersScreen(dodajLink = link, onOpen = { nav.navigate("narudzba/$it") }, onLinkPotrosen = onLinkPotrosen)
            }
            composable("narudzba/{id}", arguments = listOf(navArgument("id") { type = NavType.StringType })) { e ->
                val id = e.arguments!!.getString("id")!!
                OrderDetailScreen(id, onBack = { nav.popBackStack() }) { u ->
                    qr = u to (OrderStore.get(nav.context).nadji(id)?.eventTitle ?: "")
                }
            }
            composable("postavke") { SettingsScreen() }
        }
    }
}

/** Odabrani event+tier za ekran kupnje (objekti su preveliki za nav argumente). */
private object Odabir {
    var ev: ai.domovina.ulaznice.data.EventView? = null
    var tier: ai.domovina.ulaznice.data.TierView? = null
}
