import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, PermissionsAndroid, Linking, Alert } from 'react-native';
import Voice from '@react-native-voice/voice';
import { createLogger } from '../utils/logger';

const log = createLogger('useSpeechToText');

export function useSpeechToText({ locale = 'vi-VN', onResult } = {}) {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState(null);
  const lastResultRef = useRef('');

  useEffect(() => {
    log.info('Setting up Voice recognition callbacks');
    
    const onSpeechStart = () => {
      log.info('✅ onSpeechStart fired');
      setError(null);
      setListening(true);
    };
    
    const onSpeechEnd = () => {
      log.info('✅ onSpeechEnd fired');
    };
    
    const onSpeechError = (e) => {
      const msg = e?.error?.message || 'Speech error';
      log.error('❌ onSpeechError:', msg);
      setError(msg);
      setListening(false);
    };
    
    const onSpeechResults = (e) => {
      const text = e?.value?.[0] || '';
      lastResultRef.current = text;
      log.info('✅ onSpeechResults - final:', text);
      setTranscript(text);
      if (onResult && text) onResult(text);
    };
    
    const onSpeechPartialResults = (e) => {
      const text = e?.value?.[0] || '';
      if (text) {
        log.info('✅ onSpeechPartialResults - partial:', text);
        setTranscript(text);
      }
    };

    Voice.onSpeechStart = onSpeechStart;
    Voice.onSpeechEnd = onSpeechEnd;
    Voice.onSpeechError = onSpeechError;
    Voice.onSpeechResults = onSpeechResults;
    Voice.onSpeechPartialResults = onSpeechPartialResults;

    log.info('Voice callbacks registered');

    return () => {
      log.info('Cleaning up Voice callbacks');
      try {
        Voice.removeAllListeners();
        Voice.destroy();
      } catch (e) {
        log.error('Error cleaning up:', e);
      }
    };
  }, [onResult]);

  const requestAndroidPermission = async () => {
    if (Platform.OS !== 'android') return true;
    
    try {
      const currentPermission = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO
      );
      
      if (currentPermission) {
        log.info('✅ Permission already granted');
        return true;
      }

      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        {
          title: 'Microphone Permission',
          message: 'App needs access to your microphone for voice commands',
          buttonPositive: 'OK',
          buttonNegative: 'Cancel',
        }
      );
      
      if (granted === PermissionsAndroid.RESULTS.GRANTED) {
        log.info('✅ Permission granted');
        return true;
      }
      
      if (granted === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
        Alert.alert(
          'Microphone permission',
          'Please allow microphone access in Settings > Apps > Smart IoT Kitchen > Permissions.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() },
          ]
        );
      }
      
      return false;
    } catch (e) {
      log.error('❌ Permission error:', e);
      return false;
    }
  };

  const start = useCallback(async () => {
    log.info('🚀 Starting voice recognition');
    
    try {
      setTranscript('');
      setError(null);
      setListening(true);
      
      const ok = await requestAndroidPermission();
      if (!ok) {
        setError('Microphone permission denied. Please enable it in Settings.');
        setListening(false);
        return;
      }
      
      try {
        await Voice.stop();
      } catch (e) {
        log.debug('No existing recognition to stop');
      }
      
      await new Promise(resolve => setTimeout(resolve, 200));
      
      try {
        log.info('Calling Voice.start with locale:', locale);
        await Voice.start(locale, {
          EXTRA_PREFER_OFFLINE: false,
          EXTRA_PARTIAL_RESULTS: true,
        });
        log.info('✅ Voice.start succeeded');
      } catch (e) {
        log.warn('Voice.start failed, retry default locale', e?.message);
        try {
          await Voice.start(undefined, { EXTRA_PARTIAL_RESULTS: true });
          log.info('✅ Voice.start with default locale succeeded');
        } catch (e2) {
          log.error('❌ Voice.start failed completely:', e2?.message);
          setListening(false);
          setError(e2?.message || e?.message || String(e2 || e));
        }
      }
    } catch (e) {
      log.error('❌ Start error:', e);
      setError(e?.message || String(e));
      setListening(false);
    }
  }, [locale]);

  const stop = useCallback(async () => {
    try {
      await Voice.stop();
    } catch (e) {
      log.debug('Stop error:', e);
    }
    setListening(false);
  }, []);

  const toggle = useCallback(async (next) => {
    if (next === undefined) next = !listening;
    return next ? start() : stop();
  }, [listening, start, stop]);

  return {
    listening,
    transcript,
    error,
    start,
    stop,
    toggle,
  };
}

export default useSpeechToText;
