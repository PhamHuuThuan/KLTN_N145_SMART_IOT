// Rule templates with multi-language support
export const RULE_TEMPLATES = {
  vi: {
    gas_leak_detection: {
      name: 'rules.templates.gasLeakDetection.name',
      description: 'rules.templates.gasLeakDetection.description',
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
          message: 'rules.templates.gasLeakDetection.message'
        }
      ]
    },
    smoke_detection: {
      name: 'rules.templates.smokeDetection.name',
      description: 'rules.templates.smokeDetection.description',
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
          message: 'rules.templates.smokeDetection.message'
        }
      ]
    },
    high_temperature: {
      name: 'rules.templates.highTemperature.name',
      description: 'rules.templates.highTemperature.description',
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
          message: 'rules.templates.highTemperature.message'
        }
      ]
    },
    low_humidity: {
      name: 'rules.templates.lowHumidity.name',
      description: 'rules.templates.lowHumidity.description',
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
          message: 'rules.templates.lowHumidity.message'
        }
      ]
    },
    flame_detection: {
      name: 'rules.templates.flameDetection.name',
      description: 'rules.templates.flameDetection.description',
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
          message: 'rules.templates.flameDetection.message'
        }
      ]
    },
  },
  en: {
    gas_leak_detection: {
      name: 'rules.templates.gasLeakDetection.name',
      description: 'rules.templates.gasLeakDetection.description',
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
          message: 'rules.templates.gasLeakDetection.message'
        }
      ]
    },
    smoke_detection: {
      name: 'rules.templates.smokeDetection.name',
      description: 'rules.templates.smokeDetection.description',
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
          message: 'rules.templates.smokeDetection.message'
        }
      ]
    },
    high_temperature: {
      name: 'rules.templates.highTemperature.name',
      description: 'rules.templates.highTemperature.description',
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
          message: 'rules.templates.highTemperature.message'
        }
      ]
    },
    low_humidity: {
      name: 'rules.templates.lowHumidity.name',
      description: 'rules.templates.lowHumidity.description',
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
          message: 'rules.templates.lowHumidity.message'
        }
      ]
    },
    flame_detection: {
      name: 'rules.templates.flameDetection.name',
      description: 'rules.templates.flameDetection.description',
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
          message: 'rules.templates.flameDetection.message'
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
