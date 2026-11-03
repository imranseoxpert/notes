# Google Drive sync: setup

Notes are saved as small files in a **Notes** folder in your Google Drive. Sign in with Google (or type your Google email) in the Mac app, the Windows app, or the website / iPhone Home Screen app, and the same notes appear everywhere.

You do this once. About 15 minutes, free.

## 1. Create a Google Cloud project
1. Go to console.cloud.google.com and create a project (any name, e.g. "Notes").
2. **APIs & Services → Library** → search **Google Drive API** → **Enable**.

## 2. Consent screen
1. **APIs & Services → OAuth consent screen** (may be called "Google Auth Platform → Branding/Audience").
2. User type **External**. Fill in the app name (Notes) and your email.
3. **Scopes**: add `.../auth/drive.file` plus the basic `openid`, `email`, `profile`. `drive.file` is a limited scope: the app can only see files *it* created, never the rest of your Drive.
4. **Publishing status**: click **Publish app** (to "In production"). Without this, Google signs you out every 7 days. Because the scopes are limited you do not need a Google review for personal use. You may see an "unverified app" warning when signing in. Choose **Advanced → Go to Notes**.
   (If you prefer to stay in "Testing", add your own Gmail under **Test users**, and expect to sign in again weekly.)

## 3. Create two OAuth clients (same project)
**APIs & Services → Credentials → Create credentials → OAuth client ID**

1. **Desktop app** → name "Notes desktop". Copy the **Client ID** and **Client secret**.
   Used by the Mac and Windows apps. Google does not treat a Desktop client's secret as confidential.
2. **Web application** → name "Notes web". Under **Authorized JavaScript origins** add the address where you host the website (for example `https://yourname.github.io`), and under **Authorized redirect URIs** the app's full address (for example `https://yourname.github.io/notes/`, with the final `/`). Copy the **Client ID**.
   Used by the website and the iPhone Home Screen app. The app shows both addresses under **Set up Google Drive sync**, and you can paste the Client ID there instead of editing `config.js`.

Paste them into the app (sidebar → **Set up Google Drive sync**), or, for your own builds, put them in `config.local.js` (same format as `config.js`, never committed; the build scripts use it):

```js
window.NOTES_CONFIG = {
  googleWebClientId: '1234-web.apps.googleusercontent.com',
  googleDesktopClientId: '1234-desktop.apps.googleusercontent.com',
  googleDesktopClientSecret: 'GOCSPX-...'
};
```

## 4. Rebuild and install
- **Mac:** `macapp/build.sh`, then install `macapp/build/Notes.dmg`.
- **Windows:** `winapp/build.sh`, then use `winapp/build/Notes-Windows-x64.zip`.
- **iPhone / website:** run `webapp/build.sh`, upload the `webapp/build/notes-web` folder to a static https host (GitHub Pages, Netlify, Cloudflare Pages), open it in **Safari** on the iPhone, then Share → **Add to Home Screen**. That folder never contains the Desktop client secret.

Open any of them and choose **Continue with Google** (or type your Google email and choose **Continue with email**).

## How it behaves
- Notes are kept on each device first, so everything works offline and syncs when you reconnect.
- Changes upload about 1.5 seconds after you stop typing. Other devices pick them up within about 30 seconds, or immediately when you switch back to the app.
- If the same note is edited on two devices, the most recent edit wins for that note.
- Deleting a note forever moves its Drive file to the Drive trash, and other devices remove it too.
- In Drive you will see one file per note (named after its title) plus `_folders.json`. Please don't rename or move them by hand. Edit notes in the app.
- Signing out removes the local copy from that device. Your notes stay in Drive.

## Good to know
- The Mac and Windows apps open your normal browser to sign in, then return to the app. Google blocks sign-in inside embedded windows, so this is the intended way.
- Notes in Drive are plain JSON/HTML, readable by you and anyone you share the folder with. They are not end-to-end encrypted.
- The Desktop and Web clients are two OAuth clients in one project. If the iPhone and the computers don't see each other's notes, tell me and I'll switch both to a single client.

## Google Calendar sync (optional)
Your events can sync both ways with your main Google Calendar. One-time setup in the same Google Cloud project:
1. **APIs & Services → Library** → search **Google Calendar API** → **Enable**.
2. **Google Auth Platform → Data Access → Add or remove scopes** → tick `.../auth/calendar.events` → **Update** → **Save**.
3. In Notes, open **Calendar** or **Events** and click **Connect Google Calendar**. Your browser opens; allow the calendar permission (tick the box if Google shows one).

How it behaves:
- Events you create in Notes appear in Google Calendar (with their reminder), and events from Google Calendar (from 30 days ago onwards) appear in Notes, including Google Meet links.
- Edits and deletes go both ways. If the same event is changed in both places before a sync, the Notes version wins.
- Repeats: daily, weekdays, weekly, monthly and yearly sync fully. Other rules (for example every 2 weeks) are kept untouched in Google but show only on their first date in Notes. A single changed occurrence of a repeating Google event isn't shown yet.
- Birthdays, focus time and working-location entries are skipped. Tasks are not sent to Google Calendar.
- `calendar.events` is a "sensitive" scope: Google shows the "unverified app" screen when you connect. That is expected for a personal app. Click **Advanced → Go to Notes**.

## Reminder alerts
- **Mac:** reminders are handed to macOS, so they fire even when Notes is closed. They appear at the top right and stay in Notification Centre, with **Mark as done**, **Snooze 10 min** and **Open**. For alerts that stay on screen until you act, set **System Settings → Notifications → Notes → Alert style: Alerts** (Notes asks for this by default).
- **Windows:** each reminder appears in the notification centre and as an always-on-top card in the top-right corner of the screen, with a chime, until you choose Open, Done, Snooze or ✕. Keep Notes running in the tray (closing the window does this) so reminders can fire.
- Use **Reminders → 🔔 Test alert** to check alerts work on a device.

## iPhone (Home Screen app)
- Sign-in goes to Google's page and comes back to the app (Google's pop-up can't return to a Home Screen app).
- Google gives web apps one hour of access at a time. When it runs out, opening Notes renews it with a quick trip to Google and back, usually with nothing to tap. If Google asks you to confirm, the sidebar shows **Reconnect**.
- Notes, tasks, reminders and events sync through the same Drive folder as the Mac and Windows apps.
- Reminder alerts appear only while Notes is open: iPhone doesn't let Home Screen web apps schedule alerts for later.
- Changes made offline are kept on the phone and upload when you're back online.
