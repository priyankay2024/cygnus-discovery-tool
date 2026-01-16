"""
mDNS/Zeroconf Service Discovery Module
Separate service for discovering Cygnus IoT devices on the network
Enhanced with active querying and periodic refresh
"""
import socket
import threading
import time
from zeroconf import Zeroconf, ServiceBrowser, ServiceListener, ServiceStateChange, InterfaceChoice

# Global device registry
_devices = {}
_devices_lock = threading.Lock()
_zeroconf = None
_service_type = "_cygnus._tcp.local."

# Configuration
QUERY_INTERVAL = 30  # Query every 30 seconds for new devices
STALE_DEVICE_TIMEOUT = 120  # Remove devices not seen in 120 seconds(2min)
QUERY_TIMEOUT = 3000  # 3 seconds timeout for service info queries


class CygnusListener(ServiceListener):
    """Listener for Cygnus IoT devices on the network"""
    
    def __init__(self, zeroconf):
        self.zeroconf = zeroconf
    
    def add_service(self, zc, service_type, name):
        """Called when a new service is discovered"""
        print(f"[mDNS] Service discovered: {name}")
        self._query_service_info(zc, service_type, name, added=True)
    
    def remove_service(self, zc, service_type, name):
        """Called when a service is removed"""
        with _devices_lock:
            if name in _devices:
                print(f"[mDNS] Device removed: {name}")
                del _devices[name]
    
    def update_service(self, zc, service_type, name):
        """Called when a service is updated"""
        print(f"[mDNS] Service updated: {name}")
        self._query_service_info(zc, service_type, name, added=False)
    
    def _query_service_info(self, zc, service_type, name, added=True, retry_count=3):
        """Query service info with retries"""
        for attempt in range(retry_count):
            try:
                info = zc.get_service_info(service_type, name, timeout=QUERY_TIMEOUT)
                if info:
                    self._process_service(name, info, added=added)
                    return
                else:
                    print(f"[mDNS] No info for {name}, attempt {attempt + 1}/{retry_count}")
                    time.sleep(0.5)
            except Exception as e:
                print(f"[mDNS] Error querying {name} (attempt {attempt + 1}/{retry_count}): {e}")
                time.sleep(0.5)
        
        print(f"[mDNS] Failed to get info for {name} after {retry_count} attempts")
    
    def _process_service(self, name, info, added=True):
        """Process discovered service information"""
        try:
            # Extract IP address
            ip_address = None
            if info.addresses:
                # Try to get IPv4 address (4 bytes)
                for addr in info.addresses:
                    if len(addr) == 4:
                        ip_address = socket.inet_ntoa(addr)
                        break
                    elif len(addr) == 16:
                        # IPv6 - skip for now or convert
                        continue
            
            # Extract TXT records
            txt_records = {}
            if info.properties:
                for key, value in info.properties.items():
                    try:
                        key_str = key.decode('utf-8') if isinstance(key, bytes) else str(key)
                        value_str = value.decode('utf-8') if isinstance(value, bytes) else str(value)
                        txt_records[key_str] = value_str
                    except Exception as e:
                        print(f"[mDNS] Error decoding TXT record: {e}")
            
            # Build device info
            device_info = {
                'name': name,
                'hostname': info.server.rstrip('.') if info.server else name,
                'ip': txt_records.get('ip', ip_address),  # Prefer TXT record IP, fallback to resolved
                'port': info.port,
                'imei': txt_records.get('imei', 'N/A'),
                'device_id': txt_records.get('device_id', 'N/A'),
                'model': txt_records.get('model', 'N/A'),
                'fw': txt_records.get('fw', 'N/A'),
                'memory_usage': txt_records.get('memory_usage', 'N/A'),
                'bacnet_status': txt_records.get('bacnet', 'disabled'),
                'tor_modbus_status': txt_records.get('tor-modbus', 'disabled'),
                'tor_serial2tcp_status': txt_records.get('tor-serial2tcp', 'disabled'),
                'opcua_status': txt_records.get('opcua', 'disabled'),
                'openplc_status': txt_records.get('openplc', 'disabled'),
                'cygmin_status': txt_records.get('cygmin', 'disabled'),
                'last_seen': time.time()
            }
            
            with _devices_lock:
                _devices[name] = device_info
                action = "discovered" if added else "updated"
                print(f"[mDNS] Device {action}: {name} at {device_info['ip']}")
                print(f"[mDNS] Total devices: {len(_devices)}")
        
        except Exception as e:
            print(f"[mDNS] Error processing service {name}: {e}")


def active_query_loop(zeroconf):
    """Actively query for services periodically"""
    print(f"[mDNS] Starting active query loop (interval: {QUERY_INTERVAL}s)")
    
    while True:
        try:
            # Force a new query for all services
            print(f"[mDNS] Sending active query for {_service_type}...")
            
            # Query all cached services and refresh them
            service_names = list(zeroconf.cache.entries_with_name(_service_type.lower()))
            if service_names:
                print(f"[mDNS] Found {len(service_names)} cached services, refreshing...")
            
            time.sleep(QUERY_INTERVAL)
            
        except Exception as e:
            print(f"[mDNS] Error in active query loop: {e}")
            time.sleep(5)


def cleanup_stale_devices():
    """Remove devices that haven't been seen recently"""
    print(f"[mDNS] Starting stale device cleanup (timeout: {STALE_DEVICE_TIMEOUT}s)")
    
    while True:
        try:
            time.sleep(60)  # Check every 60 seconds
            current_time = time.time()
            
            with _devices_lock:
                stale_devices = [
                    name for name, info in _devices.items()
                    if current_time - info['last_seen'] > STALE_DEVICE_TIMEOUT
                ]
                
                for name in stale_devices:
                    print(f"[mDNS] Removing stale device: {name}")
                    del _devices[name]
                
                if stale_devices:
                    print(f"[mDNS] Cleaned up {len(stale_devices)} stale device(s)")
                    print(f"[mDNS] Active devices: {len(_devices)}")
        
        except Exception as e:
            print(f"[mDNS] Error in cleanup loop: {e}")
            time.sleep(10)


def start_discovery():
    """Start mDNS service discovery in background thread"""
    global _zeroconf
    
    try:
        # Create Zeroconf instance with better configuration
        _zeroconf = Zeroconf(interfaces=InterfaceChoice.All)  # Listen on all interfaces
        
        # Create listener and browser
        listener = CygnusListener(_zeroconf)
        browser = ServiceBrowser(_zeroconf, _service_type, listener)
        
        print(f"[mDNS] Started discovery for {_service_type}")
        print(f"[mDNS] Listening on all network interfaces")
        
        # Start active query thread
        query_thread = threading.Thread(target=active_query_loop, args=(_zeroconf,), daemon=True)
        query_thread.start()
        
        # Start cleanup thread
        # cleanup_thread = threading.Thread(target=cleanup_stale_devices, daemon=True)
        # cleanup_thread.start()
        
        # Keep the browser alive
        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            print("\n[mDNS] Shutting down discovery service...")
    
    except Exception as e:
        print(f"[mDNS] Critical error starting discovery: {e}")
    
    finally:
        if _zeroconf:
            _zeroconf.close()
            print("[mDNS] Discovery service stopped")


def get_devices():
    """Get the current list of discovered devices"""
    with _devices_lock:
        # Return a copy of the device list
        return [dict(device) for device in _devices.values()]
