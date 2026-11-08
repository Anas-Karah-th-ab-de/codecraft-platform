package tech.codecraft.portal

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.media.AudioAttributes
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder

/**
 * Hält im Hintergrund die Verbindung zum Portal (Ereignis-Stream mit eigenem App-Schlüssel)
 * und zeigt Anrufe (Vollbild, Klingelton), Mitteilungen, Chat-Nachrichten und E-Mails.
 * Kein Google-Dienst nötig. Dauerhafte, leise Meldung „KM Portal verbunden“ (Android-Pflicht).
 */
class NotifyService : Service() {
    @Volatile private var running = false
    private var worker: Thread? = null
    @Volatile private var conn: HttpURLConnection? = null
    @Volatile private var me: String = ""

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        SupportBridge.app = SupportBridge.app ?: applicationContext
        channels(this)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val type = if (Build.VERSION.SDK_INT >= 34) ServiceInfo.FOREGROUND_SERVICE_TYPE_REMOTE_MESSAGING else 0
        ServiceCompat.startForeground(this, ONGOING_ID, ongoing(this, "…"), type)
        if (intent?.action == ACTION_REFRESH) {
            update(if (worker?.isAlive == true) state else "…")
            return START_STICKY
        }
        if (worker?.isAlive != true) {
            running = true
            worker = Thread({ loop() }, "km-notify").also { it.start() }
        } else {
            // neue Zugangsdaten → Verbindung neu aufbauen
            conn?.disconnect()
        }
        return START_STICKY
    }

    override fun onDestroy() {
        running = false
        conn?.disconnect()
        super.onDestroy()
    }

    @Volatile private var state = ""

    private fun update(text: String) {
        state = text
        val nm = getSystemService(NotificationManager::class.java)
        nm.notify(ONGOING_ID, ongoing(this, text))
    }

    private fun loop() {
        var backoff = 2000L
        while (running) {
            val p = SupportBridge.prefs(this)
            val server = p.getString("server", "") ?: ""
            val key = p.getString("key", "") ?: ""
            if (server.isEmpty() || key.isEmpty()) {
                stopSelf(); return
            }
            try {
                val c = (URL("$server/api/v1/events").openConnection() as HttpURLConnection).apply {
                    setRequestProperty("Authorization", "Bearer $key")
                    setRequestProperty("Accept", "text/event-stream")
                    connectTimeout = 15000
                    readTimeout = 70000 // Server sendet alle 25 s ein Lebenszeichen
                }
                conn = c
                if (c.responseCode == 401) {
                    p.edit().putString("key", "").apply()
                    show(this, CH_NOTES, 9, "KM Portal", texts().relogin, "/portal")
                    stopSelf(); return
                }
                if (c.responseCode != 200) throw Exception("HTTP ${c.responseCode}")
                backoff = 2000L
                update(texts().connected)
                BufferedReader(InputStreamReader(c.inputStream, Charsets.UTF_8)).use { r ->
                    val data = StringBuilder()
                    while (running) {
                        val line = r.readLine() ?: break
                        if (line.startsWith("data:")) data.append(line.substring(5).trimStart())
                        else if (line.isEmpty() && data.isNotEmpty()) {
                            try { onEvent(JSONObject(data.toString())) } catch (_: Exception) {}
                            data.setLength(0)
                        }
                    }
                }
            } catch (_: Exception) {
            } finally {
                conn?.disconnect(); conn = null
            }
            if (!running) return
            update(texts().reconnecting)
            Thread.sleep(backoff)
            backoff = (backoff * 2).coerceAtMost(60000L)
        }
    }

    private fun onEvent(e: JSONObject) {
        val visible = MainActivityState.visible
        when (e.optString("type")) {
            "hello" -> me = e.optString("user")
            "call" -> {
                val d = e.optJSONObject("data") ?: return
                val room = e.optString("room")
                when (d.optString("kind")) {
                    "ring" -> if (!visible) ring(e, d)
                    "hangup" -> cancelCall(room)
                }
            }
            "call-handled" -> cancelCall(e.optString("room"))
            "notification" -> {
                if (visible || e.optBoolean("quiet")) return
                val n = e.optJSONObject("notification") ?: return
                val body = n.optString("body")
                val title = n.optString("title")
                show(this, CH_NOTES, n.optString("id").hashCode(), title, if (body.isEmpty()) "" else body,
                    n.optString("link").ifEmpty { "/portal/mitteilungen" }, n.optInt("priority") >= 2)
            }
            "message" -> {
                if (visible) return
                val m = e.optJSONObject("message") ?: return
                if (m.optString("kind") == "call" || m.optString("sender_id") == me) return
                val room = m.optString("room_id")
                show(this, CH_CHAT, room.hashCode(), m.optString("sender_name"), m.optString("body").take(200),
                    "/portal/nachrichten?room=$room")
            }
            "mail" -> {
                if (visible || e.optString("folder") != "inbox") return
                show(this, CH_MAIL, 7001, e.optString("from"), e.optString("subject"), "/portal/mail")
            }
        }
    }

    private fun ring(e: JSONObject, d: JSONObject) {
        val room = e.optString("room")
        val from = e.optString("from")
        val name = e.optString("name")
        val media = if (d.optString("media") == "video") "video" else "audio"
        val q = "ring=$room&from=$from&media=$media&name=${URLEncoder.encode(name, "UTF-8")}&t=${System.currentTimeMillis()}"
        val open = openIntent(this, "/portal/nachrichten?$q", room.hashCode())
        val decline = PendingIntent.getBroadcast(this, room.hashCode() + 1,
            Intent(this, DeclineReceiver::class.java).putExtra("room", room).putExtra("to", from),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val t = texts()
        val n = NotificationCompat.Builder(this, CH_CALLS)
            .setSmallIcon(android.R.drawable.stat_sys_phone_call)
            .setContentTitle(name)
            .setContentText(if (media == "video") t.videoCall else t.call)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setOngoing(true)
            .setAutoCancel(true)
            .setTimeoutAfter(45000)
            .setFullScreenIntent(open, true)
            .setContentIntent(open)
            .addAction(android.R.drawable.ic_menu_close_clear_cancel, t.decline, decline)
            .addAction(android.R.drawable.ic_menu_call, t.accept, open)
            .build()
        n.flags = n.flags or Notification.FLAG_INSISTENT // Klingelton wiederholen bis Reaktion
        getSystemService(NotificationManager::class.java).notify(callId(room), n)
    }

    private fun cancelCall(room: String) {
        getSystemService(NotificationManager::class.java).cancel(callId(room))
    }

    companion object {
        const val ONGOING_ID = 4711
        const val CH_SERVICE = "service"
        const val CH_CALLS = "calls"
        const val CH_NOTES = "notes"
        const val CH_CHAT = "chat"
        const val CH_MAIL = "mail"
        const val CH_SUPPORT = "support"
        const val ACTION_REFRESH = "refresh"
        fun callId(room: String) = 5000 + (room.hashCode() and 0xfff)

        fun start(c: Context) {
            val i = Intent(c, NotifyService::class.java)
            if (Build.VERSION.SDK_INT >= 26) c.startForegroundService(i) else c.startService(i)
        }

        fun stop(c: Context) {
            c.stopService(Intent(c, NotifyService::class.java))
        }

        fun refresh(c: Context) {
            val key = SupportBridge.prefs(c).getString("key", "") ?: ""
            if (key.isEmpty()) return
            val i = Intent(c, NotifyService::class.java).setAction(ACTION_REFRESH)
            if (Build.VERSION.SDK_INT >= 26) c.startForegroundService(i) else c.startService(i)
        }

        fun texts(): T {
            val l = java.util.Locale.getDefault().language
            return when (l) {
                "ar" -> T("متصل – المكالمات والإشعارات تعمل", "جارٍ إعادة الاتصال …", "مكالمة واردة", "مكالمة فيديو واردة", "قبول", "رفض",
                    "يرجى تسجيل الدخول مجدداً في التطبيق.", "الوصول للدعم مفعّل", "اضغط للإدارة أو الإنهاء", "طلب مشاركة الشاشة")
                "en" -> T("Connected – calls and notifications on", "Reconnecting …", "Incoming call", "Incoming video call", "Accept", "Decline",
                    "Please sign in to the app again.", "Support access is on", "Tap to manage or end", "Screen sharing requested")
                else -> T("Verbunden – Anrufe und Mitteilungen aktiv", "Verbinde neu …", "Eingehender Anruf", "Eingehender Videoanruf", "Annehmen", "Ablehnen",
                    "Bitte in der App neu anmelden.", "Support-Zugriff ist freigegeben", "Tippen zum Verwalten oder Beenden", "Bildschirmfreigabe angefragt")
            }
        }

        fun channels(c: Context) {
            if (Build.VERSION.SDK_INT < 26) return
            val nm = c.getSystemService(NotificationManager::class.java)
            nm.createNotificationChannel(NotificationChannel(CH_SERVICE, "Verbindung", NotificationManager.IMPORTANCE_MIN).apply { setShowBadge(false) })
            nm.createNotificationChannel(NotificationChannel(CH_CALLS, "Anrufe", NotificationManager.IMPORTANCE_HIGH).apply {
                setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE),
                    AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build())
                enableVibration(true)
                vibrationPattern = longArrayOf(0, 600, 400, 600, 400, 600)
                lockscreenVisibility = Notification.VISIBILITY_PUBLIC
            })
            nm.createNotificationChannel(NotificationChannel(CH_NOTES, "Mitteilungen", NotificationManager.IMPORTANCE_HIGH))
            nm.createNotificationChannel(NotificationChannel(CH_CHAT, "Chat", NotificationManager.IMPORTANCE_HIGH))
            nm.createNotificationChannel(NotificationChannel(CH_MAIL, "E-Mail", NotificationManager.IMPORTANCE_DEFAULT))
            nm.createNotificationChannel(NotificationChannel(CH_SUPPORT, "Support-Zugriff", NotificationManager.IMPORTANCE_HIGH))
        }

        fun openIntent(c: Context, url: String, req: Int): PendingIntent {
            val i = Intent(c, MainActivity::class.java)
                .putExtra("url", url)
                .setData(Uri.parse("kmportal://open/$req"))
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
            return PendingIntent.getActivity(c, req, i, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        }

        fun ongoing(c: Context, text: String): Notification {
            val support = SupportBridge.prefs(c).getBoolean("support", false)
            val t = texts()
            return NotificationCompat.Builder(c, if (support) CH_SUPPORT else CH_SERVICE)
                .setSmallIcon(if (support) android.R.drawable.ic_lock_idle_lock else android.R.drawable.stat_notify_sync_noanim)
                .setContentTitle(if (support) t.supportOn else "KM Portal")
                .setContentText(if (support) t.supportHint else text)
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setContentIntent(openIntent(c, if (support) "/portal/support-zugriff" else "/portal/mitteilungen", 1))
                .build()
        }

        fun show(c: Context, ch: String, id: Int, title: String, body: String, url: String, important: Boolean = false) {
            val n = NotificationCompat.Builder(c, ch)
                .setSmallIcon(android.R.drawable.stat_notify_chat)
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(NotificationCompat.BigTextStyle().bigText(body))
                .setPriority(if (important) NotificationCompat.PRIORITY_HIGH else NotificationCompat.PRIORITY_DEFAULT)
                .setAutoCancel(true)
                .setContentIntent(openIntent(c, url, id))
                .build()
            c.getSystemService(NotificationManager::class.java).notify(id, n)
        }

        /** Bildschirmfreigabe angefragt, App im Hintergrund → Vollbild-Meldung öffnet die Rückfrage */
        fun showConsent(c: Context, operator: String) {
            val i = Intent(c, ConsentActivity::class.java).putExtra("operator", operator)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            val pi = PendingIntent.getActivity(c, 6001, i, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
            val n = NotificationCompat.Builder(c, CH_SUPPORT)
                .setSmallIcon(android.R.drawable.ic_menu_view)
                .setContentTitle(texts().consent)
                .setContentText(operator)
                .setCategory(NotificationCompat.CATEGORY_CALL)
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setAutoCancel(true)
                .setTimeoutAfter(90000)
                .setFullScreenIntent(pi, true)
                .setContentIntent(pi)
                .build()
            c.getSystemService(NotificationManager::class.java).notify(6001, n)
        }
    }

    data class T(val connected: String, val reconnecting: String, val call: String, val videoCall: String, val accept: String,
                 val decline: String, val relogin: String, val supportOn: String, val supportHint: String, val consent: String)
}

/** „Ablehnen“ aus der Anruf-Meldung, ohne die App zu öffnen */
class DeclineReceiver : BroadcastReceiver() {
    override fun onReceive(c: Context, i: Intent) {
        val room = i.getStringExtra("room") ?: return
        val to = i.getStringExtra("to") ?: return
        c.getSystemService(NotificationManager::class.java).cancel(NotifyService.callId(room))
        val p = SupportBridge.prefs(c)
        val server = p.getString("server", "") ?: ""
        val key = p.getString("key", "") ?: ""
        val pending = goAsync()
        Thread {
            try {
                val conn = (URL("$server/api/v1/chat/rooms/$room/signal").openConnection() as HttpURLConnection).apply {
                    requestMethod = "POST"
                    doOutput = true
                    setRequestProperty("Authorization", "Bearer $key")
                    setRequestProperty("Content-Type", "application/json")
                    connectTimeout = 10000; readTimeout = 10000
                }
                conn.outputStream.use { it.write("""{"to":"$to","data":{"kind":"decline"}}""".toByteArray()) }
                conn.responseCode
                conn.disconnect()
            } catch (_: Exception) {
            } finally {
                pending.finish()
            }
        }.start()
    }
}

/** Nach dem Neustart des Handys wieder erreichbar sein */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(c: Context, i: Intent) {
        if (i.action != Intent.ACTION_BOOT_COMPLETED && i.action != Intent.ACTION_MY_PACKAGE_REPLACED) return
        SupportBridge.app = SupportBridge.app ?: c.applicationContext
        // Support-Freigabe überlebt keinen Neustart
        SupportBridge.prefs(c).edit().putBoolean("support", false).apply()
        if (!SupportBridge.prefs(c).getString("key", "").isNullOrEmpty()) NotifyService.start(c)
    }
}
