'use strict';
/* Notes Web Clipper: saves the current page (or the selection) as a note, by writing one note file into the
   "Notes" folder in your Google Drive — the same files the Notes app itself syncs. No server in between. */
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const token = (interactive) => new Promise((ok, no) => chrome.identity.getAuthToken({ interactive }, (t) => (t ? ok(t) : no(new Error(chrome.runtime.lastError ? chrome.runtime.lastError.message : 'sign-in failed')))));
const status = (msg, isErr) => { const el = $('#status'); el.textContent = msg; el.className = isErr ? 'err' : ''; };

let authToken = null, tab = null;

async function drive(path, opts = {}) {
  const res = await fetch(path.startsWith('http') ? path : 'https://www.googleapis.com' + path,
    { ...opts, headers: { ...(opts.headers || {}), Authorization: 'Bearer ' + authToken } });
  if (!res.ok) { const e = new Error('Google Drive error ' + res.status); e.status = res.status; throw e; }
  return res;
}
async function ensureFolder() {
  const q = encodeURIComponent("mimeType='application/vnd.google-apps.folder' and name='Notes' and 'root' in parents and trashed=false");
  const found = (await (await drive(`/drive/v3/files?q=${q}&fields=files(id)&pageSize=10`)).json()).files || [];
  if (found.length) return found[0].id;
  return (await (await drive('/drive/v3/files?fields=id', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Notes', mimeType: 'application/vnd.google-apps.folder' }) })).json()).id;
}

/* Runs in the page itself: pulls the readable content out, keeping headings, lists, links and pictures. */
function extractPage(selectionOnly) {
  const escIn = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  let root;
  if (selectionOnly) {
    const sel = getSelection();
    if (!sel || sel.isCollapsed) return null;
    root = document.createElement('div');
    for (let i = 0; i < sel.rangeCount; i++) root.appendChild(sel.getRangeAt(i).cloneContents());
  } else {
    root = (document.querySelector('article') || document.querySelector('main') || document.body).cloneNode(true);
    root.querySelectorAll('script, style, nav, footer, header, aside, form, button, svg, iframe, noscript').forEach((e) => e.remove());
  }
  const KEEP = new Set(['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'UL', 'OL', 'LI', 'BLOCKQUOTE', 'PRE', 'CODE', 'A', 'IMG', 'STRONG', 'B', 'EM', 'I', 'BR', 'HR', 'TABLE', 'THEAD', 'TBODY', 'TR', 'TD', 'TH', 'FIGURE', 'FIGCAPTION', 'SPAN']);
  const walk = (node) => {
    if (node.nodeType === 3) return escIn(node.nodeValue);
    if (node.nodeType !== 1) return '';
    const tag = node.tagName;
    if (tag === 'IMG') { const src = node.currentSrc || node.src; return src ? `<img class="ext" src="${escIn(src)}" alt="${escIn(node.alt || '')}">` : ''; }
    if (tag === 'BR' || tag === 'HR') return `<${tag.toLowerCase()}>`;
    const kids = [...node.childNodes].map(walk).join('');
    if (!KEEP.has(tag)) return kids;
    if (tag === 'A') { const href = node.href || ''; return /^https?:/.test(href) ? `<a href="${escIn(href)}">${kids}</a>` : kids; }
    if (tag === 'PRE') return `<pre>${escIn(node.textContent)}</pre>`;
    return `<${tag.toLowerCase()}>${kids}</${tag.toLowerCase()}>`;
  };
  const html = walk(root).replace(/<(div|p|span)>\s*<\/\1>/g, '').slice(0, 220000);
  return { title: document.title || location.hostname, url: location.href, html };
}

async function save(selectionOnly) {
  const btns = [$('#save'), $('#saveSel')];
  btns.forEach((b) => { b.disabled = true; });
  status(selectionOnly ? 'Reading your selection…' : 'Reading the page…');
  try {
    const [inj] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: extractPage, args: [selectionOnly] });
    const page = inj && inj.result;
    if (!page) { status(selectionOnly ? 'Select some text on the page first.' : 'Nothing readable was found on this page.', true); return; }
    if (!page.html.trim()) { status('Nothing readable was found on this page.', true); return; }
    status('Saving to your Notes…');
    const now = Date.now();
    const nid = now.toString(36) + Math.random().toString(36).slice(2, 7);
    const heading = /^<h1[\s>]/.test(page.html.trim()) ? '' : `<h1>${esc(page.title)}</h1>`;
    const html = heading + page.html + `<div>Clipped from <a href="${esc(page.url)}">${esc(page.url)}</a></div>`;
    const content = { id: nid, folder: null, pinned: false, pinTop: false, archived: false, trashed: false, locked: false, html, created: now, updated: now };
    const folderId = await ensureFolder();
    const name = (page.title.replace(/[\\/:*?"<>|-]/g, ' ').trim().slice(0, 60) || 'Clipped page') + ' - ' + nid.slice(-6) + '.json';
    const b = 'nb' + Math.random().toString(36).slice(2);
    const meta = { name, parents: [folderId], mimeType: 'application/json', appProperties: { kind: 'note', nid, updated: String(now) } };
    const body = `--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(content)}\r\n--${b}--`;
    await drive('/upload/drive/v3/files?uploadType=multipart&fields=id', { method: 'POST', headers: { 'Content-Type': 'multipart/related; boundary=' + b }, body });
    status('Saved. It will appear in Notes the next time the app syncs.');
  } catch (err) {
    if (err.status === 401) { chrome.identity.removeCachedAuthToken({ token: authToken }, () => {}); authToken = null; showSignedOut('Your sign-in expired: sign in again, then save.'); return; }
    status('Could not save: ' + (err.message || err), true);
  } finally { btns.forEach((b) => { b.disabled = false; }); }
}

function showSignedIn(email) {
  $('#who').textContent = 'Signed in as ' + email;
  $('#signIn').hidden = true; $('#save').hidden = false; $('#saveSel').hidden = false;
}
function showSignedOut(msg) {
  $('#who').textContent = msg || 'Not signed in.';
  $('#signIn').hidden = false; $('#save').hidden = true; $('#saveSel').hidden = true;
}

(async () => {
  [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab) $('#pageTitle').textContent = tab.title || '';
  try {
    authToken = await token(false);
    const me = await (await fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { Authorization: 'Bearer ' + authToken } })).json();
    if (me.email) showSignedIn(me.email); else showSignedOut();
  } catch { showSignedOut(); }
  $('#signIn').addEventListener('click', async () => {
    try {
      authToken = await token(true);
      const me = await (await fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { Authorization: 'Bearer ' + authToken } })).json();
      showSignedIn(me.email || 'your Google account');
    } catch (err) { status('Sign-in failed: ' + (err.message || err), true); }
  });
  $('#save').addEventListener('click', () => save(false));
  $('#saveSel').addEventListener('click', () => save(true));
})();
