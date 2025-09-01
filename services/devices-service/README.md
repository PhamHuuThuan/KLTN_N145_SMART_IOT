# Smart IoT Kitchen Devices Service

A microservice for managing smart kitchen devices with ESP32 controllers, featuring real-time monitoring, emergency response, and intelligent outlet control.

## Features

- **Device Management**: CRUD operations for smart kitchen devices
- **Real-time Monitoring**: Telemetry data collection and processing
- **Emergency Response**: Automatic safety mode activation for dangerous conditions
- **Outlet Control**: Individual control of 5 power outlets (3 kitchen + 2 safety)
- **Kafka Integration**: Real-time event streaming and inter-service communication
- **Safety Thresholds**: Configurable limits for temperature, humidity, smoke, and gas
- **RESTful API**: Comprehensive HTTP endpoints for device control

## Architecture

### Device Model
- **5 Power Outlets**: 3 kitchen appliances + 2 safety devices
- **Sensors**: Temperature, humidity, smoke, gas detection
- **Emergency Mode**: Automatic shutdown of kitchen devices + safety device activation
- **Real-time Status**: Online/offline monitoring with last seen tracking

### Safety Features
- **Automatic Shutdown**: Kitchen outlets turn off during emergencies
- **Safety Activation**: Safety outlets activate during emergencies
- **Threshold Monitoring**: Real-time sensor data analysis
- **Emergency Response**: Immediate action on dangerous conditions

## API Endpoints

### Devices
- `GET /api/devices` - List all devices
- `GET /api/devices/:deviceId` - Get device details
- `POST /api/devices` - Create new device
- `PUT /api/devices/:deviceId` - Update device
- `DELETE /api/devices/:deviceId` - Delete device
- `GET /api/devices/:deviceId/status` - Get device status
- `PUT /api/devices/:deviceId/outlets/:outletId/toggle` - Toggle outlet
- `PUT /api/devices/:deviceId/emergency/enter` - Enter emergency mode
- `PUT /api/devices/:deviceId/emergency/exit` - Exit emergency mode
- `PUT /api/devices/:deviceId/thresholds` - Update safety thresholds

### Device Logs
- `POST /api/logs` - Create telemetry log
- `GET /api/logs` - Get device logs
- `GET /api/logs/emergency` - Get emergency logs
- `GET /api/logs/:deviceId/latest` - Get latest telemetry
- `GET /api/logs/:deviceId/history` - Get telemetry history
- `POST /api/logs/process` - Process unprocessed logs
- `DELETE /api/logs/cleanup` - Clean old logs

## Installation

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Environment Setup**
   ```bash
   cp env.example .env
   # Edit .env with your configuration
   ```

3. **Database Setup**
   - Ensure MongoDB is running
   - Update `MONGODB_URI` in `.env`

4. **Kafka Setup**
   - Ensure Kafka is running
   - Update `KAFKA_BROKERS` in `.env`

## Usage

### Development
```bash
npm run dev
```

### Production
```bash
npm start
```

### Health Check
```bash
curl http://localhost:3001/health
```

## Device Configuration Example

### Creating a Kitchen Device
```json
{
  "deviceId": "KITCHEN-ESP32-LED1",
  "ownerId": "user123",
  "name": "Kitchen Smart Controller",
  "location": {
    "room": "kitchen",
    "floor": "1"
  },
  "outlets": [
    {"id": "o1", "name": "Microwave", "type": "kitchen"},
    {"id": "o2", "name": "Coffee Maker", "type": "kitchen"},
    {"id": "o3", "name": "Toaster", "type": "kitchen"},
    {"id": "o4", "name": "Ventilation Fan", "type": "safety"},
    {"id": "o5", "name": "Emergency Light", "type": "safety"}
  ],
  "thresholds": {
    "temperature": {"min": 15, "max": 50},
    "humidity": {"min": 30, "max": 80},
    "smoke": {"max": 100},
    "gas": {"max": 1000}
  }
}
```

### Telemetry Data Format
```json
{
  "type": "telemetry",
  "deviceId": "KITCHEN-ESP32-LED1",
  "topic": "iot/KITCHEN-ESP32-LED1/telemetry",
  "payload": {
    "ts": 676489,
    "temp": 32.3,
    "humid": 53,
    "smoke": 0,
    "gas_ppm": 335.275,
    "o": {
      "o1": false,
      "o2": false,
      "o3": false,
      "o4": false,
      "o5": false
    }
  }
}
```

## Emergency Response

### Automatic Triggers
- **High Temperature**: > 60°C
- **Smoke Detection**: > 100 ppm
- **Gas Leak**: > 1000 ppm

### Emergency Actions
1. **Kitchen Outlets**: Automatically turned off
2. **Safety Outlets**: Automatically turned on
3. **Emergency Mode**: Activated with timestamp
4. **Kafka Events**: Published for other services
5. **Alerts**: Sent to notification system

## Kafka Topics

- `device.created` - New device registration
- `device.updated` - Device configuration changes
- `device.deleted` - Device removal
- `outlet.toggled` - Outlet state changes
- `device.emergency` - Emergency mode events
- `telemetry.data` - Sensor data streaming
- `alerts.emergency` - Emergency notifications

## Monitoring & Health

- **Health Endpoint**: `/health`
- **Request Logging**: All API calls logged
- **Error Handling**: Comprehensive error responses
- **Rate Limiting**: 100 requests per 15 minutes
- **CORS Support**: Configurable origins

## Security Features

- **Helmet**: Security headers
- **Rate Limiting**: DDoS protection
- **Input Validation**: Joi schema validation
- **CORS Protection**: Configurable cross-origin access
- **Error Sanitization**: No sensitive data in error messages

## Dependencies

- **Express**: Web framework
- **Mongoose**: MongoDB ODM
- **KafkaJS**: Kafka client
- **Joi**: Data validation
- **Helmet**: Security middleware
- **CORS**: Cross-origin support
- **Rate Limiting**: Request throttling

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

ISC License
