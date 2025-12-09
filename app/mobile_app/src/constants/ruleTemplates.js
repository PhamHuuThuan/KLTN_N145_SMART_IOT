// Rule templates with multi-language support
export const RULE_TEMPLATES = {
  vi: {
    // 🌡️ TEMPERATURE - NHIỆT ĐỘ
    // 🔴 URGENT - Khẩn cấp
    temp_emergency: {
      name: 'rules.templates.tempEmergency.name',
      description: 'rules.templates.tempEmergency.description',
      priority: 'urgent',
      cooldownPeriod: 0, // Không có thời gian chờ cho chế độ khẩn cấp
      conditions: [
        {
          type: 'sensor',
          sensor: 'temperature',
          operator: '>',
          value: 40,
          unit: '°C'
        }
      ],
      actions: [
        {
          type: 'send_alert',
          message: 'rules.templates.tempEmergency.message'
        }
      ]
    },
    
    // 🟠 HIGH - Cao
    temp_high: {
      name: 'rules.templates.tempHigh.name',
      description: 'rules.templates.tempHigh.description',
      priority: 'high',
      cooldownPeriod: 60000, // 1 phút
      conditions: [
        {
          type: 'sensor',
          sensor: 'temperature',
          operator: '>=',
          value: 35,
          unit: '°C'
        },
        {
          type: 'sensor',
          sensor: 'temperature',
          operator: '<=',
          value: 40,
          unit: '°C'
        }
      ],
      actions: [
        {
          type: 'send_notification',
          message: 'rules.templates.tempHigh.message'
        }
      ]
    },
    
    // 🔵 LOW - Thấp
    temp_low: {
      name: 'rules.templates.tempLow.name',
      description: 'rules.templates.tempLow.description',
      priority: 'low',
      cooldownPeriod: 180000, // 3 phút
      conditions: [
        {
          type: 'sensor',
          sensor: 'temperature',
          operator: '<',
          value: 25,
          unit: '°C'
        }
      ],
      actions: [
        {
          type: 'send_notification',
          message: 'rules.templates.tempLow.message'
        }
      ]
    },

    // 💧 HUMIDITY - ĐỘ ẨM
    // 🔴 URGENT - Khẩn cấp
    humidity_emergency: {
      name: 'rules.templates.humidityEmergency.name',
      description: 'rules.templates.humidityEmergency.description',
      priority: 'urgent',
      cooldownPeriod: 0, // Không có thời gian chờ cho chế độ khẩn cấp
      conditions: [
        {
          type: 'sensor',
          sensor: 'humidity',
          operator: '>',
          value: 70,
          unit: '%'
        }
      ],
      actions: [
        {
          type: 'send_alert',
          message: 'rules.templates.humidityEmergency.message'
        }
      ]
    },
    
    // 🟠 HIGH - Cao
    humidity_high: {
      name: 'rules.templates.humidityHigh.name',
      description: 'rules.templates.humidityHigh.description',
      priority: 'high',
      cooldownPeriod: 60000, // 1 phút
      conditions: [
        {
          type: 'sensor',
          sensor: 'humidity',
          operator: '>=',
          value: 55,
          unit: '%'
        },
        {
          type: 'sensor',
          sensor: 'humidity',
          operator: '<=',
          value: 70,
          unit: '%'
        }
      ],
      actions: [
        {
          type: 'send_notification',
          message: 'rules.templates.humidityHigh.message'
        }
      ]
    },
    
    // 🔵 LOW - Thấp
    humidity_low: {
      name: 'rules.templates.humidityLow.name',
      description: 'rules.templates.humidityLow.description',
      priority: 'low',
      cooldownPeriod: 180000, // 3 phút
      conditions: [
        {
          type: 'sensor',
          sensor: 'humidity',
          operator: '<',
          value: 30,
          unit: '%'
        }
      ],
      actions: [
        {
          type: 'send_notification',
          message: 'rules.templates.humidityLow.message'
        }
      ]
    },

    // 🧪 GAS - KHÍ GAS
    // 🔴 URGENT - Khẩn cấp
    gas_emergency: {
      name: 'rules.templates.gasEmergency.name',
      description: 'rules.templates.gasEmergency.description',
      priority: 'urgent',
      cooldownPeriod: 0, // Không có thời gian chờ cho chế độ khẩn cấp
      conditions: [
        {
          type: 'sensor',
          sensor: 'gas_ppm',
          operator: '>',
          value: 1000,
          unit: 'ppm'
        }
      ],
      actions: [
        {
          type: 'send_alert',
          message: 'rules.templates.gasEmergency.message'
        }
      ]
    },
    
    // 🟠 HIGH - Cao
    gas_high: {
      name: 'rules.templates.gasHigh.name',
      description: 'rules.templates.gasHigh.description',
      priority: 'high',
      cooldownPeriod: 60000, // 1 phút
      conditions: [
        {
          type: 'sensor',
          sensor: 'gas_ppm',
          operator: '>=',
          value: 401,
          unit: 'ppm'
        },
        {
          type: 'sensor',
          sensor: 'gas_ppm',
          operator: '<=',
          value: 1000,
          unit: 'ppm'
        }
      ],
      actions: [
        {
          type: 'send_notification',
          message: 'rules.templates.gasHigh.message'
        }
      ]
    },

    // 🚬 SMOKE - KHÓI
    // 🔴 URGENT - Khẩn cấp
    smoke_emergency: {
      name: 'rules.templates.smokeEmergency.name',
      description: 'rules.templates.smokeEmergency.description',
      priority: 'urgent',
      cooldownPeriod: 0, // Không có thời gian chờ cho chế độ khẩn cấp
      conditions: [
        {
          type: 'sensor',
          sensor: 'smoke',
          operator: '>',
          value: 4.5,
          unit: 'V'
        }
      ],
      actions: [
        {
          type: 'send_alert',
          message: 'rules.templates.smokeEmergency.message'
        }
      ]
    },
    
    // 🟠 HIGH - Cao
    smoke_high: {
      name: 'rules.templates.smokeHigh.name',
      description: 'rules.templates.smokeHigh.description',
      priority: 'high',
      cooldownPeriod: 60000, // 1 phút
      conditions: [
        {
          type: 'sensor',
          sensor: 'smoke',
          operator: '>=',
          value: 3.5,
          unit: 'V'
        },
        {
          type: 'sensor',
          sensor: 'smoke',
          operator: '<=',
          value: 4.5,
          unit: 'V'
        }
      ],
      actions: [
        {
          type: 'send_notification',
          message: 'rules.templates.smokeHigh.message'
        }
      ]
    },
    
    // 🟢 MEDIUM - Trung bình
    smoke_medium: {
      name: 'rules.templates.smokeMedium.name',
      description: 'rules.templates.smokeMedium.description',
      priority: 'medium',
      cooldownPeriod: 120000, // 2 phút
      conditions: [
        {
          type: 'sensor',
          sensor: 'smoke',
          operator: '>=',
          value: 2.5,
          unit: 'V'
        },
        {
          type: 'sensor',
          sensor: 'smoke',
          operator: '<=',
          value: 3.5,
          unit: 'V'
        }
      ],
      actions: [
        {
          type: 'send_notification',
          message: 'rules.templates.smokeMedium.message'
        }
      ]
    },
    
    // 🔥 FLAME - LỬA
    flame_detected: {
      name: 'rules.templates.flameDetected.name',
      description: 'rules.templates.flameDetected.description',
      priority: 'urgent',
      cooldownPeriod: 0, // Không có thời gian chờ cho chế độ khẩn cấp
      conditions: [
        {
          type: 'sensor',
          sensor: 'flame',
          operator: '==',
          value: 1,
          unit: ''
        }
      ],
      actions: [
        {
          type: 'send_alert',
          message: 'rules.templates.flameDetected.message'
        }
      ]
    }
  },
  en: {
    // 🌡️ TEMPERATURE
    temp_emergency: {
      name: 'rules.templates.tempEmergency.name',
      description: 'rules.templates.tempEmergency.description',
      priority: 'urgent',
      cooldownPeriod: 0, // Không có thời gian chờ cho chế độ khẩn cấp
      conditions: [
        {
          type: 'sensor',
          sensor: 'temperature',
          operator: '>',
          value: 40,
          unit: '°C'
        }
      ],
      actions: [
        {
          type: 'send_alert',
          message: 'rules.templates.tempEmergency.message'
        }
      ]
    },
    
    temp_high: {
      name: 'rules.templates.tempHigh.name',
      description: 'rules.templates.tempHigh.description',
      priority: 'high',
      cooldownPeriod: 60000, // 1 minute
      conditions: [
        {
          type: 'sensor',
          sensor: 'temperature',
          operator: '>=',
          value: 35,
          unit: '°C'
        },
        {
          type: 'sensor',
          sensor: 'temperature',
          operator: '<=',
          value: 40,
          unit: '°C'
        }
      ],
      actions: [
        {
          type: 'send_notification',
          message: 'rules.templates.tempHigh.message'
        }
      ]
    },
    
    temp_low: {
      name: 'rules.templates.tempLow.name',
      description: 'rules.templates.tempLow.description',
      priority: 'low',
      cooldownPeriod: 180000, // 3 minutes
      conditions: [
        {
          type: 'sensor',
          sensor: 'temperature',
          operator: '<',
          value: 25,
          unit: '°C'
        }
      ],
      actions: [
        {
          type: 'send_notification',
          message: 'rules.templates.tempLow.message'
        }
      ]
    },

    // 💧 HUMIDITY
    humidity_emergency: {
      name: 'rules.templates.humidityEmergency.name',
      description: 'rules.templates.humidityEmergency.description',
      priority: 'urgent',
      cooldownPeriod: 0, // Không có thời gian chờ cho chế độ khẩn cấp
      conditions: [
        {
          type: 'sensor',
          sensor: 'humidity',
          operator: '>',
          value: 70,
          unit: '%'
        }
      ],
      actions: [
        {
          type: 'send_alert',
          message: 'rules.templates.humidityEmergency.message'
        }
      ]
    },
    
    humidity_high: {
      name: 'rules.templates.humidityHigh.name',
      description: 'rules.templates.humidityHigh.description',
      priority: 'high',
      cooldownPeriod: 60000, // 1 minute
      conditions: [
        {
          type: 'sensor',
          sensor: 'humidity',
          operator: '>=',
          value: 55,
          unit: '%'
        },
        {
          type: 'sensor',
          sensor: 'humidity',
          operator: '<=',
          value: 70,
          unit: '%'
        }
      ],
      actions: [
        {
          type: 'send_notification',
          message: 'rules.templates.humidityHigh.message'
        }
      ]
    },
    
    humidity_low: {
      name: 'rules.templates.humidityLow.name',
      description: 'rules.templates.humidityLow.description',
      priority: 'low',
      cooldownPeriod: 180000, // 3 minutes
      conditions: [
        {
          type: 'sensor',
          sensor: 'humidity',
          operator: '<',
          value: 30,
          unit: '%'
        }
      ],
      actions: [
        {
          type: 'send_notification',
          message: 'rules.templates.humidityLow.message'
        }
      ]
    },

    // 🧪 GAS
    gas_emergency: {
      name: 'rules.templates.gasEmergency.name',
      description: 'rules.templates.gasEmergency.description',
      priority: 'urgent',
      cooldownPeriod: 0, // Không có thời gian chờ cho chế độ khẩn cấp
      conditions: [
        {
          type: 'sensor',
          sensor: 'gas_ppm',
          operator: '>',
          value: 1000,
          unit: 'ppm'
        }
      ],
      actions: [
        {
          type: 'send_alert',
          message: 'rules.templates.gasEmergency.message'
        }
      ]
    },
    
    gas_high: {
      name: 'rules.templates.gasHigh.name',
      description: 'rules.templates.gasHigh.description',
      priority: 'high',
      cooldownPeriod: 60000, // 1 minute
      conditions: [
        {
          type: 'sensor',
          sensor: 'gas_ppm',
          operator: '>=',
          value: 401,
          unit: 'ppm'
        },
        {
          type: 'sensor',
          sensor: 'gas_ppm',
          operator: '<=',
          value: 1000,
          unit: 'ppm'
        }
      ],
      actions: [
        {
          type: 'send_notification',
          message: 'rules.templates.gasHigh.message'
        }
      ]
    },

    // 🚬 SMOKE
    smoke_emergency: {
      name: 'rules.templates.smokeEmergency.name',
      description: 'rules.templates.smokeEmergency.description',
      priority: 'urgent',
      cooldownPeriod: 0, // Không có thời gian chờ cho chế độ khẩn cấp
      conditions: [
        {
          type: 'sensor',
          sensor: 'smoke',
          operator: '>',
          value: 4.5,
          unit: 'V'
        }
      ],
      actions: [
        {
          type: 'send_alert',
          message: 'rules.templates.smokeEmergency.message'
        }
      ]
    },
    
    smoke_high: {
      name: 'rules.templates.smokeHigh.name',
      description: 'rules.templates.smokeHigh.description',
      priority: 'high',
      cooldownPeriod: 60000, // 1 minute
      conditions: [
        {
          type: 'sensor',
          sensor: 'smoke',
          operator: '>=',
          value: 3.5,
          unit: 'V'
        },
        {
          type: 'sensor',
          sensor: 'smoke',
          operator: '<=',
          value: 4.5,
          unit: 'V'
        }
      ],
      actions: [
        {
          type: 'send_notification',
          message: 'rules.templates.smokeHigh.message'
        }
      ]
    },
    
    smoke_medium: {
      name: 'rules.templates.smokeMedium.name',
      description: 'rules.templates.smokeMedium.description',
      priority: 'medium',
      cooldownPeriod: 120000, // 2 minutes
      conditions: [
        {
          type: 'sensor',
          sensor: 'smoke',
          operator: '>=',
          value: 2.5,
          unit: 'V'
        },
        {
          type: 'sensor',
          sensor: 'smoke',
          operator: '<=',
          value: 3.5,
          unit: 'V'
        }
      ],
      actions: [
        {
          type: 'send_notification',
          message: 'rules.templates.smokeMedium.message'
        }
      ]
    },
    
    flame_detected: {
      name: 'rules.templates.flameDetected.name',
      description: 'rules.templates.flameDetected.description',
      priority: 'urgent',
      cooldownPeriod: 0, // Không có thời gian chờ cho chế độ khẩn cấp
      conditions: [
        {
          type: 'sensor',
          sensor: 'flame',
          operator: '==',
          value: 1,
          unit: ''
        }
      ],
      actions: [
        {
          type: 'send_alert',
          message: 'rules.templates.flameDetected.message'
        }
      ]
    }
  }
};

// Helper function to get templates by language
export const getRuleTemplates = (language = 'vi') => {
  return RULE_TEMPLATES[language] || RULE_TEMPLATES.vi;
};

// Helper function to get template by key and language
export const getRuleTemplate = (templateKey, language = 'vi') => {
  const templates = getRuleTemplates(language);
  return templates[templateKey] || null;
};

// Helper function to get all template keys
export const getRuleTemplateKeys = () => {
  return Object.keys(RULE_TEMPLATES.vi);
};

export default RULE_TEMPLATES;
