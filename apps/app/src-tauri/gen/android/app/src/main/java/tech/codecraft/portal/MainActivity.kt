package tech.codecraft.portal

import android.Manifest
import android.annotation.SuppressLint
import android.app.NotificationManager
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.PowerManager
import android.provider.Settings
import android.view.View
import android.view.WindowManager
import android.webkit.WebView
import android.widget.Toast
import androidx.activity.enableEdgeToEdge
import androidx.core.graphics.Insets
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat

class MainActivity : TauriActivity() {
    private val main = Handler(Looper.getMainLooper())
    private var web: WebView? = null
    private var lastRoot: Insets? = null
    /** bis dahin bleibt die App über dem Sperrbildschirm sichtbar (eingehender Anruf wird gerade gezeigt) */
    private var lockGraceUntil = 0L

    override fun onCreate(savedInstanceState: Bundle?) {
        SupportBridge.app = applicationContext
        instance = this
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        // Randlos zeichnen, aber das Portal nicht unter Statusleiste, Navigationsleiste, Kamera-Aussparung
        // oder Tastatur legen: Abstände als Innenrand der Inhaltsfläche
        val root = findViewById<View>(android.R.id.content)
        ViewCompat.setOnApplyWindowInsetsListener(root) { v, insets ->
            val b = insets.getInsets(TYPES)
            v.setPadding(b.left, b.top, b.right, b.bottom)
            WindowInsetsCompat.CONSUMED
        }
        // Manche Geräte (z. B. Galaxy S24) melden geänderte Ränder nicht zuverlässig neu – etwa nach dem
        // Sperrbildschirm oder wenn die Tastatur verschwindet. Dann lag der Inhalt oben/unten unter den Leisten.
        // Bei jedem Layout prüfen, ob sich die Ränder des Fensters geändert haben, und sie neu anfordern.
        root.viewTreeObserver.addOnGlobalLayoutListener {
            val now = ViewCompat.getRootWindowInsets(root)?.getInsets(TYPES) ?: return@addOnGlobalLayoutListener
            if (now != lastRoot) {
                lastRoot = now
                ViewCompat.requestApplyInsets(root)
            }
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
            if (!askBattery()) askFullScreen()
        }
    }

    override fun onWebViewCreate(webView: WebView) {
        web = webView
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handle(intent)
        // App war schon offen: dem Portal Bescheid geben, dass eine Seite (Anruf, Mitteilung) geöffnet werden soll
        val w = web ?: return
        w.post { try { w.evaluateJavascript("window.dispatchEvent(new Event('km-app-open'))", null) } catch (_: Exception) {} }
    }

    override fun onResume() {
        super.onResume()
        MainActivityState.visible = true
        refreshInsets()
        // Das Portal zeigt den Anruf bereits selbst → Anruf-Mitteilung nicht zusätzlich klingeln lassen
        if (SupportBridge.webRinging || SupportBridge.webActive) NotifyService.cancelCalls(this)
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) refreshInsets()
    }

    override fun onPause() {
        MainActivityState.visible = false
        super.onPause()
    }

    override fun onDestroy() {
        if (instance === this) {
            instance = null
            // Fenster weg (z. B. aus der Übersicht gewischt) → ein laufender Anruf ist damit beendet
            SupportBridge.webRinging = false
            SupportBridge.webActive = false
            CallService.stop(this)
        }
        web = null
        super.onDestroy()
    }

    /** Ränder (Statusleiste, Navigationsleiste, Kamera-Aussparung) neu anwenden */
    private fun refreshInsets() {
        val root = findViewById<View>(android.R.id.content) ?: return
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

    /**
     * Anrufzustand aus dem Portal. Über dem Sperrbildschirm ist die App nur sichtbar, solange ein Anruf
     * klingelt oder läuft – sonst bliebe das Portal (Nachrichten, E-Mails) ohne Entsperren zugänglich.
     */
    fun onCallState(active: Boolean, ringing: Boolean, video: Boolean) {
        if (active || ringing) overLock(true)
        else if (System.currentTimeMillis() >= lockGraceUntil) overLock(false)
        // Videoanruf: Bildschirm nicht nach 30 s abdunkeln
        if (active && video) window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        else window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        if ((active || ringing) && MainActivityState.visible) NotifyService.cancelCalls(this)
    }

    private fun overLock(on: Boolean) {
        if (Build.VERSION.SDK_INT >= 27) {
            setShowWhenLocked(on)
            setTurnScreenOn(on)
        } else {
            @Suppress("DEPRECATION")
            val f = WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
            if (on) window.addFlags(f) else window.clearFlags(f)
        }
    }

    private fun handle(i: Intent?) {
        val url = i?.getStringExtra("url")
        SupportBridge.setPendingUrl(url)
        if (url != null && url.contains("ring=")) {
            // eingehender Anruf: auch bei gesperrtem Handy zeigen, bis das Portal den Zustand selbst meldet
            lockGraceUntil = System.currentTimeMillis() + 60000
            overLock(true)
            main.postDelayed({ if (!SupportBridge.webRinging && !SupportBridge.webActive) overLock(false) }, 60500)
        }
    }

    /** Einmalig: Akku-Optimierung für die App ausschalten, damit Anrufe zuverlässig ankommen */
    @SuppressLint("BatteryLife")
    private fun askBattery(): Boolean {
        val p = SupportBridge.prefs(this)
        if (p.getBoolean("battery_asked", false)) return false
        val pm = getSystemService(PowerManager::class.java)
        if (pm.isIgnoringBatteryOptimizations(packageName)) return false
        p.edit().putBoolean("battery_asked", true).apply()
        return try {
            startActivity(Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:$packageName")))
            true
        } catch (_: Exception) { false }
    }

    /** Einmalig (ab Android 14): Vollbild-Mitteilungen erlauben, sonst klingelt ein Anruf bei gesperrtem Handy nur als kleine Meldung */
    private fun askFullScreen() {
        if (Build.VERSION.SDK_INT < 34) return
        if (getSystemService(NotificationManager::class.java).canUseFullScreenIntent()) return
        val p = SupportBridge.prefs(this)
        if (p.getBoolean("fsi_asked", false)) return
        p.edit().putBoolean("fsi_asked", true).apply()
        try {
            startActivity(Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT, Uri.parse("package:$packageName")))
            val text = when (java.util.Locale.getDefault().language) {
                "ar" -> "يرجى السماح بإشعارات ملء الشاشة حتى تظهر المكالمات والهاتف مقفل."
                "en" -> "Please allow full-screen notifications so calls show while the phone is locked."
                else -> "Bitte Vollbild-Benachrichtigungen erlauben, damit Anrufe auch bei gesperrtem Handy erscheinen."
            }
            Toast.makeText(this, text, Toast.LENGTH_LONG).show()
        } catch (_: Exception) {}
    }

    companion object {
        @Volatile var instance: MainActivity? = null
        private val TYPES = WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout() or WindowInsetsCompat.Type.ime()
    }
}
