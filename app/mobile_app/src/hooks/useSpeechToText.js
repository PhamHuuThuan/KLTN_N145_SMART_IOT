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
    Voice.onSpeechStart = () => {
      log.debug('speech start');
      setError(null);
    };
    Voice.onSpeechEnd = () => {
      log.debug('speech end');
      setListening(false);
    };
    Voice.onSpeechError = (e) => {
      const msg = e?.error?.message || 'Speech error';
      log.error('speech error', msg);
      setError(msg);
      setListening(false);
    };
    Voice.onSpeechResults = (e) => {
      const text = e?.value?.[0] || '';
      lastResultRef.current = text;
      setTranscript(text);
      log.debug('final', text);
      if (onResult && text) onResult(text);
    };
    Voice.onSpeechPartialResults = (e) => {
      const text = e?.value?.[0] || '';
      if (text) {
        setTranscript(text);
        log.debug('partial', text);
      }
    };

    return () => {
      try {
        Voice.destroy().then(Voice.removeAllListeners);
      } catch {}
    };
  }, [onResult]);

  const requestAndroidPermission = async () => {
    if (Platform.OS !== 'android') return true;
    try {
      const t = (key, fallback) => i18n.t(key, fallback);
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        {
          title: t('voice.permissionTitle', 'Microphone Permission'),
          message: t('voice.permissionMessage', 'App needs access to your microphone for voice commands'),
          buttonPositive: t('common.yes', 'OK'),
        }
      );
      if (granted === PermissionsAndroid.RESULTS.GRANTED) return true;
      if (granted === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
        Alert.alert(
          t('voice.permissionTitle', 'Microphone permission'),
          t('voice.permissionDeniedMessage', 'Please allow microphone access in Settings > Apps > Smart IoT Kitchen > Permissions.'),
          [
            { text: t('common.cancel', 'Cancel'), style: 'cancel' },
            { text: t('voice.openSettings', 'Open Settings'), onPress: () => Linking.openSettings() },
          ]
        );
      }
      return false;
    } catch (e) {
      return false;
    }
  };

  const start = useCallback(async () => {
    try {
      setTranscript('');
      setError(null);
      setListening(true);
      const t = (key, fallback) => i18n.t(key, fallback);
      const ok = await requestAndroidPermission();
      if (!ok) {
        setError(t('voice.permissionDenied', 'Microphone permission denied'));
        setListening(false);
        return;
      }
      try {
        const services = await Voice.getSpeechRecognitionServices?.();
        if (services && services.length === 0) {
          log.warn('No speech recognition services installed');
        } else if (services) {
          log.debug('services', services);
        }
      } catch {}
      try { await Voice.isAvailable(); } catch {}
      try {
        await Voice.start(locale, {
          EXTRA_PREFER_OFFLINE: false,
          EXTRA_PARTIAL_RESULTS: true,
        });
      } catch (e) {
        // Fallback to system default locale if specified one is not available
        log.warn('Voice.start failed with locale, retry default', e?.message || e);
        await Voice.start(undefined, { EXTRA_PARTIAL_RESULTS: true });
      }
    } catch (e) {
      setError(e?.message || String(e));
      setListening(false);
    }
  }, [locale]);

  const stop = useCallback(async () => {
    try {
      await Voice.stop();
    } catch {}
    setListening(false);
  }, []);

  const toggle = useCallback(async (next) => {
    if (next === undefined) next = !listening;
    if (next) return start();
    return stop();
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


