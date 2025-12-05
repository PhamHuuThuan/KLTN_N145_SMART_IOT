import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

const useVoiceControl = () => {
  const { t } = useTranslation();
  const [isListening, setIsListening] = useState(false);
  const [lastCommand, setLastCommand] = useState('');

  const voiceCommands = {
    'bật': 'on',
    'mở': 'on', 
    'khởi động': 'on',
    'kích hoạt': 'on',
    'start': 'on',
    'turn on': 'on',
    'tắt': 'off',
    'đóng': 'off',
    'dừng': 'off',
    'ngừng': 'off',
    'stop': 'off',
    'turn off': 'off',
    'ổ cắm': 'outlet',
    'socket': 'outlet',
    'outlet': 'outlet',
    'thiết bị': 'device',
    'device': 'device',
    'một': '1', 'hai': '2', 'ba': '3', 'bốn': '4', 'năm': '5',
    'sáu': '6', 'bảy': '7', 'tám': '8', 'chín': '9', 'mười': '10',
    '1': '1', '2': '2', '3': '3', '4': '4', '5': '5',
    '6': '6', '7': '7', '8': '8', '9': '9', '10': '10',
    'quạt': 'fan',
    'fan': 'fan',
    'đèn': 'light',
    'light': 'light',
    'máy': 'machine',
    'machine': 'machine',
    'tivi': 'tv',
    'tv': 'tv',
    'điều hòa': 'ac',
    'ac': 'ac',
    'tủ': 'refrigerator',
    'lạnh': 'refrigerator',
    'tủ lạnh': 'refrigerator',
    'refrigerator': 'refrigerator',
    'lò': 'microwave',
    'vi': 'microwave',
    'sóng': 'microwave',
    'lò vi sóng': 'microwave',
    'microwave': 'microwave',
    'giặt': 'washing',
    'máy giặt': 'washing',
    'washing': 'washing',
    'nóng': 'heater',
    'bình nóng lạnh': 'heater',
    'heater': 'heater',
    'của': '',
    'the': '',
    'a': '',
    'an': '',
    'and': '',
    'với': '',
    'with': '',
    'số': '',
    'number': '',
  };

  const parseVoiceCommand = useCallback((transcript) => {
    if (!transcript) return null;
    
    const lowerTranscript = transcript.toLowerCase();
    let action = null;
    let target = null;
    let number = null;
    let location = null;
    let outletName = null;
    
    // Extract action - check for multi-word actions first
    const actionPhrases = ['turn on', 'turn off'];
    for (const phrase of actionPhrases) {
      if (lowerTranscript.includes(phrase)) {
        action = phrase === 'turn on' ? 'on' : 'off';
        break;
      }
    }
    
    // If no multi-word action found, check single words
    if (!action) {
      const words = lowerTranscript.split(/\s+/);
      for (const word of words) {
        if (voiceCommands[word] === 'on' || voiceCommands[word] === 'off') {
          action = voiceCommands[word];
          break;
        }
      }
    }
    
    // Extract target type
    const words = lowerTranscript.split(/\s+/);
    for (const word of words) {
      if (voiceCommands[word] === 'outlet' || voiceCommands[word] === 'device') {
        target = voiceCommands[word];
        break;
      }
    }
    
    // Extract device/appliance name - check for multi-word devices first
    const devicePhrases = ['tủ lạnh', 'lò vi sóng', 'máy giặt', 'bình nóng lạnh', 'điều hòa'];
    for (const phrase of devicePhrases) {
      if (lowerTranscript.includes(phrase)) {
        location = voiceCommands[phrase];
        break;
      }
    }
    
    // If no multi-word device found, check single words
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
    
    // Extract number
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
        // For outlet control
        if (command.outletName) {
          // Specific outlet by name (e.g., kitchen_1, bedroom_2)
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
          // Specific outlet by number only
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
          // All outlets
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
