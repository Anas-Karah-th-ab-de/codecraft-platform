package tech.codecraft.portal

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat

/**
 * Läuft während eines Anrufs. Android schaltet das Mikrofon von Apps im Hintergrund stumm –
 * ohne diesen Dienst hört die Gegenseite nichts mehr, sobald der Bildschirm ausgeht oder man
 * kurz eine andere App öffnet (man selbst hört sie aber weiter).
 * Sprachanruf zusätzlich: Näherungssensor schaltet den Bildschirm am Ohr aus, ohne die App zu pausieren.
 */
class CallService : Service() {
    private var proximity: PowerManager.WakeLock? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val type = if (Build.VERSION.SDK_INT >= 30) ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE else 0
        try {
            ServiceCompat.startForeground(this, ID, notification(this), type)
        } catch (e: Exception) {
            // z. B. Mikrofon nicht erlaubt → Anruf läuft trotzdem weiter, nur ohne Hintergrund-Mikrofon
            active = false
            stopSelf()
            return START_NOT_STICKY
        }
        if (proximity == null && intent?.getBooleanExtra("proximity", true) != false) {
            try {
                val pm = getSystemService(PowerManager::class.java)
                if (pm.isWakeLockLevelSupported(PowerManager.PROXIMITY_SCREEN_OFF_WAKE_LOCK)) {
                    proximity = pm.newWakeLock(PowerManager.PROXIMITY_SCREEN_OFF_WAKE_LOCK, "kmportal:call").apply {
                        setReferenceCounted(false)
                        acquire(4 * 60 * 60 * 1000L)
                    }
                }
            } catch (_: Exception) {}
        }
        return START_NOT_STICKY
    }

    /** App aus der Übersicht gewischt → Anruf ist weg, Meldung „Anruf läuft“ nicht stehen lassen */
    override fun onTaskRemoved(rootIntent: Intent?) {
        stopSelf()
        super.onTaskRemoved(rootIntent)
    }

    override fun onDestroy() {
        active = false
        try { proximity?.let { if (it.isHeld) it.release() } } catch (_: Exception) {}
        proximity = null
        super.onDestroy()
    }

    companion object {
        // eigene Nummer: 4711 = Verbindung (NotifyService), 4712 = Bildschirmfreigabe (ProjectionService)
        const val ID = 4714
        const val CH = "call_active"
        @Volatile var active = false

        /**
         * Start beim Anrufbeginn (App ist dann sichtbar). Bewusst startService statt startForegroundService:
         * Scheitert startForeground (Mikrofon-Recht fehlt), darf das die App nicht zum Absturz bringen.
         */
        fun start(c: Context, proximity: Boolean) {
            if (active) return
            active = true
            try {
                c.startService(Intent(c, CallService::class.java).putExtra("proximity", proximity))
            } catch (e: Exception) {
                active = false
            }
        }

        fun stop(c: Context) {
            active = false
            try { c.stopService(Intent(c, CallService::class.java)) } catch (_: Exception) {}
        }

        private fun notification(c: Context): Notification {
            if (Build.VERSION.SDK_INT >= 26) {
                c.getSystemService(NotificationManager::class.java).createNotificationChannel(
                    NotificationChannel(CH, "Laufender Anruf", NotificationManager.IMPORTANCE_LOW).apply { setShowBadge(false) })
            }
            val text = when (java.util.Locale.getDefault().language) {
                "ar" -> "مكالمة جارية – اضغط للعودة"
                "en" -> "Call in progress – tap to return"
                else -> "Anruf läuft – tippen zum Zurückkehren"
            }
            return NotificationCompat.Builder(c, CH)
                .setSmallIcon(android.R.drawable.stat_sys_phone_call)
                .setContentTitle("KM Portal")
                .setContentText(text)
                .setOngoing(true)
                .setCategory(NotificationCompat.CATEGORY_CALL)
                .setContentIntent(NotifyService.openIntent(c, "/portal/nachrichten", ID))
                .build()
        }
    }
}
