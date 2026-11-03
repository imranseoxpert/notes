/* Planner: Today, Upcoming, Calendar, Tasks, Events, the Inbox panel, the ⌘K quick launcher and reminders.
   It shares state, saving and Google Drive sync with app.js through the `core` object passed to Planner.init(). */
(() => {
  'use strict';
  let C = null;                                   // core API from app.js
  const qs = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const VIEWS = ['today', 'upcoming', 'calendar', 'tasks', 'reminders', 'events'];
  const PREF_KEY = 'notes-app-v1-planner', REMINDED_KEY = 'notes-app-v1-reminded', SNOOZE_KEY = 'notes-app-v1-snoozed';
  const readLS = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) || d; } catch { return d; } };
  const writeLS = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
  const prefs = Object.assign({ cal: innerWidth < 900 ? 'day' : 'week', taskView: 'list', taskGroup: 'status', remView: 'list', inbox: innerWidth > 1250, showDone: false }, readLS(PREF_KEY, {}));
  const savePrefs = () => writeLS(PREF_KEY, prefs);

  // ---------- dates (all dates are local 'YYYY-MM-DD' strings, times 'HH:MM') ----------
  const pad = (n) => String(n).padStart(2, '0');
  const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parseYmd = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const addDays = (d, n) => { const x = new Date(typeof d === 'string' ? parseYmd(d) : d); x.setDate(x.getDate() + n); return x; };
  const todayStr = () => ymd(new Date());
  const nowHM = () => { const d = new Date(); return pad(d.getHours()) + ':' + pad(d.getMinutes()); };
  const mins = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  const hm = (m) => pad(Math.floor(m / 60) % 24) + ':' + pad(m % 60);
  const dateAt = (date, time) => { const d = parseYmd(date); if (time) { const [h, m] = time.split(':').map(Number); d.setHours(h, m, 0, 0); } return d; };
  const fmtTime = (t) => (t ? new Date(2000, 0, 1, ...t.split(':').map(Number)).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '');
  const shortDate = (s) => parseYmd(s).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  function dayLabel(s) {
    const t = todayStr();
    if (s === t) return 'Today';
    if (s === ymd(addDays(t, 1))) return 'Tomorrow';
    if (s === ymd(addDays(t, -1))) return 'Yesterday';
    const diff = Math.round((parseYmd(s) - parseYmd(t)) / 864e5);
    if (diff > 1 && diff < 7) return parseYmd(s).toLocaleDateString([], { weekday: 'long' });
    return shortDate(s);
  }
  const firstDay = (() => {                         // first day of the week for this locale (0 = Sunday)
    try { const l = new Intl.Locale(navigator.language); const w = (l.getWeekInfo && l.getWeekInfo()) || l.weekInfo; if (w) return w.firstDay % 7; } catch {}
    return 1;
  })();
  const weekStart = (s) => { const d = parseYmd(s); return ymd(addDays(d, -((d.getDay() - firstDay + 7) % 7))); };

  // ---------- data ----------
  const S = () => C.state();
  const allTasks = () => S().tasks.filter((t) => !t.deleted);
  const allEvents = () => S().events.filter((e) => !e.deleted);
  const findTask = (id) => S().tasks.find((t) => t.id === id && !t.deleted);
  const findEvent = (id) => S().events.find((e) => e.id === id && !e.deleted);
  const touch = (x) => { x.updated = Date.now(); };
  const repeating = (x) => x.repeat && x.repeat !== 'none';
  function commit() { C.persist(); C.renderSidebar(); render(); if (window.Blocks) Blocks.refreshLive(); }

  function advance(date, repeat) {
    const d = parseYmd(date);
    switch (repeat) {
      case 'daily': d.setDate(d.getDate() + 1); break;
      case 'weekdays': do { d.setDate(d.getDate() + 1); } while (d.getDay() === 0 || d.getDay() === 6); break;
      case 'weekly': d.setDate(d.getDate() + 7); break;
      case 'monthly': { const day = d.getDate(); d.setDate(1); d.setMonth(d.getMonth() + 1); d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate())); break; }
      case 'yearly': d.setFullYear(d.getFullYear() + 1); break;
      default: d.setDate(d.getDate() + 1);
    }
    return ymd(d);
  }
  function occursOn(e, date) {
    if (!repeating(e)) return e.date === date;
    if (date < e.date) return false;
    const a = parseYmd(e.date), b = parseYmd(date);
    switch (e.repeat) {
      case 'daily': return true;
      case 'weekdays': return b.getDay() > 0 && b.getDay() < 6;
      case 'weekly': return a.getDay() === b.getDay();
      case 'monthly': return a.getDate() === b.getDate();
      case 'yearly': return a.getDate() === b.getDate() && a.getMonth() === b.getMonth();
    }
    return false;
  }
  const sortEntries = (a, b) => (Number(!!a.item.done) - Number(!!b.item.done)) || (a.time || '').localeCompare(b.time || '') || (b.item.priority || 0) - (a.item.priority || 0);
  function itemsOn(date) {
    const ev = allEvents().filter((e) => occursOn(e, date)).map((e) => ({ kind: 'event', item: e, date, time: e.allDay ? '' : e.start }));
    const tk = allTasks().filter((t) => t.due === date).map((t) => ({ kind: 'task', item: t, date, time: t.time || '' }));
    return ev.concat(tk).sort(sortEntries);
  }
  const overdueTasks = () => { const t = todayStr(); return allTasks().filter((x) => !x.done && x.due && x.due < t).sort((a, b) => a.due.localeCompare(b.due)); };

  function toggleTask(t) {
    if (!t.done && repeating(t)) {                 // habit: log it, bump the streak, roll the due date forward
      const today = todayStr();
      const due = t.due || today;
      t.streak = due >= today ? (t.streak || 0) + 1 : 1;
      t.history = (t.history || []).concat(today).slice(-400);
      let next = advance(due, t.repeat);
      while (next <= today) next = advance(next, t.repeat);
      t.due = next;
      (t.subtasks || []).forEach((s) => { s.done = false; });
      t.status = 'todo';
      toast(`🔥 ${t.streak} — next: ${dayLabel(next)}`);
    } else {
      t.done = !t.done;
      t.status = t.done ? 'done' : 'todo';
      t.doneAt = t.done ? Date.now() : null;
    }
    touch(t); commit(); refreshDetail();
  }

  function newTask(fields = {}) {
    const now = Date.now();
    const t = Object.assign({ id: C.uid(), title: '', notes: '', due: null, time: null, remind: null, repeat: null, priority: 0, status: 'todo',
      done: false, tags: [], subtasks: [], noteId: null, created: now, updated: now }, fields);
    S().tasks.push(t);
    return t;
  }
  function newEvent(fields = {}) {
    const now = Date.now();
    const start = fields.start || hm(Math.min(23 * 60, (new Date().getHours() + 1) * 60));
    const e = Object.assign({ id: C.uid(), title: '', notes: '', date: todayStr(), start, end: hm(Math.min(mins(start) + 60, 23 * 60 + 59)),
      allDay: false, repeat: null, remind: 10, link: '', location: '', tags: [], noteId: null, created: now, updated: now }, fields);
    S().events.push(e);
    return e;
  }
  function removeItem(kind, it) {
    const list = kind === 'task' ? S().tasks : S().events;
    if (it.sv === undefined) list.splice(list.indexOf(it), 1);  // never synced: just drop it
    else { it.deleted = true; touch(it); }                      // tombstone so other devices remove it too
  }

  // ---------- natural-language quick add ----------
  const WD = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  const MONRE = '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';
  const WDFULL = '(sunday|monday|tuesday|wednesday|thursday|friday|saturday)';
  const WDSHORT = '(sun|mon|tues?|wed|thu(?:rs?)?|fri|sat)';
  function toHM(h, m, ap) {
    h = +h; m = +(m || 0); ap = (ap || '').replace(/\./g, '').toLowerCase();
    if (ap === 'pm' && h < 12) h += 12;
    if (ap === 'am' && h === 12) h = 0;
    return h > 23 || m > 59 ? null : pad(h) + ':' + pad(m);
  }
  function nextWeekday(name, includeToday) {
    const target = WD.indexOf(name.slice(0, 3).toLowerCase());
    const d = new Date(); d.setHours(0, 0, 0, 0);
    let diff = (target - d.getDay() + 7) % 7;
    if (diff === 0 && !includeToday) diff = 7;
    return ymd(addDays(d, diff));
  }
  function parseQuick(text) {
    let s = ' ' + String(text).replace(/\s+/g, ' ') + ' ';
    const p = { type: null, title: '', date: null, time: null, end: null, priority: 0, tags: [], repeat: null, tokens: 0 };
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const take = (re, fn) => {
      s = s.replace(re, (...m) => {
        if (fn(m) === false) return m[0];
        p.tokens++;
        return ' ';
      });
    };
    const setMD = (mon, day, year) => {
      const mi = MONTHS.indexOf(mon.slice(0, 3).toLowerCase());
      let d = new Date(year ? +year : today.getFullYear(), mi, +day);
      if (d.getDate() !== +day) return false;
      if (!year && d < today) d = new Date(today.getFullYear() + 1, mi, +day);
      p.date = ymd(d);
    };
    take(/^\s(?:(?:new|add|create)\s+)?(task|todo|to-do|event|note)\s/i, (m) => { p.type = /event/i.test(m[1]) ? 'event' : /note/i.test(m[1]) ? 'note' : 'task'; });
    take(/\s(?:every\s?day|daily)(?=\s)/i, () => { p.repeat = 'daily'; });
    take(/\s(?:every\s+weekday|weekdays)(?=\s)/i, () => { p.repeat = 'weekdays'; });
    take(new RegExp(`\\severy\\s+(?:${WDFULL}|${WDSHORT})(?=\\s)`, 'i'), (m) => { p.repeat = 'weekly'; p.date = nextWeekday(m[1] || m[2], true); });
    take(/\s(?:every\s+week|weekly)(?=\s)/i, () => { p.repeat = 'weekly'; });
    take(/\s(?:every\s+month|monthly)(?=\s)/i, () => { p.repeat = 'monthly'; });
    take(/\s(?:every\s+year|yearly|annually)(?=\s)/i, () => { p.repeat = 'yearly'; });
    take(/\s(?:the\s+)?day after tomorrow(?=\s)/i, () => { p.date = ymd(addDays(today, 2)); });
    take(/\s(today|tonight)(?=\s)/i, (m) => { p.date = ymd(today); if (/tonight/i.test(m[1])) p.tonight = true; });
    take(/\s(?:tomorrow|tmrw?|tmr)(?=\s)/i, () => { p.date = ymd(addDays(today, 1)); });
    take(/\s(?:yesterday)(?=\s)/i, () => { p.date = ymd(addDays(today, -1)); });
    take(/\snext\s+week(?=\s)/i, () => { p.date = nextWeekday('mon', false); });
    take(/\sin\s+(\d+)\s*(day|week|month)s?(?=\s)/i, (m) => {
      const d = new Date(today), n = +m[1];
      if (/day/i.test(m[2])) d.setDate(d.getDate() + n); else if (/week/i.test(m[2])) d.setDate(d.getDate() + 7 * n); else d.setMonth(d.getMonth() + n);
      p.date = ymd(d);
    });
    // "friday" = the coming Friday; "next friday" = Friday of next week
    const nextWeeks = (name) => { const d = nextWeekday(name, false); return d < ymd(addDays(weekStart(ymd(today)), 7)) ? ymd(addDays(d, 7)) : d; };
    take(new RegExp(`\\s(?:on\\s+)?(next\\s+)?${WDFULL}(?=\\s)`, 'i'), (m) => { p.date = m[1] ? nextWeeks(m[2]) : nextWeekday(m[2], true); });
    take(new RegExp(`\\s(on|next)\\s+${WDSHORT}(?=\\s)`, 'i'), (m) => { p.date = /next/i.test(m[1]) ? nextWeeks(m[2]) : nextWeekday(m[2], true); });
    take(new RegExp(`\\s(?:on\\s+)?${MONRE}\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(\\d{4}))?(?=\\s)`, 'i'), (m) => setMD(m[1], m[2], m[3]));
    take(new RegExp(`\\s(?:on\\s+)?(?:the\\s+)?(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?${MONRE}(?:,?\\s+(\\d{4}))?(?=\\s)`, 'i'), (m) => setMD(m[2], m[1], m[3]));
    take(/\s(\d{4})-(\d{2})-(\d{2})(?=\s)/, (m) => { p.date = `${m[1]}-${m[2]}-${m[3]}`; });
    const T = '(\\d{1,2})(?::(\\d{2}))?\\s*(am|pm|a\\.m\\.|p\\.m\\.)?';
    take(new RegExp(`\\s(from\\s+|at\\s+|@\\s*)?${T}\\s*(?:-|–|to|until|till)\\s*${T}(?=\\s)`, 'i'), (m) => {
      const [, lead, h1, m1, a1, h2, m2, a2] = m;
      if (!lead && !m1 && !m2 && !a1 && !a2) return false;          // "pages 10-11" is not a time
      if (!a1 && !a2 && +h1 >= 1 && +h1 <= 7) {                     // "from 2 to 4" means the afternoon
        p.time = toHM(+h1 + 12, m1, ''); p.end = toHM(+h2 < 12 ? +h2 + 12 : +h2, m2, '') || '23:59';
        return;
      }
      const t1 = toHM(h1, m1, a1 || (a2 && +h1 <= +h2 ? a2 : ''));
      let t2 = toHM(h2, m2, a2 || '');
      if (!t1 || !t2) return false;
      if (!a2 && mins(t2) <= mins(t1) && +h2 < 12) t2 = toHM(+h2 + 12, m2, '');
      p.time = t1; p.end = t2;
    });
    take(/\s(?:at\s+|@\s*)?(\d{1,2}):(\d{2})\s*(am|pm|a\.m\.|p\.m\.)?(?=\s)/i, (m) => { const t = toHM(m[1], m[2], m[3]); if (!t) return false; p.time = t; });
    take(/\s(?:at\s+|@\s*)?(\d{1,2})\s*(am|pm|a\.m\.|p\.m\.)(?=\s)/i, (m) => { const t = toHM(m[1], 0, m[2]); if (!t) return false; p.time = t; });
    take(/\s(?:at|@)\s*(\d{1,2})(?=\s)/i, (m) => { let h = +m[1]; if (h > 23) return false; if (h >= 1 && h <= 7) h += 12; p.time = toHM(h, 0, ''); });
    take(/\s(?:at\s+)?(noon|midday|midnight)(?=\s)/i, (m) => { p.time = /midnight/i.test(m[1]) ? '00:00' : '12:00'; });
    take(/\s(!{1,3})(?=\s)/, (m) => { p.priority = m[1].length; });
    take(/\sp([1-3])(?=\s)/i, (m) => { p.priority = 4 - +m[1]; });
    take(/\s#([\p{L}\p{N}_-]+)(?=\s)/gu, (m) => { const t = m[1].toLowerCase(); if (!p.tags.includes(t)) p.tags.push(t); });
    if (p.tonight && !p.time) p.time = '20:00';
    if (p.time && !p.date) p.date = ymd(today);
    p.title = s.replace(/\s+/g, ' ').trim();
    return p;
  }
  window.__parseQuick = parseQuick;                 // for tests

  function createFromParse(p, defaults = {}) {
    const type = p.type || defaults.type || 'task';
    const tags = p.tags.length ? p.tags : (defaults.tags || []);
    if (type === 'event') {
      const date = p.date || defaults.date || todayStr();
      const start = p.time || defaults.start || hm(Math.min(23 * 60, (new Date().getHours() + 1) * 60));
      const e = newEvent({ title: p.title, date, start, end: p.end || hm(Math.min(mins(start) + 60, 23 * 60 + 59)), repeat: p.repeat, tags });
      ensurePermission();
      return { kind: 'event', item: e };
    }
    const t = newTask({ title: p.title, due: p.date || defaults.date || null, time: p.time || null, remind: p.time ? 0 : null,
      repeat: p.repeat || null, priority: p.priority, tags });
    if (t.repeat && !t.due) t.due = todayStr();
    if (t.remind != null) ensurePermission();
    return { kind: 'task', item: t };
  }

  // ---------- small renderers ----------
  const hue = (s) => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 360; return h; };
  const chip = (tag) => `<span class="pl-chip" style="--h:${hue(tag)}">${esc(tag)}</span>`;
  const meta = (parts) => (parts.length ? `<div class="pl-m">${parts.join('')}</div>` : '');
  function taskRow(t, o = {}) {
    const today = todayStr();
    const late = !t.done && t.due && (t.due < today || (t.due === today && t.time && t.time < nowHM()));
    const m = [];
    const sameAsAlert = o.remAt && !t.remind;           // alert fires exactly at the due time: don't say it twice
    if (o.date !== false && t.due && !sameAsAlert) m.push(`<span class="${late ? 'late' : ''}">${esc(dayLabel(t.due))}</span>`);
    if (t.time && !sameAsAlert) m.push(`<span class="${late ? 'late' : 'tm'}">${fmtTime(t.time)}</span>`);
    if (repeating(t)) m.push(`<span title="Habit, repeats ${esc(t.repeat)}">🔥 ${t.streak || 0}</span>`);
    if (o.remAt) m.unshift(`<span class="rem-at">⏰ ${esc(remLabel(o.remAt, t.remind))}</span>`);
    else if (t.remind != null && !t.done) m.push('<span title="Reminder set">⏰</span>');
    if (t.subtasks && t.subtasks.length) m.push(`<span>☑ ${t.subtasks.filter((x) => x.done).length}/${t.subtasks.length}</span>`);
    if (t.noteId) m.push('<span title="Linked note">📝</span>');
    (t.tags || []).forEach((g) => m.push(chip(g)));
    return `<div class="pl-row task${t.done ? ' done' : ''}" data-kind="task" data-id="${t.id}" draggable="${o.drag ? 'true' : 'false'}">
      <button class="chk p${t.priority || 0}${t.status === 'doing' ? ' doing' : ''}" data-act="toggle" title="${t.done ? 'Mark not done' : 'Complete'}" aria-label="Complete">${t.done ? '✓' : ''}</button>
      <div class="pl-main"><div class="pl-t">${esc(t.title || 'Untitled task')}</div>${meta(m)}</div></div>`;
  }
  function eventRow(e, date, o = {}) {
    const m = [];
    if (o.date) m.push(`<span>${esc(dayLabel(date))}</span>`);
    m.push(`<span class="tm">${e.allDay ? 'All day' : fmtTime(e.start) + (e.end ? ' – ' + fmtTime(e.end) : '')}</span>`);
    if (repeating(e)) m.push('<span title="Repeats">↻</span>');
    if (o.remAt) m.unshift(`<span class="rem-at">⏰ ${esc(remLabel(o.remAt, e.remind))}</span>`);
    else if (e.remind != null) m.push('<span title="Reminder set">⏰</span>');
    if (e.location) m.push(`<span>📍 ${esc(e.location)}</span>`);
    if (e.noteId) m.push('<span title="Linked note">📝</span>');
    (e.tags || []).forEach((g) => m.push(chip(g)));
    return `<div class="pl-row event" data-kind="event" data-id="${e.id}" data-date="${date}" draggable="${o.drag ? 'true' : 'false'}">
      <span class="dot"></span><div class="pl-main"><div class="pl-t">${esc(e.title || 'Untitled event')}</div>${meta(m)}</div>
      ${e.link ? '<button class="pl-join" data-act="join">Join</button>' : ''}</div>`;
  }
  const entryRow = (x, o) => (x.kind === 'event' ? eventRow(x.item, x.date, o) : taskRow(x.item, o));
  function header(title, sub, controls = '') {
    return `<div class="pl-head">
      <button class="icon-btn pl-menu" data-act="menu" title="Sidebar" aria-label="Sidebar">☰</button>
      <div class="pl-title"><h1>${esc(title)}</h1>${sub ? `<div class="pl-sub">${esc(sub)}</div>` : ''}</div>
      <div class="pl-ctrl">${controls}<button class="icon-btn pl-inbox-btn${prefs.inbox ? ' on' : ''}" data-act="inbox" title="Inbox panel" aria-label="Toggle inbox">▤</button></div></div>`;
  }
  const addInput = (ph, date, extra = '') => `<input class="pl-add" placeholder="${esc(ph)}" data-date="${date || ''}" ${extra} aria-label="${esc(ph)}">`;
  const navBtns = () => '<button class="pl-btn" data-act="today">Today</button><button class="icon-btn" data-act="prev" aria-label="Previous">‹</button><button class="icon-btn" data-act="next" aria-label="Next">›</button>';
  function gcalBtn() {
    if (!C.calendar) return '';
    const st = C.calendar.status();
    const label = { on: '● Google Calendar', error: '⚠ Google Calendar', reconnect: '⚠ Reconnect Google Calendar', off: 'Connect Google Calendar', setup: 'Connect Google Calendar' }[st];
    const tip = st === 'on' ? 'Events sync with your Google Calendar. Click to turn off.' : st === 'error' ? C.calendar.error() : 'Two-way sync between these events and your Google Calendar';
    return `<button class="pl-btn gcal ${st}" data-act="gcal" title="${esc(tip)}">${label}</button>`;
  }
  const joinAnd = (a) => (a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]);

  // ---------- views ----------
  let view = null, lastRendered = null, selDay = todayStr(), stripStart = todayStr(), calAnchor = todayStr();

  function renderToday() {
    const t = todayStr();
    let strip = '';
    for (let i = 0; i < 14; i++) {
      const ds = ymd(addDays(stripStart, i)), d = parseYmd(ds);
      const has = itemsOn(ds).some((x) => !x.item.done);
      strip += `<button class="pl-day${ds === selDay ? ' sel' : ''}${ds === t ? ' today' : ''}" data-act="day" data-date="${ds}">
        <b>${d.getDate()}</b><span>${d.toLocaleDateString([], { weekday: 'short' })}</span>${has ? '<i></i>' : ''}</button>`;
    }
    const items = itemsOn(selDay);
    const ev = items.filter((x) => x.kind === 'event').length;
    const hab = items.filter((x) => x.kind === 'task' && repeating(x.item)).length;
    const imp = allTasks().filter((x) => !x.done && x.priority === 3 && x.due && x.due <= selDay).length;
    const pills = [];
    if (ev) pills.push(`<span class="pill ev">▦ ${ev} event${ev > 1 ? 's' : ''}</span>`);
    if (hab) pills.push(`<span class="pill hab">🔥 ${hab} habit${hab > 1 ? 's' : ''}</span>`);
    if (imp) pills.push(`<span class="pill imp">⚠ ${imp} important</span>`);
    const h = new Date().getHours();
    const greet = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
    const summary = selDay === t
      ? `${greet}, ${pills.length ? 'you have ' + joinAnd(pills) : 'your day is clear.'}`
      : (pills.length ? `${esc(dayLabel(selDay))}: ${joinAnd(pills)}` : `Nothing planned for ${esc(dayLabel(selDay).toLowerCase())} yet.`);
    const overdue = selDay === t ? overdueTasks() : [];
    return header(selDay === t ? 'Today' : dayLabel(selDay), parseYmd(selDay).toLocaleDateString([], { year: 'numeric', month: 'long', day: 'numeric' }), navBtns()) +
      `<div class="pl-body"><div class="pl-strip">${strip}</div>
      <div class="pl-summary">${summary}</div>
      ${addInput('+ Add a task or event… try "Call Anna 5pm" or "event tomorrow 10:00 Design review"', selDay)}
      ${overdue.length ? `<div class="pl-sec late">Overdue</div>${overdue.map((x) => taskRow(x)).join('')}` : ''}
      ${items.length ? (overdue.length ? `<div class="pl-sec">${esc(dayLabel(selDay))}</div>` : '') + items.map((x) => entryRow(x, { date: false })).join('')
        : (overdue.length ? '' : '<div class="pl-empty">Nothing here yet. Add something above, or press ⌘K anywhere.</div>')}</div>`;
  }

  function renderUpcoming() {
    const t = todayStr();
    let html = '';
    const overdue = overdueTasks();
    if (overdue.length) html += `<div class="pl-group"><div class="pl-gl"><b class="late">Overdue</b></div><div class="pl-gi">${overdue.map((x) => taskRow(x)).join('')}</div></div>`;
    for (let i = 0; i < 30; i++) {
      const ds = ymd(addDays(t, i));
      const items = itemsOn(ds).filter((x) => !(x.kind === 'task' && x.item.done));
      if (!items.length) continue;
      html += `<div class="pl-group"><div class="pl-gl"><b class="${ds === t ? 'red' : ''}">${esc(dayLabel(ds))}</b><span>${esc(parseYmd(ds).toLocaleDateString([], { month: 'short', day: 'numeric' }))}</span></div>
        <div class="pl-gi">${items.map((x) => entryRow(x, { date: false })).join('')}</div></div>`;
    }
    return header('Upcoming', 'Next 30 days') + `<div class="pl-body">${addInput('+ Add a task or event…', '')}${html || '<div class="pl-empty">Nothing coming up in the next 30 days.</div>'}</div>`;
  }

  function renderEvents() {
    const t = todayStr();
    let html = '';
    for (let i = 0; i < 90; i++) {
      const ds = ymd(addDays(t, i));
      const evs = allEvents().filter((e) => occursOn(e, ds)).sort((a, b) => (a.allDay ? '' : a.start).localeCompare(b.allDay ? '' : b.start));
      if (!evs.length) continue;
      html += `<div class="pl-group"><div class="pl-gl"><b class="${ds === t ? 'red' : ''}">${esc(dayLabel(ds))}</b><span>${esc(parseYmd(ds).toLocaleDateString([], { month: 'short', day: 'numeric' }))}</span></div>
        <div class="pl-gi">${evs.map((e) => eventRow(e, ds)).join('')}</div></div>`;
    }
    return header('Events', 'Next 90 days', gcalBtn() + '<button class="pl-btn primary" data-act="newevent">+ New event</button>') +
      `<div class="pl-body">${html || '<div class="pl-empty">No upcoming events. Click “New event”, or type “event Friday 3pm Dentist” in ⌘K.</div>'}</div>`;
  }

  // ---- view switch (List | Board | Grid), shared by Tasks and Reminders
  const viewSwitch = (key) => `<div class="pl-seg" role="group" aria-label="View">${[['list', '☰', 'List'], ['board', '▥', 'Board'], ['grid', '▦', 'Grid']]
    .map(([v, i, l]) => `<button class="${prefs[key] === v ? 'on' : ''}" data-act="vmode" data-key="${key}" data-v="${v}" aria-pressed="${prefs[key] === v}" title="${l} view">${i} ${l}</button>`).join('')}</div>`;
  const asTask = (t) => ({ kind: 'task', item: t, date: t.due, time: t.time || '' });
  const byDue = (a, b) => (a.due || '9999').localeCompare(b.due || '9999') || (a.time || '').localeCompare(b.time || '') || (b.priority || 0) - (a.priority || 0);

  // sections of open tasks, used by the list and grid views
  function taskSections() {
    const t = todayStr(), tm = ymd(addDays(t, 1));
    const open = allTasks().filter((x) => !x.done);
    return [
      { label: 'Overdue', cls: 'late', items: overdueTasks(), date: true },
      { label: 'Today', items: open.filter((x) => x.due === t), date: false },
      { label: 'Tomorrow', items: open.filter((x) => x.due === tm), date: false },
      { label: 'Later', items: open.filter((x) => x.due && x.due > tm), date: true },
      { label: 'No date', items: open.filter((x) => !x.due).sort((a, b) => (b.priority || 0) - (a.priority || 0) || a.created - b.created), date: true },
    ].filter((g) => g.items.length).map((g) => Object.assign(g, { items: g.label === 'No date' ? g.items : g.items.sort(byDue) }));
  }
  // board columns for tasks, by status / priority / due date. `apply` moves a dropped task into the column.
  function taskColumns() {
    const open = allTasks().filter((x) => !x.done);
    const t = todayStr(), tm = ymd(addDays(t, 1));
    if (prefs.taskGroup === 'priority') {
      return [[3, 'High'], [2, 'Medium'], [1, 'Low'], [0, 'No priority']].map(([p, label]) => ({
        key: 'p' + p, label, cls: 'pri' + p, items: open.filter((x) => (x.priority || 0) === p).sort(byDue), add: `data-priority="${p}"`,
        apply: (x) => { x.priority = p; return `Priority: ${label}`; } }));
    }
    if (prefs.taskGroup === 'due') {
      return [
        { key: 'overdue', label: 'Overdue', cls: 'late', items: overdueTasks(), drop: false },
        { key: 'today', label: 'Today', items: open.filter((x) => x.due === t).sort(byDue), addDate: t, apply: (x) => moveTo(x, t) },
        { key: 'tomorrow', label: 'Tomorrow', items: open.filter((x) => x.due === tm).sort(byDue), addDate: tm, apply: (x) => moveTo(x, tm) },
        { key: 'later', label: 'Upcoming', items: open.filter((x) => x.due && x.due > tm).sort(byDue), apply: (x) => moveTo(x, ymd(addDays(t, 7))) },
        { key: 'nodate', label: 'No date', items: open.filter((x) => !x.due), add: 'data-inbox="1"', apply: (x) => { x.due = null; return 'Date removed'; } },
      ];
    }
    const done = allTasks().filter((x) => x.done).sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0)).slice(0, 40);
    return [
      { key: 'todo', label: 'To do', items: open.filter((x) => x.status !== 'doing').sort((a, b) => (b.priority || 0) - (a.priority || 0) || byDue(a, b)), add: 'data-status="todo"',
        apply: (x) => { x.done = false; x.doneAt = null; x.status = 'todo'; return 'Moved to To do'; } },
      { key: 'doing', label: 'In progress', items: open.filter((x) => x.status === 'doing').sort(byDue), add: 'data-status="doing"',
        apply: (x) => { x.done = false; x.doneAt = null; x.status = 'doing'; return 'In progress'; } },
      { key: 'done', label: 'Done', items: done, apply: (x) => { if (!x.done) { toggleTask(x); return null; } return 'Done'; } },
    ];
  }
  function moveTo(x, date) {
    if (x.due !== undefined) x.due = date; else x.date = date;     // task or event
    return `Moved to ${dayLabel(date)}`;
  }

  function renderTasks() {
    const open = allTasks().filter((x) => !x.done).length;
    const group = prefs.taskView === 'board'
      ? `<select class="pl-select" data-act="tgroup" aria-label="Board columns">${[['status', 'By status'], ['priority', 'By priority'], ['due', 'By due date']]
        .map(([v, l]) => `<option value="${v}"${prefs.taskGroup === v ? ' selected' : ''}>${l}</option>`).join('')}</select>` : '';
    const head = header('Tasks', `${open} open`, group + viewSwitch('taskView'));
    if (prefs.taskView === 'board') {
      const cols = taskColumns().map((c) => Object.assign(c, { entries: c.items.map(asTask) }));
      return head + boardHTML(cols, 'tasks');
    }
    const grid = prefs.taskView === 'grid';
    let html = '';
    for (const g of taskSections()) {
      const entries = g.items.map(asTask);
      html += `<div class="pl-sec ${g.cls || ''}">${g.label} <span>${g.items.length}</span></div>` +
        (grid ? gridHTML(entries, { date: g.date }) : entries.map((x) => taskRow(x.item, { date: g.date })).join(''));
    }
    const done = allTasks().filter((x) => x.done).sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0));
    html += `<button class="pl-sec pl-toggle" data-act="showdone">${prefs.showDone ? '▾' : '▸'} Completed <span>${done.length}</span></button>`;
    if (prefs.showDone) html += grid ? gridHTML(done.slice(0, 100).map(asTask)) : done.slice(0, 100).map((x) => taskRow(x)).join('');
    return head + `<div class="pl-body">${addInput('+ New task… try "Pay rent on Nov 5 !!" or "Gym every day 7am"', '')}${html}</div>`;
  }

  // ---- Reminders: every task and event that has an alert, by when it fires
  function remLabel(at, offset) {
    const d = new Date(at);
    return `${dayLabel(ymd(d))} ${d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}${offset ? ` · ${remindLabel(offset)} before` : ''}`;
  }
  function reminderEntries() {
    const now = Date.now(), t = todayStr(), out = [];
    for (const x of allTasks()) {
      if (x.done || x.remind == null || !x.due) continue;
      out.push({ kind: 'task', item: x, date: x.due, time: x.time || '', at: dateAt(x.due, x.time || '09:00').getTime() - x.remind * 60000 });
    }
    for (const e of allEvents()) {
      if (e.remind == null) continue;
      for (let i = 0; i < 400; i++) {                 // next occurrence that hasn't started yet
        const ds = ymd(addDays(t, i));
        if (!occursOn(e, ds)) continue;
        const start = dateAt(ds, e.allDay ? '09:00' : e.start).getTime();
        if (start < now) continue;
        out.push({ kind: 'event', item: e, date: ds, time: e.allDay ? '' : e.start, at: start - e.remind * 60000 });
        break;
      }
    }
    return out.sort((a, b) => a.at - b.at);
  }
  function reminderColumns() {
    const now = Date.now(), t = todayStr();
    const list = reminderEntries();
    const day = (x) => ymd(new Date(x.at));
    const cols = [
      { key: 'missed', label: 'Missed', cls: 'late', test: (x) => x.at < now, drop: false },
      { key: 'today', label: 'Today', test: (x) => day(x) === t, to: 0 },
      { key: 'tomorrow', label: 'Tomorrow', test: (x) => day(x) === ymd(addDays(t, 1)), to: 1 },
      { key: 'week', label: 'Next 7 days', test: (x) => day(x) <= ymd(addDays(t, 7)), to: 2 },
      { key: 'later', label: 'Later', test: () => true, to: 7 },
    ];
    const used = new Set();
    for (const c of cols) {
      c.entries = list.filter((x) => !used.has(x) && c.test(x));
      c.entries.forEach((x) => used.add(x));
      if (c.to != null) c.apply = (x) => moveTo(x, ymd(addDays(t, c.to)));
      if (c.key === 'today' || c.key === 'tomorrow') { c.add = 'data-rem="1"'; c.addDate = ymd(addDays(t, c.to)); }
    }
    return cols;
  }
  function renderReminders() {
    const cols = reminderColumns();
    const total = cols.reduce((n, c) => n + c.entries.length, 0);
    const head = header('Reminders', `${total} upcoming`, '<button class="pl-btn" data-act="testalert" title="Shows a test alert in 5 seconds">🔔 Test alert</button>' + viewSwitch('remView'));
    if (prefs.remView === 'board') return head + boardHTML(cols, 'reminders');
    const grid = prefs.remView === 'grid';
    let html = '';
    for (const c of cols) {
      if (!c.entries.length) continue;
      html += `<div class="pl-sec ${c.cls || ''}">${c.label} <span>${c.entries.length}</span></div>` +
        (grid ? gridHTML(c.entries, { rem: true }) : c.entries.map((x) => entryRow(x, { remAt: x.at, date: false })).join(''));
    }
    return head + `<div class="pl-body">${alertStatusLine()}${addInput('+ New reminder… try "Call mom tomorrow 5pm" or "Pay bills on the 1st of Dec"', '', 'data-rem="1"')}
      ${html || '<div class="pl-empty">No reminders yet. Add one above, or set “Reminder” on any task or event.</div>'}</div>`;
  }

  // ---- board and grid renderers
  let boardCols = [];
  const canDrag = (x) => !(x.kind === 'event' && repeating(x.item));     // moving a repeating event would move the whole series
  function boardHTML(cols, mode) {
    boardCols = cols;
    return `<div class="pl-body pl-board" style="--cols:${cols.length}" data-board="${mode}">${cols.map((c) => `<div class="pl-col${c.drop === false ? ' nodrop' : ''}" data-col="${c.key}">
      <div class="pl-col-h ${c.cls || ''}">${esc(c.label)} <span>${c.entries.length}</span></div>
      <div class="pl-col-b">${c.entries.map((x) => entryRow(x, { drag: canDrag(x), remAt: mode === 'reminders' ? x.at : null, date: c.key !== 'today' && c.key !== 'tomorrow' })).join('')
        || `<div class="pl-drop-hint">${c.drop === false ? 'Nothing here' : 'Drop here'}</div>`}</div>
      ${c.add != null || c.addDate ? addInput('+ Add', c.addDate || '', c.add || '') : ''}</div>`).join('')}</div>`;
  }
  function gridHTML(entries, o = {}) {
    return entries.length ? `<div class="pl-grid">${entries.map((x) => card(x, o)).join('')}</div>` : '';
  }
  function card(x, o = {}) {
    const it = x.item, isTask = x.kind === 'task';
    const late = isTask && !it.done && it.due && it.due < todayStr();
    const subs = isTask && it.subtasks && it.subtasks.length ? it.subtasks : null;
    const subDone = subs ? subs.filter((s) => s.done).length : 0;
    const when = isTask
      ? (it.due ? dayLabel(it.due) + (it.time ? ' · ' + fmtTime(it.time) : '') : 'No date')
      : `${dayLabel(x.date)} · ${it.allDay ? 'All day' : fmtTime(it.start) + (it.end ? ' – ' + fmtTime(it.end) : '')}`;
    return `<div class="pl-card ${x.kind}${it.done ? ' done' : ''} pr${isTask ? it.priority || 0 : 'e'}" data-kind="${x.kind}" data-id="${it.id}" data-date="${x.date || ''}" tabindex="0">
      <div class="pc-top">${isTask ? `<button class="chk p${it.priority || 0}${it.status === 'doing' ? ' doing' : ''}" data-act="toggle" aria-label="Complete">${it.done ? '✓' : ''}</button>` : '<span class="dot"></span>'}
        <div class="pc-t">${esc(it.title || 'Untitled')}</div></div>
      ${o.rem && x.at ? `<div class="pc-rem">⏰ ${esc(remLabel(x.at, it.remind))}</div>` : ''}
      <div class="pc-when${late ? ' late' : ''}"${o.rem && isTask && !it.remind ? ' hidden' : ''}>${esc(o.date === false && isTask && it.time ? fmtTime(it.time) : when)}${repeating(it) ? (isTask ? ` · 🔥 ${it.streak || 0}` : ' · ↻') : ''}${isTask && it.status === 'doing' && !it.done ? ' · In progress' : ''}</div>
      ${it.notes ? `<div class="pc-notes">${esc(it.notes.slice(0, 160))}</div>` : ''}
      ${subs ? `<div class="pc-prog" title="${subDone} of ${subs.length} subtasks"><i style="width:${Math.round((subDone / subs.length) * 100)}%"></i></div><div class="pc-sub">${subDone}/${subs.length} subtasks</div>` : ''}
      <div class="pc-foot">${(it.tags || []).map(chip).join('')}${!isTask && it.location ? `<span class="pc-loc">📍 ${esc(it.location)}</span>` : ''}${it.noteId ? '<span title="Linked note">📝</span>' : ''}${!isTask && it.link ? '<button class="pl-join" data-act="join">Join</button>' : ''}</div></div>`;
  }

  // calendar
  const HOUR = 48;
  function calRange() {
    if (prefs.cal === 'day') return [calAnchor, 1];
    if (prefs.cal === '3day') return [calAnchor, 3];
    if (prefs.cal === 'week') return [weekStart(calAnchor), 7];
    return [null, 0];
  }
  function renderCalendar() {
    const modes = [['day', 'Day'], ['3day', '3 days'], ['week', 'Week'], ['month', 'Month']];
    const sel = `<select class="pl-select" data-act="calmode" aria-label="Calendar view">${modes.map(([v, l]) => `<option value="${v}"${prefs.cal === v ? ' selected' : ''}>${l}</option>`).join('')}</select>`;
    if (prefs.cal === 'month') return renderMonth(sel);
    const [start, n] = calRange();
    const days = Array.from({ length: n }, (_, i) => ymd(addDays(start, i)));
    const first = parseYmd(days[0]), last = parseYmd(days[n - 1]);
    const title = n === 1 ? first.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })
      : first.getMonth() === last.getMonth() ? `${first.toLocaleDateString([], { month: 'short' })} ${first.getDate()} – ${last.getDate()}`
        : `${first.toLocaleDateString([], { month: 'short', day: 'numeric' })} – ${last.toLocaleDateString([], { month: 'short', day: 'numeric' })}`;
    const t = todayStr();
    const heads = days.map((d) => { const x = parseYmd(d); return `<div class="cal-dh${d === t ? ' today' : ''}" data-act="dayview" data-date="${d}"><b>${x.toLocaleDateString([], { weekday: 'short' })}</b> <span>${x.getDate()}</span></div>`; }).join('');
    const allday = days.map((d) => {
      const list = itemsOn(d).filter((x) => !x.time);
      return `<div class="cal-ad">${list.map((x) => `<div class="cal-chip ${x.kind}${x.item.done ? ' done' : ''}" data-kind="${x.kind}" data-id="${x.item.id}">${x.kind === 'task' ? `<button class="chk sm p${x.item.priority || 0}" data-act="toggle">${x.item.done ? '✓' : ''}</button>` : ''}${esc(x.item.title || 'Untitled')}</div>`).join('')}</div>`;
    }).join('');
    const hours = Array.from({ length: 24 }, (_, h) => `<div class="cal-hl" style="top:${h * HOUR}px">${h ? fmtTime(pad(h) + ':00').replace(':00', '') : ''}</div>`).join('');
    const cols = days.map((d) => {
      const entries = itemsOn(d).filter((x) => x.time).map((x) => {
        const s = mins(x.time);
        let e = x.kind === 'event' && x.item.end ? mins(x.item.end) : s + 30;
        if (e <= s) e = Math.min(24 * 60, s + 30);
        return Object.assign(x, { s, e: Math.max(e, s + 20) });
      });
      layoutOverlaps(entries);
      const items = entries.map((x) => `<div class="cal-item ${x.kind}${x.item.done ? ' done' : ''}" data-kind="${x.kind}" data-id="${x.item.id}"
        style="top:${(x.s / 60) * HOUR}px;height:${Math.max(20, ((x.e - x.s) / 60) * HOUR - 2)}px;left:calc(${(100 / x.cols) * x.col}% + 2px);width:calc(${100 / x.cols}% - 4px)">
        ${x.kind === 'task' ? `<button class="chk sm p${x.item.priority || 0}" data-act="toggle">${x.item.done ? '✓' : ''}</button>` : '<span class="dot"></span>'}
        <div><b>${esc(x.item.title || 'Untitled')}</b><span>${fmtTime(x.time)}</span></div></div>`).join('');
      const now = d === t ? `<div class="cal-now" style="top:${(mins(nowHM()) / 60) * HOUR}px"></div>` : '';
      return `<div class="cal-col${d === t ? ' today' : ''}" data-date="${d}">${items}${now}</div>`;
    }).join('');
    return header(title, String(first.getFullYear()), gcalBtn() + sel + navBtns()) +
      `<div class="cal" style="--days:${n}"><div class="cal-row cal-heads"><div class="cal-gut"></div>${heads}</div>
      <div class="cal-row cal-allday"><div class="cal-gut">all-day</div>${allday}</div>
      <div class="pl-body cal-scroll"><div class="cal-grid" style="height:${24 * HOUR}px"><div class="cal-gut cal-hours">${hours}</div>${cols}</div></div></div>`;
  }
  function layoutOverlaps(entries) {
    entries.sort((a, b) => a.s - b.s || b.e - a.e);
    let group = [], end = -1;
    const flush = () => {
      const cols = [];
      for (const x of group) { let c = cols.findIndex((ce) => ce <= x.s); if (c < 0) { c = cols.length; cols.push(0); } cols[c] = x.e; x.col = c; }
      group.forEach((x) => { x.cols = cols.length; });
    };
    for (const x of entries) { if (x.s >= end) { flush(); group = []; end = -1; } group.push(x); end = Math.max(end, x.e); }
    flush();
  }
  function renderMonth(sel) {
    const a = parseYmd(calAnchor);
    const first = new Date(a.getFullYear(), a.getMonth(), 1);
    const start = weekStart(ymd(first));
    const t = todayStr();
    let cells = '';
    for (let i = 0; i < 42; i++) {
      const ds = ymd(addDays(start, i)), d = parseYmd(ds);
      const items = itemsOn(ds);
      cells += `<div class="mon-cell${d.getMonth() !== a.getMonth() ? ' out' : ''}${ds === t ? ' today' : ''}" data-act="monthcell" data-date="${ds}">
        <button class="mon-n" data-act="dayview" data-date="${ds}">${d.getDate()}</button>
        ${items.slice(0, 3).map((x) => `<div class="cal-chip ${x.kind}${x.item.done ? ' done' : ''}" data-kind="${x.kind}" data-id="${x.item.id}">${x.time ? `<span>${fmtTime(x.time)}</span> ` : ''}${esc(x.item.title || 'Untitled')}</div>`).join('')}
        ${items.length > 3 ? `<button class="mon-more" data-act="dayview" data-date="${ds}">+${items.length - 3} more</button>` : ''}</div>`;
    }
    const wd = Array.from({ length: 7 }, (_, i) => `<div class="mon-wd">${addDays(start, i).toLocaleDateString([], { weekday: 'short' })}</div>`).join('');
    return header(a.toLocaleDateString([], { month: 'long', year: 'numeric' }), '', gcalBtn() + sel + navBtns()) +
      `<div class="pl-body"><div class="mon">${wd}${cells}</div></div>`;
  }

  // inbox panel
  function renderInbox() {
    const el = qs('#inbox');
    if (!el || el.hidden) return;
    const t = todayStr();
    const overdue = overdueTasks();
    const undated = allTasks().filter((x) => !x.done && !x.due);
    const today = itemsOn(t).filter((x) => !x.item.done);
    el.innerHTML = `<div class="ib-head"><h2>Inbox</h2></div>${addInput('+ New task', '', 'data-inbox="1"')}
      <div class="ib-body">${overdue.length ? `<div class="pl-sec late">Overdue</div>${overdue.map((x) => taskRow(x)).join('')}` : ''}
      <div class="pl-sec">Inbox</div>${undated.map((x) => taskRow(x)).join('') || '<div class="pl-empty sm">Tasks without a date land here.</div>'}
      ${today.length ? `<div class="pl-sec">Today</div>${today.map((x) => entryRow(x, { date: false })).join('')}` : ''}</div>`;
  }

  function render() {
    renderInbox();
    const el = qs('#planner');
    if (!C || !el || el.hidden || !VIEWS.includes(view)) return;
    const prevBody = qs('.pl-body', el);
    const keep = lastRendered === view + prefs.cal + prefs.taskView + prefs.taskGroup + prefs.remView && prevBody ? prevBody.scrollTop : null;
    const active = document.activeElement && el.contains(document.activeElement) && document.activeElement.classList.contains('pl-add')
      ? { val: document.activeElement.value, date: document.activeElement.dataset.date } : null;
    el.innerHTML = { today: renderToday, upcoming: renderUpcoming, calendar: renderCalendar, tasks: renderTasks, reminders: renderReminders, events: renderEvents }[view]();
    const body = qs('.pl-body', el);
    if (body) {
      if (keep != null) body.scrollTop = keep;
      else if (view === 'calendar' && body.classList.contains('cal-scroll')) body.scrollTop = Math.max(0, (Math.min(new Date().getHours(), 16) - 1.5) * HOUR);
    }
    if (active) { const inp = qs('.pl-add', el); if (inp) { inp.value = active.val; inp.focus(); } }
    lastRendered = view + prefs.cal + prefs.taskView + prefs.taskGroup + prefs.remView;
  }

  // ---------- interactions ----------
  function shift(dir) {
    if (view === 'today') { stripStart = ymd(addDays(stripStart, 7 * dir)); selDay = stripStart; }
    else if (view === 'calendar') {
      if (prefs.cal === 'month') { const d = parseYmd(calAnchor); d.setDate(1); d.setMonth(d.getMonth() + dir); calAnchor = ymd(d); }
      else calAnchor = ymd(addDays(calAnchor, dir * { day: 1, '3day': 3, week: 7 }[prefs.cal]));
    }
    render();
  }
  function onClick(e) {
    const a = e.target.closest('[data-act]');
    const row = e.target.closest('.pl-row, .cal-item, .cal-chip, .pl-card');
    const act = a && (!row || row.contains(a)) ? a.dataset.act : null;
    if (row && (!act || act === 'monthcell')) { openDetail(row.dataset.kind, row.dataset.id); return; }
    if (act === 'toggle' && row) { const t = findTask(row.dataset.id); if (t) toggleTask(t); return; }
    if (act === 'join' && row) { const ev = findEvent(row.dataset.id); if (ev && ev.link) openLink(ev.link); return; }
    switch (act) {
      case 'menu': qs('#app').classList.toggle('show-side'); return;
      case 'inbox': prefs.inbox = !prefs.inbox; savePrefs(); C.layout(); render(); return;
      case 'day': selDay = a.dataset.date; render(); return;
      case 'today': selDay = stripStart = calAnchor = todayStr(); render(); return;
      case 'prev': shift(-1); return;
      case 'next': shift(1); return;
      case 'vmode': prefs[a.dataset.key] = a.dataset.v; savePrefs(); render(); return;
      case 'showdone': prefs.showDone = !prefs.showDone; savePrefs(); render(); return;
      case 'newevent': { const ev = newEvent({}); commit(); openDetail('event', ev.id, true); return; }
      case 'gcal': if (C.calendar.status() === 'on') C.calendar.disconnect(); else C.calendar.connect(); return;
      case 'testalert': testAlert(); return;
      case 'allownotif': allowNotifications(); return;
      case 'notifsettings': C.native.openNotifSettings(); return;
      case 'dayview': calAnchor = a.dataset.date; prefs.cal = 'day'; savePrefs(); if (view !== 'calendar') show('calendar'); else render(); return;
      case 'monthcell': { const ev = newEvent({ date: a.dataset.date, start: '09:00', end: '10:00' }); commit(); openDetail('event', ev.id, true); return; }
    }
    const col = e.target.closest('.cal-col');
    if (col && !row) {                              // click on an empty slot: new event there
      const y = e.clientY - col.getBoundingClientRect().top;
      const start = Math.min(23 * 60, Math.max(0, Math.floor((y / HOUR) * 2) * 30));
      const ev = newEvent({ date: col.dataset.date, start: hm(start), end: hm(Math.min(start + 60, 23 * 60 + 59)) });
      commit(); openDetail('event', ev.id, true);
    }
  }
  function onKey(e) {
    const inp = e.target;
    if (!inp.classList || !inp.classList.contains('pl-add') || e.key !== 'Enter' || !inp.value.trim()) return;
    e.preventDefault();
    const p = parseQuick(inp.value);
    if (p.type === 'note') { C.createNote(p.title); inp.value = ''; return; }
    if (!p.title) { toast('Add a title too'); return; }
    const res = createFromParse(p, { date: inp.dataset.inbox ? null : (inp.dataset.date || null) });
    if (res.kind === 'task') {
      if (inp.dataset.status === 'doing') res.item.status = 'doing';
      if (inp.dataset.priority) res.item.priority = +inp.dataset.priority;
      if (inp.dataset.rem) {                         // a reminder always gets a date, a time and an alert
        const t = res.item;
        if (!t.time) t.time = '09:00';
        if (!t.due) t.due = dateAt(todayStr(), t.time) > new Date() ? todayStr() : ymd(addDays(todayStr(), 1));
        if (t.remind == null) t.remind = 0;
        ensurePermission();
      }
    }
    inp.value = '';
    commit();
    const when = res.kind === 'event' ? `${dayLabel(res.item.date)} ${fmtTime(res.item.start)}` : res.item.due ? dayLabel(res.item.due) + (res.item.time ? ' ' + fmtTime(res.item.time) : '') : 'Inbox';
    toast(`${res.kind === 'event' ? 'Event' : 'Task'} added · ${when}`);
  }
  function onChange(e) {
    if (e.target.dataset.act === 'calmode') { prefs.cal = e.target.value; savePrefs(); render(); }
    if (e.target.dataset.act === 'tgroup') { prefs.taskGroup = e.target.value; savePrefs(); render(); }
  }
  // board drag and drop (works for every board: the column's `apply` decides what changes)
  let drag = null;
  function onDragStart(e) {
    const r = e.target.closest('[draggable="true"][data-id]'); if (!r) return;
    drag = { kind: r.dataset.kind, id: r.dataset.id };
    e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', drag.id);
    r.classList.add('dragging');
  }
  function onDragOver(e) {
    const c = e.target.closest('.pl-col'); if (!c || !drag || c.classList.contains('nodrop')) return;
    e.preventDefault();
    document.querySelectorAll('.pl-col.over').forEach((x) => x !== c && x.classList.remove('over'));
    c.classList.add('over');
  }
  function onDrop(e) {
    const c = e.target.closest('.pl-col'); if (!c || !drag) return;
    e.preventDefault();
    const col = boardCols.find((x) => x.key === c.dataset.col);
    const it = drag.kind === 'task' ? findTask(drag.id) : findEvent(drag.id);
    drag = null;
    if (!col || !col.apply || !it || col.drop === false) return;
    const msg = col.apply(it);
    if (msg === null) return;                        // e.g. completing a habit already saved and toasted
    touch(it); commit();
    if (msg) toast(`${it.title || 'Item'} · ${msg}`);
  }
  function onDragEnd() { drag = null; document.querySelectorAll('.over, .dragging').forEach((x) => x.classList.remove('over', 'dragging')); }
  const openLink = (u) => window.open(/^[a-z][\w+.-]*:/i.test(u) ? u : 'https://' + u, '_blank', 'noopener');

  // ---------- detail sheet ----------
  let detail = null;
  const REMINDS = [['', 'None'], ['0', 'At time'], ['5', '5 min before'], ['10', '10 min before'], ['15', '15 min before'], ['30', '30 min before'], ['60', '1 hour before'], ['1440', '1 day before']];
  const REPEATS = [['', 'Never'], ['daily', 'Every day'], ['weekdays', 'Weekdays'], ['weekly', 'Every week'], ['monthly', 'Every month'], ['yearly', 'Every year']];
  const options = (list, v) => list.map(([val, l]) => `<option value="${val}"${String(v == null ? '' : v) === val ? ' selected' : ''}>${l}</option>`).join('');
  const noteOptions = (id) => '<option value="">None</option>' + C.notesList().map((n) => `<option value="${n.id}"${n.id === id ? ' selected' : ''}>${esc(n.title)}</option>`).join('');
  function subtasksHTML(t) {
    return (t.subtasks || []).map((s, i) => `<div class="sub" data-i="${i}"><button class="chk sm" data-act="subtoggle">${s.done ? '✓' : ''}</button>
      <input data-sub="${i}" value="${esc(s.title)}" class="${s.done ? 'done' : ''}" aria-label="Subtask"><button class="icon-btn" data-act="subdel" aria-label="Delete subtask">✕</button></div>`).join('');
  }
  function taskForm(t) {
    return `<div class="d-top"><button class="chk p${t.priority || 0}${t.status === 'doing' ? ' doing' : ''}" data-act="dtoggle">${t.done ? '✓' : ''}</button>
      <input class="d-title" data-f="title" value="${esc(t.title)}" placeholder="Task name" aria-label="Task name"><button class="icon-btn" data-act="close" aria-label="Close">✕</button></div>
      ${repeating(t) ? `<div class="d-streak">🔥 ${t.streak || 0} streak · ${(t.history || []).length} times done</div>` : ''}
      <div class="d-grid">
        <label>Date<span class="d-pair"><input type="date" data-f="due" value="${t.due || ''}"><input type="time" data-f="time" value="${t.time || ''}"></span></label>
        <label>Reminder<select data-f="remind">${options(REMINDS, t.remind)}</select></label>
        <label>Repeat<select data-f="repeat">${options(REPEATS, t.repeat)}</select></label>
        <label>Priority<select data-f="priority">${options([['0', 'None'], ['1', 'Low'], ['2', 'Medium'], ['3', 'High']], t.priority || 0)}</select></label>
        <label>Status<select data-f="status">${options([['todo', 'To do'], ['doing', 'In progress'], ['done', 'Done']], t.done ? 'done' : t.status || 'todo')}</select></label>
        <label>Tags<input data-f="tags" value="${esc((t.tags || []).join(', '))}" placeholder="work, health"></label>
        <label>Linked note<span class="d-pair"><select data-f="noteId">${noteOptions(t.noteId)}</select>${t.noteId ? '<button class="pl-btn" data-act="opennote">Open</button>' : ''}</span></label>
      </div>
      <div class="d-label">Subtasks</div><div class="d-subs">${subtasksHTML(t)}</div>
      <input class="sub-add" placeholder="+ Add subtask (Enter)" aria-label="Add subtask">
      <div class="d-label">Notes</div><textarea data-f="notes" rows="4" placeholder="Details…">${esc(t.notes)}</textarea>
      <div class="d-foot"><button class="pl-btn danger" data-act="delete">Delete</button><button class="pl-btn primary" data-act="close">Done</button></div>`;
  }
  function eventForm(e) {
    return `<div class="d-top"><span class="dot big"></span><input class="d-title" data-f="title" value="${esc(e.title)}" placeholder="Event name" aria-label="Event name"><button class="icon-btn" data-act="close" aria-label="Close">✕</button></div>
      <div class="d-grid">
        <label>Date<input type="date" data-f="date" value="${e.date}"></label>
        <label class="d-check"><input type="checkbox" data-f="allDay"${e.allDay ? ' checked' : ''}> All day</label>
        ${e.allDay ? '' : `<label>Time<span class="d-pair"><input type="time" data-f="start" value="${e.start}"><span>–</span><input type="time" data-f="end" value="${e.end || ''}"></span></label>`}
        <label>Reminder<select data-f="remind">${options(REMINDS, e.remind)}</select></label>
        <label>Repeat<select data-f="repeat">${options(REPEATS, e.repeat)}</select></label>
        <label>Meeting link<span class="d-pair"><input data-f="link" value="${esc(e.link)}" placeholder="https://meet.google.com/…">${e.link ? '<button class="pl-btn primary" data-act="djoin">Join</button>' : ''}</span></label>
        <label>Location<input data-f="location" value="${esc(e.location)}" placeholder="Place or address"></label>
        <label>Tags<input data-f="tags" value="${esc((e.tags || []).join(', '))}" placeholder="work"></label>
        <label>Linked note<span class="d-pair"><select data-f="noteId">${noteOptions(e.noteId)}</select>${e.noteId ? '<button class="pl-btn" data-act="opennote">Open</button>' : ''}</span></label>
      </div>
      <div class="d-label">Notes</div><textarea data-f="notes" rows="4" placeholder="Agenda, details…">${esc(e.notes)}</textarea>
      <div class="d-foot"><button class="pl-btn danger" data-act="delete">Delete</button><button class="pl-btn primary" data-act="close">Done</button></div>`;
  }
  function detailItem() { return detail && (detail.kind === 'task' ? findTask(detail.id) : findEvent(detail.id)); }
  function openDetail(kind, id, isNew = false) {
    closeDetail(true);
    const it = kind === 'task' ? findTask(id) : findEvent(id);
    if (!it) return;
    const box = document.createElement('div');
    box.className = 'pl-modal';
    box.innerHTML = `<div class="pl-sheet" role="dialog" aria-modal="true" aria-label="${kind === 'task' ? 'Task' : 'Event'} details"></div>`;
    document.body.appendChild(box);
    detail = { kind, id, isNew, box };
    refreshDetail();
    box.addEventListener('input', onDetailInput);
    box.addEventListener('change', onDetailInput);
    box.addEventListener('click', onDetailClick);
    box.addEventListener('keydown', onDetailKey);
    const title = qs('.d-title', box);
    if (isNew || !it.title) title.focus(); else qs('.pl-sheet', box).focus();
  }
  function refreshDetail() {
    if (!detail) return;
    const it = detailItem();
    if (!it) { closeDetail(true); return; }
    const sheet = qs('.pl-sheet', detail.box);
    const focused = document.activeElement && sheet.contains(document.activeElement) ? document.activeElement.dataset.f : null;
    sheet.tabIndex = -1;
    sheet.innerHTML = detail.kind === 'task' ? taskForm(it) : eventForm(it);
    if (focused) { const f = qs(`[data-f="${focused}"]`, sheet); if (f) f.focus(); }
  }
  function onDetailInput(e) {
    const it = detailItem(); if (!it) return;
    const el = e.target;
    if (el.dataset.sub != null) { it.subtasks[+el.dataset.sub].title = el.value; touch(it); C.persist(); render(); return; }
    const f = el.dataset.f; if (!f) return;
    if (e.type === 'input' && (el.tagName === 'SELECT' || el.type === 'checkbox' || el.type === 'date' || el.type === 'time')) return;   // handled on change
    let v = el.type === 'checkbox' ? el.checked : el.value;
    if (f === 'remind') { v = v === '' ? null : Number(v); if (v != null) ensurePermission(); }
    if (f === 'priority') v = Number(v);
    if (f === 'repeat' || f === 'noteId') v = v || null;
    if (f === 'due' || f === 'time') v = v || null;
    if (f === 'tags') v = [...new Set(v.split(/[,\s]+/).map((x) => x.replace(/^#/, '').trim().toLowerCase()).filter(Boolean))];
    if (f === 'status') {
      if (v === 'done' && !it.done) { toggleTask(it); return; }
      if (v !== 'done') { it.done = false; it.doneAt = null; }
    }
    if (f === 'date' && !v) return;
    it[f] = v;
    if (detail.kind === 'event' && (f === 'start' || f === 'end') && it.start && it.end && mins(it.end) <= mins(it.start)) {
      if (f === 'start') it.end = hm(Math.min(mins(it.start) + 60, 23 * 60 + 59));
    }
    if (detail.kind === 'task' && f === 'repeat' && v && !it.due) it.due = todayStr();
    if (detail.kind === 'task' && f === 'time' && v && !it.due) it.due = todayStr();
    touch(it); C.persist(); C.renderSidebar(); render();
    if (e.type === 'change' && ['allDay', 'link', 'noteId', 'repeat', 'status', 'priority', 'start', 'due'].includes(f)) refreshDetail();
  }
  function onDetailClick(e) {
    if (e.target === detail.box) { closeDetail(); return; }
    const a = e.target.closest('[data-act]'); if (!a) return;
    const it = detailItem(); if (!it) return;
    switch (a.dataset.act) {
      case 'close': closeDetail(); break;
      case 'dtoggle': toggleTask(it); break;
      case 'delete':
        if (!confirm(`Delete this ${detail.kind}?`)) return;
        removeItem(detail.kind, it); detail.isNew = false; closeDetail(); commit(); break;
      case 'subtoggle': { const s = it.subtasks[+a.closest('.sub').dataset.i]; s.done = !s.done; touch(it); C.persist(); render(); refreshDetail(); break; }
      case 'subdel': it.subtasks.splice(+a.closest('.sub').dataset.i, 1); touch(it); C.persist(); render(); refreshDetail(); break;
      case 'opennote': { const nid = it.noteId; closeDetail(); C.gotoNote(nid); break; }
      case 'djoin': openLink(it.link); break;
    }
  }
  function onDetailKey(e) {
    if (e.key === 'Escape') { e.preventDefault(); closeDetail(); return; }
    if (e.key === 'Enter' && e.target.classList.contains('sub-add') && e.target.value.trim()) {
      const it = detailItem();
      it.subtasks = (it.subtasks || []).concat({ id: C.uid(), title: e.target.value.trim(), done: false });
      touch(it); C.persist(); render(); refreshDetail();
      const add = qs('.sub-add', detail.box); if (add) add.focus();
    } else if (e.key === 'Enter' && e.target.classList.contains('d-title')) { e.preventDefault(); closeDetail(); }
  }
  function closeDetail(silent) {
    if (!detail) return;
    const it = detailItem();
    if (it && detail.isNew && !it.title.trim()) removeItem(detail.kind, it);   // abandoned new item
    detail.box.remove();
    detail = null;
    if (!silent) commit();
  }

  // ---------- quick launcher (⌘K) ----------
  let launcher = null;
  function openLauncher(prefill = '') {
    if (launcher) { qs('input', launcher.box).focus(); return; }
    const box = document.createElement('div');
    box.className = 'launcher-wrap';
    box.innerHTML = `<div class="launcher" role="dialog" aria-label="Search or create">
      <div class="lc-in"><span>⌕</span><input placeholder="Search, or create anything…  e.g. “new event tomorrow 10:00 Design meeting”" aria-label="Search or create"><kbd>esc</kbd></div>
      <div class="lc-chips"></div><div class="lc-list" role="listbox"></div></div>`;
    document.body.appendChild(box);
    launcher = { box, sel: 0, actions: [] };
    const input = qs('input', box);
    input.value = prefill;
    input.addEventListener('input', updateLauncher);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); const n = launcher.actions.length; if (n) { launcher.sel = (launcher.sel + (e.key === 'ArrowDown' ? 1 : -1) + n) % n; paintSel(); } }
      else if (e.key === 'Enter') { e.preventDefault(); runAction(launcher.actions[launcher.sel]); }
      else if (e.key === 'Escape') { e.preventDefault(); closeLauncher(); }
    });
    box.addEventListener('mousedown', (e) => { if (e.target === box) closeLauncher(); });
    box.addEventListener('click', (e) => { const r = e.target.closest('[data-i]'); if (r) runAction(launcher.actions[+r.dataset.i]); });
    updateLauncher();
    input.focus();
  }
  function closeLauncher() { if (launcher) { launcher.box.remove(); launcher = null; } }
  function updateLauncher() {
    const text = qs('input', launcher.box).value;
    const p = parseQuick(text);
    const acts = [];
    const typed = text.trim();
    const desc = (type) => {
      if (type === 'event') { const d = p.date || todayStr(); return `${dayLabel(d)}${p.time ? ', ' + fmtTime(p.time) + (p.end ? ' – ' + fmtTime(p.end) : '') : ''}`; }
      if (type === 'note') return 'New note';
      return [p.date ? dayLabel(p.date) : 'Inbox', p.time && fmtTime(p.time), p.repeat && '↻ ' + p.repeat, p.priority && '!'.repeat(p.priority)].filter(Boolean).join(' · ');
    };
    if (typed && p.title) {
      const order = p.type ? [p.type] : ['task', 'event', 'note'];
      for (const type of order) acts.push({ kind: 'create', type, label: p.title, sub: desc(type) });
    }
    const q = (p.type ? p.title : typed).toLowerCase();
    const results = [];
    if (q) {
      const score = (s) => { s = (s || '').toLowerCase(); return s.startsWith(q) ? 2 : s.includes(q) ? 1 : 0; };
      allTasks().forEach((t) => { const sc = score(t.title) || (score(t.notes) && 0.5); if (sc) results.push({ kind: 'open', type: 'task', id: t.id, label: t.title, sub: t.due ? dayLabel(t.due) : 'Task', sc }); });
      allEvents().forEach((e) => { const sc = score(e.title); if (sc) results.push({ kind: 'open', type: 'event', id: e.id, label: e.title, sub: 'Event · ' + shortDate(e.date), sc }); });
      C.notesList().forEach((n) => { const sc = score(n.title) || (score(n.text) && 0.5); if (sc) results.push({ kind: 'open', type: 'note', id: n.id, label: n.title, sub: 'Note', sc }); });
      results.sort((a, b) => b.sc - a.sc);
    }
    const found = results.slice(0, 8);
    // plain words that match something: open it by default; anything with a type or date/time: create
    launcher.actions = !p.type && p.tokens === 0 && found.length ? found.concat(acts) : acts.concat(found);
    if (!typed) {
      launcher.actions = [{ kind: 'nav', view: 'today', label: 'Today', sub: 'Go to' }, { kind: 'nav', view: 'calendar', label: 'Calendar', sub: 'Go to' },
        { kind: 'nav', view: 'tasks', label: 'Tasks', sub: 'Go to' }, { kind: 'nav', view: 'reminders', label: 'Reminders', sub: 'Go to' }, { kind: 'nav', view: 'all', label: 'Notes', sub: 'Go to' }];
    }
    launcher.sel = 0;
    const chips = [];
    if (p.type) chips.push(`<span class="lc-chip t">${p.type}</span>`);
    if (p.date) chips.push(`<span class="lc-chip">${esc(dayLabel(p.date))}</span>`);
    if (p.time) chips.push(`<span class="lc-chip">${fmtTime(p.time)}${p.end ? ' – ' + fmtTime(p.end) : ''}</span>`);
    if (p.repeat) chips.push(`<span class="lc-chip">↻ ${p.repeat}</span>`);
    if (p.priority) chips.push(`<span class="lc-chip">${['', 'Low', 'Medium', 'High'][p.priority]} priority</span>`);
    p.tags.forEach((g) => chips.push(chip(g)));
    qs('.lc-chips', launcher.box).innerHTML = chips.join('');
    const icon = { task: '○', event: '●', note: '✎' };
    let lastKind = null;
    qs('.lc-list', launcher.box).innerHTML = launcher.actions.map((a, i) => {
      const group = a.kind === 'create' ? 'Create' : a.kind === 'open' ? 'Results' : 'Go to';
      const h = group !== lastKind ? `<div class="lc-g">${group}</div>` : '';
      lastKind = group;
      return `${h}<div class="lc-item" data-i="${i}" role="option"><span class="lc-ic ${a.type || ''}">${a.kind === 'nav' ? '→' : icon[a.type]}</span>
        <div><b>${a.kind === 'create' ? `New ${a.type}: ` : ''}${esc(a.label || 'Untitled')}</b><span>${esc(a.sub || '')}</span></div><kbd>↵</kbd></div>`;
    }).join('') || '<div class="lc-empty">Type to search, or to create a task, event or note.</div>';
    paintSel();
  }
  function paintSel() {
    launcher.box.querySelectorAll('.lc-item').forEach((el) => el.classList.toggle('sel', +el.dataset.i === launcher.sel));
    const cur = qs('.lc-item.sel', launcher.box); if (cur) cur.scrollIntoView({ block: 'nearest' });
  }
  function runAction(a) {
    if (!a) return;
    const text = qs('input', launcher.box).value;
    closeLauncher();
    if (a.kind === 'nav') { C.setView(a.view); return; }
    if (a.kind === 'open') {
      if (a.type === 'note') C.gotoNote(a.id);
      else { if (a.type === 'event') { const ev = findEvent(a.id); if (ev) calAnchor = ev.date; } openDetail(a.type, a.id); }
      return;
    }
    const p = parseQuick(text);
    if (a.type === 'note') { C.createNote(p.title); return; }
    const res = createFromParse(Object.assign(p, { type: a.type }));
    commit();
    toast(`${a.type === 'event' ? 'Event' : 'Task'} added · ${a.sub}`, () => openDetail(res.kind, res.item.id));
  }

  // ---------- reminders ----------
  // Mac: handed to macOS (fires even when the app is closed). Windows / browser: checked here while the app runs.
  let nativeReminders = false, remTimer = null;
  function upcomingReminders() {
    const now = Date.now(), out = [];
    for (const t of allTasks()) {
      if (t.done || !t.due || t.remind == null) continue;
      const at = dateAt(t.due, t.time || '09:00').getTime() - t.remind * 60000;
      out.push({ key: `t:${t.id}:${at}`, kind: 'task', id: t.id, at, title: t.title || 'Task', body: `${t.time ? fmtTime(t.time) : dayLabel(t.due)}${t.remind ? ` · in ${remindLabel(t.remind)}` : ''}` });
    }
    const today = todayStr();
    for (const e of allEvents()) {
      if (e.remind == null) continue;
      for (let i = -1; i < 31; i++) {
        const ds = ymd(addDays(today, i));
        if (!occursOn(e, ds)) continue;
        const at = dateAt(ds, e.allDay ? '09:00' : e.start).getTime() - e.remind * 60000;
        if (at < now - 6 * 3600e3) continue;
        out.push({ key: `e:${e.id}:${at}`, kind: 'event', id: e.id, at, title: e.title || 'Event', body: `${dayLabel(ds)}${e.allDay ? '' : ', ' + fmtTime(e.start)}${e.location ? ' · ' + e.location : ''}` });
        if (!repeating(e)) break;
      }
    }
    readLS(SNOOZE_KEY, []).forEach((s) => out.push(s));
    return out.sort((a, b) => a.at - b.at);
  }
  const remindLabel = (m) => (m >= 1440 ? `${m / 1440} day` : m >= 60 ? `${m / 60} hour` : `${m} min`);
  function scheduleReminders() { clearTimeout(remTimer); remTimer = setTimeout(applyReminders, 800); }
  let nextTimer = null;
  const notif = { status: null, error: '' };       // macOS Notification Centre permission, shown on the Reminders page
  async function refreshNotifStatus() {
    if (!C.native || !C.native.notifStatus) return;
    try { const st = JSON.parse(await C.native.notifStatus()); notif.status = st.status; notif.error = st.error || ''; notif.style = st.style; } catch {}
    if (view === 'reminders') render();
  }
  async function allowNotifications() {
    try {
      const r = JSON.parse(await C.native.notifRequest());
      if (r.granted === 'yes') toast('Notification Centre is on for Notes.');
      else toast(r.error ? `macOS said: “${r.error}”. Click “Open Settings” and turn on notifications for Notes.` : 'Turn on notifications for Notes in System Settings.', () => C.native.openNotifSettings(), null, 15000);
      notif.error = r.error || '';
    } catch {}
    await refreshNotifStatus(); applyReminders();
  }
  function chime() {                               // browser only: the desktop apps play their own alarm sound
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const beep = (f, t, d) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = f; o.connect(g); g.connect(ctx.destination);
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.25, t + 0.01); g.gain.exponentialRampToValueAtTime(0.001, t + d); o.start(t); o.stop(t + d); };
      for (let i = 0; i < 3; i++) { beep(880, ctx.currentTime + i * 0.5, 0.18); beep(1175, ctx.currentTime + i * 0.5 + 0.22, 0.22); }
    } catch {}
  }
  function alertStatusLine() {
    if (!C.native) return '';
    if (C.native.alarm) return '<div class="pl-alertline ok">🔔 Reminders ring and pop up at the top right of your screen, and go to the notification centre. Closing the window keeps Notes running in the tray.</div>';
    if (!C.native.notifStatus) return '';
    const base = '🔔 Reminders ring and pop up at the top right while Notes is running (closing the window keeps it in the Dock).';
    if (notif.status === 'ok') return `<div class="pl-alertline ok">${base} They also go to Notification Centre.</div>`;
    if (notif.status == null) return '';
    return `<div class="pl-alertline warn">${base}<br><b>Notification Centre is off for Notes</b>${notif.error ? ` — macOS said: “${esc(notif.error)}”` : ''}.
      <span><button class="pl-btn primary" data-act="allownotif">Allow notifications</button><button class="pl-btn" data-act="notifsettings">Open Settings</button></span></div>`;
  }
  async function applyReminders() {
    const list = upcomingReminders();
    const now = Date.now();
    if (C.native && C.native.schedule) {
      try {
        const r = await C.native.schedule(list.filter((x) => x.at > now).slice(0, 60).map((x) => ({ id: x.key, title: x.title, body: x.body, at: x.at, kind: x.kind, item: x.id })));
        nativeReminders = true;                        // the Mac app rings and shows its own alarm card
        if (r !== notif.status) { notif.status = r; if (view === 'reminders') render(); }
      } catch { nativeReminders = false; }
    }
    tick();
    // wake up exactly when the next reminder is due (the 30-second check is only a safety net)
    clearTimeout(nextTimer);
    const next = list.find((x) => x.at > Date.now());
    if (next) nextTimer = setTimeout(applyReminders, Math.min(next.at - Date.now() + 50, 6 * 3600e3));
  }
  function testAlert() {
    const at = Date.now() + 5000;
    writeLS(SNOOZE_KEY, readLS(SNOOZE_KEY, []).concat({ key: 'test:' + at, kind: 'test', id: '', at, title: 'Test reminder', body: 'Alerts are working. Snooze, Done and Open will appear on real reminders.' }));
    ensurePermission();
    toast('A test alarm will ring in 5 seconds. You can switch to another app.');
    applyReminders();
  }
  function snoozeFromAlarm(r, minutes = 10) {
    const at = Date.now() + minutes * 60000;
    writeLS(SNOOZE_KEY, readLS(SNOOZE_KEY, []).concat(Object.assign({}, r, { key: String(r.key).split(':s')[0] + ':s' + at, at })));
    applyReminders();
  }
  function completeFromAlarm(id) { const t = findTask(id); if (t && !t.done) toggleTask(t); }
  function tick() {
    const now = Date.now();
    const done = readLS(REMINDED_KEY, {});
    let changed = false;
    for (const r of upcomingReminders()) {
      if (r.at > now || r.at < now - 6 * 3600e3 || done[r.key]) continue;
      done[r.key] = now; changed = true;
      fire(r);
    }
    for (const k in done) if (done[k] < now - 3 * 864e5) { delete done[k]; changed = true; }
    const snoozes = readLS(SNOOZE_KEY, []), left = snoozes.filter((s) => !done[s.key]);
    if (left.length !== snoozes.length) writeLS(SNOOZE_KEY, left);
    if (changed) writeLS(REMINDED_KEY, done);
  }
  function fire(r) {
    if (C.native && C.native.schedule) return;         // Mac: the app's own timers ring the alarm card (and macOS files it)
    if (C.native && C.native.alarm) {                  // Windows: toast in the notification centre + alarm card at the top right
      C.native.alarm({ key: r.key, kind: r.kind, id: r.id, title: r.title, body: r.body });
      return;
    }
    chime();
    toast(`⏰ ${r.title} — ${r.body}`, () => openItem(r.kind, r.id), r.kind === 'test' ? null : r, 0);
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    try {
      const n = new Notification(r.title, { body: r.body, tag: r.key });
      n.onclick = () => { if (C.native && C.native.focus) C.native.focus(); window.focus(); openItem(r.kind, r.id); n.close(); };
    } catch {}
  }
  function ensurePermission() {
    if (C && C.native && C.native.schedule) return;   // macOS asks on its own
    if ('Notification' in window && Notification.permission === 'default') { try { Notification.requestPermission(); } catch {} }
  }
  function openItem(kind, id) {
    if (kind === 'test' || !id) return;
    if (kind === 'note') { C.gotoNote(id); return; }
    if (kind === 'event') { const e = findEvent(id); if (e) calAnchor = e.date; }
    if (!VIEWS.includes(view)) C.setView('today');
    openDetail(kind, id);
  }

  // ---------- toasts ----------
  function toast(text, onOpen, reminder, timeout = 3500) {
    let wrap = qs('#pl-toasts');
    if (!wrap) { wrap = document.createElement('div'); wrap.id = 'pl-toasts'; wrap.setAttribute('aria-live', 'polite'); document.body.appendChild(wrap); }
    const el = document.createElement('div');
    el.className = 'pl-toast' + (reminder ? ' rem' : '');
    el.innerHTML = `<span>${esc(text)}</span>${onOpen ? '<button data-t="open">Open</button>' : ''}${reminder && reminder.kind === 'task' ? '<button data-t="done">Done</button>' : ''}${reminder ? '<button data-t="snooze">Snooze 10m</button>' : ''}<button data-t="x" aria-label="Dismiss">✕</button>`;
    el.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.t === 'open' && onOpen) onOpen();
      if (b.dataset.t === 'done') { const t = findTask(reminder.id); if (t && !t.done) toggleTask(t); }
      if (b.dataset.t === 'snooze') snoozeFromAlarm(reminder);
      el.remove();
    });
    wrap.appendChild(el);
    if (timeout) setTimeout(() => el.remove(), timeout);
  }

  // ---------- public API ----------
  function show(v) {
    view = v;
    C.showPlanner(true);
    if (v === 'today') { selDay = todayStr(); if (selDay < stripStart || selDay >= ymd(addDays(stripStart, 14))) stripStart = selDay; }
    if (v === 'reminders') refreshNotifStatus();
    render();
  }
  function counts() {
    const t = todayStr();
    return {
      today: itemsOn(t).filter((x) => !x.item.done).length + overdueTasks().length,
      upcoming: '',
      calendar: '',
      tasks: allTasks().filter((x) => !x.done).length,
      reminders: reminderEntries().filter((x) => ymd(new Date(x.at)) <= t).length,
      events: allEvents().filter((e) => { for (let i = 0; i < 30; i++) if (occursOn(e, ymd(addDays(t, i)))) return true; return false; }).length,
    };
  }
  function init(core) {
    C = core;
    const root = qs('#planner'), inbox = qs('#inbox');
    [root, inbox].forEach((el) => {
      el.addEventListener('click', onClick);
      el.addEventListener('keydown', onKey);
      el.addEventListener('change', onChange);
      el.addEventListener('dragstart', onDragStart);
      el.addEventListener('dragover', onDragOver);
      el.addEventListener('drop', onDrop);
      el.addEventListener('dragend', onDragEnd);
    });
    setInterval(() => { tick(); if (view === 'calendar' || view === 'today') { const a = document.activeElement; if (!a || !root.contains(a)) render(); } }, 30000);
    setInterval(applyReminders, 3600e3);
    scheduleReminders();
    refreshNotifStatus();
  }
  window.Planner = {
    init, show, render, counts, isView: (v) => VIEWS.includes(v), get inboxOpen() { return prefs.inbox; },
    dataChanged: () => { scheduleReminders(); },
    openLauncher, closeLauncher, openItem,
    newTask: () => { const t = newTask({ due: VIEWS.includes(view) && view === 'today' ? selDay : null }); commit(); openDetail('task', t.id, true); },
    newEvent: () => { const e = newEvent({}); commit(); openDetail('event', e.id, true); },
    snoozeFromAlarm, completeFromAlarm, testAlert,
    noteBoard: {                                       // the Board block inside a note
      tasks: (noteId) => allTasks().filter((t) => t.noteId === noteId).sort((a, b) => (b.priority || 0) - (a.priority || 0) || (a.due || '9').localeCompare(b.due || '9') || a.created - b.created),
      add: (noteId, text, status) => {
        const res = createFromParse(Object.assign(parseQuick(text), { type: 'task' }));
        res.item.noteId = noteId;
        if (status === 'doing') res.item.status = 'doing';
        commit();
      },
      toggle: (id) => { const t = findTask(id); if (t) toggleTask(t); },
      setStatus: (id, st) => {
        const t = findTask(id); if (!t) return;
        if (st === 'done') { if (!t.done) toggleTask(t); return; }
        t.done = false; t.doneAt = null; t.status = st; touch(t); commit();
      },
      open: (id) => openDetail('task', id),
    },
    taskFromNote: (noteId, title) => { const t = newTask({ title: title || 'Follow up', noteId }); commit(); openDetail('task', t.id, true); toast('Task created and linked to the note'); },
    toast,
  };
})();
