class RulePriorityService {
  constructor() {
    this.priorityOrder = ['urgent', 'high', 'medium', 'low'];
  }

  /**
   * Xử lý nhiều rules cùng trigger
   */
  async handleMultipleTriggers(triggeredRules, sensorData) {
    console.log(`🔄 Handling ${triggeredRules.length} triggered rules`);
    
    // 1. Sắp xếp theo priority
    const sortedRules = this.sortByPriority(triggeredRules);
    
    // 2. Tạo incident report
    const incident = this.createIncidentReport(sortedRules, sensorData);
    
    // 3. Thực thi theo priority
    const executionResult = await this.executeWithPriority(sortedRules, sensorData);
    
    return {
      incident,
      executionResult,
      totalRules: triggeredRules.length,
      executedRules: executionResult.executed.length,
      skippedRules: executionResult.skipped.length
    };
  }

  /**
   * Sắp xếp rules theo priority
   */
  sortByPriority(rules) {
    return rules.sort((a, b) => {
      const priorityA = this.priorityOrder.indexOf(a.priority);
      const priorityB = this.priorityOrder.indexOf(b.priority);
      
      if (priorityA !== priorityB) {
        return priorityA - priorityB; // urgent (0) trước, low (3) sau
      }
      
      // Nếu cùng priority, sắp xếp theo thời gian tạo
      return new Date(a.createdAt) - new Date(b.createdAt);
    });
  }

  /**
   * Tạo incident report
   */
  createIncidentReport(rules, sensorData) {
    const incident = {
      id: `incident_${Date.now()}`,
      timestamp: new Date(),
      deviceId: sensorData.deviceId,
      severity: this.getIncidentSeverity(rules),
      rules: rules.map(r => ({
        id: r._id,
        name: r.name,
        priority: r.priority,
        category: r.category
      })),
      summary: this.buildIncidentSummary(rules)
    };

    return incident;
  }

  /**
   * Xác định severity của incident
   */
  getIncidentSeverity(rules) {
    if (rules.some(r => r.priority === 'urgent')) return 'critical';
    if (rules.some(r => r.priority === 'high')) return 'high';
    if (rules.some(r => r.priority === 'medium')) return 'medium';
    return 'low';
  }

  /**
   * Xây dựng summary cho incident
   */
  buildIncidentSummary(rules) {
    const urgentRules = rules.filter(r => r.priority === 'urgent');
    const highRules = rules.filter(r => r.priority === 'high');
    const normalRules = rules.filter(r => ['medium', 'low'].includes(r.priority));
    
    const summaries = [];
    
    if (urgentRules.length > 0) {
      summaries.push(`🚨 CRITICAL: ${urgentRules.map(r => r.name).join(', ')}`);
    }
    
    if (highRules.length > 0) {
      summaries.push(`⚠️ Safety: ${highRules.map(r => r.name).join(', ')}`);
    }
    
    if (normalRules.length > 0) {
      summaries.push(`ℹ️ Normal: ${normalRules.map(r => r.name).join(', ')}`);
    }
    
    return summaries.join(' | ');
  }

  /**
   * Thực thi rules theo priority
   */
  async executeWithPriority(rules, sensorData) {
    const result = {
      executed: [],
      skipped: [],
      errors: []
    };

    let hasUrgent = false;

    for (const rule of rules) {
      try {
        // Nếu có urgent rule, bỏ qua medium/low priority
        if (hasUrgent && ['medium', 'low'].includes(rule.priority)) {
          result.skipped.push(rule);
          continue;
        }

        if (rule.priority === 'urgent') {
          hasUrgent = true;
        }

        await this.executeRule(rule, sensorData);
        result.executed.push(rule);
        
      } catch (error) {
        result.errors.push({ rule, error });
      }
    }

    return result;
  }

  /**
   * Thực thi một rule cụ thể
   */
  async executeRule(rule, sensorData) {
    console.log(`🎯 Rule already executed: ${rule.name} (${rule.priority})`);
    
    return {
      ruleId: rule._id,
      ruleName: rule.name,
      executed: true,
      timestamp: new Date()
    };
  }

    /**
   * Nhóm rules theo priority level
   */
    groupRulesByPriority(rules) {
      const groups = {
        urgent: [],
        high: [],
        medium: [],
        low: []
      };
      
      rules.forEach(rule => {
        if (groups[rule.priority]) {
          groups[rule.priority].push(rule);
        }
      });
      
      // Chỉ trả về các nhóm có rules
      return Object.fromEntries(
        Object.entries(groups).filter(([priority, rules]) => rules.length > 0)
      );
    }

  /**
   * Tạo thông báo hợp nhất chi tiết với thông tin từng rule
   */
  buildDetailedConsolidatedNotification(incident, userId, sensorData) {
    const { severity, rules, deviceId } = incident;
    
    let title, message;
    
    if (severity === 'critical') {
      title = '🚨 EMERGENCY ALERT';
    } else if (severity === 'high') {
      title = '⚠️ SAFETY ALERT';
    } else {
      title = '📊 MULTIPLE ALERTS';
    }
    
    // Tạo message chi tiết cho từng rule
    const detailedMessages = rules.map(rule => {
      const condition = rule.conditions[0];
      const sensorType = condition.sensor;
      const threshold = condition.value;
      const operator = condition.operator;
      
      // Lấy giá trị sensor hiện tại
      let sensorValue;
      switch (sensorType) {
        case 'temperature':
          sensorValue = sensorData.temp;
          break;
        case 'humidity':
          sensorValue = sensorData.humid;
          break;
        case 'gas_ppm':
          sensorValue = sensorData.gas_ppm;
          break;
        case 'smoke':
          sensorValue = sensorData.smoke;
          break;
        default:
          sensorValue = 'N/A';
      }
      
      // Tạo message cho từng rule
      switch (sensorType) {
        case 'temperature':
          return `🌡️ ${rule.name}: Current ${sensorValue}°C (Threshold: ${threshold}°C)`;
        case 'humidity':
          return `💧 ${rule.name}: Current ${sensorValue}% (Threshold: ${threshold}%)`;
        case 'gas_ppm':
          return `🚨 ${rule.name}: Current ${sensorValue} ppm (Threshold: ${threshold} ppm)`;
        case 'smoke':
          return `⚠️ ${rule.name}: Level ${sensorValue} (Threshold: ${threshold})`;
        default:
          return `📊 ${rule.name}: ${sensorType} ${operator} ${threshold}`;
      }
    });
    
    message = detailedMessages.join('\n\n');
    
    // Map severity to priority
    const priorityMap = {
      'critical': 'urgent',
      'high': 'high', 
      'medium': 'medium',
      'low': 'low'
    };

    return {
      userId,
      title,
      message,
      priority: priorityMap[severity] || 'medium',
      type: 'consolidated_alert',
      category: severity === 'critical' ? 'security' : 'rule',
      metadata: {
        incidentId: incident.id,
        totalRules: rules.length,
        severity,
        deviceId: deviceId,
        rules: rules.map(r => ({ id: r.id, name: r.name, priority: r.priority }))
      }
    };
  }
}

export default RulePriorityService;
