# Notes

A fast, private notes app and day planner for **Mac**, **Windows**, **iPhone** and the **web**, synced through **your own Google Drive**. No servers, no accounts with us, no tracking: your notes live on your devices and in a `Notes` folder in your Drive.

**Use it now:** [imranseoxpert.github.io/notes](https://imranseoxpert.github.io/notes/) · **Download:** [latest release](https://github.com/imranseoxpert/notes/releases/latest)

## Features

**Writing**
- Rich text: headings, bold / italic / underline / strikethrough, highlight, lists, checklists, quotes, code, links, dividers
- `/` block menu: callouts, toggles, tables, table of contents, embedded notes, sub-pages, task boards, templates
- `[[Note links]]` with backlinks, `#tags`, folders, favorites, trash, daily notes
- Markdown shortcuts (`#`, `-`, `1.`, `[]`, `>`) and Markdown / Obsidian / Joplin import

**Media**
- Photos, videos, PDFs (with preview), audio and any file: pick, paste or drop
- Record audio, take a photo, scan documents into a PDF, and draw sketches, right in a note
- Right-click a picture to save it, copy it (pastes into any app) or share it

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
- Light, dark or system appearance

## Install

| Platform | How |
| --- | --- |
| **Mac** (Apple silicon) | Download `Notes.dmg` from the [latest release](https://github.com/imranseoxpert/notes/releases/latest), open it and drag Notes to Applications. The app isn't notarized by Apple, so the first time, right-click Notes → **Open** → **Open**. |
| **Windows** (64-bit) | Download `Notes-Windows-x64.zip`, unzip it and run `Notes.exe`. If SmartScreen warns, choose **More info** → **Run anyway**. |
| **iPhone / iPad** | Open [the web app](https://imranseoxpert.github.io/notes/) in **Safari**, tap Share → **Add to Home Screen**. |
| **Any browser** | Open [the web app](https://imranseoxpert.github.io/notes/). |

## Turn on Google Drive sync

Sync uses **your own** free Google Cloud credentials, so your data goes only between your devices and your Drive. In the app, open the sidebar and choose **Set up Google Drive sync**: it tells you exactly what to create and lets you paste it in. The full walkthrough (about 15 minutes) is in [SETUP.md](SETUP.md).

The app only asks for the `drive.file` permission: it can see the files it created, never the rest of your Drive.

## Build from source

Everything is plain HTML, CSS and JavaScript; the desktop apps are thin native wrappers.

```bash
# Run the web app locally
python3 -m http.server 5173        # then open http://localhost:5173

# Mac app and disk image (needs the Xcode command line tools)
bash macapp/build.sh               # → macapp/build/Notes.app, Notes.dmg

# Windows app (downloads the Electron runtime; builds on Mac or Linux too)
bash winapp/build.sh               # → winapp/build/Notes-Windows-x64.zip

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
| `media.js` | Record audio, take photo, scan documents, sketch, and the Share sheet |
| `export.js` | PDF, Word, Markdown, HTML and text export |
| `macapp/` | Mac app (Swift + WKWebView): sign-in, notifications, alarms, files, PDF, sharing |
| `winapp/` | Windows app (Electron): sign-in, tray, alarms, PDF, clipboard |
| `webapp/` | Builds the folder for GitHub Pages / any static host |

Releases are built by GitHub Actions: push a tag like `v1.1.0` and the Mac, Windows and web packages appear on the Releases page. Every push to `main` updates the web app.

## Privacy

There's no backend. Notes are stored in your browser / app storage and, if you turn on sync, as files in your own Google Drive. Nothing is sent anywhere else. Notes in Drive are not end-to-end encrypted.

## License

[MIT](LICENSE)
