const { app, BrowserWindow, protocol, net, shell, Menu, ipcMain, Tray, nativeImage, Notification, screen, dialog, nativeTheme, clipboard, ClipboardItem, globalShortcut } = require('electron');
const os = require('os');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

// Serve the bundled web files from app://notes/ so localStorage and fetch behave like a normal https site.
protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } }]);

const root = path.join(__dirname, 'web');
const APP_ID = 'com.imran.notes';
// The yellow Notes icon (multi-size .ico made by winicon.py) for the window, tray and notifications
const APP_ICON = fs.existsSync(path.join(__dirname, 'notes.ico')) ? path.join(__dirname, 'notes.ico') : path.join(__dirname, 'web', 'icons', 'icon-512.png');
let win = null, tray = null, quitting = false, toldAboutTray = false;
if (process.platform === 'win32') app.setAppUserModelId(APP_ID);   // lets Windows show our reminder notifications

function showWindow() {
  if (!win) return createWindow();
  if (win.isMinimized()) win.restore();
  win.show(); win.focus();
}
const runInPage = (js) => { showWindow(); win.webContents.executeJavaScript(js); };

function createWindow() {
  win = new BrowserWindow({
    width: 1100, height: 720, minWidth: 700, minHeight: 420,
    title: 'Notes', icon: APP_ICON,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#1c1c1e' : '#ffffff', autoHideMenuBar: true,
    // backgroundThrottling off: reminder timers must stay exact while the window is hidden in the tray
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, backgroundThrottling: false }
  });
  win.loadURL('app://notes/index.html');
  // Links open in the default browser, never inside the app.
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('app://')) { e.preventDefault(); shell.openExternal(url); } });
  // Closing the window keeps Notes running in the tray, so reminders still fire. Quit from the tray or File menu.
  win.on('close', (e) => {
    if (quitting || process.platform !== 'win32') return;
    e.preventDefault(); win.hide();
    if (!toldAboutTray && tray) { toldAboutTray = true; tray.displayBalloon({ title: 'Notes is still running', content: 'Reminders will keep working. Right-click the tray icon to quit.' }); }
  });
  win.on('closed', () => { win = null; });
}

function createTray() {
  const icon = nativeImage.createFromPath(APP_ICON).resize({ width: 16, height: 16 });
  tray = new Tray(icon);
  tray.setToolTip('Notes');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Open Notes', click: showWindow },
    { label: 'New Task', click: () => runInPage('window.Planner && Planner.newTask()') },
    { label: 'Search or Create…', click: () => runInPage('window.Planner && Planner.openLauncher()') },
    { type: 'separator' },
    { label: 'Quit Notes', click: () => { quitting = true; app.quit(); } },
  ]));
  tray.on('click', showWindow);
}

// A Start Menu entry makes Notes searchable and is what Windows uses to show its notifications.
function ensureStartMenuShortcut() {
  try {
    const lnk = path.join(app.getPath('appData'), 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Notes.lnk');
    const icon = path.join(__dirname, 'notes.ico');                  // the Notes icon rather than the runtime's own
    shell.writeShortcutLink(lnk, fs.existsSync(lnk) ? 'replace' : 'create', { target: process.execPath, appUserModelId: APP_ID, description: 'Notes, tasks and calendar',
      ...(fs.existsSync(icon) ? { icon, iconIndex: 0 } : {}) });
  } catch {}
}

if (!app.requestSingleInstanceLock()) app.quit();
app.on('second-instance', showWindow);
app.on('before-quit', () => { quitting = true; });
ipcMain.handle('win:focus', () => { showWindow(); return 'ok'; });
// Copy Image: a real picture on the Windows clipboard, so it pastes into any app (Word, Paint, chat apps…)
// Electron 44 removed clipboard.writeImage; the clipboard now takes ClipboardItem entries (async, like the web API).
ipcMain.handle('clip:image', async (_e, b64) => {
  const buf = Buffer.from(b64, 'base64');
    if (nativeImage.createFromBuffer(buf).isEmpty()) return "couldn't read the picture";
    if (typeof clipboard.writeImage === 'function') clipboard.writeImage(nativeImage.createFromBuffer(buf));   // older Electron
    else await clipboard.write([new ClipboardItem({ 'image/png': new Blob([buf], { type: 'image/png' }) })]);
  return 'ok';
});
// Light / Dark / System from the in-app switch: title bar, menus and dialogs follow it ('system' follows Windows).
ipcMain.handle('win:theme', (_e, t) => {
  nativeTheme.themeSource = t === 'light' || t === 'dark' ? t : 'system';
  if (win) win.setBackgroundColor(nativeTheme.shouldUseDarkColors ? '#1c1c1e' : '#ffffff');
  return 'ok';
});
ipcMain.handle('alarm:show', (_e, r) => { showAlarm(r); return 'ok'; });

// ---- Export to PDF: render the note's HTML in a hidden window and print it to an A4 PDF ----
ipcMain.handle('export:pdf', async (_e, html, name) => {
  const { canceled, filePath } = await dialog.showSaveDialog(win, { defaultPath: name, filters: [{ name: 'PDF', extensions: ['pdf'] }] });
  if (canceled || !filePath) return 'cancel';
  const tmp = path.join(os.tmpdir(), `notes-export-${Date.now()}.html`);   // a file, because big notes exceed data: URL limits
  const pdfWin = new BrowserWindow({ show: false, webPreferences: { sandbox: true, javascript: false } });
  try {
    fs.writeFileSync(tmp, html, 'utf8');
    await pdfWin.loadFile(tmp);
    const pdf = await pdfWin.webContents.printToPDF({ pageSize: 'A4', printBackground: true, preferCSSPageSize: true });
    fs.writeFileSync(filePath, pdf);
    return 'ok';
  } catch (err) { return String(err && err.message || err); }
  finally { pdfWin.destroy(); fs.rmSync(tmp, { force: true }); }
});

// ---- Reminder alarms: a Windows notification (stays in the notification centre) plus an always-on-top
// card in the top-right corner of the screen with Open / Done / Snooze, and a chime until it is answered. ----
const alarms = [];
const ALARM_W = 380, ALARM_H = 150;
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const inPage = (js) => { if (win) win.webContents.executeJavaScript(js).catch(() => {}); };
function placeAlarms() {
  const wa = screen.getPrimaryDisplay().workArea;
  alarms.forEach((a, i) => { if (!a.isDestroyed()) a.setPosition(wa.x + wa.width - ALARM_W - 16, wa.y + 16 + i * (ALARM_H + 10)); });
}
function alarmAction(r, popup, action) {
  if (popup && !popup.isDestroyed()) popup.close();
  const args = JSON.stringify(r);
  if (action === 'open') { showWindow(); inPage(`window.Planner && Planner.openItem(${JSON.stringify(r.kind)}, ${JSON.stringify(r.id)})`); }
  if (action === 'done') inPage(`window.Planner && Planner.completeFromAlarm(${JSON.stringify(r.id)})`);
  if (action === 'snooze') inPage(`window.Planner && Planner.snoozeFromAlarm(${args})`);
}
function showAlarm(r) {
  if (Notification.isSupported()) {
    const n = new Notification({ title: r.title, body: r.body, icon: APP_ICON, timeoutType: 'never' });
    n.on('click', () => alarmAction(r, null, 'open'));
    n.show();
  }
  const popup = new BrowserWindow({
    width: ALARM_W, height: ALARM_H, frame: false, resizable: false, movable: true, minimizable: false, maximizable: false,
    alwaysOnTop: true, skipTaskbar: true, show: false, backgroundColor: '#1c1c1e',
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, autoplayPolicy: 'no-user-gesture-required' },
  });
  popup.setAlwaysOnTop(true, 'screen-saver');
  const btn = (a, label, primary) => `<a href="notes-alarm:${a}" class="${primary ? 'p' : ''}">${label}</a>`;
  const html = `<!doctype html><meta charset="utf-8"><style>
    html,body{margin:0;height:100%;background:#1c1c1e;color:#f4f4f5;font:14px "Segoe UI",system-ui,sans-serif;overflow:hidden;user-select:none}
    .c{box-sizing:border-box;height:100%;padding:14px 16px;border-left:4px solid #ffc83d;display:flex;flex-direction:column;gap:6px;-webkit-app-region:drag}
    .h{display:flex;align-items:center;gap:8px;font-size:12px;color:#a1a1aa}.h b{color:#ffc83d}
    .t{font-weight:700;font-size:16px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.b{color:#d4d4d8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .r{display:flex;gap:8px;margin-top:auto;-webkit-app-region:no-drag}
    a{flex:1;text-align:center;padding:7px 0;border-radius:8px;background:#2c2c31;color:#f4f4f5;text-decoration:none;font-weight:600}
    a.p{background:#ffc83d;color:#1c1c1e}a:hover{filter:brightness(1.15)}
    .x{position:absolute;top:8px;right:10px;flex:none;background:none;padding:2px 6px;color:#a1a1aa;-webkit-app-region:no-drag}
  </style><div class="c"><div class="h"><b>⏰ Reminder</b> · Notes</div><div class="t">${esc(r.title)}</div><div class="b">${esc(r.body)}</div>
  <div class="r">${btn('open', 'Open', true)}${r.kind === 'task' ? btn('done', 'Done') : ''}${r.kind !== 'test' ? btn('snooze', 'Snooze 10 min') : ''}</div></div>
  <a class="x" href="notes-alarm:dismiss" title="Dismiss">✕</a>
  <script>
    // chime until answered (max 1 minute)
    const ctx = new AudioContext(); let stop = false;
    const beep = (f, t, d) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = f; o.connect(g); g.connect(ctx.destination);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.25, t + 0.01); g.gain.exponentialRampToValueAtTime(0.001, t + d); o.start(t); o.stop(t + d); };
    const ring = () => { if (stop) return; const t = ctx.currentTime; for (let i = 0; i < 3; i++) { beep(880, t + i * 0.5, 0.18); beep(1175, t + i * 0.5 + 0.22, 0.22); } };
    ring(); const iv = setInterval(ring, 3000); setTimeout(() => { stop = true; clearInterval(iv); }, 60000);
  </script>`;
  popup.webContents.on('will-navigate', (e, url) => { e.preventDefault(); alarmAction(r, popup, url.replace('notes-alarm:', '')); });
  popup.on('closed', () => { const i = alarms.indexOf(popup); if (i >= 0) alarms.splice(i, 1); placeAlarms(); });
  alarms.push(popup);
  placeAlarms();
  popup.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
  popup.once('ready-to-show', () => popup.showInactive());   // appear without stealing focus from what you're doing
}

// ---- Google sign-in: system browser + one-shot loopback listener (Google blocks sign-in inside embedded windows) ----
ipcMain.handle('auth:authorize', (_e, template) => new Promise((resolve) => {
  if (typeof template !== 'string' || !template.startsWith('https://accounts.google.com/')) return resolve({ error: 'blocked' });
  let done = false, redirect = '';
  const server = http.createServer((req, res) => {
    const q = new URL(req.url, 'http://127.0.0.1').searchParams;
    const ok = q.has('code') || q.has('error');
    res.writeHead(ok ? 200 : 404, { 'Content-Type': 'text/html; charset=utf-8', Connection: 'close' });
    res.end(ok ? '<html><body style="font-family:sans-serif;text-align:center;padding-top:80px"><h2>You\'re signed in</h2><p>You can close this tab and return to Notes.</p></body></html>' : 'Not found');
    if (ok) finish({ code: q.get('code'), error: q.get('error'), state: q.get('state'), redirectUri: redirect });
  });
  const timer = setTimeout(() => finish({ error: 'Sign-in timed out.' }), 300000);
  function finish(result) {
    if (done) return; done = true; clearTimeout(timer);
    server.close(); server.closeAllConnections && server.closeAllConnections();
    resolve(result);
  }
  server.on('error', (err) => finish({ error: String(err.message || err) }));
  server.listen(0, '127.0.0.1', () => {
    redirect = 'http://127.0.0.1:' + server.address().port;
    shell.openExternal(template.replace('{REDIRECT}', encodeURIComponent(redirect)));
  });
}));

// POST a form to Google's token endpoint from the main process (no CORS limits for the page).
ipcMain.handle('auth:postForm', async (_e, url, params) => {
  let u; try { u = new URL(url); } catch { return { error: 'blocked' }; }
  if (u.protocol !== 'https:' || u.hostname !== 'oauth2.googleapis.com') return { error: 'blocked' };
  try {
    const res = await net.fetch(u.toString(), { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(params).toString() });
    return await res.json();
  } catch (err) { return { error: 'network', error_description: 'Could not reach Google.' }; }
});

app.whenReady().then(() => {
  protocol.handle('app', (req) => {
    const p = decodeURIComponent(new URL(req.url).pathname);
    const file = path.normalize(path.join(root, p === '/' ? 'index.html' : p));
    if (!file.startsWith(root)) return new Response('Forbidden', { status: 403 });
    return net.fetch(pathToFileURL(file).toString());
  });
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: 'File', submenu: [
      { label: 'New Note', accelerator: 'CmdOrCtrl+N', click: () => runInPage("document.getElementById('newNote').click()") },
      { label: 'New Task', accelerator: 'CmdOrCtrl+T', click: () => runInPage('window.Planner && Planner.newTask()') },
      { label: 'New Event', accelerator: 'CmdOrCtrl+Shift+E', click: () => runInPage('window.Planner && Planner.newEvent()') },
      { label: 'Search or Create…   (Ctrl+K)', click: () => runInPage('window.Planner && Planner.openLauncher()') },
      { type: 'separator' }, { label: 'Quit Notes', accelerator: 'CmdOrCtrl+Q', click: () => { quitting = true; app.quit(); } }] },
    { role: 'editMenu' },
    { label: 'View', submenu: [{ role: 'togglefullscreen' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { role: 'resetZoom' }] }
  ]));
  // Quick capture: a system-wide Ctrl+Alt+N brings Notes up (even from the tray) with a fresh note.
  globalShortcut.register('CommandOrControl+Alt+N', () => { showWindow(); runInPage("document.getElementById('newNote').click()"); });
  app.on('will-quit', () => globalShortcut.unregisterAll());
  createWindow();
  if (process.platform === 'win32') { createTray(); ensureStartMenuShortcut(); }
});
app.on('window-all-closed', () => { if (process.platform !== 'win32' || quitting) app.quit(); });
