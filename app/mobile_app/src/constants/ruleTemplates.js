// Rule templates with multi-language support
export const RULE_TEMPLATES = {
  vi: {
    gas_leak_detection: {
      name: 'Phát hiện rò rỉ khí gas',
      description: 'Phản ứng khẩn cấp khi phát hiện rò rỉ khí gas',
      priority: 'urgent',
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
          message: '🚨 Cảnh báo: Phát hiện nồng độ khí gas cao! Vui lòng tắt nguồn gas ngay lập tức và thông gió khu vực!'
        }
      ]
    },
    smoke_detection: {
      name: 'Phát hiện khói',
      description: 'Phản ứng khẩn cấp khi phát hiện khói',
      priority: 'high',
      cooldownPeriod: 300000,
      maxTriggersPerDay: 20,
      conditions: [
        {
          type: 'sensor',
          sensor: 'smoke',
          operator: '==',
          value: 1,
          unit: ''
        }
      ],
      actions: [
        {
          type: 'send_alert',
          message: '🔥 Cảnh báo: Phát hiện khói! Kiểm tra ngay lập tức và liên hệ cứu hỏa nếu cần!'
        }
      ]
    },
    high_temperature: {
      name: 'Nhiệt độ cao',
      description: 'Cảnh báo khi nhiệt độ vượt ngưỡng an toàn',
      priority: 'medium',
      cooldownPeriod: 600000,
      maxTriggersPerDay: 10,
      conditionLogic: 'AND',
      conditions: [
        {
          type: 'sensor',
          sensor: 'temperature',
          operator: '>',
          value: 35,
          unit: '°C'
        }
      ],
      actions: [
        {
          type: 'send_alert',
          message: '🌡️ Cảnh báo: Nhiệt độ cao! Kiểm tra nguồn nhiệt và bật quạt/điều hòa.'
        }
      ]
    },
    low_humidity: {
      name: 'Độ ẩm thấp',
      description: 'Cảnh báo khi độ ẩm quá thấp',
      priority: 'low',
      cooldownPeriod: 1800000,
      maxTriggersPerDay: 5,
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
          type: 'send_alert',
          message: '💧 Cảnh báo: Độ ẩm thấp! Cân nhắc sử dụng máy tạo ẩm.'
        }
      ]
    },
    flame_detection: {
      name: 'Phát hiện lửa',
      description: 'Cảnh báo khẩn cấp khi phát hiện lửa',
      priority: 'urgent',
      conditions: [
        {
          type: 'sensor',
          sensor: 'smoke',
          operator: '==',
          value: 1,
          unit: ''
        }
      ],
      actions: [
        {
          type: 'send_alert',
          message: '🔥 CẢNH BÁO KHẨN CẤP: Phát hiện lửa! Liên hệ cứu hỏa ngay lập tức!'
        }
      ]
    },
  },
  en: {
    gas_leak_detection: {
      name: 'Gas Leak Detection',
      description: 'Emergency response for gas leak',
      priority: 'urgent',
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
          message: '🚨 Warning: High gas concentration detected! Please turn off the gas supply immediately and ventilate the area!'
        }
      ]
    },
    smoke_detection: {
      name: 'Smoke Detection',
      description: 'Emergency response for smoke detection',
      priority: 'high',
      cooldownPeriod: 300000,
      maxTriggersPerDay: 20,
      conditions: [
        {
          type: 'sensor',
          sensor: 'smoke',
          operator: '==',
          value: 1,
          unit: ''
        }
      ],
      actions: [
        {
          type: 'send_alert',
          message: '🔥 Warning: Smoke detected! Check immediately and contact fire department if needed!'
        }
      ]
    },
    high_temperature: {
      name: 'High Temperature',
      description: 'Alert when temperature exceeds safe threshold',
      priority: 'medium',
      cooldownPeriod: 600000,
      maxTriggersPerDay: 10,
      conditions: [
        {
          type: 'sensor',
          sensor: 'temperature',
          operator: '>',
          value: 35,
          unit: '°C'
        }
      ],
      actions: [
        {
          type: 'send_alert',
          message: '🌡️ Warning: High temperature! Check heat sources and turn on fans/AC.'
        }
      ]
    },
    low_humidity: {
      name: 'Low Humidity',
      description: 'Alert when humidity is too low',
      priority: 'low',
      cooldownPeriod: 1800000,
      maxTriggersPerDay: 5,
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
          type: 'send_alert',
          message: '💧 Warning: Low humidity! Consider using a humidifier.'
        }
      ]
    },
    flame_detection: {
      name: 'Flame Detection',
      description: 'Emergency alert when flame is detected',
      priority: 'urgent',
      conditions: [
        {
          type: 'sensor',
          sensor: 'smoke',
          operator: '==',
          value: 1,
          unit: ''
        }
      ],
      actions: [
        {
          type: 'send_alert',
          message: '🔥 EMERGENCY ALERT: Flame detected! Contact fire department immediately!'
        }
      ]
    },
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
