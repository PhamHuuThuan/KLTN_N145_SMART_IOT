package com.technooo.smartkitchen

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.net.Uri
import android.os.Build
import android.os.IBinder
import android.os.VibrationEffect
import android.os.Vibrator
import androidx.core.app.NotificationCompat

class EmergencySoundService : Service() {
  private var player: MediaPlayer? = null
  private var vibrator: Vibrator? = null

  companion object {
    const val ACTION_STOP = "com.technooo.smartkitchen.action.STOP_EMERGENCY"
  }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onCreate() {
    super.onCreate()
    startForeground(1001, buildNotification("Cảnh báo khẩn cấp đang phát"))
    startAlarm()
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (intent?.action == ACTION_STOP) {
      stopSelf()
      return START_NOT_STICKY
    }
    // auto-stop failsafe after 2 minutes
    android.os.Handler(mainLooper).postDelayed({
      try { stopSelf() } catch (_: Exception) {}
    }, 120_000)
    return START_NOT_STICKY
  }

  private fun startAlarm() {
    try {
      val uri = Uri.parse("android.resource://" + packageName + "/" + R.raw.emergy_sound)
      player = MediaPlayer().apply {
        setAudioAttributes(
          AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_ALARM)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build()
        )
        setDataSource(applicationContext, uri)
        isLooping = true
        prepare()
        start()
      }

      vibrator = getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
      val pattern = longArrayOf(0, 1000, 500, 1000)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        vibrator?.vibrate(VibrationEffect.createWaveform(pattern, 0))
      } else {
        @Suppress("DEPRECATION")
        vibrator?.vibrate(pattern, 0)
      }
    } catch (_: Exception) {}
  }

  private fun buildNotification(text: String): Notification {
    // Action to stop
    val stopIntent = Intent(this, EmergencySoundService::class.java).apply { action = ACTION_STOP }
    val stopPending = androidx.core.app.PendingIntentCompat.getService(
      this, 1010, stopIntent, 0, true
    )

    val builder = NotificationCompat.Builder(this, "emergency")
      .setSmallIcon(R.mipmap.ic_launcher)
      .setContentTitle("Smart IoT Kitchen")
      .setContentText(text)
      .setOnlyAlertOnce(true)
      .setOngoing(true)
      .setCategory(NotificationCompat.CATEGORY_ALARM)
      .setPriority(NotificationCompat.PRIORITY_MAX)
      .addAction(NotificationCompat.Action(0, "TẮT BÁO ĐỘNG", stopPending))

    return builder.build()
  }

  override fun onDestroy() {
    super.onDestroy()
    try { player?.stop(); player?.release() } catch (_: Exception) {}
    try { vibrator?.cancel() } catch (_: Exception) {}
  }

  override fun onTaskRemoved(rootIntent: Intent?) {
    // Ensure service is fully stopped if task is removed
    try { stopSelf() } catch (_: Exception) {}
    super.onTaskRemoved(rootIntent)
  }
}


