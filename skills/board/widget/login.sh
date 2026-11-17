#!/bin/bash
# Start Pipeline Yard at login, as a menu bar icon only.
# Usage: login.sh on | off
set -euo pipefail

LABEL="local.pipeline-yard.widget"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
BINARY="$HOME/Applications/Pipeline Yard.app/Contents/MacOS/PipelineYard"
DOMAIN="gui/$(id -u)"

launchctl bootout "$DOMAIN/$LABEL" >/dev/null 2>&1 || true

if [ "${1:-on}" = "off" ]; then
  rm -f "$PLIST"
  echo "login start is off"
  exit 0
fi

mkdir -p "$HOME/Library/LaunchAgents"
cat > "$PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key><array><string>$BINARY</string></array>
  <key>RunAtLoad</key><true/>
  <key>ProcessType</key><string>Interactive</string>
</dict>
</plist>
PLIST

launchctl bootstrap "$DOMAIN" "$PLIST"
echo "login start is on"
