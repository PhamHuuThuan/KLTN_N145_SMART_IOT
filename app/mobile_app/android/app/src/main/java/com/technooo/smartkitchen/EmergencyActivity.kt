package com.technooo.smartkitchen

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import android.view.WindowManager
import android.widget.Button
import android.widget.TextView
import android.widget.LinearLayout
import android.graphics.Color
import android.view.Gravity
import android.widget.Toast

class EmergencyActivity : Activity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)

    // Make this activity appear over lock screen and take full control
    window.addFlags(
      WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
      WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or
      WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON or
      WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD or
      WindowManager.LayoutParams.FLAG_FULLSCREEN or
      WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS or
      WindowManager.LayoutParams.FLAG_ALLOW_LOCK_WHILE_SCREEN_ON
    )

    // Set activity to show over lock screen
    setShowWhenLocked(true)
    setTurnScreenOn(true)

    // Set activity to full screen
    window.decorView.systemUiVisibility = (
      android.view.View.SYSTEM_UI_FLAG_FULLSCREEN or
      android.view.View.SYSTEM_UI_FLAG_HIDE_NAVIGATION or
      android.view.View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
    )

    // Create emergency UI
    createEmergencyUI()
  }

  private fun createEmergencyUI() {
    val layout = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      setBackgroundColor(Color.parseColor("#D90429")) // Red background
      gravity = Gravity.CENTER
      setPadding(50, 100, 50, 100)
    }

    // Get data from intent
    val title = intent.getStringExtra("title") ?: "Cảnh báo khẩn cấp"
    val body = intent.getStringExtra("body") ?: "Phát hiện sự cố an toàn!"
    val deviceName = intent.getStringExtra("deviceName") ?: "Thiết bị"
    val sensorType = intent.getStringExtra("sensorType") ?: "cảm biến"
    val sensorValue = intent.getStringExtra("sensorValue")
    val threshold = intent.getStringExtra("threshold")

    // Title
    val titleText = TextView(this).apply {
      text = "🚨 CẢNH BÁO KHẨN CẤP 🚨"
      textSize = 24f
      setTextColor(Color.WHITE)
      gravity = Gravity.CENTER
      setPadding(0, 0, 0, 30)
    }

    // Device info
    val deviceText = TextView(this).apply {
      text = "Thiết bị: $deviceName"
      textSize = 18f
      setTextColor(Color.WHITE)
      gravity = Gravity.CENTER
      setPadding(0, 0, 0, 10)
    }

    // Sensor info
    val sensorText = TextView(this).apply {
      val sensorInfo = if (sensorValue != null && threshold != null) {
        "$sensorType: $sensorValue (ngưỡng: $threshold)"
      } else if (sensorValue != null) {
        "$sensorType: $sensorValue"
      } else {
        sensorType
      }
      text = sensorInfo
      textSize = 16f
      setTextColor(Color.WHITE)
      gravity = Gravity.CENTER
      setPadding(0, 0, 0, 20)
    }

    // Message
    val messageText = TextView(this).apply {
      text = body
      textSize = 18f
      setTextColor(Color.WHITE)
      gravity = Gravity.CENTER
      setPadding(0, 0, 0, 50)
    }

    // Action buttons
    val buttonLayout = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER
    }

    val checkButton = Button(this).apply {
      text = "KIỂM TRA NGAY"
      setBackgroundColor(Color.parseColor("#FF6B35"))
      setTextColor(Color.WHITE)
      textSize = 16f
      setPadding(40, 20, 40, 20)
      setOnClickListener {
        // Start main activity
        val intent = Intent(this@EmergencyActivity, MainActivity::class.java)
        intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        startActivity(intent)
        finish()
      }
    }

    val dismissButton = Button(this).apply {
      text = "BỎ QUA"
      setBackgroundColor(Color.parseColor("#6C757D"))
      setTextColor(Color.WHITE)
      textSize = 14f
      setPadding(30, 15, 30, 15)
      setOnClickListener {
        finish()
      }
    }

    buttonLayout.addView(checkButton)
    buttonLayout.addView(dismissButton)

    layout.addView(titleText)
    layout.addView(deviceText)
    layout.addView(sensorText)
    layout.addView(messageText)
    layout.addView(buttonLayout)

    setContentView(layout)
  }

  override fun onBackPressed() {
    // Prevent back button from dismissing emergency screen
    Toast.makeText(this, "Không thể thoát khỏi màn hình khẩn cấp", Toast.LENGTH_SHORT).show()
  }
}


