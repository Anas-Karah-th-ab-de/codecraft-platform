package tech.codecraft.portal

import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.widget.Toast
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

/**
 * Brücke zwischen Rust (JNI, siehe crates/agent/src/screen/android.rs und apps/app/src-tauri/src/android.rs)
 * und den Android-Diensten: Mitteilungen, Bildschirmfreigabe, Steuerung.
 * Alle Methoden sind statisch, damit Rust sie über den Klassenlader der App findet.
 */
object SupportBridge {
    @Volatile var app: Context? = null
    @Volatile private var pendingUrl: String? = null
    @Volatile private var consentLatch: CountDownLatch? = null
    @Volatile private var consentResult = false
    private val main = Handler(Looper.getMainLooper())

    fun prefs(c: Context) = c.getSharedPreferences("km_portal", Context.MODE_PRIVATE)

    // ── Mitteilungen ──────────────────────────────────────────────────────

    /** Server + Schlüssel speichern und den Mitteilungs-Dienst (neu) starten; leerer Schlüssel = stoppen */
    @JvmStatic fun configure(server: String, key: String) {
        val c = app ?: return
        prefs(c).edit().putString("server", server).putString("key", key).apply()
        if (key.isEmpty()) NotifyService.stop(c) else NotifyService.start(c)
    }

    @JvmStatic fun takePendingUrl(): String? {
        val u = pendingUrl
        pendingUrl = null
        return u
    }

    fun setPendingUrl(u: String?) {
        if (!u.isNullOrBlank()) pendingUrl = u
    }

    // ── Support-Zugriff ───────────────────────────────────────────────────

    @JvmStatic fun supportChanged(running: Boolean) {
        val c = app ?: return
        prefs(c).edit().putBoolean("support", running).apply()
        NotifyService.refresh(c)
        if (!running) ProjectionService.stop(c)
    }

    /** Rückfrage + System-Freigabe der Bildschirmaufnahme; blockiert (max. 90 s) bis zur Antwort */
    @JvmStatic fun consent(operator: String): Boolean {
        val c = app ?: return false
        if (ProjectionService.active) return true
        val latch = CountDownLatch(1)
        consentLatch = latch
        consentResult = false
        val i = Intent(c, ConsentActivity::class.java)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            .putExtra("operator", operator)
        // aus dem Hintergrund: per Vollbild-Benachrichtigung, sonst direkt
        if (!MainActivityState.visible) NotifyService.showConsent(c, operator) else c.startActivity(i)
        latch.await(90, TimeUnit.SECONDS)
        consentLatch = null
        return consentResult && ProjectionService.active
    }

    fun consentDone(ok: Boolean) {
        consentResult = ok
        consentLatch?.countDown()
    }

    @JvmStatic fun isCapturing(): Boolean = ProjectionService.active
    @JvmStatic fun width(): Int = ProjectionService.width
    @JvmStatic fun height(): Int = ProjectionService.height
    @JvmStatic fun frame(): ByteArray? = ProjectionService.latest()

    @JvmStatic fun gesture(x1: Int, y1: Int, x2: Int, y2: Int, ms: Long): Boolean {
        val s = ControlService.instance ?: return false
        // Bildkoordinaten (verkleinert) → echte Bildschirmkoordinaten
        val fx = ProjectionService.scaleX
        val fy = ProjectionService.scaleY
        return s.gesture(x1 * fx, y1 * fy, x2 * fx, y2 * fy, ms)
    }

    @JvmStatic fun action(name: String): Boolean = ControlService.instance?.action(name) ?: false
    @JvmStatic fun text(t: String): Boolean = ControlService.instance?.typeText(t) ?: false
    @JvmStatic fun controlEnabled(): Boolean = ControlService.instance != null

    /** Ist die Bedienungshilfe in dieser APK-Variante deklariert? (Standard-APK: nein, wegen Play Protect) */
    @JvmStatic fun controlAvailable(): Boolean {
        val c = app ?: return false
        return try {
            c.packageManager.getServiceInfo(android.content.ComponentName(c, ControlService::class.java), 0)
            true
        } catch (e: Exception) {
            false
        }
    }

    @JvmStatic fun openControlSettings() {
        val c = app ?: return
        c.startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }

    @JvmStatic fun notice(text: String) {
        val c = app ?: return
        main.post { Toast.makeText(c, text, Toast.LENGTH_LONG).show() }
    }

    fun isAtLeast(v: Int) = Build.VERSION.SDK_INT >= v
}

/** Ist die App gerade sichtbar? (dann klingelt/zeigt das Portal selbst) */
object MainActivityState {
    @Volatile var visible = false
}
