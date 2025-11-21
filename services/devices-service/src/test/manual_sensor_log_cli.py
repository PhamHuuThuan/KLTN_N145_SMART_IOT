"""
Interactive helper to publish manual telemetry over MQTT (like a real device).

Usage:
    python manual_sensor_log_cli.py

You'll be prompted for MQTT broker info (host/port, optional credentials) along with deviceId
and sensor values (temperature, humidity, smoke, gas, flame). Each entry is published to
topic `iot/{deviceId}/telemetry` (or a custom topic template) so the pipeline (mqtt-service →
devices-service → rules/ML) receives it exactly like real hardware.
"""

import json
import time
from datetime import datetime, timezone

import paho.mqtt.client as mqtt

DEFAULT_BROKER_HOST = "localhost"
DEFAULT_BROKER_PORT = 1883
DEFAULT_TOPIC_TEMPLATE = "iot/{device_id}/telemetry"
DEFAULT_QOS = 1


def prompt_float(label, default=None):
  raw = input(f"{label} [{default if default is not None else ''}]: ").strip()
  if not raw:
    return default
  try:
    return float(raw)
  except ValueError:
    print("Không hợp lệ, giữ nguyên giá trị mặc định.")
    return default


def prompt_bool(label, default=False):
  default_str = "Y" if default else "n"
  raw = input(f"{label} (y/N) [default {default_str}]: ").strip().lower()
  if not raw:
    return default
  return raw in ("y", "yes", "1", "true", "t")


def main():
  print("=== Manual Sensor Log CLI (MQTT) ===")
  broker_host = input(f"MQTT broker host [{DEFAULT_BROKER_HOST}]: ").strip() or DEFAULT_BROKER_HOST
  port_raw = input(f"MQTT broker port [{DEFAULT_BROKER_PORT}]: ").strip()
  broker_port = int(port_raw) if port_raw else DEFAULT_BROKER_PORT

  topic_template = input(f"Topic template [{DEFAULT_TOPIC_TEMPLATE}]: ").strip() or DEFAULT_TOPIC_TEMPLATE
  qos_raw = input(f"QoS [{DEFAULT_QOS}]: ").strip()
  qos = int(qos_raw) if qos_raw else DEFAULT_QOS

  username = input("MQTT username (optional): ").strip() or None
  password = None
  if username:
    password = input("MQTT password (optional): ").strip() or None

  client_id = f"manual-cli-{int(time.time())}"
  client = mqtt.Client(client_id=client_id)
  if username:
    client.username_pw_set(username, password=password)

  try:
    client.connect(broker_host, broker_port, keepalive=60)
    client.loop_start()
    print(f"Connected to MQTT broker {broker_host}:{broker_port}")
  except Exception as exc:
    print(f"Không thể kết nối MQTT broker: {exc}")
    return

  print("Nhập giá trị sensor (bỏ trống để lấy mặc định).")
  
  # Lưu trữ thông tin đã nhập
  saved_data = {
    "device_id": None,
    "temp": 55.0,
    "humid": 80.0,
    "smoke": 350.0,
    "gas_ppm": 900.0,
    "flame": True,
    "o1": False,
    "o2": False,
    "o3": False,
    "o4": False,
  }
  
  def send_mqtt_message(data_dict, device_id_val):
    """Helper function để gửi MQTT message"""
    payload = {
      "ts": int(time.time() * 1000),
      "temp": data_dict["temp"],
      "humid": data_dict["humid"],
      "smoke": data_dict["smoke"],
      "gas_ppm": data_dict["gas_ppm"],
      "flame": data_dict["flame"],
      "o": {
        "o1": data_dict["o1"],
        "o2": data_dict["o2"],
        "o3": data_dict["o3"],
        "o4": data_dict["o4"],
      }
    }
    
    topic = topic_template.format(device_id=device_id_val) if "{device_id}" in topic_template else topic_template
    message = json.dumps(payload)
    
    try:
      result = client.publish(topic, message, qos=qos)
      result.wait_for_publish(timeout=5)
      status = "Thành công" if result.rc == mqtt.MQTT_ERR_SUCCESS else f"Lỗi rc={result.rc}"
      print(f"{status}: topic={topic}")
      print(f"  Device: {device_id_val}, Temp: {data_dict['temp']}°C, Humid: {data_dict['humid']}%, Smoke: {data_dict['smoke']}, Gas: {data_dict['gas_ppm']}, Flame: {data_dict['flame']}")
      return True
    except Exception as exc:
      print(f"Lỗi khi publish MQTT: {exc}")
      return False
  
  first_entry = True
  
  while True:
    # Nhập device ID (bắt buộc lần đầu, có thể giữ nguyên sau)
    if first_entry or saved_data["device_id"] is None:
      device_id = input("Device ID: ").strip()
      if not device_id:
        print("Device ID là bắt buộc!")
        continue
      saved_data["device_id"] = device_id
    else:
      device_id_input = input(f"Device ID [{saved_data['device_id']}]: ").strip()
      if device_id_input:
        saved_data["device_id"] = device_id_input
      device_id = saved_data["device_id"]

    # Nhập giá trị sensor (có thể giữ nguyên)
    temp_input = prompt_float("Temperature (°C)", saved_data["temp"])
    if temp_input is not None:
      saved_data["temp"] = temp_input

    humid_input = prompt_float("Humidity (%)", saved_data["humid"])
    if humid_input is not None:
      saved_data["humid"] = humid_input

    smoke_input = prompt_float("Smoke (ppm)", saved_data["smoke"])
    if smoke_input is not None:
      saved_data["smoke"] = smoke_input

    gas_ppm_input = prompt_float("Gas PPM", saved_data["gas_ppm"])
    if gas_ppm_input is not None:
      saved_data["gas_ppm"] = gas_ppm_input

    flame_input = prompt_bool("Flame detected", saved_data["flame"])
    saved_data["flame"] = flame_input

    o1_input = prompt_bool("Outlet o1 ON?", saved_data["o1"])
    saved_data["o1"] = o1_input

    o2_input = prompt_bool("Outlet o2 ON?", saved_data["o2"])
    saved_data["o2"] = o2_input

    o3_input = prompt_bool("Outlet o3 ON?", saved_data["o3"])
    saved_data["o3"] = o3_input

    o4_input = prompt_bool("Outlet o4 ON?", saved_data["o4"])
    saved_data["o4"] = o4_input

    # Gửi message
    send_mqtt_message(saved_data, saved_data["device_id"])
    first_entry = False
    
    print("\nChọn hành động tiếp theo:")
    print("  [Enter/r] Gửi lại y hệt")
    print("  [v] Sửa giá trị sensor (giữ deviceId)")
    print("  [d] Sửa deviceId (giữ giá trị sensor)")
    print("  [n] Nhập mới hoàn toàn")
    print("  [q] Thoát")
    action = input("Lựa chọn [Enter]: ").strip().lower()
    
    if action in ("q", "quit", "exit"):
      break
    elif action in ("r", "repeat", ""):
      # Gửi lại y hệt - không hỏi gì cả, gửi ngay
      send_mqtt_message(saved_data, saved_data["device_id"])
      continue
    elif action in ("v", "value"):
      # Chỉ sửa giá trị sensor, giữ deviceId
      continue
    elif action in ("d", "device"):
      # Chỉ sửa deviceId, giữ giá trị sensor
      device_id_input = input(f"Device ID mới [{saved_data['device_id']}]: ").strip()
      if device_id_input:
        saved_data["device_id"] = device_id_input
      # Gửi ngay với deviceId mới
      send_mqtt_message(saved_data, saved_data["device_id"])
      continue
    elif action in ("n", "new"):
      # Nhập mới hoàn toàn
      saved_data = {
        "device_id": None,
        "temp": 55.0,
        "humid": 80.0,
        "smoke": 350.0,
        "gas_ppm": 900.0,
        "flame": True,
        "o1": False,
        "o2": False,
        "o3": False,
        "o4": False,
      }
      first_entry = True
      continue
    else:
      # Mặc định: gửi lại y hệt (Enter hoặc r)
      send_mqtt_message(saved_data, saved_data["device_id"])
      continue

  try:
    client.loop_stop()
    client.disconnect()
  except Exception:
    pass


if __name__ == "__main__":
  main()


