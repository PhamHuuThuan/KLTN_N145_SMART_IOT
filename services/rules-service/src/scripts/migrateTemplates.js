import mongoose from 'mongoose';
import dotenv from 'dotenv';
import RuleTemplate from '../models/RuleTemplate.js';
import connectDB from '../config/database.js';

// Ensure mongoose connection is available
const getConnection = () => {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }
  throw new Error('MongoDB connection not ready');
};

dotenv.config();

// Templates với text thực tế từ translation files
const HARDCODED_TEMPLATES = {
  vi: {
    temp_emergency: {
      name: '🚨 Nhiệt độ khẩn cấp',
      description: 'Cảnh báo khẩn cấp khi nhiệt độ > 40°C',
      priority: 'urgent',
      cooldownPeriod: 30000,
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
          message: '🚨 CẢNH BÁO KHẨN CẤP: Nhiệt độ cực cao! Nguy cơ cháy nổ!'
        }
      ]
    },
    temp_high: {
      name: '🌡️ Nhiệt độ cao',
      description: 'Cảnh báo khi nhiệt độ 31–40°C',
      priority: 'high',
      cooldownPeriod: 300000,
      conditions: [
        {
          type: 'sensor',
          sensor: 'temperature',
          operator: '>',
          value: 31,
          unit: '°C'
        }
      ],
      actions: [
        {
          type: 'send_notification',
          message: '🌡️ Cảnh báo: Nhiệt độ cao! Kiểm tra hệ thống làm mát hoặc thông gió.'
        }
      ]
    },
    temp_low: {
      name: '❄️ Nhiệt độ thấp',
      description: 'Cảnh báo khi nhiệt độ < 15°C',
      priority: 'low',
      cooldownPeriod: 900000,
      conditions: [
        {
          type: 'sensor',
          sensor: 'temperature',
          operator: '<',
          value: 15,
          unit: '°C'
        }
      ],
      actions: [
        {
          type: 'send_notification',
          message: '❄️ Cảnh báo: Nhiệt độ thấp! Kiểm tra hệ thống sưởi hoặc môi trường lưu trữ.'
        }
      ]
    },
    humidity_emergency: {
      name: '🚨 Độ ẩm khẩn cấp',
      description: 'Cảnh báo khẩn cấp khi độ ẩm > 80%',
      priority: 'urgent',
      cooldownPeriod: 30000,
      conditions: [
        {
          type: 'sensor',
          sensor: 'humidity',
          operator: '>',
          value: 80,
          unit: '%'
        }
      ],
      actions: [
        {
          type: 'send_alert',
          message: '🚨 CẢNH BÁO KHẨN CẤP: Độ ẩm quá cao! Nguy cơ chập điện hoặc hư hại thiết bị!'
        }
      ]
    },
    humidity_high: {
      name: '💧 Độ ẩm cao',
      description: 'Cảnh báo khi độ ẩm 61–80%',
      priority: 'high',
      cooldownPeriod: 300000,
      conditions: [
        {
          type: 'sensor',
          sensor: 'humidity',
          operator: '>',
          value: 61,
          unit: '%'
        }
      ],
      actions: [
        {
          type: 'send_notification',
          message: '💧 Cảnh báo: Độ ẩm cao! Có thể gây nấm mốc, ảnh hưởng linh kiện.'
        }
      ]
    },
    humidity_low: {
      name: '💧 Độ ẩm thấp',
      description: 'Cảnh báo khi độ ẩm < 30%',
      priority: 'low',
      cooldownPeriod: 900000,
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
          message: '💧 Cảnh báo: Độ ẩm thấp! Không khí khô, dễ gây tĩnh điện.'
        }
      ]
    },
    gas_emergency: {
      name: '🚨 Khí gas khẩn cấp',
      description: 'Cảnh báo khẩn cấp khi khí gas > 1000 ppm',
      priority: 'urgent',
      cooldownPeriod: 30000,
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
          message: '🚨 CẢNH BÁO KHẨN CẤP: Khí gas ở mức nguy hiểm! Nguy cơ ngộ độc hoặc cháy nổ!'
        }
      ]
    },
    gas_high: {
      name: '💨 Khí gas cao',
      description: 'Cảnh báo khi khí gas 401–1000 ppm',
      priority: 'high',
      cooldownPeriod: 300000,
      conditions: [
        {
          type: 'sensor',
          sensor: 'gas_ppm',
          operator: '>',
          value: 401,
          unit: 'ppm'
        }
      ],
      actions: [
        {
          type: 'send_notification',
          message: '💨 Cảnh báo: Nồng độ khí gas cao! Kiểm tra nguồn rò rỉ ngay.'
        }
      ]
    },
    gas_medium: {
      name: '💨 Khí gas trung bình',
      description: 'Cảnh báo khi khí gas 200–400 ppm',
      priority: 'medium',
      cooldownPeriod: 600000,
      conditions: [
        {
          type: 'sensor',
          sensor: 'gas_ppm',
          operator: '>',
          value: 200,
          unit: 'ppm'
        }
      ],
      actions: [
        {
          type: 'send_notification',
          message: '💨 Cảnh báo: Phát hiện khí gas nhẹ. Theo dõi và kiểm tra định kỳ.'
        }
      ]
    },
    smoke_emergency: {
      name: '🚨 Khói khẩn cấp',
      description: 'Cảnh báo khẩn cấp khi khói > 700 ppm',
      priority: 'urgent',
      cooldownPeriod: 30000,
      conditions: [
        {
          type: 'sensor',
          sensor: 'smoke',
          operator: '>',
          value: 700,
          unit: 'ppm'
        }
      ],
      actions: [
        {
          type: 'send_alert',
          message: '🚨 CẢNH BÁO KHẨN CẤP: Nồng độ khói đậm! Nguy cơ cháy hoặc khí CO cao!'
        }
      ]
    },
    smoke_high: {
      name: '🔥 Khói cao',
      description: 'Cảnh báo khi khói 301–700 ppm',
      priority: 'high',
      cooldownPeriod: 300000,
      conditions: [
        {
          type: 'sensor',
          sensor: 'smoke',
          operator: '>',
          value: 301,
          unit: 'ppm'
        }
      ],
      actions: [
        {
          type: 'send_notification',
          message: '🔥 Cảnh báo: Phát hiện khói đậm! Kiểm tra ngay để phòng cháy.'
        }
      ]
    },
    smoke_medium: {
      name: '💨 Khói trung bình',
      description: 'Cảnh báo khi khói 100–300 ppm',
      priority: 'medium',
      cooldownPeriod: 600000,
      conditions: [
        {
          type: 'sensor',
          sensor: 'smoke',
          operator: '>',
          value: 100,
          unit: 'ppm'
        }
      ],
      actions: [
        {
          type: 'send_notification',
          message: '💨 Cảnh báo: Phát hiện khói nhẹ. Có thể do bụi hoặc hơi nóng.'
        }
      ]
    },
    flame_detected: {
      name: '🔥 Phát hiện lửa',
      description: 'Cảnh báo khẩn cấp khi cảm biến lửa kích hoạt',
      priority: 'urgent',
      cooldownPeriod: 30000,
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
          message: '🔥 CẢNH BÁO KHẨN CẤP: Phát hiện ngọn lửa! Dừng thiết bị và xử lý ngay lập tức!'
        }
      ]
    }
  },
  en: {
    temp_emergency: {
      name: '🚨 Temperature Emergency',
      description: 'Emergency alert when temperature > 40°C',
      priority: 'urgent',
      cooldownPeriod: 30000,
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
          message: '🚨 EMERGENCY ALERT: Extremely high temperature! Risk of fire or explosion!'
        }
      ]
    },
    temp_high: {
      name: '🌡️ High Temperature',
      description: 'Alert when temperature is between 31–40°C',
      priority: 'high',
      cooldownPeriod: 300000,
      conditions: [
        {
          type: 'sensor',
          sensor: 'temperature',
          operator: '>',
          value: 31,
          unit: '°C'
        }
      ],
      actions: [
        {
          type: 'send_notification',
          message: '🌡️ Warning: High temperature detected! Check cooling or ventilation systems.'
        }
      ]
    },
    temp_low: {
      name: '❄️ Low Temperature',
      description: 'Alert when temperature < 15°C',
      priority: 'low',
      cooldownPeriod: 900000,
      conditions: [
        {
          type: 'sensor',
          sensor: 'temperature',
          operator: '<',
          value: 15,
          unit: '°C'
        }
      ],
      actions: [
        {
          type: 'send_notification',
          message: '❄️ Notice: Low temperature detected! Check heating or storage conditions.'
        }
      ]
    },
    humidity_emergency: {
      name: '🚨 Humidity Emergency',
      description: 'Emergency alert when humidity > 80%',
      priority: 'urgent',
      cooldownPeriod: 30000,
      conditions: [
        {
          type: 'sensor',
          sensor: 'humidity',
          operator: '>',
          value: 80,
          unit: '%'
        }
      ],
      actions: [
        {
          type: 'send_alert',
          message: '🚨 EMERGENCY ALERT: Excessive humidity! Risk of short circuit or equipment damage!'
        }
      ]
    },
    humidity_high: {
      name: '💧 High Humidity',
      description: 'Alert when humidity is between 61–80%',
      priority: 'high',
      cooldownPeriod: 300000,
      conditions: [
        {
          type: 'sensor',
          sensor: 'humidity',
          operator: '>',
          value: 61,
          unit: '%'
        }
      ],
      actions: [
        {
          type: 'send_notification',
          message: '💧 Warning: High humidity level! May cause mold or component corrosion.'
        }
      ]
    },
    humidity_low: {
      name: '💧 Low Humidity',
      description: 'Alert when humidity < 30%',
      priority: 'low',
      cooldownPeriod: 900000,
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
          message: '💧 Notice: Low humidity! Dry air may cause static electricity.'
        }
      ]
    },
    gas_emergency: {
      name: '🚨 Gas Emergency',
      description: 'Emergency alert when gas concentration > 1000 ppm',
      priority: 'urgent',
      cooldownPeriod: 30000,
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
          message: '🚨 EMERGENCY ALERT: Dangerous gas concentration! Risk of poisoning or explosion!'
        }
      ]
    },
    gas_high: {
      name: '💨 High Gas Level',
      description: 'Alert when gas concentration is between 401–1000 ppm',
      priority: 'high',
      cooldownPeriod: 300000,
      conditions: [
        {
          type: 'sensor',
          sensor: 'gas_ppm',
          operator: '>',
          value: 401,
          unit: 'ppm'
        }
      ],
      actions: [
        {
          type: 'send_notification',
          message: '💨 Warning: High gas concentration detected! Check for leaks immediately.'
        }
      ]
    },
    gas_medium: {
      name: '💨 Medium Gas Level',
      description: 'Alert when gas concentration is between 200–400 ppm',
      priority: 'medium',
      cooldownPeriod: 600000,
      conditions: [
        {
          type: 'sensor',
          sensor: 'gas_ppm',
          operator: '>',
          value: 200,
          unit: 'ppm'
        }
      ],
      actions: [
        {
          type: 'send_notification',
          message: '💨 Notice: Mild gas detected. Monitor and inspect regularly.'
        }
      ]
    },
    smoke_emergency: {
      name: '🚨 Smoke Emergency',
      description: 'Emergency alert when smoke concentration > 700 ppm',
      priority: 'urgent',
      cooldownPeriod: 30000,
      conditions: [
        {
          type: 'sensor',
          sensor: 'smoke',
          operator: '>',
          value: 700,
          unit: 'ppm'
        }
      ],
      actions: [
        {
          type: 'send_alert',
          message: '🚨 EMERGENCY ALERT: Dense smoke detected! High risk of fire or CO exposure!'
        }
      ]
    },
    smoke_high: {
      name: '🔥 High Smoke Level',
      description: 'Alert when smoke concentration is between 301–700 ppm',
      priority: 'high',
      cooldownPeriod: 300000,
      conditions: [
        {
          type: 'sensor',
          sensor: 'smoke',
          operator: '>',
          value: 301,
          unit: 'ppm'
        }
      ],
      actions: [
        {
          type: 'send_notification',
          message: '🔥 Warning: Heavy smoke detected! Possible fire, check immediately.'
        }
      ]
    },
    smoke_medium: {
      name: '💨 Medium Smoke Level',
      description: 'Alert when smoke concentration is between 100–300 ppm',
      priority: 'medium',
      cooldownPeriod: 600000,
      conditions: [
        {
          type: 'sensor',
          sensor: 'smoke',
          operator: '>',
          value: 100,
          unit: 'ppm'
        }
      ],
      actions: [
        {
          type: 'send_notification',
          message: '💨 Notice: Light smoke detected. Could be dust or mild vapor.'
        }
      ]
    },
    flame_detected: {
      name: '🔥 Flame Detected',
      description: 'Emergency alert when flame sensor is triggered',
      priority: 'urgent',
      cooldownPeriod: 30000,
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
          message: '🔥 EMERGENCY ALERT: Flame detected! Shut down nearby equipment and act immediately!'
        }
      ]
    }
  }
};

async function migrateTemplates() {
  try {
    await connectDB();
    console.log('Connected to MongoDB');
    console.log('Starting template migration...\n');

    // Drop old unique index on templateKey only if it exists
    try {
      const connection = getConnection();
      const collection = connection.collection('ruletemplates');
      const indexes = await collection.indexes();
      const oldIndex = indexes.find(idx => 
        idx.name === 'templateKey_1' && 
        Object.keys(idx.key).length === 1 && 
        idx.key.templateKey === 1 &&
        idx.unique === true
      );
      
      if (oldIndex) {
        console.log('Dropping old unique index on templateKey...');
        await collection.dropIndex('templateKey_1');
        console.log('✓ Old index dropped successfully\n');
      } else {
        console.log('✓ No old index found, using compound index\n');
      }
    } catch (error) {
      if (error.code !== 27) { // Index not found
        console.warn('Warning: Could not drop old index:', error.message);
      }
    }

    // Ensure compound unique index exists
    try {
      await RuleTemplate.collection.createIndex(
        { templateKey: 1, language: 1 }, 
        { unique: true, name: 'templateKey_1_language_1' }
      );
      console.log('✓ Compound unique index (templateKey + language) ensured\n');
    } catch (error) {
      if (error.code !== 85) { // Index already exists
        console.warn('Warning: Could not create compound index:', error.message);
      }
    }

    let totalCreated = 0;
    let totalUpdated = 0;
    let totalErrors = 0;
    const statsByLanguage = {};

    for (const [language, templates] of Object.entries(HARDCODED_TEMPLATES)) {
      console.log(`\n=== Processing ${language.toUpperCase()} templates ===`);
      const languageStats = {
        created: 0,
        updated: 0,
        errors: 0,
        templates: []
      };

      for (const [templateKey, templateData] of Object.entries(templates)) {
        try {
          // Check if template already exists
          const existing = await RuleTemplate.findOne({ templateKey, language });
          if (existing) {
            // Update existing template with new text
            existing.name = templateData.name;
            existing.description = templateData.description;
            existing.priority = templateData.priority;
            existing.cooldownPeriod = templateData.cooldownPeriod;
            existing.conditions = templateData.conditions;
            existing.actions = templateData.actions;
            existing.isActive = true;
            existing.updatedBy = 'system';
            await existing.save();
            console.log(`  ✓ Updated: ${templateKey}`);
            languageStats.updated++;
            totalUpdated++;
            languageStats.templates.push({ key: templateKey, status: 'updated' });
            continue;
          }

          // Create new template
          const template = new RuleTemplate({
            templateKey,
            name: templateData.name,
            description: templateData.description,
            priority: templateData.priority,
            cooldownPeriod: templateData.cooldownPeriod,
            conditions: templateData.conditions,
            actions: templateData.actions,
            language,
            isActive: true,
            createdBy: 'system'
          });

          await template.save();
          console.log(`  + Created: ${templateKey}`);
          languageStats.created++;
          totalCreated++;
          languageStats.templates.push({ key: templateKey, status: 'created' });
        } catch (error) {
          console.error(`  ✗ Error: ${templateKey} - ${error.message}`);
          languageStats.errors++;
          totalErrors++;
          languageStats.templates.push({ key: templateKey, status: 'error', error: error.message });
        }
      }

      statsByLanguage[language] = languageStats;
      console.log(`\n${language.toUpperCase()} Summary: ${languageStats.created} created, ${languageStats.updated} updated, ${languageStats.errors} errors`);
    }

    console.log('\n' + '='.repeat(50));
    console.log('MIGRATION COMPLETED');
    console.log('='.repeat(50));
    console.log(`Total Created: ${totalCreated}`);
    console.log(`Total Updated: ${totalUpdated}`);
    console.log(`Total Errors: ${totalErrors}`);
    console.log(`\nBy Language:`);
    
    for (const [lang, stats] of Object.entries(statsByLanguage)) {
      console.log(`  ${lang.toUpperCase()}: ${stats.created} created, ${stats.updated} updated, ${stats.errors} errors`);
    }

    // Verify all templates exist
    console.log('\n' + '='.repeat(50));
    console.log('VERIFICATION');
    console.log('='.repeat(50));
    
    for (const [language, templates] of Object.entries(HARDCODED_TEMPLATES)) {
      const expectedCount = Object.keys(templates).length;
      const actualCount = await RuleTemplate.countDocuments({ language, isActive: true });
      const missing = expectedCount - actualCount;
      
      if (missing === 0) {
        console.log(`✓ ${language.toUpperCase()}: All ${expectedCount} templates exist`);
      } else {
        console.log(`✗ ${language.toUpperCase()}: Missing ${missing} templates (Expected: ${expectedCount}, Found: ${actualCount})`);
        
        // List missing templates
        const existingKeys = (await RuleTemplate.find({ language, isActive: true }).select('templateKey -_id'))
          .map(t => t.templateKey);
        const expectedKeys = Object.keys(templates);
        const missingKeys = expectedKeys.filter(key => !existingKeys.includes(key));
        
        if (missingKeys.length > 0) {
          console.log(`  Missing templates: ${missingKeys.join(', ')}`);
        }
      }
    }

    process.exit(0);
  } catch (error) {
    console.error('Migration error:', error);
    process.exit(1);
  }
}

migrateTemplates();
