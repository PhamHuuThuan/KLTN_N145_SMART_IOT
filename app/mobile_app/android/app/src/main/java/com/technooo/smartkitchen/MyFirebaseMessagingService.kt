package com.technooo.smartkitchen

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.os.VibrationEffect
import android.os.Vibrator
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import com.technooo.smartkitchen.R
import android.media.AudioAttributes

class MyFirebaseMessagingService : FirebaseMessagingService() {
  companion object {
    private const val EMERGENCY_CHANNEL_ID = "emergency"
    private const val EMERGENCY_CHANNEL_NAME = "Emergency Alerts"
  }

  override fun onCreate() {
    super.onCreate()
    createNotificationChannel()
  }

  private fun createNotificationChannel() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val notificationManager = getSystemService(NotificationManager::class.java)
      
      // Create emergency channel
      val emergencyChannel = NotificationChannel(
        EMERGENCY_CHANNEL_ID,
        EMERGENCY_CHANNEL_NAME,
        NotificationManager.IMPORTANCE_HIGH
      ).apply {
        description = "High priority emergency alerts"
        enableLights(true)
        enableVibration(true)
        vibrationPattern = longArrayOf(0, 1000, 500, 1000)
        setShowBadge(true)
        lockscreenVisibility = NotificationCompat.VISIBILITY_PUBLIC
        setSound(
          Uri.parse("android.resource://" + packageName + "/" + R.raw.emergy_sound),
          AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_ALARM)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build()
        )
      }
      
      // Create default channel for regular notifications
      val defaultChannel = NotificationChannel(
        "default",
        "Default Notifications",
        NotificationManager.IMPORTANCE_DEFAULT
      ).apply {
        description = "Regular app notifications"
        enableLights(true)
        enableVibration(true)
        setShowBadge(true)
        lockscreenVisibility = NotificationCompat.VISIBILITY_PUBLIC
      }
      
      notificationManager.createNotificationChannel(emergencyChannel)
      notificationManager.createNotificationChannel(defaultChannel)
    }
  }

  override fun onMessageReceived(remoteMessage: RemoteMessage) {
    val data = remoteMessage.data
    val notification = remoteMessage.notification
    
    val priority = data["priority"]?.lowercase()
    val category = data["category"]?.lowercase()
    val type = data["type"]?.lowercase()
    val action = data["action"]?.lowercase()
    val title = notification?.title ?: data["title"] ?: ""
    val metadata = data["metadata"]?.let { json ->
      try {
        // Simple JSON parsing to check if it's an emergency activation notification
        json.contains("\"action\":\"emergency_activated\"") || json.contains("emergency_activated")
      } catch (_: Exception) {
        false
      }
    } ?: false
    
    // Check if this is an emergency activation notification (not a real emergency alert)
    val isEmergencyActivation = action == "emergency_activated" || 
                               action == "emergency_mode_activated" ||
                               metadata || 
                               title.contains("emergency mode activated", ignoreCase = true) ||
                               title.contains("chế độ khẩn cấp", ignoreCase = true)
    
    // Only treat as emergency if it's urgent/security AND not an activation notification AND not system category
    val isEmergency = (priority == "urgent" || category == "security" || type == "security_alert") && 
                      !isEmergencyActivation && 
                      category != "system"

    // Read suppression window (5 seconds) to prevent re-opening UI after manual activation
    var suppressFullScreen = false
    try {
      val prefs = getSharedPreferences("emergency_prefs", MODE_PRIVATE)
      val lastTs = prefs.getLong("last_emergency_activation_ts", 0L)
      if (lastTs > 0 && (System.currentTimeMillis() - lastTs) < 5000L) {
        suppressFullScreen = true
      }
    } catch (_: Exception) {}

    if (isEmergency) {
      // Start emergency sound service for real emergencies
      startEmergencySoundService()
      handleEmergencyNotification(data, notification, suppressFullScreen)
    } else {
      handleNormalNotification(data, notification)
    }
  }

  private fun startEmergencySoundService() {
    try {
      val intent = Intent(this, EmergencySoundService::class.java)
      startService(intent)
      android.util.Log.d("FCMService", "Started EmergencySoundService for real emergency")
    } catch (e: Exception) {
      android.util.Log.e("FCMService", "Failed to start EmergencySoundService", e)
    }
  }

  private fun handleEmergencyNotification(data: Map<String, String>, notification: RemoteMessage.Notification?, suppressFullScreen: Boolean = false) {
    val title = notification?.title ?: data["title"] ?: "Cảnh báo khẩn cấp"
    val body = notification?.body ?: data["body"] ?: "Phát hiện sự cố an toàn. Mở ngay."

    // Create full-screen intent for EmergencyActivity
    val fullScreenIntent = Intent(this, EmergencyActivity::class.java).apply {
      flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
      // Pass data to emergency activity
      putExtra("title", title)
      putExtra("body", body)
      putExtra("deviceId", data["deviceId"])
      putExtra("deviceName", data["deviceName"])
      putExtra("sensorType", data["sensorType"])
      putExtra("sensorValue", data["sensorValue"])
      putExtra("threshold", data["threshold"])
    }

    val fullScreenPendingIntent = PendingIntent.getActivity(
      this, 
      System.currentTimeMillis().toInt(),
      fullScreenIntent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )

    val channelId = EMERGENCY_CHANNEL_ID
    val builder = NotificationCompat.Builder(this, channelId)
      .setSmallIcon(R.mipmap.ic_launcher)
      .setContentTitle(title)
      .setContentText(body)
      .setPriority(NotificationCompat.PRIORITY_MAX)
      .setCategory(NotificationCompat.CATEGORY_ALARM)
      .setOngoing(true)
      .setAutoCancel(true)
      .setSound(Uri.parse("android.resource://" + packageName + "/" + R.raw.emergy_sound))
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
      .setColor(0xFFD90429.toInt())
      .setLights(0xFFD90429.toInt(), 1000, 1000)

    // Only attach full-screen intent if not suppressed
    if (!suppressFullScreen) {
      builder.setFullScreenIntent(fullScreenPendingIntent, true)
    } else {
      // If suppressed, attach normal content intent so it won't pop full-screen again
      builder.setContentIntent(fullScreenPendingIntent)
    }

    val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    notificationManager.notify(System.currentTimeMillis().toInt(), builder.build())
  }

  private fun handleNormalNotification(data: Map<String, String>, notification: RemoteMessage.Notification?) {
    val title = notification?.title ?: data["title"] ?: "Thông báo"
    val body = notification?.body ?: data["body"] ?: "Bạn có thông báo mới"

    android.util.Log.d("FCMService", "Handling normal notification: $title - $body")

    // Try to call React Native function if app is in foreground
    try {
      val reactContext = applicationContext as? com.facebook.react.ReactApplication
      val reactInstanceManager = reactContext?.reactNativeHost?.reactInstanceManager
      
      if (reactInstanceManager != null) {
        val reactContext2 = reactInstanceManager.currentReactContext
        if (reactContext2 != null) {
          // Create a map with the notification data
          val notificationData = mutableMapOf<String, Any>()
          notificationData["title"] = title
          notificationData["body"] = body
          notificationData["data"] = data
          
          // Use DeviceEventEmitter to send event to React Native
          val eventEmitter = reactContext2.getJSModule(com.facebook.react.modules.core.DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
          val arguments = com.facebook.react.bridge.Arguments.createMap()
          arguments.putString("title", title)
          arguments.putString("body", body)
          val dataMap = com.facebook.react.bridge.Arguments.createMap()
          data.forEach { (key, value) ->
            dataMap.putString(key, value)
          }
          arguments.putMap("data", dataMap)
          eventEmitter.emit("FCMDataMessage", arguments)
          android.util.Log.d("FCMService", "Emitted FCMDataMessage event to React Native")
        } else {
          android.util.Log.w("FCMService", "React context is null, app might be in background")
        }
      } else {
        android.util.Log.w("FCMService", "React instance manager is null")
      }
    } catch (e: Exception) {
      android.util.Log.e("FCMService", "Error calling React Native function", e)
    }

    // Also create system notification for when app is in background
    val intent = Intent(this, MainActivity::class.java).apply {
      flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
    }

    val pendingIntent = PendingIntent.getActivity(
      this,
      System.currentTimeMillis().toInt(),
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )

    val builder = NotificationCompat.Builder(this, "default")
      .setSmallIcon(R.mipmap.ic_launcher)
      .setContentTitle(title)
      .setContentText(body)
      .setPriority(NotificationCompat.PRIORITY_DEFAULT)
      .setAutoCancel(true)
      .setContentIntent(pendingIntent)

    NotificationManagerCompat.from(this).notify(
      (System.currentTimeMillis() % Int.MAX_VALUE).toInt(),
      builder.build()
    )
  }
}


