/* Extras: smart folders (saved searches), find & replace, version history, note merge, Evernote (.enex) import,
   the note-link graph, LaTeX maths blocks, handwriting-to-text, dictation, on-device audio transcription,
   "publish to web" through Google Drive, fingerprint / Face ID unlock for locked notes, and an app lock.
   Everything here runs on this device: no server of ours and no API key. Works through the `core` object
   passed to Extras.init(), the same way Blocks / Media / Exporter do. */
(() => {
  'use strict';
  let C = null, ed = null;
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const b64 = (bytes) => { let s = ''; for (let i = 0; i < bytes.length; i += 32768) s += String.fromCharCode(...bytes.subarray(i, i + 32768)); return btoa(s); };
  const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  const readJSON = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) || d; } catch { return d; } };
  const writeJSON = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { if (C) C.toast('Storage is full: ' + e.message); } };
  const fmtWhen = (t) => new Date(t).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) +
    (new Date(t).getFullYear() === new Date().getFullYear() ? '' : ', ' + new Date(t).getFullYear());

  // ================= Smart folders (saved searches) =================
  const XKEY = 'notes-app-v1-extras';
  const xstore = () => readJSON(XKEY, { smart: [] });
  const xsave = (x) => writeJSON(XKEY, x);
  const smartDefs = () => xstore().smart || [];
  const smartDef = (id) => smartDefs().find((s) => s.id === id);

  function smartMatch(def, n) {
    if (!def || n.deleted || n.trashed || n.archived) return false;
    const i = C.info(n);
    if (def.q) {
      const q = def.q.trim().toLowerCase();
      if (q && !(i.title + ' ' + i.text).toLowerCase().includes(q) && !Blocks.imageText(n.html).toLowerCase().includes(q)) return false;
    }
    if (def.tag && !i.tags.includes(def.tag.toLowerCase().replace(/^#/, ''))) return false;
    if (def.folder === 'none' && n.folder) return false;
    if (def.folder && def.folder !== 'any' && def.folder !== 'none' && n.folder !== def.folder) return false;
    if (def.fav && !n.pinned) return false;
    if (def.has) {
      const h = n.html;
      if (def.has === 'image' && !/data-kind="image"/.test(h)) return false;
      if (def.has === 'audio' && !/data-kind="audio"/.test(h)) return false;
      if (def.has === 'file' && !/<figure class="att"/.test(h)) return false;
      if (def.has === 'checklist' && !/checklist/.test(h)) return false;
      if (def.has === 'link' && !/data-note=/.test(h)) return false;
      if (def.has === 'math' && !/blk-math/.test(h)) return false;
    }
    if (def.days && Date.now() - n.updated > def.days * 864e5) return false;
    return true;
  }
  function renderSmart() {
    const box = $('#navSmart'); if (!box) return;
    const defs = smartDefs();
    const live = C.state().notes.filter((n) => !n.deleted && !n.trashed && !n.archived);
    box.innerHTML = defs.map((d) =>
      `<div class="nav" data-type="smart" data-id="${esc(d.id)}"><span class="label">${esc(d.name)}</span><button class="del" data-del-smart="${esc(d.id)}" title="Smart folder options">✕</button><span class="count">${live.filter((n) => smartMatch(d, n)).length}</span></div>`).join('');
  }
  function smartForm(def) {
    const folders = C.state().folders.filter((f) => !f.deleted);
    const m = Media.modal('md-smart', Media.head(def ? 'Edit smart folder' : 'New smart folder') + `
      <form class="x-form">
        <label>Name<input name="name" required value="${esc(def ? def.name : '')}" placeholder="e.g. Receipts this month"></label>
        <label>Text contains<input name="q" value="${esc(def ? def.q || '' : '')}" placeholder="words in the title or text"></label>
        <label>Tag<input name="tag" value="${esc(def ? def.tag || '' : '')}" placeholder="tag (without #)"></label>
        <label>Folder<select name="folder">
          <option value="any">Any folder</option><option value="none"${def && def.folder === 'none' ? ' selected' : ''}>No folder</option>
          ${folders.map((f) => `<option value="${esc(f.id)}"${def && def.folder === f.id ? ' selected' : ''}>${esc(f.name)}</option>`).join('')}</select></label>
        <label>Has<select name="has">
          ${[['', 'Anything'], ['image', 'A photo or sketch'], ['audio', 'An audio recording'], ['file', 'Any attachment'], ['checklist', 'A checklist'], ['link', 'A link to another note'], ['math', 'A maths block']].map(([v, l]) => `<option value="${v}"${def && def.has === v ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
        <label>Updated within<select name="days">
          ${[[0, 'Any time'], [1, 'The last day'], [7, 'The last 7 days'], [30, 'The last 30 days'], [365, 'The last year']].map(([v, l]) => `<option value="${v}"${def && +def.days === v ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
        <label class="x-check"><input type="checkbox" name="fav"${def && def.fav ? ' checked' : ''}> Favorites only</label>
        <div class="md-foot"><span class="grow"></span><button class="pl-btn" type="button" data-x="close">Cancel</button><button class="pl-btn primary" type="submit">${def ? 'Save' : 'Create'}</button></div>
      </form>`);
    const form = $('form', m.el);
    $('[name=name]', form).focus();
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const d = { id: def ? def.id : C.uid(), name: String(fd.get('name')).trim(), q: String(fd.get('q')).trim(), tag: String(fd.get('tag')).trim().replace(/^#/, ''), folder: String(fd.get('folder')), has: String(fd.get('has')), days: +fd.get('days') || 0, fav: !!fd.get('fav') };
      if (!d.name) return;
      const x = xstore(); x.smart = def ? x.smart.map((s) => (s.id === d.id ? d : s)) : [...(x.smart || []), d];
      xsave(x); m.close(); C.renderAll();
      C.toast(def ? 'Smart folder saved' : 'Smart folder created: it fills itself as notes match');
    });
  }
  function smartMenu(id, x, y) {
    const def = smartDef(id); if (!def) return;
    C.openMenu(x, y, [
      { label: 'Open', icon: '↗', run: () => C.setView('smart', id) },
      { label: 'Edit…', icon: '✎', run: () => smartForm(def) },
      { sep: true },
      { label: 'Delete smart folder', icon: '✕', danger: true, run: () => { const s = xstore(); s.smart = (s.smart || []).filter((d) => d.id !== id); xsave(s); C.renderAll(); C.toast('Smart folder deleted: the notes themselves are untouched'); } },
    ]);
  }

  // ================= Find & replace =================
  let fr = null;   // { bar, matches: [Range-ish {node, at, len}], at: index }
  function frClose() { if (fr) { fr.bar.remove(); fr = null; } }
  function frWalk(root, fn) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: (t) => {
        if (!t.nodeValue || !t.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        const p = t.parentElement;
        if (!p || p.closest('figure, .blk-doc, .blk-board, .blk-toc, .blk-mindmap, a.nlink, [contenteditable="false"]')) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    const nodes = [];
    for (let n = walker.nextNode(); n; n = walker.nextNode()) nodes.push(n);
    nodes.forEach(fn);
  }
  function frFind(root, q, matchCase) {
    const out = [];
    if (!q) return out;
    const needle = matchCase ? q : q.toLowerCase();
    frWalk(root, (t) => {
      const hay = matchCase ? t.nodeValue : t.nodeValue.toLowerCase();
      let at = hay.indexOf(needle);
      while (at >= 0) { out.push({ node: t, at, len: q.length }); at = hay.indexOf(needle, at + Math.max(1, q.length)); }
    });
    return out;
  }
  function frSelect(i) {
    if (!fr || !fr.matches.length) return;
    fr.at = ((i % fr.matches.length) + fr.matches.length) % fr.matches.length;
    const m = fr.matches[fr.at];
    const r = document.createRange();
    try { r.setStart(m.node, m.at); r.setEnd(m.node, m.at + m.len); } catch { return; }
    const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r);
    const el = m.node.parentElement; if (el && el.scrollIntoView) el.scrollIntoView({ block: 'center' });
    $('.fr-count', fr.bar).textContent = `${fr.at + 1} of ${fr.matches.length}`;
  }
  function frRefresh() {
    if (!fr) return;
    const q = $('.fr-find', fr.bar).value, mc = $('.fr-case', fr.bar).checked;
    fr.matches = frFind(ed, q, mc);
    $('.fr-count', fr.bar).textContent = q ? (fr.matches.length ? `1 of ${fr.matches.length}` : 'No matches') : '';
    if (fr.matches.length) frSelect(0);
  }
  function frReplaceOne() {
    if (!fr || !fr.matches.length) return;
    const rep = $('.fr-rep', fr.bar).value;
    frSelect(fr.at);
    document.execCommand('insertText', false, rep);
    C.onEdit();
    setTimeout(frRefresh, 30);
  }
  function frReplaceAllNote() {
    if (!fr) return;
    const q = $('.fr-find', fr.bar).value, rep = $('.fr-rep', fr.bar).value, mc = $('.fr-case', fr.bar).checked;
    if (!q) return;
    let count = 0;
    frWalk(ed, (t) => {
      const needle = mc ? q : q.toLowerCase();
      const hay = mc ? t.nodeValue : t.nodeValue.toLowerCase();
      if (!hay.includes(needle)) return;
      let out = '', i = 0, at;
      while ((at = (mc ? t.nodeValue : t.nodeValue.toLowerCase()).indexOf(needle, i)) >= 0) { out += t.nodeValue.slice(i, at) + rep; i = at + q.length; count++; }
      t.nodeValue = out + t.nodeValue.slice(i);
    });
    if (count) { C.onEdit(); C.toast(`Replaced ${count} in this note`); } else C.toast('No matches in this note');
    setTimeout(frRefresh, 30);
  }
  function frReplaceAllNotes() {
    if (!fr) return;
    const q = $('.fr-find', fr.bar).value, rep = $('.fr-rep', fr.bar).value, mc = $('.fr-case', fr.bar).checked;
    if (!q) return;
    if (!confirm(`Replace every “${q}” with “${rep}” in ALL notes? Locked and trashed notes are skipped. This can't be undone except through each note's History.`)) return;
    const tmp = document.createElement('div');
    let total = 0, notes = 0;
    for (const n of C.state().notes) {
      if (n.deleted || n.trashed || n.locked) continue;
      tmp.innerHTML = n.html;
      let count = 0;
      frWalk(tmp, (t) => {
        const needle = mc ? q : q.toLowerCase();
        if (!(mc ? t.nodeValue : t.nodeValue.toLowerCase()).includes(needle)) return;
        let out = '', i = 0, at;
        while ((at = (mc ? t.nodeValue : t.nodeValue.toLowerCase()).indexOf(needle, i)) >= 0) { out += t.nodeValue.slice(i, at) + rep; i = at + q.length; count++; }
        t.nodeValue = out + t.nodeValue.slice(i);
      });
      if (count) { snapshot(n, true); n.html = tmp.innerHTML; n.updated = Date.now(); total += count; notes++; }
    }
    if (total) { C.persist(); C.renderAll(); const cur = C.byId(C.currentId()); if (cur) { ed.innerHTML = cur.html; Blocks.hydrate(ed); } C.toast(`Replaced ${total} in ${notes} note${notes === 1 ? '' : 's'}`); }
    else C.toast('No matches in any note');
  }
  function openFindReplace() {
    if (fr) { $('.fr-find', fr.bar).focus(); return; }
    if (!C.currentId()) { C.toast('Open a note first.'); return; }
    const bar = document.createElement('div');
    bar.className = 'fr-bar'; bar.id = 'frBar';
    bar.innerHTML = `
      <input class="fr-find" type="search" placeholder="Find" aria-label="Find">
      <input class="fr-rep" type="text" placeholder="Replace with" aria-label="Replace with">
      <label class="fr-casewrap" title="Match case"><input type="checkbox" class="fr-case"> Aa</label>
      <span class="fr-count" aria-live="polite"></span>
      <button data-fr="prev" title="Previous match">↑</button>
      <button data-fr="next" title="Next match">↓</button>
      <button data-fr="one">Replace</button>
      <button data-fr="note">All in note</button>
      <button data-fr="notes">All notes</button>
      <button data-fr="close" title="Close (Esc)">✕</button>`;
    $('#editorWrap').prepend(bar);
    fr = { bar, matches: [], at: 0 };
    const sel = getSelection();
    if (sel && !sel.isCollapsed && ed.contains(sel.anchorNode)) $('.fr-find', bar).value = sel.toString().slice(0, 80);
    bar.addEventListener('input', (e) => { if (e.target.classList.contains('fr-find') || e.target.classList.contains('fr-case')) frRefresh(); });
    bar.addEventListener('change', (e) => { if (e.target.classList.contains('fr-case')) frRefresh(); });
    bar.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { frClose(); ed.focus(); }
      if (e.key === 'Enter' && e.target.classList.contains('fr-find')) { e.preventDefault(); frSelect(fr.at + 1); }
      e.stopPropagation();
    });
    bar.addEventListener('click', (e) => {
      const b = e.target.closest('[data-fr]'); if (!b) return;
      const k = b.dataset.fr;
      if (k === 'close') frClose();
      if (k === 'prev') frSelect(fr.at - 1);
      if (k === 'next') frSelect(fr.at + 1);
      if (k === 'one') frReplaceOne();
      if (k === 'note') frReplaceAllNote();
      if (k === 'notes') frReplaceAllNotes();
    });
    $('.fr-find', bar).focus();
    frRefresh();
  }

  // ================= Version history (kept on this device) =================
  const HKEY = 'notes-app-v1-history';
  const histAll = () => readJSON(HKEY, {});
  function histSave(h) {
    // keep the whole store under ~1.2 MB: drop the oldest versions anywhere first
    let size = JSON.stringify(h).length;
    while (size > 1250000) {
      let oldId = null, oldT = Infinity;
      for (const [id, list] of Object.entries(h)) if (list.length && list[list.length - 1].t < oldT) { oldT = list[list.length - 1].t; oldId = id; }
      if (!oldId) break;
      h[oldId].pop(); if (!h[oldId].length) delete h[oldId];
      size = JSON.stringify(h).length;
    }
    writeJSON(HKEY, h);
  }
  function snapshot(n, force) {
    if (!n || n.locked || n.deleted || !n.html || n.html.length > 300000) return;
    const h = histAll(), list = h[n.id] || [];
    const last = list[0];
    if (last && last.html === n.html) return;
    if (!force && last && Date.now() - last.t < 60000 && Math.abs(last.html.length - n.html.length) < 200) return;
    list.unshift({ t: Date.now(), html: n.html });
    h[n.id] = list.slice(0, 20);
    histSave(h);
  }
  function noteSeen(n) {                          // first time we see a note, keep its current state as the baseline
    if (!n || n.locked) return;
    const h = histAll();
    if (!h[n.id] && n.html) { h[n.id] = [{ t: Date.now(), html: n.html }]; histSave(h); }
  }
  function historyModal(id) {
    const n = C.byId(id); if (!n) return;
    if (n.locked) { C.toast('Unlock the note first: its history is kept from the readable text.'); return; }
    const list = histAll()[id] || [];
    const m = Media.modal('md-history', Media.head('Version history') + `
      <p class="x-note">Versions are kept <b>on this device</b> as you write (up to 20 per note). Restoring one keeps the current text as a version too, so nothing is lost.</p>
      <div class="x-list">${list.length ? list.map((v, i) => `
        <div class="x-row"><div class="x-grow"><b>${fmtWhen(v.t)}</b><span>${C.textLines(v.html).join(' ').slice(0, 90) || 'Empty'}</span></div>
        <button class="pl-btn" data-view="${i}">View</button><button class="pl-btn" data-restore="${i}">Restore</button></div>`).join('')
        : '<p class="x-note">No earlier versions yet. They appear here as you edit this note on this device.</p>'}</div>
      <div class="md-foot"><button class="pl-btn danger" data-clear="1">Clear history</button><span class="grow"></span><button class="pl-btn" data-x="close">Close</button></div>
      <div class="x-preview" hidden></div>`);
    m.el.addEventListener('click', (e) => {
      const view = e.target.closest('[data-view]'), res = e.target.closest('[data-restore]'), clr = e.target.closest('[data-clear]');
      if (view) {
        const pv = $('.x-preview', m.el);
        pv.hidden = !pv.hidden || pv.dataset.i !== view.dataset.view;
        pv.dataset.i = view.dataset.view;
        pv.innerHTML = list[+view.dataset.view].html || '<p>(empty)</p>';
        Blocks.hydrate(pv);
      }
      if (res) {
        const v = list[+res.dataset.restore];
        snapshot(n, true);
        n.html = v.html; n.updated = Date.now();
        C.persist(); m.close();
        C.gotoNote(id);
        C.toast('Restored the version from ' + fmtWhen(v.t));
      }
      if (clr) { const h = histAll(); delete h[id]; histSave(h); m.close(); C.toast('History cleared for this note'); }
    });
  }

  // ================= Merge notes =================
  function mergeInto(srcId, dstId) {
    const src = C.byId(srcId), dst = C.byId(dstId);
    if (!src || !dst || src.id === dst.id) return;
    if (!confirm(`Merge “${C.info(src).title}” into “${C.info(dst).title}”? The merged note keeps both texts, links to the old note are updated, and the old note goes to Trash.`)) return;
    snapshot(dst, true);
    dst.html = (dst.html || '') + '<hr>' + (src.html || '');
    dst.updated = Date.now();
    // links and embedded cards elsewhere that pointed at the source now point at the destination
    const from = `data-note="${src.id}"`, to = `data-note="${dst.id}"`;
    for (const n of C.state().notes) if (n.id !== src.id && n.html && n.html.includes(from)) { n.html = n.html.split(from).join(to); n.updated = Date.now(); }
    src.trashed = true; src.pinned = false; src.updated = Date.now();
    C.persist(); C.renderAll(); C.gotoNote(dst.id);
    C.toast('Notes merged');
  }

  // ================= Evernote (.enex) import =================
  // Compact MD5 (RFC 1321) — .enex files refer to each attachment by the MD5 of its bytes.
  function md5(bytes) {
    const S = [7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21];
    const K = []; for (let i = 0; i < 64; i++) K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296) | 0;
    const l = bytes.length, padLen = ((l % 64) < 56 ? 56 : 120) - (l % 64);
    const msg = new Uint8Array(l + padLen + 8);
    msg.set(bytes); msg[l] = 0x80;
    const dv = new DataView(msg.buffer);
    dv.setUint32(msg.length - 8, (l * 8) >>> 0, true); dv.setUint32(msg.length - 4, Math.floor(l / 536870912), true);
    let a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;
    const M = new Int32Array(16);
    for (let off = 0; off < msg.length; off += 64) {
      for (let i = 0; i < 16; i++) M[i] = dv.getInt32(off + i * 4, true);
      let A = a0, B = b0, Cc = c0, D = d0;
      for (let i = 0; i < 64; i++) {
        let F, g;
        if (i < 16) { F = (B & Cc) | (~B & D); g = i; }
        else if (i < 32) { F = (D & B) | (~D & Cc); g = (5 * i + 1) % 16; }
        else if (i < 48) { F = B ^ Cc ^ D; g = (3 * i + 5) % 16; }
        else { F = Cc ^ (B | ~D); g = (7 * i) % 16; }
        F = (F + A + K[i] + M[g]) | 0;
        A = D; D = Cc; Cc = B;
        B = (B + ((F << S[i]) | (F >>> (32 - S[i])))) | 0;
      }
      a0 = (a0 + A) | 0; b0 = (b0 + B) | 0; c0 = (c0 + Cc) | 0; d0 = (d0 + D) | 0;
    }
    const out = new DataView(new ArrayBuffer(16));
    [a0, b0, c0, d0].forEach((v, i) => out.setUint32(i * 4, v >>> 0, true));
    return [...new Uint8Array(out.buffer)].map((x) => x.toString(16).padStart(2, '0')).join('');
  }
  const ENEX_KEEP = new Set(['div', 'p', 'br', 'b', 'strong', 'i', 'em', 'u', 's', 'strike', 'a', 'ul', 'ol', 'li', 'table', 'thead', 'tbody', 'tr', 'td', 'th', 'h1', 'h2', 'h3', 'h4', 'blockquote', 'pre', 'code', 'hr', 'span', 'font', 'sup', 'sub']);
  function enmlToHtml(root, mediaByHash) {
    const walk = (node) => {
      if (node.nodeType === 3) return esc(node.nodeValue);
      if (node.nodeType !== 1) return '';
      const tag = node.tagName.toLowerCase();
      if (tag === 'en-media') {
        const rec = mediaByHash.get(node.getAttribute('hash') || '');
        return rec ? `<figure class="att" data-att="${rec.id}" data-kind="${rec.kind}" data-name="${esc(rec.name)}" data-type="${esc(rec.type)}" data-size="${rec.size}" contenteditable="false"></figure>` : '';
      }
      if (tag === 'en-todo') return node.getAttribute('checked') === 'true' ? '☑ ' : '☐ ';
      const kids = [...node.childNodes].map(walk).join('');
      if (tag === 'en-note') return kids;
      if (!ENEX_KEEP.has(tag)) return kids;
      if (tag === 'br' || tag === 'hr') return `<${tag}>`;
      if (tag === 'a') { const href = node.getAttribute('href') || ''; return /^https?:|^mailto:/.test(href) ? `<a href="${esc(href)}">${kids}</a>` : kids; }
      if (tag === 'font') return kids;
      return `<${tag}>${kids}</${tag}>`;
    };
    return walk(root);
  }
  const enexDate = (s) => { const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(s || ''); return m ? Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]) : Date.now(); };
  async function importEnex(file) {
    const text = await file.text();
    const doc = new DOMParser().parseFromString(text, 'text/xml');
    if (doc.querySelector('parsererror')) throw new Error('That file could not be read as an Evernote export.');
    const noteEls = [...doc.querySelectorAll('note')];
    if (!noteEls.length) throw new Error('No notes were found in that file.');
    let made = 0;
    for (const ne of noteEls) {
      const title = (ne.querySelector(':scope > title') || {}).textContent || 'Imported note';
      // attachments first, so the content can point at them
      const mediaByHash = new Map();
      for (const res of ne.querySelectorAll(':scope > resource')) {
        const dataEl = res.querySelector('data');
        if (!dataEl) continue;
        const bin = unb64((dataEl.textContent || '').replace(/\s+/g, ''));
        const type = (res.querySelector('mime') || {}).textContent || 'application/octet-stream';
        const name = ((res.querySelector('resource-attributes > file-name') || {}).textContent || '').trim() || ('attachment.' + (type.split('/')[1] || 'bin'));
        const id = 'a' + C.uid();
        const blob = new Blob([bin], { type });
        try { await Blocks.store.put({ id, name, type, size: blob.size, blob, fid: null, created: Date.now() }); } catch { continue; }
        const kind = /^image\//.test(type) ? 'image' : type === 'application/pdf' ? 'pdf' : /^video\//.test(type) ? 'video' : /^audio\//.test(type) ? 'audio' : 'file';
        mediaByHash.set(md5(bin), { id, kind, name, type, size: blob.size });
      }
      const cdata = (ne.querySelector(':scope > content') || {}).textContent || '';
      const inner = new DOMParser().parseFromString(cdata, 'text/html');
      const enNote = inner.querySelector('en-note');
      let html = enNote ? enmlToHtml(enNote, mediaByHash) : '';
      html = html.replace(/<div>\s*<\/div>/g, '').trim();
      const tags = [...ne.querySelectorAll(':scope > tag')].map((t) => t.textContent.trim().toLowerCase().replace(/\s+/g, '-').replace(/^#+/, '')).filter(Boolean);
      if (tags.length) html += `<div>${tags.map((t) => '#' + esc(t)).join(' ')}</div>`;
      if (!/^<h1/.test(html)) html = `<h1>${esc(title)}</h1>` + html;
      const created = enexDate((ne.querySelector(':scope > created') || {}).textContent);
      const updated = enexDate((ne.querySelector(':scope > updated') || {}).textContent);
      C.addNote(html, { created, updated });
      made++;
    }
    C.persist(); C.renderAll();
    C.toast(`Imported ${made} note${made === 1 ? '' : 's'} from Evernote`);
    return made;
  }

  // ================= The note-link graph =================
  function openGraph() {
    const notes = C.state().notes.filter((n) => !n.deleted && !n.trashed);
    const ids = new Set(notes.map((n) => n.id));
    const edges = [], seen = new Set();
    for (const n of notes) {
      if (n.locked) continue;                       // its links are inside the sealed text
      for (const m of (n.html || '').matchAll(/data-note="([^"]+)"/g)) {
        const t = m[1];
        if (t === n.id || !ids.has(t)) continue;
        const k = n.id < t ? n.id + '|' + t : t + '|' + n.id;
        if (seen.has(k)) continue;
        seen.add(k); edges.push([n.id, t]);
      }
    }
    if (!notes.length) { C.toast('No notes yet.'); return; }
    const deg = new Map(notes.map((n) => [n.id, 0]));
    edges.forEach(([a, b]) => { deg.set(a, deg.get(a) + 1); deg.set(b, deg.get(b) + 1); });
    const nodes = notes.map((n, i) => {
      const a = (i / Math.max(1, notes.length)) * Math.PI * 2;
      return { id: n.id, title: C.info(n).title, pinned: !!(n.pinTop || n.pinned), d: deg.get(n.id) || 0, x: 450 + 260 * Math.cos(a), y: 310 + 220 * Math.sin(a), vx: 0, vy: 0 };
    });
    const byIdG = new Map(nodes.map((n) => [n.id, n]));
    for (let tick = 0; tick < 260; tick++) {
      for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i], b = nodes[j];
        let dx = a.x - b.x, dy = a.y - b.y, d2 = dx * dx + dy * dy || 1;
        const f = 2600 / d2, d = Math.sqrt(d2);
        dx = dx / d * f; dy = dy / d * f;
        a.vx += dx; a.vy += dy; b.vx -= dx; b.vy -= dy;
      }
      for (const [ai, bi] of edges) {
        const a = byIdG.get(ai), b = byIdG.get(bi); if (!a || !b) continue;
        const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1;
        const f = (d - 130) * 0.012;
        a.vx += dx / d * f * d * 0.05; a.vy += dy / d * f * d * 0.05; b.vx -= dx / d * f * d * 0.05; b.vy -= dy / d * f * d * 0.05;
      }
      for (const n of nodes) {
        n.vx += (450 - n.x) * 0.004; n.vy += (310 - n.y) * 0.004;
        n.x += Math.max(-14, Math.min(14, n.vx)); n.y += Math.max(-14, Math.min(14, n.vy));
        n.vx *= 0.82; n.vy *= 0.82;
      }
    }
    const xs = nodes.map((n) => n.x), ys = nodes.map((n) => n.y);
    const minX = Math.min(...xs) - 70, maxX = Math.max(...xs) + 70, minY = Math.min(...ys) - 50, maxY = Math.max(...ys) + 50;
    const line = ([a, b]) => { const A = byIdG.get(a), B = byIdG.get(b); return `<line x1="${A.x.toFixed(1)}" y1="${A.y.toFixed(1)}" x2="${B.x.toFixed(1)}" y2="${B.y.toFixed(1)}"/>`; };
    const dot = (n) => `<g class="gnode" data-goto="${esc(n.id)}" tabindex="0" role="button" aria-label="${esc(n.title)}"><circle cx="${n.x.toFixed(1)}" cy="${n.y.toFixed(1)}" r="${7 + Math.min(9, n.d * 2)}" class="${n.pinned ? 'pin' : ''}"/><text x="${n.x.toFixed(1)}" y="${(n.y + 24 + Math.min(9, n.d * 2)).toFixed(1)}">${esc(n.title.slice(0, 22))}</text></g>`;
    const m = Media.modal('md-graph', Media.head('Note graph') + `
      <p class="x-note">Every note is a dot; a line means one note links to or embeds the other. Gold dots are pinned or favorites. Click a dot to open that note.</p>
      <div class="graph-wrap"><svg viewBox="${minX.toFixed(0)} ${minY.toFixed(0)} ${(maxX - minX).toFixed(0)} ${(maxY - minY).toFixed(0)}" role="img" aria-label="Graph of linked notes"><g class="glines">${edges.map(line).join('')}</g>${nodes.map(dot).join('')}</svg></div>
      <div class="md-foot"><span class="x-note">${notes.length} notes · ${edges.length} links</span><span class="grow"></span><button class="pl-btn" data-x="close">Close</button></div>`);
    m.el.addEventListener('click', (e) => { const g = e.target.closest('[data-goto]'); if (g) { m.close(); C.gotoNote(g.dataset.goto); } });
  }

  // ================= Maths (LaTeX) blocks =================
  let katexP = null;
  function loadKaTeX() {
    if (window.katex) return Promise.resolve();
    if (katexP) return katexP;
    katexP = new Promise((ok, no) => {
      const css = document.createElement('link');
      css.rel = 'stylesheet'; css.href = 'https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css';
      document.head.appendChild(css);
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js';
      const timer = setTimeout(() => { katexP = null; no(new Error('the maths renderer took too long to download')); }, 12000);
      s.onload = () => { clearTimeout(timer); ok(); };
      s.onerror = () => { clearTimeout(timer); katexP = null; no(new Error('could not download the maths renderer')); };
      document.head.appendChild(s);
    });
    return katexP;
  }
  async function renderMath(el) {
    const tex = el.dataset.tex || '';
    try {
      await loadKaTeX();
      window.katex.render(tex, el, { displayMode: true, throwOnError: false, trust: false });
    } catch { el.innerHTML = `<span class="math-fallback">${esc(tex)}</span>`; }
  }
  function caretBlockEl() {
    const sel = getSelection();
    if (!sel.rangeCount) return null;
    let node = sel.anchorNode;
    if (!node || !ed.contains(node)) return null;
    if (node === ed) return ed.childNodes[sel.anchorOffset] || ed.lastChild;
    while (node.parentNode && node.parentNode !== ed) node = node.parentNode;
    return node;
  }
  function insertMathBlock(tex) {
    const div = document.createElement('div');
    div.className = 'blk-math'; div.dataset.tex = tex; div.contentEditable = 'false';
    const cur = caretBlockEl();
    const blank = cur && cur.tagName === 'DIV' && !cur.className && !cur.textContent.trim() && !cur.querySelector('img, figure, table, hr');
    if (blank) cur.replaceWith(div); else if (cur) cur.after(div); else ed.appendChild(div);
    if (!div.nextSibling) { const line = document.createElement('div'); line.innerHTML = '<br>'; div.after(line); }
    renderMath(div);
    C.onEdit();
  }
  function mathForm(existing, el) {
    const m = Media.modal('md-math', Media.head(existing ? 'Edit maths' : 'Add maths') + `
      <form class="x-form">
        <label>LaTeX<textarea name="tex" rows="3" placeholder="e.g. \frac{a}{b} + \sqrt{x} = \sum_{i=1}^{n} i">${esc(existing || '')}</textarea></label>
        <div class="math-preview" aria-live="polite"></div>
        <div class="md-foot"><span class="grow"></span><button class="pl-btn" type="button" data-x="close">Cancel</button><button class="pl-btn primary" type="submit">${existing ? 'Save' : 'Add'}</button></div>
      </form>`);
    const ta = $('[name=tex]', m.el), pv = $('.math-preview', m.el);
    const draw = async () => { pv.innerHTML = ''; if (!ta.value.trim()) return; const d = document.createElement('div'); pv.appendChild(d); try { await loadKaTeX(); window.katex.render(ta.value, d, { displayMode: true, throwOnError: false }); } catch { d.textContent = ta.value; } };
    ta.addEventListener('input', draw); draw(); ta.focus();
    $('form', m.el).addEventListener('submit', (e) => {
      e.preventDefault();
      const tex = ta.value.trim(); if (!tex) return;
      m.close();
      if (el) { el.dataset.tex = tex; renderMath(el); C.onEdit(); }
      else insertMathBlock(tex);
    });
  }

  // ================= Text from a photo, scan or sketch (handwriting too) =================
  async function ocrTextOf(fig) {
    const id = fig.dataset.att; if (!id) return '';
    let rec = await Blocks.store.get(id).catch(() => null);
    if (rec && rec.ocrText) return rec.ocrText;
    Blocks.ocrEnqueue(id);
    for (let i = 0; i < 40; i++) {
      await new Promise((r) => setTimeout(r, 750));
      rec = await Blocks.store.get(id).catch(() => null);
      if (rec && rec.ocrAt) return rec.ocrText || '';
    }
    return '';
  }
  async function textFromImages() {
    if (!C.currentId()) { C.toast('Open a note first.'); return; }
    const figs = [...ed.querySelectorAll('figure.att[data-kind="image"]')];
    if (!figs.length) { C.toast('This note has no photo or sketch to read.'); return; }
    C.toast('Reading the pictures in this note: this stays on your device…');
    let added = 0;
    for (const fig of figs) {
      const text = await ocrTextOf(fig);
      if (!text) continue;
      const d = document.createElement('div');
      d.textContent = text;
      fig.after(d); added++;
    }
    if (added) { C.onEdit(); C.toast(`Added the text from ${added} picture${added === 1 ? '' : 's'} under each one. Clear writing reads best.`); }
    else C.toast('No readable text was found in the pictures of this note.');
  }

  // ================= Dictation =================
  let recog = null;
  function toggleDictation(btn) {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (recog) { recog.stop(); return; }
    if (!SR) { C.toast('Dictation isn’t available in this app or browser.'); return; }
    if (!C.currentId()) { C.toast('Open a note first.'); return; }
    const r = new SR();
    r.continuous = true; r.interimResults = false;
    try { r.lang = localStorage.getItem('notes-dictate-lang') || navigator.language || 'en-US'; } catch { r.lang = 'en-US'; }
    r.onresult = (e) => {
      ed.focus();
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) document.execCommand('insertText', false, e.results[i][0].transcript.replace(/^\s+/, '') + ' ');
      }
      C.onEdit();
    };
    r.onerror = (e) => { if (e.error !== 'aborted') C.toast('Dictation stopped: ' + (e.error === 'not-allowed' ? 'microphone permission is needed' : e.error)); };
    r.onend = () => { recog = null; if (btn) { btn.classList.remove('on'); btn.title = 'Dictate: speak and it types'; } };
    try { r.start(); recog = r; if (btn) { btn.classList.add('on'); btn.title = 'Dictating… click to stop'; } C.toast('Dictating: speak, and click the mic again to stop.'); }
    catch (err) { C.toast('Dictation couldn’t start: ' + err.message); }
  }

  // ================= Transcribe a recording (on-device Whisper) =================
  let whisperP = null;
  function loadWhisper(progress) {
    if (whisperP) return whisperP;
    whisperP = (async () => {
      const T = await import('https://esm.run/@xenova/transformers@2.17.2');
      T.env.allowLocalModels = false;
      return T.pipeline('automatic-speech-recognition', 'Xenova/whisper-base', { progress_callback: progress });
    })().catch((e) => { whisperP = null; throw e; });
    return whisperP;
  }
  async function audioSamples(blob) {
    const buf = await blob.arrayBuffer();
    const AC = window.AudioContext || window.webkitAudioContext;
    const ac = new AC();
    const decoded = await ac.decodeAudioData(buf);
    ac.close();
    const off = new OfflineAudioContext(1, Math.ceil(decoded.duration * 16000), 16000);
    const src = off.createBufferSource(); src.buffer = decoded; src.connect(off.destination); src.start();
    return (await off.startRendering()).getChannelData(0);
  }
  async function transcribeAudio() {
    if (!C.currentId()) { C.toast('Open a note first.'); return; }
    const figs = [...ed.querySelectorAll('figure.att[data-kind="audio"]')];
    if (!figs.length) { C.toast('This note has no audio recording to transcribe.'); return; }
    const m = Media.modal('md-transcribe', Media.head('Transcribe recording') + `
      <p class="x-note">The speech model (about 150 MB) downloads once, then everything runs <b>on this device</b>: your recordings never leave it. Long recordings take a while.</p>
      <div class="x-progress"><div class="x-bar"></div></div>
      <p class="x-note x-status">Preparing…</p>
      <div class="md-foot"><span class="grow"></span><button class="pl-btn" data-x="close">Cancel</button></div>`, { sticky: true });
    const bar = $('.x-bar', m.el), status = $('.x-status', m.el);
    let cancelled = false;
    m.box.addEventListener('click', (e) => { if (e.target.closest('[data-x="close"]')) cancelled = true; });
    try {
      const asr = await loadWhisper((p) => {
        if (!m.box.isConnected) return;
        if (p.status === 'progress' && p.file) { bar.style.width = Math.round(p.progress || 0) + '%'; status.textContent = 'Downloading the speech model: ' + Math.round(p.progress || 0) + '%'; }
        if (p.status === 'ready') { bar.style.width = '100%'; status.textContent = 'Model ready.'; }
      });
      let done = 0;
      for (const fig of figs) {
        if (cancelled || !m.box.isConnected) break;
        const rec = await Blocks.store.get(fig.dataset.att).catch(() => null);
        if (!rec) continue;
        status.textContent = `Listening to “${rec.name || 'recording'}”…`;
        bar.style.width = '100%';
        const samples = await audioSamples(rec.blob);
        const out = await asr(samples, { chunk_length_s: 30, stride_length_s: 5, task: 'transcribe', return_timestamps: false });
        const text = (out && out.text || '').trim();
        if (text) {
          const d = document.createElement('div');
          d.className = 'blk-transcript';
          d.innerHTML = '<b>Transcript:</b> ';
          d.appendChild(document.createTextNode(text));
          fig.after(d); done++;
        }
      }
      if (done) { C.onEdit(); C.toast(`Transcribed ${done} recording${done === 1 ? '' : 's'} into this note`); }
      else if (!cancelled) C.toast('No speech could be made out in the recordings.');
    } catch (err) {
      console.error('transcription failed', err);
      C.toast('Transcription failed: ' + (err.message || err) + ' (it needs an internet connection the first time, to fetch the model)');
    }
    m.close();
  }

  // ================= Publish to web (through the user's own Google Drive) =================
  async function publish(id) {
    const n = C.byId(id); if (!n) return;
    const title = C.info(n).title;
    const m = Media.modal('md-publish', Media.head('Publish to web') + `
      <p class="x-note">This puts a read-only web page of “${esc(title)}” in your Google Drive and shares it as <b>anyone with the link can view</b>. The link keeps working until you unpublish. Editing the note does not change the page: publish again to update it.</p>
      ${n.pub ? `<div class="x-linkrow"><input readonly value="${esc(n.pub.link)}" aria-label="Published link"><button class="pl-btn" data-copy="1">Copy link</button></div>
      <p class="x-note">Published ${fmtWhen(n.pub.at)}.</p>` : ''}
      <div class="md-foot">${n.pub ? '<button class="pl-btn danger" data-unpub="1">Unpublish</button>' : ''}<span class="grow"></span>
      <button class="pl-btn" data-x="close">Close</button><button class="pl-btn primary" data-pub="1">${n.pub ? 'Publish updated copy' : 'Publish'}</button></div>`);
    m.el.addEventListener('click', async (e) => {
      const copy = e.target.closest('[data-copy]'), pub = e.target.closest('[data-pub]'), unpub = e.target.closest('[data-unpub]');
      if (copy) { const inp = $('input', m.el); inp.select(); try { await navigator.clipboard.writeText(inp.value); C.toast('Link copied'); } catch { document.execCommand('copy'); } return; }
      if (unpub) {
        try { await C.drive.api(`/drive/v3/files/${n.pub.fid}`, { method: 'DELETE' }); } catch (err) { if (err.status !== 404) { C.toast('Could not unpublish: ' + err.message); return; } }
        delete n.pub; C.persist(); m.close(); C.toast('Unpublished: the link no longer works');
        return;
      }
      if (!pub) return;
      if (!C.drive.signedIn()) { C.toast('Sign in to sync first: published pages live in your Google Drive.'); return; }
      pub.disabled = true; pub.textContent = 'Publishing…';
      try {
        const html = await Exporter.htmlDocument(n);
        const folderId = await C.drive.ensureFolder();
        const name = Exporter.fileName(n) + '.html';
        const b = 'nb' + Math.random().toString(36).slice(2);
        const meta = n.pub && n.pub.fid ? { name } : { name, parents: [folderId], mimeType: 'text/html' };
        const body = new Blob([`--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${b}\r\nContent-Type: text/html; charset=UTF-8\r\n\r\n`, html, `\r\n--${b}--`]);
        const path = n.pub && n.pub.fid ? `/upload/drive/v3/files/${n.pub.fid}?uploadType=multipart&fields=id,webViewLink` : '/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink';
        const res = await C.drive.api(path, { method: n.pub && n.pub.fid ? 'PATCH' : 'POST', headers: { 'Content-Type': 'multipart/related; boundary=' + b }, body });
        const j = await res.json();
        await C.drive.api(`/drive/v3/files/${j.id}/permissions?fields=id`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role: 'reader', type: 'anyone' }) });
        n.pub = { fid: j.id, link: j.webViewLink, at: Date.now() };
        C.persist(); m.close(); publish(id);
        C.toast('Published: anyone with the link can read this note');
      } catch (err) { pub.disabled = false; pub.textContent = 'Publish'; C.toast('Publishing failed: ' + (err.message || err)); }
    });
  }

  // ================= Fingerprint / Face ID unlock for a locked note (WebAuthn PRF) =================
  // The note's own AES key is wrapped with a key derived from the passkey's PRF output, so the biometric check
  // itself produces the key: nothing usable is stored, and a copied storage file alone can't open the note.
  const BKEY = 'notes-app-v1-bio';
  const bioAll = () => readJSON(BKEY, {});
  const bioSave = (b) => writeJSON(BKEY, b);
  const b64url = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const unb64url = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
  const prfSaltFor = async (id) => new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode('notes-bio-prf:' + id)));
  async function deriveKeyExtractable(password, salt, it) {
    const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: it }, base, { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
  }
  const bioSupported = () => !!(window.PublicKeyCredential && crypto.subtle && navigator.credentials);
  async function bioEnable(id) {
    const n = C.byId(id); if (!n || !n.locked || !n.enc) return;
    if (!bioSupported()) { C.toast('Fingerprint / Face ID unlock isn’t available in this app or browser.'); return; }
    const m = Media.modal('md-bio', Media.head('Fingerprint / Face ID unlock') + `
      <form class="x-form"><p class="x-note">Enter this note's password once. Your device will then be able to unlock it with your fingerprint or face, using the same encryption: the biometric check itself creates the key, so nothing extra is stored in a readable form.</p>
      <label>Note password<input type="password" name="pw" autocomplete="off" required></label>
      <div class="auth-err" data-err role="alert"></div>
      <div class="md-foot"><span class="grow"></span><button class="pl-btn" type="button" data-x="close">Cancel</button><button class="pl-btn primary" type="submit">Set up</button></div></form>`, { sticky: true });
    $('form', m.el).addEventListener('submit', async (e) => {
      e.preventDefault();
      const err = $('[data-err]', m.el), go = $('[type=submit]', m.el);
      go.disabled = true; err.textContent = '';
      try {
        const salt = unb64(n.enc.salt);
        const key = await deriveKeyExtractable($('[name=pw]', m.el).value, salt, n.enc.it);
        await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(n.enc.iv) }, key, unb64(n.enc.ct));   // proves the password
        const prfSalt = await prfSaltFor(id);
        const cred = await navigator.credentials.create({ publicKey: {
          challenge: crypto.getRandomValues(new Uint8Array(32)),
          rp: { name: 'Notes' },
          user: { id: new TextEncoder().encode(id).slice(0, 64), name: C.info(n).title || 'Locked note', displayName: 'Notes' },
          pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
          authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'preferred' },
          extensions: { prf: { eval: { first: prfSalt } } },
        } });
        if (!cred) throw new Error('No passkey was created.');
        const credId = b64url(new Uint8Array(cred.rawId));
        const assertion = await navigator.credentials.get({ publicKey: {
          challenge: crypto.getRandomValues(new Uint8Array(32)),
          allowCredentials: [{ type: 'public-key', id: cred.rawId }],
          userVerification: 'required',
          extensions: { prf: { evalByCredential: { [credId]: { first: prfSalt } } } },
        } });
        const prf = assertion && assertion.getClientExtensionResults().prf && assertion.getClientExtensionResults().prf.results && assertion.getClientExtensionResults().prf.results.first;
        if (!prf) throw new Error('This device’s passkey doesn’t support the PRF extension needed for real encryption, so nothing was set up.');
        const wrapKey = await crypto.subtle.importKey('raw', prf, 'AES-GCM', false, ['encrypt']);
        const raw = await crypto.subtle.exportKey('raw', key);
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, wrapKey, raw);
        const all = bioAll(); all[id] = { cred: credId, iv: b64(new Uint8Array(iv)), ct: b64(new Uint8Array(ct)) }; bioSave(all);
        m.close(); C.toast('Set up: use your fingerprint or face on the lock screen');
      } catch (ex) { go.disabled = false; err.textContent = 'Couldn’t set it up: ' + (ex.message || ex); }
    });
  }
  function bioDisable(id) { const all = bioAll(); delete all[id]; bioSave(all); C.toast('Fingerprint / Face ID unlock turned off for this note'); }
  let bioNote = null;
  function lockShown(n) {
    bioNote = n;
    const btn = $('#bioBtn'); if (!btn) return;
    btn.hidden = !(n && bioAll()[n.id] && bioSupported());
  }
  async function bioUnlock() {
    const n = bioNote || C.byId(C.currentId());
    const err = $('#lockErr');
    if (!n || !n.enc) return;
    const rec = bioAll()[n.id]; if (!rec) return;
    try {
      const prfSalt = await prfSaltFor(n.id);
      const assertion = await navigator.credentials.get({ publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        allowCredentials: [{ type: 'public-key', id: unb64url(rec.cred) }],
        userVerification: 'required',
        extensions: { prf: { evalByCredential: { [rec.cred]: { first: prfSalt } } } },
      } });
      const ext = assertion.getClientExtensionResults().prf;
      const prf = ext && ext.results && ext.results.first;
      if (!prf) throw new Error('No key from the biometric check.');
      const wrapKey = await crypto.subtle.importKey('raw', prf, 'AES-GCM', false, ['decrypt']);
      const raw = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(rec.iv) }, wrapKey, unb64(rec.ct));
      const key = await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
      const html = new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(n.enc.iv) }, key, unb64(n.enc.ct)));
      C.unlockWithKey(n.id, html, key, unb64(n.enc.salt), n.enc.it);
    } catch (ex) { if (err) err.textContent = 'Biometric unlock didn’t work: ' + (ex.message || ex) + ' You can still type the password.'; }
  }

  // ================= App lock (a password gate for the whole app, on this device) =================
  const AKEY = 'notes-app-v1-applock';
  const alock = () => readJSON(AKEY, {});
  let appUnlocked = false, lockOverlay = null, lastActive = Date.now();
  async function alockKey(password, salt) {
    const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 600000 }, base, { name: 'AES-GCM', length: 256 }, true, ['encrypt']);
  }
  const alockCheck = async (key) => b64(new Uint8Array(await crypto.subtle.digest('SHA-256', await crypto.subtle.exportKey('raw', key))));
  function showAppLock() {
    if (lockOverlay || !alock().check || appUnlocked) return;
    const box = document.createElement('div');
    box.className = 'applock';
    box.innerHTML = `<form class="applock-card">
      <div class="lock-big"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg></div>
      <h2>Notes is locked</h2><p>Enter the app password.</p>
      <input type="password" placeholder="App password" aria-label="App password" autocomplete="off">
      <div class="auth-err" role="alert"></div>
      <button class="btn" type="submit">Unlock</button>
      ${alock().bioCred && bioSupported() ? '<button class="btn ghost" type="button" data-bio="1">Use fingerprint / Face ID</button>' : ''}
    </form>`;
    document.body.appendChild(box);
    lockOverlay = box;
    const input = $('input', box), err = $('.auth-err', box);
    input.focus();
    $('form', box).addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const key = await alockKey(input.value, unb64(alock().salt));
        if (await alockCheck(key) !== alock().check) throw new Error('That password isn’t right.');
        unlockApp();
      } catch (ex) { err.textContent = ex.message || 'That password isn’t right.'; input.select(); }
    });
    const bb = $('[data-bio]', box);
    if (bb) bb.onclick = async () => {
      try {
        await navigator.credentials.get({ publicKey: { challenge: crypto.getRandomValues(new Uint8Array(32)), allowCredentials: [{ type: 'public-key', id: unb64url(alock().bioCred) }], userVerification: 'required' } });
        unlockApp();
      } catch (ex) { err.textContent = 'Biometric unlock didn’t work. Type the password instead.'; }
    };
  }
  function unlockApp() { appUnlocked = true; lastActive = Date.now(); if (lockOverlay) { lockOverlay.remove(); lockOverlay = null; } }
  function lockAppNow() { if (!alock().check) return; appUnlocked = false; showAppLock(); }
  function appLockForm() {
    const on = !!alock().check;
    const m = Media.modal('md-applock', Media.head('App lock') + `
      <p class="x-note">App lock asks for a password when Notes is opened on this device, and again after 5 minutes away. It keeps people who pick up your device out of the app. It does <b>not</b> encrypt your notes: for that, lock a note with its own password.</p>
      ${on ? '<p class="x-note"><b>App lock is on.</b></p>' : ''}
      <form class="x-form">
        <label>${on ? 'Current password' : 'New app password'}<input type="password" name="cur" autocomplete="off"></label>
        ${on ? '<label>New password (leave blank to keep it)<input type="password" name="new" autocomplete="off"></label>' : '<label>Type it again<input type="password" name="new2" autocomplete="off"></label>'}
        <div class="auth-err" data-err role="alert"></div>
        <div class="md-foot">
          ${on ? '<button class="pl-btn danger" type="button" data-off="1">Turn off app lock</button><button class="pl-btn" type="button" data-locknow="1">Lock now</button>' : ''}
          <span class="grow"></span><button class="pl-btn" type="button" data-x="close">Cancel</button>
          <button class="pl-btn primary" type="submit">${on ? 'Save' : 'Turn on app lock'}</button></div>
      </form>
      ${on && bioSupported() ? `<div class="md-foot"><span class="x-note">${alock().bioCred ? 'Fingerprint / Face ID is on for the app lock.' : 'You can also unlock the app with your fingerprint or face.'}</span><span class="grow"></span><button class="pl-btn" data-bio-toggle="1">${alock().bioCred ? 'Turn off biometrics' : 'Use fingerprint / Face ID'}</button></div>` : ''}`, { sticky: true });
    const err = $('[data-err]', m.el);
    $('form', m.el).addEventListener('submit', async (e) => {
      e.preventDefault();
      const cur = $('[name=cur]', m.el).value;
      try {
        if (on) {
          const key = await alockKey(cur, unb64(alock().salt));
          if (await alockCheck(key) !== alock().check) throw new Error('The current password isn’t right.');
          const nw = $('[name=new]', m.el).value;
          if (nw) {
            if (nw.length < 4) throw new Error('Use at least 4 characters.');
            const salt = crypto.getRandomValues(new Uint8Array(16));
            writeJSON(AKEY, { ...alock(), salt: b64(salt), check: await alockCheck(await alockKey(nw, salt)) });
            C.toast('App password changed');
          }
          m.close();
        } else {
          const nw2 = $('[name=new2]', m.el).value;
          if (cur.length < 4) throw new Error('Use at least 4 characters.');
          if (cur !== nw2) throw new Error('The two passwords don’t match.');
          const salt = crypto.getRandomValues(new Uint8Array(16));
          writeJSON(AKEY, { salt: b64(salt), check: await alockCheck(await alockKey(cur, salt)) });
          appUnlocked = true;
          m.close(); C.toast('App lock is on');
        }
      } catch (ex) { err.textContent = ex.message || String(ex); }
    });
    const off = $('[data-off]', m.el);
    if (off) off.onclick = async () => {
      const cur = $('[name=cur]', m.el).value;
      try {
        const key = await alockKey(cur, unb64(alock().salt));
        if (await alockCheck(key) !== alock().check) throw new Error('Enter the current password to turn it off.');
        localStorage.removeItem(AKEY); appUnlocked = true; m.close(); C.toast('App lock is off');
      } catch (ex) { err.textContent = ex.message || String(ex); }
    };
    const ln = $('[data-locknow]', m.el);
    if (ln) ln.onclick = () => { m.close(); lockAppNow(); };
    const bt = $('[data-bio-toggle]', m.el);
    if (bt) bt.onclick = async () => {
      try {
        if (alock().bioCred) { writeJSON(AKEY, { ...alock(), bioCred: null }); m.close(); C.toast('Biometrics off for the app lock'); return; }
        const cred = await navigator.credentials.create({ publicKey: {
          challenge: crypto.getRandomValues(new Uint8Array(32)), rp: { name: 'Notes' },
          user: { id: new TextEncoder().encode('notes-app-lock'), name: 'Notes app lock', displayName: 'Notes' },
          pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
          authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'preferred' } } });
        writeJSON(AKEY, { ...alock(), bioCred: b64url(new Uint8Array(cred.rawId)) });
        m.close(); C.toast('Biometrics on for the app lock');
      } catch (ex) { err.textContent = 'Couldn’t set that up: ' + (ex.message || ex); }
    };
  }
  ['pointerdown', 'keydown'].forEach((ev) => addEventListener(ev, () => { lastActive = Date.now(); }, true));
  setInterval(() => { if (alock().check && appUnlocked && Date.now() - lastActive > 5 * 60000) lockAppNow(); }, 15000);
  document.addEventListener('visibilitychange', () => { if (document.hidden) lastActive = Math.min(lastActive, Date.now()); else if (alock().check && appUnlocked && Date.now() - lastActive > 5 * 60000) lockAppNow(); });
  if (crypto.subtle && alock().check) showAppLock();      // before app.js paints anything (this file loads first)

  // ================= Wiring =================
  function actionButton(id, title, svgPath, run) {
    const b = document.createElement('button');
    b.className = 'icon-btn'; b.id = id; b.title = title; b.setAttribute('aria-label', title);
    b.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${svgPath}</svg>`;
    b.addEventListener('click', () => run(b));
    return b;
  }
  function init(core) {
    C = core; ed = core.editor;
    const addSmart = $('#addSmart'); if (addSmart) addSmart.onclick = () => smartForm(null);
    const navSmart = $('#navSmart');
    if (navSmart) navSmart.addEventListener('click', (e) => {
      const del = e.target.closest('[data-del-smart]');
      if (del) { e.stopPropagation(); const r = del.getBoundingClientRect(); smartMenu(del.dataset.delSmart, r.left, r.bottom + 4); }
    }, true);
    const actions = $('.actions');
    if (actions) {
      actions.prepend(
        actionButton('dictateBtn', 'Dictate: speak and it types', '<path d="M12 3a3 3 0 0 1 3 3v5a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3z"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>', toggleDictation),
        actionButton('transcribeBtn', 'Transcribe a recording in this note (on this device)', '<path d="M4 10v4M8 7v10M12 4v16M16 8v8M20 11v2"/>', transcribeAudio),
        actionButton('ocrBtn', 'Add the text from a photo or sketch in this note', '<path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3"/><path d="M8 12h8"/>', textFromImages)
      );
    }
    const gb = $('#graphBtn'); if (gb) gb.onclick = openGraph;
    const frb = $('#frBtn'); if (frb) frb.onclick = openFindReplace;
    const al = $('#appLockBtn'); if (al) al.onclick = appLockForm;
    const enex = $('#importEnex');
    if (enex) enex.addEventListener('change', async (e) => {
      const f = e.target.files[0]; e.target.value = '';
      if (!f) return;
      try { await importEnex(f); } catch (err) { C.toast('Evernote import failed: ' + err.message); }
    });
    document.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'h' && C.currentId() && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) { e.preventDefault(); openFindReplace(); }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'l' && alock().check) { e.preventDefault(); lockAppNow(); }
    });
    ed.addEventListener('dblclick', (e) => {
      const math = e.target.closest && e.target.closest('.blk-math');
      if (math) { e.preventDefault(); mathForm(math.dataset.tex || '', math); }
    });
    const lockForm = $('#lockScreen');
    if (lockForm && !$('#bioBtn')) {
      const b = document.createElement('button');
      b.className = 'btn ghost'; b.id = 'bioBtn'; b.type = 'button'; b.hidden = true;
      b.textContent = 'Use fingerprint / Face ID';
      b.addEventListener('click', bioUnlock);
      lockForm.appendChild(b);
    }
  }

  window.Extras = {
    init, renderSmart, smartName: (id) => (smartDef(id) || {}).name || 'Smart folder',
    matchSmart: (id, n) => { const d = smartDef(id); return d ? smartMatch(d, n) : false; },
    noteSaved: (n) => snapshot(n), noteSeen, history: historyModal, mergeInto, publish,
    bioEnable, bioDisable, hasBio: (id) => !!bioAll()[id], lockShown,
    insertMath: () => mathForm(null, null), renderMath, openGraph, openFindReplace,
  };
})();
