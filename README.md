# Cygnus IoT Device Discovery

A Flask web application that automatically discovers Cygnus IoT devices on your local network using mDNS/Zeroconf and provides one-click access to their web interfaces.

## Features

- **Automatic Discovery**: Continuously scans for `_cygnus._tcp.local` services on the LAN
- **Real-time Updates**: Web UI updates automatically as devices join or leave the network
- **Device Information**: Displays hostname, IP address, IMEI, firmware version, and model
- **Quick Access**: One-click buttons to access device web apps on ports 5001, 5002, and 8081
- **No Database Required**: Maintains devices in memory
- **LAN-Only**: Designed for local network use with no cloud dependencies

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
- Start mDNS discovery in the background
- Listen for Cygnus IoT devices appearing and disappearing
- Update the web interface automatically (polls every 2 seconds)

## How It Works

1. **mDNS Discovery**: The Zeroconf library continuously monitors the network for services of type `_cygnus._tcp.local`
2. **Data Collection**: For each discovered device, extracts:
   - IP address from mDNS records
   - Hostname
   - TXT metadata: `imei`, `device_id`, `model`, `fw`
3. **Web Interface**: Flask serves a single-page application that polls `/api/devices` for the current device list
4. **Dynamic Updates**: As devices appear or disappear, the in-memory registry updates and the UI reflects changes

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
