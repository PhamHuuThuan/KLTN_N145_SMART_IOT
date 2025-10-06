package com.technooo.smartkitchen

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.AudioManager
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
  private var audioManager: AudioManager? = null
  private var escalationHandler: android.os.Handler? = null
  private var escalationRunnable: Runnable? = null
  private var startTime: Long = 0
  private var currentVolumeLevel = 0

  companion object {
    const val ACTION_STOP = "com.technooo.smartkitchen.action.STOP_EMERGENCY"
    
    // Escalation levels (in seconds)
    private const val LEVEL_1_TIME = 30_000L   // 30s: Volume 50%
    private const val LEVEL_2_TIME = 60_000L   // 60s: Volume 75%
    private const val LEVEL_3_TIME = 90_000L   // 90s: Volume 100%
    private const val MAX_DURATION = 300_000L  // 5 minutes max
  }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onCreate() {
    super.onCreate()
    startTime = System.currentTimeMillis()
    startForeground(1001, buildNotification("Cảnh báo khẩn cấp - Âm lượng thấp"))
    startAlarm()
    startEscalation()
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (intent?.action == ACTION_STOP) {
      stopSelf()
      return START_NOT_STICKY
    }
    return START_NOT_STICKY
  }

  private fun startAlarm() {
    try {
      audioManager = getSystemService(Context.AUDIO_SERVICE) as AudioManager
      
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
        
        // Start with low volume (Level 0)
        setVolume(0.3f, 0.3f)
        currentVolumeLevel = 0
        start()
      }

      // Start continuous vibration
      startContinuousVibration()
    } catch (_: Exception) {}
  }

  private fun startContinuousVibration() {
    vibrator = getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
    
    // Vibration pattern: vibrate for 1s, pause for 0.5s, vibrate for 1s, pause for 1s
    val pattern = longArrayOf(0, 1000, 500, 1000, 500, 1000)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      vibrator?.vibrate(VibrationEffect.createWaveform(pattern, -1)) // -1 = repeat indefinitely
    } else {
      @Suppress("DEPRECATION")
      vibrator?.vibrate(pattern, -1) // -1 = repeat indefinitely
    }
  }

  private fun startEscalation() {
    escalationHandler = android.os.Handler(mainLooper)
    
    escalationRunnable = object : Runnable {
      override fun run() {
        val elapsedTime = System.currentTimeMillis() - startTime
        
        when {
          elapsedTime >= LEVEL_3_TIME && currentVolumeLevel < 3 -> {
            // Level 3: Maximum volume
            escalateToLevel(3, 1.0f, "Âm lượng tối đa!")
          }
          elapsedTime >= LEVEL_2_TIME && currentVolumeLevel < 2 -> {
            // Level 2: High volume
            escalateToLevel(2, 0.75f, "Âm lượng cao!")
          }
          elapsedTime >= LEVEL_1_TIME && currentVolumeLevel < 1 -> {
            // Level 1: Medium volume
            escalateToLevel(1, 0.5f, "Âm lượng trung bình")
          }
        }
        
        // Continue escalation until max duration
        if (elapsedTime < MAX_DURATION) {
          escalationHandler?.postDelayed(this, 1000) // Check every second
        }
      }
    }
    
    // Start escalation check
    escalationRunnable?.let { escalationHandler?.post(it) }
  }

  private fun escalateToLevel(level: Int, volume: Float, message: String) {
    try {
      player?.setVolume(volume, volume)
      currentVolumeLevel = level
      
      // Update notification with current level
      startForeground(1001, buildNotification("Cảnh báo khẩn cấp - $message"))
      
      // Also increase system volume if possible
      audioManager?.let { am ->
        val maxVolume = am.getStreamMaxVolume(AudioManager.STREAM_ALARM)
        val targetSystemVolume = (maxVolume * volume).toInt().coerceIn(0, maxVolume)
        am.setStreamVolume(AudioManager.STREAM_ALARM, targetSystemVolume, 0)
      }
    } catch (_: Exception) {}
  }

  private fun buildNotification(text: String): Notification {
    val stopIntent = Intent(this, EmergencySoundService::class.java).apply { action = ACTION_STOP }
    val stopPending = androidx.core.app.PendingIntentCompat.getService(
      this, 1010, stopIntent, 0, true
    )

    val builder = NotificationCompat.Builder(this, "emergency")
      .setSmallIcon(R.mipmap.ic_launcher)
      .setContentTitle("Smart IoT Kitchen - Emergency")
      .setContentText(text)
      .setOnlyAlertOnce(true)
      .setOngoing(true)
      .setCategory(NotificationCompat.CATEGORY_ALARM)
      .setPriority(NotificationCompat.PRIORITY_MAX)
      .addAction(NotificationCompat.Action(0, "TẮT BÁO ĐỘNG", stopPending))

    return builder.build()
  }

  private fun stopEscalation() {
    try {
      escalationRunnable?.let { runnable ->
        escalationHandler?.removeCallbacks(runnable)
      }
      escalationHandler = null
      escalationRunnable = null
    } catch (_: Exception) {}
  }

  override fun onDestroy() {
    super.onDestroy()
    try { 
      stopEscalation()
      player?.stop()
      player?.release()
      player = null
    } catch (_: Exception) {}
    try { 
      vibrator?.cancel()
      vibrator = null
    } catch (_: Exception) {}
  }

  override fun onTaskRemoved(rootIntent: Intent?) {
    try { stopSelf() } catch (_: Exception) {}
    super.onTaskRemoved(rootIntent)
  }
}