# Notes

A fast, private notes app and day planner for **Mac**, **Windows**, **iPhone** and the **web**, synced through **your own Google Drive**. No servers, no accounts with us, no tracking: your notes live on your devices and in a `Notes` folder in your Drive.

**Use it now:** [imranseoxpert.github.io/notes](https://imranseoxpert.github.io/notes/) · **Download:** [latest release](https://github.com/imranseoxpert/notes/releases/latest)

## Features

**Writing**
- Rich text: headings, bold / italic / underline / strikethrough, highlight, text colours, fonts and sizes, lists, checklists, quotes, code, links, dividers
- Lock a note with a password (encrypted on your device; a forgotten password can't be recovered)
- `/` block menu: callouts, toggles, tables, table of contents, embedded notes, sub-pages, task boards, templates
- `[[Note links]]` with backlinks, `#tags`, folders, favorites, trash, daily notes
- Markdown shortcuts (`#`, `-`, `1.`, `[]`, `>`) and Markdown / Obsidian / Joplin import
- Smart folders: saved searches (text, tag, folder, what's inside, recency) that fill themselves in the sidebar
- Word and character counts with reading time, in the editor's status bar
- Version history: earlier versions of each note, kept on the device as you write — view or restore any of them
- Merge two notes into one (links to the old note are updated for you)
- A note-link graph: every note a dot, every `[[link]]` a line — click a dot to open it
- Maths blocks: type `/math`, write LaTeX, see it rendered
- Evernote import: bring a whole `.enex` export, attachments and tags included

**Media**
- Photos, videos, PDFs (with preview), audio and any file: pick, paste or drop
- Record audio, take a photo, scan documents into a PDF, and draw sketches (pen, highlighter, eraser; mouse, trackpad, Apple Pencil or finger), right in a note
- Right-click a picture to save it, copy it (pastes into any app) or share it
- Search finds text inside your photos and scans, in English and Bengali, read on your device
- "Text from picture" turns a photo, scan or sketch in the note into typed text under it (handwriting too, when it's clear)
- Dictation: speak and it types (where the browser or OS offers speech recognition)
- Transcribe a recording in a note into text, on your device (a speech model downloads once, about 150 MB)

**Mind maps**
- Type `/mind map` to add a mind map to any note, or `/mind map from this note` to turn the note's headings and lists into one
- Full-screen editor: Tab adds a subtopic, Enter a topic, just type to rename (or tap a selected topic on a phone)
- Drag a topic anywhere and it stays connected; drop it onto another topic to move it there; undo and redo
- 16 colour themes, 9 structures (mind map, logic chart, org chart, tree, timeline, fishbone, radial…), line styles, backgrounds, topic colours and shapes, markers and stickers
- Maps live inside the note: they sync, work offline, show up in search, are encrypted in locked notes, and export as a picture (PDF, Word, HTML) or a list (Markdown, text). Save a map as PNG or SVG
- The engine comes from [Mindloom](https://github.com/imranseoxpert/mindloom)

**Planner**
- Today, Upcoming, Calendar (day / week / month), Tasks, Reminders and Events
- List, board (kanban) and grid views; priorities, subtasks, repeats, habits with streaks
- Natural-language quick add: `Call Anna tomorrow 5pm`, `Gym every weekday 7am`
- Reminder alarms: a top-right alert with sound on Mac and Windows, and in Notification Centre on Mac
- Two-way Google Calendar sync for events

**Everywhere**
- Sync through Google Drive (one file per note; attachments included); works offline and catches up later
- Share to Mail, Gmail, Outlook, Messages, WhatsApp, Telegram, X, Threads, LinkedIn, Facebook, Reddit, Bluesky, or the system share menu
- Export to PDF, Word (.docx), Markdown, HTML or text
- Publish a note to the web: a read-only page in your Drive with an "anyone with the link" address (unpublish any time)
- Web Clipper: a small Chrome / Edge extension (in `webclipper/`) that saves the page you're reading — or your selection — straight into Notes
- App lock: a password (or fingerprint / Face ID) asked when Notes opens on a device; locked notes can also be opened with fingerprint / Face ID where the device supports it (WebAuthn PRF)
- Quick capture: the installed app gets a "New note" shortcut, and on Windows Ctrl+Alt+N brings Notes up with a fresh note from anywhere
- Light, dark or system appearance

## Install

| Platform | How |
| --- | --- |
| **Mac** (Apple silicon) | Download `Notes.dmg` from the [latest release](https://github.com/imranseoxpert/notes/releases/latest), open it and drag Notes to Applications. The app isn't notarized by Apple, so the first time, right-click Notes → **Open** → **Open**. |
| **Windows** (64-bit) | Download `Notes-Setup-x64.exe` and run it: it installs Notes with Start Menu and desktop shortcuts (no admin rights needed; uninstall from Settings → Apps). If SmartScreen warns, choose **More info** → **Run anyway**. Prefer no installer? Unzip `Notes-Windows-x64.zip` and run `Notes.exe`. |
| **iPhone / iPad** | Open [the web app](https://imranseoxpert.github.io/notes/) in **Safari**, tap Share → **Add to Home Screen**. |
| **Any browser** | Open [the web app](https://imranseoxpert.github.io/notes/). |

## Turn on Google Drive sync

The Mac and Windows downloads from [Releases](https://github.com/imranseoxpert/notes/releases/latest) are ready to go: choose **Continue with Google** (or type your Google email) and your notes sync through your own Google Drive. Your data goes only between your devices and your Drive.

Building it yourself or running your own copy? Use your own free Google Cloud credentials: in the app, open the sidebar and choose **Set up Google Drive sync** (it tells you exactly what to create and lets you paste it in), or put them in `config.local.js`. The full walkthrough (about 15 minutes) is in [SETUP.md](SETUP.md). For release builds, the keys live in the repository's Actions secrets (`GOOGLE_DESKTOP_CLIENT_ID`, `GOOGLE_DESKTOP_CLIENT_SECRET`, `GOOGLE_WEB_CLIENT_ID`), never in the source.

The app only asks for the `drive.file` permission: it can see the files it created, never the rest of your Drive.

## Build from source

Everything is plain HTML, CSS and JavaScript; the desktop apps are thin native wrappers.

```bash
# Run the web app locally
python3 -m http.server 5173        # then open http://localhost:5173

# Mac app and disk image (needs the Xcode command line tools)
bash macapp/build.sh               # → macapp/build/Notes.app, Notes.dmg

# Windows app (downloads the Electron runtime; builds on Mac or Linux too)
bash winapp/build.sh               # → winapp/build/Notes-Windows-x64.zip, plus Notes-Setup-x64.exe if NSIS is installed

# Web app folder to host anywhere
bash webapp/build.sh               # → webapp/build/notes-web
```

Put your own Google credentials in `config.local.js` (same format as [`config.js`](config.js); it's git-ignored) and the build scripts use it. `PUBLIC=1` builds without it.

| Folder / file | What it is |
| --- | --- |
| `index.html`, `styles.css` | The app's page and styles |
| `app.js` | Notes, editor, sidebar, Google sign-in and Drive / Calendar sync |
| `planner.js` | Today, Upcoming, Calendar, Tasks, Reminders, Events, quick add, alarms |
| `blocks.js` | `/` menu, attachments, note links, tables, boards, templates, Markdown import |
| `mindmap.js` | Mind map blocks and their full-screen editor (engine from [Mindloom](https://github.com/imranseoxpert/mindloom)) |
| `media.js` | Record audio, take photo, scan documents, sketch, and the Share sheet |
| `export.js` | PDF, Word, Markdown, HTML and text export |
| `macapp/` | Mac app (Swift + WKWebView): sign-in, notifications, alarms, files, PDF, sharing |
| `winapp/` | Windows app (Electron): sign-in, tray, alarms, PDF, clipboard |
| `webapp/` | Builds the folder for GitHub Pages / any static host |

Releases are built by GitHub Actions: push a tag like `v1.1.0` and the Mac, Windows and web packages appear on the Releases page. Every push to `main` updates the web app.

## Privacy

There's no backend. Notes are stored in your browser / app storage and, if you turn on sync, as files in your own Google Drive. Your notes aren't sent anywhere else. Notes in Drive are not end-to-end encrypted, except the text of notes you lock.

**Locked notes:** the text is encrypted on your device (AES-256-GCM, with a key made from your password by PBKDF2) before it's saved or synced. The first line stays visible as the title, and photos, recordings and files in a locked note are hidden in the app but not encrypted. Drive may keep older unencrypted revisions of a note for a while after you lock it.

**Text in pictures:** the reader is the open-source [Tesseract](https://github.com/naptha/tesseract.js). Your pictures stay on your device, but the reader and its language data (a few MB) download once from the public [jsDelivr](https://www.jsdelivr.com/) CDN, which can see that request like any website.

## Contributors

| | Contributor | Role |
| --- | --- | --- |
| <img src="https://github.com/imranseoxpert.png" width="40"> | [**imranseoxpert**](https://github.com/imranseoxpert) | Creator and maintainer |
| <img src="https://github.com/claude.png" width="40"> | [**Claude**](https://github.com/claude) (Anthropic) | Contributor: app code, desktop wrappers, sync, builds |
| | **Muse** (Meta) | Contributor |

## License

[MIT](LICENSE)
