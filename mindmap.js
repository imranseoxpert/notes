/* Mind maps for Notes.
   The engine (themes, document model, layout of the nine structures, SVG renderer) is copied unchanged from
   Mindloom 1.1.0, https://github.com/imranseoxpert/mindloom (src/renderer/core). To update it, copy those
   four files again; the Notes-specific part (the block and the editor) follows them at the end of this file. */

/* ---- mindloom/src/renderer/core/themes.js ---- */
/* Mindloom — themes, shapes, layouts, patterns, markers (pure data + helpers) */
(function (ML) {
  'use strict';

  const R = (id, name, dark, o) => Object.assign({ id, name, dark }, o);

  // Each theme: canvas background, pattern ink, level styles, line colour, branch palette.
  const THEMES = [
    R('classic', 'Classic', false, {
      bg: '#f6f7fb', ink: 'rgba(40,50,90,0.10)',
      root: { fill: '#2b3a67', color: '#ffffff', border: '#2b3a67' },
      main: { fill: '#e6ebf7', color: '#1d2440', border: '#b9c4e3' },
      sub: { fill: '#ffffff', color: '#2a2f45', border: '#c9d1ea' },
      line: '#8d99c2', rainbow: false,
      branches: ['#4c6ef5', '#12b886', '#fab005', '#fa5252', '#7950f2', '#15aabf', '#fd7e14', '#e64980'],
    }),
    R('fresh', 'Fresh Rainbow', false, {
      bg: '#ffffff', ink: 'rgba(0,0,0,0.07)',
      root: { fill: '#1f2937', color: '#ffffff', border: '#1f2937' },
      main: { fill: '#ffffff', color: '#ffffff', border: '#ffffff' },
      sub: { fill: '#ffffff', color: '#1f2937', border: '#d1d5db' },
      line: '#9ca3af', rainbow: true,
      branches: ['#ef4444', '#d97706', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#0d9488', '#ea580c'],
    }),
    R('ocean', 'Ocean', false, {
      bg: '#eef7fb', ink: 'rgba(14,90,130,0.10)',
      root: { fill: '#0b4f6c', color: '#ffffff', border: '#0b4f6c' },
      main: { fill: '#01baef', color: '#ffffff', border: '#01baef' },
      sub: { fill: '#ffffff', color: '#0b3c52', border: '#9fd8ee' },
      line: '#20a4d4', rainbow: false,
      branches: ['#0077b6', '#00b4d8', '#48cae4', '#0096c7', '#023e8a', '#90e0ef', '#03045e', '#0aa1a1'],
    }),
    R('sunset', 'Sunset', false, {
      bg: '#fff7f0', ink: 'rgba(160,70,20,0.10)',
      root: { fill: '#9d0208', color: '#ffffff', border: '#9d0208' },
      main: { fill: '#f48c06', color: '#ffffff', border: '#f48c06' },
      sub: { fill: '#fffaf5', color: '#5c1d04', border: '#f7c59f' },
      line: '#e85d04', rainbow: true,
      branches: ['#d00000', '#dc2f02', '#e85d04', '#f48c06', '#faa307', '#9d0208', '#6a040f', '#ffba08'],
    }),
    R('forest', 'Forest', false, {
      bg: '#f3f8f1', ink: 'rgba(40,90,40,0.10)',
      root: { fill: '#2d6a4f', color: '#ffffff', border: '#2d6a4f' },
      main: { fill: '#74c69d', color: '#0b2e1f', border: '#74c69d' },
      sub: { fill: '#ffffff', color: '#1b4332', border: '#b7e4c7' },
      line: '#52b788', rainbow: false,
      branches: ['#40916c', '#52b788', '#95d5b2', '#1b4332', '#74c69d', '#2d6a4f', '#b7e4c7', '#081c15'],
    }),
    R('lavender', 'Lavender', false, {
      bg: '#f8f5ff', ink: 'rgba(90,60,160,0.10)',
      root: { fill: '#5a189a', color: '#ffffff', border: '#5a189a' },
      main: { fill: '#e0c3fc', color: '#3c096c', border: '#c8a2f4' },
      sub: { fill: '#ffffff', color: '#3c096c', border: '#dcc6f7' },
      line: '#9d4edd', rainbow: false,
      branches: ['#7b2cbf', '#9d4edd', '#c77dff', '#5a189a', '#e0aaff', '#3c096c', '#b5179e', '#7209b7'],
    }),
    R('candy', 'Candy', false, {
      bg: '#fff5fa', ink: 'rgba(200,60,130,0.10)',
      root: { fill: '#ff4d8d', color: '#ffffff', border: '#ff4d8d' },
      main: { fill: '#ffffff', color: '#ffffff', border: '#ffffff' },
      sub: { fill: '#ffffff', color: '#5b2142', border: '#ffc2dc' },
      line: '#ff8fb8', rainbow: true,
      branches: ['#ff6b9a', '#ffb347', '#7bdcb5', '#8ed1fc', '#b28dff', '#ffd166', '#06d6a0', '#ef476f'],
    }),
    R('pastel', 'Pastel', false, {
      bg: '#fbfaf7', ink: 'rgba(0,0,0,0.06)',
      root: { fill: '#ffd6a5', color: '#5c3d1e', border: '#f6bd7f' },
      main: { fill: '#caffbf', color: '#24452a', border: '#a9e6a0' },
      sub: { fill: '#ffffff', color: '#3d3d3d', border: '#e6e1d6' },
      line: '#c9b8a6', rainbow: false,
      branches: ['#ffadad', '#ffd6a5', '#fdffb6', '#caffbf', '#9bf6ff', '#a0c4ff', '#bdb2ff', '#ffc6ff'],
    }),
    R('business', 'Business', false, {
      bg: '#ffffff', ink: 'rgba(0,0,0,0.07)',
      root: { fill: '#111827', color: '#ffffff', border: '#111827' },
      main: { fill: '#f3f4f6', color: '#111827', border: '#d1d5db' },
      sub: { fill: '#ffffff', color: '#374151', border: '#e5e7eb' },
      line: '#6b7280', rainbow: false,
      branches: ['#1e40af', '#047857', '#b45309', '#b91c1c', '#6d28d9', '#0e7490', '#be185d', '#4d7c0f'],
    }),
    R('mono', 'Monochrome', false, {
      bg: '#fafafa', ink: 'rgba(0,0,0,0.08)',
      root: { fill: '#000000', color: '#ffffff', border: '#000000' },
      main: { fill: '#ffffff', color: '#000000', border: '#000000' },
      sub: { fill: '#ffffff', color: '#222222', border: '#9a9a9a' },
      line: '#444444', rainbow: false,
      branches: ['#000000', '#333333', '#555555', '#777777', '#222222', '#444444', '#666666', '#888888'],
    }),
    R('sakura', 'Sakura', false, {
      bg: '#fff8f9', ink: 'rgba(190,80,110,0.09)',
      root: { fill: '#c9184a', color: '#ffffff', border: '#c9184a' },
      main: { fill: '#ffccd5', color: '#590d22', border: '#ffb3c1' },
      sub: { fill: '#ffffff', color: '#590d22', border: '#ffccd5' },
      line: '#ff758f', rainbow: false,
      branches: ['#ff4d6d', '#ff758f', '#c9184a', '#ff8fa3', '#a4133c', '#ffb3c1', '#800f2f', '#ff4d6d'],
    }),
    R('earth', 'Coffee', false, {
      bg: '#f7f1e8', ink: 'rgba(100,70,40,0.10)',
      root: { fill: '#583101', color: '#fff8ee', border: '#583101' },
      main: { fill: '#bc8a5f', color: '#ffffff', border: '#bc8a5f' },
      sub: { fill: '#fffaf2', color: '#4a2c0a', border: '#dfc2a0' },
      line: '#a47148', rainbow: false,
      branches: ['#8b5e34', '#a47148', '#bc8a5f', '#6f4518', '#d4a276', '#603808', '#e7bc91', '#7f5539'],
    }),
    R('midnight', 'Midnight', true, {
      bg: '#0f172a', ink: 'rgba(148,163,184,0.12)',
      root: { fill: '#6366f1', color: '#ffffff', border: '#6366f1' },
      main: { fill: '#1e293b', color: '#e2e8f0', border: '#334155' },
      sub: { fill: '#0f172a', color: '#cbd5e1', border: '#334155' },
      line: '#64748b', rainbow: true,
      branches: ['#818cf8', '#34d399', '#fbbf24', '#f87171', '#a78bfa', '#22d3ee', '#fb923c', '#f472b6'],
    }),
    R('neon', 'Neon Night', true, {
      bg: '#0b0b12', ink: 'rgba(0,255,200,0.08)',
      root: { fill: '#0b0b12', color: '#39ff14', border: '#39ff14' },
      main: { fill: '#0b0b12', color: '#ffffff', border: '#00e5ff' },
      sub: { fill: '#0b0b12', color: '#d0d0ff', border: '#3a3a5a' },
      line: '#00e5ff', rainbow: true,
      branches: ['#00e5ff', '#ff00e5', '#39ff14', '#ffe600', '#ff3b3b', '#9d4bff', '#00ffa3', '#ff8a00'],
    }),
    R('dracula', 'Vampire', true, {
      bg: '#21222c', ink: 'rgba(248,248,242,0.07)',
      root: { fill: '#bd93f9', color: '#21222c', border: '#bd93f9' },
      main: { fill: '#44475a', color: '#f8f8f2', border: '#6272a4' },
      sub: { fill: '#282a36', color: '#f8f8f2', border: '#44475a' },
      line: '#6272a4', rainbow: true,
      branches: ['#ff79c6', '#50fa7b', '#f1fa8c', '#8be9fd', '#ffb86c', '#ff5555', '#bd93f9', '#6272a4'],
    }),
    R('chalk', 'Chalkboard', true, {
      bg: '#26332b', ink: 'rgba(255,255,255,0.08)',
      root: { fill: '#26332b', color: '#ffffff', border: '#ffffff' },
      main: { fill: '#26332b', color: '#fdf6e3', border: '#e8e0c8' },
      sub: { fill: '#26332b', color: '#e8e0c8', border: '#7c8a80' },
      line: '#e8e0c8', rainbow: false,
      branches: ['#ffd6e0', '#c1f0c1', '#fff3b0', '#b8e0ff', '#e0c3fc', '#ffc9a8', '#a8f0e8', '#ffffff'],
    }),
  ];

  const LAYOUTS = [
    { id: 'mindmap', name: 'Mind Map (balanced)' },
    { id: 'right', name: 'Logic Chart → Right' },
    { id: 'left', name: 'Logic Chart ← Left' },
    { id: 'down', name: 'Org Chart ↓ Down' },
    { id: 'up', name: 'Org Chart ↑ Up' },
    { id: 'tree', name: 'Tree / Outline' },
    { id: 'timeline', name: 'Timeline' },
    { id: 'fishbone', name: 'Fishbone' },
    { id: 'radial', name: 'Radial' },
  ];

  const LINE_STYLES = [
    { id: 'curve', name: 'Curved' },
    { id: 'tapered', name: 'Tapered branch' },
    { id: 'straight', name: 'Straight' },
    { id: 'elbow', name: 'Elbow' },
    { id: 'rounded', name: 'Rounded elbow' },
  ];

  const SHAPES = [
    { id: 'rounded', name: 'Rounded' },
    { id: 'rect', name: 'Rectangle' },
    { id: 'pill', name: 'Capsule' },
    { id: 'ellipse', name: 'Ellipse' },
    { id: 'circle', name: 'Circle' },
    { id: 'underline', name: 'Underline' },
    { id: 'diamond', name: 'Diamond' },
    { id: 'hexagon', name: 'Hexagon' },
    { id: 'parallelogram', name: 'Parallelogram' },
    { id: 'cloud', name: 'Cloud' },
    { id: 'none', name: 'Text only' },
  ];

  const PATTERNS = [
    { id: 'none', name: 'Plain' },
    { id: 'dots', name: 'Dots' },
    { id: 'grid', name: 'Grid' },
    { id: 'graph', name: 'Graph paper' },
    { id: 'lines', name: 'Ruled lines' },
    { id: 'cross', name: 'Crosses' },
    { id: 'diagonal', name: 'Diagonal' },
    { id: 'isometric', name: 'Isometric dots' },
  ];

  const FONTS = [
    { id: 'system', name: 'System', css: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif" },
    { id: 'rounded', name: 'Rounded', css: "ui-rounded, 'SF Pro Rounded', 'Arial Rounded MT Bold', 'Segoe UI', sans-serif" },
    { id: 'serif', name: 'Serif', css: "Georgia, 'Times New Roman', 'Noto Serif', serif" },
    { id: 'mono', name: 'Monospace', css: "ui-monospace, 'SF Mono', Menlo, Consolas, 'Courier New', monospace" },
    { id: 'hand', name: 'Handwriting', css: "'Bradley Hand', 'Segoe Print', 'Comic Sans MS', 'Chalkboard SE', cursive" },
    { id: 'condensed', name: 'Condensed', css: "'Avenir Next Condensed', 'Arial Narrow', 'Roboto Condensed', sans-serif" },
  ];

  // Map style presets = structure + line + shapes in one click.
  const MAP_STYLES = [
    { id: 'classic', name: 'Classic', layout: 'mindmap', lineStyle: 'curve', shapes: { root: 'rounded', main: 'rounded', sub: 'rounded' } },
    { id: 'organic', name: 'Organic', layout: 'mindmap', lineStyle: 'tapered', shapes: { root: 'ellipse', main: 'pill', sub: 'underline' } },
    { id: 'clean', name: 'Clean Logic', layout: 'right', lineStyle: 'rounded', shapes: { root: 'rounded', main: 'rect', sub: 'underline' } },
    { id: 'org', name: 'Org Chart', layout: 'down', lineStyle: 'elbow', shapes: { root: 'rect', main: 'rect', sub: 'rect' } },
    { id: 'bubbles', name: 'Bubbles', layout: 'radial', lineStyle: 'straight', shapes: { root: 'circle', main: 'ellipse', sub: 'pill' } },
    { id: 'outline', name: 'Outline', layout: 'tree', lineStyle: 'rounded', shapes: { root: 'rounded', main: 'none', sub: 'none' } },
    { id: 'timeline', name: 'Timeline', layout: 'timeline', lineStyle: 'rounded', shapes: { root: 'pill', main: 'pill', sub: 'underline' } },
    { id: 'fishbone', name: 'Fishbone', layout: 'fishbone', lineStyle: 'straight', shapes: { root: 'rounded', main: 'rounded', sub: 'underline' } },
    { id: 'sketch', name: 'Whiteboard', layout: 'mindmap', lineStyle: 'curve', shapes: { root: 'cloud', main: 'hexagon', sub: 'underline' }, font: 'hand' },
  ];

  // Markers: priority, progress, flags, stars, plus emoji stickers.
  const MARKER_GROUPS = [
    { name: 'Priority', items: ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'] },
    { name: 'Progress', items: ['pr0', 'pr25', 'pr50', 'pr75', 'pr100'] },
    { name: 'Flags', items: ['flag-red', 'flag-orange', 'flag-green', 'flag-blue', 'flag-purple'] },
    { name: 'Stars', items: ['star-yellow', 'star-red', 'star-blue', 'star-green'] },
    { name: 'Symbols', items: ['✅', '❌', '❓', '❗', '💡', '⭐', '🔥', '🎯', '📌', '📅', '💰', '⚠️', '👍', '👎', '🚀', '❤️', '🏆', '🔒', '📈', '🧠', '⏰', '📎', '🐞', '✏️'] },
  ];
  const PRIORITY_COLORS = ['#e03131', '#f76707', '#f59f00', '#2f9e44', '#1c7ed6', '#7048e8'];
  const FLAG_COLORS = { red: '#e03131', orange: '#f76707', green: '#2f9e44', blue: '#1c7ed6', purple: '#7048e8' };
  const STAR_COLORS = { yellow: '#f59f00', red: '#e03131', blue: '#1c7ed6', green: '#2f9e44' };
  const markerGroupOf = (m) => (/^p\d$/.test(m) ? 'p' : /^pr\d+$/.test(m) ? 'pr' : m.startsWith('flag-') ? 'flag' : m.startsWith('star-') ? 'star' : 'emoji:' + m);

  const SWATCHES = ['#ffffff', '#f1f3f5', '#ced4da', '#495057', '#000000', '#ffe3e3', '#ff8787', '#e03131',
    '#fff4e6', '#ffa94d', '#f76707', '#fff9db', '#ffd43b', '#f59f00', '#ebfbee', '#69db7c', '#2f9e44',
    '#e3fafc', '#3bc9db', '#0c8599', '#e7f5ff', '#4dabf7', '#1c7ed6', '#f3f0ff', '#9775fa', '#6741d9',
    '#fff0f6', '#f783ac', '#c2255c', 'transparent'];

  const DEFAULT_SETTINGS = {
    theme: 'fresh', layout: 'mindmap', lineStyle: 'curve', pattern: 'dots', font: 'system',
    shapes: { root: 'rounded', main: 'rounded', sub: 'rounded' },
    rainbow: null, // null = theme default
    hGap: 56, vGap: 14, lineWidth: 2, maxWidth: 260, fontScale: 1,
  };

  function getTheme(id) { return THEMES.find((t) => t.id === id) || THEMES[0]; }
  function getFont(id) { return (FONTS.find((f) => f.id === id) || FONTS[0]).css; }

  // Relative luminance → readable text colour on a fill.
  function hexToRgb(hex) {
    if (!hex || hex[0] !== '#') return null;
    let h = hex.slice(1);
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    const n = parseInt(h.slice(0, 6), 16);
    if (Number.isNaN(n)) return null;
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function luminance(hex) {
    const rgb = hexToRgb(hex);
    if (!rgb) return 1;
    const [r, g, b] = rgb.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }
  function contrastText(hex, dark = '#1a1a1a', light = '#ffffff') { return luminance(hex) > 0.42 ? dark : light; }

  /**
   * Resolve the visual style of a node.
   * depth 0 = root/floating root, 1 = main topic, 2+ = sub topic.
   */
  function resolveStyle(node, depth, branchIdx, theme, settings, isFloating) {
    const cd = isFloating ? depth + 1 : depth; // a floating topic is styled like a main topic
    const lvl = cd === 0 ? 'root' : cd === 1 ? 'main' : 'sub';
    const base = theme[lvl];
    const rainbow = settings.rainbow == null ? theme.rainbow : settings.rainbow;
    const bcol = theme.branches[(branchIdx < 0 ? 0 : branchIdx) % theme.branches.length];
    let fill = base.fill, color = base.color, border = base.border, line = theme.line;
    if (rainbow && cd >= 1) {
      line = bcol;
      if (cd === 1) {
        if (theme.id === 'neon' || theme.id === 'chalk') { border = bcol; color = bcol; }
        else { fill = bcol; border = bcol; color = contrastText(bcol); }
      } else border = bcol;
    } else if (!rainbow && cd === 1 && base.fill === base.color) {
      // themes whose main topics rely on rainbow colours need a fallback when rainbow is off
      fill = theme.dark ? '#1f2937' : '#f3f4f6'; color = theme.dark ? '#f9fafb' : '#111827'; border = theme.line;
    }
    const st = node.style || {};
    const fs = Math.round((cd === 0 ? 24 : cd === 1 ? 17 : 14) * (settings.fontScale || 1));
    const shape = st.shape || (settings.shapes && settings.shapes[lvl]) || 'rounded';
    if (st.fill && !st.color && st.fill !== 'transparent') color = contrastText(st.fill);
    return {
      level: lvl,
      fill: st.fill || fill, color: st.color || color, border: st.border || border,
      borderWidth: st.borderWidth != null ? st.borderWidth : (depth === 0 && !isFloating ? 0 : theme.dark ? 1.5 : 1.2),
      borderDash: st.borderDash || 'solid',
      line: st.lineColor || line,
      shape,
      fontSize: st.fontSize || fs,
      bold: st.bold != null ? st.bold : cd <= 1,
      italic: !!st.italic, underline: !!st.underline, strike: !!st.strike,
      align: st.align || 'center',
      font: getFont(st.font || settings.font),
    };
  }

  ML.themes = {
    THEMES, LAYOUTS, LINE_STYLES, SHAPES, PATTERNS, FONTS, MAP_STYLES, MARKER_GROUPS, SWATCHES,
    PRIORITY_COLORS, FLAG_COLORS, STAR_COLORS, DEFAULT_SETTINGS,
    getTheme, getFont, resolveStyle, contrastText, luminance, markerGroupOf,
  };
})(typeof module !== 'undefined' && module.exports ? (global.ML = global.ML || {}) : (window.ML = window.ML || {}));

/* ---- mindloom/src/renderer/core/model.js ---- */
/* Mindloom — document model: tree operations, search, undo history (pure) */
(function (ML) {
  'use strict';

  let counter = 0;
  function uid() {
    counter = (counter + 1) % 1e6;
    return 'n' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7) + counter.toString(36);
  }

  function createNode(text, extra) {
    return Object.assign({ id: uid(), text: text == null ? '' : String(text), children: [] }, extra || {});
  }

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function createDoc(title) {
    const T = ML.themes;
    return {
      app: 'mindloom', version: 1,
      root: createNode(title || 'Central Topic'),
      floating: [],
      relations: [],
      settings: clone(T.DEFAULT_SETTINGS),
    };
  }

  const COLOR = /^(#[0-9a-f]{3,8}|transparent|rgba?\([\d\s.,%]+\))$/i;
  const num = (v, lo, hi) => { v = +v; return Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : null; };
  const oneOf = (v, list) => (list.includes(v) ? v : null);
  const drop = (o, k, v) => { if (v == null) delete o[k]; else o[k] = v; };

  /** Keep only well-formed values on a node, so a damaged or hostile file cannot break rendering. */
  function cleanNode(n) {
    const T = ML.themes;
    if (n.style && typeof n.style === 'object') {
      const st = n.style;
      for (const k of ['fill', 'color', 'border', 'lineColor']) if (st[k] != null && !COLOR.test(String(st[k]))) delete st[k];
      if (st.fontSize != null) drop(st, 'fontSize', num(st.fontSize, 6, 200));
      if (st.width != null) drop(st, 'width', num(st.width, 40, 2000));
      if (st.borderWidth != null) drop(st, 'borderWidth', num(st.borderWidth, 0, 20));
      if (st.shape != null) drop(st, 'shape', oneOf(st.shape, T.SHAPES.map((x) => x.id)));
      if (st.font != null) drop(st, 'font', oneOf(st.font, T.FONTS.map((x) => x.id)));
      if (st.align != null) drop(st, 'align', oneOf(st.align, ['left', 'center', 'right']));
      if (st.borderDash != null) drop(st, 'borderDash', oneOf(st.borderDash, ['dashed', 'dotted']));
      if (!Object.keys(st).length) delete n.style;
    } else delete n.style;
    if (n.offset) {
      const x = num(n.offset.x, -1e5, 1e5), y = num(n.offset.y, -1e5, 1e5);
      if (x == null || y == null || typeof n.offset.l !== 'string') delete n.offset; else n.offset = { x, y, l: n.offset.l };
    }
    if (n.icons != null) { n.icons = Array.isArray(n.icons) ? n.icons.filter((m) => typeof m === 'string' && m.length <= 24).slice(0, 12) : []; if (!n.icons.length) delete n.icons; }
    if (n.tags != null) { n.tags = Array.isArray(n.tags) ? n.tags.map(String).filter(Boolean).slice(0, 20) : []; if (!n.tags.length) delete n.tags; }
    for (const k of ['note', 'link', 'boundaryLabel']) if (n[k] != null) { n[k] = String(n[k]); if (!n[k]) delete n[k]; }
    if (n.image != null) {
      const im = n.image, w = im && num(im.w, 8, 4000), h = im && num(im.h, 8, 4000);
      if (!im || typeof im.src !== 'string' || !/^data:image\//.test(im.src) || w == null || h == null) delete n.image; else n.image = { src: im.src, w, h };
    }
    if (n.side != null) drop(n, 'side', oneOf(n.side, ['left', 'right']));
    if (n.task != null) drop(n, 'task', oneOf(n.task, ['todo', 'done']));
    for (const k of ['collapsed', 'boundary']) if (n[k] != null) { if (n[k]) n[k] = true; else delete n[k]; }
  }

  function cleanSettings(s) {
    const T = ML.themes, D = T.DEFAULT_SETTINGS;
    s.theme = oneOf(s.theme, T.THEMES.map((x) => x.id)) || D.theme;
    s.layout = oneOf(s.layout, T.LAYOUTS.map((x) => x.id)) || D.layout;
    s.lineStyle = oneOf(s.lineStyle, T.LINE_STYLES.map((x) => x.id)) || D.lineStyle;
    s.pattern = oneOf(s.pattern, T.PATTERNS.map((x) => x.id)) || D.pattern;
    s.font = oneOf(s.font, T.FONTS.map((x) => x.id)) || D.font;
    const shapes = T.SHAPES.map((x) => x.id);
    for (const k of ['root', 'main', 'sub']) s.shapes[k] = oneOf(s.shapes[k], shapes) || D.shapes[k];
    s.rainbow = s.rainbow == null ? null : !!s.rainbow;
    const lim = { hGap: [10, 300], vGap: [0, 120], lineWidth: [0.5, 12], maxWidth: [60, 1200], fontScale: [0.4, 3] };
    for (const k of Object.keys(lim)) { const v = num(s[k], lim[k][0], lim[k][1]); s[k] = v == null ? D[k] : v; }
  }

  /** Fill in missing fields and repair duplicate/missing ids so any loaded file is safe to use. */
  function normalizeDoc(doc) {
    if (!doc || typeof doc !== 'object' || !doc.root) throw new Error('Not a Mindloom document');
    const T = ML.themes;
    doc.app = 'mindloom';
    doc.version = 1;
    doc.floating = Array.isArray(doc.floating) ? doc.floating : [];
    doc.relations = Array.isArray(doc.relations) ? doc.relations : [];
    doc.settings = Object.assign(clone(T.DEFAULT_SETTINGS), doc.settings || {});
    doc.settings.shapes = Object.assign(clone(T.DEFAULT_SETTINGS.shapes), (doc.settings && doc.settings.shapes) || {});
    cleanSettings(doc.settings);
    const seen = new Set();
    const fix = (n) => {
      if (!n.id || seen.has(n.id)) n.id = uid();
      seen.add(n.id);
      n.text = n.text == null ? '' : String(n.text);
      n.children = Array.isArray(n.children) ? n.children.filter((c) => c && typeof c === 'object') : [];
      cleanNode(n);
      n.children.forEach(fix);
    };
    fix(doc.root);
    doc.floating.forEach((f) => { fix(f); if (f.x == null && f.y == null) f._place = true; f.x = +f.x || 0; f.y = +f.y || 0; });
    doc.relations = doc.relations.filter((r) => r && seen.has(r.from) && seen.has(r.to));
    doc.relations.forEach((r) => {
      if (!r.id) r.id = uid();
      r.label = r.label == null ? '' : String(r.label);
      if (r.color != null && !COLOR.test(String(r.color))) delete r.color;
      if (r.bend != null) drop(r, 'bend', num(r.bend, -2000, 2000));
    });
    return doc;
  }

  function trees(doc) { return [doc.root].concat(doc.floating); }

  function walk(node, fn, parent = null, depth = 0, index = 0) {
    if (fn(node, parent, depth, index) === false) return false;
    for (let i = 0; i < node.children.length; i++) {
      if (walk(node.children[i], fn, node, depth + 1, i) === false) return false;
    }
    return true;
  }

  function walkDoc(doc, fn) {
    for (const t of trees(doc)) if (walk(t, fn) === false) return;
  }

  /** Locate a node. Returns {node, parent, list, index, depth, tree, floating} or null. */
  function find(doc, id) {
    let res = null;
    for (const t of trees(doc)) {
      walk(t, (n, p, d, i) => {
        if (n.id === id) {
          const floating = t !== doc.root;
          res = { node: n, parent: p, depth: d, tree: t, floating, index: p ? i : floating ? doc.floating.indexOf(n) : 0, list: p ? p.children : floating ? doc.floating : null };
          return false;
        }
      });
      if (res) break;
    }
    return res;
  }

  function getNode(doc, id) { const f = find(doc, id); return f ? f.node : null; }

  function pathTo(doc, id) {
    for (const t of trees(doc)) {
      const path = [];
      const rec = (n) => {
        path.push(n);
        if (n.id === id) return true;
        for (const c of n.children) if (rec(c)) return true;
        path.pop();
        return false;
      };
      if (rec(t)) return path;
    }
    return [];
  }

  function isAncestor(doc, ancestorId, id) {
    return pathTo(doc, id).slice(0, -1).some((n) => n.id === ancestorId);
  }

  function addChild(doc, parentId, text, index) {
    const p = getNode(doc, parentId);
    if (!p) return null;
    const n = createNode(text == null ? '' : text);
    if (index == null || index < 0 || index > p.children.length) p.children.push(n);
    else p.children.splice(index, 0, n);
    p.collapsed = false;
    return n;
  }

  function addSibling(doc, id, text, before) {
    const f = find(doc, id);
    if (!f) return null;
    if (!f.parent) {
      if (f.floating) {
        const n = createNode(text == null ? '' : text, { x: f.node.x, y: f.node.y + 80 });
        doc.floating.push(n);
        return n;
      }
      return addChild(doc, id, text); // root has no siblings
    }
    const n = createNode(text == null ? '' : text);
    f.list.splice(before ? f.index : f.index + 1, 0, n);
    return n;
  }

  function addParent(doc, id, text) {
    const f = find(doc, id);
    if (!f || !f.parent) return null;
    const n = createNode(text == null ? '' : text);
    f.list.splice(f.index, 1, n);
    n.children.push(f.node);
    if (f.node.side) { n.side = f.node.side; delete f.node.side; }
    if (f.node.offset) { n.offset = f.node.offset; delete f.node.offset; }
    return n;
  }

  function collectIds(node, out = new Set()) { walk(node, (n) => { out.add(n.id); }); return out; }

  /** Remove nodes (never the main root). Returns id of a sensible node to select afterwards. */
  function remove(doc, ids) {
    let next = null;
    const removed = new Set();
    for (const id of ids) {
      const f = find(doc, id);
      if (!f || (!f.parent && !f.floating)) continue;
      if (f.parent) {
        next = (f.list[f.index + 1] || f.list[f.index - 1] || f.parent).id;
        f.list.splice(f.index, 1);
      } else {
        doc.floating.splice(f.index, 1);
        next = doc.root.id;
      }
      collectIds(f.node, removed);
    }
    if (removed.size) doc.relations = doc.relations.filter((r) => !removed.has(r.from) && !removed.has(r.to));
    if (next && removed.has(next)) next = doc.root.id;
    return next;
  }

  /** Move node under newParent at index. Refuses cycles. */
  function move(doc, id, newParentId, index) {
    if (id === newParentId || id === doc.root.id) return false;
    if (isAncestor(doc, id, newParentId)) return false;
    const f = find(doc, id);
    const np = getNode(doc, newParentId);
    if (!f || !np) return false;
    if (f.parent) f.list.splice(f.index, 1);
    else if (f.floating) { doc.floating.splice(f.index, 1); delete f.node.x; delete f.node.y; }
    else return false;
    delete f.node.offset;
    if (index == null || index < 0 || index > np.children.length) np.children.push(f.node);
    else np.children.splice(index, 0, f.node);
    np.collapsed = false;
    return true;
  }

  function detach(doc, id, x, y) {
    const f = find(doc, id);
    if (!f || !f.parent) return false;
    f.list.splice(f.index, 1);
    f.node.x = x; f.node.y = y;
    delete f.node.side;
    delete f.node.offset;
    doc.floating.push(f.node);
    return true;
  }

  function reorder(doc, id, delta) {
    const f = find(doc, id);
    if (!f || !f.parent) return false;
    const j = f.index + delta;
    if (j < 0 || j >= f.list.length) return false;
    f.list.splice(f.index, 1);
    f.list.splice(j, 0, f.node);
    return true;
  }

  /** Make a node a child of its previous sibling (outline "indent"). */
  function indent(doc, id) {
    const f = find(doc, id);
    if (!f || !f.parent || f.index === 0) return false;
    const prev = f.list[f.index - 1];
    f.list.splice(f.index, 1);
    delete f.node.offset;
    prev.children.push(f.node);
    prev.collapsed = false;
    return true;
  }

  /** Move a node up one level, right after its parent (outline "outdent"). */
  function outdent(doc, id) {
    const path = pathTo(doc, id);
    if (path.length < 3) return false;
    const node = path[path.length - 1], parent = path[path.length - 2], grand = path[path.length - 3];
    parent.children.splice(parent.children.indexOf(node), 1);
    delete node.offset;
    grand.children.splice(grand.children.indexOf(parent) + 1, 0, node);
    return true;
  }

  function cloneWithNewIds(node) {
    const c = clone(node);
    walk(c, (n) => { n.id = uid(); });
    return c;
  }

  function duplicate(doc, id) {
    const f = find(doc, id);
    if (!f || !f.parent) return null;
    const c = cloneWithNewIds(f.node);
    f.list.splice(f.index + 1, 0, c);
    return c;
  }

  function insertSubtree(doc, parentId, subtree, index) {
    const p = getNode(doc, parentId);
    if (!p) return null;
    const c = cloneWithNewIds(subtree);
    delete c.x; delete c.y; delete c.offset; delete c.side;
    if (index == null) p.children.push(c); else p.children.splice(index, 0, c);
    p.collapsed = false;
    return c;
  }

  function expandTo(doc, id) {
    const path = pathTo(doc, id);
    path.slice(0, -1).forEach((n) => { n.collapsed = false; });
  }

  function setCollapsed(doc, id, value) {
    const n = getNode(doc, id);
    if (!n || !n.children.length) return false;
    n.collapsed = value == null ? !n.collapsed : !!value;
    return true;
  }

  function collapseToLevel(doc, level) {
    walk(doc.root, (n, p, d) => { if (n.children.length) n.collapsed = d >= level; });
  }

  function plainText(n) {
    return [n.text, n.note || '', (n.tags || []).join(' '), n.link || ''].join(' ').toLowerCase();
  }

  function search(doc, query) {
    const q = (query || '').trim().toLowerCase();
    if (!q) return [];
    const out = [];
    walkDoc(doc, (n) => { if (plainText(n).includes(q)) out.push(n.id); });
    return out;
  }

  function stats(doc) {
    let nodes = 0, words = 0, done = 0, tasks = 0;
    walkDoc(doc, (n) => {
      nodes++;
      words += (n.text.match(/\S+/g) || []).length;
      if (n.task) { tasks++; if (n.task === 'done') done++; }
    });
    return { nodes, words, tasks, done };
  }

  function toggleMarker(node, marker) {
    const group = ML.themes.markerGroupOf(marker);
    node.icons = node.icons || [];
    const had = node.icons.includes(marker);
    node.icons = node.icons.filter((m) => ML.themes.markerGroupOf(m) !== group);
    if (!had) node.icons.push(marker);
    if (!node.icons.length) delete node.icons;
  }

  function addRelation(doc, from, to, label) {
    if (from === to || !getNode(doc, from) || !getNode(doc, to)) return null;
    const r = { id: uid(), from, to, label: label || '' };
    doc.relations.push(r);
    return r;
  }

  /** Snapshot-based undo history. */
  class History {
    constructor(limit = 300, maxChars = 80e6) { this.limit = limit; this.maxChars = maxChars; this.stack = []; this.idx = -1; }
    reset(snapshot) { this.stack = [snapshot]; this.idx = 0; }
    push(snapshot) {
      if (this.stack[this.idx] === snapshot) return false;
      this.stack = this.stack.slice(0, this.idx + 1);
      this.stack.push(snapshot);
      // maps with embedded images make big snapshots: cap total memory, always keeping the last two steps
      let total = 0;
      for (const x of this.stack) total += x.length;
      while (this.stack.length > 2 && (this.stack.length > this.limit || total > this.maxChars)) total -= this.stack.shift().length;
      this.idx = this.stack.length - 1;
      return true;
    }
    canUndo() { return this.idx > 0; }
    canRedo() { return this.idx < this.stack.length - 1; }
    undo() { return this.canUndo() ? this.stack[--this.idx] : null; }
    redo() { return this.canRedo() ? this.stack[++this.idx] : null; }
  }

  ML.model = {
    uid, createNode, createDoc, normalizeDoc, clone, trees, walk, walkDoc, find, getNode, pathTo, isAncestor,
    addChild, addSibling, addParent, remove, move, detach, reorder, indent, outdent, duplicate, insertSubtree, cleanNode,
    cloneWithNewIds, expandTo, setCollapsed, collapseToLevel, search, stats, toggleMarker, addRelation, History,
  };
})(typeof module !== 'undefined' && module.exports ? (global.ML = global.ML || {}) : (window.ML = window.ML || {}));

/* ---- mindloom/src/renderer/core/layout.js ---- */
/* Mindloom — measuring + layout algorithms + connector paths (pure; text measuring is injected) */
(function (ML) {
  'use strict';

  const r1 = (v) => Math.round(v * 10) / 10;

  // ---------- text wrapping ----------
  function wrapText(text, font, maxW, measure) {
    const out = [];
    const paras = String(text).split('\n');
    for (const para of paras) {
      if (!para.length) { out.push(''); continue; }
      const words = para.split(/(\s+)/);
      let line = '';
      for (const w of words) {
        const cand = line + w;
        if (measure(cand, font) <= maxW || !line.trim()) {
          // a single word longer than maxW gets broken by characters
          if (!line.trim() && measure(cand, font) > maxW && w.trim()) {
            let chunk = line;
            for (const ch of w) {
              if (measure(chunk + ch, font) > maxW && chunk) { out.push(chunk); chunk = ch; } else chunk += ch;
            }
            line = chunk;
          } else line = cand;
        } else {
          out.push(line.replace(/\s+$/, ''));
          line = w.replace(/^\s+/, '');
        }
      }
      out.push(line.replace(/\s+$/, ''));
    }
    return out.length ? out : [''];
  }

  // ---------- node measuring ----------
  function fontString(st) {
    return `${st.italic ? 'italic ' : ''}${st.bold ? 700 : 400} ${st.fontSize}px ${st.font}`;
  }

  function measureNode(node, depth, branch, ctx, isFloating) {
    const T = ML.themes;
    const st = T.resolveStyle(node, depth, branch, ctx.theme, ctx.settings, isFloating);
    const fs = st.fontSize;
    const font = fontString(st);
    const lh = Math.round(fs * 1.32);
    const maxW = (node.style && node.style.width) || (depth === 0 ? ctx.settings.maxWidth + 80 : ctx.settings.maxWidth);
    const text = node.text && node.text.length ? node.text : ' ';
    const lines = wrapText(text, font, maxW, ctx.measure);
    let textW = 0;
    for (const l of lines) textW = Math.max(textW, ctx.measure(l, font));
    textW = Math.max(textW, node.text ? 0 : fs * 3);
    const textH = lines.length * lh;

    const iconSize = Math.round(fs * 1.15);
    const lead = [];
    if (node.task) lead.push({ kind: 'task', val: node.task });
    for (const m of node.icons || []) lead.push({ kind: 'marker', val: m });
    const trail = [];
    if (node.link) trail.push({ kind: 'link', val: node.link });
    if (node.note) trail.push({ kind: 'note', val: node.note });
    if (node.collapsed && node.children.length && ctx.settings.layout === 'tree') { /* badge handled separately */ }
    const iconGap = 5;
    const leadW = lead.length ? lead.length * (iconSize + iconGap) : 0;
    const trailW = trail.length ? trail.length * (iconSize + iconGap) : 0;
    const rowW = leadW + textW + trailW;
    const rowH = Math.max(textH, lead.length || trail.length ? iconSize : 0);

    const tagFont = `600 11px ${st.font}`;
    const tags = (node.tags || []).map((t) => ({ text: t, w: Math.ceil(ctx.measure(t, tagFont)) + 14 }));
    const tagsW = tags.reduce((s, t) => s + t.w + 4, 0) - (tags.length ? 4 : 0);
    const tagsH = tags.length ? 18 : 0;

    let img = null;
    if (node.image && node.image.src) {
      const iw0 = node.image.w || 160, ih0 = node.image.h || 120;
      const iw = Math.min(iw0, maxW);
      img = { w: iw, h: (ih0 * iw) / iw0 };
    }
    const contentW = Math.max(rowW, tagsW, img ? img.w : 0);
    const contentH = (img ? img.h + 8 : 0) + rowH + (tags.length ? tagsH + 6 : 0);

    let padX = Math.round(fs * 0.85), padY = Math.round(fs * 0.5);
    if (depth === 0 && !isFloating) { padX = Math.round(fs * 1.0); padY = Math.round(fs * 0.62); }
    if (st.shape === 'underline') { padX = 6; padY = 5; }
    if (st.shape === 'none') { padX = 4; padY = 3; }
    let w = contentW + padX * 2, h = contentH + padY * 2;
    switch (st.shape) {
      case 'ellipse': w = w * 1.22 + 6; h = h * 1.32 + 4; break;
      case 'circle': { const d = Math.max(w, h) * 1.08 + 8; w = d; h = d; break; }
      case 'diamond': w = w * 1.5 + 8; h = h * 1.7 + 6; break;
      case 'hexagon': w = w + h * 0.7; break;
      case 'parallelogram': w = w + h * 0.6; break;
      case 'cloud': w = w * 1.25 + 14; h = h * 1.45 + 10; break;
      case 'pill': w = w + h * 0.35; break;
      default: break;
    }
    w = Math.ceil(Math.max(w, depth === 0 ? 80 : 36));
    h = Math.ceil(h);
    const cx = (w - contentW) / 2, cy = (h - contentH) / 2;
    const rowY = cy + (img ? img.h + 8 : 0);
    return {
      w, h, style: st, font, lines, lh, fs, iconSize, iconGap, lead, trail, tags, tagsH, img,
      content: { x: cx, y: cy, w: contentW, h: contentH },
      row: { x: cx + (contentW - rowW) / 2, y: rowY, w: rowW, h: rowH, textX: leadW, textW, textH },
      tagsY: rowY + rowH + 6, tagsX: cx + (contentW - tagsW) / 2,
      imgPos: img ? { x: cx + (contentW - img.w) / 2, y: cy } : null,
    };
  }

  // ---------- visual tree ----------
  function buildVT(node, depth, branch, ctx, isFloating, parent) {
    const box = measureNode(node, depth, branch, ctx, isFloating);
    const t = { id: node.id, node, depth, branch, box, w: box.w, h: box.h, x: 0, y: 0, parent, floating: isFloating, children: [] };
    if (!node.collapsed) {
      node.children.forEach((c, i) => {
        const b = depth === 0 ? (isFloating ? branch : i) : branch;
        t.children.push(buildVT(c, depth + 1, b, ctx, isFloating, t));
      });
    }
    return t;
  }

  // ---------- horizontal logic tree ----------
  function sizeH(t, s) {
    const gap = t.depth === 0 ? s.vGap * 1.8 : s.vGap;
    if (!t.children.length) return (t.sh = t.h);
    let sum = 0;
    for (const c of t.children) sum += sizeH(c, s);
    sum += gap * (t.children.length - 1);
    return (t.sh = Math.max(t.h, sum));
  }
  function placeH(t, x, cy, dir, s) {
    t.x = dir > 0 ? x : x - t.w;
    t.y = cy - t.h / 2;
    t.dir = dir > 0 ? 'r' : 'l';
    if (!t.children.length) return;
    const gap = t.depth === 0 ? s.vGap * 1.8 : s.vGap;
    const hg = t.depth === 0 ? s.hGap * 1.25 : s.hGap;
    const childX = dir > 0 ? t.x + t.w + hg : t.x - hg;
    let total = -gap;
    for (const c of t.children) total += c.sh + gap;
    let y = cy - total / 2;
    for (const c of t.children) {
      placeH(c, childX, y + c.sh / 2, dir, s);
      y += c.sh + gap;
    }
  }

  // ---------- vertical org chart ----------
  // Inner levels spread horizontally; a group of leaves is stacked under its parent so wide maps stay readable.
  const stackIndent = (s) => Math.max(22, Math.min(40, s.hGap * 0.5));
  const stackGap = (s) => Math.max(6, s.vGap * 0.6);
  function isLeafGroup(t) { return t.depth >= 1 && t.children.length > 0 && t.children.every((c) => !c.children.length); }
  function sizeV(t, s) {
    const gap = Math.max(14, s.vGap + 8);
    if (!t.children.length) return (t.sw = t.w);
    if (isLeafGroup(t)) {
      let m = t.w;
      for (const c of t.children) m = Math.max(m, stackIndent(s) + c.w);
      return (t.sw = m);
    }
    let sum = 0;
    for (const c of t.children) sum += sizeV(c, s);
    sum += gap * (t.children.length - 1);
    return (t.sw = Math.max(t.w, sum));
  }
  function placeV(t, cx, y, dir, s) {
    if (isLeafGroup(t)) {
      const left = cx - t.sw / 2, g = stackGap(s);
      t.x = left;
      t.y = dir > 0 ? y : y - t.h;
      t.dir = dir > 0 ? 'tree' : 'tree-up';
      let cy = dir > 0 ? t.y + t.h + g : t.y - g;
      for (const c of t.children) {
        c.x = left + stackIndent(s);
        c.y = dir > 0 ? cy : cy - c.h;
        c.dir = t.dir;
        cy = dir > 0 ? c.y + c.h + g : c.y - g;
      }
      return;
    }
    t.x = cx - t.w / 2;
    t.y = dir > 0 ? y : y - t.h;
    t.dir = dir > 0 ? 'd' : 'u';
    if (!t.children.length) return;
    const gap = Math.max(14, s.vGap + 8);
    const lg = Math.max(36, s.hGap * 0.85);
    const childY = dir > 0 ? t.y + t.h + lg : t.y - lg;
    let total = -gap;
    for (const c of t.children) total += c.sw + gap;
    let x = cx - total / 2;
    for (const c of t.children) {
      placeV(c, x + c.sw / 2, childY, dir, s);
      x += c.sw + gap;
    }
  }

  // ---------- indented tree ----------
  function sizeT(t, s) {
    const gap = Math.max(8, s.vGap * 0.7);
    let hsum = t.h;
    for (const c of t.children) hsum += gap + sizeT(c, s);
    return (t.th = hsum);
  }
  function placeT(t, x, y, s) {
    t.x = x; t.y = y; t.dir = 'tree';
    const gap = Math.max(8, s.vGap * 0.7);
    const indent = Math.max(26, Math.min(48, s.hGap * 0.65));
    let cy = y + t.h + gap;
    for (const c of t.children) {
      placeT(c, x + indent, cy, s);
      cy += c.th + gap;
    }
  }
  function widthT(t) {
    let m = t.x + t.w;
    for (const c of t.children) m = Math.max(m, widthT(c));
    return m;
  }

  // ---------- radial ----------
  function leaves(t) { return t.children.length ? t.children.reduce((s, c) => s + leaves(c), 0) : 1; }
  function placeRadial(root, s) {
    root.x = -root.w / 2; root.y = -root.h / 2; root.dir = 'radial';
    const byDepth = [];
    const assign = (t, a0, a1) => {
      t.a = (a0 + a1) / 2; t.span = a1 - a0;
      (byDepth[t.depth] = byDepth[t.depth] || []).push(t);
      const total = leaves(t);
      let a = a0;
      for (const c of t.children) {
        const span = ((a1 - a0) * leaves(c)) / total;
        assign(c, a, a + span);
        a += span;
      }
    };
    assign(root, -Math.PI / 2, (Math.PI * 3) / 2);
    const radius = [0];
    const minGap = [0];
    for (let d = 1; d < byDepth.length; d++) {
      const prevHalf = Math.max(...byDepth[d - 1].map((t) => Math.hypot(t.w, t.h) / 2));
      const half = Math.max(...byDepth[d].map((t) => Math.hypot(t.w, t.h) / 2));
      minGap[d] = prevHalf + half + s.hGap * 0.6;
      let r = radius[d - 1] + minGap[d];
      for (const t of byDepth[d]) {
        // room a box needs along the ring: wide labels matter at the top/bottom, tall ones at the sides
        const along = Math.abs(t.w * Math.sin(t.a)) + Math.abs(t.h * Math.cos(t.a));
        const need = ((along + s.vGap) * 1.12) / Math.max(0.05, Math.min(t.span, Math.PI));
        r = Math.max(r, need);
      }
      radius[d] = r;
    }
    // keep rings evenly spread instead of crowding the centre when an outer ring had to grow
    for (let d = byDepth.length - 2; d >= 1; d--) {
      const even = radius[d + 1] * (d / (d + 1)) * 0.8;
      radius[d] = Math.max(radius[d], Math.min(even, radius[d + 1] - minGap[d + 1]));
    }
    for (let d = 1; d < byDepth.length; d++) {
      for (const t of byDepth[d]) {
        const cx = Math.cos(t.a) * radius[d], cy = Math.sin(t.a) * radius[d];
        t.x = cx - t.w / 2; t.y = cy - t.h / 2; t.dir = 'radial';
      }
    }
  }

  // ---------- timeline ----------
  function placeTimeline(root, s, extras) {
    root.x = 0; root.y = -root.h / 2; root.dir = 'r';
    let x = root.x + root.w + s.hGap;
    const gap = Math.max(8, s.vGap * 0.7);
    root.children.forEach((c, i) => {
      c.x = x; c.y = -c.h / 2; c.dir = i % 2 === 0 ? 'tree' : 'tree-up';
      let colW = c.w;
      if (c.children.length) {
        let total = 0;
        for (const g of c.children) total += sizeT(g, s) + gap;
        if (i % 2 === 0) {
          let y = c.y + c.h + gap + 6;
          for (const g of c.children) { placeT(g, x + 22, y, s); y += g.th + gap; colW = Math.max(colW, widthT(g) - x); }
        } else {
          let y = c.y - 6 - total;
          for (const g of c.children) { placeT(g, x + 22, y, s); y += g.th + gap; colW = Math.max(colW, widthT(g) - x); }
        }
      }
      x += colW + s.hGap * 0.8;
    });
    extras.push({ type: 'axis', x1: root.x + root.w, x2: x - s.hGap * 0.4, y: 0 });
  }

  // ---------- fishbone ----------
  function flattenRows(t, depth, out) {
    for (const c of t.children) { out.push({ t: c, d: depth }); flattenRows(c, depth + 1, out); }
    return out;
  }
  function placeFishbone(root, s, extras) {
    root.x = 0; root.y = -root.h / 2; root.dir = 'l';
    let sx = root.x - 40;
    const slope = 0.55;
    const kids = root.children;
    let pairW = 0;
    kids.forEach((c, i) => {
      const above = i % 2 === 0;
      const rows = flattenRows(c, 0, []);
      const rowGap = Math.max(6, s.vGap * 0.6);
      let rowsH = 0, maxRowW = 0;
      for (const r of rows) { rowsH += r.t.h + rowGap; maxRowW = Math.max(maxRowW, r.t.w + r.d * 22); }
      const L = Math.max(70, rowsH + 24);
      const topX = sx - slope * L;
      c.dir = above ? 'fish-up' : 'fish-down';
      c.x = topX - c.w / 2;
      c.y = above ? -L - c.h : L;
      c.bone = { x1: sx, y1: 0, x2: topX, y2: above ? -L : L };
      // rows hug the bone, nearest to the topic first
      let y = above ? -L + 12 : 12;
      for (const r of rows) {
        const cy = y + r.t.h / 2;
        const boneX = sx - slope * Math.abs(cy);
        r.t.x = boneX - 10 - r.d * 22 - r.t.w;
        r.t.y = y;
        r.t.dir = 'fish-row';
        r.t.boneX = boneX;
        y += r.t.h + rowGap;
      }
      const slotW = Math.max(c.w / 2 + slope * L, slope * L + maxRowW + 20) + 30;
      pairW = Math.max(pairW, slotW);
      if (!above || i === kids.length - 1) { sx -= pairW; pairW = 0; }
    });
    extras.push({ type: 'spine', x1: root.x, x2: Math.min(sx + 20, root.x - 60), y: 0 });
  }

  // ---------- manual positioning ----------
  // A topic the user dragged keeps its parent and its auto-layout slot; it is simply drawn at an offset,
  // and its whole branch moves with it. Offsets belong to the structure they were made in.
  // Smallest depth that may be hand-placed in each structure (timeline main topics sit on the axis,
  // fishbone bones are geometric, so those keep their slots).
  const FREE_MIN_DEPTH = { mindmap: 1, right: 1, left: 1, down: 1, up: 1, tree: 1, radial: 1, timeline: 2 };
  function canFreePosition(layoutId, depth) {
    const d = FREE_MIN_DEPTH[layoutId];
    return d != null && (depth == null || depth >= d);
  }
  function applyOffsets(t, key, ax, ay, ignoreId, minDepth) {
    const o = t.node.offset;
    if (o && o.l === key && t.depth >= minDepth && t.id !== ignoreId) { ax += o.x; ay += o.y; t.moved = true; }
    if (ax || ay) { t.x += ax; t.y += ay; }
    for (const c of t.children) applyOffsets(c, key, ax, ay, ignoreId, minDepth);
  }

  // ---------- main entry ----------
  /**
   * ctx = { theme, settings, measure(text, font) -> px, focusId? }
   * returns { nodes: Map(id -> t), list: [t], edges, boundaries, extras, bounds }
   */
  function layout(doc, ctx) {
    const s = ctx.settings;
    const M = ML.model;
    let mainRoot = doc.root;
    if (ctx.focusId) { const f = M.getNode(doc, ctx.focusId); if (f) mainRoot = f; }
    const extras = [];
    const root = buildVT(mainRoot, 0, -1, ctx, false, null);
    const lay = s.layout;
    if (lay === 'mindmap') {
      root.x = -root.w / 2; root.y = -root.h / 2; root.dir = 'both';
      root.children.forEach((c) => sizeH(c, s));
      // Main topics keep the side they were given, so adding or removing one never reshuffles the map.
      // Only topics without a side yet are balanced: a fresh map fills the right then the left (clockwise);
      // a topic added later goes to the lighter side.
      const right = [], left = [];
      const unsided = root.children.filter((c) => c.node.side !== 'left' && c.node.side !== 'right');
      const sideOf = new Map();
      if (unsided.length === root.children.length) {
        const total = root.children.reduce((a, c) => a + c.sh, 0);
        let acc = 0;
        root.children.forEach((c, i) => {
          const r = root.children.length === 1 || i === 0 || acc < total / 2;
          sideOf.set(c, r ? 'right' : 'left');
          if (r) acc += c.sh;
        });
      } else {
        let rh = 0, lh = 0;
        for (const c of root.children) { if (c.node.side === 'left') lh += c.sh; else if (c.node.side === 'right') rh += c.sh; }
        for (const c of unsided) { if (rh <= lh) { sideOf.set(c, 'right'); rh += c.sh; } else { sideOf.set(c, 'left'); lh += c.sh; } }
      }
      root.children.forEach((c) => { ((c.node.side || sideOf.get(c)) === 'left' ? left : right).push(c); });
      const gap = s.vGap * 1.8, hg = s.hGap * 1.25;
      const stack = (arr, dir) => {
        let tot = -gap;
        for (const c of arr) tot += c.sh + gap;
        let y = -tot / 2;
        for (const c of arr) {
          placeH(c, dir > 0 ? root.x + root.w + hg : root.x - hg, y + c.sh / 2, dir, s);
          c.side = dir > 0 ? 'right' : 'left';
          y += c.sh + gap;
        }
      };
      stack(right, 1);
      stack(left.reverse(), -1);
    } else if (lay === 'right' || lay === 'left') {
      sizeH(root, s);
      placeH(root, lay === 'right' ? 0 : 0, 0, lay === 'right' ? 1 : -1, s);
    } else if (lay === 'down' || lay === 'up') {
      sizeV(root, s);
      placeV(root, 0, 0, lay === 'down' ? 1 : -1, s);
    } else if (lay === 'tree') {
      sizeT(root, s);
      placeT(root, 0, 0, s);
    } else if (lay === 'radial') {
      placeRadial(root, s);
    } else if (lay === 'timeline') {
      placeTimeline(root, s, extras);
    } else if (lay === 'fishbone') {
      placeFishbone(root, s, extras);
    } else {
      sizeH(root, s); placeH(root, 0, 0, 1, s);
    }

    if (canFreePosition(lay)) applyOffsets(root, lay, 0, 0, ctx.ignoreOffsetId, FREE_MIN_DEPTH[lay]);

    const forest = [root];
    if (!ctx.focusId) {
      const offset = (doc.root.children.length || 1);
      doc.floating.forEach((f, i) => {
        const ft = buildVT(f, 0, offset + i, ctx, true, null);
        sizeH(ft, s);
        placeH(ft, f.x || 0, (f.y || 0) + ft.h / 2, 1, s);
        applyOffsets(ft, 'float', 0, 0, ctx.ignoreOffsetId, 1);
        forest.push(ft);
      });
    }

    const nodes = new Map();
    const list = [];
    const edges = [];
    const visit = (t) => {
      nodes.set(t.id, t);
      list.push(t);
      for (const c of t.children) {
        edges.push(makeEdge(t, c, s));
        visit(c);
      }
    };
    forest.forEach(visit);

    const boundaries = [];
    for (const t of list) {
      if (!t.node.boundary) continue;
      const b = subtreeBox(t);
      const pad = 12;
      boundaries.push({
        id: t.id, x: b.minX - pad, y: b.minY - pad - (t.node.boundaryLabel ? 22 : 0),
        w: b.maxX - b.minX + pad * 2, h: b.maxY - b.minY + pad * 2 + (t.node.boundaryLabel ? 22 : 0),
        label: t.node.boundaryLabel || '', color: t.box.style.line, depth: t.depth,
      });
    }

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const grow = (x, y, w, h) => { minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x + w); maxY = Math.max(maxY, y + h); };
    for (const t of list) grow(t.x, t.y, t.w + (t.node.collapsed && t.node.children.length ? 26 : 0), t.h + 4);
    for (const b of boundaries) grow(b.x, b.y, b.w, b.h);
    for (const e of extras) {
      if (e.type === 'spine' || e.type === 'axis') grow(Math.min(e.x1, e.x2), e.y - 2, Math.abs(e.x2 - e.x1), 4);
    }
    if (!list.length) { minX = minY = 0; maxX = maxY = 1; }
    return { root, forest, nodes, list, edges, boundaries, extras, bounds: { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY } };
  }

  function subtreeBox(t) {
    let minX = t.x, minY = t.y, maxX = t.x + t.w, maxY = t.y + t.h;
    const rec = (n) => {
      for (const c of n.children) {
        minX = Math.min(minX, c.x); minY = Math.min(minY, c.y);
        maxX = Math.max(maxX, c.x + c.w); maxY = Math.max(maxY, c.y + c.h);
        rec(c);
      }
    };
    rec(t);
    return { minX, minY, maxX, maxY };
  }

  // ---------- connectors ----------
  function anchorBottom(t) { return t.box.style.shape === 'underline'; }
  function clipToBox(t, px, py) {
    const cx = t.x + t.w / 2, cy = t.y + t.h / 2;
    const dx = px - cx, dy = py - cy;
    if (!dx && !dy) return { x: cx, y: cy };
    const sx = (t.w / 2) / Math.abs(dx || 1e-9), sy = (t.h / 2) / Math.abs(dy || 1e-9);
    const k = Math.min(sx, sy, 1);
    return { x: cx + dx * k, y: cy + dy * k };
  }

  function makeEdge(p, c, s) {
    const st = c.box.style;
    const width = s.lineWidth * (c.depth === 1 ? 1.4 : 1);
    const e = { from: p.id, to: c.id, color: st.line, width, depth: c.depth, orient: 'h' };
    const pcy = p.y + p.h / 2, ccy = c.y + c.h / 2;
    const dir = p.dir === 'both' ? (c.side === 'left' ? 'l' : 'r') : p.dir;
    if (c.moved) {
      // a hand-placed topic may sit anywhere; if it left its usual side, connect by the shortest clean route
      const stem = p.x + Math.min(18, p.w / 3);
      let ok = true;
      if (dir === 'r') ok = c.x > p.x + p.w + 6;
      else if (dir === 'l') ok = c.x + c.w < p.x - 6;
      else if (dir === 'd') ok = c.y > p.y + p.h + 6;
      else if (dir === 'u') ok = c.y + c.h < p.y - 6;
      else if (dir === 'tree') ok = c.x > stem + 4 && ccy > p.y + p.h + 2;
      else if (dir === 'tree-up') ok = c.x > stem + 4 && ccy < p.y - 2;
      if (!ok) {
        e.orient = 'free';
        e.p1 = clipToBox(p, c.x + c.w / 2, ccy);
        e.p2 = clipToBox(c, p.x + p.w / 2, pcy);
        return e;
      }
    }
    if (dir === 'r' || dir === 'l') {
      const right = dir === 'r';
      e.p1 = { x: right ? p.x + p.w : p.x, y: anchorBottom(p) && p.depth > 0 ? p.y + p.h : pcy };
      e.p2 = { x: right ? c.x : c.x + c.w, y: anchorBottom(c) ? c.y + c.h : ccy };
      if (p.depth === 0 && p.dir === 'both') e.p1.x = right ? p.x + p.w - Math.min(10, p.w / 4) : p.x + Math.min(10, p.w / 4);
    } else if (dir === 'd' || dir === 'u') {
      e.orient = 'v';
      e.p1 = { x: p.x + p.w / 2, y: dir === 'd' ? p.y + p.h : p.y };
      e.p2 = { x: c.x + c.w / 2, y: dir === 'd' ? c.y : c.y + c.h };
    } else if (dir === 'tree' || dir === 'tree-up') {
      e.orient = 'tree';
      e.p1 = { x: p.x + Math.min(18, p.w / 3), y: dir === 'tree' ? p.y + p.h : p.y };
      e.p2 = { x: c.x, y: anchorBottom(c) ? c.y + c.h : ccy };
    } else if (dir === 'fish-up' || dir === 'fish-down') {
      // rows of a fishbone attach to the bone itself
      e.orient = 'h';
      e.p1 = { x: c.boneX, y: anchorBottom(c) ? c.y + c.h : ccy };
      e.p2 = { x: c.x + c.w, y: e.p1.y };
      if (c.dir === 'fish-row' && c.parent && c.parent.dir === 'fish-row') {
        e.orient = 'tree';
        e.p1 = { x: p.x + p.w - 12, y: p.y + p.h };
        e.p2 = { x: c.x + c.w, y: anchorBottom(c) ? c.y + c.h : ccy };
      }
    } else if (dir === 'fish-row') {
      e.orient = 'tree';
      e.p1 = { x: p.x + p.w - 12, y: p.y + p.h };
      e.p2 = { x: c.x + c.w, y: anchorBottom(c) ? c.y + c.h : ccy };
    } else {
      e.orient = 'free';
      e.p1 = clipToBox(p, c.x + c.w / 2, ccy);
      e.p2 = clipToBox(c, p.x + p.w / 2, pcy);
    }
    // fishbone main bones + timeline axis children are drawn as straight segments
    if (c.bone) { e.orient = 'bone'; e.p1 = { x: c.bone.x1, y: c.bone.y1 }; e.p2 = { x: c.bone.x2, y: c.bone.y2 }; }
    if (p.depth === 0 && s.layout === 'timeline' && !p.floating) {
      e.orient = 'axisdot'; e.p1 = { x: c.x - 6, y: 0 }; e.p2 = { x: c.x, y: 0 };
    }
    return e;
  }

  function f(n) { return r1(n); }
  function corner(x1, y1, x2, y2, rx) { return `Q ${f(x1)} ${f(y1)} ${f(x2)} ${f(y2)}`; }

  /** Build an SVG path for an edge. Returns {d, filled}. */
  function edgePath(e, style) {
    const { x: x1, y: y1 } = e.p1, { x: x2, y: y2 } = e.p2;
    const dx = x2 - x1, dy = y2 - y1;
    if (e.orient === 'bone' || e.orient === 'axisdot') return { d: `M ${f(x1)} ${f(y1)} L ${f(x2)} ${f(y2)}` };
    let orient = e.orient;
    if (orient === 'free') {
      if (style === 'straight' || style === 'elbow' || style === 'rounded') return { d: `M ${f(x1)} ${f(y1)} L ${f(x2)} ${f(y2)}` };
      orient = Math.abs(dx) >= Math.abs(dy) ? 'h' : 'v';
    }
    if (orient === 'tree') {
      if (style === 'straight') return { d: `M ${f(x1)} ${f(y1)} L ${f(x2)} ${f(y2)}` };
      if (style === 'curve' || style === 'tapered') return { d: `M ${f(x1)} ${f(y1)} Q ${f(x1)} ${f(y2)} ${f(x2)} ${f(y2)}` };
      if (style === 'elbow') return { d: `M ${f(x1)} ${f(y1)} V ${f(y2)} H ${f(x2)}` };
      const r = Math.min(10, Math.abs(dy), Math.abs(dx));
      const sy = Math.sign(dy) || 1, sx = Math.sign(dx) || 1;
      return { d: `M ${f(x1)} ${f(y1)} V ${f(y2 - sy * r)} ${corner(x1, y2, x1 + sx * r, y2)} H ${f(x2)}` };
    }
    const H = orient === 'h';
    // generic helpers in "main axis" space: a = along growth direction, b = across
    const P = (a, b) => (H ? `${f(a)} ${f(b)}` : `${f(b)} ${f(a)}`);
    const a1 = H ? x1 : y1, b1 = H ? y1 : x1, a2 = H ? x2 : y2, b2 = H ? y2 : x2;
    const da = a2 - a1;
    switch (style) {
      case 'straight': return { d: `M ${P(a1, b1)} L ${P(a2, b2)}` };
      case 'elbow': {
        const am = a1 + da / 2;
        return { d: `M ${P(a1, b1)} L ${P(am, b1)} L ${P(am, b2)} L ${P(a2, b2)}` };
      }
      case 'rounded': {
        const am = a1 + da / 2;
        const r = Math.min(10, Math.abs(b2 - b1) / 2, Math.abs(da) / 2);
        if (r < 0.5) return { d: `M ${P(a1, b1)} L ${P(a2, b2)}` };
        const sa = Math.sign(da) || 1, sb = Math.sign(b2 - b1) || 1;
        return {
          d: `M ${P(a1, b1)} L ${P(am - sa * r, b1)} Q ${P(am, b1)} ${P(am, b1 + sb * r)} L ${P(am, b2 - sb * r)} Q ${P(am, b2)} ${P(am + sa * r, b2)} L ${P(a2, b2)}`,
        };
      }
      case 'tapered': {
        const w1 = Math.max(1.5, e.width * (e.depth === 1 ? 2.6 : 1.7)), w2 = Math.max(0.6, e.width * 0.35);
        const c1 = a1 + da * 0.5, c2 = a2 - da * 0.5;
        return {
          filled: true,
          d: `M ${P(a1, b1 - w1 / 2)} C ${P(c1, b1 - w1 / 2)} ${P(c2, b2 - w2 / 2)} ${P(a2, b2 - w2 / 2)} L ${P(a2, b2 + w2 / 2)} C ${P(c2, b2 + w2 / 2)} ${P(c1, b1 + w1 / 2)} ${P(a1, b1 + w1 / 2)} Z`,
        };
      }
      default: {
        const c1 = a1 + da * 0.5, c2 = a2 - da * 0.5;
        return { d: `M ${P(a1, b1)} C ${P(c1, b1)} ${P(c2, b2)} ${P(a2, b2)}` };
      }
    }
  }

  /** Relationship curve between two laid-out nodes. */
  function relationPath(a, b, rel) {
    const ac = { x: a.x + a.w / 2, y: a.y + a.h / 2 }, bc = { x: b.x + b.w / 2, y: b.y + b.h / 2 };
    const dx = bc.x - ac.x, dy = bc.y - ac.y, len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len;
    const bend = rel.bend != null ? rel.bend : Math.min(120, len * 0.35);
    const c1 = { x: ac.x + dx * 0.25 + nx * bend, y: ac.y + dy * 0.25 + ny * bend };
    const c2 = { x: ac.x + dx * 0.75 + nx * bend, y: ac.y + dy * 0.75 + ny * bend };
    const p1 = clipToBox(a, c1.x, c1.y), p2 = clipToBox(b, c2.x, c2.y);
    const mid = { x: 0.125 * p1.x + 0.375 * c1.x + 0.375 * c2.x + 0.125 * p2.x, y: 0.125 * p1.y + 0.375 * c1.y + 0.375 * c2.y + 0.125 * p2.y };
    const ang = Math.atan2(p2.y - c2.y, p2.x - c2.x);
    return { d: `M ${f(p1.x)} ${f(p1.y)} C ${f(c1.x)} ${f(c1.y)} ${f(c2.x)} ${f(c2.y)} ${f(p2.x)} ${f(p2.y)}`, p1, p2, mid, ang };
  }

  ML.layout = { wrapText, measureNode, layout, edgePath, relationPath, fontString, subtreeBox, canFreePosition };
})(typeof module !== 'undefined' && module.exports ? (global.ML = global.ML || {}) : (window.ML = window.ML || {}));

/* ---- mindloom/src/renderer/core/render.js ---- */
/* Mindloom — SVG string renderer (shared by the live canvas and SVG/PNG/PDF export) */
(function (ML) {
  'use strict';

  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const n = (v) => Math.round(v * 10) / 10;

  // ---------- background patterns (one tile definition, used for CSS + export) ----------
  function patternTile(id, ink) {
    switch (id) {
      case 'dots': return { size: 22, body: `<circle cx="11" cy="11" r="1.4" fill="${ink}"/>` };
      case 'grid': return { size: 24, body: `<path d="M24 0H0V24" fill="none" stroke="${ink}" stroke-width="1"/>` };
      case 'graph': return {
        size: 100,
        body: `<path d="M20 0V100M40 0V100M60 0V100M80 0V100M0 20H100M0 40H100M0 60H100M0 80H100" stroke="${ink}" stroke-opacity="0.55" stroke-width="0.6" fill="none"/><path d="M100 0H0V100" fill="none" stroke="${ink}" stroke-width="1.4"/>`,
      };
      case 'lines': return { size: 30, body: `<path d="M0 29.5H30" stroke="${ink}" stroke-width="1"/>` };
      case 'cross': return { size: 28, body: `<path d="M14 9V19M9 14H19" stroke="${ink}" stroke-width="1.3" stroke-linecap="round"/>` };
      case 'diagonal': return { size: 18, body: `<path d="M-2 2L2 -2M0 18L18 0M16 20L20 16" stroke="${ink}" stroke-width="1"/>` };
      case 'isometric': return {
        size: 24, h: 42,
        body: `<g fill="${ink}"><circle cx="0" cy="0" r="1.3"/><circle cx="24" cy="0" r="1.3"/><circle cx="12" cy="21" r="1.3"/><circle cx="0" cy="42" r="1.3"/><circle cx="24" cy="42" r="1.3"/></g>`,
      };
      default: return null;
    }
  }
  function patternCSS(id, ink, zoom, panX, panY) {
    const t = patternTile(id, ink);
    if (!t) return { image: 'none', size: 'auto', position: '0 0' };
    const h = t.h || t.size;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${t.size}" height="${h}">${t.body}</svg>`;
    return {
      image: `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`,
      size: `${t.size * zoom}px ${h * zoom}px`,
      position: `${panX}px ${panY}px`,
    };
  }

  // ---------- shapes ----------
  function cloudPath(w, h) {
    const cx = w / 2, cy = h / 2, rx = w / 2 - 6, ry = h / 2 - 6, N = 11;
    const pts = [];
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2 - Math.PI / 2;
      pts.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
    }
    let d = `M ${n(pts[0][0])} ${n(pts[0][1])}`;
    for (let i = 1; i <= N; i++) {
      const p = pts[i % N], q = pts[i - 1];
      const r = Math.hypot(p[0] - q[0], p[1] - q[1]) * 0.62;
      d += ` A ${n(r)} ${n(r)} 0 0 1 ${n(p[0])} ${n(p[1])}`;
    }
    return d + ' Z';
  }

  function shapeSVG(t, isRoot) {
    const st = t.box.style, w = t.w, h = t.h;
    const fill = st.fill || 'transparent';
    const stroke = st.border || 'none';
    const sw = st.borderWidth || 0;
    const dash = st.borderDash === 'dashed' ? ' stroke-dasharray="6 4"' : st.borderDash === 'dotted' ? ' stroke-dasharray="1.5 3" stroke-linecap="round"' : '';
    const common = `fill="${fill}" stroke="${sw ? stroke : 'none'}" stroke-width="${sw}"${dash} class="shape"`;
    switch (st.shape) {
      case 'rect': return `<rect width="${w}" height="${h}" rx="2" ${common}/>`;
      case 'pill': return `<rect width="${w}" height="${h}" rx="${n(h / 2)}" ${common}/>`;
      case 'ellipse': return `<ellipse cx="${n(w / 2)}" cy="${n(h / 2)}" rx="${n(w / 2)}" ry="${n(h / 2)}" ${common}/>`;
      case 'circle': return `<circle cx="${n(w / 2)}" cy="${n(h / 2)}" r="${n(w / 2)}" ${common}/>`;
      case 'diamond': return `<polygon points="${n(w / 2)},0 ${w},${n(h / 2)} ${n(w / 2)},${h} 0,${n(h / 2)}" ${common}/>`;
      case 'hexagon': { const k = h * 0.35; return `<polygon points="${n(k)},0 ${n(w - k)},0 ${w},${n(h / 2)} ${n(w - k)},${h} ${n(k)},${h} 0,${n(h / 2)}" ${common}/>`; }
      case 'parallelogram': { const k = h * 0.3; return `<polygon points="${n(k)},0 ${w},0 ${n(w - k)},${h} 0,${h}" ${common}/>`; }
      case 'cloud': return `<path d="${cloudPath(w, h)}" ${common}/>`;
      case 'underline': {
        const bg = t.node.style && t.node.style.fill ? t.node.style.fill : 'transparent';
        const lw = Math.max(1.5, (st.borderWidth || 1.2) + 0.8);
        return `<rect width="${w}" height="${h}" rx="4" fill="${bg}" class="shape"/><path d="M0 ${n(h)} H${w}" stroke="${t.node.style && t.node.style.border ? st.border : st.line}" stroke-width="${lw}" stroke-linecap="round"/>`;
      }
      case 'none': {
        const bg = t.node.style && t.node.style.fill ? t.node.style.fill : 'transparent';
        return `<rect width="${w}" height="${h}" rx="4" fill="${bg}" class="shape"/>`;
      }
      default: return `<rect width="${w}" height="${h}" rx="${isRoot ? 12 : n(Math.min(8, h / 3))}" ${common}/>`;
    }
  }

  // ---------- markers ----------
  function star(cx, cy, r) {
    const pts = [];
    for (let i = 0; i < 10; i++) {
      const rr = i % 2 ? r * 0.45 : r;
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      pts.push(`${n(cx + Math.cos(a) * rr)},${n(cy + Math.sin(a) * rr)}`);
    }
    return pts.join(' ');
  }
  function markerSVG(kind, val, x, y, s, color) {
    const T = ML.themes;
    const cx = x + s / 2, cy = y + s / 2, r = s / 2;
    if (kind === 'task') {
      if (val === 'done') return `<g data-act="task" class="icon"><rect x="${n(x + 1)}" y="${n(y + 1)}" width="${n(s - 2)}" height="${n(s - 2)}" rx="4" fill="#2f9e44"/><path d="M${n(x + s * 0.27)} ${n(cy)} l${n(s * 0.16)} ${n(s * 0.17)} l${n(s * 0.32)} ${n(-s * 0.34)}" stroke="#fff" stroke-width="${n(s * 0.12)}" fill="none" stroke-linecap="round" stroke-linejoin="round"/></g>`;
      return `<g data-act="task" class="icon"><rect x="${n(x + 1.5)}" y="${n(y + 1.5)}" width="${n(s - 3)}" height="${n(s - 3)}" rx="4" fill="#fff" stroke="${color}" stroke-width="1.6"/></g>`;
    }
    if (kind === 'link') return `<g data-act="link" class="icon"><title>${esc(val)}</title><rect x="${x}" y="${y}" width="${s}" height="${s}" fill="transparent"/><path d="M${n(x + s * 0.42)} ${n(y + s * 0.58)} l${n(s * 0.16)} ${n(-s * 0.16)} M${n(x + s * 0.5)} ${n(y + s * 0.3)} l${n(s * 0.08)} ${n(-s * 0.08)} a${n(s * 0.16)} ${n(s * 0.16)} 0 0 1 ${n(s * 0.23)} ${n(s * 0.23)} l${n(-s * 0.16)} ${n(s * 0.16)} a${n(s * 0.16)} ${n(s * 0.16)} 0 0 1 ${n(-s * 0.23)} 0 M${n(x + s * 0.5)} ${n(y + s * 0.7)} l${n(-s * 0.08)} ${n(s * 0.08)} a${n(s * 0.16)} ${n(s * 0.16)} 0 0 1 ${n(-s * 0.23)} ${n(-s * 0.23)} l${n(s * 0.16)} ${n(-s * 0.16)} a${n(s * 0.16)} ${n(s * 0.16)} 0 0 1 ${n(s * 0.23)} 0" stroke="#1c7ed6" stroke-width="${n(s * 0.1)}" fill="none" stroke-linecap="round"/></g>`;
    if (kind === 'note') return `<g data-act="note" class="icon"><title>${esc(val.slice(0, 300))}</title><rect x="${n(x + s * 0.15)}" y="${n(y + s * 0.08)}" width="${n(s * 0.7)}" height="${n(s * 0.84)}" rx="2" fill="#fff3bf" stroke="#f59f00" stroke-width="1.2"/><path d="M${n(x + s * 0.3)} ${n(y + s * 0.35)}h${n(s * 0.4)}M${n(x + s * 0.3)} ${n(y + s * 0.52)}h${n(s * 0.4)}M${n(x + s * 0.3)} ${n(y + s * 0.69)}h${n(s * 0.25)}" stroke="#e67700" stroke-width="1.2"/></g>`;
    const m = val;
    let mm;
    if ((mm = /^p(\d)$/.exec(m))) {
      const c = T.PRIORITY_COLORS[(+mm[1] - 1) % 6];
      return `<g class="icon" data-act="marker" data-marker="${m}"><circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}" fill="${c}"/><text x="${n(cx)}" y="${n(cy + 0.5)}" text-anchor="middle" dominant-baseline="central" font-size="${n(s * 0.62)}" font-weight="700" fill="#fff" font-family="-apple-system, 'Segoe UI', Arial, sans-serif">${mm[1]}</text></g>`;
    }
    if ((mm = /^pr(\d+)$/.exec(m))) {
      const frac = Math.min(100, +mm[1]) / 100;
      let pie = '';
      if (frac >= 1) pie = `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r - 1)}" fill="#2f9e44"/><path d="M${n(x + s * 0.28)} ${n(cy)} l${n(s * 0.15)} ${n(s * 0.16)} l${n(s * 0.3)} ${n(-s * 0.32)}" stroke="#fff" stroke-width="${n(s * 0.11)}" fill="none" stroke-linecap="round"/>`;
      else if (frac > 0) {
        const a = frac * Math.PI * 2 - Math.PI / 2;
        const ex = cx + Math.cos(a) * (r - 1), ey = cy + Math.sin(a) * (r - 1);
        pie = `<path d="M${n(cx)} ${n(cy)} L${n(cx)} ${n(cy - r + 1)} A${n(r - 1)} ${n(r - 1)} 0 ${frac > 0.5 ? 1 : 0} 1 ${n(ex)} ${n(ey)} Z" fill="#1c7ed6"/>`;
      }
      return `<g class="icon" data-act="marker" data-marker="${m}"><circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r - 1)}" fill="#fff" stroke="#1c7ed6" stroke-width="1.5"/>${pie}</g>`;
    }
    if (m.startsWith('flag-')) {
      const c = T.FLAG_COLORS[m.slice(5)] || '#e03131';
      return `<g class="icon" data-act="marker" data-marker="${m}"><path d="M${n(x + s * 0.22)} ${n(y + s * 0.95)} V${n(y + s * 0.08)}" stroke="#555" stroke-width="1.4" stroke-linecap="round"/><path d="M${n(x + s * 0.24)} ${n(y + s * 0.1)} H${n(x + s * 0.88)} L${n(x + s * 0.72)} ${n(y + s * 0.33)} L${n(x + s * 0.88)} ${n(y + s * 0.56)} H${n(x + s * 0.24)} Z" fill="${c}"/></g>`;
    }
    if (m.startsWith('star-')) {
      const c = T.STAR_COLORS[m.slice(5)] || '#f59f00';
      return `<g class="icon" data-act="marker" data-marker="${m}"><polygon points="${star(cx, cy + 0.5, r)}" fill="${c}"/></g>`;
    }
    return `<g class="icon" data-act="marker" data-marker="${esc(m)}"><text x="${n(cx)}" y="${n(cy + 1)}" text-anchor="middle" dominant-baseline="central" font-size="${n(s * 0.86)}" font-family="'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif">${esc(m)}</text></g>`;
  }

  // ---------- node ----------
  function nodeSVG(t, opts) {
    const b = t.box, st = b.style;
    const isRoot = t.depth === 0 && !t.floating;
    let s = `<g class="node${t.floating && t.depth === 0 ? ' floating' : ''}" data-id="${t.id}" transform="translate(${n(t.x)} ${n(t.y)})">`;
    s += shapeSVG(t, isRoot);
    if (b.img) {
      s += `<image href="${esc(t.node.image.src)}" x="${n(b.imgPos.x)}" y="${n(b.imgPos.y)}" width="${n(b.img.w)}" height="${n(b.img.h)}" preserveAspectRatio="xMidYMid meet"/>`;
    }
    const row = b.row;
    const iconY = row.y + (row.h - b.iconSize) / 2;
    let ix = row.x;
    for (const ic of b.lead) {
      s += markerSVG(ic.kind, ic.val, ix, iconY, b.iconSize, st.color);
      ix += b.iconSize + b.iconGap;
    }
    // text
    const tx0 = row.x + row.textX;
    const anchor = st.align === 'left' ? 'start' : st.align === 'right' ? 'end' : 'middle';
    const tx = st.align === 'left' ? tx0 : st.align === 'right' ? tx0 + row.textW : tx0 + row.textW / 2;
    const ty0 = row.y + (row.h - row.textH) / 2;
    const deco = [st.underline ? 'underline' : '', st.strike || t.node.task === 'done' && opts.strikeDone ? 'line-through' : ''].filter(Boolean).join(' ');
    const placeholder = !t.node.text;
    s += `<text class="label" font-family="${esc(st.font)}" font-size="${st.fontSize}" font-weight="${st.bold ? 700 : 400}"${st.italic ? ' font-style="italic"' : ''}${deco ? ` text-decoration="${deco}"` : ''} fill="${st.color}"${placeholder ? ' opacity="0.35"' : ''} text-anchor="${anchor}">`;
    const lines = placeholder ? [opts.export ? '' : 'Topic'] : b.lines;
    lines.forEach((ln, i) => {
      s += `<tspan x="${n(tx)}" y="${n(ty0 + i * b.lh + b.lh / 2)}" dominant-baseline="central">${esc(ln) || ' '}</tspan>`;
    });
    s += '</text>';
    ix = row.x + row.textX + row.textW + b.iconGap;
    for (const ic of b.trail) {
      s += markerSVG(ic.kind, ic.val, ix, iconY, b.iconSize, st.color);
      ix += b.iconSize + b.iconGap;
    }
    // tags
    if (b.tags.length) {
      let gx = b.tagsX;
      for (const tg of b.tags) {
        s += `<g class="tag"><rect x="${n(gx)}" y="${n(b.tagsY)}" width="${tg.w}" height="18" rx="9" fill="${st.line}" fill-opacity="0.18"/><text x="${n(gx + tg.w / 2)}" y="${n(b.tagsY + 9.5)}" text-anchor="middle" dominant-baseline="central" font-size="11" font-weight="600" font-family="${esc(st.font)}" fill="${st.color}" fill-opacity="0.85">${esc(tg.text)}</text></g>`;
        gx += tg.w + 4;
      }
    }
    // collapse / expand handle
    if (t.node.children.length) {
      const pos = togglePos(t);
      if (t.node.collapsed) {
        const cnt = countAll(t.node);
        s += `<g class="badge" data-act="toggle"><circle cx="${n(pos.x)}" cy="${n(pos.y)}" r="10" fill="${opts.bg}" stroke="${st.line}" stroke-width="1.6"/><text x="${n(pos.x)}" y="${n(pos.y + 0.5)}" text-anchor="middle" dominant-baseline="central" font-size="${cnt > 99 ? 8 : 10}" font-weight="700" fill="${st.line}" font-family="-apple-system,'Segoe UI',Arial,sans-serif">${cnt}</text></g>`;
      } else if (!opts.export && !(isRoot && opts.layout === 'mindmap')) {
        s += `<g class="toggler" data-act="toggle"><circle cx="${n(pos.x)}" cy="${n(pos.y)}" r="7" fill="${opts.bg}" stroke="${st.line}" stroke-width="1.4"/><path d="M${n(pos.x - 3.5)} ${n(pos.y)} H${n(pos.x + 3.5)}" stroke="${st.line}" stroke-width="1.6" stroke-linecap="round"/></g>`;
      }
    }
    s += '</g>';
    return s;
  }

  function countAll(node) { let c = 0; const r = (x) => { for (const k of x.children) { c++; r(k); } }; r(node); return c; }

  function togglePos(t) {
    const yb = t.box.style.shape === 'underline' ? t.h : t.h / 2;
    switch (t.dir) {
      case 'l': return { x: -12, y: yb };
      case 'd': return { x: t.w / 2, y: t.h + 12 };
      case 'u': return { x: t.w / 2, y: -12 };
      case 'tree': case 'tree-up': case 'fish-row': case 'fish-up': case 'fish-down': return { x: -12, y: t.h / 2 };
      case 'radial': return { x: t.w + 12, y: t.h / 2 };
      case 'both': return { x: t.w + 12, y: t.h / 2 };
      default: return { x: t.w + 12, y: yb };
    }
  }

  // ---------- full scene ----------
  /**
   * L: layout result; opts: { theme, settings, selected:Set, matches:Set, selectedRel, export, relations }
   */
  function scene(L, doc, opts) {
    const theme = opts.theme, s = opts.settings;
    const o = Object.assign({ bg: theme.bg, layout: s.layout }, opts);
    const parts = [];
    // boundaries
    for (const b of L.boundaries) {
      parts.push(`<g class="boundary" data-boundary="${b.id}"><rect x="${n(b.x)}" y="${n(b.y)}" width="${n(b.w)}" height="${n(b.h)}" rx="14" fill="${b.color}" fill-opacity="0.07" stroke="${b.color}" stroke-width="1.5" stroke-dasharray="6 5"/>`);
      if (b.label) parts.push(`<rect x="${n(b.x + 10)}" y="${n(b.y + 6)}" width="${n(Math.min(b.w - 20, b.label.length * 7.5 + 20))}" height="20" rx="10" fill="${b.color}"/><text x="${n(b.x + 20)}" y="${n(b.y + 16.5)}" dominant-baseline="central" font-size="12" font-weight="600" fill="${ML.themes.contrastText(b.color)}" font-family="${esc(ML.themes.getFont(s.font))}">${esc(b.label)}</text>`);
      parts.push('</g>');
    }
    // structural extras
    for (const e of L.extras) {
      if (e.type === 'spine') {
        parts.push(`<path d="M${n(e.x1)} ${n(e.y)} H${n(e.x2)}" stroke="${theme.line}" stroke-width="${s.lineWidth * 2.4}" stroke-linecap="round"/>`);
      } else if (e.type === 'axis') {
        parts.push(`<path d="M${n(e.x1)} ${n(e.y)} H${n(e.x2)}" stroke="${theme.line}" stroke-width="${s.lineWidth * 2}" stroke-linecap="round"/><path d="M${n(e.x2 - 2)} ${n(e.y - 7)} L${n(e.x2 + 10)} ${n(e.y)} L${n(e.x2 - 2)} ${n(e.y + 7)} Z" fill="${theme.line}"/>`);
      }
    }
    // connectors
    parts.push('<g class="edges">');
    for (const e of L.edges) {
      if (e.orient === 'axisdot') {
        parts.push(`<circle cx="${n(e.p1.x)}" cy="${n(e.p1.y)}" r="${s.lineWidth + 2.5}" fill="${e.color}"/>`);
        continue;
      }
      const p = ML.layout.edgePath(e, e.orient === 'bone' ? 'straight' : s.lineStyle);
      const w = e.orient === 'bone' ? e.width * 1.4 : e.width;
      if (p.filled) parts.push(`<path d="${p.d}" fill="${e.color}"/>`);
      else parts.push(`<path d="${p.d}" fill="none" stroke="${e.color}" stroke-width="${n(w)}" stroke-linecap="round" stroke-linejoin="round"/>`);
    }
    parts.push('</g>');
    // nodes
    parts.push('<g class="nodes">');
    for (const t of L.list) parts.push(nodeSVG(t, o));
    parts.push('</g>');
    // relationships
    parts.push('<g class="relations">');
    for (const r of doc.relations || []) {
      const a = L.nodes.get(r.from), b = L.nodes.get(r.to);
      if (!a || !b) continue;
      const rp = ML.layout.relationPath(a, b, r);
      const col = r.color || (theme.dark ? '#f8f9fa' : '#5c677d');
      const sel = o.selectedRel === r.id;
      const ah = 9, ang = rp.ang;
      const ax = rp.p2.x, ay = rp.p2.y;
      const p1 = `${n(ax - Math.cos(ang - 0.45) * ah)},${n(ay - Math.sin(ang - 0.45) * ah)}`;
      const p2 = `${n(ax - Math.cos(ang + 0.45) * ah)},${n(ay - Math.sin(ang + 0.45) * ah)}`;
      parts.push(`<g class="relation${sel ? ' selected' : ''}" data-rel="${r.id}"><path d="${rp.d}" fill="none" stroke="transparent" stroke-width="12"/><path d="${rp.d}" fill="none" stroke="${sel ? '#3b82f6' : col}" stroke-width="${sel ? 2.4 : 1.7}" stroke-dasharray="7 5"/><polygon points="${n(ax)},${n(ay)} ${p1} ${p2}" fill="${sel ? '#3b82f6' : col}"/>`);
      if (r.label) {
        const lw = r.label.length * 7 + 16;
        parts.push(`<rect x="${n(rp.mid.x - lw / 2)}" y="${n(rp.mid.y - 11)}" width="${n(lw)}" height="22" rx="11" fill="${theme.bg}" stroke="${col}" stroke-width="1"/><text x="${n(rp.mid.x)}" y="${n(rp.mid.y + 0.5)}" text-anchor="middle" dominant-baseline="central" font-size="12" fill="${col}" font-family="${esc(ML.themes.getFont(s.font))}">${esc(r.label)}</text>`);
      }
      parts.push('</g>');
    }
    parts.push('</g>');
    // selection / search overlays (live canvas only)
    if (!o.export) {
      parts.push('<g class="overlay">');
      if (o.matches) for (const id of o.matches) {
        const t = L.nodes.get(id);
        if (t) parts.push(`<rect x="${n(t.x - 5)}" y="${n(t.y - 5)}" width="${n(t.w + 10)}" height="${n(t.h + 10)}" rx="10" fill="none" stroke="#fab005" stroke-width="3" stroke-dasharray="5 3"/>`);
      }
      if (o.selected) for (const id of o.selected) {
        const t = L.nodes.get(id);
        if (t) parts.push(`<rect class="sel" x="${n(t.x - 4.5)}" y="${n(t.y - 4.5)}" width="${n(t.w + 9)}" height="${n(t.h + 9)}" rx="10" fill="none" stroke="#3b82f6" stroke-width="2.5"/>`);
      }
      parts.push('</g>');
    }
    return parts.join('');
  }

  /** Standalone SVG document for export. */
  function exportSVG(L, doc, opts) {
    const theme = opts.theme, s = opts.settings;
    const pad = opts.padding == null ? 40 : opts.padding;
    const b = L.bounds;
    const x = Math.floor(b.minX - pad), y = Math.floor(b.minY - pad);
    const w = Math.ceil(b.w + pad * 2), h = Math.ceil(b.h + pad * 2);
    const tile = opts.transparent ? null : patternTile(s.pattern, theme.ink);
    let defs = '';
    let bg = opts.transparent ? '' : `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${theme.bg}"/>`;
    if (tile) {
      defs = `<defs><pattern id="ml-bg" patternUnits="userSpaceOnUse" width="${tile.size}" height="${tile.h || tile.size}">${tile.body}</pattern></defs>`;
      bg += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#ml-bg)"/>`;
    }
    const body = scene(L, doc, Object.assign({}, opts, { export: true, selected: null, matches: null, selectedRel: null }));
    return {
      svg: `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${w}" height="${h}" viewBox="${x} ${y} ${w} ${h}">${defs}${bg}${body}</svg>`,
      width: w, height: h,
    };
  }

  ML.render = { scene, exportSVG, patternCSS, patternTile, markerSVG, esc };
})(typeof module !== 'undefined' && module.exports ? (global.ML = global.ML || {}) : (window.ML = window.ML || {}));

/* ======================================================================================================
 * Mind map blocks for Notes: the block shown in a note, and the full-screen editor.
 * A map is stored in the note itself (data-map on <div class="blk-mindmap">), so it saves, syncs through
 * Google Drive, works offline and is encrypted in locked notes exactly like the rest of the note.
 * ==================================================================================================== */
(() => {
  'use strict';
  const { model: M, layout: Lay, render: R, themes: T } = window.ML;
  const esc = R.esc;
  let C = null;

  // ---------- measuring + rendering ----------
  const mctx = document.createElement('canvas').getContext('2d');
  const mcache = new Map();
  function measure(text, font) {
    const k = font + '\u0001' + text;
    let v = mcache.get(k);
    if (v == null) { mctx.font = font; v = mctx.measureText(text).width; if (mcache.size > 20000) mcache.clear(); mcache.set(k, v); }
    return v;
  }
  const themeOf = (doc) => T.getTheme(doc.settings.theme);
  const layoutOf = (doc, extra) => Lay.layout(doc, Object.assign({ theme: themeOf(doc), settings: doc.settings, measure }, extra || {}));
  const svgOf = (doc, opts) => R.exportSVG(layoutOf(doc), doc, Object.assign({ theme: themeOf(doc), settings: doc.settings }, opts || {}));
  const countOf = (doc) => { let n = 0; M.walkDoc(doc, () => { n++; }); return n; };
  const titleOf = (doc) => (doc.root.text || 'Mind map').split('\n')[0].slice(0, 80);

  function newDoc(title) {
    const d = M.createDoc(title || 'Central topic');
    Object.assign(d.settings, { theme: 'fresh', lineStyle: 'tapered', pattern: 'none' });
    return d;
  }
  function readMap(el) {
    try { const d = JSON.parse(el.dataset.map || 'null'); return d && d.root ? M.normalizeDoc(d) : null; } catch (e) { return null; }
  }
  function writeMap(el, doc) { el.dataset.map = JSON.stringify(doc); }
  /** Plain text of every topic, kept in the saved note so search and previews find the map's words. */
  function searchText(doc) {
    const parts = [];
    M.walkDoc(doc, (n) => { if (n.text) parts.push(n.text.replace(/\s+/g, ' ')); });
    return ('Mind map: ' + parts.join(' · ')).slice(0, 4000);
  }

  async function pngBlob(doc, scale) {
    const { svg, width, height } = svgOf(doc);
    const k = Math.min(scale || 2, 12000 / width, 12000 / height, Math.sqrt(80e6 / (width * height)));
    const img = new Image();
    await new Promise((ok, no) => { img.onload = ok; img.onerror = () => no(new Error('Couldn’t draw the mind map')); img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); });
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(width * k)); c.height = Math.max(1, Math.round(height * k));
    const g = c.getContext('2d');
    g.scale(k, k);
    g.drawImage(img, 0, 0, width, height);
    return new Promise((ok, no) => c.toBlob((b) => (b ? ok(b) : no(new Error('Couldn’t make the image'))), 'image/png'));
  }
  const blobToDataURL = (b) => new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = () => no(r.error); r.readAsDataURL(b); });

  // ---------- the block inside a note ----------
  function renderBlock(el) {
    if (!el.dataset.mmid) el.dataset.mmid = M.uid();
    const doc = readMap(el);
    if (!doc) {
      el.innerHTML = '<div class="mm-b-head"><b>🧠 Mind map</b><span>This mind map couldn’t be read.</span></div>';
      el.classList.add('broken');
    } else {
      el.classList.remove('broken');
      const out = svgOf(doc, { padding: 20 });
      const n = countOf(doc);
      el.innerHTML = `<div class="mm-b-head"><b>🧠 ${esc(titleOf(doc))}</b><span>${n} topic${n === 1 ? '' : 's'}</span><span class="grow"></span><button class="pl-btn" data-mm="open" title="Open the mind map (or double-click it)">Open</button></div>` +
        `<div class="mm-b-view" style="aspect-ratio:${out.width} / ${out.height}">${out.svg}</div>`;
    }
    if (el.dataset.wired) return;
    el.dataset.wired = '1';
    const stop = (e) => e.stopPropagation();
    ['keyup', 'input', 'paste', 'beforeinput', 'mousedown', 'dragenter'].forEach((ev) => el.addEventListener(ev, stop));
    el.addEventListener('click', (e) => { e.stopPropagation(); if (e.target.closest('[data-mm="open"], .mm-b-view')) open(el); });
  }
  /** Saved form of the block: the map data plus its text (for search), never the drawn preview. */
  function serializeBlock(el) {
    const doc = readMap(el);
    el.innerHTML = doc ? `<div class="mm-txt" hidden>${esc(searchText(doc))}</div>` : '';
    el.classList.remove('broken');
    delete el.dataset.wired;
  }

  /** For exports: a picture (PDF, HTML, Word) or a nested list (Markdown, text). */
  async function exportBlock(el, mode) {
    const doc = readMap(el);
    if (!doc) { el.remove(); return; }
    if (mode === 'data' || mode === 'keep') {
      const url = await blobToDataURL(await pngBlob(doc, 2));
      el.outerHTML = mode === 'data'
        ? `<figure><img src="${url}" alt="${esc('Mind map: ' + titleOf(doc))}"></figure>`
        : `<figure class="att" data-kind="image" data-export-image="1" data-name="${esc(titleOf(doc))}" data-mm-png="${url}"></figure>`;
      return;
    }
    const list = (nodes) => (nodes.length ? `<ul>${nodes.map((c) => `<li>${esc(c.text || 'Topic')}${list(c.children)}</li>`).join('')}</ul>` : '');
    el.outerHTML = `<p><b>${esc(doc.root.text || 'Mind map')}</b></p>${list(doc.root.children)}` +
      doc.floating.map((f) => `<p><b>${esc(f.text || 'Topic')}</b></p>${list(f.children)}`).join('');
  }

  /** Build a map from a note's headings, lists and lines. */
  function docFromNote(root, title) {
    const doc = newDoc(title || 'Note');
    const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, 140);
    let count = 1;
    const add = (parent, text, extra) => {
      if (count >= 400 || !text) return null;
      const n = M.createNode(text, extra);
      parent.children.push(n);
      count++;
      return n;
    };
    const ownText = (li) => { const c = li.cloneNode(true); c.querySelectorAll('ul, ol').forEach((x) => x.remove()); return clean(c.textContent); };
    const addList = (list, parent) => {
      const checklist = list.classList.contains('checklist');
      for (const li of list.children) {
        if (li.tagName !== 'LI') continue;
        const n = add(parent, ownText(li), checklist ? { task: li.classList.contains('done') ? 'done' : 'todo' } : null);
        if (!n) continue;
        li.querySelectorAll(':scope > ul, :scope > ol').forEach((sub) => addList(sub, n));
      }
    };
    const stack = [{ lvl: 0, node: doc.root }];
    const top = () => stack[stack.length - 1].node;
    let titleSkipped = false;
    for (const el of root.children) {
      if (el.matches('.blk-mindmap, .blk-board, .blk-doc, .blk-toc, figure, table, hr, pre')) continue;
      const lvl = { H1: 1, H2: 2, H3: 3 }[el.tagName];
      if (lvl) {
        const text = clean(el.textContent);
        if (!text) continue;
        if (!titleSkipped && text === doc.root.text) { titleSkipped = true; continue; }
        while (stack.length > 1 && stack[stack.length - 1].lvl >= lvl) stack.pop();
        const n = add(top(), text);
        if (n) stack.push({ lvl, node: n });
      } else if (el.tagName === 'UL' || el.tagName === 'OL') addList(el, top());
      else {
        const text = clean(el.textContent);
        if (!text) continue;
        if (!titleSkipped && text === doc.root.text) { titleSkipped = true; continue; }
        add(top(), text);
      }
    }
    return doc;
  }

  // ---------- inserting ----------
  function insertMap(doc, { edit } = {}) {
    Blocks._insertBlock('<div class="blk-mindmap" contenteditable="false"></div>');
    const el = [...C.editor.querySelectorAll('.blk-mindmap')].find((x) => !x.dataset.map);
    if (!el) return null;
    writeMap(el, doc);
    renderBlock(el);
    C.onEdit();
    open(el, { editRoot: !!edit });
    return el;
  }
  function insertBlank() { insertMap(newDoc('Central topic'), { edit: true }); }
  function insertFromNote() {
    const n = C.byId(C.currentId());
    const doc = docFromNote(C.editor, n ? C.info(n).title : 'Note');
    if (!doc.root.children.length) { C.toast('Add some headings, lists or lines to the note first: they become the branches.'); return; }
    insertMap(doc);
  }

  // ---------- the full-screen editor ----------
  const ICON = {
    undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
    redo: '<path d="m15 14 5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/>',
    topic: '<rect x="3" y="8" width="18" height="8" rx="3"/>',
    sub: '<rect x="2" y="4" width="10" height="6" rx="2"/><rect x="12" y="14" width="10" height="6" rx="2"/><path d="M7 10v4a3 3 0 0 0 3 3h2"/>',
    del: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>',
    style: '<circle cx="13.5" cy="6.5" r="1.3"/><circle cx="17.5" cy="10.5" r="1.3"/><circle cx="8.5" cy="7.5" r="1.3"/><circle cx="6.5" cy="12.5" r="1.3"/><path d="M12 2a10 10 0 0 0 0 20c1 0 1.7-.8 1.7-1.7 0-.4-.2-.8-.4-1.1-.3-.3-.4-.7-.4-1.1 0-.9.8-1.7 1.7-1.7h2A5.6 5.6 0 0 0 22 11c0-5-4.5-9-10-9z"/>',
    fit: '<path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"/>',
    export: '<path d="M12 15V3M7 8l5-5 5 5"/><path d="M20 15v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-4"/>',
  };
  const ic = (k) => `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[k]}</svg>`;
  const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  const K = (s) => (isMac ? s.replace(/Mod\+/g, '⌘').replace(/Shift\+/g, '⇧').replace(/Alt\+/g, '⌥') : s.replace(/Mod\+/g, 'Ctrl+'));

  let current = null; // the open editor (one at a time)

  function open(el, opts) {
    if (current) return;
    const doc0 = readMap(el);
    if (!doc0) { C.toast('This mind map couldn’t be read.'); return; }
    current = new Editor(el, doc0, opts || {});
  }

  class Editor {
    constructor(el, doc, opts) {
      this.blockId = el.dataset.mmid;
      this.block = el;
      this.doc = doc;
      this.sel = [doc.root.id];
      this.view = { zoom: 1, x: 0, y: 0 };
      this.history = new M.History(200);
      this.history.reset(JSON.stringify(doc));
      this.editing = null;
      this.drag = null; this.pan = null; this.marquee = null; this.pointers = new Map(); this.pinch = null;
      this.build();
      this.render();
      requestAnimationFrame(() => { this.fit(false); if (opts.editRoot) this.startEdit(doc.root.id); });
    }

    // ---- shell ----
    build() {
      const box = document.createElement('div');
      box.className = 'mm-overlay';
      box.setAttribute('role', 'dialog');
      box.setAttribute('aria-modal', 'true');
      box.setAttribute('aria-label', 'Mind map editor');
      box.innerHTML = `
        <div class="mm-bar">
          <b class="mm-title">🧠 Mind map</b>
          <div class="mm-tools">
            <button class="mm-tb" data-c="addSibling" title="Add topic (Enter)">${ic('topic')}<span>Topic</span></button>
            <button class="mm-tb" data-c="addChild" title="Add subtopic (Tab)">${ic('sub')}<span>Subtopic</span></button>
            <button class="mm-tb" data-c="remove" title="Delete (Delete)">${ic('del')}<span>Delete</span></button>
            <span class="mm-sep"></span>
            <button class="mm-tb" data-c="undo" title="Undo (${K('Mod+Z')})">${ic('undo')}</button>
            <button class="mm-tb" data-c="redo" title="Redo (${K('Mod+Shift+Z')})">${ic('redo')}</button>
            <span class="mm-sep"></span>
            <button class="mm-tb" data-c="style" title="Theme, structure and topic style">${ic('style')}<span>Style</span></button>
            <button class="mm-tb" data-c="fit" title="Fit to window (${K('Mod+0')})">${ic('fit')}</button>
            <button class="mm-tb" data-c="zoomOut" title="Zoom out">−</button>
            <button class="mm-tb mm-zoom" data-c="zoomReset" title="Actual size">100%</button>
            <button class="mm-tb" data-c="zoomIn" title="Zoom in">+</button>
            <button class="mm-tb" data-c="export" title="Save as an image">${ic('export')}<span>Export</span></button>
          </div>
          <button class="pl-btn primary mm-done" data-c="done">Done</button>
        </div>
        <div class="mm-main">
          <div class="mm-stage" tabindex="0">
            <svg class="mm-svg" xmlns="http://www.w3.org/2000/svg"><g class="mm-vp"></g><g class="mm-dl"></g></svg>
            <textarea class="mm-edit" rows="1" spellcheck="true" aria-label="Topic text"></textarea>
          </div>
          <aside class="mm-panel" hidden></aside>
        </div>
        <div class="mm-hint">Tab: subtopic · Enter: topic · type (or tap a selected topic) to rename · drag a topic to place it (it stays connected) · drop on a topic to move it there · Shift+drag to select</div>
        <div class="mm-menu" hidden></div>`;
      document.body.appendChild(box);
      this.box = box;
      this.stage = box.querySelector('.mm-stage');
      this.vp = box.querySelector('.mm-vp');
      this.dl = box.querySelector('.mm-dl');
      this.ed = box.querySelector('.mm-edit');
      this.panel = box.querySelector('.mm-panel');
      this.menuEl = box.querySelector('.mm-menu');
      this.zoomLabel = box.querySelector('.mm-zoom');
      this.prevFocus = document.activeElement;
      this.onKeyCapture = (e) => this.onKey(e);
      document.addEventListener('keydown', this.onKeyCapture, true);
      box.addEventListener('click', (e) => {
        const b = e.target.closest('[data-c]');
        if (b && !b.disabled) this.cmd(b.dataset.c, b.dataset.arg);
      });
      const st = this.stage;
      st.addEventListener('pointerdown', (e) => this.onDown(e));
      st.addEventListener('pointermove', (e) => this.onMove(e));
      st.addEventListener('pointerup', (e) => this.onUp(e));
      st.addEventListener('pointercancel', (e) => this.onUp(e, true));
      st.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });
      st.addEventListener('dblclick', (e) => this.onDbl(e));
      st.addEventListener('contextmenu', (e) => this.onContext(e));
      st.addEventListener('gesturestart', (e) => { e.preventDefault(); this.gz = this.view.zoom; });
      st.addEventListener('gesturechange', (e) => { e.preventDefault(); if (this.gz) { const r = this.rect(); this.zoomAt((this.gz * e.scale) / this.view.zoom, e.clientX - r.left, e.clientY - r.top); } });
      this.ed.addEventListener('input', () => { const n = this.editing && M.getNode(this.doc, this.editing.id); if (n) { n.text = this.ed.value; this.render(); } });
      this.ed.addEventListener('blur', () => setTimeout(() => { if (this.editing && document.activeElement !== this.ed) this.commitEdit(); }, 0));
      this.panel.addEventListener('click', (e) => this.onPanelClick(e));
      this.panel.addEventListener('change', (e) => { if (e.target.type === 'color') this.style({ [e.target.dataset.key]: e.target.value }); });
      this.onResize = () => this.applyView();
      window.addEventListener('resize', this.onResize);
      st.focus({ preventScroll: true });
    }

    close() {
      if (this.editing) this.commitEdit();
      this.save(true);
      document.removeEventListener('keydown', this.onKeyCapture, true);
      window.removeEventListener('resize', this.onResize);
      clearTimeout(this.saveT);
      this.box.remove();
      current = null;
      if (this.prevFocus && this.prevFocus.focus) try { this.prevFocus.focus({ preventScroll: true }); } catch (e) { /* gone */ }
    }

    /** Write the map back into its block in the note (finding it again if the note was redrawn meanwhile). */
    save(now) {
      clearTimeout(this.saveT);
      const run = () => {
        let el = this.block;
        if (!el.isConnected) el = C.editor.querySelector(`.blk-mindmap[data-mmid="${this.blockId}"]`);
        if (!el) {
          // the note was replaced (for example by a sync): keep the work as a new block at the end of the note
          el = document.createElement('div');
          el.className = 'blk-mindmap';
          el.contentEditable = 'false';
          el.dataset.mmid = this.blockId;
          C.editor.appendChild(el);
        }
        this.block = el;
        const json = JSON.stringify(this.doc);
        if (el.dataset.map === json) return;
        el.dataset.map = json;
        renderBlock(el);
        C.onEdit();
      };
      if (now) run(); else this.saveT = setTimeout(run, 500);
    }

    // ---- state ----
    commit(opts) {
      if (this.history.push(JSON.stringify(this.doc))) this.save();
      this.render();
      if (!(opts && opts.noScroll) && this.primary()) this.ensureVisible(this.primary());
    }
    restore(snap) {
      const sel = this.sel.slice();
      this.doc = JSON.parse(snap);
      this.sel = sel.filter((id) => M.getNode(this.doc, id));
      if (!this.sel.length) this.sel = [this.doc.root.id];
      this.render();
      this.save();
    }
    primary() { return this.sel[this.sel.length - 1] || null; }
    primaryNode() { return this.primary() ? M.getNode(this.doc, this.primary()) : null; }
    selected() { return this.sel.map((id) => M.getNode(this.doc, id)).filter(Boolean); }
    topLevel(ids) { return ids.filter((id) => !ids.some((o) => o !== id && M.isAncestor(this.doc, o, id))); }

    // ---- drawing ----
    render() {
      const s = this.doc.settings, theme = themeOf(this.doc);
      this.L = Lay.layout(this.doc, { theme, settings: s, measure });
      if (s.layout === 'mindmap') for (const c of this.L.root.children) if (!c.node.side && c.side) c.node.side = c.side;
      this.vp.innerHTML = R.scene(this.L, this.doc, { theme, settings: s, selected: new Set(this.sel), matches: null });
      for (const id of this.sel) { const g = this.vp.querySelector(`.node[data-id="${id}"]`); if (g) g.classList.add('sel'); }
      this.stage.style.backgroundColor = theme.bg;
      this.applyView();
      this.box.querySelector('[data-c="undo"]').disabled = !this.history.canUndo();
      this.box.querySelector('[data-c="redo"]').disabled = !this.history.canRedo();
      this.box.querySelector('.mm-title').textContent = '🧠 ' + titleOf(this.doc);
      if (!this.panel.hidden && !this.dragging && !this.panel.contains(document.activeElement)) this.renderPanel();
    }
    applyView() {
      const v = this.view, tf = `translate(${v.x} ${v.y}) scale(${v.zoom})`;
      this.vp.setAttribute('transform', tf);
      this.dl.setAttribute('transform', tf);
      const pc = R.patternCSS(this.doc.settings.pattern, themeOf(this.doc).ink, v.zoom, v.x, v.y);
      Object.assign(this.stage.style, { backgroundImage: pc.image, backgroundSize: pc.size, backgroundPosition: pc.position });
      this.zoomLabel.textContent = Math.round(v.zoom * 100) + '%';
      if (this.editing) this.positionEditor();
    }
    rect() { return this.stage.getBoundingClientRect(); }
    toWorld(cx, cy) { const r = this.rect(), v = this.view; return { x: (cx - r.left - v.x) / v.zoom, y: (cy - r.top - v.y) / v.zoom }; }
    fitBox(b, maxZoom) {
      const r = this.rect(), pad = 48;
      const z = Math.max(0.1, Math.min(maxZoom || 1.1, (r.width - pad * 2) / Math.max(1, b.w), (r.height - pad * 2) / Math.max(1, b.h)));
      this.view = { zoom: z, x: r.width / 2 - (b.minX + b.w / 2) * z, y: r.height / 2 - (b.minY + b.h / 2) * z };
      this.applyView();
    }
    fit() { this.fitBox(this.L.bounds, 1.1); }
    zoomAt(f, cx, cy) {
      const r = this.rect(), v = this.view;
      if (cx == null) { cx = r.width / 2; cy = r.height / 2; }
      const z = Math.max(0.1, Math.min(4, v.zoom * f));
      const wx = (cx - v.x) / v.zoom, wy = (cy - v.y) / v.zoom;
      this.view = { zoom: z, x: cx - wx * z, y: cy - wy * z };
      this.applyView();
    }
    ensureVisible(id) {
      const t = this.L.nodes.get(id);
      if (!t) return;
      const r = this.rect(), v = this.view, m = 40;
      const x1 = t.x * v.zoom + v.x, y1 = t.y * v.zoom + v.y, x2 = x1 + t.w * v.zoom, y2 = y1 + t.h * v.zoom;
      let dx = 0, dy = 0;
      if (x1 < m) dx = m - x1; else if (x2 > r.width - m) dx = Math.max(m - x1, r.width - m - x2);
      if (y1 < m) dy = m - y1; else if (y2 > r.height - m) dy = Math.max(m - y1, r.height - m - y2);
      if (dx || dy) { v.x += dx; v.y += dy; this.applyView(); }
    }
    select(ids, opts) {
      ids = Array.isArray(ids) ? ids : ids ? [ids] : [];
      if (opts && opts.toggle) { const set = new Set(this.sel); for (const id of ids) { if (set.has(id)) set.delete(id); else set.add(id); } this.sel = [...set]; } else this.sel = ids;
      this.render();
      if (this.primary() && !(opts && opts.noScroll)) this.ensureVisible(this.primary());
    }

    // ---- text editing ----
    startEdit(id, opts) {
      opts = opts || {};
      const n = M.getNode(this.doc, id);
      if (!n || !this.L.nodes.get(id)) return;
      if (this.editing) this.commitEdit();
      this.sel = [id];
      this.editing = { id, original: n.text };
      this.ed.value = opts.initial != null ? opts.initial : n.text;
      if (opts.initial != null) { n.text = opts.initial; this.render(); }
      this.ed.style.display = 'block';
      this.positionEditor();
      this.ed.focus({ preventScroll: true });
      if (opts.initial == null) this.ed.select(); else this.ed.setSelectionRange(this.ed.value.length, this.ed.value.length);
      this.ensureVisible(id);
    }
    positionEditor() {
      const t = this.editing && this.L.nodes.get(this.editing.id);
      if (!t) return;
      const v = this.view, b = t.box, st = b.style;
      const x = (t.x + b.row.x + b.row.textX) * v.zoom + v.x, y = (t.y + b.row.y + (b.row.h - b.row.textH) / 2) * v.zoom + v.y;
      Object.assign(this.ed.style, {
        font: `${st.italic ? 'italic ' : ''}${st.bold ? 700 : 400} ${st.fontSize * v.zoom}px ${st.font}`,
        lineHeight: `${b.lh * v.zoom}px`, textAlign: st.align,
        width: Math.max(b.row.textW * v.zoom, 40) + 14 + 'px', left: x - 7 + 'px', top: y - 4 + 'px', height: 'auto',
      });
      this.ed.style.height = Math.max(b.row.textH * v.zoom + 8, this.ed.scrollHeight) + 'px';
    }
    commitEdit() {
      const e = this.editing;
      if (!e) return;
      this.editing = null;
      this.ed.style.display = 'none';
      const n = M.getNode(this.doc, e.id);
      if (n) n.text = this.ed.value.replace(/\s+$/, '');
      this.stage.focus({ preventScroll: true });
      if (n && n.text !== e.original) this.commit(); else this.render();
    }
    cancelEdit() {
      const e = this.editing;
      if (!e) return;
      this.editing = null;
      this.ed.style.display = 'none';
      const n = M.getNode(this.doc, e.id);
      if (n) n.text = e.original;
      this.stage.focus({ preventScroll: true });
      this.render();
    }

    // ---- commands ----
    cmd(name, arg) {
      this.hideMenu();
      if (this.editing && name !== 'undo' && name !== 'redo') this.commitEdit();
      const d = this.doc;
      const created = (n) => { if (!n) return; this.sel = [n.id]; this.commit(); this.startEdit(n.id); };
      const depthText = (pid) => { const f = M.find(d, pid); return f && f.depth === 0 && !f.floating ? 'Main topic' : 'Subtopic'; };
      switch (name) {
        case 'addChild': { const id = this.primary() || d.root.id; return created(M.addChild(d, id, depthText(id))); }
        case 'addSibling': {
          const id = this.primary() || d.root.id;
          const f = M.find(d, id);
          if (!f) return;
          const n = M.addSibling(d, id, f.parent ? depthText(f.parent.id) : f.floating ? 'Floating topic' : 'Main topic', arg === 'before');
          if (f.floating && !f.parent) { const t = this.L.nodes.get(id); if (t) { const b = Lay.subtreeBox(t); n.x = Math.round(t.x); n.y = Math.round(b.maxY + 30); } }
          return created(n);
        }
        case 'addParent': { const id = this.primary(); if (!id || id === d.root.id) return; const n = M.addParent(d, id, 'Topic'); return created(n); }
        case 'remove': {
          const ids = this.sel.filter((id) => id !== d.root.id);
          if (!ids.length) return;
          const next = M.remove(d, ids);
          this.sel = [next || d.root.id];
          return this.commit();
        }
        case 'edit': if (this.primary()) this.startEdit(this.primary()); return;
        case 'undo': {
          if (this.editing) { document.execCommand('undo'); return; }
          const s = this.history.undo(); if (s) this.restore(s); return;
        }
        case 'redo': {
          if (this.editing) { document.execCommand('redo'); return; }
          const s = this.history.redo(); if (s) this.restore(s); return;
        }
        case 'collapse': { let ch = false; for (const id of this.sel) ch = M.setCollapsed(d, id) || ch; if (ch) this.commit({ noScroll: true }); return; }
        case 'moveUp': if (this.primary() && M.reorder(d, this.primary(), -1)) this.commit(); return;
        case 'moveDown': if (this.primary() && M.reorder(d, this.primary(), 1)) this.commit(); return;
        case 'indent': if (this.primary() && M.indent(d, this.primary())) this.commit(); return;
        case 'outdent': if (this.primary() && M.outdent(d, this.primary())) this.commit(); return;
        case 'resetPosition': { let n = 0; for (const x of this.selected()) if (x.offset) { delete x.offset; n++; } if (n) this.commit({ noScroll: true }); return; }
        case 'resetAll': { let n = 0; M.walkDoc(d, (x) => { if (x.offset) { delete x.offset; n++; } }); if (n) { this.commit({ noScroll: true }); this.fit(); } else C.toast('No topics have been moved by hand.'); return; }
        case 'nudge': return this.nudge(arg);
        case 'floatingAt': { const n = M.createNode('Floating topic', { x: Math.round(arg.x - 60), y: Math.round(arg.y - 16) }); d.floating.push(n); return created(n); }
        case 'detach': { const id = this.primary(), t = this.L.nodes.get(id); if (t && M.detach(d, id, Math.round(t.x + 40), Math.round(t.y + 40))) this.commit(); return; }
        case 'fit': return this.fit();
        case 'zoomIn': return this.zoomAt(1.2);
        case 'zoomOut': return this.zoomAt(1 / 1.2);
        case 'zoomReset': { const r = this.rect(), v = this.view, cx = (r.width / 2 - v.x) / v.zoom, cy = (r.height / 2 - v.y) / v.zoom; this.view = { zoom: 1, x: r.width / 2 - cx, y: r.height / 2 - cy }; return this.applyView(); }
        case 'style': this.panel.hidden = !this.panel.hidden; if (!this.panel.hidden) this.renderPanel(); requestAnimationFrame(() => this.applyView()); return;
        case 'export': return this.exportMenu();
        case 'exportPNG': return this.exportAs('png');
        case 'exportSVG': return this.exportAs('svg');
        case 'copyImage': return this.copyImage();
        case 'marker': { const ns = this.selected(); if (!ns.length) return; ns.forEach((n) => M.toggleMarker(n, arg)); return this.commit({ noScroll: true }); }
        case 'task': { const ns = this.selected(); if (!ns.length) return; const nx = !ns[0].task ? 'todo' : ns[0].task === 'todo' ? 'done' : null; ns.forEach((n) => { if (nx) n.task = nx; else delete n.task; }); return this.commit({ noScroll: true }); }
        case 'done': return this.close();
        default: return undefined;
      }
    }
    style(patch) {
      const ns = this.selected();
      if (!ns.length) return C.toast('Select a topic first.');
      ns.forEach((n) => {
        n.style = Object.assign({}, n.style || {}, patch);
        for (const k of Object.keys(n.style)) if (n.style[k] == null || n.style[k] === '') delete n.style[k];
        if (!Object.keys(n.style).length) delete n.style;
      });
      this.commit({ noScroll: true });
    }
    settings(patch) { Object.assign(this.doc.settings, patch); this.commit({ noScroll: true }); requestAnimationFrame(() => this.fit()); }
    nudge(dir) {
      const key = this.doc.settings.layout, step = 10;
      const dx = dir === 'left' ? -step : dir === 'right' ? step : 0, dy = dir === 'up' ? -step : dir === 'down' ? step : 0;
      let moved = false;
      for (const id of this.topLevel(this.sel)) {
        const f = M.find(this.doc, id);
        if (!f || (!f.parent && !f.floating)) continue;
        if (f.floating && !f.parent) { f.node.x = (f.node.x || 0) + dx; f.node.y = (f.node.y || 0) + dy; moved = true; continue; }
        const k = f.floating ? 'float' : key;
        if (!f.floating && !Lay.canFreePosition(key, f.depth)) continue;
        const o = f.node.offset && f.node.offset.l === k ? f.node.offset : { x: 0, y: 0 };
        if (!(o.x + dx) && !(o.y + dy)) delete f.node.offset; else f.node.offset = { x: o.x + dx, y: o.y + dy, l: k };
        moved = true;
      }
      if (moved) this.commit();
    }
    async exportAs(kind) {
      const name = titleOf(this.doc).replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ').trim() || 'Mind map';
      try {
        if (kind === 'svg') await Exporter.save(name + '.svg', new Blob(['<?xml version="1.0" encoding="UTF-8"?>\n' + svgOf(this.doc).svg], { type: 'image/svg+xml' }));
        else await Exporter.save(name + '.png', await pngBlob(this.doc, 2));
      } catch (err) { C.toast(`Couldn’t export: ${err.message || err}`); }
    }
    async copyImage() {
      try {
        const png = await pngBlob(this.doc, 2);
        if (C.native && C.native.copyImage) {
          const b64 = (await blobToDataURL(png)).split(',')[1];
          const r = await C.native.copyImage(b64);
          if (r !== 'ok') throw new Error(r);
        } else await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
        C.toast('Mind map copied as a picture');
      } catch (err) { C.toast('Couldn’t copy the picture here. Use Export instead.'); }
    }

    // ---- keyboard ----
    onKey(e) {
      if (!this.box.isConnected) return;
      // everything typed while the editor is open belongs to it, never to the note behind
      const inside = this.box.contains(e.target) || e.target === document.body;
      if (!inside) return;
      e.stopPropagation();
      const mod = e.metaKey || e.ctrlKey, key = e.key;
      const done = (c, a) => { e.preventDefault(); this.cmd(c, a); };
      if (e.target === this.ed) {
        if (e.isComposing) return;
        if (key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.commitEdit(); return; }
        if (key === 'Tab') { e.preventDefault(); this.commitEdit(); this.cmd(e.shiftKey ? 'addSibling' : 'addChild'); return; }
        if (key === 'Escape') { e.preventDefault(); this.cancelEdit(); return; }
        if (mod && key.toLowerCase() === 'z') { e.preventDefault(); document.execCommand(e.shiftKey ? 'redo' : 'undo'); }
        return;
      }
      if (e.target.closest && e.target.closest('.mm-panel input, .mm-panel select')) { if (key === 'Escape') e.target.blur(); return; }
      if (key === 'Escape') {
        e.preventDefault();
        if (this.drag) return this.cancelDrag();
        if (!this.menuEl.hidden) return this.hideMenu();
        if (!this.panel.hidden) { this.panel.hidden = true; return this.applyView(); }
        return this.close();
      }
      if (mod) {
        const k = key.toLowerCase();
        if (k === 'z') return done(e.shiftKey ? 'redo' : 'undo');
        if (k === 'y') return done('redo');
        if (k === '0') return done('fit');
        if (k === '=' || k === '+') return done('zoomIn');
        if (k === '-') return done('zoomOut');
        if (k === '/' || e.code === 'Slash') return done('collapse');
        if (key === 'Enter') return done('addParent');
        if (/^[1-6]$/.test(k)) return done('marker', 'p' + k);
        if (k === 'b') { e.preventDefault(); const n = this.primaryNode(); const t = n && this.L.nodes.get(n.id); return this.style({ bold: !(t && t.box.style.bold) }); }
        if (k === 's') { e.preventDefault(); this.save(true); C.toast('Saved in the note'); }
        return;
      }
      if (e.altKey && e.shiftKey && key.startsWith('Arrow')) return done('nudge', key.slice(5).toLowerCase());
      if (e.altKey) {
        const m = { ArrowUp: 'moveUp', ArrowDown: 'moveDown', ArrowRight: 'indent', ArrowLeft: 'outdent' }[key];
        if (m) done(m);
        return;
      }
      switch (key) {
        case 'Tab': return done(e.shiftKey ? 'addParent' : 'addChild');
        case 'Enter': return done('addSibling', e.shiftKey ? 'before' : undefined);
        case 'Delete': case 'Backspace': return done('remove');
        case 'F2': case ' ': return done('edit');
        case 'ArrowRight': case 'ArrowLeft': case 'ArrowUp': case 'ArrowDown': e.preventDefault(); return this.navigate(key.slice(5).toLowerCase());
        default:
          if (key.length === 1 && this.sel.length === 1 && !e.isComposing) this.startEdit(this.primary(), { initial: '' });
      }
    }
    navigate(dir) {
      const cur = this.primary() && this.L.nodes.get(this.primary());
      if (!cur) return this.select(this.doc.root.id);
      const cx = cur.x + cur.w / 2, cy = cur.y + cur.h / 2;
      let best = null, bestScore = Infinity;
      for (const t of this.L.list) {
        if (t === cur) continue;
        const dx = t.x + t.w / 2 - cx, dy = t.y + t.h / 2 - cy;
        let main, cross;
        if (dir === 'right') { main = t.x - (cur.x + cur.w) >= -cur.w / 2 ? dx : -1; cross = dy; }
        else if (dir === 'left') { main = cur.x - (t.x + t.w) >= -cur.w / 2 ? -dx : -1; cross = dy; }
        else if (dir === 'down') { main = dy; cross = dx; } else { main = -dy; cross = dx; }
        if (main <= 2) continue;
        const related = t.parent === cur || cur.parent === t || (t.parent && t.parent === cur.parent);
        const score = main + Math.abs(cross) * 2.2 - (related ? 30 : 0);
        if (score < bestScore) { bestScore = score; best = t; }
      }
      if (best) this.select(best.id);
    }

    // ---- pointer: select, pan, pinch, drag ----
    idAt(el) { const g = el && el.closest && el.closest('.node'); return g ? g.getAttribute('data-id') : null; }
    onDown(e) {
      if (e.target === this.ed) return;
      this.hideMenu();
      if (this.editing) this.commitEdit();
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.pointers.size === 2) {
        // second finger: pinch to zoom (and pan), cancelling any drag the first finger started
        this.cancelDrag(); this.pan = null; this.marquee = null;
        const [a, b] = [...this.pointers.values()];
        this.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), z: this.view.zoom, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, vx: this.view.x, vy: this.view.y };
        return;
      }
      if (e.button === 2) return;
      this.stage.focus({ preventScroll: true });
      const id = this.idAt(e.target), act = e.target.closest && e.target.closest('[data-act]');
      if (id && act && act.dataset.act === 'toggle') { M.setCollapsed(this.doc, id); this.sel = [id]; return this.commit({ noScroll: true }); }
      if (id && act && act.dataset.act === 'task') { const n = M.getNode(this.doc, id); n.task = n.task === 'done' ? 'todo' : 'done'; return this.commit({ noScroll: true }); }
      if (id) {
        if (e.shiftKey || e.metaKey || e.ctrlKey) return this.select(id, { toggle: true, noScroll: true });
        const inMulti = this.sel.includes(id) && this.sel.length > 1;
        // on touch screens there is no keyboard to start typing: tapping the selected topic again edits it
        const tapToEdit = e.pointerType !== 'mouse' && this.sel.length === 1 && this.sel[0] === id;
        if (!inMulti && !this.sel.includes(id)) this.select(id, { noScroll: true });
        this.drag = { id, sx: e.clientX, sy: e.clientY, started: false, narrow: inMulti, tapToEdit };
        return;
      }
      if (e.shiftKey) { this.marquee = { sx: e.clientX, sy: e.clientY, base: this.sel.slice(), box: null }; try { this.stage.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ } return; }
      this.pan = { sx: e.clientX, sy: e.clientY, vx: this.view.x, vy: this.view.y, moved: false };
    }
    onMove(e) {
      if (this.pointers.has(e.pointerId)) this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.pinch && this.pointers.size >= 2) {
        const [a, b] = [...this.pointers.values()], p = this.pinch;
        const z = Math.max(0.1, Math.min(4, p.z * (Math.hypot(a.x - b.x, a.y - b.y) / Math.max(1, p.d))));
        const r = this.rect(), mx = (a.x + b.x) / 2 - r.left, my = (a.y + b.y) / 2 - r.top, ox = p.mx - r.left, oy = p.my - r.top;
        const wx = (ox - p.vx) / p.z, wy = (oy - p.vy) / p.z;
        this.view = { zoom: z, x: mx - wx * z, y: my - wy * z };
        return this.applyView();
      }
      if (this.pan) {
        const dx = e.clientX - this.pan.sx, dy = e.clientY - this.pan.sy;
        if (!this.pan.moved && Math.abs(dx) + Math.abs(dy) > 3) { this.pan.moved = true; try { this.stage.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ } this.stage.classList.add('panning'); }
        if (!this.pan.moved) return;
        this.view.x = this.pan.vx + dx; this.view.y = this.pan.vy + dy;
        return this.applyView();
      }
      if (this.marquee) {
        const a = this.toWorld(this.marquee.sx, this.marquee.sy), b = this.toWorld(e.clientX, e.clientY);
        const m = this.marquee.box = { x1: Math.min(a.x, b.x), y1: Math.min(a.y, b.y), x2: Math.max(a.x, b.x), y2: Math.max(a.y, b.y) };
        const z = this.view.zoom;
        this.dl.innerHTML = `<rect x="${m.x1}" y="${m.y1}" width="${m.x2 - m.x1}" height="${m.y2 - m.y1}" fill="#e5a400" fill-opacity="0.1" stroke="#e5a400" stroke-width="${1.3 / z}" stroke-dasharray="${4 / z} ${3 / z}"/>`;
        return;
      }
      const d = this.drag;
      if (!d) return;
      if (!d.started) {
        if (Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < 5) return;
        if (d.id === this.doc.root.id) { this.drag = null; return; }
        this.beginDrag(e);
        if (!this.drag) return;
      }
      d.cx = e.clientX; d.cy = e.clientY;
      if (!this.frame) this.frame = requestAnimationFrame(() => { this.frame = 0; this.dragStep(); });
    }
    onUp(e, cancelled) {
      this.pointers.delete(e.pointerId);
      if (this.pinch) { if (this.pointers.size < 2) this.pinch = null; return; }
      this.stage.classList.remove('panning');
      if (this.pan) { if (!this.pan.moved && !e.shiftKey && !cancelled) this.select([]); this.pan = null; return; }
      if (this.marquee) {
        const m = this.marquee.box, base = this.marquee.base;
        this.marquee = null; this.dl.innerHTML = '';
        if (m) this.select([...new Set(base.concat(this.L.list.filter((t) => t.x < m.x2 && t.x + t.w > m.x1 && t.y < m.y2 && t.y + t.h > m.y1).map((t) => t.id)))], { noScroll: true });
        return;
      }
      const d = this.drag;
      if (d && !d.started) { this.drag = null; if (d.narrow) this.select(d.id, { noScroll: true }); else if (d.tapToEdit && !cancelled) this.startEdit(d.id); return; }
      if (d) this.endDrag(!!cancelled);
    }
    onWheel(e) {
      e.preventDefault();
      if (this.editing) this.commitEdit();
      const r = this.rect();
      if (e.ctrlKey || e.metaKey) this.zoomAt(Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0035)), e.clientX - r.left, e.clientY - r.top);
      else { const k = e.deltaMode === 1 ? 16 : 1; this.view.x -= (e.shiftKey && !e.deltaX ? e.deltaY : e.deltaX) * k; this.view.y -= (e.shiftKey && !e.deltaX ? 0 : e.deltaY) * k; this.applyView(); }
    }
    onDbl(e) {
      if (e.target === this.ed) return;
      const id = this.idAt(e.target);
      if (id) { if (!e.target.closest('[data-act]')) this.startEdit(id); return; }
      this.cmd('floatingAt', this.toWorld(e.clientX, e.clientY));
    }

    // drag: a topic dropped on empty canvas stays attached and is drawn where it was dropped;
    // dropped on a topic it moves there; close to its home slot it snaps back
    canFree(id, d) {
      const o = d.orig.get(id);
      if (!o) return false;
      if (o.floatingRoot) return true;
      const f = M.find(this.doc, id);
      if (f && f.floating) return true;
      return Lay.canFreePosition(d.key, o.depth);
    }
    beginDrag(e) {
      const d = this.drag, doc = this.doc;
      d.started = true;
      try { this.stage.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      const ids = this.sel.includes(d.id) && this.sel.length > 1 ? this.topLevel(this.sel) : [d.id];
      d.ids = ids.filter((id) => id !== doc.root.id && M.find(doc, id));
      if (!d.ids.length) { this.drag = null; return; }
      d.exclude = new Set();
      for (const id of d.ids) M.walk(M.getNode(doc, id), (n) => { d.exclude.add(n.id); });
      d.key = doc.settings.layout;
      d.orig = new Map();
      for (const id of d.ids) {
        const f = M.find(doc, id), n = f.node;
        d.orig.set(id, { floatingRoot: f.floating && !f.parent, x: n.x, y: n.y, offset: n.offset ? Object.assign({}, n.offset) : null, depth: f.depth + (f.floating ? 1 : 0) });
      }
      const t = this.L.nodes.get(d.id);
      d.t0 = { x: t.x, y: t.y };
      const home = layoutOf(doc, { ignoreOffsetId: d.id }).nodes.get(d.id);
      d.home = home ? { x: home.x, y: home.y, w: home.w, h: home.h } : null;
      d.json = JSON.stringify(doc);
      this.dragging = true;
      this.stage.classList.add('dragging');
    }
    dragStep() {
      const d = this.drag;
      if (!d || !d.started) return;
      const w = this.toWorld(d.cx, d.cy), s = this.toWorld(d.sx, d.sy);
      d.world = w; const dx = w.x - s.x, dy = w.y - s.y;
      d.drop = this.findDrop(w, d);
      d.flip = d.drop ? null : this.sideFlip(w, d);
      d.snapped = false;
      for (const id of d.ids) {
        const o = d.orig.get(id), n = M.getNode(this.doc, id);
        if (!n) continue;
        if (o.floatingRoot) { n.x = Math.round((o.x || 0) + dx); n.y = Math.round((o.y || 0) + dy); continue; }
        if (!this.canFree(id, d)) continue;
        const key = M.find(this.doc, id).floating ? 'float' : d.key;
        const base = o.offset && o.offset.l === key ? o.offset : { x: 0, y: 0 };
        let ox = base.x + dx, oy = base.y + dy;
        if (id === d.id && d.home && d.ids.length === 1) {
          const lx = d.t0.x + dx - d.home.x, ly = d.t0.y + dy - d.home.y;
          if (Math.abs(lx) < 10 && Math.abs(ly) < 10) { ox -= lx; oy -= ly; d.snapped = true; }
        }
        if (Math.abs(ox) < 0.5 && Math.abs(oy) < 0.5) delete n.offset; else n.offset = { x: Math.round(ox), y: Math.round(oy), l: key };
      }
      this.render();
      for (const id of d.exclude) { const g = this.vp.querySelector(`.node[data-id="${id}"]`); if (g) g.classList.add('dragging'); }
      this.drawHints(d);
    }
    findDrop(w, d) {
      let best = null;
      for (const t of this.L.list) {
        if (d.exclude.has(t.id)) continue;
        if (w.x < t.x - 6 || w.x > t.x + t.w + 6 || w.y < t.y - 6 || w.y > t.y + t.h + 6) continue;
        if (best && best.w * best.h < t.w * t.h) continue;
        best = t;
      }
      if (!best) return null;
      const t = best, f = M.find(this.doc, t.id), lay = this.doc.settings.layout;
      if (!f.parent) return { type: 'child', t, side: lay === 'mindmap' && t.id === this.doc.root.id ? (w.x < t.x + t.w / 2 ? 'left' : 'right') : null };
      const vertical = t.dir === 'd' || t.dir === 'u' || (t.depth === 1 && (lay === 'down' || lay === 'up' || lay === 'timeline'));
      const rel = vertical ? (w.x - t.x) / t.w : (w.y - t.y) / t.h;
      if (rel < 0.25) return { type: 'before', t, vertical };
      if (rel > 0.75) return { type: 'after', t, vertical };
      return { type: 'child', t };
    }
    sideFlip(w, d) {
      if (d.key !== 'mindmap' || d.ids.length !== 1) return null;
      const f = M.find(this.doc, d.id);
      if (!f || f.floating || f.depth !== 1) return null;
      const r = this.L.nodes.get(this.doc.root.id), cur = (this.L.nodes.get(d.id) || {}).side || f.node.side;
      const side = w.x < r.x + r.w / 2 ? 'left' : 'right';
      return side !== cur ? side : null;
    }
    drawHints(d) {
      const c = '#e5a400';
      let h = '';
      if (d.home && !d.drop && d.ids.length === 1 && this.canFree(d.id, d) && !d.orig.get(d.id).floatingRoot) {
        const m = d.home;
        h += `<rect x="${m.x - 3}" y="${m.y - 3}" width="${m.w + 6}" height="${m.h + 6}" rx="9" fill="none" stroke="${c}" stroke-opacity="${d.snapped ? 0.95 : 0.4}" stroke-width="${d.snapped ? 2.5 : 1.5}" stroke-dasharray="5 4"/>`;
      }
      if (d.drop) {
        const t = d.drop.t;
        if (d.drop.type === 'child') h += `<rect x="${t.x - 6}" y="${t.y - 6}" width="${t.w + 12}" height="${t.h + 12}" rx="10" fill="${c}" fill-opacity="0.14" stroke="${c}" stroke-width="2.5" stroke-dasharray="6 4"/>`;
        else if (d.drop.vertical) { const x = d.drop.type === 'before' ? t.x - 8 : t.x + t.w + 8; h += `<path d="M${x} ${t.y - 4} V${t.y + t.h + 4}" stroke="${c}" stroke-width="4" stroke-linecap="round"/>`; }
        else { const y = d.drop.type === 'before' ? t.y - 7 : t.y + t.h + 7; h += `<path d="M${t.x - 4} ${y} H${t.x + t.w + 4}" stroke="${c}" stroke-width="4" stroke-linecap="round"/>`; }
      } else if (d.flip) {
        const r = this.L.nodes.get(this.doc.root.id), x = d.flip === 'left' ? r.x - 14 : r.x + r.w + 14;
        h += `<path d="M${x} ${r.y - 10} V${r.y + r.h + 10}" stroke="${c}" stroke-width="4" stroke-linecap="round"/>`;
      }
      this.dl.innerHTML = h;
    }
    cancelDrag() { if (this.drag && this.drag.started) this.endDrag(true); else this.drag = null; }
    endDrag(cancel) {
      const d = this.drag;
      cancelAnimationFrame(this.frame); this.frame = 0;
      if (d && d.started && !cancel && d.cx != null) this.dragStep();
      this.drag = null; this.dragging = false;
      this.stage.classList.remove('dragging');
      this.dl.innerHTML = '';
      if (!d || !d.started) return;
      if (cancel) { this.doc = JSON.parse(d.json); this.render(); return; }
      const doc = this.doc;
      const restore = () => {
        for (const id of d.ids) {
          const o = d.orig.get(id), n = M.getNode(doc, id);
          if (!n) continue;
          if (o.floatingRoot) { n.x = o.x; n.y = o.y; }
          if (o.offset) n.offset = Object.assign({}, o.offset); else delete n.offset;
        }
      };
      let changed = false;
      if (d.drop) {
        restore();
        const t = d.drop.t;
        if (d.drop.type === 'child') {
          for (const id of d.ids) if (M.move(doc, id, t.id)) { changed = true; const n = M.getNode(doc, id); if (d.drop.side) n.side = d.drop.side; else delete n.side; }
        } else {
          for (const id of (d.drop.type === 'after' ? d.ids.slice().reverse() : d.ids)) {
            const f = M.find(doc, id), tf = M.find(doc, t.id);
            if (!tf || !tf.parent) break;
            let idx = tf.index + (d.drop.type === 'after' ? 1 : 0);
            if (f.parent && f.parent.id === tf.parent.id && f.index < idx) idx--;
            if (M.move(doc, id, tf.parent.id, idx)) { changed = true; const n = M.getNode(doc, id); if (tf.node.side) n.side = tf.node.side; else delete n.side; }
          }
        }
      } else if (d.flip) {
        restore();
        const n = M.getNode(doc, d.id), kids = doc.root.children.filter((c) => c !== n);
        const vis = (side) => { const a = kids.filter((c) => (c.side || 'right') === side).map((c) => ({ c, t: this.L.nodes.get(c.id) })); return side === 'left' ? a.reverse() : a; };
        const rightV = vis('right'), leftV = vis('left'), target = d.flip === 'left' ? leftV : rightV;
        let at = target.findIndex((v) => v.t && d.world.y < v.t.y + v.t.h / 2);
        if (at < 0) at = target.length;
        target.splice(at, 0, { c: n });
        n.side = d.flip; delete n.offset;
        doc.root.children = rightV.map((v) => v.c).concat(leftV.reverse().map((v) => v.c));
        changed = true;
      } else {
        if (!d.ids.some((id) => this.canFree(id, d))) {
          restore();
          C.toast(d.key === 'timeline' ? 'Timeline topics stay on the axis. Drop onto a topic to move it, or drag a subtopic freely.' : 'This structure keeps topics in place. Drop onto a topic to move it there.');
        }
        changed = JSON.stringify(doc) !== d.json;
      }
      if (changed) this.commit({ noScroll: true }); else this.render();
    }

    // ---- context menu ----
    hideMenu() { this.menuEl.hidden = true; }
    showMenu(items, x, y) {
      const m = this.menuEl;
      m.innerHTML = items.map((it, i) => (it === '-' ? '<div class="mm-msep"></div>' : `<button class="mm-mi" data-i="${i}"${it.disabled ? ' disabled' : ''}><span>${it.label}</span>${it.kb ? `<kbd>${it.kb}</kbd>` : ''}</button>`)).join('');
      m.hidden = false;
      const r = m.getBoundingClientRect();
      m.style.left = Math.min(x, innerWidth - r.width - 8) + 'px';
      m.style.top = Math.min(y, innerHeight - r.height - 8) + 'px';
      m.onclick = (e) => { const b = e.target.closest('[data-i]'); if (!b) return; e.stopPropagation(); this.hideMenu(); const it = items[+b.dataset.i]; if (it && it.run) it.run(); };
    }
    onContext(e) {
      e.preventDefault();
      if (this.editing) this.commitEdit();
      const id = this.idAt(e.target), run = (c, a) => () => this.cmd(c, a);
      if (id) {
        if (!this.sel.includes(id)) this.select(id, { noScroll: true });
        const n = M.getNode(this.doc, id), f = M.find(this.doc, id), isRoot = id === this.doc.root.id;
        return this.showMenu([
          { label: 'Add subtopic', kb: 'Tab', run: run('addChild') },
          { label: 'Add topic', kb: 'Enter', run: run('addSibling') },
          { label: 'Add parent topic', kb: K('Mod+Enter'), run: run('addParent'), disabled: isRoot || !f.parent },
          { label: 'Edit text', kb: 'F2', run: run('edit') },
          '-',
          { label: n.collapsed ? 'Expand branch' : 'Collapse branch', kb: K('Mod+/'), run: run('collapse'), disabled: !n.children.length },
          { label: n.task ? 'Change task state' : 'Make it a task', run: run('task') },
          { label: 'Reset position', run: run('resetPosition'), disabled: !n.offset },
          { label: 'Detach as floating topic', run: run('detach'), disabled: isRoot || !f.parent },
          { label: 'Style…', run: () => { this.panel.hidden = false; this.renderPanel(); this.applyView(); } },
          '-',
          { label: 'Delete', kb: 'Del', run: run('remove'), disabled: isRoot },
        ], e.clientX, e.clientY);
      }
      const pt = this.toWorld(e.clientX, e.clientY);
      this.showMenu([
        { label: 'New floating topic here', run: () => this.cmd('floatingAt', pt) },
        { label: 'Fit map to window', kb: K('Mod+0'), run: run('fit') },
        { label: 'Reset hand-placed topics', run: run('resetAll') },
        '-',
        { label: 'Save as PNG…', run: run('exportPNG') },
        { label: 'Save as SVG…', run: run('exportSVG') },
      ], e.clientX, e.clientY);
    }
    exportMenu() {
      const b = this.box.querySelector('[data-c="export"]').getBoundingClientRect();
      this.showMenu([
        { label: 'Save as PNG picture…', run: () => this.cmd('exportPNG') },
        { label: 'Save as SVG (vector)…', run: () => this.cmd('exportSVG') },
        { label: 'Copy as picture', run: () => this.cmd('copyImage') },
      ], b.left, b.bottom + 4);
    }

    // ---- style panel ----
    preview(patch, key) {
      this.previews = this.previews || new Map();
      if (this.previews.has(key)) return this.previews.get(key);
      const d = M.createDoc('Idea');
      const a = M.addChild(d, d.root.id, 'Plan'), b = M.addChild(d, d.root.id, 'Build'), c = M.addChild(d, d.root.id, 'Share');
      M.addChild(d, a.id, 'Goals'); M.addChild(d, b.id, 'Code'); M.addChild(d, b.id, 'Test'); M.addChild(d, c.id, 'Blog');
      Object.assign(d.settings, patch);
      const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgOf(d, { padding: 14 }).svg);
      this.previews.set(key, url);
      return url;
    }
    renderPanel() {
      const s = this.doc.settings, n = this.primaryNode(), t = n && this.L.nodes.get(n.id), st = t ? t.box.style : null;
      const img = (url) => `<img src="${url}" alt="">`;
      const sw = (key, list, cur) => `<div class="mm-sw">${list.map((c) => `<button data-sw="${key}" data-v="${c}" class="${cur === c ? 'on' : ''}${c === 'transparent' ? ' none' : ''}" style="background:${c}" title="${c}"></button>`).join('')}<label class="mm-custom" title="Custom colour"><input type="color" data-key="${key}" value="${/^#[0-9a-f]{6}$/i.test(cur || '') ? cur : '#e5a400'}"></label></div>`;
      const has = new Set((n && n.icons) || []);
      this.panel.innerHTML = `
        <div class="mm-ph"><b>Style</b><button class="icon-btn" data-c="style" aria-label="Close">✕</button></div>
        <div class="mm-sec"><h4>Map style</h4><div class="mm-grid c3">${T.MAP_STYLES.map((m) => `<button class="mm-card${s.layout === m.layout && s.lineStyle === m.lineStyle && s.shapes.main === m.shapes.main ? ' on' : ''}" data-p="mapstyle" data-v="${m.id}">${img(this.preview({ layout: m.layout, lineStyle: m.lineStyle, shapes: m.shapes, theme: s.theme, font: m.font || s.font }, 'ms' + m.id + s.theme))}<span>${m.name}</span></button>`).join('')}</div></div>
        <div class="mm-sec"><h4>Colour theme</h4><div class="mm-grid c2">${T.THEMES.map((th) => `<button class="mm-card${s.theme === th.id ? ' on' : ''}" data-p="theme" data-v="${th.id}">${img(this.preview({ theme: th.id, lineStyle: s.lineStyle, shapes: s.shapes }, 'th' + th.id + s.lineStyle + JSON.stringify(s.shapes)))}<span>${th.name}</span></button>`).join('')}</div></div>
        <div class="mm-sec"><h4>Structure</h4><div class="mm-grid c3">${T.LAYOUTS.map((l) => `<button class="mm-card${s.layout === l.id ? ' on' : ''}" data-p="layout" data-v="${l.id}" title="${l.name}">${img(this.preview({ layout: l.id, theme: 'classic', lineStyle: l.id === 'down' || l.id === 'up' ? 'elbow' : 'curve' }, 'ly' + l.id))}<span>${l.name.replace(/ \(.*\)/, '')}</span></button>`).join('')}</div></div>
        <div class="mm-sec"><h4>Branch lines</h4><div class="mm-seg">${T.LINE_STYLES.map((l) => `<button data-p="lineStyle" data-v="${l.id}" class="${s.lineStyle === l.id ? 'on' : ''}">${l.name.split(' ')[0]}</button>`).join('')}</div>
          <div class="mm-seg" style="margin-top:6px"><button data-p="rainbow" data-v="" class="${s.rainbow == null ? 'on' : ''}">Theme colours</button><button data-p="rainbow" data-v="on" class="${s.rainbow === true ? 'on' : ''}">Rainbow</button><button data-p="rainbow" data-v="off" class="${s.rainbow === false ? 'on' : ''}">Single colour</button></div></div>
        <div class="mm-sec"><h4>Background</h4><div class="mm-grid c4">${T.PATTERNS.map((p) => { const pc = R.patternCSS(p.id, themeOf(this.doc).ink, 1, 0, 0); return `<button class="mm-card${s.pattern === p.id ? ' on' : ''}" data-p="pattern" data-v="${p.id}"><i style="background-color:${themeOf(this.doc).bg};background-image:${pc.image};background-size:${pc.size}"></i><span>${p.name}</span></button>`; }).join('')}</div></div>
        <div class="mm-sec"><h4>Selected topic${n ? '' : ' <small>(select one)</small>'}</h4>
          <div class="mm-grid c4">${T.SHAPES.map((x) => `<button class="mm-card sm${st && st.shape === x.id ? ' on' : ''}" data-st="shape" data-v="${x.id}"${n ? '' : ' disabled'}><span>${x.name}</span></button>`).join('')}</div>
          <h5>Fill</h5>${sw('fill', T.SWATCHES.slice(0, 20).concat(['transparent']), n && n.style && n.style.fill)}
          <h5>Text colour</h5>${sw('color', ['#000000', '#495057', '#ffffff', '#e03131', '#f76707', '#f59f00', '#2f9e44', '#1c7ed6', '#6741d9', '#c2255c'], n && n.style && n.style.color)}
          <div class="mm-row"><button class="pl-btn" data-st="bold"${n ? '' : ' disabled'}><b>B</b> Bold</button><button class="pl-btn" data-st="reset"${n ? '' : ' disabled'}>Reset style</button></div></div>
        <div class="mm-sec"><h4>Markers</h4>${T.MARKER_GROUPS.map((g) => `<div class="mm-mk">${g.items.map((m) => `<button data-mk="${esc(m)}" class="${has.has(m) ? 'on' : ''}" title="${esc(m)}"${n ? '' : ' disabled'}><svg viewBox="0 0 24 24">${R.markerSVG('marker', m, 2, 2, 20, '#333')}</svg></button>`).join('')}</div>`).join('')}</div>
        <div class="mm-sec"><button class="pl-btn" data-c="resetAll">Reset hand-placed topics</button></div>`;
    }
    onPanelClick(e) {
      const b = e.target.closest('button');
      if (!b || b.disabled) return;
      if (b.dataset.c) return; // handled by the toolbar delegate
      const v = b.dataset.v;
      if (b.dataset.p === 'theme') return this.settings({ theme: v, rainbow: null });
      if (b.dataset.p === 'layout') return this.settings({ layout: v });
      if (b.dataset.p === 'pattern') return this.settings({ pattern: v });
      if (b.dataset.p === 'lineStyle') return this.settings({ lineStyle: v });
      if (b.dataset.p === 'rainbow') return this.settings({ rainbow: v === '' ? null : v === 'on' });
      if (b.dataset.p === 'mapstyle') { const m = T.MAP_STYLES.find((x) => x.id === v); return this.settings({ layout: m.layout, lineStyle: m.lineStyle, shapes: Object.assign({}, m.shapes), font: m.font || 'system' }); }
      if (b.dataset.sw) return this.style({ [b.dataset.sw]: v });
      if (b.dataset.st === 'shape') return this.style({ shape: v });
      if (b.dataset.st === 'bold') { const n = this.primaryNode(), t = n && this.L.nodes.get(n.id); return this.style({ bold: !(t && t.box.style.bold) }); }
      if (b.dataset.st === 'reset') { this.selected().forEach((n) => delete n.style); return this.commit({ noScroll: true }); }
      if (b.dataset.mk) return this.cmd('marker', b.dataset.mk);
    }
  }

  window.MindMap = {
    init(core) { C = core; },
    renderBlock, serializeBlock, exportBlock, insertBlank, insertFromNote, docFromNote, readMap, searchText, pngBlob,
    isOpen: () => !!current,
    _current: () => current,
  };
})();
