#!/bin/bash
# Builds build/Notes.app from the web files in the parent folder.
set -euo pipefail
cd "$(dirname "$0")"
APP=build/Notes.app
# Your own credentials (config.local.js, never committed) unless PUBLIC=1, for builds to share
CONFIG=../config.js
if [ -z "${PUBLIC:-}" ] && [ -f ../config.local.js ]; then CONFIG=../config.local.js; fi
rm -rf build && mkdir -p $APP/Contents/MacOS $APP/Contents/Resources/web
swiftc -O -target arm64-apple-macos12 main.swift loopback.swift reminders.swift alarm.swift pdf.swift -o $APP/Contents/MacOS/Notes
cp Info.plist $APP/Contents/
cp alarm.wav $APP/Contents/Resources/
cp ../index.html ../styles.css ../app.js ../planner.js ../blocks.js ../mindmap.js ../export.js ../media.js ../sw.js ../manifest.webmanifest $APP/Contents/Resources/web/
cp -R ../icons $APP/Contents/Resources/web/
cp $CONFIG $APP/Contents/Resources/web/config.js
swiftc icon.swift -o build/icon && build/icon build/AppIcon.iconset
iconutil -c icns build/AppIcon.iconset -o $APP/Contents/Resources/AppIcon.icns
codesign --force --deep -s - $APP
echo "Built $APP"

# Disk image with an Applications shortcut for drag-to-install
rm -rf build/dmg && mkdir build/dmg
cp -R $APP build/dmg/
ln -s /Applications build/dmg/Applications
hdiutil create -volname "Notes" -srcfolder build/dmg -ov -format UDZO build/Notes.dmg >/dev/null
echo "Built build/Notes.dmg"
