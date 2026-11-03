#!/bin/bash
# Builds build/notes-web/: the website / iPhone Home Screen app, ready to upload to any static https host
# (GitHub Pages, Netlify, Cloudflare Pages). Its config.js carries only the Web client ID: the Mac / Windows
# Desktop client secret stays out of anything published.
set -euo pipefail
cd "$(dirname "$0")"
OUT=build/notes-web
rm -rf build && mkdir -p $OUT
cp ../index.html ../styles.css ../app.js ../planner.js ../blocks.js ../export.js ../media.js ../sw.js ../manifest.webmanifest $OUT/
cp -R ../icons $OUT/
CONFIG=../config.js; [ -f ../config.local.js ] && CONFIG=../config.local.js
WEB_ID=$(sed -n "s/.*googleWebClientId: *'\([^']*\)'.*/\1/p" $CONFIG)
printf "window.NOTES_CONFIG = { googleWebClientId: '%s' };\n" "$WEB_ID" > $OUT/config.js
touch $OUT/.nojekyll                          # GitHub Pages: serve the files as they are
(cd build && zip -qr Notes-iPhone-Web.zip notes-web)
echo "Built build/notes-web (Web client ID: ${WEB_ID:-not set yet})"
