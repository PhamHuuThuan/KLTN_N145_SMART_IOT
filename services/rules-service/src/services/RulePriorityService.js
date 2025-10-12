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
   * Thực thi một rule cụ thể (chỉ log, không execute vì đã execute rồi)
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
   * Tạo thông báo hợp nhất để gửi qua alerts-service
   */
  buildConsolidatedNotification(incident, userId) {
    const { severity, summary, rules } = incident;
    
    let title, message;
    
    if (severity === 'critical') {
      title = '🚨 EMERGENCY ALERT';
      message = `Multiple critical hazards detected: ${summary}`;
    } else if (severity === 'high') {
      title = '⚠️ SAFETY ALERT';
      message = `Safety concerns detected: ${summary}`;
    } else {
      title = 'ℹ️ SYSTEM ALERT';
      message = `Multiple alerts: ${summary}`;
    }
    
    return {
      userId,
      title,
      message,
      priority: severity,
      type: 'consolidated_alert',
      metadata: {
        incidentId: incident.id,
        totalRules: rules.length,
        severity,
        deviceId: incident.deviceId,
        rules: rules.map(r => ({ id: r.id, name: r.name, priority: r.priority }))
      }
    };
  }
}

export default RulePriorityService;
