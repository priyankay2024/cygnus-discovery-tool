# Cygnus IoT Device Discovery

A Flask web application that automatically discovers Cygnus IoT devices on your local network using mDNS/Zeroconf and provides one-click access to their web interfaces.

## Features

- **Enhanced Active Discovery**: Continuously queries the network every 10 seconds for devices
- **Robust Device Detection**: Multiple retry attempts with timeout handling
- **Real-time Updates**: Web UI updates automatically as devices join or leave the network
- **Stale Device Cleanup**: Automatically removes devices not seen in 60 seconds
- **Device Information**: Displays hostname, IP address, IMEI, firmware version, and model
- **Quick Access**: One-click buttons to access device web apps on ports 5001, 5002, and 8081
- **No Database Required**: Maintains devices in memory
- **LAN-Only**: Designed for local network use with no cloud dependencies
- **Modern UI**: Clean dashboard with Cards and List view options

## Requirements

- Python 3.7+
- Flask
- Zeroconf

## Installation

1. Install dependencies:
```bash
pip install -r requirements.txt
```

## Usage

Run the application:
```bash
python app.py
```

The web interface will be available at: **http://localhost:5000**

The application will:
- Start enhanced mDNS discovery with active querying
- Query network every 10 seconds for new devices
- Retry failed device queries up to 3 times
- Remove stale devices after 60 seconds of inactivity
- Update the web interface automatically (polls every 5 seconds)

## Enhanced Discovery Features

### Active Querying
The mDNS service now actively queries the network every 10 seconds instead of only listening passively. This ensures devices are discovered even if their initial announcement was missed.

### Retry Mechanism
Failed device queries are retried up to 3 times with 500ms delays, ensuring transient network issues don't prevent discovery.

### Stale Device Cleanup
Devices that haven't responded in 60 seconds are automatically removed from the list, keeping the interface clean.

### Better Error Handling
All network operations include comprehensive error handling and logging with `[mDNS]` prefixes for easy troubleshooting.

## How It Works

1. **Enhanced mDNS Discovery**: The Zeroconf library actively queries for services of type `_cygnus._tcp.local` every 10 seconds
2. **Retry Logic**: Each device query is attempted up to 3 times with proper timeouts
3. **Data Collection**: For each discovered device, extracts:
   - IP address from mDNS records (IPv4 preferred)
   - Hostname
   - TXT metadata: `imei`, `device_id`, `model`, `fw`
4. **Web Interface**: Flask serves a responsive single-page application with Cards and List views
5. **Dynamic Updates**: As devices appear or disappear, the in-memory registry updates and the UI reflects changes

## API Endpoints

- `GET /` - Main web interface
- `GET /api/devices` - JSON list of discovered devices

## Cygnus Device Requirements

For devices to be discovered, they must:
- Advertise an mDNS service of type `_cygnus._tcp.local`
- Include TXT records with metadata:
  - `imei` - Device IMEI number
  - `device_id` - Unique device identifier
  - `model` - Device model
  - `fw` - Firmware version

## Network Configuration

- The Flask server binds to `0.0.0.0:5000` (accessible from any interface)
- All discovered devices must be on the same LAN subnet
- No firewall configuration needed for discovery (uses multicast DNS)

## Troubleshooting

**No devices appearing:**
- Ensure devices are powered on and connected to the network
- Verify devices are advertising `_cygnus._tcp.local` services
- Check that your PC and devices are on the same subnet
- On Windows, ensure network profile is set to "Private" (not Public)

**Can't access device web apps:**
- Verify the device's web servers are running on ports 5001, 5002, 8081
- Check firewall settings on both server and devices
- Ensure there are no network routing issues

## License

This is a custom application for Cygnus IoT device management.
