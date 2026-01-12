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

# 3. Set hostname (Yocto-safe way)
echo "$HOSTNAME" > /proc/sys/kernel/hostname
echo "$HOSTNAME" > /etc/hostname

# Optional: update hosts
sed -i "/127.0.1.1/d" /etc/hosts
echo "127.0.1.1 $HOSTNAME" >> /etc/hosts

# 4. Get IP address
IP_ADDR=$(ip route get 1 | awk '{print $7; exit}')
[ -z "$IP_ADDR" ] && IP_ADDR="0.0.0.0"

# 5. Firmware version
FW_VER=$(grep VERSION_ID /etc/os-release | cut -d= -f2 | tr -d '"')

# 6. Create Avahi service file
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
    <txt-record>device_id=$DEVICE_ID</txt-record>
    <txt-record>hostname=$HOSTNAME</txt-record>
    <txt-record>ip=$IP_ADDR</txt-record>
    <txt-record>fw=$FW_VER</txt-record>
    <txt-record>model=QCM2290</txt-record>
  </service>
</service-group>
EOF

# 7. Restart Avahi
systemctl restart avahi-daemon

# 8. Disable first-boot service
systemctl disable cygnus-provision.service
