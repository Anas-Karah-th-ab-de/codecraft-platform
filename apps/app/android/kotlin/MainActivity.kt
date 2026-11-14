package tech.codecraft.portal

import android.Manifest
import android.annotation.SuppressLint
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.PowerManager
import android.provider.Settings
import androidx.activity.enableEdgeToEdge
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat

class MainActivity : TauriActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        SupportBridge.app = applicationContext
        instance = this
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        // Randlos zeichnen, aber das Portal nicht unter Statusleiste, Navigationsleiste, Kamera-Aussparung
        // oder Tastatur legen: Abstände als Innenrand der Inhaltsfläche
        val root = findViewById<android.view.View>(android.R.id.content)
        ViewCompat.setOnApplyWindowInsetsListener(root) { v, insets ->
            val b = insets.getInsets(
                WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout() or WindowInsetsCompat.Type.ime()
            )
            v.setPadding(b.left, b.top, b.right, b.bottom)
            WindowInsetsCompat.CONSUMED
        }
        NotifyService.channels(this)
        handle(intent)
        // Mitteilungen + Mikrofon/Kamera für Anrufe
        val wanted = mutableListOf(Manifest.permission.RECORD_AUDIO, Manifest.permission.CAMERA)
        if (Build.VERSION.SDK_INT >= 33) wanted += Manifest.permission.POST_NOTIFICATIONS
        val missing = wanted.filter { checkSelfPermission(it) != PackageManager.PERMISSION_GRANTED }
        if (missing.isNotEmpty()) requestPermissions(missing.toTypedArray(), 1)
        if (!SupportBridge.prefs(this).getString("key", "").isNullOrEmpty()) {
            NotifyService.start(this)
            askBattery()
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handle(intent)
    }

    override fun onResume() {
        super.onResume()
        MainActivityState.visible = true
        refreshInsets()
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) refreshInsets()
    }

    override fun onDestroy() {
        if (instance === this) instance = null
        super.onDestroy()
    }

    /** Ränder (Statusleiste, Navigationsleiste, Kamera-Aussparung) neu anwenden – nach Sperrbildschirm,
     *  Anruf-Vollbild oder App-Wechsel kamen sie auf manchen Geräten (z. B. Galaxy S24) nicht wieder an. */
    private fun refreshInsets() {
        val root = findViewById<android.view.View>(android.R.id.content) ?: return
        root.post { ViewCompat.requestApplyInsets(root) }
    }

    /** Mikrofon/Kamera erfragen (für Anrufe); Ergebnis: Mikrofon erlaubt? */
    fun askMedia(video: Boolean, done: (Boolean) -> Unit) {
        val wanted = mutableListOf(Manifest.permission.RECORD_AUDIO)
        if (video) wanted += Manifest.permission.CAMERA
        val missing = wanted.filter { checkSelfPermission(it) != PackageManager.PERMISSION_GRANTED }
        if (missing.isEmpty()) { done(true); return }
        requestPermissions(missing.toTypedArray()) { _ ->
            done(checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED)
        }
    }

    companion object {
        @Volatile var instance: MainActivity? = null
    }

    override fun onPause() {
        MainActivityState.visible = false
        super.onPause()
    }

    private fun handle(i: Intent?) {
        SupportBridge.setPendingUrl(i?.getStringExtra("url"))
    }

    /** Einmalig: Akku-Optimierung für die App ausschalten, damit Anrufe zuverlässig ankommen */
    @SuppressLint("BatteryLife")
    private fun askBattery() {
        val p = SupportBridge.prefs(this)
        if (p.getBoolean("battery_asked", false)) return
        val pm = getSystemService(PowerManager::class.java)
        if (pm.isIgnoringBatteryOptimizations(packageName)) return
        p.edit().putBoolean("battery_asked", true).apply()
        try {
            startActivity(Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:$packageName")))
        } catch (_: Exception) {}
    }
}
