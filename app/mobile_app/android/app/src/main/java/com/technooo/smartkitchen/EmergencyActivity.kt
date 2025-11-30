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
import android.view.View
import android.graphics.drawable.GradientDrawable
import android.graphics.Typeface
import android.app.KeyguardManager

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

    // Start emergency sound service
    startEmergencySoundService()
    
    // Create emergency UI
    createEmergencyUI()
  }

  private fun createEmergencyUI() {
    val layout = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      setBackgroundColor(Color.parseColor("#B00020")) // Deep emergency red
      gravity = Gravity.CENTER
      setPadding(50, 80, 50, 60)
    }

    // Get data from intent
    val title = intent.getStringExtra("title") ?: "Cảnh báo khẩn cấp"
    val body = intent.getStringExtra("body") ?: "Phát hiện sự cố an toàn!"
    val deviceId = intent.getStringExtra("deviceId")
    val deviceName = intent.getStringExtra("deviceName") ?: "Thiết bị"
    val sensorType = intent.getStringExtra("sensorType") ?: "cảm biến"
    val sensorValue = intent.getStringExtra("sensorValue")
    val threshold = intent.getStringExtra("threshold")

    // Title
    val titleText = TextView(this).apply {
      text = "🚨  CẢNH BÁO"
      textSize = 28f
      setTextColor(Color.WHITE)
      gravity = Gravity.CENTER
      setPadding(0, 0, 0, 24)
      setTypeface(typeface, Typeface.BOLD)
    }

    // Device info
    val deviceText = TextView(this).apply {
      text = "Thiết bị: $deviceName"
      textSize = 18f
      setTextColor(Color.parseColor("#FFE6E9"))
      gravity = Gravity.CENTER
      setPadding(0, 0, 0, 6)
    }

    // Sensor info
    val sensorText = TextView(this).apply {
      val valueText = sensorValue ?: "—"
      val thresholdText = threshold ?: "—"
      text = when (sensorType.lowercase()) {
        "gas_ppm" -> "Khí gas: $valueText  •  Ngưỡng: $thresholdText"
        "smoke" -> "Khói: $valueText  •  Ngưỡng: $thresholdText"
        "temperature", "temp" -> "Nhiệt độ: $valueText°C  •  Ngưỡng: $thresholdText"
        else -> "$sensorType: $valueText  •  Ngưỡng: $thresholdText"
      }
      textSize = 20f
      setTextColor(Color.WHITE)
      gravity = Gravity.CENTER
      setPadding(0, 0, 0, 12)
      setTypeface(typeface, Typeface.BOLD)
    }

    // Message
    val messageText = TextView(this).apply {
      text = body
      textSize = 16f
      setTextColor(Color.parseColor("#FFE6E9"))
      gravity = Gravity.CENTER
      setPadding(0, 0, 0, 20)
    }

    // Content card for clarity
    val card = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER
      val bg = GradientDrawable().apply {
        shape = GradientDrawable.RECTANGLE
        cornerRadius = 24f
        setColor(Color.parseColor("#B71C1C"))
      }
      background = bg
      setPadding(36, 28, 36, 28)
    }

    // Action buttons
    val buttonLayout = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER
    }

    val checkButton = Button(this).apply {
      text = "KIỂM TRA NGAY"
      setBackgroundColor(Color.parseColor("#FF6B35")) // orange
      setTextColor(Color.WHITE)
      textSize = 16f
      setPadding(40, 22, 40, 22)
      setOnClickListener {
        unlockIfNeededThen {
          startMainWithAction("inspect_device", deviceId, deviceName)
        }
      }
    }

    val activateButton = Button(this).apply {
      text = "BẬT CHẾ ĐỘ KHẨN CẤP"
      setBackgroundColor(Color.parseColor("#C62828")) // darker red
      setTextColor(Color.WHITE)
      textSize = 16f
      setPadding(40, 22, 40, 22)
      setOnClickListener {
        unlockIfNeededThen {
          // Show immediate feedback toast
          Toast.makeText(this@EmergencyActivity, "Đang bật chế độ khẩn cấp...", Toast.LENGTH_SHORT).show()
          // Set suppression window so urgent notification won't reopen UI immediately
          try {
            val prefs = getSharedPreferences("emergency_prefs", MODE_PRIVATE)
            prefs.edit()
              .putLong("last_emergency_activation_ts", System.currentTimeMillis())
              .apply()
          } catch (_: Exception) {}
          startMainWithAction("activate_emergency", deviceId, deviceName)
        }
      }
    }

    val dismissButton = Button(this).apply {
      text = "BỎ QUA"
      setBackgroundColor(Color.parseColor("#6C757D"))
      setTextColor(Color.WHITE)
      textSize = 14f
      setPadding(30, 15, 30, 15)
      setOnClickListener {
        try { 
          stopService(Intent(this@EmergencyActivity, EmergencySoundService::class.java)) 
        } catch (_: Exception) {
          
        }
        finish()
      }
    }

    val btnParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply {
      topMargin = 20
    }
    val cardParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply {
      leftMargin = 24
      rightMargin = 24
      bottomMargin = 20
    }

    buttonLayout.addView(checkButton, btnParams)
    //buttonLayout.addView(activateButton, btnParams)
    buttonLayout.addView(dismissButton, btnParams)

    card.addView(deviceText)
    card.addView(sensorText)
    card.addView(messageText)

    layout.addView(titleText)
    layout.addView(card, cardParams)
    layout.addView(buttonLayout, cardParams)

    setContentView(layout)
  }

  private fun startEmergencySoundService() {
    try {
      val intent = Intent(this, EmergencySoundService::class.java)
      startService(intent)
    } catch (_: Exception) {}
  }

  private fun startMainWithAction(action: String, deviceId: String?, deviceName: String?) {
    // Stop continuous alarm service when user acts
    try { stopService(Intent(this, EmergencySoundService::class.java)) } catch (_: Exception) {}
    val intent = Intent(this@EmergencyActivity, MainActivity::class.java)
    intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
    intent.putExtra("emergencyAction", action)
    if (deviceId != null) intent.putExtra("deviceId", deviceId)
    if (deviceName != null) intent.putExtra("deviceName", deviceName)
    startActivity(intent)
    finish()
  }

  private fun unlockIfNeededThen(next: () -> Unit) {
    try {
      val km = getSystemService(KEYGUARD_SERVICE) as KeyguardManager
      if (km.isKeyguardLocked) {
        km.requestDismissKeyguard(this, object : KeyguardManager.KeyguardDismissCallback() {
          override fun onDismissSucceeded() {
            next()
          }
          override fun onDismissCancelled() {
            next() // still try
          }
          override fun onDismissError() {
            next()
          }
        })
      } else {
        next()
      }
    } catch (e: Exception) {
      next()
    }
  }

  override fun onBackPressed() {
    // Prevent back button from dismissing emergency screen
    Toast.makeText(this, "Không thể thoát khỏi màn hình khẩn cấp", Toast.LENGTH_SHORT).show()
  }
}


