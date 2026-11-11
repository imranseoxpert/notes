/* Blocks: the "/" block menu, attachments (image, PDF, video, audio, any file), [[note links]] and backlinks,
   embedded notes and task boards, tables, toggles, callouts, a table of contents, templates, daily notes and
   Markdown import. Works on the note editor in app.js through the `core` object passed to Blocks.init(). */
(() => {
  'use strict';
  let C = null, ed = null;
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fmtSize = (n) => (n < 1024 ? n + ' B' : n < 1048576 ? Math.round(n / 1024) + ' KB' : (n / 1048576).toFixed(1) + ' MB');
  const shortDay = (ymd) => new Date(ymd + 'T00:00:00').toLocaleDateString([], { month: 'short', day: 'numeric' });
  const MAX_FILE = 200 * 1048576;

  // ---------- attachment files (IndexedDB: too big for the normal note storage) ----------
  const store = (() => {
    let dbp = null;
    const open = () => dbp || (dbp = new Promise((ok, no) => {
      const q = indexedDB.open('notes-attachments', 1);
      q.onupgradeneeded = () => q.result.createObjectStore('files', { keyPath: 'id' });
      q.onsuccess = () => ok(q.result);
      q.onerror = () => no(q.error);
    }));
    const run = async (mode, fn) => {
      const db = await open();
      return new Promise((ok, no) => {
        const tx = db.transaction('files', mode);
        const req = fn(tx.objectStore('files'));
        tx.oncomplete = () => ok(req ? req.result : undefined);
        tx.onerror = tx.onabort = () => no(tx.error);
      });
    };
    return { get: (id) => run('readonly', (s) => s.get(id)), put: (rec) => run('readwrite', (s) => s.put(rec)), all: () => run('readonly', (s) => s.getAll()) };
  })();
  const urls = new Map();
  const urlFor = (rec) => { if (!urls.has(rec.id)) urls.set(rec.id, URL.createObjectURL(rec.blob)); return urls.get(rec.id); };
  // the type from the file name, for when the system doesn't report one
  const EXT_TYPES = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', heic: 'image/heic', heif: 'image/heif',
    avif: 'image/avif', bmp: 'image/bmp', tif: 'image/tiff', tiff: 'image/tiff', svg: 'image/svg+xml', pdf: 'application/pdf', mp4: 'video/mp4', mov: 'video/quicktime',
    m4v: 'video/mp4', webm: 'video/webm', mp3: 'audio/mpeg', m4a: 'audio/mp4', wav: 'audio/wav', aac: 'audio/aac', ogg: 'audio/ogg' };
  const typeOf = (f) => (f.type && f.type !== 'application/octet-stream' ? f.type : EXT_TYPES[(f.name || '').split('.').pop().toLowerCase()] || 'application/octet-stream');
  const kindOf = (type, name) => (/^image\//.test(type) ? 'image' : type === 'application/pdf' || /\.pdf$/i.test(name) ? 'pdf'
    : /^video\//.test(type) ? 'video' : /^audio\//.test(type) ? 'audio' : 'file');
  const fileIcon = (name, kind) => (kind === 'pdf' ? '📕' : kind === 'audio' ? '🎵' : kind === 'video' ? '🎬' : /\.(zip|rar|7z|gz)$/i.test(name) ? '🗜'
    : /\.(xlsx?|csv|numbers)$/i.test(name) ? '📊' : /\.(docx?|pages|rtf|txt|md)$/i.test(name) ? '📄' : /\.(pptx?|key)$/i.test(name) ? '📽' : '📎');

  async function addFiles(files, range) {
    files = [...files];
    if (!files.length) return;
    if (range) { const s = getSelection(); s.removeAllRanges(); s.addRange(range); }
    for (const f of files) {
      if (f.size > MAX_FILE) { C.toast(`“${f.name}” is larger than 200 MB, so it wasn't added.`); continue; }
      const id = 'a' + C.uid(), name = f.name || 'file', type = typeOf(f), kind = kindOf(type, name);
      // keep a copy of the bytes, not a reference to the file on disk (that reference can stop working, e.g. in the Mac app)
      let blob;
      try { blob = new Blob([await f.arrayBuffer()], { type }); }
      catch (err) { C.toast(`Couldn't read “${name}”. Please try adding it again.`); continue; }
      try { await store.put({ id, name, type, size: blob.size, blob, fid: null, created: Date.now() }); }
      catch (err) { C.toast(`Couldn't save “${name}” on this device: ${err && err.message ? err.message : err}`); continue; }
      insertBlock(`<figure class="att" data-att="${id}" data-kind="${kind}" data-name="${esc(name)}" data-type="${esc(type)}" data-size="${blob.size}" contenteditable="false"></figure>`);
      C.toast(`Added ${name} · ${fmtSize(blob.size)}`);
      if (reader.wants(kind, name)) reader.add(id);
    }
    C.scheduleSync();
  }
  let pickRange = null;
  async function nativePick(images) {               // Mac app: Apple's file picker, bytes read by the app itself
    let list;
    try { list = JSON.parse(await C.native.pickFiles(images)); } catch (err) { C.toast(`Couldn't open the file picker: ${err && err.message ? err.message : err}`); return; }
    const files = [];
    for (const it of list) {
      if (it.error) { C.toast(`“${it.name}”: ${it.error}`); continue; }
      const bin = atob(it.b64), bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      files.push(new File([bytes], it.name, { type: it.type }));
    }
    if (files.length) await addFiles(files, pickRange);
    pickRange = null;
  }
  function pick(accept) {
    const sel = getSelection();
    pickRange = sel.rangeCount && ed.contains(sel.anchorNode) ? sel.getRangeAt(0).cloneRange() : null;
    if (/^image/.test(accept) && C.native && C.native.pickFiles) { nativePick(/video/.test(accept) ? 'media' : true); return; }
    const inp = document.createElement('input');
    inp.type = 'file'; inp.multiple = true; if (accept) inp.accept = accept;
    inp.style.display = 'none';
    document.body.appendChild(inp);                 // attached, so every browser fires "change"
    inp.onchange = () => { addFiles(inp.files, pickRange); pickRange = null; inp.remove(); };
    inp.click();
  }
  async function renderAtt(fig) {
    const id = fig.dataset.att, kind = fig.dataset.kind, name = fig.dataset.name || 'file';
    if (fig.dataset.state === 'loading') return;
    fig.dataset.state = 'loading';
    let rec = await store.get(id).catch(() => null);
    if (!rec) {
      const blob = await C.fetchAttachment(id).catch(() => null);
      if (blob) { rec = { id, name, type: blob.type || fig.dataset.type, size: blob.size, blob, fid: 'drive', created: Date.now() }; await store.put(rec).catch(() => {}); }
    }
    if (!rec) {
      fig.dataset.state = 'missing';
      fig.innerHTML = `<div class="att-bar missing"><span class="att-ic">⏳</span><div><b>${esc(name)}</b><span>Not on this device yet. It downloads once it reaches Google Drive.</span></div></div>`;
      return;
    }
    if (rec.blob instanceof File) {                 // added by an older version: replace the disk reference with the bytes
      try { rec.blob = new Blob([await rec.blob.arrayBuffer()], { type: rec.type || typeOf(rec.blob) }); await store.put(rec).catch(() => {}); }
      catch {
        fig.dataset.state = 'missing';
        fig.innerHTML = `<div class="att-bar missing"><span class="att-ic">⚠️</span><div><b>${esc(name)}</b><span>This file can't be read any more. Please add it again.</span></div></div>`;
        return;
      }
    }
    fig.dataset.state = 'ready';
    if (reader.wants(kind, name) && !rec.ocrAt && !C.noteIsLocked(C.currentId())) reader.add(id);
    const url = urlFor(rec);
    const bar = (extra = '') => `<div class="att-bar"><span class="att-ic">${fileIcon(name, kind)}</span><div><b>${esc(name)}</b><span>${fmtSize(rec.size)}</span></div>${extra}<a class="pl-btn" href="${url}" download="${esc(name)}">Save</a></div>`;
    if (kind === 'image') {
      fig.innerHTML = `<img src="${url}" alt="${esc(name)}" draggable="false">`;
      const img = fig.querySelector('img');
      img.onerror = async () => {                    // fallback 1: load it as a data: URL
        img.onerror = () => { fig.innerHTML = bar('<span class="att-note">Can’t preview this image format here</span>'); };
        try { img.src = await new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = () => no(r.error); r.readAsDataURL(rec.blob); }); }
        catch { img.onerror(); }
      };
    }
    else if (kind === 'video') fig.innerHTML = `<video src="${url}" controls preload="metadata"></video>`;
    else if (kind === 'audio') fig.innerHTML = bar() + `<audio src="${url}" controls preload="metadata"></audio>`;
    else if (kind === 'pdf') fig.innerHTML = bar(`<button class="pl-btn" data-blk="pdftoggle">${fig.dataset.collapsed ? 'Show' : 'Hide'} preview</button>`) + (fig.dataset.collapsed ? '' : `<iframe src="${url}" title="${esc(name)}"></iframe>`);
    else fig.innerHTML = bar();
  }

  // ---------- right-click on an attachment or picture: the app's own menu (Save…, Copy Image, Share…), so saving
  // shows a Save dialog in the Mac / Windows apps and a copied picture pastes into any other app ----------
  async function attBlob(fig) {
    const rec = await store.get(fig.dataset.att).catch(() => null);
    if (!rec) throw new Error('the file isn’t on this device yet');
    return { blob: rec.blob, name: rec.name || fig.dataset.name || 'file' };
  }
  async function imgBlob(img) {                    // a picture that isn't an attachment (e.g. pasted from a web page)
    const blob = await (await fetch(img.src)).blob();
    const ext = ((blob.type.split('/')[1] || 'png').replace('jpeg', 'jpg').replace('svg+xml', 'svg'));
    return { blob, name: 'Image.' + ext };
  }
  const toPNG = (blob) => new Promise((ok, no) => {
    const img = new Image(), url = URL.createObjectURL(blob);
    img.onload = () => {
      const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
      c.getContext('2d').drawImage(img, 0, 0); URL.revokeObjectURL(url);
      c.toBlob((b) => (b ? ok(b) : no(new Error('this picture can’t be copied'))), 'image/png');
    };
    img.onerror = () => { URL.revokeObjectURL(url); no(new Error('this picture’s format can’t be copied')); };
    img.src = url;
  });
  const toB64 = (blob) => new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(',')[1]); r.onerror = () => no(r.error); r.readAsDataURL(blob); });
  const why = (err) => (err && err.message) || err;
  async function saveAtt(get) {
    try { const f = await get(); await Exporter.save(f.name, f.blob); } catch (err) { C.toast(`Couldn’t save: ${why(err)}`); }
  }
  function copyImage(got) {                          // `got` is a promise, so the browser still counts this as the click
    const png = got.then((f) => (f.blob.type === 'image/png' ? f.blob : toPNG(f.blob)));
    const done = C.native && C.native.copyImage
      ? png.then(toB64).then((b) => C.native.copyImage(b)).then((r) => { if (r !== 'ok') throw new Error(r); })   // the app writes the system clipboard
      : navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
    done.then(() => C.toast('Image copied. Paste it into any app.'), (err) => C.toast(`Couldn’t copy the image: ${why(err)}`));
  }
  function onContextMenu(e) {
    const fig = e.target.closest && e.target.closest('figure.att');
    const img = !fig && e.target.tagName === 'IMG' ? e.target : null;
    if ((!fig && !img) || (fig && fig.dataset.state !== 'ready')) return;
    e.preventDefault();
    const isImage = img || fig.dataset.kind === 'image';
    const get = () => (fig ? attBlob(fig) : imgBlob(img));
    const at = { x: e.clientX, y: e.clientY, w: 1, h: 1 };
    const items = [{ label: isImage ? 'Save Image…' : 'Save File…', icon: '⤓', run: () => saveAtt(get) }];
    if (isImage) items.push({ label: 'Copy Image', icon: '⎘', run: () => copyImage(get()) });
    if (Media.canShareFiles()) items.push({ sep: true }, { label: 'Share…', icon: Media.ICONS.share, run: () => get().then((f) => Media.shareFile(f.blob, f.name, at), (err) => C.toast(`Couldn’t share: ${why(err)}`)) });
    C.openMenu(e.clientX, e.clientY, items);
  }

  // ---------- finding text inside photos and scans ----------
  // Tesseract (open source) reads the text on this device: the picture never leaves it. The reader and its English and
  // Bengali language data (a few MB) download from the jsDelivr CDN the first time, and only then. Results are kept with
  // the attachment on this device, so each picture is read once; a failed download just tries again later.
  const reader = (() => {
    const LIB = 'https://cdn.jsdelivr.net/npm/tesseract.js@7.0.0/dist/tesseract.min.js', LANGS = 'eng+ben', MAX_SIDE = 2400, MAX_PDF = 60 * 1048576;
    const found = new Map(), queue = [];
    let worker = null, busy = false, script = null, idle = null;
    const wants = (kind, name) => kind === 'image' || (kind === 'pdf' && /^Scan /.test(name || ''));
    const loadLib = () => script || (script = new Promise((ok, no) => {
      const s = document.createElement('script');
      s.src = LIB; s.onload = ok;
      s.onerror = () => { script = null; s.remove(); no(new Error('could not download the text reader')); };
      document.head.appendChild(s);
    }));
    async function start() {
      if (worker) return worker;
      await loadLib();
      worker = await window.Tesseract.createWorker(LANGS);
      return worker;
    }
    async function readPicture(w, blob) {
      const bmp = await createImageBitmap(blob);
      const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
      const c = document.createElement('canvas');
      c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
      c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
      bmp.close();
      const { data } = await w.recognize(c, {}, { text: true, blocks: true });
      const words = (data.blocks || []).flatMap((b) => b.paragraphs).flatMap((p) => p.lines).flatMap((l) => l.words);
      return (words.length ? words.filter((x) => x.confidence >= 55).map((x) => x.text).join(' ') : data.text || '').replace(/\s+/g, ' ').trim();   // photos without text read as low-confidence noise
    }
    // our scanned PDFs hold one JPEG per page
    async function pagesOfScan(blob) {
      if (blob.size > MAX_PDF) return [];
      const bytes = new Uint8Array(await blob.arrayBuffer()), head = new TextDecoder('latin1').decode(bytes);
      return [...head.matchAll(/\/DCTDecode \/Length (\d+) >>\nstream\n/g)].map((m) => {
        const at = m.index + m[0].length;
        return new Blob([bytes.subarray(at, at + +m[1])], { type: 'image/jpeg' });
      });
    }
    async function pump() {
      if (busy || !queue.length) return;
      busy = true; clearTimeout(idle);
      let w;
      try { w = await start(); }
      catch (err) { busy = false; console.warn('text reader unavailable', err); return; }           // offline: the queue waits
      try { if (!localStorage.getItem('notes-ocr-told')) { localStorage.setItem('notes-ocr-told', '1'); C.toast('Reading text in your pictures so search can find it. This stays on your device.'); } } catch {}
      while (queue.length) {
        const id = queue[0];
        let text = '';
        try {
          const rec = await store.get(id);
          if (rec && !rec.ocrAt) {
            const parts = /pdf/.test(rec.type) ? await pagesOfScan(rec.blob) : [rec.blob];
            const out = [];
            for (const p of parts) out.push(await readPicture(w, p));
            text = out.join(' ').trim();
            if (text.replace(/\s/g, '').length < 3) text = '';           // a stray letter from a photo with no text
          }
        } catch (err) { console.warn('could not read text in', id, err); }                          // an unreadable picture isn't retried
        const fresh = await store.get(id).catch(() => null);                                        // sync may have updated it meanwhile
        if (fresh && !fresh.ocrAt) { fresh.ocrText = text; fresh.ocrAt = Date.now(); await store.put(fresh).catch(() => {}); }
        if (text) { found.set(id, text); C.imagesRead(); }
        queue.shift();
      }
      busy = false;
      idle = setTimeout(() => { if (worker && !queue.length) { worker.terminate(); worker = null; } }, 60000);   // gives its memory back
    }
    const add = (id) => { if (!queue.includes(id)) queue.push(id); pump(); };
    addEventListener('online', pump);
    async function init() {
      const recs = await store.all().catch(() => []);
      recs.forEach((r) => { if (r.ocrText) found.set(r.id, r.ocrText); });
      if (found.size) C.imagesRead();
      if (innerWidth <= 900) return;                     // phones: only pictures you add or open, to save data and battery
      setTimeout(() => {
        const inNotes = new Set(C.state().notes.filter((n) => !n.deleted && !n.locked).flatMap((n) => [...n.html.matchAll(/data-att="([^"]+)"/g)].map((m) => m[1])));
        recs.filter((r) => !r.ocrAt && inNotes.has(r.id) && wants(kindOf(r.type || '', r.name), r.name)).forEach((r) => add(r.id));
      }, 15000);
    }
    return { wants, add, init, textIn: (html) => [...html.matchAll(/data-att="([^"]+)"/g)].map((m) => found.get(m[1])).filter(Boolean).join(' ') };
  })();

  // ---------- caret and block helpers ----------
  function topBlock(node) {
    if (!node || node === ed || !ed.contains(node)) return null;
    while (node.parentNode !== ed) node = node.parentNode;
    return node;
  }
  function caretBlock() {
    const sel = getSelection();
    if (!sel.rangeCount) return null;
    if (sel.anchorNode === ed) return ed.childNodes[sel.anchorOffset] || ed.lastChild;
    return topBlock(sel.anchorNode);
  }
  const isPlaceholderCell = (el) => el && ((/^(TH|TD)$/.test(el.tagName) && /^Column \d+$/.test(el.textContent.trim())) || (el.classList.contains('tg-h') && el.textContent.trim() === 'Toggle'));
  function selectContents(el) { const r = document.createRange(); r.selectNodeContents(el); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }
  function placeCaret(el, atEnd = false) {
    if (!el) return;
    if (isPlaceholderCell(el)) { selectContents(el); return; }
    const r = document.createRange();
    r.selectNodeContents(el); r.collapse(!atEnd);
    const s = getSelection(); s.removeAllRanges(); s.addRange(r);
  }
  function ensureCaret() {
    const sel = getSelection();
    if (sel.rangeCount && ed.contains(sel.anchorNode)) return;
    ed.focus();
    if (!ed.lastChild) ed.innerHTML = '<div><br></div>';
    placeCaret(ed.lastChild, true);
  }
  const isBlankLine = (el) => el && el.nodeType === 1 && el.tagName === 'DIV' && !el.className && !el.textContent.trim() && !el.querySelector('img, figure, table, hr');
  /** Insert block HTML at the caret: it replaces an empty line, otherwise goes after the current block. */
  function insertBlock(html, caretTarget) {
    ensureCaret();
    const tpl = document.createElement('template');
    tpl.innerHTML = html.trim();
    const els = [...tpl.content.childNodes];
    const cur = caretBlock();
    if (cur && isBlankLine(cur)) cur.replaceWith(...els);
    else if (cur) cur.after(...els);
    else ed.append(...els);
    const last = els[els.length - 1];
    if (!isBlankLine(last.nextSibling)) { const line = document.createElement('div'); line.innerHTML = '<br>'; last.after(line); }
    hydrate();
    const target = typeof caretTarget === 'function' ? caretTarget(els[0]) : null;
    if (target) placeCaret(target, true); else placeCaret(last.nextSibling);
    C.onEdit();
    return els[0];
  }

  // ---------- the "/" menu and the [[ note picker ----------
  const T = (k, t, d, ic, g, run, kw = '') => ({ k, t, d, ic, g, run, kw });
  const CMDS = [
    T('p', 'Paragraph', 'Start writing plain text', 'T', 'Basic blocks', () => C.formatBlock('div'), 'text'),
    T('h1', 'Heading 1', 'A big section heading', 'H1', 'Basic blocks', () => C.formatBlock('h1'), 'title #'),
    T('h2', 'Heading 2', 'A medium section heading', 'H2', 'Basic blocks', () => C.formatBlock('h2'), '##'),
    T('h3', 'Heading 3', 'A small section heading', 'H3', 'Basic blocks', () => C.formatBlock('h3'), '###'),
    T('ul', 'Bullet list', 'A list of bullets', '•', 'Basic blocks', () => C.run('ul'), 'unordered'),
    T('ol', 'Numbered list', 'A list with numbering', '1.', 'Basic blocks', () => C.run('ol'), 'ordered'),
    T('check', 'Task list', 'A checklist to track to-dos', '☑', 'Basic blocks', () => C.run('check'), 'todo checkbox'),
    T('quote', 'Quote', 'Capture a quote', '❝', 'Basic blocks', () => C.formatBlock('blockquote')),
    T('callout', 'Callout', 'Make a line stand out', '💡', 'Basic blocks', () => insertBlock('<div class="callout" data-icon="💡"><br></div>', (el) => el), 'note tip warning'),
    T('toggle', 'Toggle list', 'Hide details inside a toggle', '▸', 'Basic blocks', () => insertBlock('<div class="toggle open"><div class="tg-h">Toggle</div><div class="tg-b"><div><br></div></div></div>', (el) => el.querySelector('.tg-h')), 'collapse details'),
    T('code', 'Code block', 'Code in a monospace font', '</>', 'Basic blocks', () => C.formatBlock('pre')),
    T('table', 'Table', 'Rows and columns', '⊞', 'Basic blocks', () => insertBlock(tableHTML(3, 3), (el) => el.querySelector('th'))),
    T('hr', 'Divider', 'Visually divide blocks', '—', 'Basic blocks', () => insertBlock('<hr>'), 'line separator'),
    T('image', 'Image', 'Upload, paste or drop an image', '🖼', 'Media', () => pick('image/*'), 'photo picture'),
    T('pdf', 'PDF', 'Add a PDF with a preview', '📕', 'Media', () => pick('application/pdf,.pdf')),
    T('video', 'Video', 'Add a video', '🎬', 'Media', () => pick('video/*'), 'movie'),
    T('audio', 'Audio', 'Add a recording or song', '🎵', 'Media', () => pick('audio/*'), 'sound voice'),
    T('file', 'File', 'Attach any file', '📎', 'Media', () => pick(''), 'attachment upload'),
    T('record', 'Record audio', 'Record a voice note', '🎙', 'Media', () => Media.recordAudio(), 'voice microphone memo'),
    T('camera', 'Take photo', 'Use your camera', '📷', 'Media', () => Media.takePhoto(), 'picture webcam'),
    T('scan', 'Scan document', 'Pages from your camera, as a PDF', '🧾', 'Media', () => Media.scanDocuments(), 'scanner paper receipt'),
    T('sketch', 'Sketch', 'Draw with mouse, pen or finger', '✏️', 'Media', () => Media.addSketch(), 'drawing draw doodle'),
    T('link', 'Link to note', 'Link another note inline, like [[ ]]', '↗', 'Notes', () => { document.execCommand('insertText', false, '[['); openMenuAtCaret('link', 2); }, 'wiki mention'),
    T('doc', 'Document', 'Embed another note as a card', '📄', 'Notes', () => openNotePicker(), 'embed page'),
    T('page', 'Sub-page', 'Create a new note inside this one', '📑', 'Notes', subPage, 'child page'),
    T('board', 'Board', 'A task board for this note', '▥', 'Planner', () => insertBlock('<div class="blk-board" contenteditable="false"></div>'), 'kanban tasks'),
    T('mindmap', 'Mind map', 'Brainstorm with topics and branches', '🧠', 'Mind map', () => MindMap.insertBlank(), 'mindmap brainstorm diagram tree xmind'),
    T('mindmap-note', 'Mind map from this note', 'Turn the headings and lists into a map', '🗺', 'Mind map', () => MindMap.insertFromNote(), 'mindmap outline visualize convert'),
    T('task', 'Task', 'A task linked to this note', '○', 'Planner', () => C.taskFromNote(), 'todo reminder'),
    T('toc', 'Table of contents', 'A list of this note’s headings', '≡', 'Other', () => insertBlock('<div class="blk-toc" contenteditable="false"></div>'), 'outline'),
    T('date', 'Today’s date', 'Insert the date', '📅', 'Other', () => document.execCommand('insertText', false, new Date().toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })), 'now'),
    T('tpl-meeting', 'Meeting notes', 'Agenda, notes, action items', '🗓', 'Templates', () => insertTemplate('meeting'), 'template'),
    T('tpl-project', 'Project plan', 'Goal, milestones, tasks, risks', '🚀', 'Templates', () => insertTemplate('project'), 'template'),
    T('tpl-journal', 'Daily journal', 'Priorities, notes, gratitude', '📓', 'Templates', () => insertTemplate('journal'), 'template diary'),
    T('tpl-weekly', 'Weekly review', 'Wins, lessons, next week', '🔁', 'Templates', () => insertTemplate('weekly'), 'template'),
  ];

  let menu = null;     // { el, mode: 'slash' | 'link' | 'embed', node, offset, items, sel }
  function openMenuAtCaret(mode, back) {
    const sel = getSelection();
    if (!sel.rangeCount) return;
    const node = sel.anchorNode, off = sel.anchorOffset;
    if (!node || node.nodeType !== 3) return;
    openMenu(mode, node, off - back);
  }
  function openMenu(mode, node, offset) {
    closeMenu();
    const el = document.createElement('div');
    el.className = 'blk-menu'; el.setAttribute('role', 'listbox');
    document.body.appendChild(el);
    menu = { el, mode, node, offset, items: [], sel: 0 };
    el.addEventListener('mousedown', (e) => { if (!e.target.closest('.blk-search')) e.preventDefault(); });
    el.addEventListener('click', (e) => { const r = e.target.closest('[data-i]'); if (r) choose(+r.dataset.i); });
    updateMenu();
  }
  function closeMenu() { if (menu) { menu.el.remove(); menu = null; } }
  function menuQuery() {
    const sel = getSelection();
    if (!menu) return null;
    if (menu.mode === 'embed') return menu.q || '';
    if (!sel.rangeCount || sel.anchorNode !== menu.node || sel.anchorOffset <= menu.offset) return null;
    return menu.node.data.slice(menu.offset + (menu.mode === 'slash' ? 1 : 2), sel.anchorOffset);
  }
  function updateMenu() {
    if (!menu) return;
    const q = menuQuery();
    if (q == null || (menu.mode === 'slash' && (q.length > 24 || /\s\s/.test(q))) || (menu.mode === 'link' && /\]\]|\n/.test(q))) { closeMenu(); return; }
    const ql = q.toLowerCase().trim();
    if (menu.mode === 'slash') {
      menu.items = CMDS.filter((c) => !ql || (c.t + ' ' + c.kw + ' ' + c.k).toLowerCase().includes(ql));
      if (!menu.items.length) { closeMenu(); return; }
    } else {
      const notes = C.notesList().filter((n) => n.id !== C.currentId() && (!ql || n.title.toLowerCase().includes(ql))).slice(0, 8);
      menu.items = notes.map((n) => ({ note: n.id, t: n.title, d: 'Note', ic: '📄' }));
      if (q.trim()) menu.items.push({ create: q.trim(), t: `Create “${q.trim()}”`, d: 'New note', ic: '＋' });
      if (!menu.items.length) menu.items.push({ none: true, t: 'Type a note title…', d: '', ic: '⌕' });
    }
    menu.sel = Math.min(menu.sel, menu.items.length - 1);
    let lastG = null;
    const hadSearch = menu.mode === 'embed' && $('.blk-search', menu.el);
    const listHTML = menu.items.map((it, i) => {
      const g = it.g && it.g !== lastG ? `<div class="blk-g">${esc(it.g)}</div>` : '';
      lastG = it.g || lastG;
      return `${g}<div class="blk-item${i === menu.sel ? ' sel' : ''}" data-i="${i}" role="option"><span class="blk-ic">${esc(it.ic)}</span><div><b>${esc(it.t)}</b><span>${esc(it.d)}</span></div></div>`;
    }).join('');
    if (hadSearch) $('.blk-list', menu.el).innerHTML = listHTML;
    else {
      menu.el.innerHTML = (menu.mode === 'embed' ? '<input class="blk-search" placeholder="Search notes to embed…" aria-label="Search notes">' : '') + `<div class="blk-list">${listHTML}</div>`;
      if (menu.mode === 'embed') {
        const inp = $('.blk-search', menu.el);
        inp.addEventListener('input', () => { menu.q = inp.value; menu.sel = 0; updateMenu(); });
        inp.addEventListener('keydown', (e) => { if (onMenuKey(e)) e.preventDefault(); });
      }
    }
    positionMenu();
    const cur = $('.blk-item.sel', menu.el); if (cur) cur.scrollIntoView({ block: 'nearest' });
  }
  function positionMenu() {
    const sel = getSelection();
    let rect = menu.anchor;
    if (!rect && sel.rangeCount && ed.contains(sel.anchorNode)) {
      const r = sel.getRangeAt(0).cloneRange(); r.collapse(true);
      rect = r.getClientRects()[0] || (caretBlock() && caretBlock().getBoundingClientRect());
      if (menu.mode === 'embed') menu.anchor = rect;
    }
    if (!rect) rect = ed.getBoundingClientRect();
    const h = menu.el.offsetHeight, w = menu.el.offsetWidth;
    let top = rect.bottom + 6;
    if (top + h > innerHeight - 8) top = Math.max(8, rect.top - h - 6);
    menu.el.style.top = top + 'px';
    menu.el.style.left = Math.max(8, Math.min(rect.left, innerWidth - w - 8)) + 'px';
  }
  function onMenuKey(e) {
    if (!menu) return false;
    const n = menu.items.length;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { menu.sel = (menu.sel + (e.key === 'ArrowDown' ? 1 : -1) + n) % n; updateMenu(); return true; }
    if (e.key === 'Enter' || e.key === 'Tab') { choose(menu.sel); return true; }
    if (e.key === 'Escape') { closeMenu(); return true; }
    return false;
  }
  function removeTrigger() {
    const sel = getSelection();
    if (!menu || menu.mode === 'embed' || !sel.rangeCount) return;
    const r = document.createRange();
    r.setStart(menu.node, menu.offset);
    r.setEnd(sel.anchorNode, sel.anchorOffset);
    r.deleteContents();
    const b = caretBlock();
    if (b && !b.textContent && !b.querySelector('br, img, figure')) { b.appendChild(document.createElement('br')); placeCaret(b); }
  }
  function choose(i) {
    const it = menu && menu.items[i];
    if (!it || it.none) return;
    const mode = menu.mode;
    if (mode !== 'embed') removeTrigger();
    closeMenu();
    if (mode === 'slash') { it.run(); C.onEdit(); return; }
    let id = it.note;
    if (it.create) id = C.addNote(`<h1>${esc(it.create)}</h1><div><br></div>`);
    if (mode === 'link') { insertLink(id); return; }
    ed.focus();
    if (embedRange) { const s = getSelection(); s.removeAllRanges(); s.addRange(embedRange); }
    insertBlock(`<div class="blk-doc" data-note="${id}" contenteditable="false"></div>`);
  }
  function insertLink(id) {                         // inline, right at the cursor (insertHTML would break the line)
    const n = C.byId(id), sel = getSelection();
    if (!sel.rangeCount) return;
    const r = sel.getRangeAt(0);
    r.deleteContents();
    const a = document.createElement('a');
    a.className = 'nlink'; a.dataset.note = id; a.contentEditable = 'false'; a.href = '#';
    a.textContent = n ? C.info(n).title : 'Note';
    const space = document.createTextNode('\u00a0');
    r.insertNode(space); r.insertNode(a);
    const after = document.createRange(); after.setStartAfter(space); after.collapse(true);
    sel.removeAllRanges(); sel.addRange(after);
    hydrate(); C.onEdit();
  }
  let embedRange = null;
  function openNotePicker() {
    const sel = getSelection();
    embedRange = sel.rangeCount && ed.contains(sel.anchorNode) ? sel.getRangeAt(0).cloneRange() : null;
    openMenu('embed', null, 0);
    const inp = $('.blk-search', menu.el); if (inp) inp.focus();
  }
  function subPage() {
    const id = C.addNote('<h1>Untitled</h1><div><br></div>');
    insertBlock(`<div class="blk-doc" data-note="${id}" contenteditable="false"></div>`);
    C.toast('Sub-page created. Click its card to open it.');
  }

  // ---------- tables ----------
  function tableHTML(cols, rows) {
    const head = Array.from({ length: cols }, (_, i) => `<th>Column ${i + 1}</th>`).join('');
    const body = Array.from({ length: rows - 1 }, () => `<tr>${'<td><br></td>'.repeat(cols)}</tr>`).join('');
    return `<table class="tbl"><tbody><tr>${head}</tr>${body}</tbody></table>`;
  }
  let curCell = null, bar = null;
  function cellAtCaret() {
    const sel = getSelection();
    if (!sel.rangeCount || !ed.contains(sel.anchorNode)) return null;
    const n = sel.anchorNode.nodeType === 3 ? sel.anchorNode.parentNode : sel.anchorNode;
    return n.closest && n.closest('td, th');
  }
  function showTableBar() {
    curCell = cellAtCaret();
    if (!curCell) { if (bar) bar.hidden = true; return; }
    if (!bar) {
      bar = document.createElement('div');
      bar.className = 'tbl-bar';
      bar.innerHTML = [['row', '+ Row'], ['col', '+ Column'], ['delrow', '− Row'], ['delcol', '− Column'], ['deltable', 'Delete table']]
        .map(([k, l]) => `<button data-op="${k}"${k === 'deltable' ? ' class="danger"' : ''}>${l}</button>`).join('');
      bar.addEventListener('mousedown', (e) => e.preventDefault());
      bar.addEventListener('click', (e) => { const b = e.target.closest('[data-op]'); if (b) tableOp(b.dataset.op); });
      document.body.appendChild(bar);
    }
    const r = curCell.closest('table').getBoundingClientRect();
    bar.hidden = false;
    bar.style.top = Math.min(innerHeight - 44, r.bottom + 6) + 'px';      // below the table, so it never hides text
    bar.style.left = Math.max(8, Math.min(r.left, innerWidth - bar.offsetWidth - 8)) + 'px';
  }
  function tableOp(op) {
    const cell = curCell; if (!cell || !ed.contains(cell)) return;
    const tr = cell.parentNode, table = cell.closest('table'), idx = [...tr.children].indexOf(cell);
    if (op === 'row') {
      const row = document.createElement('tr');
      row.innerHTML = '<td><br></td>'.repeat(tr.children.length);
      tr.after(row); placeCaret(row.children[idx]);
    } else if (op === 'col') {
      [...table.rows].forEach((r) => { const c = document.createElement(r.cells[0] && r.cells[0].tagName === 'TH' ? 'th' : 'td'); c.innerHTML = '<br>'; r.cells[idx].after(c); });
      placeCaret(tr.cells[idx + 1]);
    } else if (op === 'delrow') {
      if (table.rows.length > 1) { const next = tr.nextElementSibling || tr.previousElementSibling; tr.remove(); placeCaret(next.cells[Math.min(idx, next.cells.length - 1)]); }
    } else if (op === 'delcol') {
      if (tr.cells.length > 1) { [...table.rows].forEach((r) => r.cells[idx] && r.cells[idx].remove()); placeCaret(tr.cells[Math.max(0, idx - 1)]); }
    } else if (op === 'deltable') {
      const next = table.nextElementSibling; table.remove(); if (bar) bar.hidden = true; if (next) placeCaret(next);
    }
    C.onEdit(); showTableBar();
  }

  // ---------- live blocks: note links, embedded notes, boards, table of contents ----------
  function renderLink(a) {
    const n = C.byId(a.dataset.note);
    const ok = n && !n.deleted;
    a.textContent = ok ? C.info(n).title : (a.dataset.title || 'Missing note');
    a.classList.toggle('broken', !ok);
  }
  function renderDoc(el) {
    const n = C.byId(el.dataset.note);
    if (!n || n.deleted) { el.innerHTML = '<div class="doc-ic">📄</div><div><b>Missing note</b><span>This note was deleted.</span></div>'; el.classList.add('broken'); return; }
    const i = C.info(n);
    el.classList.remove('broken');
    el.innerHTML = `<div class="doc-ic">📄</div><div><b>${esc(i.title)}</b><span>${esc(i.preview || 'Empty note')}</span></div><span class="doc-open">Open ›</span>`;
  }
  function renderToc(el) {
    const hs = [...ed.querySelectorAll('h1, h2, h3')].filter((h) => h.textContent.trim());
    el.innerHTML = '<div class="toc-t">Contents</div>' + (hs.map((h, i) => `<a class="toc-l ${h.tagName.toLowerCase()}" data-h="${i}">${esc(h.textContent.trim())}</a>`).join('') || '<span class="toc-empty">Add headings and they appear here.</span>');
  }
  function renderBoardEl(el) {
    if (el.contains(document.activeElement)) return;       // don't redraw under the cursor
    const tasks = Planner.noteBoard.tasks(C.currentId());
    const by = { todo: [], doing: [], done: [] };
    tasks.forEach((t) => by[t.done ? 'done' : t.status === 'doing' ? 'doing' : 'todo'].push(t));
    const cols = [['todo', 'To do'], ['doing', 'In progress'], ['done', 'Done']];
    el.innerHTML = `<div class="nb-head"><b>▥ Board</b><span>${by.todo.length + by.doing.length} open · these tasks also appear in Tasks</span></div>
      <div class="nb-cols">${cols.map(([k, label]) => `<div class="nb-col" data-st="${k}"><div class="nb-h">${label} <span>${by[k].length}</span></div>
        ${by[k].map((t) => `<div class="nb-card${t.done ? ' done' : ''}" draggable="true" data-id="${t.id}"><button class="chk sm p${t.priority || 0}" data-nb="toggle" aria-label="Complete">${t.done ? '✓' : ''}</button><span class="nb-t">${esc(t.title || 'Untitled')}</span>${t.due ? `<small>${esc(shortDay(t.due))}</small>` : ''}</div>`).join('')}
        ${k !== 'done' ? `<input class="nb-add" data-st="${k}" placeholder="+ Add task" aria-label="Add task to ${label}">` : ''}</div>`).join('')}</div>`;
    if (el.dataset.wired) return;
    el.dataset.wired = '1';
    let dragId = null;
    const stop = (e) => e.stopPropagation();
    ['keyup', 'input', 'paste', 'beforeinput', 'mousedown', 'dragenter'].forEach((ev) => el.addEventListener(ev, stop));
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const card = e.target.closest('.nb-card'); if (!card) return;
      if (e.target.closest('[data-nb="toggle"]')) Planner.noteBoard.toggle(card.dataset.id); else Planner.noteBoard.open(card.dataset.id);
    });
    el.addEventListener('keydown', (e) => {
      e.stopPropagation();
      const inp = e.target.closest('.nb-add');
      if (inp && e.key === 'Enter' && inp.value.trim()) { e.preventDefault(); const v = inp.value.trim(); inp.value = ''; inp.blur(); Planner.noteBoard.add(C.currentId(), v, inp.dataset.st); renderBoardEl(el); }
    });
    el.addEventListener('dragstart', (e) => { e.stopPropagation(); const c = e.target.closest('.nb-card'); if (!c) return; dragId = c.dataset.id; e.dataTransfer.setData('text/plain', ''); e.dataTransfer.effectAllowed = 'move'; });
    el.addEventListener('dragover', (e) => { e.stopPropagation(); if (dragId && e.target.closest('.nb-col')) e.preventDefault(); });
    el.addEventListener('drop', (e) => {
      e.stopPropagation(); e.preventDefault();
      const col = e.target.closest('.nb-col'); if (!col || !dragId) return;
      Planner.noteBoard.setStatus(dragId, col.dataset.st); dragId = null;
    });
  }
  function hydrate(root = ed) {
    if (!root) return;
    root.querySelectorAll('figure.att').forEach((f) => { if (f.dataset.state !== 'ready' && f.dataset.state !== 'loading') renderAtt(f); });
    root.querySelectorAll('a[title$="-click to open"]').forEach((a) => a.removeAttribute('title'));   // older links: a plain click opens them now
    root.querySelectorAll('a.nlink').forEach(renderLink);
    root.querySelectorAll('.blk-doc').forEach(renderDoc);
    root.querySelectorAll('.blk-toc').forEach(renderToc);
    root.querySelectorAll('.blk-board').forEach(renderBoardEl);
    root.querySelectorAll('.blk-mindmap').forEach((el) => MindMap.renderBlock(el));
  }
  /** The note's HTML without anything drawn at runtime (file previews, boards, cards). */
  function serialize(root) {
    const c = root.cloneNode(true);
    c.querySelectorAll('figure.att').forEach((f) => { f.innerHTML = ''; delete f.dataset.state; });
    c.querySelectorAll('.blk-board, .blk-doc, .blk-toc').forEach((el) => { el.innerHTML = ''; delete el.dataset.wired; el.classList.remove('broken'); });
    c.querySelectorAll('.blk-mindmap').forEach((el) => MindMap.serializeBlock(el));   // keeps the map data and its text, for search
    return c.innerHTML;
  }

  // ---------- backlinks ("linked mentions") ----------
  function renderBacklinks(n) {
    const box = $('#backlinks');
    if (!box) return;
    if (!n) { box.hidden = true; return; }
    const refs = C.state().notes.filter((x) => x.id !== n.id && !x.deleted && !x.trashed && x.html.includes(`data-note="${n.id}"`));
    box.hidden = !refs.length;
    box.innerHTML = refs.length ? `<div class="bl-t">Linked mentions <span>${refs.length}</span></div>` +
      refs.map((x) => { const i = C.info(x); return `<button class="bl-item" data-note="${x.id}"><b>${esc(i.title)}</b><span>${esc(i.preview || '')}</span></button>`; }).join('') : '';
  }

  // ---------- templates and daily notes ----------
  const TEMPLATES = {
    meeting: () => `<h2>Meeting notes · ${new Date().toLocaleDateString([], { month: 'short', day: 'numeric' })}</h2><div><b>Attendees:</b> </div><h3>Agenda</h3><ul><li><br></li></ul><h3>Notes</h3><div><br></div><h3>Action items</h3><ul class="checklist"><li><br></li></ul>`,
    project: () => '<h2>Project plan</h2><div class="callout" data-icon="🎯"><b>Goal:</b> </div><h3>Milestones</h3><table class="tbl"><tbody><tr><th>Milestone</th><th>Owner</th><th>Due</th></tr><tr><td><br></td><td><br></td><td><br></td></tr><tr><td><br></td><td><br></td><td><br></td></tr></tbody></table><h3>Tasks</h3><div class="blk-board" contenteditable="false"></div><h3>Risks</h3><ul><li><br></li></ul>',
    journal: () => '<h3>Top 3 priorities</h3><ul class="checklist"><li><br></li><li><br></li><li><br></li></ul><h3>Notes</h3><div><br></div><h3>Grateful for</h3><ul><li><br></li></ul>',
    weekly: () => '<h2>Weekly review</h2><h3>Wins</h3><ul><li><br></li></ul><h3>What didn’t go well</h3><ul><li><br></li></ul><h3>Lessons</h3><div><br></div><h3>Next week’s focus</h3><ul class="checklist"><li><br></li></ul>',
  };
  function insertTemplate(k) { insertBlock(TEMPLATES[k]()); }
  const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  function dailyNote() {
    const d = new Date(), key = ymd(d);
    const found = C.state().notes.find((x) => !x.deleted && !x.trashed && x.daily === key);
    if (found) { C.gotoNote(found.id); return; }
    const title = d.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    const id = C.addNote(`<h1>${esc(title)}</h1>${TEMPLATES.journal()}`, { daily: key });
    C.gotoNote(id);
  }

  // ---------- Markdown import (Obsidian, Joplin, Bear, plain .md / .txt) ----------
  const calloutIcon = (k) => ({ note: '📝', info: 'ℹ️', tip: '💡', hint: '💡', important: '❗', warning: '⚠️', caution: '⚠️', danger: '⛔', success: '✅', check: '✅', question: '❓', quote: '❝', todo: '☑' }[k.toLowerCase()] || '💡');
  function mdInline(s) {
    let h = esc(s);
    const codes = [];
    h = h.replace(/`([^`]+)`/g, (_, c) => { codes.push(c); return `\u0000${codes.length - 1}\u0000`; });
    h = h.replace(/!\[([^\]]*)\]\((https?:[^)\s]+)\)/g, '<img class="ext" src="$2" alt="$1">');
    h = h.replace(/!?\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|([^\]]+))?\]\]/g, (_, t, a) => `<a class="nlink" data-title="${t.trim()}" contenteditable="false" href="#">${a || t.trim()}</a>`);
    h = h.replace(/\[([^\]]+)\]\(((?:https?|mailto):[^)\s]+)\)/g, '<a href="$2">$1</a>');
    h = h.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/__([^_]+)__/g, '<b>$1</b>');
    h = h.replace(/(^|[^*\w])\*([^*\s][^*]*?)\*(?!\*)/g, '$1<i>$2</i>').replace(/(^|[^\w])_([^_\s][^_]*?)_(?![\w])/g, '$1<i>$2</i>');
    h = h.replace(/~~([^~]+)~~/g, '<s>$1</s>').replace(/==([^=]+)==/g, '<mark>$1</mark>');
    return h.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${codes[+i]}</code>`);
  }
  function mdToHtml(md, fallbackTitle) {
    md = md.replace(/\r\n?/g, '\n').replace(/^---\n[\s\S]*?\n---\n/, '');
    const lines = md.split('\n'), out = [];
    let i = 0, list = null;
    const flush = () => { if (list) { out.push(`<${list.tag}${list.cls ? ` class="${list.cls}"` : ''}>${list.items.join('')}</${list.tag}>`); list = null; } };
    const listOf = (tag, cls) => { if (!list || list.tag !== tag || list.cls !== cls) { flush(); list = { tag, cls, items: [] }; } return list; };
    const cells = (l) => l.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => mdInline(c.trim()) || '<br>');
    while (i < lines.length) {
      const l = lines[i];
      let m;
      if (/^\s*```/.test(l)) { flush(); const buf = []; i++; while (i < lines.length && !/^\s*```/.test(lines[i])) buf.push(lines[i++]); i++; out.push(`<pre>${esc(buf.join('\n'))}</pre>`); continue; }
      if ((m = l.match(/^(#{1,6})\s+(.*)$/))) { flush(); const lv = Math.min(3, m[1].length); out.push(`<h${lv}>${mdInline(m[2])}</h${lv}>`); i++; continue; }
      if ((m = l.match(/^\s*[-*+]\s+\[([ xX])\]\s*(.*)$/))) { listOf('ul', 'checklist').items.push(`<li${m[1] !== ' ' ? ' class="done"' : ''}>${mdInline(m[2]) || '<br>'}</li>`); i++; continue; }
      if ((m = l.match(/^\s*[-*+]\s+(.*)$/))) { listOf('ul', '').items.push(`<li>${mdInline(m[1])}</li>`); i++; continue; }
      if ((m = l.match(/^\s*\d+[.)]\s+(.*)$/))) { listOf('ol', '').items.push(`<li>${mdInline(m[1])}</li>`); i++; continue; }
      flush();
      if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(l)) { out.push('<hr>'); i++; continue; }
      if (/^>/.test(l)) {
        const buf = [];
        while (i < lines.length && /^>/.test(lines[i])) buf.push(lines[i++].replace(/^>\s?/, ''));
        const cm = (buf[0] || '').match(/^\[!(\w+)\][+-]?\s*(.*)$/);
        if (cm) out.push(`<div class="callout" data-icon="${calloutIcon(cm[1])}">${[cm[2] ? `<b>${mdInline(cm[2])}</b>` : ''].concat(buf.slice(1).map(mdInline)).filter(Boolean).join('<br>') || '<br>'}</div>`);
        else out.push(`<blockquote>${buf.map(mdInline).join('<br>')}</blockquote>`);
        continue;
      }
      if (/^\s*\|.*\|\s*$/.test(l) && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1] || '')) {
        const head = cells(l); i += 2;
        const rows = [];
        while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) rows.push(cells(lines[i++]));
        out.push(`<table class="tbl"><tbody><tr>${head.map((c) => `<th>${c}</th>`).join('')}</tr>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`);
        continue;
      }
      out.push(l.trim() ? `<div>${mdInline(l)}</div>` : '<div><br></div>');
      i++;
    }
    flush();
    let html = out.join('').replace(/(<div><br><\/div>){2,}/g, '<div><br></div>').replace(/^(<div><br><\/div>)+/, '');
    if (!/^<h1>/.test(html)) html = `<h1>${esc(fallbackTitle)}</h1>` + html;
    return html;
  }
  async function importFiles(files) {
    const created = [];
    for (const f of [...files]) {
      if (!/\.(md|markdown|txt)$/i.test(f.name)) continue;
      const text = await f.text();
      const title = f.name.replace(/\.(md|markdown|txt)$/i, '');
      created.push(C.addNote(/\.txt$/i.test(f.name) ? `<h1>${esc(title)}</h1>` + text.split(/\r?\n/).map((l) => (l.trim() ? `<div>${esc(l)}</div>` : '<div><br></div>')).join('') : mdToHtml(text, title)));
    }
    // turn [[Title]] links into real links, now that every imported note exists
    const byTitle = new Map(C.notesList().map((n) => [n.title.toLowerCase(), n.id]));
    const tmp = document.createElement('div');
    for (const id of created) {
      const n = C.byId(id);
      tmp.innerHTML = n.html;
      let changed = false;
      tmp.querySelectorAll('a.nlink[data-title]:not([data-note])').forEach((a) => {
        const target = byTitle.get(a.dataset.title.toLowerCase());
        if (target) { a.dataset.note = target; changed = true; }
      });
      if (changed) { n.html = tmp.innerHTML; n.updated = Date.now(); }
    }
    C.persist(); C.renderAll();
    C.toast(created.length ? `Imported ${created.length} note${created.length > 1 ? 's' : ''}` : 'No .md or .txt files were selected');
    if (created.length) C.gotoNote(created[0]);
  }

  // ---------- editor events (called from app.js) ----------
  function onInput(e) {
    if (menu) updateMenu();
    if (e.inputType !== 'insertText' || !e.data) return false;
    const sel = getSelection();
    if (!sel.rangeCount) return false;
    const node = sel.anchorNode, off = sel.anchorOffset;
    if (!node || node.nodeType !== 3) return false;
    const before = node.data.slice(0, off);
    if (menu) return false;
    // look at the text before the cursor, so fast typing, autocorrect and text expanders work too
    let m;
    if (e.data.includes('/') && (m = before.match(/(^|\s)\/([^\s/]{0,24})$/))) { openMenu('slash', node, off - m[2].length - 1); return true; }
    if (e.data.includes('[') && (m = before.match(/\[\[([^\]\n]{0,60})$/))) { openMenu('link', node, off - m[1].length - 2); return true; }
    return false;
  }
  function onKeydown(e) {
    if (menu && onMenuKey(e)) { e.preventDefault(); return true; }
    if (e.key === 'Tab') {
      const cell = cellAtCaret();
      if (cell) {
        e.preventDefault();
        const all = [...cell.closest('table').querySelectorAll('th, td')];
        const i = all.indexOf(cell) + (e.shiftKey ? -1 : 1);
        if (i >= all.length) { curCell = cell; tableOp('row'); } else if (i >= 0) placeCaret(all[i], true);
        return true;
      }
    }
    return false;
  }
  function onClick(e) {
    const t = e.target;
    const dl = t.closest && t.closest('figure.att a[download]');
    if (dl) { e.preventDefault(); saveAtt(() => attBlob(dl.closest('figure.att'))); return true; }   // the Save button on a file
    const link = t.closest && t.closest('a.nlink');
    if (link) { e.preventDefault(); if (link.dataset.note && C.byId(link.dataset.note)) C.gotoNote(link.dataset.note); return true; }
    const doc = t.closest && t.closest('.blk-doc');
    if (doc) { if (doc.dataset.note && !doc.classList.contains('broken')) C.gotoNote(doc.dataset.note); return true; }
    const toc = t.closest && t.closest('.toc-l');
    if (toc) { const h = [...ed.querySelectorAll('h1, h2, h3')].filter((x) => x.textContent.trim())[+toc.dataset.h]; if (h) h.scrollIntoView({ behavior: 'smooth', block: 'start' }); return true; }
    const pdf = t.closest && t.closest('[data-blk="pdftoggle"]');
    if (pdf) {
      const fig = pdf.closest('figure');
      if (fig.dataset.collapsed) delete fig.dataset.collapsed; else fig.dataset.collapsed = '1';
      fig.dataset.state = ''; renderAtt(fig); C.onEdit();
      return true;
    }
    if (t.classList && t.classList.contains('callout') && e.offsetX < 34) {
      const icons = ['💡', '⚠️', '✅', '❗', '📌', 'ℹ️', '🎯', '🔥'];
      t.dataset.icon = icons[(icons.indexOf(t.dataset.icon) + 1) % icons.length];
      C.onEdit(); return true;
    }
    if (t.classList && t.classList.contains('tg-h') && e.offsetX < 24) { t.parentNode.classList.toggle('open'); C.onEdit(); return true; }
    return false;
  }
  function onSelectionChange() {
    if (menu && menu.mode !== 'embed' && menuQuery() == null) closeMenu();
    showTableBar();
  }

  // ---------- public ----------
  let tocTimer = null;
  window.Blocks = {
    init(core) {
      C = core; ed = core.editor;
      MindMap.init(core);
      document.addEventListener('selectionchange', onSelectionChange);
      ed.addEventListener('contextmenu', onContextMenu);
      reader.init();
      document.addEventListener('mousedown', (e) => { if (menu && !menu.el.contains(e.target)) closeMenu(); });
      document.addEventListener('scroll', () => { if (bar && !bar.hidden) showTableBar(); if (menu) positionMenu(); }, true);
      $('#backlinks').addEventListener('click', (e) => { const b = e.target.closest('[data-note]'); if (b) C.gotoNote(b.dataset.note); });
    },
    imageText: (html) => reader.textIn(html),
    store, addFiles, pick, hydrate, serialize, renderBacklinks, onInput, onKeydown, onClick, dailyNote, importFiles, mdToHtml,
    _insertBlock: (html) => insertBlock(html),
    openMenu: () => { ensureCaret(); document.execCommand('insertText', false, ' /'); openMenuAtCaret('slash', 1); },
    closeMenu,
    afterEdit() { clearTimeout(tocTimer); tocTimer = setTimeout(() => ed.querySelectorAll('.blk-toc').forEach(renderToc), 300); },
    refreshLive() {
      if (!ed || !C.currentId()) return;
      ed.querySelectorAll('.blk-board').forEach(renderBoardEl);
      ed.querySelectorAll('a.nlink').forEach(renderLink);
      ed.querySelectorAll('.blk-doc').forEach(renderDoc);
      ed.querySelectorAll('figure.att[data-state="missing"]').forEach((f) => { f.dataset.state = ''; renderAtt(f); });
    },
  };
})();
