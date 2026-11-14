(() => {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const KEY = 'notes-app-v1';
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  // ---------- State ----------
  const CFG = window.NOTES_CONFIG || {};
  const native = window.nativeBridge || null;               // injected by the Mac / Windows wrappers
  const WEB_ID_KEY = KEY + '-web-client';                   // a Web client ID pasted in the app (website / iPhone), until it's in config.js
  const DESKTOP_KEY = KEY + '-desktop-client';            // { id, secret } typed into the Mac / Windows app, when not in config.js
  const typedDesktop = (() => { try { return JSON.parse(localStorage.getItem(DESKTOP_KEY)) || {}; } catch { return {}; } })();
  const desktopId = CFG.googleDesktopClientId || typedDesktop.id || '';
  const desktopSecret = CFG.googleDesktopClientId ? CFG.googleDesktopClientSecret || '' : typedDesktop.secret || '';
  const googleClientId = native ? desktopId : (CFG.googleWebClientId || localStorage.getItem(WEB_ID_KEY) || '');
  // Added to an iPhone / iPad Home Screen: Google's sign-in popup can't hand its result back there, so sign-in
  // goes to Google's page and comes back (see redirectToGoogle).
  const standalone = !native && (navigator.standalone === true || matchMedia('(display-mode: standalone)').matches);
  const syncEnabled = !!googleClientId;
  const VIEW_KEY = KEY + '-view';
  let state = normalize(load() || (syncEnabled ? emptyState() : seed()));
  // planner: today | upcoming | calendar | tasks | events; notes: all | pinned | trash | folder | tag
  // Phones always open on Notes; wider screens reopen the last section (Notes the first time).
  let view = { type: (innerWidth > 900 && localStorage.getItem(VIEW_KEY)) || 'all' };
  let currentId = null;
  let query = '';
  let saveTimer = null;

  function seed() {
    const now = Date.now();
    return {
      folders: [{ id: 'f1', name: 'Personal' }, { id: 'f2', name: 'Work' }],
      notes: [{
        id: uid(), folder: null, pinned: true, trashed: false, created: now, updated: now,
        html: '<h1>Welcome to Notes</h1><div>Everything is saved automatically in your browser.</div><div><br></div>' +
          '<div>Try typing at the start of a line, then a space:</div>' +
          '<ul><li><code># </code> heading, <code>## </code> subheading</li><li><code>- </code> bullet list, <code>1. </code> numbered list</li><li><code>[] </code> checklist</li></ul>' +
          '<ul class="checklist"><li class="done">Click a circle to tick it off</li><li>Add #tags anywhere and they show up in the sidebar</li></ul>'
      }]
    };
  }
  function emptyState() { return { folders: [], notes: [], tasks: [], events: [] }; }
  function normalize(s) { ['folders', 'notes', 'tasks', 'events'].forEach((k) => { if (!Array.isArray(s[k])) s[k] = []; }); s.notes.forEach((n) => { n.archived = !!n.archived; }); return s; }
  function load() {
    try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; }
  }
  // A locked note's readable text only ever lives in memory while it's open: disk, backups and Drive get `enc`.
  function sealedOnly(k, v) { return k === 'html' && this.locked ? '' : v; }
  function persist(noSync) {
    try { localStorage.setItem(KEY, JSON.stringify(state, sealedOnly)); } catch (e) { setStatus('Could not save: ' + e.message); }
    if (!noSync) scheduleSync();
    if (window.Planner && plannerReady) Planner.dataChanged();
  }
  let plannerReady = false;
  const touch = (n) => { n.updated = Date.now(); };
  const looksEmpty = (n) => !textLines(n.html).length && !/<(figure|table|hr|img)\b|blk-/.test(n.html);
  const byId = (id) => state.notes.find((n) => n.id === id);

  // ---------- Derived note info ----------
  const tmp = document.createElement('div');
  function textLines(html) {
    tmp.innerHTML = html.replace(/<\/(div|p|h[1-6]|li|blockquote|pre)>|<br\s*\/?>/gi, '\n');
    return tmp.textContent.replace(/ /g, ' ').split('\n').map((s) => s.trim()).filter(Boolean);
  }
  function info(n) {
    if (n.locked) return { title: n.lockTitle || 'Locked note', preview: '', tags: [], words: 0, text: '' };   // never its contents, even while open
    if (n._info && n._info.src === n.html) return n._info;
    const lines = textLines(n.html);
    const text = lines.join(' ');
    const tags = [...new Set((text.match(/(^|\s)#[\p{L}\p{N}_-]+/gu) || []).map((t) => t.trim().slice(1).toLowerCase()))];
    Object.defineProperty(n, '_info', {
      value: { src: n.html, title: lines[0] || 'New note', preview: lines.slice(1).join(' ').slice(0, 120), tags, words: text ? text.split(/\s+/).length : 0, text },
      enumerable: false, writable: true, configurable: true
    });
    return n._info;
  }

  // ---------- Filtering ----------
  const imageText = (n) => (n.locked ? '' : Blocks.imageText(n.html));
  function visibleNotes() {
    const q = query.trim().toLowerCase();
    let list = state.notes.filter((n) => {
      if (n.deleted) return false;
      if (view.type === 'trash') { if (!n.trashed) return false; }
      else if (n.trashed) return false;
      else if (view.type === 'archive') { if (!n.archived) return false; }
      else if (n.archived) return false;                 // archived notes only show under Archive
      if (view.type === 'pinned' && !n.pinned) return false;
      if (view.type === 'folder' && n.folder !== view.id) return false;
      if (view.type === 'tag' && !info(n).tags.includes(view.id)) return false;
      if (view.type === 'smart' && !(window.Extras && Extras.matchSmart(view.id, n))) return false;
      if (q) { const i = info(n); if (!(i.title + ' ' + i.text).toLowerCase().includes(q) && !imageText(n).toLowerCase().includes(q)) return false; }
      return true;
    });
    list.sort((a, b) => (!!b.pinTop - !!a.pinTop) || (!!b.pinned - !!a.pinned) || (b.updated - a.updated));   // Pinned, Favorites, then the rest
    return list;
  }

  // ---------- Rendering ----------
  const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function fmtDate(t) {
    const d = new Date(t), now = new Date();
    if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    if (now - d < 6 * 864e5) return d.toLocaleDateString([], { weekday: 'short' });
    return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric' });
  }

  function renderSidebar() {
    const alive = state.notes.filter((n) => !n.deleted);
    const live = alive.filter((n) => !n.trashed && !n.archived);
    const folders = state.folders.filter((f) => !f.deleted);
    const is = (t, id) => view.type === t && view.id === id ? ' active' : '';
    const navItem = (type, id, label, count, extra = '', ic = '') =>
      `<div class="nav${is(type, id)}" data-type="${type}" data-id="${esc(id || '')}">${ic ? `<svg class="ni" viewBox="0 0 24 24" aria-hidden="true">${ICONS[ic]}</svg>` : ''}<span class="label">${esc(label)}</span>${extra}<span class="count">${count}</span></div>`;
    const pc = window.Planner && plannerReady ? Planner.counts() : {};
    $('#navMain').innerHTML =
      navItem('all', undefined, 'Notes', live.length, '', 'notes') +
      navItem('today', undefined, 'Today', pc.today || '', '', 'today') +
      navItem('upcoming', undefined, 'Upcoming', '', '', 'upcoming') +
      navItem('calendar', undefined, 'Calendar', '', '', 'calendar') +
      navItem('tasks', undefined, 'Tasks', pc.tasks || '', '', 'tasks') +
      navItem('reminders', undefined, 'Reminders', pc.reminders || '', '', 'bell') +
      navItem('events', undefined, 'Events', pc.events || '', '', 'events') +
      '<div class="nav-sep"></div>' +
      navItem('pinned', undefined, 'Favorites', live.filter((n) => n.pinned).length, '', 'star') +
      navItem('archive', undefined, 'Archive', alive.filter((n) => !n.trashed && n.archived).length, '', 'archive') +
      navItem('trash', undefined, 'Trash', alive.filter((n) => n.trashed).length, '', 'trash');
    $('#navFolders').innerHTML = folders.map((f) =>
      navItem('folder', f.id, f.name, live.filter((n) => n.folder === f.id).length, '<button class="del" data-del-folder title="Delete folder">✕</button>')).join('');
    const tagCount = {};
    live.forEach((n) => info(n).tags.forEach((t) => (tagCount[t] = (tagCount[t] || 0) + 1)));
    $('#navTags').innerHTML = Object.keys(tagCount).sort().map((t) => navItem('tag', t, '#' + t, tagCount[t])).join('') ||
      '<div class="nav" style="color:var(--muted);cursor:default">Type #tag in a note</div>';
    if (window.Extras) Extras.renderSmart();
  }
  const ICONS = {
    today: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    upcoming: '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4M8 14h3M8 17h6"/>',
    calendar: '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4M7 13h2M11 13h2M15 13h2M7 17h2M11 17h2"/>',
    notes: '<path d="M5 3h10l4 4v14H5z"/><path d="M9 9h6M9 13h6M9 17h4"/>',
    tasks: '<rect x="3" y="3" width="18" height="18" rx="4"/><path d="M8 12l3 3 5-6"/>',
    events: '<path d="M4 6h16M4 12h16M4 18h10"/><circle cx="19" cy="18" r="1.5"/>',
    bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 21h4"/>',
    star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    archive: '<rect x="3" y="4" width="18" height="5" rx="1"/><path d="M5 9v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9M10 13h4"/>',
  };
  const PIN_SVG = '<svg class="pin-ic" viewBox="0 0 24 24" aria-label="Pinned"><path d="M9 4h6l-1 6 3 3H7l3-3zM12 13v7"/></svg>';
  const MORE_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="5.5" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="12" cy="18.5" r="1.6"/></svg>';

  function viewTitle() {
    if (view.type === 'all') return 'All Notes';
    if (view.type === 'pinned') return 'Favorites';
    if (view.type === 'trash') return 'Trash';
    if (view.type === 'archive') return 'Archive';
    if (view.type === 'tag') return '#' + view.id;
    if (view.type === 'smart') return window.Extras ? Extras.smartName(view.id) : 'Smart folder';
    const f = state.folders.find((x) => x.id === view.id);
    return f ? f.name : 'Folder';
  }

  const LOCK_MARK = '<svg class="pin-ic" viewBox="0 0 24 24" aria-label="Locked"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>';
  // When a search matched only text inside a picture, say so and show that text instead of the usual preview.
  function foundInImage(n, i) {
    const q = query.trim().toLowerCase();
    if (!q || (i.title + ' ' + i.text).toLowerCase().includes(q)) return '';
    const text = imageText(n), at = text.toLowerCase().indexOf(q);
    return at < 0 ? '' : 'In image: …' + text.slice(Math.max(0, at - 20), at + q.length + 60) + '…';
  }
  let renaming = null;                                   // { id, input } while a note's name is being edited in the list
  function renderList() {
    if (renaming) { renaming.stale = true; return; }     // don't wipe out a name mid-typing; redrawn when it's done
    $('#listTitle').textContent = viewTitle();
    const list = visibleNotes();
    if (!list.length) {
      $('#notes').innerHTML = `<div class="no-notes">${query ? 'No matching notes' : view.type === 'trash' ? 'Trash is empty' : view.type === 'archive' ? 'No archived notes' : 'No notes yet'}</div>`;
      return;
    }
    const group = (n) => (view.type === 'trash' ? '' : n.pinTop ? 'Pinned' : n.pinned ? 'Favorites' : 'Notes');
    const labelled = new Set(list.map(group)).size > 1;
    let html = '', last = null;
    for (const n of list) {
      const g = group(n);
      if (labelled && g !== last) html += `<div class="group-label">${g}</div>`;
      last = g;
      const i = info(n);
      html += `<div class="note${n.id === currentId ? ' active' : ''}" data-id="${n.id}" tabindex="0">
        <div class="t">${n.locked ? LOCK_MARK : ''}${n.pinTop ? PIN_SVG : ''}<span class="tt">${esc(i.title)}</span></div>
        <div class="m"><span class="d">${fmtDate(n.updated)}</span><span class="p">${n.locked ? 'Locked' : esc(foundInImage(n, i) || i.preview) || 'No additional text'}</span></div>
        <button class="note-more" type="button" aria-label="More actions for ${esc(i.title)}" title="More">${MORE_SVG}</button></div>`;
    }
    $('#notes').innerHTML = html;
  }

  function renderActions() {
    const n = byId(currentId);
    if (!n) return;
    $('#pinBtn').textContent = n.pinned ? '★' : '☆';
    $('#pinBtn').classList.toggle('on', n.pinned);
    $('#trashBtn').hidden = n.trashed;
    $('#restoreBtn').hidden = !n.trashed;
    $('#deleteBtn').hidden = !n.trashed;
    $('#pinBtn').hidden = n.trashed;
    const lockLabel = n.locked ? 'Lock this note now' : 'Lock this note with a password';
    $('#lockBtn').title = lockLabel; $('#lockBtn').setAttribute('aria-label', lockLabel);
    $('#lockBtn').hidden = n.trashed;
    $('#lockBtn').classList.toggle('on', !!n.locked);
    $('#editor').contentEditable = n.trashed ? 'false' : 'true';
  }

  function setStatus(extra) {
    const n = byId(currentId);
    if (!n) return;
    const i = info(n);
    const text = n.locked ? textLines(n.html).join(' ') : i.text;
    const words = text ? text.split(/\s+/).filter(Boolean).length : 0;
    const read = Math.max(1, Math.round(words / 200));
    $('#statusbar').innerHTML = `<span>${words} word${words === 1 ? '' : 's'} · ${text.length} character${text.length === 1 ? '' : 's'} · ${read} min read</span><span>${extra || 'Edited ' + new Date(n.updated).toLocaleString()}</span>`;
  }

  function renderAll() { renderSidebar(); renderList(); if (window.Planner && plannerReady && Planner.isView(view.type)) Planner.render(); }

  // Planner views (Today, Calendar, Tasks…) replace the notes list + editor with one wide pane.
  function showPlanner(on) {
    const app = $('#app');
    app.classList.toggle('planner-mode', on);
    $('#planner').hidden = !on;
    const inbox = on && Planner.inboxOpen && innerWidth > 900;
    app.classList.toggle('inbox-open', inbox);
    $('#inbox').hidden = !inbox;
  }
  // phones: a tab bar along the bottom, like iPhone apps (hidden while a note is open)
  const TABS = [['all', 'Notes', '<path d="M7 3h7l5 5v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>'],
    ['today', 'Today', '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'],
    ['calendar', 'Calendar', '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>'],
    ['tasks', 'Tasks', '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8.5 12l2.5 2.5 4.5-5"/>'],
    ['reminders', 'Reminders', '<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 21h4"/>']];
  function renderTabbar() {
    const cur = ['folder', 'tag', 'pinned', 'trash', 'archive', 'smart'].includes(view.type) ? 'all' : view.type;
    $('#tabbar').innerHTML = TABS.map(([t, label, icon]) => `<button data-tab="${t}" class="${t === cur ? 'on' : ''}"${t === cur ? ' aria-current="page"' : ''}><svg viewBox="0 0 24 24" aria-hidden="true">${icon}</svg><span>${label}</span></button>`).join('');
  }
  function setView(type, id) {
    view = { type, id };
    renderTabbar();
    try { if (!id) localStorage.setItem(VIEW_KEY, type); } catch {}
    $('#app').classList.remove('show-side');
    if (Planner.isView(type)) { openNote(null); Planner.show(type); renderSidebar(); return; }
    showPlanner(false);
    openNote(null); renderAll();
  }

  function openNote(id) {
    if (unlocked && unlocked.id !== id) relock();        // leaving an unlocked note locks it again
    currentId = id;
    const n = byId(id);
    const sealed = !!(n && n.locked && !isUnlocked(id));
    $('#emptyState').hidden = !!n;
    $('#editorWrap').hidden = !n || sealed;
    $('#lockScreen').hidden = !sealed;
    $('#app').classList.toggle('editing', !!n);
    if (sealed) {
      $('#editor').innerHTML = '';
      $('#lockName').textContent = info(n).title;
      $('#lockPass').value = ''; $('#lockErr').textContent = '';
      if (innerWidth > 900) $('#lockPass').focus();
      if (window.Extras) Extras.lockShown(n);
      renderList();
      return;
    }
    if (n) {
      const ed = $('#editor');
      ed.innerHTML = n.html;
      ed.classList.toggle('is-empty', looksEmpty(n));
      Blocks.closeMenu();
      Blocks.hydrate(ed);
      renderActions();
      setStatus();
      if (!n.trashed && !info(n).text) ed.focus();
    }
    if (window.Extras && n) Extras.noteSeen(n);
    Blocks.renderBacklinks(n);
    renderList();
  }

  // ---------- Mutations ----------
  function newNote() {
    const now = Date.now();
    const n = { id: uid(), folder: view.type === 'folder' ? view.id : null, pinned: false, trashed: false, created: now, updated: now, html: '' };
    if (['trash', 'pinned', 'archive'].includes(view.type) || Planner.isView(view.type)) { view = { type: 'all' }; showPlanner(false); }
    query = ''; $('#search').value = '';
    state.notes.unshift(n);
    persist(); renderAll(); openNote(n.id);
    $('#editor').focus();
  }

  function onEdit() {
    const n = byId(currentId);
    if (!n || n.trashed || (n.locked && !isUnlocked(n.id))) return;
    const ed = $('#editor');
    tidyFormatting(ed);
    n.html = Blocks.serialize(ed);            // without file previews / boards drawn at runtime
    n.updated = Date.now();
    if (n.locked) unlocked.dirty = true;
    ed.classList.toggle('is-empty', looksEmpty(n));
    Blocks.afterEdit();
    renderList(); setStatus('Saving…');
    clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      const cur = byId(currentId);
      if (cur && cur.locked && isUnlocked(cur.id) && unlocked.dirty) { const u = unlocked; u.dirty = false; await seal(cur, cur.html, u); }
      persist(); renderSidebar(); setStatus();
      if (window.Extras && cur) Extras.noteSaved(cur);
    }, 400);
  }

  // ---------- Password-locked notes ----------
  // AES-GCM with a key made from the password (PBKDF2). The text is encrypted on this device before it's saved or
  // synced; the password itself is never stored, so a forgotten password can't be recovered by anyone.
  const LOCK_ITERATIONS = 600000, LOCK_AFTER = 5 * 60000;
  let unlocked = null;                                   // { id, key, salt, it, dirty }: the one note open right now
  let sealing = Promise.resolve();
  const isUnlocked = (id) => !!unlocked && unlocked.id === id;
  const bytesToB64 = (bytes) => { let s = ''; for (let i = 0; i < bytes.length; i += 32768) s += String.fromCharCode(...bytes.subarray(i, i + 32768)); return btoa(s); };
  const b64ToBytes = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  async function lockKey(password, salt, it) {
    const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: it }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }
  const openSealed = async (enc, key) => new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64ToBytes(enc.iv) }, key, b64ToBytes(enc.ct)));
  function seal(n, html, u) {                            // encrypts in order, so an older save can't land after a newer one
    sealing = sealing.then(async () => {
      if (n.deleted) return;
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, u.key, new TextEncoder().encode(html)));
      n.enc = { v: 1, salt: bytesToB64(u.salt), it: u.it, iv: bytesToB64(iv), ct: bytesToB64(ct) };
      n.lockTitle = textLines(html)[0] || 'Locked note';
      n.updated = Date.now();                            // so sync uploads this version, even if it just uploaded an older one
    });
    return sealing;
  }
  function relock() {
    if (!unlocked) return;
    const u = unlocked, n = byId(u.id);
    unlocked = null;
    if (!n) return;
    clearTimeout(saveTimer);
    const html = n.html;
    n.html = '';                                         // gone from memory straight away
    if (u.id === currentId) $('#editor').innerHTML = '';
    if (u.dirty) seal(n, html, u).then(() => { persist(); renderList(); });
    else persist(true);
  }
  async function lockNote(id, password) {
    const n = byId(id); if (!n) return;
    if (id === currentId) n.html = Blocks.serialize($('#editor'));
    clearTimeout(saveTimer);
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const u = { id, salt, it: LOCK_ITERATIONS, key: await lockKey(password, salt, LOCK_ITERATIONS) };
    const html = n.html;
    await seal(n, html, u);
    if (await openSealed(n.enc, u.key) !== html) throw new Error('The encrypted copy could not be checked');   // before the readable text goes
    n.locked = true; n.html = '';
    persist();
    if (id === currentId) openNote(id);
    renderAll();
    Planner.toast('Note locked');
  }
  function askLockPassword(id) {
    const n = byId(id); if (!n) return;
    if (!window.crypto || !crypto.subtle) { Planner.toast('Locking needs a secure (https) page.'); return; }
    if (id === currentId) n.html = Blocks.serialize($('#editor'));
    const hasFiles = /data-att=/.test(n.html);
    const m = Media.modal('md-lock', Media.head('Lock this note') + `
      <form class="lock-form" autocomplete="off">
        <p class="lock-warn"><b>If you forget this password, this note can never be opened again.</b> It isn't stored anywhere, so no one can reset it, including us.</p>
        <p class="lock-note">The note's first line stays visible as its title.${hasFiles ? ' <b>Photos, recordings and files in this note are hidden in the app but are not encrypted:</b> they stay readable in your Google Drive folder.' : ''}</p>
        <input type="password" id="newLock" placeholder="Password" aria-label="Password" autocomplete="new-password">
        <input type="password" id="newLock2" placeholder="Type the password again" aria-label="Type the password again" autocomplete="new-password">
        <div class="auth-err" id="newLockErr" role="alert"></div>
        <div class="md-foot"><span class="grow"></span><button class="pl-btn" type="button" data-x="close">Cancel</button><button class="pl-btn primary" type="submit">Lock note</button></div>
      </form>`, { sticky: true });
    const q = (s) => m.el.querySelector(s);
    q('#newLock').focus();
    q('form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const a = q('#newLock').value, b = q('#newLock2').value, err = q('#newLockErr');
      if (a.length < 4) { err.textContent = 'Use at least 4 characters.'; return; }
      if (a !== b) { err.textContent = 'The two passwords don\u2019t match.'; return; }
      const go = q('[type=submit]'); go.disabled = true; go.textContent = 'Locking…';
      try { await lockNote(id, a); m.close(); }
      catch (ex) { go.disabled = false; go.textContent = 'Lock note'; err.textContent = `Couldn\u2019t lock it, so nothing changed: ${ex.message || ex}`; }
    });
  }
  function removeLock(id) {
    const n = byId(id); if (!n || !isUnlocked(id)) return;
    unlocked = null;
    n.locked = false; delete n.enc; delete n.lockTitle; touch(n);
    persist(); openNote(id); renderAll();
    Planner.toast('Lock removed');
  }
  function lockNow(id) { relock(); if (currentId === id) openNote(id); renderAll(); }
  // Unlock with a key obtained another way (fingerprint / Face ID: Extras unwraps the note's key with WebAuthn).
  function unlockWithKey(id, html, key, salt, it) {
    const n = byId(id); if (!n) return;
    n.html = html;
    unlocked = { id, key, salt, it, dirty: false };
    openNote(id);
  }

  function trash(id, flag) {
    const n = byId(id); if (!n) return;
    n.trashed = flag; if (flag) n.pinned = false; touch(n);
    persist(); renderAll();
    if (id !== currentId) return;
    if (flag || view.type === 'trash') openNote(null); else openNote(id);
  }

  function deleteForever(id) {
    if (!confirm('Delete this note permanently?')) return;
    const n = byId(id); n.deleted = true; n.html = ''; touch(n);   // tombstone so other devices delete it too
    persist(); renderAll();
    if (id === currentId) openNote(null);
  }

  // ---------- Editor commands ----------
  const ed = () => $('#editor');
  function block(tag) {
    const cur = (document.queryCommandValue('formatBlock') || '').toLowerCase().replace(/[<>]/g, '');
    document.execCommand('formatBlock', false, cur === tag ? 'div' : tag);
  }
  function toggleCheck() {
    const sel = getSelection(); if (!sel.rangeCount) return;
    let node = sel.anchorNode; node = node.nodeType === 3 ? node.parentNode : node;
    const li = node.closest && node.closest('ul.checklist li');
    if (li) { document.execCommand('insertUnorderedList'); return; }
    document.execCommand('insertUnorderedList');
    node = getSelection().anchorNode; node = node && (node.nodeType === 3 ? node.parentNode : node);
    const ul = node && node.closest && node.closest('ul');
    if (ul) ul.classList.add('checklist');
  }
  // In-page replacement for window.prompt (not available in Electron, awkward on iOS).
  function askText(label, value) {
    return new Promise((resolve) => {
      const box = document.createElement('div');
      box.className = 'auth';
      box.innerHTML = '<form class="auth-card"><h2></h2><input type="text" autocomplete="off"><button class="btn" type="submit">OK</button><button class="btn ghost" type="button">Cancel</button></form>';
      box.querySelector('h2').textContent = label;
      const input = box.querySelector('input'); input.value = value || '';
      const done = (v) => { box.remove(); resolve(v); };
      box.querySelector('form').onsubmit = (e) => { e.preventDefault(); done(input.value.trim()); };
      box.querySelector('.ghost').onclick = () => done(null);
      box.addEventListener('keydown', (e) => { if (e.key === 'Escape') done(null); });
      document.body.appendChild(box); input.focus(); input.select();
    });
  }
  function run(cmd) {
    ed().focus();
    switch (cmd) {
      case 'h1': block('h1'); break;
      case 'h2': block('h2'); break;
      case 'h3': block('h3'); break;
      case 'insert': Blocks.openMenu(); return;
      case 'image': Blocks.pick('image/*'); return;
      case 'attach': Blocks.pick(''); return;
      case 'media': Media.openMenu($('#toolbar [data-cmd="media"]')); return;
      case 'sketch': Media.addSketch(); return;
      case 'format': toggleFormat($('#toolbar [data-cmd="format"]')); return;
      case 'headings': toggleHeadings($('#toolbar [data-cmd="headings"]')); return;
      case 'quote': block('blockquote'); break;
      case 'code': block('pre'); break;
      case 'ul': document.execCommand('insertUnorderedList'); break;
      case 'ol': document.execCommand('insertOrderedList'); break;
      case 'check': toggleCheck(); break;
      case 'hr': document.execCommand('insertHorizontalRule'); break;
      case 'highlight': toggleHighlight(); break;
      case 'link': {
        const sel = getSelection();
        const saved = sel.rangeCount ? sel.getRangeAt(0).cloneRange() : null;
        askText('Link URL', 'https://').then((url) => {
          ed().focus();
          if (saved) { sel.removeAllRanges(); sel.addRange(saved); }
          if (url) { document.execCommand('createLink', false, url); onEdit(); }
        });
        return;
      }
      default: document.execCommand(cmd);
    }
    onEdit(); updateToolbar();
  }
  // ---------- Text colour, font and size ----------
  // The browser's own commands, written as <font> tags: they split and merge across a selection correctly, and also
  // work at the cursor for what you type next. Colours read well on both the light and dark themes.
  const FMT_COLORS = [['Red', '#e5484d'], ['Orange', '#e8890c'], ['Amber', '#c98a00'], ['Green', '#30a46c'], ['Teal', '#12a594'], ['Blue', '#3b82f6'], ['Purple', '#8e4ec6'], ['Pink', '#d6409f'], ['Grey', '#8b8d98']];
  const FMT_FONTS = [['Default', ''], ['Serif', 'Georgia, serif'], ['Mono', 'Menlo, Consolas, monospace'], ['Hand', 'Bradley Hand, Segoe Script, cursive']];
  const FMT_SIZES = [['Small', '2'], ['Normal', '3'], ['Large', '5'], ['Huge', '6']];
  const CLEAR_COLOR = '#010203', CLEAR_FACE = 'notes-default';   // stand-ins that mean "back to normal"; removed by tidyFormatting
  function tidyFormatting(root) {
    const fonts = root.querySelectorAll('font');
    if (!fonts.length) return;
    const sel = getSelection(), a = sel.anchorNode, ao = sel.anchorOffset, f = sel.focusNode, fo = sel.focusOffset;
    let moved = false;
    fonts.forEach((el) => {
      if (/^(#010203|rgb\(1, 2, 3\))$/i.test(el.getAttribute('color') || '')) el.removeAttribute('color');
      if (el.getAttribute('face') === CLEAR_FACE) el.removeAttribute('face');
      if (el.getAttribute('size') === '3') el.removeAttribute('size');
      if (!el.attributes.length) { el.replaceWith(...el.childNodes); moved = true; }
    });
    if (moved && a && f && root.contains(a) && root.contains(f)) sel.setBaseAndExtent(a, ao, f, fo);
  }
  let fmtPop = null;
  function closeFormat() { if (fmtPop) { fmtPop.el.remove(); fmtPop = null; } }
  function toggleFormat(btn) {
    if (fmtPop) return closeFormat();
    const sel = getSelection();
    const saved = sel.rangeCount && $('#editor').contains(sel.anchorNode) ? sel.getRangeAt(0).cloneRange() : null;
    const el = document.createElement('div');
    el.className = 'fmt-pop'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Text colour, font and size');
    el.innerHTML = `
      <div class="fmt-label">Colour</div>
      <div class="fmt-row"><button data-k="color" data-v="" class="fmt-swatch clear" title="Default colour" aria-label="Default colour"></button>${FMT_COLORS.map(([n, c]) => `<button data-k="color" data-v="${c}" class="fmt-swatch" style="background:${c}" title="${n}" aria-label="${n}"></button>`).join('')}</div>
      <div class="fmt-label">Font</div>
      <div class="fmt-row">${FMT_FONTS.map(([n, f]) => `<button data-k="font" data-v="${f}" style="font-family:${f || 'inherit'}">${n}</button>`).join('')}</div>
      <div class="fmt-label">Size</div>
      <div class="fmt-row">${FMT_SIZES.map(([n, s]) => `<button data-k="size" data-v="${s}">${n}</button>`).join('')}</div>`;
    document.body.appendChild(el);
    const r = btn.getBoundingClientRect(), w = el.getBoundingClientRect().width;
    el.style.left = Math.max(8, Math.min(r.left, innerWidth - w - 8)) + 'px';
    el.style.top = r.bottom + 4 + 'px';
    el.addEventListener('mousedown', (e) => e.preventDefault());           // keeps your text selected
    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-k]'); if (!b) return;
      const ed = $('#editor');
      ed.focus();
      if (!ed.contains(getSelection().anchorNode) && saved) { getSelection().removeAllRanges(); getSelection().addRange(saved); }
      document.execCommand('styleWithCSS', false, false);
      if (b.dataset.k === 'color') document.execCommand('foreColor', false, b.dataset.v || CLEAR_COLOR);
      if (b.dataset.k === 'font') document.execCommand('fontName', false, b.dataset.v || CLEAR_FACE);
      if (b.dataset.k === 'size') document.execCommand('fontSize', false, b.dataset.v);
      onEdit();
    });
    fmtPop = { el, btn };
  }
  document.addEventListener('mousedown', (e) => { if (fmtPop && !fmtPop.el.contains(e.target) && !fmtPop.btn.contains(e.target)) closeFormat(); }, true);
  document.addEventListener('keydown', (e) => { if (fmtPop && e.key === 'Escape') { closeFormat(); } }, true);

  // Headings picker: one toolbar button opens a list where each heading is shown at its real size,
  // biggest (Heading 1) to smallest (Heading 6), with Normal text to turn a heading back into a paragraph.
  let headPop = null;
  function closeHeadings() { if (headPop) { headPop.el.remove(); headPop = null; } }
  function toggleHeadings(btn) {
    if (headPop) return closeHeadings();
    closeFormat();
    const sel = getSelection();
    const saved = sel.rangeCount && $('#editor').contains(sel.anchorNode) ? sel.getRangeAt(0).cloneRange() : null;
    let cur = '';
    try { cur = (document.queryCommandValue('formatBlock') || '').toLowerCase().replace(/[<>]/g, ''); } catch {}
    const rows = [['div', 'Normal text', 15, 400], ['h1', 'Heading 1', 30, 700], ['h2', 'Heading 2', 22, 700], ['h3', 'Heading 3', 18, 700], ['h4', 'Heading 4', 16, 700], ['h5', 'Heading 5', 13, 700], ['h6', 'Heading 6', 11, 700]];
    const el = document.createElement('div');
    el.className = 'fmt-pop head-pop'; el.setAttribute('role', 'menu'); el.setAttribute('aria-label', 'Headings');
    el.innerHTML = rows.map(([tag, name, size, weight]) => `<button data-tag="${tag}" role="menuitem" style="font-size:${size}px;font-weight:${weight}"${cur === tag || (tag === 'div' && (cur === 'div' || cur === 'p' || cur === '')) ? ' class="on"' : ''}>${name}</button>`).join('');
    document.body.appendChild(el);
    const r = btn.getBoundingClientRect(), w = el.getBoundingClientRect().width;
    el.style.left = Math.max(8, Math.min(r.left, innerWidth - w - 8)) + 'px';
    el.style.top = r.bottom + 4 + 'px';
    el.addEventListener('mousedown', (e) => e.preventDefault());           // keeps your text selected
    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-tag]'); if (!b) return;
      const tag = b.dataset.tag;
      closeHeadings();
      ed().focus();
      if (!ed().contains(getSelection().anchorNode) && saved) { getSelection().removeAllRanges(); getSelection().addRange(saved); }
      if (tag === 'div') document.execCommand('formatBlock', false, 'div');
      else block(tag);
      onEdit(); updateToolbar();
    });
    headPop = { el, btn };
  }
  document.addEventListener('mousedown', (e) => { if (headPop && !headPop.el.contains(e.target) && !headPop.btn.contains(e.target)) closeHeadings(); }, true);
  document.addEventListener('keydown', (e) => { if (headPop && e.key === 'Escape') { closeHeadings(); } }, true);

  // Wrap the selected text in <mark> (or unwrap if it is all highlighted already). execCommand's hiliteColor
  // can't take our theme colour, so this works on the DOM directly and handles multi-paragraph selections.
  function toggleHighlight() {
    const sel = getSelection();
    if (!sel.rangeCount || sel.isCollapsed) return;
    const r = sel.getRangeAt(0);
    if (!ed().contains(r.commonAncestorContainer)) return;
    const scope = r.commonAncestorContainer.nodeType === 3 ? r.commonAncestorContainer.parentNode : r.commonAncestorContainer;
    const parts = [];
    const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (!r.intersectsNode(n)) continue;
      const from = n === r.startContainer ? r.startOffset : 0;
      const to = n === r.endContainer ? r.endOffset : n.nodeValue.length;
      if (to > from) parts.push({ n, from, to });
    }
    if (!parts.length) return;
    const markOf = (n) => n.parentNode.closest && n.parentNode.closest('mark');
    const out = document.createRange();
    if (parts.every(({ n }) => markOf(n))) {                 // everything is highlighted: remove it
      new Set(parts.map(({ n }) => markOf(n))).forEach((m) => {
        const p = m.parentNode;
        while (m.firstChild) p.insertBefore(m.firstChild, m);
        p.removeChild(m);
      });
      out.setStartBefore(parts[0].n); out.setEndAfter(parts[parts.length - 1].n);
    } else {
      const marks = [];
      for (const { n, from, to } of parts) {
        if (markOf(n)) continue;
        let target = n;
        if (to < n.nodeValue.length) n.splitText(to);
        if (from > 0) target = n.splitText(from);
        const m = document.createElement('mark');
        target.parentNode.insertBefore(m, target); m.appendChild(target);
        marks.push(m);
      }
      out.setStartBefore(marks[0]); out.setEndAfter(marks[marks.length - 1]);
    }
    sel.removeAllRanges(); sel.addRange(out);
    // tidy: join neighbouring highlights and drop empty text fragments left by splitting
    ed().querySelectorAll('mark').forEach((m) => {
      while (m.nextSibling && m.nextSibling.nodeName === 'MARK') {
        const nx = m.nextSibling;
        while (nx.firstChild) m.appendChild(nx.firstChild);
        nx.remove();
      }
    });
  }
  function updateToolbar() {
    document.querySelectorAll('#toolbar [data-cmd]').forEach((b) => {
      const c = b.dataset.cmd;
      let on = false;
      try {
        if (['bold', 'italic', 'underline', 'strikeThrough'].includes(c)) on = document.queryCommandState(c);
        else if (c === 'ul') on = document.queryCommandState('insertUnorderedList');
        else if (c === 'ol') on = document.queryCommandState('insertOrderedList');
        else if (c === 'headings') on = /^h[1-6]$/.test((document.queryCommandValue('formatBlock') || '').toLowerCase().replace(/[<>]/g, ''));
        else if (c === 'highlight') { const a = getSelection().anchorNode; on = !!(a && (a.nodeType === 3 ? a.parentNode : a).closest('mark')); }
      } catch {}
      b.classList.toggle('on', on);
    });
  }

  // Markdown-style shortcuts: "# ", "## ", "- ", "1. ", "[] "
  function markdownShortcut() {
    const sel = getSelection(); if (!sel.rangeCount || !sel.isCollapsed) return false;
    let b = sel.anchorNode;
    while (b && b.parentNode !== ed()) b = b.parentNode;
    if (!b) return false;
    if (b.nodeType === 3) {                     // bare text directly in the editor: wrap it
      if (!/^(#{1,3}|[-*>]|1\.|\[\])[  ]$/.test(b.nodeValue)) return false;
      const w = document.createElement('div');
      b.replaceWith(w); w.appendChild(b); b = w;
    }
    const txt = b.textContent.replace(/ /g, ' ');
    const m = txt.match(/^(#{1,3}|[-*>]|1\.|\[\]) $/);
    if (!m) return false;
    b.innerHTML = '<br>';
    const r = document.createRange(); r.setStart(b, 0); r.collapse(true); sel.removeAllRanges(); sel.addRange(r);
    const k = m[1];
    if (k === '#') block('h1'); else if (k === '##') block('h2'); else if (k === '###') block('h3'); else if (k === '>') block('blockquote');
    else if (k === '1.') document.execCommand('insertOrderedList');
    else if (k === '[]') toggleCheck();
    else document.execCommand('insertUnorderedList');
    return true;
  }

  // ---------- Export / import ----------
  function toMarkdown(root) {
    const walk = (n, ctx = {}) => {
      if (n.nodeType === 3) return n.nodeValue.replace(/ /g, ' ');
      if (n.nodeType !== 1) return '';
      const kids = (c) => [...n.childNodes].map((x) => walk(x, c || ctx)).join('');
      switch (n.tagName) {
        case 'H1': return '\n# ' + kids() + '\n\n';
        case 'H2': return '\n## ' + kids() + '\n\n';
        case 'H3': return '\n### ' + kids() + '\n\n';
        case 'FIGURE': return n.classList.contains('att') ? `${n.dataset.kind === 'image' ? '!' : ''}[${n.dataset.name || 'file'}](${encodeURI(n.dataset.name || 'file')})\n\n` : kids();
        case 'TABLE': {
          const rows = [...n.rows].map((r) => '| ' + [...r.cells].map((c) => c.textContent.trim().replace(/\|/g, '\\|')).join(' | ') + ' |');
          if (rows.length) rows.splice(1, 0, '| ' + [...n.rows[0].cells].map(() => '---').join(' | ') + ' |');
          return '\n' + rows.join('\n') + '\n\n';
        }
        case 'B': case 'STRONG': return '**' + kids() + '**';
        case 'I': case 'EM': return '*' + kids() + '*';
        case 'S': case 'STRIKE': case 'DEL': return '~~' + kids() + '~~';
        case 'MARK': return '==' + kids() + '==';
        case 'CODE': return '`' + kids() + '`';
        case 'PRE': return '\n```\n' + n.textContent + '\n```\n\n';
        case 'A': return n.classList.contains('nlink') ? `[[${n.textContent.trim()}]]` : '[' + kids() + '](' + n.getAttribute('href') + ')';
        case 'BR': return '\n';
        case 'HR': return '---\n\n';
        case 'BLOCKQUOTE': return '\n' + kids().trim().split('\n').map((l) => '> ' + l).join('\n') + '\n\n';
        case 'UL': case 'OL': {
          const chk = n.classList.contains('checklist');
          return '\n' + [...n.children].map((li, i) =>
            (n.tagName === 'OL' ? (i + 1) + '. ' : chk ? (li.classList.contains('done') ? '- [x] ' : '- [ ] ') : '- ') + walk(li).trim()).join('\n') + '\n\n';
        }
        case 'LI': return kids();
        case 'DIV': case 'P':
          if (n.classList.contains('callout')) return `> [!note] ${n.dataset.icon || ''} ${kids().trim().replace(/\n/g, '\n> ')}\n\n`;
          if (n.classList.contains('blk-doc')) { const d = byId(n.dataset.note); return d ? `[[${info(d).title}]]\n\n` : ''; }
          if (n.classList.contains('blk-board') || n.classList.contains('blk-toc')) return '';
          if (n.classList.contains('tg-h')) return '- ' + kids().trim() + '\n';
          if (n.classList.contains('tg-b')) return kids().trim().split('\n').map((l) => '    ' + l).join('\n') + '\n\n';
          return kids() + '\n';
        default: return kids();
      }
    };
    return walk(root).replace(/\n{3,}/g, '\n\n').trim() + '\n';
  }
  function download(name, text, type) {                 // a Save dialog in the Mac app; a normal download elsewhere
    Exporter.save(name, new Blob([text], { type }));
  }

  // ---------- Events ----------
  let tap = null;                                        // phones: the first tap of a possible double-tap
  $('#notes').addEventListener('click', (e) => {
    const el = e.target.closest('.note'); if (!el || e.target.closest('.rename-input')) return;
    const more = e.target.closest('.note-more');
    if (more) {                                          // ⋮: the same menu as right-click, under the button
      e.stopPropagation();
      if (ctx && ctx.id === el.dataset.id) { closeMenu(); return; }
      const r = more.getBoundingClientRect();
      openNoteMenu(el.dataset.id, r.right - 230, r.bottom + 4);
      return;
    }
    // Two clicks / taps on the same note within DOUBLE ms rename it. Timed here rather than with the browser's
    // dblclick: the first click opens the note and redraws the list, and a dblclick across that redraw never fires.
    const id = el.dataset.id, now = Date.now(), second = tap && tap.id === id && now - tap.at < DOUBLE;
    if (tap) clearTimeout(tap.t);
    if (second) { tap = null; startRename(id); return; }
    if (innerWidth <= 900) {                             // phones: opening hides the list, so wait to see if a second tap comes
      tap = { id, at: now, t: setTimeout(() => { tap = null; openNote(id); }, DOUBLE) };
      return;
    }
    tap = { id, at: now, t: null };
    openNote(id);
  });
  const DOUBLE = 400;

  // ---------- Right-click menu for notes ----------
  function duplicateNote(id) {
    const src = byId(id); if (!src) return;
    tmp.innerHTML = src.html;
    const first = [...tmp.querySelectorAll('h1, h2, div, p, li')].find((el) => el.textContent.trim()) ||
      (tmp.textContent.trim() ? tmp : null);
    if (first) first.appendChild(document.createTextNode(' (copy)'));
    const now = Date.now();
    const n = { id: uid(), folder: src.folder, pinned: false, trashed: false, created: now, updated: now, html: first ? tmp.innerHTML : src.html };
    state.notes.splice(state.notes.indexOf(src) + 1, 0, n);
    persist(); renderAll(); openNote(n.id);
    Planner.toast('Note duplicated');
  }
  function moveNote(id, folder) {
    const n = byId(id); if (!n) return;
    n.folder = folder || null; touch(n); persist(); renderAll();
    if (id === currentId) renderActions();
    const f = state.folders.find((x) => x.id === folder);
    Planner.toast(f ? `Moved to ${f.name}` : 'Removed from folder');
  }
  // Rename: a note's name is its first line, so renaming rewrites that line (keeping its heading style).
  function setTitle(n, title) {
    tmp.innerHTML = n.html || '';
    const walker = document.createTreeWalker(tmp, NodeFilter.SHOW_TEXT, { acceptNode: (t) => (t.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP) });
    const first = walker.nextNode();
    if (!first) { n.html = `<h1>${esc(title)}</h1><div><br></div>` + (n.html || ''); return; }
    const block = first.parentElement.closest('h1, h2, h3, h4, h5, h6, p, li, blockquote, pre, td, th, div') || tmp;
    const host = tmp.contains(block) ? block : tmp;
    // the first line ends at the first <br> or block inside it
    const nodes = [];
    for (const c of host.childNodes) { if (c.nodeName === 'BR' || /^(DIV|P|UL|OL|H\d|BLOCKQUOTE|PRE|TABLE|FIGURE)$/.test(c.nodeName)) break; nodes.push(c); }
    const at = nodes.length ? nodes[0] : host.firstChild;
    host.insertBefore(document.createTextNode(title), at);
    nodes.forEach((c) => c.remove());
    n.html = tmp.innerHTML;
  }
  function renameNote(id, title) {
    const n = byId(id); title = title.trim();
    if (!n || !title || title === info(n).title) return;
    setTitle(n, title); touch(n);
    if (n.locked) { seal(n, n.html, unlocked).then(() => { persist(); renderAll(); }); } else persist();
    if (id === currentId) openNote(id); else renderAll();
    Planner.toast('Renamed');
  }
  function startRename(id) {
    const n = byId(id); if (!n || n.trashed || (n.locked && !isUnlocked(id))) return;
    closeMenu();
    if (renaming) finishRename(true);
    const row = document.querySelector(`.note[data-id="${id}"]`); if (!row) return;
    const t = row.querySelector('.t');
    const input = document.createElement('input');
    input.className = 'rename-input'; input.value = info(n).title === 'New note' && !info(n).text ? '' : info(n).title;
    input.placeholder = 'Note name'; input.setAttribute('aria-label', 'Note name');
    t.replaceChildren(input);
    renaming = { id, input, stale: false };
    input.focus(); input.select();
    input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') { e.preventDefault(); finishRename(true); }
      if (e.key === 'Escape') { e.preventDefault(); finishRename(false); }
    });
    input.addEventListener('blur', () => finishRename(true));
    input.addEventListener('click', (e) => e.stopPropagation());
    input.addEventListener('dblclick', (e) => e.stopPropagation());
  }
  function finishRename(save) {
    if (!renaming) return;
    const { id, input } = renaming;
    renaming = null;
    if (save) renameNote(id, input.value);
    renderList();
  }
  function togglePinTop(id) {
    const n = byId(id); if (!n) return;
    n.pinTop = !n.pinTop; touch(n); persist(); renderAll();
    Planner.toast(n.pinTop ? 'Pinned to the top' : 'Unpinned');
  }
  function setArchived(id, flag) {
    const n = byId(id); if (!n) return;
    n.archived = flag; touch(n); persist();
    if (id === currentId && flag !== (view.type === 'archive')) openNote(null);
    renderAll();
    Planner.toast(flag ? 'Archived: find it under Archive in the sidebar' : 'Moved back to Notes');
  }
  function togglePin(id) {
    const n = byId(id); if (!n) return;
    n.pinned = !n.pinned; touch(n); persist(); renderAll();
    if (id === currentId) renderActions();
  }
  async function copyNoteText(id) {
    const n = byId(id); if (!n) return;
    const text = textLines(n.html).join('\n');
    try { await navigator.clipboard.writeText(text); }
    catch {                                            // older WebViews: fall back to a hidden textarea
      const ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
    }
    Planner.toast('Note text copied');
  }

  let ctx = null;
  function closeMenu() {
    if (!ctx) return;
    clearTimeout(ctx.hoverT);
    closeSub();
    ctx.el.remove();
    document.querySelectorAll('.note.ctx-target').forEach((x) => x.classList.remove('ctx-target'));
    removeEventListener('blur', closeMenu);
    ctx = null;
  }
  const exportItems = (id) => Exporter.FORMATS.map((f) => ({ label: f.label, icon: f.icon, run: () => Exporter.run(f.k, id) }));
  const mergeTargets = (n) => {
    const others = state.notes.filter((x) => x.id !== n.id && !x.deleted && !x.trashed && !x.locked)
      .sort((a, b) => b.updated - a.updated).slice(0, 12);
    return others.length ? others.map((x) => ({ label: info(x).title, icon: '📄', run: () => Extras.mergeInto(n.id, x.id) }))
      : [{ label: 'No other notes to merge into', icon: '', run: () => {} }];
  };
  function noteMenuItems(n) {
    if (n.trashed) return [
      { label: 'Restore', icon: '↩', run: () => trash(n.id, false) },
      { sep: true },
      { label: 'Delete permanently…', icon: '✕', danger: true, run: () => deleteForever(n.id) },
    ];
    const folders = state.folders.filter((f) => !f.deleted);
    const sealed = n.locked && !isUnlocked(n.id);
    const contentsOnly = new Set(sealed ? ['Rename', 'Duplicate', 'Share…', 'Copy text', 'Export', 'Version history…', 'Merge with another note…', 'Publish to web…', 'Publish to web ✓'] : n.locked ? ['Duplicate'] : []);   // need the text, or would copy it unencrypted
    return [
      { label: 'Open', icon: '↗', run: () => openNote(n.id) },
      { label: 'Rename', icon: '✎', run: () => startRename(n.id) },
      { label: n.pinTop ? 'Unpin' : 'Pin to top', icon: PIN_SVG, run: () => togglePinTop(n.id) },
      { label: n.pinned ? 'Remove from Favorites' : 'Add to Favorites', icon: n.pinned ? '☆' : '★', run: () => togglePin(n.id) },
      { label: 'Duplicate', icon: '⧉', run: () => duplicateNote(n.id) },
      { label: 'Move to folder', icon: '▤', sub: [{ label: 'No folder', icon: n.folder ? '' : '✓', run: () => moveNote(n.id, null) }]
        .concat(folders.map((f) => ({ label: f.name, icon: n.folder === f.id ? '✓' : '', run: () => moveNote(n.id, f.id) }))) },
      { sep: true },
      { label: 'Create task from note', icon: '☑', run: () => Planner.taskFromNote(n.id, info(n).title) },
      { label: 'Share…', icon: Media.ICONS.share, run: () => Media.share(n.id) },
      { label: 'Copy text', icon: '⎘', run: () => copyNoteText(n.id) },
      { label: 'Export', icon: '⤓', sub: exportItems(n.id) },
      { label: 'Version history…', icon: '↺', run: () => Extras.history(n.id) },
      { label: 'Merge with another note…', icon: '⇄', sub: mergeTargets(n) },
      { label: n.pub ? 'Publish to web ✓' : 'Publish to web…', icon: '🌐', run: () => Extras.publish(n.id) },
      { sep: true },
      ...(n.locked ? (sealed ? [] : [{ label: 'Lock now', icon: LOCK_MARK, run: () => lockNow(n.id) }, { label: 'Remove lock', icon: LOCK_MARK, run: () => removeLock(n.id) },
        { label: Extras.hasBio(n.id) ? 'Turn off fingerprint / Face ID' : 'Fingerprint / Face ID unlock…', icon: LOCK_MARK, run: () => (Extras.hasBio(n.id) ? Extras.bioDisable(n.id) : Extras.bioEnable(n.id)) }])
        : [{ label: 'Lock with password…', icon: LOCK_MARK, run: () => askLockPassword(n.id) }]),
      { label: n.archived ? 'Unarchive' : 'Archive', icon: ICON_SVG('archive'), run: () => setArchived(n.id, !n.archived) },
      { label: 'Move to Trash', icon: '🗑', run: () => trash(n.id, true) },
      { label: 'Delete permanently…', icon: '✕', danger: true, run: () => deleteForever(n.id) },
    ].filter((it) => !contentsOnly.has(it.label));
  }
  const ICON_SVG = (k) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[k]}</svg>`;
  const menuHTML = (items) => items.map((it, i) => it.sep ? '<div class="ctx-sep" role="separator"></div>'
    : `<button class="ctx-item${it.danger ? ' danger' : ''}" data-i="${i}" role="menuitem"${it.sub ? ' aria-haspopup="true"' : ''}><span class="ctx-ic">${it.icon || ''}</span>${esc(it.label)}${it.sub ? '<span class="ctx-more">›</span>' : ''}</button>`).join('');
  function menuKeys(e, el, onLeft) {                 // arrow keys move between items; returns true if handled
    const btns = [...el.querySelectorAll('.ctx-item')], i = btns.indexOf(document.activeElement);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); btns[(i + (e.key === 'ArrowDown' ? 1 : -1) + btns.length) % btns.length].focus(); return true; }
    if (e.key === 'ArrowLeft' && onLeft) { e.preventDefault(); onLeft(); return true; }
    if (e.key === 'Escape') { e.preventDefault(); closeMenu(); return true; }
    if (e.key === 'Tab') { e.preventDefault(); return true; }
    return false;
  }
  // submenus (Move to folder ›, Export ›) open beside their item on hover, click, or →
  function openSub(btn, focusFirst) {
    const parent = ctx.items[+btn.dataset.i];
    if (!parent || !parent.sub) return;
    if (ctx.sub && ctx.sub.btn === btn) { if (focusFirst) ctx.sub.el.querySelector('.ctx-item').focus(); return; }
    closeSub();
    const sub = document.createElement('div');
    sub.className = 'ctx-menu ctx-sub'; sub.setAttribute('role', 'menu'); sub.setAttribute('aria-label', parent.label);
    sub.innerHTML = menuHTML(parent.sub);
    document.body.appendChild(sub);
    btn.classList.add('open'); btn.setAttribute('aria-expanded', 'true');
    const m = ctx.el.getBoundingClientRect(), r = btn.getBoundingClientRect(), sr = sub.getBoundingClientRect();
    let left = m.right - 4;
    if (left + sr.width > innerWidth - 8) left = Math.max(8, m.left - sr.width + 4);      // no room on the right: open to the left
    sub.style.left = left + 'px';
    sub.style.top = Math.max(8, Math.min(r.top - 6, innerHeight - sr.height - 8)) + 'px';
    ctx.sub = { el: sub, btn, items: parent.sub };
    sub.addEventListener('mouseenter', () => { clearTimeout(ctx.hoverT); });
    ['mouseover', 'pointermove'].forEach((ev) => sub.addEventListener(ev, (e) => {
      clearTimeout(ctx.hoverT);
      const b = e.target.closest && e.target.closest('.ctx-item');
      if (b && document.activeElement !== b) b.focus({ preventScroll: true });
    }));
    sub.addEventListener('click', (e) => {
      const b = e.target.closest('.ctx-item'); if (!b) return;
      const it = parent.sub[+b.dataset.i];
      closeMenu(); it.run();
    });
    sub.addEventListener('keydown', (e) => menuKeys(e, sub, () => { const back = ctx.sub.btn; closeSub(); back.focus(); }));
    if (focusFirst) sub.querySelector('.ctx-item').focus();
  }
  function closeSub() {
    if (!ctx || !ctx.sub) return;
    ctx.sub.el.remove();
    ctx.sub.btn.classList.remove('open'); ctx.sub.btn.removeAttribute('aria-expanded');
    ctx.sub = null;
  }
  function openNoteMenu(id, x, y, only) {
    closeMenu();
    const n = byId(id); if (!n) return;
    const el = document.createElement('div');
    el.className = 'ctx-menu'; el.setAttribute('role', 'menu'); el.setAttribute('aria-label', 'Note actions');
    document.body.appendChild(el);
    ctx = { el, id, items: only || noteMenuItems(n), sub: null, hoverT: null };
    el.innerHTML = menuHTML(ctx.items);
    const row = document.querySelector(`.note[data-id="${id}"]`); if (row) row.classList.add('ctx-target');
    const r = el.getBoundingClientRect();
    el.style.left = Math.max(8, Math.min(x, innerWidth - r.width - 8)) + 'px';
    el.style.top = Math.max(8, Math.min(y, innerHeight - r.height - 8)) + 'px';
    const first = el.querySelector('.ctx-item'); if (first) first.focus();
    // hover: open a submenu after a short pause; leaving for another item closes it after a grace period,
    // so cutting across a corner on the way into the submenu doesn't close it
    let hovered = null;
    const onHover = (e) => {
      const b = e.target.closest && e.target.closest('.ctx-item');
      if (!b || b === hovered) return;
      hovered = b;
      b.focus({ preventScroll: true });              // one highlight that follows the mouse, like a Mac menu
      clearTimeout(ctx.hoverT);
      if (b.getAttribute('aria-haspopup')) ctx.hoverT = setTimeout(() => openSub(b), 120);
      else if (ctx.sub) ctx.hoverT = setTimeout(closeSub, 250);
    };
    ['mouseover', 'mousemove', 'pointerover', 'pointermove'].forEach((ev) => el.addEventListener(ev, onHover));
    el.addEventListener('mouseleave', () => { hovered = null; });
    el.addEventListener('click', (e) => {
      const b = e.target.closest('.ctx-item'); if (!b) return;
      const it = ctx.items[+b.dataset.i];
      if (it.sub) { clearTimeout(ctx.hoverT); openSub(b, true); return; }
      closeMenu(); it.run();
    });
    el.addEventListener('keydown', (e) => {
      const a = document.activeElement;
      if (e.key === 'ArrowRight' && a.getAttribute('aria-haspopup')) { e.preventDefault(); openSub(a, true); return; }
      if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && ctx.sub) closeSub();
      menuKeys(e, el);
    });
    addEventListener('blur', closeMenu);
  }
  $('#notes').addEventListener('contextmenu', (e) => {
    const el = e.target.closest('.note'); if (!el) return;
    e.preventDefault();
    openNoteMenu(el.dataset.id, e.clientX, e.clientY);
  });
  // touch screens: long-press a note
  let pressTimer = null;
  $('#notes').addEventListener('touchstart', (e) => {
    const el = e.target.closest('.note'); if (!el) return;
    const t = e.touches[0];
    pressTimer = setTimeout(() => { pressTimer = null; openNoteMenu(el.dataset.id, t.clientX, t.clientY); }, 550);
  }, { passive: true });
  ['touchend', 'touchmove', 'touchcancel'].forEach((ev) => $('#notes').addEventListener(ev, (e) => {
    if (pressTimer) clearTimeout(pressTimer);
    else if (ev === 'touchend' && ctx) e.preventDefault();      // don't also open the note after a long-press
    pressTimer = null;
  }));
  // keyboard: the context-menu key or Shift+F10 on a focused note
  $('#notes').addEventListener('keydown', (e) => {
    const el = e.target.closest('.note'); if (!el) return;
    if (e.target.closest('.rename-input')) return;
    if (e.key === 'F2') { e.preventDefault(); startRename(el.dataset.id); return; }
    if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) { e.preventDefault(); const r = el.getBoundingClientRect(); openNoteMenu(el.dataset.id, r.left + 24, r.bottom - 4); }
    else if (e.key === 'Enter') openNote(el.dataset.id);
  });
  document.addEventListener('mousedown', (e) => {
    if (ctx && !ctx.el.contains(e.target) && !(ctx.sub && ctx.sub.el.contains(e.target)) && !e.target.closest('.note-more')) closeMenu();   // ⋮ toggles it itself
  }, true);
  document.addEventListener('scroll', () => closeMenu(), true);
  $('#app').addEventListener('click', (e) => {
    if (e.target.closest('.sidebar')) {
      const del = e.target.closest('[data-del-folder]');
      const nav = e.target.closest('.nav[data-type]');
      if (del && nav) {
        const f = state.folders.find((x) => x.id === nav.dataset.id);
        if (f && confirm(`Delete folder "${f.name}"? Its notes move to All Notes.`)) {
          f.deleted = true; f.updated = Date.now();
          state.notes.forEach((n) => { if (n.folder === f.id) { n.folder = null; touch(n); } });
          persist();
          if (view.type === 'folder' && view.id === f.id) setView('all'); else { renderAll(); renderActions(); }
        }
        return;
      }
      if (nav) setView(nav.dataset.type, nav.dataset.id || undefined);
    } else if (!e.target.closest('#menuBtn, .pl-menu')) $('#app').classList.remove('show-side');
  });
  // Hide / show the sidebar. Wide windows: it folds away and stays that way after a restart. Phones: it slides over.
  const SIDE_KEY = KEY + '-side-hidden';
  const SIDE_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="3"/><path d="M9.5 4v16M5.8 8.5h1M5.8 12h1"/></svg>';
  const sideLabel = () => {
    const shown = innerWidth > 900 ? !$('#app').classList.contains('hide-side') : $('#app').classList.contains('show-side');
    return `${shown ? 'Hide' : 'Show'} sidebar (${navigator.platform.startsWith('Mac') ? '⌘' : 'Ctrl+'}\\)`;
  };
  function labelSideButtons() {
    const label = sideLabel();
    document.querySelectorAll('#menuBtn, .pl-menu').forEach((b) => { b.title = label; b.setAttribute('aria-label', label); });
  }
  function toggleSidebar() {
    const app = $('#app');
    if (innerWidth > 900) {
      const hidden = app.classList.toggle('hide-side');
      try { hidden ? localStorage.setItem(SIDE_KEY, '1') : localStorage.removeItem(SIDE_KEY); } catch {}
    } else app.classList.toggle('show-side');
  }
  new MutationObserver(labelSideButtons).observe($('#app'), { attributes: true, attributeFilter: ['class'] });   // also when a tap elsewhere closes it
  window.notesToggleSidebar = toggleSidebar;                // the Mac app's View menu
  try { if (localStorage.getItem(SIDE_KEY)) $('#app').classList.add('hide-side'); } catch {}
  $('#menuBtn').innerHTML = SIDE_ICON;
  $('#menuBtn').onclick = toggleSidebar;
  addEventListener('resize', labelSideButtons);
  addEventListener('keydown', (e) => { if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && e.key === '\\') { e.preventDefault(); toggleSidebar(); } });
  labelSideButtons();
  $('#launchBtn').onclick = () => Planner.openLauncher();
  $('#backBtn').onclick = () => openNote(null);
  $('#lockBtn').onclick = () => { const n = byId(currentId); if (n) (n.locked ? lockNow(n.id) : askLockPassword(n.id)); };
  $('#lockBack').onclick = () => openNote(null);
  $('#lockScreen').addEventListener('submit', async (e) => {
    e.preventDefault();
    const n = byId(currentId), go = $('#lockGo'), err = $('#lockErr');
    if (!n || !n.enc) return;
    go.disabled = true; go.textContent = 'Unlocking…'; err.textContent = '';
    try {
      const salt = b64ToBytes(n.enc.salt), key = await lockKey($('#lockPass').value, salt, n.enc.it);
      n.html = await openSealed(n.enc, key);             // fails if the password is wrong
      unlocked = { id: n.id, key, salt, it: n.enc.it, dirty: false };
      openNote(n.id);
    } catch { err.textContent = 'That password isn\u2019t right.'; $('#lockPass').select(); }
    go.disabled = false; go.textContent = 'Unlock';
  });
  // after 5 minutes without touching the app, an open locked note closes again (also after the app was in the background)
  let lastActive = Date.now();
  ['pointerdown', 'keydown'].forEach((ev) => addEventListener(ev, () => { lastActive = Date.now(); }, true));
  const relockIfIdle = () => { if (unlocked && Date.now() - lastActive > LOCK_AFTER) { const id = unlocked.id; relock(); if (currentId === id) openNote(id); } };
  setInterval(relockIfIdle, 15000);
  document.addEventListener('visibilitychange', relockIfIdle);
  $('#newNote').onclick = newNote;
  $('#emptyNew').onclick = newNote;
  // New sketch: a note titled "Sketch" with the drawing pad open; cancelling without drawing removes the empty note
  $('#newSketch').onclick = () => {
    newNote();
    const id = currentId, ed = $('#editor');
    ed.innerHTML = '<h1>Sketch</h1><div><br></div>';
    onEdit();
    const r = document.createRange(); r.selectNodeContents(ed.lastChild); r.collapse(true);
    getSelection().removeAllRanges(); getSelection().addRange(r);
    Media.addSketch({ onCancel: () => {
      const n = byId(id); if (!n || /<figure/.test(n.html)) return;
      n.deleted = true; n.html = ''; touch(n); persist();          // a tombstone, in case it already synced
      if (currentId === id) openNote(null);
      renderAll();
    } });
  };
  $('#tabbar').onclick = (e) => { const b = e.target.closest('[data-tab]'); if (b) setView(b.dataset.tab); };
  renderTabbar();

  // Appearance: System (default) follows the OS and keeps following it as it changes; Light and Dark are fixed.
  const darkMQ = matchMedia('(prefers-color-scheme: dark)');
  const THEMES = [
    ['light', 'Light', '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'],
    ['dark', 'Dark', '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>'],
    ['system', 'System', '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>'],
  ];
  const themePref = () => { try { const t = localStorage.getItem('notes-theme'); return t === 'light' || t === 'dark' ? t : 'system'; } catch (e) { return 'system'; } };
  function applyTheme() {
    const pref = themePref();
    document.documentElement.dataset.theme = pref === 'system' ? (darkMQ.matches ? 'dark' : 'light') : pref;
    $('meta[name="theme-color"]').content = document.documentElement.dataset.theme === 'dark' ? '#202022' : '#faf9f6';
    $('#themeSeg').innerHTML = THEMES.map(([v, label, icon]) =>
      `<button data-theme="${v}" role="radio" aria-checked="${v === pref}" class="${v === pref ? 'on' : ''}" title="${label} appearance"><svg viewBox="0 0 24 24">${icon}</svg>${label}</button>`).join('');
  }
  function setTheme(pref) {
    try { pref === 'system' ? localStorage.removeItem('notes-theme') : localStorage.setItem('notes-theme', pref); } catch (e) {}
    if (native && native.setTheme) native.setTheme(pref);      // native title bar, menus and dialogs match too
    applyTheme();
  }
  $('#themeSeg').onclick = (e) => { const b = e.target.closest('button[data-theme]'); if (b) setTheme(b.dataset.theme); };
  darkMQ.addEventListener('change', applyTheme);
  if (native && native.setTheme) native.setTheme(themePref());
  applyTheme();
  $('#search').addEventListener('input', (e) => { query = e.target.value; renderList(); });

  $('#addFolder').onclick = () => {
    if ($('.folder-input')) return;
    const inp = document.createElement('input');
    inp.className = 'folder-input'; inp.placeholder = 'Folder name';
    $('#navFolders').appendChild(inp); inp.focus();
    const done = (ok) => {
      const name = inp.value.trim();
      inp.remove();
      if (ok && name) { state.folders.push({ id: uid(), name, updated: Date.now() }); persist(); renderAll(); renderActions(); }
    };
    inp.onkeydown = (e) => { if (e.key === 'Enter') done(true); if (e.key === 'Escape') done(false); };
    inp.onblur = () => inp.isConnected && done(true);
  };

  $('#toolbar').addEventListener('mousedown', (e) => e.preventDefault());
  $('#toolbar').addEventListener('click', (e) => {
    const b = e.target.closest('[data-cmd]'); if (b) run(b.dataset.cmd);
  });

  const editor = $('#editor');
  editor.addEventListener('input', (e) => {
    Blocks.onInput(e);                                   // "/" block menu and [[ note links
    if (e.inputType === 'insertText') markdownShortcut();
    onEdit();
  });
  // Auto-link: a web address typed or pasted into a note becomes a link when you press Space or Enter after it
  const URL_BEFORE_CARET = /(?:https?:\/\/|www\.)[^\s<>"]+$/i;
  function linkifyBeforeCaret() {
    const sel = getSelection();
    if (!sel.rangeCount || !sel.isCollapsed) return null;
    const node = sel.anchorNode, off = sel.anchorOffset;
    if (!node || node.nodeType !== 3 || !editor.contains(node) || node.parentElement.closest('a, pre, code')) return null;
    const m = node.nodeValue.slice(0, off).match(URL_BEFORE_CARET);
    if (!m) return null;
    const url = m[0].replace(/[.,;:!?'")\]}]+$/, '');        // a full stop or bracket after the address isn't part of it
    if (!/^(https?:\/\/[^/\s]+\.[^\s]|https?:\/\/localhost|www\.[^.\s]+\.[^\s])/i.test(url)) return null;
    const start = off - m[0].length;
    const r = document.createRange();
    r.setStart(node, start); r.setEnd(node, start + url.length);
    const a = document.createElement('a');
    a.href = /^www\./i.test(url) ? 'https://' + url : url;
    a.textContent = url;
    r.deleteContents(); r.insertNode(a);
    // the caret goes back to where it was: after the link and any punctuation that followed it
    const rest = a.nextSibling && a.nextSibling.nodeType === 3 ? a.nextSibling : null;
    const caret = document.createRange();
    if (rest) caret.setStart(rest, m[0].length - url.length); else caret.setStartAfter(a);
    caret.collapse(true); sel.removeAllRanges(); sel.addRange(caret);
    return { a, rest, at: m[0].length - url.length };
  }
  editor.addEventListener('keydown', (e) => {
    if (Blocks.onKeydown(e)) return;
    if ((e.key === ' ' || e.key === 'Enter') && !e.isComposing && !e.metaKey && !e.ctrlKey && !e.altKey) {
      const linked = linkifyBeforeCaret();
      if (linked && e.key === ' ') {
        // put the space in plain text after the link ourselves, so the link doesn't swallow what you type next
        e.preventDefault();
        const { a, rest, at } = linked;
        let node = rest, pos = at;
        if (node && pos < node.length) node.insertData(pos, ' ');
        else { node = document.createTextNode(' '); (rest || a).after(node); pos = 0; }
        const r = document.createRange(); r.setStart(node, pos + 1); r.collapse(true);
        getSelection().removeAllRanges(); getSelection().addRange(r);
        onEdit();
        return;
      }
      if (linked) onEdit();                               // Enter: the new line starts after the link, as usual
    }
    if (e.key === 'Enter') {
      // a new checklist item must start unchecked
      setTimeout(() => {
        const sel = getSelection(); if (!sel.anchorNode) return;
        const el = sel.anchorNode.nodeType === 3 ? sel.anchorNode.parentNode : sel.anchorNode;
        const li = el.closest && el.closest('ul.checklist li');
        if (li) li.classList.remove('done');
      }, 0);
    }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k' && !getSelection().isCollapsed) { e.preventDefault(); run('link'); }
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'h') { e.preventDefault(); run('highlight'); }
  });
  editor.addEventListener('click', (e) => {
    if (Blocks.onClick(e)) return;
    const li = e.target.closest && e.target.closest('ul.checklist li');
    if (li && e.offsetX < 26 && e.target === li) { li.classList.toggle('done'); onEdit(); return; }
    const a = e.target.closest && e.target.closest('a[href]');
    // a click opens a link, unless you were dragging to select its text; arrow keys still reach it to edit
    if (a && /^(https?|mailto|tel):/i.test(a.href) && getSelection().isCollapsed) { e.preventDefault(); window.open(a.href, '_blank', 'noopener'); }
  });
  document.addEventListener('selectionchange', () => { if (document.activeElement === editor) updateToolbar(); });
  editor.addEventListener('paste', (e) => {
    e.preventDefault();
    const cd = e.clipboardData || window.clipboardData;
    if (cd.files && cd.files.length) { Blocks.addFiles(cd.files); return; }   // pasted screenshots and files
    document.execCommand('insertText', false, cd.getData('text/plain'));     // text is pasted plain, to keep notes clean
  });
  editor.addEventListener('dragover', (e) => { if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) e.preventDefault(); });
  editor.addEventListener('drop', (e) => {
    if (!e.dataTransfer || !e.dataTransfer.files.length) return;
    e.preventDefault();
    const r = document.caretRangeFromPoint ? document.caretRangeFromPoint(e.clientX, e.clientY) : null;
    Blocks.addFiles(e.dataTransfer.files, r && editor.contains(r.startContainer) ? r : null);
  });
  $('#dailyBtn').onclick = () => Blocks.dailyNote();
  $('#importMd').onchange = (e) => { Blocks.importFiles(e.target.files); e.target.value = ''; };

  $('#pinBtn').onclick = () => { const n = byId(currentId); n.pinned = !n.pinned; touch(n); persist(); renderAll(); renderActions(); };
  $('#trashBtn').onclick = () => trash(currentId, true);
  $('#restoreBtn').onclick = () => trash(currentId, false);
  $('#deleteBtn').onclick = () => deleteForever(currentId);
  $('#shareBtn').onclick = () => { if (currentId) Media.share(currentId); };
  $('#exportBtn').onclick = (e) => {                     // the ⤓ button: same Export list as the right-click menu
    if (!currentId) return;
    const r = e.currentTarget.getBoundingClientRect();
    openNoteMenu(currentId, r.right - 230, r.bottom + 4, exportItems(currentId));
  };
  $('#exportAll').onclick = () => download('notes-backup-' + new Date().toISOString().slice(0, 10) + '.json', JSON.stringify(state, sealedOnly, 2), 'application/json');
  // One Import button: a small menu picks the format, then the matching (hidden) file input opens.
  let importPop = null;
  const closeImport = () => { if (importPop) { importPop.el.remove(); importPop = null; } };
  $('#importBtn').onclick = () => {
    if (importPop) return closeImport();
    const btn = $('#importBtn');
    const el = document.createElement('div');
    el.className = 'ctx-menu mini-pop'; el.setAttribute('role', 'menu'); el.setAttribute('aria-label', 'Import');
    el.innerHTML = `
      <button class="ctx-item" data-import="md" role="menuitem"><span class="ctx-ic"></span>Markdown / text (.md)</button>
      <button class="ctx-item" data-import="enex" role="menuitem"><span class="ctx-ic"></span>Evernote (.enex)</button>`;
    document.body.appendChild(el);
    const r = btn.getBoundingClientRect(), h = el.getBoundingClientRect().height;
    el.style.left = Math.max(8, Math.min(r.left, innerWidth - el.getBoundingClientRect().width - 8)) + 'px';
    el.style.top = Math.max(8, r.top - h - 4) + 'px';       // opens upward: the button sits at the foot of the sidebar
    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-import]'); if (!b) return;
      closeImport();
      (b.dataset.import === 'enex' ? $('#importEnex') : $('#importMd')).click();
    });
    importPop = { el, btn };
  };
  document.addEventListener('mousedown', (e) => { if (importPop && !importPop.el.contains(e.target) && !importPop.btn.contains(e.target)) closeImport(); }, true);
  document.addEventListener('keydown', (e) => { if (importPop && e.key === 'Escape') closeImport(); }, true);
  $('#importFile').onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      if (!Array.isArray(data.notes) || !Array.isArray(data.folders)) throw new Error('Not a notes backup');
      if (!confirm('Replace all current notes, tasks and events with this backup?')) return;
      state = normalize(data); state.notes.forEach((n) => delete n.sv); state.folders.forEach((f) => { f.updated = f.updated || Date.now(); delete f.sv; }); state.tasks.concat(state.events).forEach((x) => delete x.sv); persist(); setView('today');
    } catch (err) { alert('Could not restore: ' + err.message); }
    e.target.value = '';
  };

  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.altKey && e.code === 'KeyN') { e.preventDefault(); newNote(); }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f' && !e.altKey) { e.preventDefault(); if (Planner.isView(view.type)) Planner.openLauncher(); else $('#search').focus(); }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k' && !e.defaultPrevented) { e.preventDefault(); Planner.openLauncher(); }
  });
  window.addEventListener('beforeunload', () => { clearTimeout(saveTimer); persist(); });

  // ---------- Google Drive sync ----------
  // Local storage stays the source of truth (so the app works offline). Each note is one JSON file in a
  // "Notes" folder in the user's My Drive; `appProperties.updated` on each file lets one list call tell us
  // which notes changed. Conflicts: newest `updated` wins, per note. Folders live in one `_folders.json`.
  const SCOPES = 'openid email profile https://www.googleapis.com/auth/drive.file';
  const CAL_SCOPE = 'https://www.googleapis.com/auth/calendar.events';    // only asked for when Google Calendar sync is turned on
  const scopesFor = (withCalendar) => SCOPES + (withCalendar ? ' ' + CAL_SCOPE : '');
  const TOKEN_URL = 'https://oauth2.googleapis.com/token';
  const authKey = KEY + '-gauth', metaKey = KEY + '-sync';
  const readJSON = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
  const writeJSON = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
  const getMeta = () => readJSON(metaKey) || {};
  const setMeta = (m) => writeJSON(metaKey, { ...getMeta(), ...m });
  const parse = (r) => (typeof r === 'string' ? JSON.parse(r) : r);
  let auth = readJSON(authKey);                // { email, access, exp, refresh }
  let user = auth ? { email: auth.email } : null;
  let syncing = false, again = false, syncTimer = null, needsReauth = false;
  class NeedAuth extends Error {}

  // --- tiny SHA-256 (PKCE needs it, and crypto.subtle is missing on non-secure origins like the Mac app's) ---
  const K256 = new Uint32Array([0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2]);
  function sha256(data) {
    const H = new Uint32Array([0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19]);
    const l = data.length, padded = new Uint8Array(((l + 9 + 63) >> 6) << 6);
    padded.set(data); padded[l] = 0x80;
    const dv = new DataView(padded.buffer);
    dv.setUint32(padded.length - 4, (l * 8) >>> 0); dv.setUint32(padded.length - 8, Math.floor(l * 8 / 4294967296));
    const w = new Uint32Array(64);
    for (let o = 0; o < padded.length; o += 64) {
      for (let i = 0; i < 16; i++) w[i] = dv.getUint32(o + i * 4);
      for (let i = 16; i < 64; i++) {
        const x = w[i - 15], y = w[i - 2];
        w[i] = (w[i - 16] + (((x >>> 7) | (x << 25)) ^ ((x >>> 18) | (x << 14)) ^ (x >>> 3)) + w[i - 7] + (((y >>> 17) | (y << 15)) ^ ((y >>> 19) | (y << 13)) ^ (y >>> 10))) | 0;
      }
      let [a, b, c, d, e, f, g, h] = H;
      for (let i = 0; i < 64; i++) {
        const t1 = (h + (((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7))) + ((e & f) ^ (~e & g)) + K256[i] + w[i]) | 0;
        const t2 = ((((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10))) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
        h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      H[0] += a; H[1] += b; H[2] += c; H[3] += d; H[4] += e; H[5] += f; H[6] += g; H[7] += h;
    }
    const out = new Uint8Array(32), ov = new DataView(out.buffer);
    H.forEach((v, i) => ov.setUint32(i * 4, v));
    return out;
  }
  window.__sha256 = sha256;   // for tests
  const b64url = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const randomString = () => b64url(crypto.getRandomValues(new Uint8Array(32)));

  // --- sign-in ---
  async function desktopSignIn(hint, scope) {     // system browser + loopback redirect + PKCE
    const verifier = randomString(), state = randomString();
    const q = new URLSearchParams({
      client_id: desktopId, redirect_uri: '{REDIRECT}', response_type: 'code', scope, include_granted_scopes: 'true',
      code_challenge: b64url(sha256(new TextEncoder().encode(verifier))), code_challenge_method: 'S256',
      access_type: 'offline', prompt: 'consent', state });
    if (hint) q.set('login_hint', hint);
    const url = 'https://accounts.google.com/o/oauth2/v2/auth?' + q.toString().replace('%7BREDIRECT%7D', '{REDIRECT}');
    const res = parse(await native.authorize(url));
    if (res.error) throw new Error(res.error === 'access_denied' ? 'Sign-in was cancelled.' : res.error);
    if (res.state !== state) throw new Error('Sign-in response did not match. Please try again.');
    const t = parse(await native.postForm(TOKEN_URL, {
      code: res.code, client_id: desktopId, client_secret: desktopSecret,
      redirect_uri: res.redirectUri, grant_type: 'authorization_code', code_verifier: verifier }));
    if (t.error) throw new Error(t.error_description || t.error);
    const claims = JSON.parse(decodeURIComponent(escape(atob(t.id_token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))));
    return { email: claims.email, access: t.access_token, exp: Date.now() + (t.expires_in - 60) * 1000, refresh: t.refresh_token, scope: t.scope || scope };
  }
  function loadGIS() {
    if (window.google && google.accounts && google.accounts.oauth2) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client'; s.onload = resolve;
      s.onerror = () => reject(new Error('Could not reach Google. Check your connection.'));
      document.head.appendChild(s);
    });
  }
  async function webToken(hint, prompt, scope = SCOPES) {   // Google Identity Services token flow (browser / iPhone)
    await loadGIS();
    return new Promise((resolve, reject) => {
      const tc = google.accounts.oauth2.initTokenClient({
        client_id: googleClientId, scope, hint: hint || undefined, include_granted_scopes: true,
        callback: (r) => (r.error ? reject(new Error(r.error_description || r.error)) : resolve(r)),
        error_callback: (e) => reject(new Error(e.type === 'popup_closed' ? 'Sign-in was cancelled.' : (e.message || e.type || 'Sign-in failed'))) });
      tc.requestAccessToken({ prompt });
    });
  }
  // Home Screen app: the page goes to Google and comes back with a one-hour token in the URL (#access_token=…);
  // finishRedirect() picks it up. When the hour is up, opening the app renews it the same way, usually without
  // any screen to answer (prompt=none).
  const RETURN_KEY = KEY + '-oauth', USERINFO = 'https://www.googleapis.com/oauth2/v3/userinfo';
  function redirectToGoogle(hint, scope, prompt, purpose = 'signin') {
    const st = randomString();
    clearTimeout(saveTimer); persist();                        // nothing typed is lost while the page is away
    writeJSON(RETURN_KEY, { state: st, scope, note: currentId, silent: prompt === 'none', purpose });
    const q = new URLSearchParams({ client_id: googleClientId, redirect_uri: location.origin + location.pathname,
      response_type: 'token', scope, include_granted_scopes: 'true', state: st });
    if (prompt) q.set('prompt', prompt);
    if (hint) q.set('login_hint', hint);
    location.assign('https://accounts.google.com/o/oauth2/v2/auth?' + q);
    return new Promise(() => {});                              // the page is leaving
  }
  function renewIfDue() {
    if (!standalone || !auth || Date.now() < auth.exp || !navigator.onLine) return false;
    const failed = getMeta().silentFail;
    if (failed && Date.now() - failed < 10 * 60000) return false;   // Google wanted a tap last time: wait for Reconnect
    redirectToGoogle(auth.email, scopesFor(calGranted()), 'none', 'renew');
    return true;
  }
  async function finishRedirect() {
    const p = new URLSearchParams(location.hash.slice(1));
    const saved = readJSON(RETURN_KEY) || {};
    localStorage.removeItem(RETURN_KEY);
    history.replaceState(null, '', location.pathname + location.search);
    if (saved.note) core.gotoNote(saved.note);
    const fail = (msg) => {
      if (saved.silent && auth) { setMeta({ silentFail: Date.now() }); needsReauth = true; renderAccount(); setSyncLabel('tap Reconnect to sync'); return; }
      if (auth) { Planner.toast(msg); renderAccount(); } else showAuth(msg);
    };
    if (!saved.state || p.get('state') !== saved.state) return fail('The sign-in reply didn’t match. Please try again.');
    if (p.get('error')) return fail(p.get('error') === 'access_denied' ? 'Sign-in was cancelled.' : 'Google sign-in: ' + p.get('error'));
    try {
      const access = p.get('access_token');
      const me = await (await fetch(USERINFO, { headers: { Authorization: 'Bearer ' + access } })).json();
      if (!me.email) throw new Error('Could not read your Google email.');
      if (auth && saved.purpose !== 'signin' && me.email !== auth.email) { Planner.toast(`Please choose ${auth.email} on the Google screen.`); return; }
      const a = { email: me.email, access, exp: Date.now() + ((+p.get('expires_in') || 3600) - 60) * 1000, scope: p.get('scope') || saved.scope };
      auth = a; writeJSON(authKey, a); setMeta({ silentFail: 0 });
      if (saved.purpose === 'gcal') {
        if (calGranted()) { calError = ''; setMeta({ gcal: true, gcalSince: null }); Planner.toast('Google Calendar connected. Syncing events…'); }
        else Planner.toast('Google didn’t give calendar access. Tick the Calendar box on the Google screen.');
        Planner.render();
      }
      setUser(a.email);
    } catch (err) { fail(err.message || 'Sign-in failed'); }
  }

  async function signIn(hint, withCalendar, purpose) {
    const scope = scopesFor(withCalendar);
    if (native) return desktopSignIn(hint, scope);
    if (standalone) return redirectToGoogle(hint, scope, hint ? '' : 'select_account', purpose);
    const r = await webToken(hint, hint ? '' : 'select_account', scope);
    const me = await (await fetch(USERINFO, { headers: { Authorization: 'Bearer ' + r.access_token } })).json();
    if (!me.email) throw new Error('Could not read your Google email.');
    return { email: me.email, access: r.access_token, exp: Date.now() + (r.expires_in - 60) * 1000, scope: r.scope || scope };
  }
  async function getToken(force) {
    if (!auth) throw new NeedAuth('Signed out');
    if (!force && auth.access && Date.now() < auth.exp) return auth.access;
    if (native) {
      if (!auth.refresh) throw new NeedAuth('Please sign in again.');
      const t = parse(await native.postForm(TOKEN_URL, { client_id: desktopId, client_secret: desktopSecret, refresh_token: auth.refresh, grant_type: 'refresh_token' }));
      if (t.error) throw (t.error === 'invalid_grant' ? new NeedAuth('Please sign in again.') : new Error(t.error_description || t.error));
      auth = { ...auth, access: t.access_token, exp: Date.now() + (t.expires_in - 60) * 1000 };
    } else if (standalone) {
      throw new NeedAuth('renew');                       // renewed when the app is next opened (renewIfDue) or with Reconnect
    } else {
      let r;
      try { r = await webToken(auth.email, '', scopesFor(calGranted())); } catch (e) { throw new NeedAuth(e.message); }
      auth = { ...auth, access: r.access_token, exp: Date.now() + (r.expires_in - 60) * 1000 };
    }
    writeJSON(authKey, auth);
    return auth.access;
  }

  // --- Drive REST ---
  async function drive(path, opts = {}, retry = true) {
    const token = await getToken();
    const res = await fetch(path.startsWith('http') ? path : 'https://www.googleapis.com' + path,
      { ...opts, headers: { ...(opts.headers || {}), Authorization: 'Bearer ' + token } });
    if (res.status === 401 && retry) { await getToken(true); return drive(path, opts, false); }
    if (!res.ok) { const e = new Error('Drive error ' + res.status); e.status = res.status; e.detail = await res.text().catch(() => ''); throw e; }
    return res;
  }
  function upload(method, path, meta, content) {
    const b = 'nb' + Math.random().toString(36).slice(2);
    const body = `--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(content)}\r\n--${b}--`;
    return drive(path, { method, headers: { 'Content-Type': 'multipart/related; boundary=' + b }, body });
  }
  async function ensureFolder() {
    const cached = getMeta().folderId;
    if (cached) {
      try { const j = await (await drive(`/drive/v3/files/${cached}?fields=id,trashed`)).json(); if (!j.trashed) return cached; }
      catch (e) { if (e.status !== 404) throw e; }
    }
    const q = encodeURIComponent("mimeType='application/vnd.google-apps.folder' and name='Notes' and 'root' in parents and trashed=false");
    const found = (await (await drive(`/drive/v3/files?q=${q}&fields=files(id)&pageSize=10`)).json()).files || [];
    let id = found.length ? found[0].id : null;
    if (!id) id = (await (await drive('/drive/v3/files?fields=id', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Notes', mimeType: 'application/vnd.google-apps.folder' }) })).json()).id;
    setMeta({ folderId: id });
    return id;
  }
  async function listRemote(folderId) {
    const q = encodeURIComponent(`'${folderId}' in parents and trashed=false`);
    const files = []; let token = '';
    do {
      const j = await (await drive(`/drive/v3/files?q=${q}&fields=nextPageToken,files(id,name,modifiedTime,appProperties)&pageSize=1000${token ? '&pageToken=' + token : ''}`)).json();
      files.push(...(j.files || [])); token = j.nextPageToken || '';
    } while (token);
    return files;
  }
  async function pool(items, n, fn) {
    let i = 0;
    await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (i < items.length) await fn(items[i++]); }));
  }
  const fileName = (n) => (info(n).title.replace(/[\\/:*?"<>|\u0000-\u001f]/g, ' ').trim().slice(0, 60) || 'Untitled') + ' - ' + n.id.slice(-6) + '.json';

  // --- sync passes ---
  async function pullNotes(remote, changed) {
    const byNid = new Map();
    for (const f of remote) { const p = f.appProperties || {}; if (p.kind === 'note' && p.nid) byNid.set(p.nid, f); }
    const need = [];
    for (const [nid, f] of byNid) {
      const l = byId(nid), ru = Number(f.appProperties.updated) || 0;
      if (!l || ru > l.updated) need.push([nid, f, ru]);
      else { l.fid = f.id; if (ru === l.updated) l.sv = ru; }
    }
    await pool(need, 4, async ([nid, f, ru]) => {
      const j = await (await drive(`/drive/v3/files/${f.id}?alt=media`)).json();
      const n = { id: nid, folder: j.folder || null, pinned: !!j.pinned, pinTop: !!j.pinTop, archived: !!j.archived, trashed: !!j.trashed, deleted: false, locked: !!j.locked, lockTitle: j.lockTitle, enc: j.enc, pub: j.pub || undefined, html: j.html || '', created: j.created || ru, updated: ru, sv: ru, fid: f.id };
      const l = byId(nid);
      if (l) Object.assign(l, n); else state.notes.push(n);
      changed.add(nid);
    });
    // Notes we had uploaded that are no longer in the folder were deleted on another device.
    const known = state.notes.filter((n) => n.fid && !n.deleted);
    if (!(remote.length === 0 && known.length > 3)) {        // an empty listing with many known notes is suspicious: skip
      for (const n of known) {
        if (byNid.has(n.id)) continue;
        if (n.sv === n.updated) { n.deleted = true; n.html = ''; n.sv = n.updated; changed.add(n.id); }
        delete n.fid;                                          // if edited here since, it re-uploads as new
      }
    }
  }

  const COLLECTIONS = [
    { kind: 'folders', file: '_folders.json', key: 'folders', mt: 'foldersMT' },
    { kind: 'tasks', file: '_tasks.json', key: 'tasks', mt: 'tasksMT' },
    { kind: 'events', file: '_events.json', key: 'events', mt: 'eventsMT' },
  ];
  const stripLocal = (x) => { const o = {}; for (const k in x) if (k !== 'sv' && k[0] !== '_') o[k] = x[k]; return o; };
  async function syncCollection(c, remote, folderId, changed) {
    const list = state[c.key];
    const ff = remote.find((f) => f.appProperties && f.appProperties.kind === c.kind);
    if (ff && ff.modifiedTime !== getMeta()[c.mt]) {
      const arr = await (await drive(`/drive/v3/files/${ff.id}?alt=media`)).json();
      for (const r of Array.isArray(arr) ? arr : []) {
        if (!r || !r.id) continue;
        const l = list.find((x) => x.id === r.id);
        const remoteItem = Object.assign({}, r, { deleted: !!r.deleted, sv: r.updated });
        if (!l) { list.push(remoteItem); changed.add(c.kind); }
        else if (r.updated > l.updated) {
          Object.keys(l).forEach((k) => { if (!(k in remoteItem)) delete l[k]; });
          Object.assign(l, remoteItem); changed.add(c.kind);
        } else if (r.updated === l.updated) l.sv = r.updated;
      }
    }
    if (list.some((x) => x.sv !== x.updated) || (!ff && list.length)) {
      const snap = list.map((x) => [x, x.updated]);
      const meta = { name: c.file, appProperties: { kind: c.kind, nid: c.kind, updated: String(Date.now()) } };
      const res = ff
        ? await upload('PATCH', `/upload/drive/v3/files/${ff.id}?uploadType=multipart&fields=id,modifiedTime`, meta, list.map(stripLocal))
        : await upload('POST', '/upload/drive/v3/files?uploadType=multipart&fields=id,modifiedTime', { ...meta, parents: [folderId], mimeType: 'application/json' }, list.map(stripLocal));
      setMeta({ [c.mt]: (await res.json()).modifiedTime });
      snap.forEach(([x, u]) => { x.sv = u; });
    } else if (ff) setMeta({ [c.mt]: ff.modifiedTime });
  }

  async function pushNotes(folderId) {
    const dirty = state.notes.filter((n) => n.sv !== n.updated);
    await pool(dirty, 4, async (n) => {
      const u = n.updated;
      if (n.deleted) {
        if (n.fid) {
          try { await drive(`/drive/v3/files/${n.fid}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ trashed: true }) }); }
          catch (e) { if (e.status !== 404) throw e; }
        }
        delete n.fid; n.sv = u; return;
      }
      const content = { id: n.id, folder: n.folder || null, pinned: !!n.pinned, pinTop: !!n.pinTop, archived: !!n.archived, trashed: !!n.trashed, locked: !!n.locked, lockTitle: n.lockTitle, enc: n.enc, pub: n.pub || undefined, html: n.locked ? '' : n.html || '', created: n.created || u, updated: u };
      const meta = { name: fileName(n), appProperties: { kind: 'note', nid: n.id, updated: String(u) } };
      if (n.fid) {
        try { await upload('PATCH', `/upload/drive/v3/files/${n.fid}?uploadType=multipart&fields=id`, meta, content); }
        catch (e) { if (e.status !== 404) throw e; delete n.fid; }
      }
      if (!n.fid) {
        const res = await upload('POST', '/upload/drive/v3/files?uploadType=multipart&fields=id', { ...meta, parents: [folderId], mimeType: 'application/json' }, content);
        n.fid = (await res.json()).id;
      }
      n.sv = u;
    });
    state.notes = state.notes.filter((n) => !(n.deleted && n.sv === n.updated));   // tombstones that are fully synced
  }

  function setSyncLabel(t) { if (user) $('#acctLine').textContent = user.email + ' · ' + t; }
  function scheduleSync() {
    if (!syncEnabled || !auth) return;
    clearTimeout(syncTimer);
    syncTimer = setTimeout(syncNow, 1500);
  }

  // --- Google Calendar (two-way sync of events with the user's primary calendar) ---
  // App events get a fixed Google id derived from their own id, so two devices can never create duplicates.
  // `gup` = the `updated` value last sent to / taken from Google; `gUpdated` = Google's own change stamp.
  const CAL_URL = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';
  let calError = '';
  const calGranted = () => !!(auth && (auth.scope || '').includes(CAL_SCOPE));
  const calOn = () => syncEnabled && calGranted() && !!getMeta().gcal;
  const gcalId = (id) => 'nt' + Array.from(new TextEncoder().encode(id), (b) => b.toString(16).padStart(2, '0')).join('');
  const RRULES = { daily: 'RRULE:FREQ=DAILY', weekdays: 'RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR', weekly: 'RRULE:FREQ=WEEKLY', monthly: 'RRULE:FREQ=MONTHLY', yearly: 'RRULE:FREQ=YEARLY' };
  const p2 = (n) => String(n).padStart(2, '0');
  const localYmd = (d) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
  const localHM = (d) => `${p2(d.getHours())}:${p2(d.getMinutes())}`;
  function fromRRule(list) {
    const r = (list || []).find((x) => x.startsWith('RRULE:'));
    if (!r || /INTERVAL=([2-9]|\d\d)/.test(r)) return null;            // "every 2 weeks" etc. isn't supported yet
    const freq = (r.match(/FREQ=(\w+)/) || [])[1], by = (r.match(/BYDAY=([\w,]+)/) || [])[1];
    if (freq === 'DAILY') return 'daily';
    if (freq === 'WEEKLY') return by && by.split(',').length === 5 && !/SA|SU/.test(by) ? 'weekdays' : by && by.includes(',') ? null : 'weekly';
    return { MONTHLY: 'monthly', YEARLY: 'yearly' }[freq] || null;
  }
  function toGoogle(e) {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const nextDay = (ds) => { const d = new Date(ds + 'T00:00:00'); d.setDate(d.getDate() + 1); return localYmd(d); };
    let end = e.end && e.end > e.start ? e.end : null;
    if (!end) { const [h, m] = e.start.split(':').map(Number); const t = Math.min(h * 60 + m + 60, 23 * 60 + 59); end = `${p2(Math.floor(t / 60))}:${p2(t % 60)}`; }
    return {
      summary: e.title || 'Untitled event', description: e.notes || '', location: e.location || '',
      start: e.allDay ? { date: e.date } : { dateTime: `${e.date}T${e.start}:00`, timeZone: tz },
      end: e.allDay ? { date: nextDay(e.date) } : { dateTime: `${e.date}T${end}:00`, timeZone: tz },
      recurrence: e.repeat && RRULES[e.repeat] ? [RRULES[e.repeat]] : (e.grec || []),
      reminders: { useDefault: false, overrides: e.remind != null ? [{ method: 'popup', minutes: e.remind }] : [] },
      extendedProperties: { private: { notesId: e.id, notesLink: e.link || '' } },
    };
  }
  function fromGoogle(g) {
    const priv = (g.extendedProperties && g.extendedProperties.private) || {};
    const video = g.conferenceData && (g.conferenceData.entryPoints || []).find((x) => x.entryPointType === 'video');
    const repeat = fromRRule(g.recurrence);
    const o = { title: g.summary || '', notes: g.description || '', location: g.location || '',
      link: priv.notesLink || g.hangoutLink || (video && video.uri) || '', repeat, grec: !repeat && g.recurrence ? g.recurrence : null };
    if (g.start.date) Object.assign(o, { allDay: true, date: g.start.date, start: '09:00', end: '10:00' });
    else {
      const st = new Date(g.start.dateTime), en = new Date(g.end.dateTime);
      Object.assign(o, { allDay: false, date: localYmd(st), start: localHM(st), end: localYmd(en) === localYmd(st) ? localHM(en) : '23:59' });
    }
    const popup = g.reminders && (g.reminders.overrides || []).find((r) => r.method === 'popup');
    o.remind = popup ? popup.minutes : g.reminders && g.reminders.useDefault ? 10 : null;
    return o;
  }
  function applyGoogle(g, changed) {
    if (g.recurringEventId) return false;                         // a changed single occurrence of a series: not supported yet
    if (g.eventType && g.eventType !== 'default') return false;   // birthdays, focus time, working location…
    const priv = (g.extendedProperties && g.extendedProperties.private) || {};
    let l = state.events.find((x) => x.gid === g.id) || (priv.notesId && state.events.find((x) => x.id === priv.notesId));
    if (l && l.gUpdated === g.updated) return false;                // nothing new (usually our own change)
    if (l && l.gup !== l.updated) return false;                     // also edited here: ours is sent to Google below
    const now = Date.now();
    if (g.status === 'cancelled') {
      if (!l || l.deleted) return false;
      Object.assign(l, { deleted: true, updated: now, gup: now, gUpdated: g.updated, sv: null });
      changed.add('events'); return true;
    }
    if (!g.start) return false;
    if (!l) { l = { id: 'g' + g.id, tags: [], noteId: null, created: now }; state.events.push(l); }
    Object.assign(l, fromGoogle(g), { gid: g.id, deleted: false, updated: now, gup: now, gUpdated: g.updated, sv: null });
    changed.add('events'); return true;
  }
  async function syncCalendar(changed) {
    if (!calOn()) return;
    const json = { 'Content-Type': 'application/json' };
    try {
      const meta = getMeta(), startedAt = Date.now();
      const q = new URLSearchParams({ maxResults: '250', singleEvents: 'false', timeMin: new Date(Date.now() - 30 * 864e5).toISOString() });
      if (meta.gcalSince) { q.set('updatedMin', new Date(meta.gcalSince - 10 * 60000).toISOString()); q.set('showDeleted', 'true'); }
      let page = '';
      do {
        if (page) q.set('pageToken', page);
        const j = await (await drive(`${CAL_URL}?${q}`)).json();
        (j.items || []).forEach((g) => applyGoogle(g, changed));
        page = j.nextPageToken || '';
      } while (page);
      for (const e of state.events) {                               // send our changes
        if (e.gup === e.updated) continue;
        const u = e.updated, gid = e.gid || gcalId(e.id);
        if (e.deleted) {
          if (e.gid) { try { await drive(`${CAL_URL}/${gid}`, { method: 'DELETE' }); } catch (x) { if (x.status !== 404 && x.status !== 410) throw x; } }
          e.gup = u; e.sv = null; continue;
        }
        const body = JSON.stringify(toGoogle(e));
        let res;
        try {
          res = e.gid ? await drive(`${CAL_URL}/${gid}`, { method: 'PATCH', headers: json, body })
            : await drive(CAL_URL, { method: 'POST', headers: json, body: JSON.stringify(Object.assign(toGoogle(e), { id: gid })) });
        } catch (x) {
          if (x.status === 409) res = await drive(`${CAL_URL}/${gid}`, { method: 'PATCH', headers: json, body });   // another device created it already
          else if (x.status === 404 || x.status === 410) {           // deleted in Google Calendar: delete here too
            Object.assign(e, { deleted: true, updated: Date.now(), sv: null }); e.gup = e.updated; changed.add('events'); continue;
          } else throw x;
        }
        const j = await res.json();
        e.gid = j.id; e.gUpdated = j.updated; e.sv = null;            // sv=null: send gid/gup to the other devices through Drive
        if (e.updated === u) e.gup = u;
      }
      setMeta({ gcalSince: startedAt });
      if (calError) { calError = ''; Planner.render(); }
    } catch (err) {
      if (err instanceof NeedAuth) throw err;
      let msg = err.message || 'error';
      if (err.status === 403 && /accessNotConfigured|has not been used|disabled/i.test(err.detail || '')) msg = 'Turn on the Google Calendar API in your Google Cloud project (see SETUP.md).';
      else if (err.status === 403 || err.status === 401) msg = 'Google Calendar permission is missing. Click “Google Calendar” to reconnect.';
      if (msg !== calError) { calError = msg; Planner.toast('Google Calendar: ' + msg); Planner.render(); }
      console.error('calendar sync failed', err, err.detail || '');
    }
  }
  const calendarApi = {
    status: () => (!syncEnabled ? 'setup' : !getMeta().gcal ? 'off' : calError ? 'error' : !calGranted() ? 'reconnect' : 'on'),
    error: () => calError,
    async connect() {
      if (!syncEnabled) { showSetupHelp(); return; }
      if (!auth) { showAuth('Sign in with Google first, then turn on Google Calendar.'); return; }
      if (!calGranted() || calError) {
        try {
          const a = await signIn(auth.email, true, 'gcal');
          if (a.email !== auth.email) { Planner.toast(`Please choose ${auth.email} on the Google screen.`); return; }
          auth = Object.assign({}, auth, a, { refresh: a.refresh || auth.refresh }); writeJSON(authKey, auth);
        } catch (err) { Planner.toast('Google Calendar: ' + (err.message || 'sign-in failed')); return; }
        if (!calGranted()) { Planner.toast('Google didn’t give calendar access. Tick the Calendar box on the Google screen.'); return; }
      }
      calError = '';
      setMeta({ gcal: true, gcalSince: null });
      Planner.toast('Google Calendar connected. Syncing events…');
      Planner.render(); syncNow();
    },
    disconnect() {
      if (!confirm('Stop syncing with Google Calendar? Events already copied stay in both places.')) return;
      setMeta({ gcal: false }); calError = ''; Planner.render();
    },
  };

  // --- attachments: files live in Notes/Attachments on Drive, found again by their `aid` ---
  async function attFolder(folderId) {
    const cached = getMeta().attFolderId;
    if (cached) return cached;
    const q = encodeURIComponent(`mimeType='application/vnd.google-apps.folder' and name='Attachments' and '${folderId}' in parents and trashed=false`);
    const found = (await (await drive(`/drive/v3/files?q=${q}&fields=files(id)`)).json()).files || [];
    const id = found.length ? found[0].id : (await (await drive('/drive/v3/files?fields=id', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Attachments', mimeType: 'application/vnd.google-apps.folder', parents: [folderId] }) })).json()).id;
    setMeta({ attFolderId: id });
    return id;
  }
  async function pushAttachments(folderId) {
    const recs = (await Blocks.store.all().catch(() => [])).filter((r) => !r.fid);
    if (!recs.length) return;
    const parent = await attFolder(folderId);
    for (const r of recs) {
      const meta = { name: r.name, parents: [parent], mimeType: r.type, appProperties: { kind: 'att', aid: r.id } };
      let res;
      try {
        if (r.size <= 5 * 1048576) {                       // small: one multipart request
          const b = 'nb' + Math.random().toString(36).slice(2);
          const body = new Blob([`--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${b}\r\nContent-Type: ${r.type}\r\n\r\n`, r.blob, `\r\n--${b}--`]);
          res = await drive('/upload/drive/v3/files?uploadType=multipart&fields=id', { method: 'POST', headers: { 'Content-Type': 'multipart/related; boundary=' + b }, body });
        } else {                                           // large: resumable upload
          const init = await drive('/upload/drive/v3/files?uploadType=resumable&fields=id', { method: 'POST', headers: { 'Content-Type': 'application/json; charset=UTF-8', 'X-Upload-Content-Type': r.type }, body: JSON.stringify(meta) });
          const loc = init.headers.get('Location');
          if (!loc) throw new Error('Google Drive did not return an upload address');
          res = await drive(loc, { method: 'PUT', headers: { 'Content-Type': r.type }, body: r.blob });
        }
      } catch (err) { if (err.status === 404) setMeta({ attFolderId: null }); throw err; }
      r.fid = (await res.json()).id;
      await Blocks.store.put(r);
    }
  }
  async function fetchAttachment(aid) {
    if (!syncEnabled || !auth) return null;
    const parent = await attFolder(await ensureFolder());
    const q = encodeURIComponent(`'${parent}' in parents and appProperties has { key='aid' and value='${aid.replace(/[^\w-]/g, '')}' } and trashed=false`);
    const f = ((await (await drive(`/drive/v3/files?q=${q}&fields=files(id)`)).json()).files || [])[0];
    return f ? (await drive(`/drive/v3/files/${f.id}?alt=media`)).blob() : null;
  }

  async function syncNow() {
    if (!syncEnabled || !auth) return;
    if (syncing) { again = true; return; }
    syncing = true; clearTimeout(syncTimer);
    setSyncLabel('syncing…');
    try {
      do {
        again = false;
        const folderId = await ensureFolder();
        const remote = await listRemote(folderId);
        const changed = new Set();
        await pullNotes(remote, changed);
        await syncCalendar(changed);                 // before the events file, so Google ids reach other devices in this pass
        for (const c of COLLECTIONS) await syncCollection(c, remote, folderId, changed);
        try { await pushAttachments(folderId); } catch (err) { if (err instanceof NeedAuth) throw err; console.error('attachment upload failed', err); }
        await pushNotes(folderId);
        persist(true);
        if (changed.size) {
          renderAll(); renderActions();
          if (Planner.isView(view.type)) Planner.render();
          Blocks.refreshLive();
          const n = byId(currentId);
          if (currentId && changed.has(currentId)) {
            if (!n || n.deleted) openNote(null);
            else if (isUnlocked(currentId) || n.locked) {       // a locked note changed on another device
              try {
                if (!n.locked || !unlocked) throw 0;
                n.html = await openSealed(n.enc, unlocked.key);
                if (document.activeElement !== editor) { editor.innerHTML = n.html; Blocks.hydrate(editor); setStatus(); }
              } catch { unlocked = null; openNote(currentId); }  // its lock or password changed: ask again
            } else if (document.activeElement !== editor) { editor.innerHTML = n.html; editor.classList.toggle('is-empty', looksEmpty(n)); Blocks.hydrate(editor); Blocks.renderBacklinks(n); renderActions(); setStatus(); }
          }
        }
      } while (again);
      if (needsReauth) { needsReauth = false; renderAccount(); }
      setSyncLabel('synced');
      $('#acctLine').removeAttribute('title');
    } catch (err) {
      console.error('sync failed', err, err.detail || '');
      if (err instanceof NeedAuth) { needsReauth = true; renderAccount(); setSyncLabel('sign-in expired'); }
      else {
        // say why, so the problem can be identified: e.g. "sync error (403)", with Google's explanation on hover
        let why = err.message || String(err);
        try { why = JSON.parse(err.detail).error.message || why; } catch {}
        setSyncLabel(navigator.onLine ? `sync error${err.status ? ` (${err.status})` : ''}` : 'offline');
        $('#acctLine').title = navigator.onLine ? why : '';
      }
    } finally { syncing = false; }
  }

  // --- account UI ---
  function renderAccount() {
    $('#account').hidden = false;
    if (!syncEnabled) {                                   // no Google credentials in config.js yet: say so, and explain
      $('#acctLine').textContent = 'Notes are saved only on this device';
      $('#acctBtn').textContent = 'Set up Google Drive sync'; $('#acctBtn').hidden = false;
      $('#signOutBtn').hidden = true;
      return;
    }
    $('#acctLine').textContent = user ? user.email : 'Notes are only on this device';
    $('#acctBtn').textContent = user ? 'Reconnect' : 'Sign in to sync';
    $('#acctBtn').hidden = !!user && !needsReauth;
    $('#signOutBtn').hidden = !user;
  }
  function showAuth(msg) {
    $('#auth').hidden = false;
    $('#authErr').textContent = msg || '';
    if (user) $('#authEmail').value = user.email;
  }
  function setBusy(b) { ['#googleBtn', '#emailBtn'].forEach((s) => { $(s).disabled = b; }); }

  // Notes on this device are never deleted by signing in or out. When a different Google account signs in than
  // the one used here before, everything on this device is kept and uploaded to the new account as new items:
  // the links to the old account's Drive files and calendar events are dropped, so nothing looks "deleted elsewhere".
  function forgetDriveLinks() {
    state.notes = state.notes.filter((n) => !n.deleted);        // tombstones belonged to the old account
    state.notes.forEach((n) => { delete n.fid; delete n.sv; });
    state.folders = state.folders.filter((f) => !f.deleted);
    state.folders.forEach((f) => { delete f.sv; });
    state.tasks.concat(state.events).forEach((x) => { delete x.sv; delete x.gid; delete x.gup; delete x.gUpdated; delete x.grec; });
    Blocks.store.all().then((recs) => recs.forEach((r) => { if (r.fid) { r.fid = null; Blocks.store.put(r).catch(() => {}); } })).catch(() => {});
    localStorage.removeItem(metaKey);                          // the old account's Drive folder, calendar setting, sync times
    persist(true);
  }
  function setUser(email) {
    const meta = getMeta();
    if (meta.uid && meta.uid !== email) forgetDriveLinks();  // a different Google account was used here before
    user = { email }; needsReauth = false;
    setMeta({ uid: email, skip: false });
    $('#auth').hidden = true;
    renderAccount();
    syncNow();
  }

  async function signInFlow(hint) {
    setBusy(true); $('#authErr').textContent = '';
    try {
      const a = await signIn(hint, !!getMeta().gcal);
      auth = a; writeJSON(authKey, a);
      setUser(a.email);
    } catch (err) { showAuth(err.message || 'Sign-in failed'); }
    setBusy(false);
  }

  // Signing out only stops syncing. Every note, task and event stays on this device (under Notes, as before)
  // until you delete it yourself; changes made while signed out upload the next time you sign in.
  async function signOut() {
    await syncNow();
    const unsynced = state.notes.filter((n) => !n.deleted && n.sv !== n.updated).length;
    const msg = 'Sign out of Google Drive sync?\n\nYour notes, tasks and events stay on this device, and nothing is deleted.' +
      (unsynced ? ` ${unsynced} note change(s) haven't reached Google Drive yet: they stay here and upload the next time you sign in.` : '');
    if (!confirm(msg)) return;
    localStorage.removeItem(authKey);
    auth = null; user = null; needsReauth = false;
    setMeta({ skip: true });                                   // remembers which account this device used (uid)
    renderAll(); renderAccount();
    Planner.toast('Signed out. Your notes are still here on this device.');
  }

  // Google sign-in credentials typed into the app (for builds without them in config.js, like the public
  // downloads): a Desktop client ID + secret in the Mac / Windows apps, a Web client ID on the website / iPhone.
  function showSetupHelp() {
    const box = document.createElement('div');
    box.className = 'auth';
    const here = location.origin + location.pathname;
    box.innerHTML = `<div class="auth-card help">
      <div class="auth-icon">☁</div>
      <h2>Turn on Google Drive sync</h2>
      <p>Notes syncs through your own Google Drive, using your own free Google sign-in credentials. In
        <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener">Google Cloud → Credentials</a>
        (with the Google Drive API enabled; see SETUP.md), create an OAuth client of type
        <b>${native ? 'Desktop app' : 'Web application'}</b>${native ? '.' : ' and add:'}</p>
      ${native ? '' : `<ol>
        <li><b>Authorized JavaScript origins:</b> <code>${esc(location.origin)}</code></li>
        <li><b>Authorized redirect URIs:</b> <code>${esc(here)}</code></li>
      </ol>`}
      <p>Then paste ${native ? 'its Client ID and Client secret' : 'its Client ID'}:</p>
      <input id="setupCid" placeholder="Client ID (…apps.googleusercontent.com)" autocomplete="off" autocapitalize="off" spellcheck="false">
      ${native ? '<input id="setupSecret" placeholder="Client secret (GOCSPX-…)" autocomplete="off" autocapitalize="off" spellcheck="false">' : ''}
      <div class="auth-err" id="setupErr"></div>
      <button class="btn" type="button" data-act="save">Save and sign in</button>
      <button class="btn ghost" type="button" data-act="close">Not now</button></div>`;
    const close = () => box.remove();
    box.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
    box.addEventListener('click', (e) => {
      if (e.target === box || e.target.dataset.act === 'close') return close();
      if (e.target.dataset.act !== 'save') return;
      const id = box.querySelector('#setupCid').value.trim(), secret = native ? box.querySelector('#setupSecret').value.trim() : '';
      const err = !/^[\w-]+\.apps\.googleusercontent\.com$/.test(id) ? 'That doesn’t look like a Client ID (it ends in .apps.googleusercontent.com).'
        : native && !secret ? 'Paste the Client secret too.' : '';
      if (err) { box.querySelector('#setupErr').textContent = err; return; }
      try { native ? localStorage.setItem(DESKTOP_KEY, JSON.stringify({ id, secret })) : localStorage.setItem(WEB_ID_KEY, id); } catch {}
      setMeta({ skip: false });
      location.reload();
    });
    document.body.appendChild(box);
    box.querySelector('#setupCid').focus();
  }

  function initSync() {
    renderAccount();
    if (!syncEnabled) { $('#acctBtn').onclick = showSetupHelp; return; }
    $('#googleBtn').onclick = () => signInFlow('');
    $('#authForm').addEventListener('submit', (e) => { e.preventDefault(); signInFlow($('#authEmail').value.trim()); });
    $('#skipAuth').onclick = () => { setMeta({ skip: true }); $('#auth').hidden = true; };
    $('#acctBtn').onclick = () => (user ? signInFlow(user.email) : showAuth());
    $('#signOutBtn').onclick = signOut;
    if (!native && /[#&](access_token|error)=/.test(location.hash)) finishRedirect();   // back from Google's sign-in page
    else if (auth) { if (!renewIfDue()) syncNow(); }       // signed out: no prompt; "Sign in to sync" is at the bottom left
    const kick = () => { if (auth && !document.hidden) syncNow(); };
    addEventListener('online', kick);
    addEventListener('focus', kick);
    document.addEventListener('visibilitychange', () => { if (!document.hidden && renewIfDue()) return; kick(); });
    setInterval(kick, 30000);
  }

  // ---------- Init ----------
  const core = {
    state: () => state, persist, uid, renderSidebar, native, showPlanner, setView, calendar: calendarApi,
    layout: () => showPlanner(Planner.isView(view.type)),
    notesList: () => state.notes.filter((n) => !n.deleted && !n.trashed).sort((a, b) => b.updated - a.updated)
      .map((n) => ({ id: n.id, title: info(n).title, text: (info(n).text + ' ' + imageText(n)).trim() })),
    imagesRead: () => { if (query.trim()) renderList(); },
    noteIsLocked: (id) => { const n = byId(id); return !!(n && n.locked); },
    gotoNote: (id) => { const n = byId(id); if (!n || n.deleted) return; setView(n.trashed ? 'trash' : 'all'); openNote(id); },
    createNote: (title) => {
      newNote();
      if (title) {
        editor.innerHTML = `<h1>${esc(title)}</h1><div><br></div>`;
        onEdit();
        const r = document.createRange(); r.selectNodeContents(editor.lastChild); r.collapse(false);
        getSelection().removeAllRanges(); getSelection().addRange(r);
      }
    },
  };
  Object.assign(core, {
    editor, byId, info, onEdit, run, formatBlock: block, renderAll, fetchAttachment, toMarkdown, textLines,
    currentId: () => currentId,
    openMenu: (x, y, items) => openNoteMenu(currentId, x, y, items),
    toggleSidebar, sideIcon: SIDE_ICON, sideLabel,
    toast: (t) => Planner.toast(t),
    scheduleSync: () => scheduleSync(),
    taskFromNote: () => { const n = byId(currentId); if (n) Planner.taskFromNote(n.id, info(n).title); },
    addNote: (html, extra = {}) => {                     // create a note without opening it
      const now = Date.now();
      const n = Object.assign({ id: uid(), folder: view.type === 'folder' ? view.id : null, pinned: false, trashed: false, created: now, updated: now, html }, extra);
      state.notes.unshift(n); persist(); renderAll();
      return n.id;
    },
    drive: { api: drive, upload, ensureFolder, signedIn: () => !!auth },   // for Extras: publish to web
    unlockWithKey,
  });
  Planner.init(core);
  Blocks.init(core);
  Exporter.init(core);
  Media.init(core);
  if (window.Extras) Extras.init(core);
  plannerReady = true;
  if (Planner.isView(view.type)) setView(view.type);
  else {
    renderAll();
    const first = visibleNotes()[0];
    if (first && innerWidth > 900) openNote(first.id);
  }
  if (/[?&]new=1/.test(location.search)) {               // the installed app's "New note" shortcut
    history.replaceState(null, '', location.pathname);
    newNote();
  }
  if (native && native.onQuickNote) native.onQuickNote(() => newNote());   // Windows global hotkey
  addEventListener('resize', () => core.layout());
  initSync();
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
