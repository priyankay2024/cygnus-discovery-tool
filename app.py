"""
Cygnus IoT Device Discovery and Management
Flask application with mDNS/Zeroconf discovery
"""
from flask import Flask, render_template, jsonify, request
import threading
import time
import sqlite3
from mdns_service import start_discovery, get_devices, force_refresh

app = Flask(__name__)

# Database configuration
DB_PATH = 'device_data.db'
DEVICE_TIMEOUT = 60  # seconds - mark offline if not seen

def init_db():
    """Initialize SQLite database and create tables"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS devicemaster (
            imei TEXT PRIMARY KEY NOT NULL,
            name TEXT,
            hostname TEXT,
            ip TEXT,
            port INTEGER,
            device_id TEXT,
            model TEXT,
            fw TEXT,
            memory_usage TEXT,
            services TEXT,
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
    """Update or insert device data in database based on IMEI"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        # Skip devices without IMEI
        imei = device.get('imei')
        if not imei:
            print(f"[DB] Skipping device without IMEI: {device.get('name', 'Unknown')}")
            return
        
        current_time = int(time.time())
        import json
        services_json = json.dumps(device.get('services', {}))
        
        # Check if device exists
        cursor.execute('SELECT first_seen FROM devicemaster WHERE imei = ?', (imei,))
        existing = cursor.fetchone()
        first_seen_time = existing[0] if existing else current_time
        
        cursor.execute('''
            INSERT INTO devicemaster 
            (imei, name, hostname, ip, port, device_id, model, fw, 
             memory_usage, services, status, first_seen, last_seen)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'online', ?, ?)
            ON CONFLICT(imei) DO UPDATE SET
                name = excluded.name,
                hostname = excluded.hostname,
                ip = excluded.ip,
                port = excluded.port,
                device_id = excluded.device_id,
                model = excluded.model,
                fw = excluded.fw,
                memory_usage = excluded.memory_usage,
                services = excluded.services,
                status = 'online',
                last_seen = excluded.last_seen
        ''', (
            imei,
            device.get('name'),
            device.get('hostname'),
            device.get('ip'),
            device.get('port'),
            device.get('device_id'),
            device.get('model'),
            device.get('fw'),
            device.get('memory_usage'),
            services_json,
            first_seen_time,
            current_time
        ))
        
        conn.commit()
        if existing:
            print(f"[DB] Updated device with IMEI: {imei}")
        else:
            print(f"[DB] Added new device with IMEI: {imei}")
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
    
    # Parse services JSON for each device
    import json
    for device in device_list:
        try:
            services_json = device.get('services', '{}')
            if isinstance(services_json, str):
                services = json.loads(services_json)
            else:
                services = services_json
            
            # Convert services dict to proper format {service_name: port}
            formatted_services = {}
            for service_name, service_data in services.items():
                if isinstance(service_data, dict):
                    if service_data.get('status') == 'enabled':
                        formatted_services[service_name] = service_data.get('port')
                else:
                    # Fallback for old format
                    formatted_services[service_name] = service_data
            
            device['services'] = formatted_services
        except Exception as e:
            print(f"[API] Error parsing services for device {device.get('name')}: {e}")
            device['services'] = {}
    
    return jsonify(device_list)


@app.route('/api/device/update-name', methods=['POST'])
def update_device_name():
    """API endpoint to update device name"""
    data = request.get_json()
    
    device_imei = data.get('imei')  # Use IMEI as the unique identifier
    new_name = data.get('device_name', '').strip()
    
    if not device_imei:
        return jsonify({'success': False, 'error': 'Device IMEI required'}), 400
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        cursor.execute('''
            UPDATE devicemaster 
            SET device_name = ?
            WHERE imei = ?
        ''', (new_name, device_imei))
        
        conn.commit()
        return jsonify({'success': True})
    except Exception as e:
        print(f"[DB] Error updating device name: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500
    finally:
        conn.close()


@app.route('/api/device/delete', methods=['POST'])
def delete_device():
    """API endpoint to delete a device from database"""
    data = request.get_json()
    
    device_imei = data.get('imei')  # Use IMEI as the unique identifier
    
    if not device_imei:
        return jsonify({'success': False, 'error': 'Device IMEI required'}), 400
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        cursor.execute('DELETE FROM devicemaster WHERE imei = ?', (device_imei,))
        conn.commit()
        
        if cursor.rowcount > 0:
            return jsonify({'success': True})
        else:
            return jsonify({'success': False, 'error': 'Device not found'}), 404
    except Exception as e:
        print(f"[DB] Error deleting device: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500
    finally:
        conn.close()


@app.route('/api/refresh', methods=['POST'])
def api_refresh():
    """API endpoint to manually trigger mDNS query"""
    try:
        success = force_refresh()
        if success:
            return jsonify({'success': True, 'message': 'Active query sent for _cygnus._tcp.local.'})
        else:
            return jsonify({'success': False, 'error': 'mDNS service not initialized'}), 503
    except Exception as e:
        print(f"[API] Error triggering refresh: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


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
