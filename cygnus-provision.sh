#!/bin/sh
set -e

IMEI_FILE="/data/deviceinfo/imei.txt"

# 1. Read IMEI
if [ -f "$IMEI_FILE" ] && [ -s "$IMEI_FILE" ]; then
    IMEI=$(tr -d '[:space:]' < "$IMEI_FILE")
else
    IMEI="000000000000000"
fi

# 2. Last 6 digits
DEVICE_ID=$(echo "$IMEI" | tail -c 7)
HOSTNAME="cygnus-$DEVICE_ID"

# 3. Check current hostname and only update if it's qcm2290
CURRENT_HOSTNAME=$(cat /etc/hostname | tr -d '[:space:]')
if [ "$CURRENT_HOSTNAME" = "qcm2290" ]; then
    # Set hostname (Yocto-safe way)
    echo "$HOSTNAME" > /proc/sys/kernel/hostname
    echo "$HOSTNAME" > /etc/hostname
    
    # Optional: update hosts
    sed -i "/127.0.1.1/d" /etc/hosts
    echo "127.0.1.1 $HOSTNAME" >> /etc/hosts
else
    # Use existing hostname instead of generating new one
    HOSTNAME="$CURRENT_HOSTNAME"
fi

# 4. Get IP address
IP_ADDR=$(ip route get 1 | awk '{print $7; exit}')
[ -z "$IP_ADDR" ] && IP_ADDR="0.0.0.0"

# 5. Firmware version
FW_VER=$(grep VERSION_ID /etc/os-release | cut -d= -f2 | tr -d '"')

# 6. Get memory usage
MEMORY_TOTAL=$(free | awk '/Mem:/ {print $2}')
MEMORY_USED=$(free | awk '/Mem:/ {print $3}')
MEMORY_USAGE=$(awk "BEGIN {printf \"%.1f\", ($MEMORY_USED/$MEMORY_TOTAL)*100}")

# 7. Read services from cygnus-protocol-services.conf
CONFIG_FILE="/etc/cygnus-protocol-services.conf"
[ ! -f "$CONFIG_FILE" ] && CONFIG_FILE="/usr/local/etc/cygnus-protocol-services.conf"

# Function to check service enabled status
check_service_enabled() {
    if systemctl is-enabled "$1" >/dev/null 2>&1; then
        echo "enabled"
    else
        echo "disabled"
    fi
}

# Extract unique service names and their ports from config file
SERVICE_RECORDS=""
if [ -f "$CONFIG_FILE" ]; then
    # Get unique service names from config
    SERVICES=$(grep "\.port=" "$CONFIG_FILE" | cut -d'.' -f1 | sort -u)
    
    for service in $SERVICES; do
        # Get port for this service
        PORT=$(grep "^${service}\.port=" "$CONFIG_FILE" | cut -d'=' -f2)
        STATUS=$(check_service_enabled "$service")
        
        # Build txt-record entry
        if [ -n "$PORT" ] && [ "$PORT" != "" ]; then
            SERVICE_RECORDS="${SERVICE_RECORDS}    <txt-record>${service}:${PORT}=${STATUS}</txt-record>\n"
        fi
    done
fi

CYGMIN_STATUS=$(check_service_enabled "cygmin")

# 8. Create Avahi service file
cat <<EOF > /etc/avahi/services/cygnus.service
<?xml version="1.0" standalone='no'?>
<!DOCTYPE service-group SYSTEM "avahi-service.dtd">
<service-group>
  <name replace-wildcards="yes">$HOSTNAME</name>

  <service>
    <type>_http._tcp</type>
    <port>80</port>
  </service>

  <service>
    <type>_cygnus._tcp</type>
    <port>8080</port>
    <txt-record>imei=$IMEI</txt-record>
    <txt-record>hostname=$HOSTNAME</txt-record>
    <txt-record>ip=$IP_ADDR</txt-record>
    <txt-record>model=QCM2290</txt-record>
    <txt-record>memory_usage=$MEMORY_USAGE%</txt-record>
    <txt-record>cygmin=$CYGMIN_STATUS</txt-record>
$(printf "$SERVICE_RECORDS")
  </service>
</service-group>
EOF

# 9. Restart Avahi
killall avahi-daemon 2>/dev/null || true
sleep 2
avahi-daemon --daemonize

# 10. Disable first-boot service
systemctl disable cygnus-provision.service
