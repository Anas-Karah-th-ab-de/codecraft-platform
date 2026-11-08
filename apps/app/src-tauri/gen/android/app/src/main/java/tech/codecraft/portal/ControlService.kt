package tech.codecraft.portal

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.GestureDescription
import android.graphics.Path
import android.os.Build
import android.os.Bundle
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo

/**
 * Bedienungshilfe „KM Portal Fernsteuerung“: führt Tippen/Wischen/Texteingabe des Supports aus –
 * nur während einer freigegebenen Bildschirmsitzung (sonst wird nichts gesendet).
 */
class ControlService : AccessibilityService() {
    override fun onServiceConnected() { instance = this }
    override fun onUnbind(intent: android.content.Intent?): Boolean { instance = null; return super.onUnbind(intent) }
    override fun onDestroy() { instance = null; super.onDestroy() }
    override fun onAccessibilityEvent(event: AccessibilityEvent?) {}
    override fun onInterrupt() {}

    private fun allowed() = ProjectionService.active

    fun gesture(x1: Float, y1: Float, x2: Float, y2: Float, ms: Long): Boolean {
        if (!allowed()) return false
        val p = Path().apply { moveTo(x1.coerceAtLeast(0f), y1.coerceAtLeast(0f)); lineTo(x2.coerceAtLeast(0f), y2.coerceAtLeast(0f)) }
        val g = GestureDescription.Builder().addStroke(GestureDescription.StrokeDescription(p, 0, ms.coerceIn(1, 3000))).build()
        return dispatchGesture(g, null, null)
    }

    fun action(name: String): Boolean {
        if (!allowed()) return false
        return when (name) {
            "back" -> performGlobalAction(GLOBAL_ACTION_BACK)
            "home" -> performGlobalAction(GLOBAL_ACTION_HOME)
            "recents" -> performGlobalAction(GLOBAL_ACTION_RECENTS)
            "backspace" -> edit { cur -> cur.dropLast(1) }
            "enter" -> {
                val n = focused() ?: return false
                if (Build.VERSION.SDK_INT >= 30) n.performAction(AccessibilityNodeInfo.AccessibilityAction.ACTION_IME_ENTER.id)
                else edit { it + "\n" }
            }
            else -> false
        }
    }

    fun typeText(t: String): Boolean = allowed() && edit { it + t }

    private fun focused(): AccessibilityNodeInfo? = rootInActiveWindow?.findFocus(AccessibilityNodeInfo.FOCUS_INPUT)

    private fun edit(f: (String) -> String): Boolean {
        val n = focused() ?: return false
        val cur = if (n.isShowingHintText) "" else (n.text?.toString() ?: "")
        val args = Bundle().apply { putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, f(cur)) }
        return n.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, args)
    }

    companion object {
        @Volatile var instance: ControlService? = null
    }
}
