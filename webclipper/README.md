# Notes Web Clipper (Chrome / Edge extension)

Save the page you are reading — or just the text you selected — into Notes. The clipper writes one note
file into the **Notes** folder in your Google Drive, in exactly the format the Notes app syncs, so the
clipped page appears in Notes on every device at the next sync. There is no server in between, and the
only permission it uses is `drive.file` (files it creates itself).

## Install (unpacked)

1. Open `chrome://extensions` (Edge: `edge://extensions`) and turn on **Developer mode**.
2. Click **Load unpacked** and choose this `webclipper` folder.
3. The extension's ID is fixed by the key in `manifest.json`:
   `mkdjcpghieepgnghgmhpomnnhmmlnnak` — the Google sign-in client is registered for this ID, so anyone
   loading this exact folder gets working sign-in.

## Use

Click the extension button on any page → **Sign in with Google** (first time) → **Save this page as a
note**, or select text first and use **Save selection only**. Pictures stay as links to the original
images; the note ends with a "Clipped from" source link.

## Sign-in setup (already done for the Notes project)

The `oauth2.client_id` in `manifest.json` is an OAuth client of type **Chrome Extension** in the Notes
Google Cloud project, registered with this extension's ID. If you fork this with a different `key` (and
therefore a different ID), create your own such client and put its ID in `manifest.json`.
