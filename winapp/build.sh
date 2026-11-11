#!/bin/bash
# Builds build/Notes-Windows-x64.zip: an unzip-and-run Windows app (no Node needed to build).
# Needs the official Electron Windows zip; downloaded automatically if not given as $1.
set -euo pipefail
cd "$(dirname "$0")"
VER=v44.7.0
# Your own credentials (config.local.js, never committed) unless PUBLIC=1, for builds to share
CONFIG=../config.js
if [ -z "${PUBLIC:-}" ] && [ -f ../config.local.js ]; then CONFIG=../config.local.js; fi
ZIP=${1:-build/electron-win-x64.zip}
rm -rf build/Notes && mkdir -p build/Notes
if [ ! -f "$ZIP" ]; then
  curl -fL -o "$ZIP" https://github.com/electron/electron/releases/download/$VER/electron-$VER-win32-x64.zip
fi
unzip -q "$ZIP" -d build/Notes
mv build/Notes/electron.exe build/Notes/Notes.exe
rm -f build/Notes/resources/default_app.asar
APPDIR=build/Notes/resources/app
mkdir -p $APPDIR/web
cp main.js preload.js package.json $APPDIR/
cp ../index.html ../styles.css ../app.js ../planner.js ../blocks.js ../mindmap.js ../export.js ../media.js ../manifest.webmanifest $APPDIR/web/
cp -R ../icons $APPDIR/web/       # no sw.js: service workers aren't needed in the desktop app
cp $CONFIG $APPDIR/web/config.js
# The yellow Notes icon: an .ico for shortcuts, installer, window and tray, and inside Notes.exe itself
python3 -I winicon.py ico $APPDIR/notes.ico
python3 -I winicon.py exe build/Notes/Notes.exe
rm -f build/Notes-Windows-x64.zip
(cd build && zip -qr Notes-Windows-x64.zip Notes)
echo "Built build/Notes-Windows-x64.zip"

# Installer (Notes-Setup-x64.exe) when NSIS is available: `brew install makensis` / `apt install nsis`
if command -v makensis >/dev/null; then
  VERSION=$(sed -n 's/.*"version": *"\([^"]*\)".*/\1/p' package.json)
  makensis -V2 -DVERSION="$VERSION" installer.nsi
  echo "Built build/Notes-Setup-x64.exe"
else
  echo "Skipped the installer (makensis isn't installed)"
fi
