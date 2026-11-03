/* Media and sharing: the Media menu (photo or video, audio recording, any file, camera photo, document scan,
   sketch) and the Share sheet (the system share sheet, email, messaging and social apps, copy, send as a file).
   Works on the note editor through the `core` object passed to Media.init(). */
(() => {
  'use strict';
  let C = null, savedRange = null;
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const pad = (n) => String(n).padStart(2, '0');
  const stamp = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} at ${pad(d.getHours())}.${pad(d.getMinutes())}.${pad(d.getSeconds())}`; };
  const touchFirst = () => matchMedia('(pointer: coarse)').matches;          // phones and tablets: use their own camera screen
  const isMacApp = () => !!(C.native && C.native.pickFiles);
  const isWinApp = () => /Electron\//.test(navigator.userAgent);
  const svg = (p) => `<svg viewBox="0 0 24 24" aria-hidden="true">${p}</svg>`;
  const ICONS = {
    media: svg('<path d="M20.5 11.5l-8.1 8.1a5 5 0 0 1-7.1-7.1l8.5-8.5a3.4 3.4 0 0 1 4.8 4.8l-8.5 8.5a1.7 1.7 0 0 1-2.4-2.4l7.8-7.8"/>'),
    photo: svg('<rect x="3" y="5" width="15" height="13" rx="2.5"/><path d="M7 3h11.5A2.5 2.5 0 0 1 21 5.5V15"/><circle cx="8" cy="10" r="1.5"/><path d="M18 15l-4-4-7 7"/>'),
    audio: svg('<path d="M4 10v4M8 7v10M12 4v16M16 8v8M20 11v2"/>'),
    file: svg('<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>'),
    camera: svg('<path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="3.5"/>'),
    scan: svg('<path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3"/><path d="M8 9h8M8 12h8M8 15h5"/>'),
    sketch: svg('<path d="M4 20c2-1 3.5-3 5-3s1.5 2 3 2 2.5-2 4-2"/><path d="M14.5 4.5l5 5L11 18H6v-5z"/>'),
    share: svg('<path d="M12 3v12M8 7l4-4 4 4"/><path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1"/>'),
  };

  // ---------- the caret: remembered when a menu or dialog takes focus, so things land where you were typing ----------
  function keepCaret() {
    const s = getSelection();
    if (s.rangeCount && C.editor.contains(s.anchorNode)) savedRange = s.getRangeAt(0).cloneRange();
  }
  function restoreCaret() {
    if (!savedRange) return;
    C.editor.focus({ preventScroll: true });
    const s = getSelection(); s.removeAllRanges(); s.addRange(savedRange);
  }
  async function insert(files) {
    if (!C.currentId()) return C.toast('Open a note first.');
    await Blocks.addFiles(files, savedRange && C.editor.contains(savedRange.startContainer) ? savedRange : null);
    savedRange = null;
  }
  const blobOf = (canvas, type = 'image/jpeg', q = 0.9) => new Promise((ok, no) => canvas.toBlob((b) => (b ? ok(b) : no(new Error('Couldn’t make the image'))), type, q));

  // ---------- dialogs ----------
  function modal(cls, html, { onClose, sticky } = {}) {
    const box = document.createElement('div');
    box.className = 'pl-modal md-modal';
    box.innerHTML = `<div class="pl-sheet md-sheet ${cls}" role="dialog" aria-modal="true" tabindex="-1">${html}</div>`;
    document.body.appendChild(box);
    const onKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); } };
    function close() {
      if (!box.isConnected) return;
      box.remove();
      document.removeEventListener('keydown', onKey, true);
      if (onClose) onClose();
    }
    document.addEventListener('keydown', onKey, true);
    if (!sticky) box.addEventListener('mousedown', (e) => { if (e.target === box) close(); });   // drawings and recordings only close on purpose
    box.addEventListener('click', (e) => { if (e.target.closest('[data-x="close"]')) close(); });
    const el = $('.md-sheet', box);
    el.focus({ preventScroll: true });
    return { box, el, close };
  }
  const head = (title) => `<div class="md-head"><b>${esc(title)}</b><button class="icon-btn" data-x="close" aria-label="Close">✕</button></div>`;
  function permissionHelp(err, what) {
    const name = err && err.name;
    if (name === 'NotAllowedError' || name === 'SecurityError') {
      const where = isMacApp() ? `System Settings → Privacy & Security → ${what}, then turn on Notes`
        : isWinApp() ? `Windows Settings → Privacy & security → ${what}` : 'your browser’s site settings for this page';
      return `Notes isn’t allowed to use the ${what.toLowerCase()}. Allow it in ${where}, then try again.`;
    }
    if (name === 'NotFoundError' || name === 'OverconstrainedError') return `No ${what.toLowerCase()} was found on this device.`;
    if (name === 'NotReadableError') return `The ${what.toLowerCase()} is being used by another app. Close it there and try again.`;
    return `Couldn’t start the ${what.toLowerCase()}: ${(err && err.message) || err}`;
  }
  function getMedia(constraints) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return Promise.reject(new Error(location.protocol === 'http:' && location.hostname !== 'localhost' ? 'the page must be opened over https' : 'not supported here'));
    }
    return navigator.mediaDevices.getUserMedia(constraints);
  }
  // The phone's own camera screen (iPhone / Android), via a file input that opens the camera.
  function phoneCamera(onFiles) {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = 'image/*'; inp.setAttribute('capture', 'environment');
    inp.style.display = 'none';
    document.body.appendChild(inp);
    inp.onchange = () => { const f = [...inp.files]; inp.remove(); if (f.length) onFiles(f); };
    inp.click();
  }

  // ---------- a live camera in a dialog (Take Photo, Scan Documents) ----------
  function liveCamera(m, { mirror } = {}) {
    const video = $('video', m.el), msg = $('.md-msg', m.el);
    let stream = null, devices = [];
    if (mirror) video.classList.add('mirror');
    async function start(deviceId) {
      stop();
      msg.hidden = false; msg.textContent = 'Starting camera…';
      try {
        stream = await getMedia({ audio: false, video: deviceId ? { deviceId: { exact: deviceId }, width: { ideal: 1920 }, height: { ideal: 1080 } }
          : { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } } });
        if (!m.box.isConnected) return stop();
        video.srcObject = stream;
        await video.play().catch(() => {});
        msg.hidden = true;
        m.el.querySelectorAll('[data-need="cam"]').forEach((b) => { b.disabled = false; });
        devices = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput');
        const flip = $('[data-x="flip"]', m.el); if (flip) flip.hidden = devices.length < 2;
      } catch (err) { msg.hidden = false; msg.textContent = permissionHelp(err, 'Camera'); }
    }
    function stop() { if (stream) stream.getTracks().forEach((t) => t.stop()); stream = null; }
    function flip() {
      if (devices.length < 2 || !stream) return;
      const cur = stream.getVideoTracks()[0].getSettings().deviceId;
      const i = devices.findIndex((d) => d.deviceId === cur);
      start(devices[(i + 1) % devices.length].deviceId);
    }
    function frame() {
      const c = document.createElement('canvas');
      c.width = video.videoWidth; c.height = video.videoHeight;
      if (!c.width) return null;
      c.getContext('2d').drawImage(video, 0, 0);
      return c;
    }
    start();
    return { stop, flip, frame };
  }

  // ---------- Take Photo ----------
  function takePhoto() {
    keepCaret();
    if (touchFirst()) return phoneCamera(insert);
    const m = modal('md-cam', head('Take Photo') + `
      <div class="md-stage"><video autoplay playsinline muted></video><img class="md-shot" alt="" hidden><div class="md-msg"></div></div>
      <div class="md-foot">
        <button class="pl-btn" data-x="flip" hidden>Switch camera</button>
        <span class="grow"></span>
        <button class="md-shutter" data-x="shoot" data-need="cam" aria-label="Take photo" title="Take photo (Space)" disabled></button>
        <button class="pl-btn" data-x="retake" hidden>Retake</button>
        <button class="pl-btn primary" data-x="use" hidden>Use Photo</button>
        <span class="grow"></span>
        <button class="pl-btn" data-x="close">Cancel</button>
      </div>`, { onClose: () => cam.stop() });
    const cam = liveCamera(m, { mirror: true });
    let shot = null;
    const show = (taken) => {
      $('video', m.el).hidden = taken; $('.md-shot', m.el).hidden = !taken;
      $('[data-x="shoot"]', m.el).hidden = taken; $('[data-x="retake"]', m.el).hidden = !taken; $('[data-x="use"]', m.el).hidden = !taken;
    };
    m.el.addEventListener('click', async (e) => {
      const x = e.target.closest('[data-x]'); if (!x) return;
      if (x.dataset.x === 'flip') cam.flip();
      if (x.dataset.x === 'shoot') {
        const c = cam.frame(); if (!c) return;
        shot = await blobOf(c);
        const img = $('.md-shot', m.el);
        if (img.src) URL.revokeObjectURL(img.src);
        img.src = URL.createObjectURL(shot);
        show(true);
      }
      if (x.dataset.x === 'retake') show(false);
      if (x.dataset.x === 'use' && shot) { m.close(); insert([new File([shot], `Photo ${stamp()}.jpg`, { type: 'image/jpeg' })]); }
    });
    m.el.addEventListener('keydown', (e) => { if (e.key === ' ' && !$('[data-x="shoot"]', m.el).hidden) { e.preventDefault(); $('[data-x="shoot"]', m.el).click(); } });
  }

  // ---------- Record Audio ----------
  const AUDIO_TYPES = [['audio/mp4;codecs=mp4a.40.2', 'm4a'], ['audio/mp4', 'm4a'], ['audio/webm;codecs=opus', 'webm'], ['audio/webm', 'webm'], ['audio/ogg;codecs=opus', 'ogg']];
  const clock = (ms) => { const s = Math.floor(ms / 1000); return `${Math.floor(s / 60)}:${pad(s % 60)}`; };
  async function recordAudio() {
    keepCaret();
    if (typeof MediaRecorder === 'undefined') return C.toast('Recording audio isn’t supported here.');
    const m = modal('md-rec', head('Record Audio') + `
      <div class="md-recbox"><div class="md-time">0:00</div><canvas class="md-wave" height="64"></canvas><div class="md-msg">Starting microphone…</div></div>
      <div class="md-foot">
        <button class="pl-btn" data-x="close">Cancel</button>
        <span class="grow"></span>
        <button class="md-recbtn" data-x="rec" aria-label="Start recording" title="Record (Space)" disabled></button>
        <span class="grow"></span>
        <button class="pl-btn primary" data-x="save" disabled>Add to note</button>
      </div>`, { sticky: true, onClose: cleanup });
    let stream = null, rec = null, actx = null, raf = 0, chunks = [], elapsed = 0, since = 0, saving = false;
    const [mime, ext] = AUDIO_TYPES.find(([t]) => MediaRecorder.isTypeSupported(t)) || ['', 'webm'];
    const time = $('.md-time', m.el), msg = $('.md-msg', m.el), btn = $('[data-x="rec"]', m.el), wave = $('.md-wave', m.el);
    function cleanup() {
      cancelAnimationFrame(raf);
      if (rec && rec.state !== 'inactive') { rec.onstop = null; rec.stop(); }
      if (stream) stream.getTracks().forEach((t) => t.stop());
      if (actx) actx.close().catch(() => {});
    }
    try { stream = await getMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); }
    catch (err) { msg.textContent = permissionHelp(err, 'Microphone'); return; }
    if (!m.box.isConnected) return cleanup();
    msg.textContent = 'Press the red button to start.';
    btn.disabled = false;
    // a scrolling level meter, so you can see the microphone is hearing you
    const levels = [];
    try {
      actx = new (window.AudioContext || window.webkitAudioContext)();
      const an = actx.createAnalyser(); an.fftSize = 512;
      actx.createMediaStreamSource(stream).connect(an);
      const buf = new Uint8Array(an.fftSize), g = wave.getContext('2d');
      const draw = () => {
        raf = requestAnimationFrame(draw);
        const w = wave.width = wave.clientWidth * devicePixelRatio, h = wave.height = 64 * devicePixelRatio;
        an.getByteTimeDomainData(buf);
        let peak = 0; for (const v of buf) peak = Math.max(peak, Math.abs(v - 128) / 128);
        const live = rec && rec.state === 'recording';
        levels.push(live ? peak : peak * 0.35);
        const bar = 4 * devicePixelRatio, n = Math.floor(w / bar);
        while (levels.length > n) levels.shift();
        g.clearRect(0, 0, w, h);
        g.fillStyle = live ? '#ff3b30' : getComputedStyle(document.body).getPropertyValue('--muted');
        levels.forEach((l, i) => { const bh = Math.max(2 * devicePixelRatio, Math.min(1, l * 2.2) * h); g.fillRect(i * bar, (h - bh) / 2, bar * 0.6, bh); });
        if (live) time.textContent = clock(elapsed + Date.now() - since);
      };
      draw();
    } catch (e) { /* the meter is optional */ }
    btn.onclick = () => {
      if (!rec) {
        chunks = [];
        rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
        rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
        rec.start(1000);
        since = Date.now();
      } else if (rec.state === 'recording') { rec.pause(); elapsed += Date.now() - since; }
      else if (rec.state === 'paused') { rec.resume(); since = Date.now(); }
      const on = rec.state === 'recording';
      btn.classList.toggle('on', on);
      btn.setAttribute('aria-label', on ? 'Pause recording' : 'Resume recording');
      msg.textContent = on ? 'Recording… press again to pause.' : 'Paused. Press the red button to continue.';
      $('[data-x="save"]', m.el).disabled = false;
    };
    m.el.addEventListener('keydown', (e) => { if (e.key === ' ' && !btn.disabled && e.target.tagName !== 'BUTTON') { e.preventDefault(); btn.click(); } });
    $('[data-x="save"]', m.el).onclick = () => {
      if (!rec || saving) return;
      saving = true;
      rec.onstop = () => {
        const type = (rec.mimeType || mime || 'audio/webm').split(';')[0];
        const blob = new Blob(chunks, { type });
        m.close();
        if (!blob.size) return C.toast('Nothing was recorded.');
        insert([new File([blob], `Recording ${stamp()}.${/mp4/.test(type) ? 'm4a' : ext}`, { type })]);
      };
      rec.stop();
    };
  }

  // ---------- Scan Documents: photos of pages, cleaned up into a PDF ----------
  function enhance(src, mode, maxSide = 2200) {
    const scale = Math.min(1, maxSide / Math.max(src.width, src.height));
    const w = Math.round(src.width * scale), h = Math.round(src.height * scale);
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(src, 0, 0, w, h);
    if (mode === 'color') return c;
    const img = g.getImageData(0, 0, w, h), p = img.data, hist = new Uint32Array(256), lum = new Uint8ClampedArray(w * h);
    for (let i = 0, j = 0; i < p.length; i += 4, j++) { const l = (p[i] * 77 + p[i + 1] * 150 + p[i + 2] * 29) >> 8; lum[j] = l; hist[l]++; }
    const pct = (f) => { let n = 0; const t = w * h * f; for (let v = 0; v < 256; v++) { n += hist[v]; if (n >= t) return v; } return 255; };
    // "Document": the paper turns white and the ink dark; "Grayscale": a gentle contrast stretch
    const lo = pct(mode === 'doc' ? 0.04 : 0.01), hi = Math.max(lo + 1, pct(mode === 'doc' ? 0.6 : 0.99));
    for (let i = 0, j = 0; i < p.length; i += 4, j++) {
      let v = (lum[j] - lo) * 255 / (hi - lo);
      if (mode === 'doc') v = 255 * Math.pow(Math.min(1, Math.max(0, v / 255)), 1.8);
      p[i] = p[i + 1] = p[i + 2] = v;
    }
    g.putImageData(img, 0, 0);
    return c;
  }
  /** A PDF with one page per JPEG, each page sized to its photo (A4 width). */
  function pdfFromJpegs(pages) {
    const te = new TextEncoder(), parts = [], offsets = [];
    let len = 0;
    const push = (x) => { const b = typeof x === 'string' ? te.encode(x) : x; parts.push(b); len += b.length; };
    const obj = (n, body) => { offsets[n] = len; push(`${n} 0 obj\n`); body(); push('\nendobj\n'); };
    push('%PDF-1.4\n'); push(new Uint8Array([37, 226, 227, 207, 211, 10]));
    obj(1, () => push('<< /Type /Catalog /Pages 2 0 R >>'));
    obj(2, () => push(`<< /Type /Pages /Kids [${pages.map((_, i) => `${3 + 3 * i} 0 R`).join(' ')}] /Count ${pages.length} >>`));
    pages.forEach((pg, i) => {
      const W = 595.28, H = +(W * pg.h / pg.w).toFixed(2), draw = `q ${W} 0 0 ${H} 0 0 cm /Im0 Do Q`;
      obj(3 + 3 * i, () => push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /XObject << /Im0 ${5 + 3 * i} 0 R >> >> /Contents ${4 + 3 * i} 0 R >>`));
      obj(4 + 3 * i, () => push(`<< /Length ${draw.length} >>\nstream\n${draw}\nendstream`));
      obj(5 + 3 * i, () => {
        push(`<< /Type /XObject /Subtype /Image /Width ${pg.w} /Height ${pg.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${pg.bytes.length} >>\nstream\n`);
        push(pg.bytes); push('\nendstream');
      });
    });
    const size = 3 + 3 * pages.length, xref = len;
    let tail = `xref\n0 ${size}\n0000000000 65535 f \n`;
    for (let k = 1; k < size; k++) tail += String(offsets[k]).padStart(10, '0') + ' 00000 n \n';
    push(tail + `trailer\n<< /Size ${size} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
    return new Blob(parts, { type: 'application/pdf' });
  }
  const imageToCanvas = (file) => new Promise((ok, no) => {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => { const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight; c.getContext('2d').drawImage(img, 0, 0); URL.revokeObjectURL(url); ok(c); };
    img.onerror = () => { URL.revokeObjectURL(url); no(new Error(`Can’t read “${file.name}” as an image`)); };
    img.src = url;
  });
  function scanDocuments() {
    keepCaret();
    const phone = touchFirst();
    const m = modal('md-scan', head('Scan Documents') + `
      <div class="md-stage">${phone ? '<div class="md-empty">Take a photo of each page. They become one PDF in your note.</div>'
        : '<video autoplay playsinline muted></video><div class="md-guide"></div><div class="md-msg"></div>'}</div>
      <div class="md-filters" role="radiogroup" aria-label="Look">
        <button data-f="doc" class="on" role="radio" aria-checked="true">Document</button><button data-f="gray" role="radio" aria-checked="false">Grayscale</button><button data-f="color" role="radio" aria-checked="false">Color</button>
      </div>
      <div class="md-pages" aria-label="Scanned pages"></div>
      <div class="md-foot">
        <button class="pl-btn" data-x="file" title="Use photos you already have">From photos…</button>
        <button class="pl-btn" data-x="flip" hidden>Switch camera</button>
        <span class="grow"></span>
        <button class="md-shutter" data-x="shoot" ${phone ? '' : 'data-need="cam" disabled'} aria-label="Scan page" title="Scan page (Space)"></button>
        <span class="grow"></span>
        <button class="pl-btn" data-x="close">Cancel</button>
        <button class="pl-btn primary" data-x="save" disabled>Save PDF</button>
      </div>`, { sticky: true, onClose: () => cam && cam.stop() });
    const cam = phone ? null : liveCamera(m);
    const pages = [];                              // original photos; the chosen look is applied for thumbnails and the PDF
    let mode = 'doc';
    function renderPages() {
      const strip = $('.md-pages', m.el);
      strip.innerHTML = pages.map((c, i) => `<figure><img src="${enhance(c, mode, 360).toDataURL('image/jpeg', 0.6)}" alt="Page ${i + 1}"><figcaption>${i + 1}</figcaption><button data-del="${i}" aria-label="Remove page ${i + 1}">✕</button></figure>`).join('');
      strip.scrollLeft = strip.scrollWidth;
      const save = $('[data-x="save"]', m.el);
      save.disabled = !pages.length;
      save.textContent = pages.length > 1 ? `Save PDF (${pages.length} pages)` : 'Save PDF';
    }
    async function addImages(files) {
      for (const f of files) { try { pages.push(await imageToCanvas(f)); } catch (err) { C.toast(err.message); } }
      renderPages();
    }
    m.el.addEventListener('click', async (e) => {
      const f = e.target.closest('[data-f]');
      if (f) {
        mode = f.dataset.f;
        m.el.querySelectorAll('[data-f]').forEach((b) => { b.classList.toggle('on', b === f); b.setAttribute('aria-checked', b === f); });
        return renderPages();
      }
      const del = e.target.closest('[data-del]');
      if (del) { pages.splice(+del.dataset.del, 1); return renderPages(); }
      const x = e.target.closest('[data-x]'); if (!x) return;
      if (x.dataset.x === 'flip') cam.flip();
      if (x.dataset.x === 'shoot') {
        if (phone) return phoneCamera(addImages);
        const c = cam.frame(); if (!c) return;
        pages.push(c);
        const stage = $('.md-stage', m.el); stage.classList.add('flash'); setTimeout(() => stage.classList.remove('flash'), 180);
        renderPages();
      }
      if (x.dataset.x === 'file') {
        const inp = document.createElement('input');
        inp.type = 'file'; inp.accept = 'image/*'; inp.multiple = true; inp.style.display = 'none';
        document.body.appendChild(inp);
        inp.onchange = () => { addImages([...inp.files]); inp.remove(); };
        inp.click();
      }
      if (x.dataset.x === 'save' && pages.length) {
        x.disabled = true; x.textContent = 'Saving…';
        try {
          const out = [];
          for (const c of pages) {
            const page = enhance(c, mode);
            out.push({ w: page.width, h: page.height, bytes: new Uint8Array(await (await blobOf(page, 'image/jpeg', 0.82)).arrayBuffer()) });
          }
          const pdf = pdfFromJpegs(out);
          m.close();
          insert([new File([pdf], `Scan ${stamp()}.pdf`, { type: 'application/pdf' })]);
        } catch (err) { x.disabled = false; x.textContent = 'Save PDF'; C.toast(`Couldn’t make the PDF: ${err.message || err}`); }
      }
    });
    m.el.addEventListener('keydown', (e) => { if (e.key === ' ' && e.target.tagName !== 'BUTTON') { e.preventDefault(); $('[data-x="shoot"]', m.el).click(); } });
  }

  // ---------- Add Sketch ----------
  const INKS = ['#1d1d1f', '#8e8e93', '#ff3b30', '#ff9500', '#ffcc00', '#34c759', '#007aff', '#af52de'];
  function addSketch() {
    keepCaret();
    const m = modal('md-sketch', head('Add Sketch') + `
      <div class="sk-tools">
        <div class="sk-seg" role="radiogroup" aria-label="Tool">
          <button data-tool="pen" class="on" title="Pen (P)" aria-label="Pen">${svg('<path d="M4 20l1-5L16 4l4 4L9 19z"/>')}</button>
          <button data-tool="marker" title="Highlighter (M)" aria-label="Highlighter">${svg('<path d="M8 15l-4 5h7l1-2M8 15l8-11 4 3-8 11z"/>')}</button>
          <button data-tool="eraser" title="Eraser (E)" aria-label="Eraser">${svg('<path d="M8 20h12M5 15l9-10 6 6-8 9H9z"/>')}</button>
        </div>
        <div class="sk-colors">${INKS.map((c, i) => `<button data-ink="${c}" class="${i ? '' : 'on'}" style="--ink:${c}" aria-label="Colour ${c}"></button>`).join('')}</div>
        <input class="sk-size" type="range" min="1" max="24" value="3" aria-label="Line width" title="Line width">
        <span class="grow"></span>
        <button class="icon-btn" data-x="undo" title="Undo (Ctrl/Cmd+Z)" aria-label="Undo">↶</button>
        <button class="icon-btn" data-x="redo" title="Redo (Shift+Ctrl/Cmd+Z)" aria-label="Redo">↷</button>
        <button class="pl-btn" data-x="clear">Clear</button>
      </div>
      <div class="sk-paper"><canvas></canvas></div>
      <div class="md-foot"><span class="md-hint">Draw with your mouse, trackpad, pen or finger.</span><span class="grow"></span><button class="pl-btn" data-x="close">Cancel</button><button class="pl-btn primary" data-x="save" disabled>Add to note</button></div>`,
    { sticky: true, onClose: () => ro.disconnect() });
    const cv = $('canvas', m.el), paper = $('.sk-paper', m.el), g = cv.getContext('2d');
    const strokes = [], undone = [];
    let tool = 'pen', ink = INKS[0], width = 3, cur = null, queued = false;
    function size() {
      const r = paper.getBoundingClientRect();
      cv.width = Math.round(r.width * devicePixelRatio); cv.height = Math.round(r.height * devicePixelRatio);
      cv.style.width = r.width + 'px'; cv.style.height = r.height + 'px';
      redraw();
    }
    function paint(ctx, s) {
      const p = s.pts;
      ctx.save();
      ctx.lineCap = ctx.lineJoin = 'round';
      ctx.globalCompositeOperation = s.tool === 'eraser' ? 'destination-out' : 'source-over';
      ctx.strokeStyle = s.tool === 'eraser' ? '#000' : s.color;
      ctx.globalAlpha = s.tool === 'marker' ? 0.35 : 1;
      ctx.lineWidth = s.tool === 'pen' ? s.width : s.width * 4;
      ctx.beginPath();
      ctx.moveTo(p[0][0], p[0][1]);
      if (p.length === 1) ctx.lineTo(p[0][0] + 0.01, p[0][1]);
      for (let i = 1; i < p.length - 1; i++) ctx.quadraticCurveTo(p[i][0], p[i][1], (p[i][0] + p[i + 1][0]) / 2, (p[i][1] + p[i + 1][1]) / 2);
      if (p.length > 1) ctx.lineTo(p[p.length - 1][0], p[p.length - 1][1]);
      ctx.stroke();
      ctx.restore();
    }
    function redraw() {
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, cv.width, cv.height);
      g.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
      strokes.forEach((s) => paint(g, s));
      if (cur) paint(g, cur);
      $('[data-x="save"]', m.el).disabled = !strokes.some((s) => s.tool !== 'eraser');
      $('[data-x="undo"]', m.el).disabled = !strokes.length;
      $('[data-x="redo"]', m.el).disabled = !undone.length;
    }
    const later = () => { if (!queued) { queued = true; requestAnimationFrame(() => { queued = false; redraw(); }); } };
    const at = (e) => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    cv.addEventListener('pointerdown', (e) => {
      if (e.button > 0 && e.button !== 5) return;
      cv.setPointerCapture(e.pointerId);
      cur = { tool: e.button === 5 ? 'eraser' : tool, color: ink, width, pts: [at(e)] };     // button 5: a pen's eraser end
      later();
    });
    cv.addEventListener('pointermove', (e) => {
      if (!cur) return;
      const all = e.getCoalescedEvents ? e.getCoalescedEvents() : [];          // every sample from fast pens, for smooth lines
      (all.length ? all : [e]).forEach((ev) => cur.pts.push(at(ev)));
      later();
    });
    const end = () => { if (!cur) return; strokes.push(cur); undone.length = 0; cur = null; later(); };
    cv.addEventListener('pointerup', end);
    cv.addEventListener('pointercancel', end);
    const setTool = (t) => { tool = t; m.el.querySelectorAll('[data-tool]').forEach((b) => b.classList.toggle('on', b.dataset.tool === t)); };
    m.el.addEventListener('click', (e) => {
      const t = e.target.closest('[data-tool]'); if (t) return setTool(t.dataset.tool);
      const c = e.target.closest('[data-ink]');
      if (c) { ink = c.dataset.ink; m.el.querySelectorAll('[data-ink]').forEach((b) => b.classList.toggle('on', b === c)); if (tool === 'eraser') setTool('pen'); return; }
      const x = e.target.closest('[data-x]'); if (!x) return;
      if (x.dataset.x === 'undo' && strokes.length) { undone.push(strokes.pop()); redraw(); }
      if (x.dataset.x === 'redo' && undone.length) { strokes.push(undone.pop()); redraw(); }
      if (x.dataset.x === 'clear' && strokes.length) { undone.push(...strokes.splice(0).reverse()); redraw(); }
      if (x.dataset.x === 'save') save();
    });
    $('.sk-size', m.el).oninput = (e) => { width = +e.target.value; };
    m.el.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); $(`[data-x="${e.shiftKey ? 'redo' : 'undo'}"]`, m.el).click(); return; }
      const k = { p: 'pen', m: 'marker', e: 'eraser' }[e.key.toLowerCase()];
      if (k && !e.metaKey && !e.ctrlKey && e.target.tagName !== 'INPUT') setTool(k);
    });
    async function save() {
      // trimmed to the drawing plus a margin, on white, at 2x for sharp lines
      const pts = strokes.filter((s) => s.tool !== 'eraser').flatMap((s) => s.pts.map(([x, y]) => [x, y, (s.tool === 'pen' ? s.width : s.width * 4) / 2]));
      if (!pts.length) return;
      const M = 24, cw = cv.width / devicePixelRatio, ch = cv.height / devicePixelRatio;
      let x0 = Math.max(0, Math.min(...pts.map((p) => p[0] - p[2])) - M), y0 = Math.max(0, Math.min(...pts.map((p) => p[1] - p[2])) - M);
      let x1 = Math.min(cw, Math.max(...pts.map((p) => p[0] + p[2])) + M), y1 = Math.min(ch, Math.max(...pts.map((p) => p[1] + p[2])) + M);
      if (x1 - x0 < 240) { const c = (x0 + x1) / 2; x0 = Math.max(0, c - 120); x1 = Math.min(cw, x0 + 240); }
      if (y1 - y0 < 120) { const c = (y0 + y1) / 2; y0 = Math.max(0, c - 60); y1 = Math.min(ch, y0 + 120); }
      const S = 2, layer = document.createElement('canvas'), out = document.createElement('canvas');
      layer.width = out.width = Math.round((x1 - x0) * S); layer.height = out.height = Math.round((y1 - y0) * S);
      const lg = layer.getContext('2d'); lg.setTransform(S, 0, 0, S, -x0 * S, -y0 * S);
      strokes.forEach((s) => paint(lg, s));
      const og = out.getContext('2d'); og.fillStyle = '#fff'; og.fillRect(0, 0, out.width, out.height); og.drawImage(layer, 0, 0);
      const blob = await blobOf(out, 'image/png');
      m.close();
      insert([new File([blob], `Sketch ${stamp()}.png`, { type: 'image/png' })]);
    }
    const ro = new ResizeObserver(size); ro.observe(paper);
    size();
  }

  // ---------- the Media menu (paperclip in the toolbar) ----------
  function menuItems() {
    return [
      { label: 'Choose Photo or Video', icon: ICONS.photo, run: () => { restoreCaret(); Blocks.pick('image/*,video/*'); } },
      { label: 'Record Audio', icon: ICONS.audio, run: recordAudio },
      { label: 'Attach File', icon: ICONS.file, run: () => { restoreCaret(); Blocks.pick(''); } },
      { sep: true },
      { label: 'Take Photo', icon: ICONS.camera, run: takePhoto },
      { label: 'Scan Documents', icon: ICONS.scan, run: scanDocuments },
      { label: 'Add Sketch', icon: ICONS.sketch, run: addSketch },
    ];
  }
  function openMenu(btn) {
    keepCaret();
    const r = btn.getBoundingClientRect();
    C.openMenu(r.left, r.bottom + 4, menuItems());
  }

  // ---------- Share ----------
  async function noteParts(n) {
    const title = C.info(n).title || 'Note';
    const text = Exporter.plainText(await Exporter.plainDOM(n, { images: 'none' })).replace(/\n{3,}/g, '\n\n').trim();
    const body = text.startsWith(title) ? text.slice(title.length).replace(/^\s+/, '') : text;   // without the title line, for a subject + body
    return { title, text, body };
  }
  async function copy(text, html) {
    try {
      if (html && window.ClipboardItem) await navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([html], { type: 'text/html' }), 'text/plain': new Blob([text], { type: 'text/plain' }) })]);
      else await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
    }
  }
  const enc = encodeURIComponent;
  // Each channel opens its compose screen with the note filled in. A link can only carry so much text:
  // a long note is shortened there and the whole note is copied, ready to paste.
  const CHANNELS = [
    { k: 'mail', label: 'Mail', bg: '#1e88e5', glyph: svg('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>'), max: 1800, url: (p) => `mailto:?subject=${enc(p.title)}&body=${enc(p.body)}` },
    { k: 'gmail', label: 'Gmail', bg: '#ea4335', glyph: '<b>M</b>', max: 1800, url: (p) => `https://mail.google.com/mail/?view=cm&fs=1&su=${enc(p.title)}&body=${enc(p.body)}` },
    { k: 'outlook', label: 'Outlook', bg: '#0a64c2', glyph: '<b>O</b>', max: 1800, url: (p) => `https://outlook.live.com/mail/0/deeplink/compose?subject=${enc(p.title)}&body=${enc(p.body)}` },
    { k: 'sms', label: 'Messages', bg: '#34c759', glyph: svg('<path d="M4 5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-9l-5 4v-4H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z"/>'), max: 1500, url: (p) => `sms:?&body=${enc(p.text)}`, hide: isWinApp },
    { k: 'whatsapp', label: 'WhatsApp', bg: '#25d366', glyph: svg('<path d="M5 19l1.2-3.6A7.5 7.5 0 1 1 9 18.3z"/><path d="M9.5 9.5c.3 1.8 2.2 3.8 4.5 4.5l1-1.2"/>'), max: 3000, url: (p) => `https://wa.me/?text=${enc(p.text)}` },
    { k: 'telegram', label: 'Telegram', bg: '#229ed9', glyph: svg('<path d="M21 4L3 11l6 2 2 6 3-4 5 4z"/><path d="M9 13l8-6"/>'), max: 3000, url: (p) => `https://t.me/share/url?url=${enc(p.title)}&text=${enc(p.body)}` },
    { k: 'x', label: 'X', bg: '#111', glyph: '<b>𝕏</b>', max: 270, url: (p) => `https://x.com/intent/post?text=${enc(p.text)}` },
    { k: 'threads', label: 'Threads', bg: '#000', glyph: '<b>@</b>', max: 490, url: (p) => `https://www.threads.net/intent/post?text=${enc(p.text)}` },
    { k: 'linkedin', label: 'LinkedIn', bg: '#0a66c2', glyph: '<b>in</b>', max: 2800, url: (p) => `https://www.linkedin.com/feed/?shareActive=true&text=${enc(p.text)}` },
    { k: 'facebook', label: 'Facebook', bg: '#1877f2', glyph: '<b>f</b>', max: 0, url: () => 'https://www.facebook.com/' },
    { k: 'reddit', label: 'Reddit', bg: '#ff4500', glyph: '<b>r/</b>', max: 3000, url: (p) => `https://www.reddit.com/submit?type=TEXT&title=${enc(p.title)}&text=${enc(p.body)}` },
    { k: 'bluesky', label: 'Bluesky', bg: '#1185fe', glyph: '<b>🦋</b>', max: 290, url: (p) => `https://bsky.app/intent/compose?text=${enc(p.text)}` },
  ];
  const FILES = [{ k: 'pdf', label: 'PDF', ext: '.pdf' }, { k: 'docx', label: 'Word', ext: '.docx' }, { k: 'md', label: 'Markdown', ext: '.md' }, { k: 'txt', label: 'Text', ext: '.txt' }];
  const short = (s, max) => (s.length <= max ? s : s.slice(0, Math.max(0, max - 1)).replace(/\s+\S*$/, '') + '…');
  function openLink(url) {
    if (/^(mailto|sms):/.test(url)) { const a = document.createElement('a'); a.href = url; a.click(); }
    else window.open(url, '_blank', 'noopener');
  }
  const b64 = (blob) => new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(',')[1]); r.onerror = () => no(r.error); r.readAsDataURL(blob); });
  async function fileFor(n, k) {
    const name = Exporter.fileName(n) + FILES.find((f) => f.k === k).ext;
    if (k === 'docx') return { name, blob: await Exporter.asDOCX(n) };
    if (k === 'md') return { name, blob: new Blob([C.toMarkdown(await Exporter.plainDOM(n, { images: 'raw', keepLinks: true }))], { type: 'text/markdown' }) };
    return { name, blob: new Blob([(await noteParts(n)).text], { type: 'text/plain' }) };
  }
  const rectOf = (el) => { const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; };

  // a single file (an attachment) to the system share menu
  const canShareFiles = () => (isMacApp() ? !!C.native.share : !isWinApp() && !!navigator.canShare);
  async function shareFile(blob, name, rect) {
    try {
      if (isMacApp() && C.native.share) { const r = await C.native.share({ b64: await b64(blob), name, rect }); if (r !== 'ok') throw new Error(r); return; }
      const file = new File([blob], name, { type: blob.type });
      if (!navigator.canShare || !navigator.canShare({ files: [file] })) throw new Error('this file type can’t be shared here');
      await navigator.share({ files: [file] }).catch((err) => { if (err.name !== 'AbortError') throw err; });
    } catch (err) { C.toast(`Couldn’t share: ${(err && err.message) || err}`); }
  }

  function share(id) {
    const n = C.byId(id || C.currentId()); if (!n) return;
    const mac = isMacApp() && !!C.native.share, sysShare = mac || (!isWinApp() && typeof navigator.share === 'function');
    const title = C.info(n).title || 'Note';
    const m = modal('md-share', head(`Share “${title.length > 40 ? title.slice(0, 39) + '…' : title}”`) + `
      ${sysShare ? `<button class="sh-system" data-sys="1">${ICONS.share}<span><b>${mac ? 'AirDrop, Messages, Mail, Notes…' : 'Share with an app…'}</b><small>${mac ? 'Your Mac’s share menu' : 'Your device’s share sheet'}</small></span></button>` : ''}
      <div class="sh-label">Send to</div>
      <div class="sh-grid">${CHANNELS.filter((c) => !(c.hide && c.hide())).map((c) => `<button data-ch="${c.k}"><span class="sh-ic" style="background:${c.bg}">${c.glyph}</span>${c.label}</button>`).join('')}</div>
      <div class="sh-label">Copy</div>
      <div class="sh-row"><button class="pl-btn" data-copy="text">Copy text</button><button class="pl-btn" data-copy="rich">Copy with formatting</button><button class="pl-btn" data-copy="md">Copy as Markdown</button></div>
      <div class="sh-label">${sysShare ? 'Send as a file' : 'Save as a file to send'}</div>
      <div class="sh-row">${FILES.map((f) => `<button class="pl-btn" data-file="${f.k}">${f.label}</button>`).join('')}</div>`);
    let parts = null;
    const getParts = async () => parts || (parts = await noteParts(n));
    m.el.addEventListener('click', async (e) => {
      const b = e.target.closest('button'); if (!b || b.dataset.x) return;
      try {
        if (b.dataset.sys) {
          const p = await getParts();
          if (mac) await C.native.share({ text: p.text, rect: rectOf(b) });
          else await navigator.share({ title: p.title, text: p.body }).catch((err) => { if (err.name !== 'AbortError') throw err; });
          return m.close();
        }
        if (b.dataset.ch) {
          const ch = CHANNELS.find((c) => c.k === b.dataset.ch), p = await getParts();
          const cut = { title: p.title, text: short(p.text, ch.max), body: short(p.body, ch.max) };
          const trimmed = ch.max && (cut.text !== p.text || cut.body !== p.body);
          if (!ch.max || trimmed) await copy(p.text);
          openLink(ch.url(cut));
          C.toast(!ch.max ? `Note copied. Paste it into your ${ch.label} post.` : trimmed ? `${ch.label} links only fit the start of a long note, so the whole note is copied too: paste it in.` : `Opening ${ch.label}…`);
          return m.close();
        }
        if (b.dataset.copy) {
          if (b.dataset.copy === 'text') await copy((await getParts()).text);
          if (b.dataset.copy === 'md') await copy(C.toMarkdown(await Exporter.plainDOM(n, { images: 'raw', keepLinks: true })));
          if (b.dataset.copy === 'rich') { const d = await Exporter.plainDOM(n, { images: 'data' }); await copy((await getParts()).text, d.innerHTML); }
          C.toast(b.dataset.copy === 'rich' ? 'Copied with formatting: paste it into Mail, Docs, Word…' : b.dataset.copy === 'md' ? 'Copied as Markdown' : 'Note text copied');
          return m.close();
        }
        if (b.dataset.file) {
          const k = b.dataset.file;
          if (mac) {                                  // the Mac share menu with the file itself (AirDrop, Mail attachment…)
            b.disabled = true;
            if (k === 'pdf') await C.native.share({ pdfHtml: await Exporter.htmlDocument(n), name: Exporter.fileName(n) + '.pdf', rect: rectOf(b) });
            else { const f = await fileFor(n, k); await C.native.share({ b64: await b64(f.blob), name: f.name, rect: rectOf(b) }); }
            return m.close();
          }
          if (sysShare && k !== 'pdf' && navigator.canShare) {
            const f = await fileFor(n, k), file = new File([f.blob], f.name, { type: f.blob.type });
            if (navigator.canShare({ files: [file] })) {
              try { await navigator.share({ files: [file], title: f.name }); return m.close(); }
              catch (err) {
                if (err.name === 'AbortError') return;
                if (err.name === 'NotAllowedError') {          // preparing the file took too long for the browser: one more tap shares it
                  b.textContent = `Tap to share ${f.name}`;
                  b.onclick = (ev) => { ev.stopPropagation(); navigator.share({ files: [file], title: f.name }).then(() => m.close(), () => {}); };
                  return;
                }
                throw err;
              }
            }
          }
          m.close();
          await Exporter.run(k, n.id);                // otherwise save it, then attach it anywhere
          if (k !== 'pdf') C.toast('Saved. Attach the file in any app to send it.');
        }
      } catch (err) {
        b.disabled = false;
        C.toast(`Couldn’t share: ${(err && err.message) || err}`);
      }
    });
  }

  window.Media = {
    init(core) { C = core; },
    ICONS, openMenu, takePhoto, recordAudio, scanDocuments, addSketch, share, shareFile, canShareFiles, pdfFromJpegs,
  };
})();
