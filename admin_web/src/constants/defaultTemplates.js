// Default templates - fixed with clear non-overlapping ranges
export const DEFAULT_TEMPLATES = {
  vi: {
    temp_emergency: {
      name: '🚨 Nhiệt độ khẩn cấp',
      description: 'Cảnh báo khẩn cấp khi nhiệt độ > 40°C',
      priority: 'urgent',
      cooldownPeriod: 0,
      conditions: [
        { type: 'sensor', sensor: 'temperature', operator: '>', value: 40, unit: '°C' }
      ],
      actions: [
        { type: 'send_alert', message: '🚨 CẢNH BÁO KHẨN CẤP: Nhiệt độ cực cao! Nguy cơ cháy nổ!' }
      ]
    },

    temp_high: {
      name: '🌡️ Nhiệt độ cao',
      description: 'Cảnh báo khi nhiệt độ 35–40°C',
      priority: 'high',
      cooldownPeriod: 60000,
      conditions: [
        { type: 'sensor', sensor: 'temperature', operator: '>=', value: 35, unit: '°C' },
        { type: 'sensor', sensor: 'temperature', operator: '<=', value: 40, unit: '°C' }
      ],
      actions: [
        { type: 'send_notification', message: '🌡️ Cảnh báo: Nhiệt độ cao! Kiểm tra hệ thống làm mát hoặc thông gió.' }
      ]
    },

    temp_low: {
      name: '❄️ Nhiệt độ thấp',
      description: 'Cảnh báo khi nhiệt độ < 25°C',
      priority: 'low',
      cooldownPeriod: 180000,
      conditions: [
        { type: 'sensor', sensor: 'temperature', operator: '<', value: 25, unit: '°C' }
      ],
      actions: [
        { type: 'send_notification', message: '❄️ Cảnh báo: Nhiệt độ thấp! Kiểm tra hệ thống sưởi hoặc môi trường lưu trữ.' }
      ]
    },

    humidity_emergency: {
      name: '🚨 Độ ẩm khẩn cấp',
      description: 'Cảnh báo khẩn cấp khi độ ẩm > 70%',
      priority: 'urgent',
      cooldownPeriod: 0,
      conditions: [
        { type: 'sensor', sensor: 'humidity', operator: '>', value: 70, unit: '%' }
      ],
      actions: [
        { type: 'send_alert', message: '🚨 CẢNH BÁO KHẨN CẤP: Độ ẩm quá cao! Nguy cơ chập điện hoặc hư hại thiết bị!' }
      ]
    },

    humidity_high: {
      name: '💧 Độ ẩm cao',
      description: 'Cảnh báo khi độ ẩm 55–70%',
      priority: 'high',
      cooldownPeriod: 60000,
      conditions: [
        { type: 'sensor', sensor: 'humidity', operator: '>=', value: 55, unit: '%' },
        { type: 'sensor', sensor: 'humidity', operator: '<=', value: 70, unit: '%' }
      ],
      actions: [
        { type: 'send_notification', message: '💧 Cảnh báo: Độ ẩm cao! Có thể gây nấm mốc, ảnh hưởng linh kiện.' }
      ]
    },

    humidity_low: {
      name: '💧 Độ ẩm thấp',
      description: 'Cảnh báo khi độ ẩm < 30%',
      priority: 'low',
      cooldownPeriod: 180000,
      conditions: [
        { type: 'sensor', sensor: 'humidity', operator: '<', value: 30, unit: '%' }
      ],
      actions: [
        { type: 'send_notification', message: '💧 Cảnh báo: Độ ẩm thấp! Không khí khô, dễ gây tĩnh điện.' }
      ]
    },

    gas_emergency: {
      name: '🚨 Khí gas khẩn cấp',
      description: 'Cảnh báo khẩn cấp khi khí gas > 1000 ppm',
      priority: 'urgent',
      cooldownPeriod: 0,
      conditions: [
        { type: 'sensor', sensor: 'gas_ppm', operator: '>', value: 1000, unit: 'ppm' }
      ],
      actions: [
        { type: 'send_alert', message: '🚨 CẢNH BÁO KHẨN CẤP: Khí gas ở mức nguy hiểm! Nguy cơ ngộ độc hoặc cháy nổ!' }
      ]
    },

    gas_high: {
      name: '💨 Khí gas cao',
      description: 'Cảnh báo khi khí gas 401–1000 ppm',
      priority: 'high',
      cooldownPeriod: 60000,
      conditions: [
        { type: 'sensor', sensor: 'gas_ppm', operator: '>=', value: 401, unit: 'ppm' },
        { type: 'sensor', sensor: 'gas_ppm', operator: '<=', value: 1000, unit: 'ppm' }
      ],
      actions: [
        { type: 'send_notification', message: '💨 Cảnh báo: Nồng độ khí gas cao! Kiểm tra nguồn rò rỉ ngay.' }
      ]
    },

    smoke_emergency: {
      name: '🚨 Khói khẩn cấp',
      description: 'Cảnh báo khẩn cấp khi khói > 4.5V',
      priority: 'urgent',
      cooldownPeriod: 0,
      conditions: [
        { type: 'sensor', sensor: 'smoke', operator: '>', value: 4.5, unit: 'V' }
      ],
      actions: [
        { type: 'send_alert', message: '🚨 CẢNH BÁO KHẨN CẤP: Nồng độ khói đậm! Nguy cơ cháy hoặc khí CO cao!' }
      ]
    },

    smoke_high: {
      name: '🔥 Khói cao',
      description: 'Cảnh báo khi khói 3.5–4.5V',
      priority: 'high',
      cooldownPeriod: 60000,
      conditions: [
        { type: 'sensor', sensor: 'smoke', operator: '>=', value: 3.5, unit: 'V' },
        { type: 'sensor', sensor: 'smoke', operator: '<=', value: 4.5, unit: 'V' }
      ],
      actions: [
        { type: 'send_notification', message: '🔥 Cảnh báo: Phát hiện khói đậm! Kiểm tra ngay để phòng cháy.' }
      ]
    },

    flame_detected: {
      name: '🔥 Phát hiện lửa',
      description: 'Cảnh báo khẩn cấp khi cảm biến lửa kích hoạt',
      priority: 'urgent',
      cooldownPeriod: 0,
      conditions: [
        { type: 'sensor', sensor: 'flame', operator: '==', value: 1, unit: '' }
      ],
      actions: [
        { type: 'send_alert', message: '🔥 CẢNH BÁO KHẨN CẤP: Phát hiện ngọn lửa! Dừng thiết bị và xử lý ngay lập tức!' }
      ]
    }
  },

  // ===================== ENGLISH VERSION ======================

  en: {
    temp_emergency: {
      name: '🚨 Temperature Emergency',
      description: 'Emergency alert when temperature > 40°C',
      priority: 'urgent',
      cooldownPeriod: 0,
      conditions: [
        { type: 'sensor', sensor: 'temperature', operator: '>', value: 40, unit: '°C' }
      ],
      actions: [
        { type: 'send_alert', message: '🚨 EMERGENCY ALERT: Extremely high temperature! Risk of fire or explosion!' }
      ]
    },

    temp_high: {
      name: '🌡️ High Temperature',
      description: 'Alert when temperature is between 35–40°C',
      priority: 'high',
      cooldownPeriod: 60000,
      conditions: [
        { type: 'sensor', sensor: 'temperature', operator: '>=', value: 35, unit: '°C' },
        { type: 'sensor', sensor: 'temperature', operator: '<=', value: 40, unit: '°C' }
      ],
      actions: [
        { type: 'send_notification', message: '🌡️ Warning: High temperature detected! Check cooling or ventilation systems.' }
      ]
    },

    temp_low: {
      name: '❄️ Low Temperature',
      description: 'Alert when temperature < 25°C',
      priority: 'low',
      cooldownPeriod: 180000,
      conditions: [
        { type: 'sensor', sensor: 'temperature', operator: '<', value: 25, unit: '°C' }
      ],
      actions: [
        { type: 'send_notification', message: '❄️ Notice: Low temperature detected! Check heating or storage conditions.' }
      ]
    },

    humidity_emergency: {
      name: '🚨 Humidity Emergency',
      description: 'Emergency alert when humidity > 70%',
      priority: 'urgent',
      cooldownPeriod: 0,
      conditions: [
        { type: 'sensor', sensor: 'humidity', operator: '>', value: 80, unit: '%' }
      ],
      actions: [
        { type: 'send_alert', message: '🚨 EMERGENCY ALERT: Excessive humidity! Risk of short circuit or equipment damage!' }
      ]
    },

    humidity_high: {
      name: '💧 High Humidity',
      description: 'Alert when humidity is between 55–70%',
      priority: 'high',
      cooldownPeriod: 60000,
      conditions: [
        { type: 'sensor', sensor: 'humidity', operator: '>=', value: 55, unit: '%' },
        { type: 'sensor', sensor: 'humidity', operator: '<=', value: 70, unit: '%' }
      ],
      actions: [
        { type: 'send_notification', message: '💧 Warning: High humidity level! May cause mold or component corrosion.' }
      ]
    },

    humidity_low: {
      name: '💧 Low Humidity',
      description: 'Alert when humidity < 30%',
      priority: 'low',
      cooldownPeriod: 180000,
      conditions: [
        { type: 'sensor', sensor: 'humidity', operator: '<', value: 30, unit: '%' }
      ],
      actions: [
        { type: 'send_notification', message: '💧 Notice: Low humidity! Dry air may cause static electricity.' }
      ]
    },

    gas_emergency: {
      name: '🚨 Gas Emergency',
      description: 'Emergency alert when gas concentration > 1000 ppm',
      priority: 'urgent',
      cooldownPeriod: 0,
      conditions: [
        { type: 'sensor', sensor: 'gas_ppm', operator: '>', value: 1000, unit: 'ppm' }
      ],
      actions: [
        { type: 'send_alert', message: '🚨 EMERGENCY ALERT: Dangerous gas concentration! Risk of poisoning or explosion!' }
      ]
    },

    gas_high: {
      name: '💨 High Gas Level',
      description: 'Alert when gas concentration is between 401–1000 ppm',
      priority: 'high',
      cooldownPeriod: 60000,
      conditions: [
        { type: 'sensor', sensor: 'gas_ppm', operator: '>=', value: 401, unit: 'ppm' },
        { type: 'sensor', sensor: 'gas_ppm', operator: '<=', value: 1000, unit: 'ppm' }
      ],
      actions: [
        { type: 'send_notification', message: '💨 Warning: High gas concentration detected! Check for leaks immediately.' }
      ]
    },

    smoke_emergency: {
      name: '🚨 Smoke Emergency',
      description: 'Emergency alert when smoke > 4.5V',
      priority: 'urgent',
      cooldownPeriod: 0,
      conditions: [
        { type: 'sensor', sensor: 'smoke', operator: '>', value: 4.5, unit: 'V' }
      ],
      actions: [
        { type: 'send_alert', message: '🚨 EMERGENCY ALERT: Dense smoke detected! High risk of fire or CO exposure!' }
      ]
    },

    smoke_high: {
      name: '🔥 High Smoke Level',
      description: 'Alert when smoke 3.5–4.5V',
      priority: 'high',
      cooldownPeriod: 60000,
      conditions: [
        { type: 'sensor', sensor: 'smoke', operator: '>=', value: 3.5, unit: 'V' },
        { type: 'sensor', sensor: 'smoke', operator: '<=', value: 4.5, unit: 'V' }
      ],
      actions: [
        { type: 'send_notification', message: '🔥 Warning: Heavy smoke detected! Possible fire, check immediately.' }
      ]
    },

    smoke_medium: {
      name: '💨 Medium Smoke Level',
      description: 'Alert when smoke 2.5–3.5V (normal ~3V)',
      priority: 'medium',
      cooldownPeriod: 120000,
      conditions: [
        { type: 'sensor', sensor: 'smoke', operator: '>=', value: 2.5, unit: 'V' },
        { type: 'sensor', sensor: 'smoke', operator: '<=', value: 3.5, unit: 'V' }
      ],
      actions: [
        { type: 'send_notification', message: '💨 Notice: Light smoke detected. Could be dust or mild vapor.' }
      ]
    },

    flame_detected: {
      name: '🔥 Flame Detected',
      description: 'Emergency alert when flame sensor is triggered',
      priority: 'urgent',
      cooldownPeriod: 0,
      conditions: [
        { type: 'sensor', sensor: 'flame', operator: '==', value: 1, unit: '' }
      ],
      actions: [
        { type: 'send_alert', message: '🔥 EMERGENCY ALERT: Flame detected! Shut down nearby equipment and act immediately!' }
      ]
    }
  }
};
