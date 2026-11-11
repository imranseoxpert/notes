/* Exporter: saves a note as PDF, Word (.docx), Markdown, HTML or plain text.
   Images are embedded (PDF, Word, HTML). Word files are built here, with a tiny ZIP writer, no libraries. */
(() => {
  'use strict';
  let C = null;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const X = esc;                                       // XML text/attribute escaping
  const fileName = (n) => (C.info(n).title.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ').trim().slice(0, 80) || 'Note');
  const toDataURL = (blob) => new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = () => no(r.error); r.readAsDataURL(blob); });
  const attachment = (id) => Blocks.store.get(id).catch(() => null);

  /** The note as plain HTML: live blocks turned into ordinary content (checkbox symbols, task lists, note titles). */
  async function plainDOM(n, { images = 'data', keepLinks = false } = {}) {
    const d = document.createElement('div');
    d.innerHTML = n.html;
    for (const fig of images === 'raw' ? [] : [...d.querySelectorAll('figure.att')]) {
      const rec = await attachment(fig.dataset.att), name = fig.dataset.name || 'file';
      if (fig.dataset.kind === 'image' && rec && images === 'data') fig.outerHTML = `<figure><img src="${await toDataURL(rec.blob)}" alt="${esc(name)}"></figure>`;
      else if (fig.dataset.kind === 'image' && rec && images === 'keep') { fig.dataset.exportImage = '1'; }
      else fig.outerHTML = `<p class="file">📎 ${esc(name)}</p>`;
    }
    d.querySelectorAll('.blk-board').forEach((el) => {
      const tasks = Planner.noteBoard.tasks(n.id);
      el.outerHTML = tasks.length ? `<ul class="checklist">${tasks.map((t) => `<li class="${t.done ? 'done' : ''}">${esc(t.title || 'Untitled')}</li>`).join('')}</ul>` : '';
    });
    d.querySelectorAll('.blk-doc').forEach((el) => { const t = C.byId(el.dataset.note); el.outerHTML = `<p class="doc">📄 ${esc(t ? C.info(t).title : 'Note')}</p>`; });
    d.querySelectorAll('.blk-toc').forEach((el) => el.remove());
    for (const el of [...d.querySelectorAll('.blk-mindmap')]) {
      try { await MindMap.exportBlock(el, images); } catch (err) { el.outerHTML = '<p class="file">🧠 Mind map</p>'; }
    }
    d.querySelectorAll('a.nlink').forEach((a) => {
      const t = C.byId(a.dataset.note), title = t ? C.info(t).title : a.textContent;
      if (keepLinks) a.textContent = title; else a.outerHTML = `<span class="nlink">${esc(title)}</span>`;
    });
    d.querySelectorAll('.callout').forEach((el) => { el.insertAdjacentText('afterbegin', (el.dataset.icon || '💡') + ' '); delete el.dataset.icon; });
    d.querySelectorAll('.toggle').forEach((el) => el.classList.add('open'));
    d.querySelectorAll('[contenteditable]').forEach((el) => el.removeAttribute('contenteditable'));
    return d;
  }

  const PAGE_CSS = `
    @page { size: A4; margin: 18mm 16mm; }
    body { font: 11pt/1.55 -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #1d1d1f; margin: 0; }
    article { max-width: 720px; margin: 0 auto; }
    h1 { font-size: 22pt; margin: 0 0 10pt; line-height: 1.2; } h2 { font-size: 16pt; margin: 16pt 0 6pt; } h3 { font-size: 13pt; margin: 14pt 0 4pt; }
    h1, h2, h3 { page-break-after: avoid; }
    p, div { margin: 0 0 4pt; }
    img { max-width: 100%; border-radius: 6px; page-break-inside: avoid; }
    figure { margin: 8pt 0; }
    blockquote { margin: 8pt 0; padding: 2pt 12pt; border-left: 3px solid #e5a400; color: #555; }
    pre { background: #f3f1ec; padding: 8pt 10pt; border-radius: 6px; font: 9.5pt/1.45 Menlo, Consolas, monospace; white-space: pre-wrap; }
    code { font-family: Menlo, Consolas, monospace; background: #f3f1ec; padding: 0 3px; border-radius: 3px; }
    table { border-collapse: collapse; width: 100%; margin: 8pt 0; } th, td { border: 1px solid #ccc; padding: 4pt 6pt; text-align: left; vertical-align: top; } th { background: #f3f1ec; }
    ul.checklist { list-style: none; padding-left: 4pt; } ul.checklist li::before { content: "☐  "; } ul.checklist li.done::before { content: "☑  "; } ul.checklist li.done { color: #777; text-decoration: line-through; }
    .callout { background: #f6f5f1; border-radius: 6px; padding: 8pt 10pt; margin: 8pt 0; }
    .tg-h { font-weight: 600; } .tg-b { padding-left: 14pt; }
    font[size="2"] { font-size: .85em; } font[size="5"] { font-size: 1.35em; } font[size="6"] { font-size: 1.75em; }
    mark { background: #fff0a0; } hr { border: 0; border-top: 1px solid #ddd; margin: 12pt 0; }
    .nlink { color: #8a6200; } .file, .doc { color: #555; } a { color: #1a73e8; }`;
  async function htmlDocument(n) {
    const d = await plainDOM(n);
    return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(C.info(n).title)}</title><style>${PAGE_CSS}</style></head><body><article>${d.innerHTML}</article></body></html>`;
  }

  /** Readable plain text: one line per block, table cells separated by tabs, list markers kept. */
  function plainText(root) {
    const out = [];
    const walk = (el) => {
      for (const c of el.childNodes) {
        if (c.nodeType === 3) { if (c.nodeValue.trim()) out.push(c.nodeValue.replace(/\u00a0/g, ' ').trim()); continue; }
        if (c.nodeType !== 1) continue;
        const tag = c.tagName;
        if (tag === 'TABLE') { [...c.rows].forEach((r) => out.push([...r.cells].map((x) => x.textContent.trim()).join('\t'))); out.push(''); }
        else if (tag === 'UL' || tag === 'OL') {
          [...c.children].forEach((li, i) => out.push((c.classList.contains('checklist') ? (li.classList.contains('done') ? '[x] ' : '[ ] ') : tag === 'OL' ? `${i + 1}. ` : '• ') + li.textContent.replace(/\u00a0/g, ' ').trim()));
          out.push('');
        }
        else if (tag === 'PRE') { out.push(c.textContent, ''); }
        else if (tag === 'HR') out.push('----------');
        else if (/^(H[1-6])$/.test(tag)) out.push('', c.textContent.trim(), '');
        else if (c.querySelector && c.querySelector(':scope > div, :scope > ul, :scope > ol, :scope > table, :scope > pre, :scope > h1, :scope > h2, :scope > h3')) walk(c);
        else out.push(c.textContent.replace(/\u00a0/g, ' ').trim());
      }
    };
    walk(root);
    return out.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
  }

  // ---------- saving ----------
  async function save(name, blob) {
    if (C.native && C.native.saveFile) {               // Mac app: native Save dialog
      const r = await C.native.saveFile(name, await toDataURL(blob).then((u) => u.split(',')[1]));
      if (r === 'ok') C.toast(`Saved “${name}”`); else if (r !== 'cancel') C.toast(`Couldn't save: ${r}`);
      return;
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 60000);
  }

  async function asPDF(n) {
    const html = await htmlDocument(n), name = fileName(n) + '.pdf';
    if (C.native && C.native.exportPDF) {              // Mac / Windows app: real A4 PDF written by the app
      const r = await C.native.exportPDF(html, name);
      if (r === 'ok') C.toast(`Saved “${name}”`); else if (r !== 'cancel') C.toast(`Couldn't create the PDF: ${r}`);
      return;
    }
    const f = document.createElement('iframe');      // browser: print dialog → “Save as PDF”
    f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
    f.srcdoc = html;
    f.onload = () => { f.contentWindow.focus(); f.contentWindow.print(); setTimeout(() => f.remove(), 60000); };
    document.body.appendChild(f);
    C.toast('In the print dialog, choose “Save as PDF”.');
  }

  // ---------- Word (.docx) ----------
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc32 = (b) => { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  /** Minimal ZIP (stored, no compression): what .docx files are. */
  function zip(files, type) {
    const enc = new TextEncoder(), parts = [], central = [];
    let offset = 0;
    for (const f of files) {
      const name = enc.encode(f.name), data = typeof f.data === 'string' ? enc.encode(f.data) : f.data, crc = crc32(data);
      const loc = new DataView(new ArrayBuffer(30));
      loc.setUint32(0, 0x04034b50, true); loc.setUint16(4, 20, true); loc.setUint16(6, 0x0800, true); loc.setUint16(12, 0x21, true);
      loc.setUint32(14, crc, true); loc.setUint32(18, data.length, true); loc.setUint32(22, data.length, true); loc.setUint16(26, name.length, true);
      parts.push(new Uint8Array(loc.buffer), name, data);
      const cen = new DataView(new ArrayBuffer(46));
      cen.setUint32(0, 0x02014b50, true); cen.setUint16(4, 20, true); cen.setUint16(6, 20, true); cen.setUint16(8, 0x0800, true); cen.setUint16(14, 0x21, true);
      cen.setUint32(16, crc, true); cen.setUint32(20, data.length, true); cen.setUint32(24, data.length, true); cen.setUint16(28, name.length, true); cen.setUint32(42, offset, true);
      central.push(new Uint8Array(cen.buffer), name);
      offset += 30 + name.length + data.length;
    }
    const size = central.reduce((s, p) => s + p.length, 0);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true); end.setUint32(12, size, true); end.setUint32(16, offset, true);
    return new Blob([...parts, ...central, new Uint8Array(end.buffer)], { type });
  }
  async function imageForWord(blob) {                 // Word reads PNG / JPEG / GIF; anything else becomes PNG
    const bmp = await createImageBitmap(blob);
    const w = bmp.width, h = bmp.height;
    let data = blob, ext = /png/.test(blob.type) ? 'png' : /jpe?g/.test(blob.type) ? 'jpeg' : /gif/.test(blob.type) ? 'gif' : null;
    if (!ext) {
      const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(bmp, 0, 0);
      data = await new Promise((ok) => c.toBlob(ok, 'image/png')); ext = 'png';
    }
    return { bytes: new Uint8Array(await data.arrayBuffer()), ext, w, h };
  }
  async function asDOCX(n) {
    const d = await plainDOM(n, { images: 'keep' });
    const rels = [], media = [];
    let relN = 10, picN = 1;
    const rel = (type, target, ext) => { const id = 'rId' + relN++; rels.push(`<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/${type}" Target="${X(target)}"${ext ? ' TargetMode="External"' : ''}/>`); return id; };
    const run = (t, f) => {
      const face = f.code ? 'Menlo' : f.face;
      const color = f.link ? '1A73E8' : f.muted ? '777777' : f.color;
      const pr = (face ? `<w:rFonts w:ascii="${X(face)}" w:hAnsi="${X(face)}" w:cs="${X(face)}"/>` : '') + (f.b ? '<w:b/>' : '') + (f.i ? '<w:i/>' : '') + (f.s ? '<w:strike/>' : '') +
        (color ? `<w:color w:val="${color}"/>` : '') + (f.sz ? `<w:sz w:val="${f.sz}"/><w:szCs w:val="${f.sz}"/>` : '') +
        (f.hl ? '<w:highlight w:val="yellow"/>' : '') + (f.u || f.link ? '<w:u w:val="single"/>' : '') + (f.code ? '<w:shd w:val="clear" w:fill="F3F1EC"/>' : '');
      return `<w:r>${pr ? `<w:rPr>${pr}</w:rPr>` : ''}<w:t xml:space="preserve">${X(t)}</w:t></w:r>`;
    };
    const runs = (node, f = {}) => {
      let out = '';
      for (const c of node.childNodes) {
        if (c.nodeType === 3) { const t = c.nodeValue.replace(/ /g, ' '); if (t) out += run(t, f); continue; }
        if (c.nodeType !== 1) continue;
        const tag = c.tagName;
        if (tag === 'BR') { out += '<w:r><w:br/></w:r>'; continue; }
        if (/^(UL|OL|TABLE|FIGURE|PRE|H[1-6]|BLOCKQUOTE|HR)$/.test(tag)) continue;   // block inside inline context: handled by blocks()
        if (tag === 'A' && /^(https?|mailto):/.test(c.getAttribute('href') || '')) { out += `<w:hyperlink r:id="${rel('hyperlink', c.getAttribute('href'), true)}">${runs(c, { ...f, link: 1 })}</w:hyperlink>`; continue; }
        const g = { ...f };
        if (tag === 'B' || tag === 'STRONG') g.b = 1;
        if (tag === 'I' || tag === 'EM') g.i = 1;
        if (tag === 'U') g.u = 1;
        if (/^(S|STRIKE|DEL)$/.test(tag)) g.s = 1;
        if (tag === 'MARK') g.hl = 1;
        if (tag === 'CODE') g.code = 1;
        if (tag === 'FONT') {
          const hex = /^#([0-9a-f]{6})$/i.exec(c.getAttribute('color') || '');
          if (hex) g.color = hex[1].toUpperCase();
          const sz = { 2: 19, 5: 30, 6: 38 }[c.getAttribute('size')];
          if (sz) g.sz = sz;
          const family = (c.getAttribute('face') || '').split(',')[0].trim().replace(/["']/g, '');
          if (family) g.face = family;
        }
        if (c.classList.contains('nlink')) g.b = 1;
        out += runs(c, g);
      }
      return out;
    };
    const p = (inner, style, extra = '') => `<w:p>${style || extra ? `<w:pPr>${style ? `<w:pStyle w:val="${style}"/>` : ''}${extra}</w:pPr>` : ''}${inner}</w:p>`;
    const picture = async (fig) => {
      const rec = fig.dataset.mmPng ? { blob: await (await fetch(fig.dataset.mmPng)).blob() } : await attachment(fig.dataset.att);
      if (!rec) return p(run('📎 ' + (fig.dataset.name || 'image'), { muted: 1 }));
      let img;
      try { img = await imageForWord(rec.blob); } catch { return p(run('📎 ' + (fig.dataset.name || 'image'), { muted: 1 })); }
      const target = `media/image${picN}.${img.ext}`;
      media.push({ name: 'word/' + target, data: img.bytes });
      const rid = rel('image', target), id = picN++;
      const maxW = 5760720;                            // 6.3 inches in EMU
      let cx = img.w * 9525, cy = img.h * 9525;
      if (cx > maxW) { cy = Math.round(cy * maxW / cx); cx = maxW; }
      return `<w:p><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${id}" name="Picture ${id}"/>` +
        '<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">' +
        `<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${id}" name="${X(fig.dataset.name || 'image')}"/><pic:cNvPicPr/></pic:nvPicPr>` +
        `<pic:blipFill><a:blip r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>` +
        `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic>` +
        '</a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>';
    };
    const blocks = async (container) => {
      let out = '';
      for (const el of container.childNodes) {
        if (el.nodeType === 3) { if (el.nodeValue.trim()) out += p(run(el.nodeValue, {})); continue; }
        if (el.nodeType !== 1) continue;
        const tag = el.tagName;
        if (/^H[1-6]$/.test(tag)) out += p(runs(el), 'Heading' + Math.min(3, +tag[1]));
        else if (tag === 'UL' || tag === 'OL') {
          const check = el.classList.contains('checklist');
          let i = 0;
          for (const li of el.children) {
            const done = li.classList.contains('done');
            i++;
            // numbers are written as text so every app shows them (some readers ignore Word's list numbering)
            out += check ? p(run(done ? '☑ ' : '☐ ', {}) + runs(li, done ? { s: 1, muted: 1 } : {}), 'ListParagraph')
              : tag === 'OL' ? p(run(`${i}.\t`, {}) + runs(li), 'ListParagraph', '<w:tabs><w:tab w:val="left" w:pos="720"/></w:tabs><w:ind w:left="720" w:hanging="360"/>')
                : p(runs(li), 'ListParagraph', '<w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr>');
            const nested = li.querySelectorAll(':scope > ul, :scope > ol'); for (const sub of nested) out += await blocks({ childNodes: [sub] });
          }
        }
        else if (tag === 'BLOCKQUOTE') out += p(runs(el), 'Quote');
        else if (tag === 'PRE') out += el.textContent.split('\n').map((l) => p(run(l || ' ', { code: 1 }), 'Code')).join('');
        else if (tag === 'HR') out += p('', '', '<w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="CCCCCC"/></w:pBdr>');
        else if (tag === 'TABLE') {
          const rows = [...el.rows], cols = Math.max(1, ...rows.map((r) => r.cells.length)), colW = Math.floor(9600 / cols);
          const borders = ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map((b) => `<w:${b} w:val="single" w:sz="4" w:space="0" w:color="BFBFBF"/>`).join('');
          out += `<w:tbl><w:tblPr><w:tblStyle w:val="TableGrid"/><w:tblW w:w="5000" w:type="pct"/><w:tblBorders>${borders}</w:tblBorders></w:tblPr>` +
            `<w:tblGrid>${`<w:gridCol w:w="${colW}"/>`.repeat(cols)}</w:tblGrid>` +
            rows.map((r) => `<w:tr>${[...r.cells].map((c) => `<w:tc><w:tcPr><w:tcW w:w="${colW}" w:type="dxa"/>${c.tagName === 'TH' ? '<w:shd w:val="clear" w:fill="F3F1EC"/>' : ''}</w:tcPr>${p(runs(c, c.tagName === 'TH' ? { b: 1 } : {}))}</w:tc>`).join('')}</w:tr>`).join('') +
            '</w:tbl>' + p('');
        }
        else if (tag === 'FIGURE' && el.dataset.exportImage) out += await picture(el);
        else if (el.classList.contains('callout')) out += p(runs(el), 'Callout');
        else if (el.classList.contains('toggle')) out += await blocks(el);
        else if (el.classList.contains('tg-h')) out += p(runs(el, { b: 1 }));
        else if (el.classList.contains('tg-b')) out += await blocks(el);
        else if (el.querySelector && el.querySelector(':scope > ul, :scope > ol, :scope > table, :scope > figure, :scope > div, :scope > pre, :scope > blockquote, :scope > h1, :scope > h2, :scope > h3')) out += await blocks(el);
        else out += p(runs(el));
      }
      return out;
    };
    const body = await blocks(d);
    const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
    const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${W} xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ` +
      'xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">' +
      `<w:body>${body || p('')}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr></w:body></w:document>`;
    const style = (id, name, ppr, rpr, extra = '') => `<w:style w:type="paragraph" w:styleId="${id}"><w:name w:val="${name}"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/>${extra}<w:pPr>${ppr}</w:pPr><w:rPr>${rpr}</w:rPr></w:style>`;
    const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles ${W}>` +
      '<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:eastAsia="Calibri" w:cs="Calibri"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr></w:rPrDefault>' +
      '<w:pPrDefault><w:pPr><w:spacing w:after="80" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>' +
      '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>' +
      style('Heading1', 'heading 1', '<w:keepNext/><w:spacing w:before="240" w:after="120"/><w:outlineLvl w:val="0"/>', '<w:b/><w:sz w:val="40"/><w:szCs w:val="40"/>', '<w:qFormat/>') +
      style('Heading2', 'heading 2', '<w:keepNext/><w:spacing w:before="240" w:after="80"/><w:outlineLvl w:val="1"/>', '<w:b/><w:sz w:val="30"/><w:szCs w:val="30"/>', '<w:qFormat/>') +
      style('Heading3', 'heading 3', '<w:keepNext/><w:spacing w:before="200" w:after="60"/><w:outlineLvl w:val="2"/>', '<w:b/><w:sz w:val="25"/><w:szCs w:val="25"/>', '<w:qFormat/>') +
      style('ListParagraph', 'List Paragraph', '<w:spacing w:after="40"/><w:ind w:left="720"/>', '') +
      style('Quote', 'Quote', '<w:ind w:left="567"/><w:pBdr><w:left w:val="single" w:sz="18" w:space="8" w:color="E5A400"/></w:pBdr>', '<w:i/><w:color w:val="555555"/>', '<w:qFormat/>') +
      style('Code', 'Code', '<w:spacing w:after="0"/><w:shd w:val="clear" w:fill="F3F1EC"/>', '<w:rFonts w:ascii="Menlo" w:hAnsi="Menlo" w:cs="Menlo"/><w:sz w:val="19"/>') +
      style('Callout', 'Callout', '<w:shd w:val="clear" w:fill="F6F5F1"/><w:spacing w:before="120" w:after="120"/><w:ind w:left="113" w:right="113"/>', '') +
      '<w:style w:type="table" w:styleId="TableGrid"><w:name w:val="Table Grid"/><w:tblPr><w:tblBorders>' +
      ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map((s) => `<w:${s} w:val="single" w:sz="4" w:space="0" w:color="BFBFBF"/>`).join('') +
      '</w:tblBorders><w:tblCellMar><w:left w:w="100" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style></w:styles>';
    const lvl = (fmt, text) => `<w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="${fmt}"/><w:lvlText w:val="${text}"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr></w:lvl>`;
    const numbering = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:numbering ${W}>` +
      `<w:abstractNum w:abstractNumId="1"><w:nsid w:val="0A1B2C01"/><w:multiLevelType w:val="singleLevel"/>${lvl('bullet', '•')}</w:abstractNum>` +
      '<w:num w:numId="1"><w:abstractNumId w:val="1"/></w:num>' +
      '</w:numbering>';
    const docRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
      '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>' + rels.join('') + '</Relationships>';
    const types = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>' +
      '<Default Extension="png" ContentType="image/png"/><Default Extension="jpeg" ContentType="image/jpeg"/><Default Extension="gif" ContentType="image/gif"/>' +
      '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
      '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' +
      '<Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>' +
      '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>';
    const now = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
    const core = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" ' +
      'xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
      `<dc:title>${X(C.info(n).title)}</dc:title><dc:creator>Notes</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created></cp:coreProperties>`;
    const rootRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
      '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>';
    return zip([
      { name: '[Content_Types].xml', data: types }, { name: '_rels/.rels', data: rootRels }, { name: 'docProps/core.xml', data: core },
      { name: 'word/document.xml', data: doc }, { name: 'word/styles.xml', data: styles }, { name: 'word/numbering.xml', data: numbering },
      { name: 'word/_rels/document.xml.rels', data: docRels }, ...media,
    ], 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  }

  // ---------- public ----------
  const FORMATS = [
    { k: 'pdf', label: 'PDF', icon: '📕' },
    { k: 'docx', label: 'Word (.docx)', icon: '📘' },
    { k: 'md', label: 'Markdown (.md)', icon: 'M↓' },
    { k: 'html', label: 'Web page (.html)', icon: '🌐' },
    { k: 'txt', label: 'Plain text (.txt)', icon: '📄' },
  ];
  async function run(fmt, id) {
    const n = C.byId(id);
    if (!n) return;
    const name = fileName(n);
    try {
      if (fmt === 'pdf') return await asPDF(n);
      if (fmt === 'docx') return await save(name + '.docx', await asDOCX(n));
      if (fmt === 'html') return await save(name + '.html', new Blob([await htmlDocument(n)], { type: 'text/html' }));
      if (fmt === 'md') return await save(name + '.md', new Blob([C.toMarkdown(await plainDOM(n, { images: 'raw', keepLinks: true }))], { type: 'text/markdown' }));
      if (fmt === 'txt') return await save(name + '.txt', new Blob([plainText(await plainDOM(n, { images: 'none' }))], { type: 'text/plain' }));
    } catch (err) {
      console.error('export failed', err);
      C.toast(`Export failed: ${err && err.message ? err.message : err}`);
    }
  }
  window.Exporter = { init(core) { C = core; }, run, FORMATS, asDOCX, htmlDocument, plainDOM, plainText, fileName, save };
})();
