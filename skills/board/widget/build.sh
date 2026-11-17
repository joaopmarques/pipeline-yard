#!/bin/bash
# Build the Pipeline Yard desktop widget into ~/Applications.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
APP="$HOME/Applications/Pipeline Yard.app"

mkdir -p "$APP/Contents/MacOS"
cat > "$APP/Contents/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key><string>Pipeline Yard</string>
  <key>CFBundleDisplayName</key><string>Pipeline Yard</string>
  <key>CFBundleIdentifier</key><string>local.pipeline-yard.widget</string>
  <key>CFBundleExecutable</key><string>PipelineYard</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleShortVersionString</key><string>1.0</string>
  <key>LSMinimumSystemVersion</key><string>13.0</string>
  <key>LSUIElement</key><true/>
  <key>NSHighResolutionCapable</key><true/>
</dict>
</plist>
PLIST

swiftc -O -swift-version 5 -target arm64-apple-macosx13.0 -framework Cocoa -framework WebKit \
  -o "$APP/Contents/MacOS/PipelineYard" "$HERE/main.swift"
codesign --force --sign - "$APP" >/dev/null 2>&1
echo "built $APP"
