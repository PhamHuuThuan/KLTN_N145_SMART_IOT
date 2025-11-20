import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../contexts/ThemeContext';
import CONFIG from '../constants/config';

const QRScannerModal = ({
  visible,
  onClose,
  onScan,
  isProcessing = false,
}) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [permission, requestPermission] = useCameraPermissions();
  const [hasScanned, setHasScanned] = useState(false);
  const [torchEnabled, setTorchEnabled] = useState(false);

  useEffect(() => {
    if (!visible) {
      setHasScanned(false);
      setTorchEnabled(false);
      return;
    }

    if (!permission) {
      requestPermission();
      return;
    }

    if (!permission.granted && permission.canAskAgain) {
      requestPermission();
    }
  }, [visible, permission, requestPermission]);

  useEffect(() => {
    if (!visible) return;
    if (!isProcessing) {
      setHasScanned(false);
    }
  }, [isProcessing, visible]);

  const handleBarCodeScanned = useCallback(
    (scanResult) => {
      if (!scanResult?.data) return;
      if (hasScanned || isProcessing) return;
      setHasScanned(true);
      onScan?.(scanResult.data);
    },
    [hasScanned, isProcessing, onScan]
  );

  const handlePermissionDenied = useCallback(() => {
    if (permission?.canAskAgain) {
      requestPermission();
    } else {
      Linking.openSettings();
    }
  }, [permission, requestPermission]);

  const renderCameraArea = useMemo(() => {
    if (!permission) {
      return (
        <View style={styles.cameraFallback}>
          <ActivityIndicator color={colors.primary} />
          <Text style={[styles.permissionText, { color: colors.textSecondary }]}>
            {t('devices.cameraLoading', 'Preparing camera...')}
          </Text>
        </View>
      );
    }

    if (!permission.granted) {
      return (
        <View style={styles.cameraFallback}>
          <MaterialCommunityIcons name="camera-off" size={42} color={colors.danger} />
          <Text style={[styles.permissionTitle, { color: colors.text }]}>
            {t('devices.scanQrPermissionTitle', 'Camera permission required')}
          </Text>
          <Text style={[styles.permissionText, { color: colors.textSecondary }]}>
            {t(
              'devices.scanQrPermissionMessage',
              'Allow camera access to scan device QR codes.'
            )}
          </Text>
          <TouchableOpacity
            style={[styles.permissionButton, { backgroundColor: colors.primary }]}
            onPress={handlePermissionDenied}
          >
            <Text style={[styles.permissionButtonText, { color: colors.white }]}>
              {permission.canAskAgain
                ? t('devices.grantPermission', 'Grant permission')
                : t('devices.openSettings', 'Open Settings')}
            </Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.cameraWrapper}>
        <CameraView
          style={styles.camera}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={handleBarCodeScanned}
          enableTorch={torchEnabled}
        />
        <View pointerEvents="none" style={styles.overlay}>
          <View style={styles.scanFrame} />
        </View>
        <View style={styles.cameraFooter}>
          <TouchableOpacity
            style={[styles.footerButton, { backgroundColor: colors.surfaceSecondary }]}
            onPress={() => setTorchEnabled((prev) => !prev)}
          >
            <MaterialCommunityIcons
              name={torchEnabled ? 'flashlight-off' : 'flashlight'}
              size={20}
              color={colors.text}
            />
            <Text style={[styles.footerButtonText, { color: colors.text }]}>
              {torchEnabled
                ? t('devices.torchOff', 'Turn torch off')
                : t('devices.torchOn', 'Turn torch on')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.footerButton, { backgroundColor: colors.surfaceSecondary }]}
            onPress={() => setHasScanned(false)}
            disabled={isProcessing}
          >
            <MaterialCommunityIcons
              name="refresh"
              size={20}
              color={colors.text}
            />
            <Text style={[styles.footerButtonText, { color: colors.text }]}>
              {t('devices.scanAgain', 'Scan again')}
            </Text>
          </TouchableOpacity>
        </View>
        {isProcessing && (
          <View style={styles.processingOverlay}>
            <ActivityIndicator color={colors.white} size="large" />
            <Text style={[styles.processingText, { color: colors.white }]}>
              {t('devices.processingScan', 'Processing scanned data...')}
            </Text>
          </View>
        )}
      </View>
    );
  }, [
    permission,
    colors.primary,
    colors.textSecondary,
    colors.danger,
    colors.text,
    colors.white,
    colors.surfaceSecondary,
    handleBarCodeScanned,
    handlePermissionDenied,
    isProcessing,
    torchEnabled,
    t,
  ]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
      transparent
    >
      <View style={styles.wrapper}>
        <View style={[styles.content, { backgroundColor: colors.surface }]}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]}>
              {t('devices.scanQrCode', 'Scan QR code')}
            </Text>
            <TouchableOpacity onPress={onClose}>
              <MaterialCommunityIcons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {t(
              'devices.scanQrInstruction',
              'Align the QR code inside the frame to scan automatically.'
            )}
          </Text>
          {renderCameraArea}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    padding: 16,
  },
  content: {
    borderRadius: CONFIG.DIMENSIONS.borderRadius,
    padding: 16,
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 14,
  },
  cameraWrapper: {
    height: 360,
    borderRadius: CONFIG.DIMENSIONS.borderRadius,
    overflow: 'hidden',
  },
  camera: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanFrame: {
    width: '70%',
    aspectRatio: 1,
    borderColor: '#FFFFFF',
    borderWidth: 2,
    borderRadius: CONFIG.DIMENSIONS.borderRadius,
  },
  cameraFooter: {
    flexDirection: 'row',
    gap: 10,
    padding: 12,
    justifyContent: 'space-between',
  },
  footerButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: CONFIG.DIMENSIONS.borderRadius,
    paddingVertical: 10,
  },
  footerButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  processingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  processingText: {
    fontSize: 14,
    fontWeight: '600',
  },
  cameraFallback: {
    height: 360,
    borderRadius: CONFIG.DIMENSIONS.borderRadius,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    gap: 12,
  },
  permissionTitle: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  permissionText: {
    fontSize: 14,
    textAlign: 'center',
  },
  permissionButton: {
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: CONFIG.DIMENSIONS.borderRadius,
  },
  permissionButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});

export default QRScannerModal;


