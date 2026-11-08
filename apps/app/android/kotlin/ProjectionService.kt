package tech.codecraft.portal

import android.app.Activity
import android.app.AlertDialog
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.graphics.PixelFormat
import android.hardware.display.DisplayManager
import android.hardware.display.VirtualDisplay
import android.media.ImageReader
import android.media.projection.MediaProjection
import android.media.projection.MediaProjectionManager
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.HandlerThread
import android.os.IBinder
import android.util.DisplayMetrics
import android.view.WindowManager
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat

/**
 * Bildschirmfreigabe für den Support (MediaProjection). Läuft nur nach Zustimmung,
 * zeigt dauerhaft „Bildschirm wird geteilt“ mit „Beenden“.
 */
class ProjectionService : Service() {
    private var projection: MediaProjection? = null
    private var display: VirtualDisplay? = null
    private var reader: ImageReader? = null
    private var thread: HandlerThread? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) {
            stopSelf(); return START_NOT_STICKY
        }
        val code = intent?.getIntExtra("code", 0) ?: 0
        val data: Intent? = if (Build.VERSION.SDK_INT >= 33) intent?.getParcelableExtra("data", Intent::class.java)
            else @Suppress("DEPRECATION") intent?.getParcelableExtra("data")
        val type = if (Build.VERSION.SDK_INT >= 29) ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION else 0
        ServiceCompat.startForeground(this, ID, sharing(this), type)
        if (data == null) { stopSelf(); return START_NOT_STICKY }
        val mpm = getSystemService(MediaProjectionManager::class.java)
        val mp = mpm.getMediaProjection(code, data) ?: run { stopSelf(); return START_NOT_STICKY }
        projection = mp
        val ht = HandlerThread("km-capture").also { it.start() }
        thread = ht
        val handler = Handler(ht.looper)
        mp.registerCallback(object : MediaProjection.Callback() {
            override fun onStop() { stopSelf() }
        }, handler)

        // Größe: echte Auflösung, für die Übertragung auf max. 1080 px Breite verkleinert
        val wm = getSystemService(WindowManager::class.java)
        val real = DisplayMetrics()
        @Suppress("DEPRECATION") wm.defaultDisplay.getRealMetrics(real)
        val scale = if (real.widthPixels > 1080) 1080f / real.widthPixels else 1f
        val w = ((real.widthPixels * scale).toInt() / 2) * 2 // gerade Zahl
        val h = ((real.heightPixels * scale).toInt() / 2) * 2
        width = w; height = h
        scaleX = real.widthPixels.toFloat() / w
        scaleY = real.heightPixels.toFloat() / h
        val r = ImageReader.newInstance(w, h, PixelFormat.RGBA_8888, 2)
        reader = r
        r.setOnImageAvailableListener({ ir ->
            val img = try { ir.acquireLatestImage() } catch (_: Exception) { null } ?: return@setOnImageAvailableListener
            try {
                val plane = img.planes[0]
                val buf = plane.buffer
                val rowStride = plane.rowStride
                val out = ByteArray(w * h * 4)
                if (rowStride == w * 4) buf.get(out, 0, out.size.coerceAtMost(buf.remaining()))
                else for (y in 0 until h) {
                    buf.position(y * rowStride)
                    buf.get(out, y * w * 4, w * 4)
                }
                synchronized(lock) { frame = out }
            } catch (_: Exception) {
            } finally { img.close() }
        }, handler)
        display = mp.createVirtualDisplay("km-support", w, h, real.densityDpi,
            DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR, r.surface, null, handler)
        active = true
        SupportBridge.consentDone(true)
        return START_NOT_STICKY
    }

    override fun onDestroy() {
        active = false
        synchronized(lock) { frame = null }
        display?.release(); reader?.close(); projection?.stop(); thread?.quitSafely()
        display = null; reader = null; projection = null
        super.onDestroy()
    }

    companion object {
        const val ID = 4712
        const val ACTION_STOP = "stop"
        @Volatile var active = false
        @Volatile var width = 0
        @Volatile var height = 0
        @Volatile var scaleX = 1f
        @Volatile var scaleY = 1f
        private val lock = Any()
        private var frame: ByteArray? = null

        fun latest(): ByteArray? = synchronized(lock) { frame }

        fun stop(c: Context) {
            if (active) c.startService(Intent(c, ProjectionService::class.java).setAction(ACTION_STOP))
        }

        fun sharing(c: Context) = NotificationCompat.Builder(c, NotifyService.CH_SUPPORT)
            .setSmallIcon(android.R.drawable.ic_menu_view)
            .setContentTitle(when (java.util.Locale.getDefault().language) {
                "ar" -> "يتم مشاركة الشاشة مع الدعم"; "en" -> "Screen shared with support"; else -> "Bildschirm wird mit dem Support geteilt" })
            .setOngoing(true)
            .addAction(android.R.drawable.ic_menu_close_clear_cancel,
                when (java.util.Locale.getDefault().language) { "ar" -> "إنهاء"; "en" -> "Stop"; else -> "Beenden" },
                PendingIntent.getService(c, 4713, Intent(c, ProjectionService::class.java).setAction(ACTION_STOP),
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE))
            .build()
    }
}

/** Rückfrage „Techniker X möchte …“ und danach die System-Freigabe der Bildschirmaufnahme */
class ConsentActivity : Activity() {
    private var asked = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (Build.VERSION.SDK_INT >= 27) { setShowWhenLocked(true); setTurnScreenOn(true) }
        getSystemService(NotificationManager::class.java).cancel(6001)
        val op = intent.getStringExtra("operator") ?: "Support"
        val (title, text, yes, no) = when (java.util.Locale.getDefault().language) {
            "ar" -> listOf("مشاركة الشاشة", "$op من دعم KM Code Craft يرغب في رؤية شاشتك والتحكم بها. هل تسمح؟", "سماح", "رفض")
            "en" -> listOf("Share screen", "$op from KM Code Craft support wants to see and control your screen. Allow?", "Allow", "Decline")
            else -> listOf("Bildschirm teilen", "$op (KM Code Craft Support) möchte Ihren Bildschirm sehen und steuern. Erlauben?", "Erlauben", "Ablehnen")
        }
        AlertDialog.Builder(this)
            .setTitle(title).setMessage(text).setCancelable(false)
            .setPositiveButton(yes) { _, _ ->
                asked = true
                val mpm = getSystemService(MediaProjectionManager::class.java)
                @Suppress("DEPRECATION") startActivityForResult(mpm.createScreenCaptureIntent(), 1)
            }
            .setNegativeButton(no) { _, _ -> SupportBridge.consentDone(false); finish() }
            .show()
    }

    @Deprecated("Activity-Result über die klassische Schnittstelle, ohne AndroidX-Activity")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        @Suppress("DEPRECATION") super.onActivityResult(requestCode, resultCode, data)
        if (resultCode == RESULT_OK && data != null) {
            val i = Intent(this, ProjectionService::class.java).putExtra("code", resultCode).putExtra("data", data)
            if (Build.VERSION.SDK_INT >= 26) startForegroundService(i) else startService(i)
        } else SupportBridge.consentDone(false)
        finish()
    }
}
