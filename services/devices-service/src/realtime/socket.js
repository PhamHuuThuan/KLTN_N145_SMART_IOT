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

export function emitDeviceTelemetry(deviceId, telemetryPayload) {
  if (!ioInstance) return;
  ioInstance.emit('device.telemetry', {
    deviceId,
    payload: telemetryPayload,
  });
}
