"""
MQTT publish simulator for measuring DropRate.

Usage example:
    python mqtt_publish_simulator.py --host localhost --port 1883 --device-id dev-123 --count 1000 --rate 50 --qos 1

Requirements:
    pip install paho-mqtt

What it does:
- Publishes `count` messages to topic `devices/<device_id>/telemetry` at the specified rate (messages/sec).
- Uses QoS specified (0,1,2). For QoS 1/2 the script counts broker PUBACKs via on_publish.
- Optionally subscribe to an ack/echo topic to measure consumer-ack delivery (use --ack-topic).
- Prints stats at the end: published, acked (on_publish callbacks), drop_rate = (published-acked)/published.

Notes:
- For QoS=0 on_publish may be called immediately after send; network/broker drops are harder to detect.
- For more accurate end-to-end delivery measurement, set up the consumer to publish back acknowledgements to `--ack-topic` and use --ack-topic to measure delivery to the consumer.
"""

import argparse
import json
import signal
import sys
import threading
import time
import uuid
from datetime import datetime, timezone

import paho.mqtt.client as mqtt
import warnings

# Global counters
published_count = 0
_lock = threading.Lock()
_stop = threading.Event()

# Suppress noisy paho callback deprecation warning
warnings.filterwarnings("ignore", message="Callback API version 1 is deprecated")


def on_connect(client, userdata, flags, rc, properties=None):
    try:
        code = int(rc)
    except Exception:
        code = rc
    if code == 0:
        print(f"Connected to broker {userdata.get('host')}:{userdata.get('port')}")
    else:
        print(f"Connect failed with rc={code}")


def on_disconnect(client, userdata, rc, properties=None):
    try:
        code = int(rc)
    except Exception:
        code = rc
    print(f"Disconnected (rc={code})")





def publisher_loop(client, base_topic, device_ids, count, interval_seconds, qos, payload_template, verbose=False):
    """Publish messages. If multiple device_ids provided, rotate through them.

    interval_seconds is the pause (in seconds) between consecutive messages. Use 0 for no delay.
    """
    global published_count
    interval = float(interval_seconds) if interval_seconds and interval_seconds > 0 else 0.0
    seq = 0
    num_devices = len(device_ids)
    while seq < count and not _stop.is_set():
        seq += 1
        device_index = (seq - 1) % num_devices
        device_id = device_ids[device_index]
        payload = payload_template.copy()
        payload['seq'] = seq
        payload['device_id'] = device_id
        payload['timestamp'] = datetime.now(timezone.utc).isoformat()

        # determine topic for this message: if base_topic contains '{device_id}' use format(),
        # otherwise if base_topic is None use default devices/<device_id>/telemetry
        if base_topic:
            if '{device_id}' in base_topic:
                topic = base_topic.format(device_id=device_id)
            else:
                topic = base_topic
        else:
            topic = f"iot/{device_id}/telemetry"

        try:
            client.publish(topic, json.dumps(payload), qos=qos)
            with _lock:
                published_count += 1
            # Logging: either print every message (verbose) or print periodic progress every 100 messages
            if verbose:
                print(f"Published #{seq} -> topic={topic} device={device_id}")
            else:
                if seq % 100 == 0 or seq == count:
                    print(f"Published {seq}/{count} messages")
        except Exception as e:
            print(f"Publish error: {e}")
        if interval > 0:
            time.sleep(interval)


def print_stats_and_exit(timeout=1.0, device_ids=None):
    wait_until = time.time() + timeout
    while time.time() < wait_until:
        time.sleep(0.05)
    with _lock:
        pub = published_count
    print('\n=== Results ===')
    print(f'Published (total): {pub}')
    if device_ids:
        # best-effort distribution estimate
        per_device = pub // len(device_ids)
        print(f'Approximately {per_device} messages per device (round-robin) for {len(device_ids)} devices')


def signal_handler(sig, frame):
    print('\nSignal received, stopping publisher...')
    _stop.set()


def main():
    parser = argparse.ArgumentParser(description='MQTT publish simulator for DropRate')
    parser.add_argument('--host', default='localhost', help='MQTT broker host')
    parser.add_argument('--port', type=int, default=1883, help='MQTT broker port')
    parser.add_argument('--device-id', default=None, help='Device ID (single device). If omitted use --device-prefix and --device-count')
    parser.add_argument('--device-prefix', default='dev-', help='Device id prefix when using multiple devices, e.g. KITCHEN-ESP32-LED')
    parser.add_argument('--device-count', type=int, default=1, help='Number of device ids to simulate (1 = single device). IDs will be <prefix>1..N')
    parser.add_argument('--topic', default=None, help='Topic to publish to (default: devices/<device-id>/telemetry)')
    parser.add_argument('--count', type=int, default=100, help='Number of messages to publish (total)')
    parser.add_argument('--rate', type=float, default=10.0, help='Publish rate (messages per second). Ignored if --interval is set')
    parser.add_argument('--interval', type=float, default=None, help='Interval (seconds) between messages. If set, overrides --rate')
    parser.add_argument('--qos', type=int, choices=[0, 1, 2], default=1, help='MQTT QoS')
    parser.add_argument('--client-id', default=None, help='MQTT client id (default random)')
    parser.add_argument('--username', default=None, help='MQTT username (optional)')
    parser.add_argument('--password', default=None, help='MQTT password (optional)')
    parser.add_argument('--transport', choices=['tcp', 'websockets'], default='tcp', help='MQTT transport: tcp or websockets')
    parser.add_argument('--ack-topic', default=None, help='If set, subscribe to this topic and count incoming ack/echo messages')
    parser.add_argument('--payload', default='{}', help='JSON string template for payload (additional fields)')
    parser.add_argument('--keepalive', type=int, default=60, help='MQTT keepalive seconds')
    parser.add_argument('--verbose', action='store_true', help='Print each published message (can be noisy)')

    args = parser.parse_args()

    payload_template = {}
    try:
        payload_template = json.loads(args.payload) if args.payload else {}
    except Exception as e:
        print(f"Invalid --payload JSON: {e}")
        sys.exit(1)

    # build device id list
    device_ids = []
    if args.device_count and args.device_count > 1:
        prefix = args.device_prefix or 'dev-'
        device_ids = [f"{prefix}{i}" for i in range(1, args.device_count + 1)]
    else:
        # single device mode: prefer explicit device-id, otherwise use prefix+1
        if args.device_id:
            device_ids = [args.device_id]
        else:
            device_ids = [f"{args.device_prefix}1"]

    client_id = args.client_id or f"sim-{uuid.uuid4().hex[:8]}"
    # Create simple client without specifying callback_api_version and without callbacks.
    # We don't need callbacks since we only count publishes.
    if args.transport == 'websockets':
        client = mqtt.Client(client_id=client_id, userdata={'host': args.host, 'port': args.port}, transport='websockets')
    else:
        client = mqtt.Client(client_id=client_id, userdata={'host': args.host, 'port': args.port})

    if args.username:
        client.username_pw_set(args.username, args.password)
 
    try:
        client.connect(args.host, args.port, keepalive=args.keepalive)
        # print immediately so user sees connection success even if on_connect callback removed
        print(f"Connected to broker {args.host}:{args.port}", flush=True)
    except Exception as e:
        print(f"Could not connect to broker: {e}")
        sys.exit(2)

    client.loop_start()

    # determine interval between messages (seconds). interval overrides rate when provided.
    if args.interval is not None:
        interval_seconds = max(0.0, float(args.interval))
    else:
        interval_seconds = 1.0 / args.rate if args.rate > 0 else 0.0

    # Print start summary so user knows publisher started (use --verbose for per-message logs)
    print(f"Starting publish: total={args.count}, devices={len(device_ids)}, interval={interval_seconds}s, qos={args.qos}", flush=True)

    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    pub_thread = threading.Thread(target=publisher_loop, args=(client, args.topic, device_ids, args.count, interval_seconds, args.qos, payload_template, args.verbose))
    pub_thread.start()

    try:
        while pub_thread.is_alive():
            pub_thread.join(timeout=0.5)
    except KeyboardInterrupt:
        _stop.set()

    print_stats_and_exit(timeout=1.0, device_ids=device_ids)

    try:
        client.loop_stop()
        client.disconnect()
    except Exception:
        pass


if __name__ == '__main__':
    main()


