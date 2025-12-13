import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

const useVoiceControl = () => {
  const { t } = useTranslation();
  const [isListening, setIsListening] = useState(false);
  const [lastCommand, setLastCommand] = useState('');

const voiceCommands = {
    'bật': 'on', 'mở': 'on', 'khởi động': 'on', 'start': 'on', 'turn on': 'on',
    'tắt': 'off', 'đóng': 'off', 'dừng': 'off', 'stop': 'off', 'turn off': 'off',
    'ổ cắm': 'outlet', 'thiết bị': 'device',
    'một': '1', 'hai': '2', 'ba': '3', 'bốn': '4', 'năm': '5',
    'sáu': '6', 'bảy': '7', 'tám': '8', 'chín': '9', 'mười': '10',
    '1': '1', '2': '2', '3': '3', '4': '4', '5': '5',
    'bếp': 'stove', 'bếp điện': 'stove', 'stove': 'stove',
    'từ': 'induction', 'bếp từ': 'induction', 'induction': 'induction',
    'hút': 'hood', 'mùi': 'hood', 'hút mùi': 'hood', 'thông gió': 'hood', 'hood': 'hood',
    'cơm': 'rice_cooker', 'nồi cơm': 'rice_cooker', 'rice': 'rice_cooker',
    'chiên': 'air_fryer', 'không dầu': 'air_fryer', 'nồi chiên': 'air_fryer', 'air fryer': 'air_fryer',
    'lò': 'oven', 'nướng': 'oven', 'lò nướng': 'oven', 'oven': 'oven',
    'vi': 'microwave', 'sóng': 'microwave', 'lò vi sóng': 'microwave', 'microwave': 'microwave',
    'ấm': 'kettle', 'siêu tốc': 'kettle', 'kettle': 'kettle',
    'cà phê': 'coffee', 'máy cà phê': 'coffee', 'coffee': 'coffee',
    'xay': 'blender', 'sinh tố': 'blender', 'máy xay': 'blender', 'blender': 'blender',
    'rửa': 'dishwasher', 'bát': 'dishwasher', 'máy rửa bát': 'dishwasher', 'dishwasher': 'dishwasher',
    'tủ': 'refrigerator', 'lạnh': 'refrigerator', 'tủ lạnh': 'refrigerator', 'fridge': 'refrigerator',
    'bơm': 'pump', 'máy bơm': 'pump', 'pump': 'pump',
    'quạt': 'fan', 'fan': 'fan',
    'đèn': 'light', 'light': 'light',
    'tivi': 'tv', 'tv': 'tv',
    'điều hòa': 'ac', 'ac': 'ac',
    'giặt': 'washing', 'máy giặt': 'washing', 'washing': 'washing',
    'nóng': 'heater', 'bình nóng lạnh': 'heater', 'heater': 'heater',
    'rèm': 'curtain', 'cửa': 'curtain', 'rèm cửa': 'curtain', 'curtain': 'curtain',
    'của': '', 'the': '', 'cái': '', 'chiếc': '', 'với': '', 'số': '', 'máy': ''
  };

  const parseVoiceCommand = useCallback((transcript) => {
    if (!transcript) return null;
    
    const lowerTranscript = transcript.toLowerCase();
    let action = null;
    let target = null;
    let number = null;
    let location = null;
    let outletName = null;
    
    const actionPhrases = ['turn on', 'turn off'];
    for (const phrase of actionPhrases) {
      if (lowerTranscript.includes(phrase)) {
        action = phrase === 'turn on' ? 'on' : 'off';
        break;
      }
    }
    
    if (!action) {
      const words = lowerTranscript.split(/\s+/);
      for (const word of words) {
        if (voiceCommands[word] === 'on' || voiceCommands[word] === 'off') {
          action = voiceCommands[word];
          break;
        }
      }
    }
    
    const words = lowerTranscript.split(/\s+/);
    for (const word of words) {
      if (voiceCommands[word] === 'outlet' || voiceCommands[word] === 'device') {
        target = voiceCommands[word];
        break;
      }
    }
    
    const devicePhrases = [
      'lò vi sóng', 'nồi cơm', 'nồi chiên', 'máy rửa bát', 'máy cà phê', 'máy xay',
      'bếp từ', 'bếp điện', 'hút mùi', 'thông gió', 'máy bơm', 'bình nóng lạnh',
      'tủ lạnh', 'máy giặt', 'điều hòa', 'lò nướng', 'rèm cửa'
    ];
    for (const phrase of devicePhrases) {
      if (lowerTranscript.includes(phrase)) {
        location = voiceCommands[phrase];
        break;
      }
    }
    
    if (!location) {
      for (const word of words) {
        if (voiceCommands[word] === 'fan' || voiceCommands[word] === 'light' || 
            voiceCommands[word] === 'machine' || voiceCommands[word] === 'tv' ||
            voiceCommands[word] === 'ac' || voiceCommands[word] === 'refrigerator' ||
            voiceCommands[word] === 'microwave' || voiceCommands[word] === 'washing' ||
            voiceCommands[word] === 'heater') {
          location = voiceCommands[word];
          break;
        }
      }
    }
    
    for (const word of words) {
      if (voiceCommands[word] && !isNaN(voiceCommands[word])) {
        number = voiceCommands[word];
        break;
      }
    }
    
    if (location && number) {
      outletName = `${location}_${number}`;
    } else if (location) {
      outletName = location;
    } else if (number) {
      outletName = `o${number}`;
    }
    
    if (!target) {
      target = 'outlet';
    }
  
    
    return { 
      action, 
      target, 
      number, 
      location,
      outletName,
      originalText: transcript 
    };
  }, []);

  const executeVoiceCommand = useCallback(async (command, onOutletControl) => {
    if (!command || !command.action || !onOutletControl) {
      return { success: false, message: t('voice.commandNotUnderstood') };
    }
    
    try {
      if (command.target === 'outlet') {
        if (command.outletName) {
          const result = await onOutletControl(command.action, command.outletName);
          const displayName = command.location && command.number 
            ? `${command.location} ${command.number}` 
            : command.outletName;
          
          return {
            success: result.success || result,
            message: result.success || result
              ? t('voice.outletCommandSuccess', { 
                  action: command.action === 'on' ? t('common.on') : t('common.off'),
                  outlet: result.outlet?.name || displayName
                })
              : t('voice.commandFailed'),
            outlet: result.outlet || null
          };
        } else if (command.number) {
          const outletId = `o${command.number}`;
          const result = await onOutletControl(command.action, outletId);
          return {
            success: result.success || result,
            message: result.success || result
              ? t('voice.outletCommandSuccess', { 
                  action: command.action === 'on' ? t('common.on') : t('common.off'),
                  outlet: `ổ cắm ${command.number}`
                })
              : t('voice.commandFailed'),
            outlet: result.outlet || null
          };
        } else {
          const result = await onOutletControl(command.action, 'all');
          return {
            success: result.success || result,
            message: result.success || result
              ? t('voice.allOutletsCommandSuccess', { 
                  action: command.action === 'on' ? t('common.on') : t('common.off')
                })
              : t('voice.commandFailed'),
            outlet: result.outlet || null
          };
        }
      }
      
      return { success: false, message: t('voice.commandNotSupported') };
    } catch (error) {
      return { success: false, message: t('voice.commandError') };
    }
  }, [t]);

  const processTranscript = useCallback((transcript) => {
    if (!transcript) return null;
    
    setLastCommand(transcript);
    const command = parseVoiceCommand(transcript);
    
    return command;
  }, [parseVoiceCommand]);

  return {
    isListening,
    setIsListening,
    lastCommand,
    parseVoiceCommand,
    executeVoiceCommand,
    processTranscript,
  };
};

export default useVoiceControl;
