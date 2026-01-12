cat << 'EOF' > /etc/init.d/avahi-daemon
#!/bin/sh

case "$1" in
  start)
    avahi-daemon --daemonize
    ;;
  stop)
    pkill avahi-daemon
    ;;
  restart)
    pkill avahi-daemon
    sleep 1
    avahi-daemon --daemonize
    ;;
esac
EOF

chmod +x /etc/init.d/avahi-daemon
