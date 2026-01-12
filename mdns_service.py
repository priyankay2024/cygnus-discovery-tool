"""
mDNS/Zeroconf Service Discovery Module
Separate service for discovering Cygnus IoT devices on the network
"""
import socket
import threading
import time
from zeroconf import Zeroconf, ServiceBrowser, ServiceListener

# Global device registry
_devices = {}
_devices_lock = threading.Lock()


class CygnusListener(ServiceListener):
    """Listener for Cygnus IoT devices on the network"""
    
    def __init__(self, zeroconf):
        self.zeroconf = zeroconf
    
    def add_service(self, zc, service_type, name):
        """Called when a new service is discovered"""
        info = zc.get_service_info(service_type, name)
        if info:
            self._process_service(name, info, added=True)
    
    def remove_service(self, zc, service_type, name):
        """Called when a service is removed"""
        with _devices_lock:
            if name in _devices:
                print(f"Device removed: {name}")
                del _devices[name]
    
    def update_service(self, zc, service_type, name):
        """Called when a service is updated"""
        info = zc.get_service_info(service_type, name)
        if info:
            self._process_service(name, info, added=False)
    
    def _process_service(self, name, info, added=True):
        """Process discovered service information"""
        # Extract IP address
        ip_address = None
        if info.addresses:
            print("addresses:", info.addresses)
            ip_address = socket.inet_ntoa(info.addresses[0])
        
        # Extract TXT records
        txt_records = {}
        if info.properties:
            for key, value in info.properties.items():
                print("key,value:", key, value)
                try:
                    txt_records[key.decode('utf-8')] = value.decode('utf-8')
                except:
                    pass
        
        # Build device info
        device_info = {
            'name': name,
            'hostname': info.server if info.server else name,
            'ip': txt_records.get('ip'),
            'port': info.port,
            'imei': txt_records.get('imei', 'N/A'),
            'device_id': txt_records.get('device_id', 'N/A'),
            'model': txt_records.get('model', 'N/A'),
            'fw': txt_records.get('fw', 'N/A'),
            'last_seen': time.time()
        }
        
        with _devices_lock:
            _devices[name] = device_info
            action = "discovered" if added else "updated"
            print(f"Device {action}: {name} at {ip_address}")
            print(f"Total devices in registry: {len(_devices)}")
            print(f"All device names: {list(_devices.keys())}")


def start_discovery():
    """Start mDNS service discovery in background thread"""
    zeroconf = Zeroconf()
    listener = CygnusListener(zeroconf)
    browser = ServiceBrowser(zeroconf, "_cygnus._tcp.local.", listener)
    
    print("Started mDNS discovery for _cygnus._tcp.local services...")
    
    # Keep the browser alive
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        pass
    finally:
        zeroconf.close()


def get_devices():
    """Get the current list of discovered devices"""
    with _devices_lock:
        return list(_devices.values())
