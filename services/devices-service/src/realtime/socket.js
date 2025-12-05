import { Server } from 'socket.io';

let ioInstance = null;

export function setupSocket(server) {
  ioInstance = new Server(server, {
    cors: { origin: '*', credentials: false },
    transports: ['websocket', 'polling'],
  });

  ioInstance.on('connection', (socket) => {
    socket.emit('connection_ack', { ok: true });
  });

  return ioInstance;
}

export function emitDeviceTelemetry(deviceId, telemetryPayload, deviceData = null) {
  if (!ioInstance) return;
  const payload = {
    ...telemetryPayload,
    ...(deviceData?.emergencyMode !== undefined && { emergencyMode: deviceData.emergencyMode }),
    ...(deviceData?.lastEmergencyAt && { lastEmergencyAt: deviceData.lastEmergencyAt }),
  };
  ioInstance.emit('device.telemetry', {
    deviceId,
    payload,
  });
}
