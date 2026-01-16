"""
Cygnus IoT Device Discovery and Management
Flask application with mDNS/Zeroconf discovery
"""
from flask import Flask, render_template, jsonify, request
import threading
import time
import sqlite3
from mdns_service import start_discovery, get_devices

app = Flask(__name__)

# Database configuration
DB_PATH = 'device_data.db'
DEVICE_TIMEOUT = 60  # seconds - mark offline if not seen

# Port mapping for services
SERVICE_PORT_MAPPING = {
    'cygmin': None,  # No port
    'openplc': 8080,
    'opcua': 5002,
    'bacnet': 5001,
    'tor-modbus': 8081,
    'tor-serial2tcp': 9001
}


def init_db():
    """Initialize SQLite database and create tables"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS devicemaster (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            hostname TEXT,
            ip TEXT,
            port INTEGER,
            imei TEXT,
            device_id TEXT,
            model TEXT,
            fw TEXT,
            memory_usage TEXT,
            bacnet_status TEXT,
            tor_modbus_status TEXT,
            tor_serial2tcp_status TEXT,
            opcua_status TEXT,
            openplc_status TEXT,
            cygmin_status TEXT,
            device_name TEXT,
            status TEXT DEFAULT 'offline',
            first_seen INTEGER,
            last_seen INTEGER
        )
    ''')
    
    conn.commit()
    conn.close()
    print("[DB] Database initialized successfully")


def update_device_in_db(device):
    """Update or insert device data in database"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        current_time = int(time.time())
        cursor.execute('''
            INSERT INTO devicemaster 
            (name, hostname, ip, port, imei, device_id, model, fw, 
             memory_usage, bacnet_status, tor_modbus_status, tor_serial2tcp_status,
             opcua_status, openplc_status, cygmin_status, status, first_seen, last_seen)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'online', ?, ?)
            ON CONFLICT(name) DO UPDATE SET
                hostname = excluded.hostname,
                ip = excluded.ip,
                port = excluded.port,
                imei = excluded.imei,
                device_id = excluded.device_id,
                model = excluded.model,
                fw = excluded.fw,
                memory_usage = excluded.memory_usage,
                bacnet_status = excluded.bacnet_status,
                tor_modbus_status = excluded.tor_modbus_status,
                tor_serial2tcp_status = excluded.tor_serial2tcp_status,
                opcua_status = excluded.opcua_status,
                openplc_status = excluded.openplc_status,
                cygmin_status = excluded.cygmin_status,
                status = 'online',
                last_seen = excluded.last_seen
        ''', (
            device.get('name'),
            device.get('hostname'),
            device.get('ip'),
            device.get('port'),
            device.get('imei'),
            device.get('device_id'),
            device.get('model'),
            device.get('fw'),
            device.get('memory_usage'),
            device.get('bacnet_status'),
            device.get('tor_modbus_status'),
            device.get('tor_serial2tcp_status'),
            device.get('opcua_status'),
            device.get('openplc_status'),
            device.get('cygmin_status'),
            current_time,
            current_time
        ))
        
        conn.commit()
    except Exception as e:
        print(f"[DB] Error updating device: {e}")
    finally:
        conn.close()


def mark_stale_devices_offline():
    """Mark devices as offline if not seen recently"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        timeout_time = int(time.time()) - DEVICE_TIMEOUT
        cursor.execute('''
            UPDATE devicemaster 
            SET status = 'offline' 
            WHERE last_seen < ? AND status = 'online'
        ''', (timeout_time,))
        
        if cursor.rowcount > 0:
            print(f"[DB] Marked {cursor.rowcount} device(s) as offline")
        
        conn.commit()
    except Exception as e:
        print(f"[DB] Error marking devices offline: {e}")
    finally:
        conn.close()


def get_devices_from_db():
    """Get all devices from database"""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    try:
        cursor.execute('SELECT * FROM devicemaster ORDER BY hostname')
        rows = cursor.fetchall()
        devices = [dict(row) for row in rows]
        return devices
    except Exception as e:
        print(f"[DB] Error getting devices: {e}")
        return []
    finally:
        conn.close()


app = Flask(__name__)


@app.route('/')
def index():
    """Render main dashboard"""
    return render_template('index.html')


@app.route('/api/devices')
def api_devices():
    """API endpoint to get current device list"""
    # Update database with latest mDNS discoveries
    mdns_devices = get_devices()
    for device in mdns_devices:
        update_device_in_db(device)
    
    # Mark stale devices as offline
    mark_stale_devices_offline()
    
    # Get all devices from database (includes online/offline status)
    device_list = get_devices_from_db()
    
    # Add port mapping info to each device
    for device in device_list:
        device['services'] = {}
        
        # Map each service to its port if enabled
        if device.get('bacnet_status') == 'enabled':
            device['services']['BACnet'] = SERVICE_PORT_MAPPING['bacnet']
        if device.get('tor_modbus_status') == 'enabled':
            device['services']['Modbus'] = SERVICE_PORT_MAPPING['tor-modbus']
        if device.get('tor_serial2tcp_status') == 'enabled':
            device['services']['Serial2TCP'] = SERVICE_PORT_MAPPING['tor-serial2tcp']
        if device.get('opcua_status') == 'enabled':
            device['services']['OPC UA'] = SERVICE_PORT_MAPPING['opcua']
        if device.get('openplc_status') == 'enabled':
            device['services']['OpenPLC'] = SERVICE_PORT_MAPPING['openplc']
        device['services']['Cygnus Admin'] = SERVICE_PORT_MAPPING['cygmin']
    
    return jsonify(device_list)


@app.route('/api/device/update-name', methods=['POST'])
def update_device_name():
    """API endpoint to update device name"""
    data = request.get_json()
    
    device_name_id = data.get('name')  # This is the unique device identifier
    new_name = data.get('device_name', '').strip()
    
    if not device_name_id:
        return jsonify({'success': False, 'error': 'Device name ID required'}), 400
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        cursor.execute('''
            UPDATE devicemaster 
            SET device_name = ?
            WHERE name = ?
        ''', (new_name, device_name_id))
        
        conn.commit()
        return jsonify({'success': True})
    except Exception as e:
        print(f"[DB] Error updating device name: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500
    finally:
        conn.close()


def run_flask():
    """Run Flask application"""
    app.run(host='0.0.0.0', port=5000, debug=False, use_reloader=False)


if __name__ == '__main__':
    # Initialize database
    print("Initializing database...")
    init_db()
    
    # Start mDNS discovery in background thread
    print("Initializing mDNS discovery service...")
    discovery_thread = threading.Thread(target=start_discovery, daemon=True)
    discovery_thread.start()
    
    # Give discovery more time to initialize and start scanning
    print("Waiting for discovery service to initialize...")
    time.sleep(2)
    
    print("\n" + "="*60)
    print("Cygnus IoT Device Discovery Server")
    print("="*60)
    print("Web interface: http://localhost:5000")
    print("mDNS discovery: Active (queries every 10s)")
    print("Database: SQLite (device_data.db)")
    print("Press Ctrl+C to stop")
    print("="*60 + "\n")
    
    # Run Flask app in main thread
    run_flask()
