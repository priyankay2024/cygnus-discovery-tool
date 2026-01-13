"""
Cygnus IoT Device Discovery and Management
Flask application with mDNS/Zeroconf discovery
"""
from flask import Flask, render_template, jsonify
import threading
import time
from mdns_service import start_discovery, get_devices

app = Flask(__name__)


@app.route('/')
def index():
    """Render main dashboard"""
    return render_template('index.html')


@app.route('/api/devices')
def api_devices():
    """API endpoint to get current device list"""
    device_list = sorted(get_devices(), key=lambda x: x.get('hostname', ''))
    return jsonify(device_list)


def run_flask():
    """Run Flask application"""
    app.run(host='0.0.0.0', port=5000, debug=False, use_reloader=False)


if __name__ == '__main__':
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
    print("Press Ctrl+C to stop")
    print("="*60 + "\n")
    
    # Run Flask app in main thread
    run_flask()
