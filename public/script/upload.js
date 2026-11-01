function $(id) { return document.getElementById(id); }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function ic(name, cls) { var s = el('span', 'ms' + (cls ? ' ' + cls : ''), name); s.setAttribute('aria-hidden', 'true'); return s; }
  function btn(cls, icon, label) { var b = el('button', 'btn ' + cls); b.type = 'button'; b.append(ic(icon), document.createTextNode(label)); return b; }
  var ICONS = { Schedule:'schedule', Email:'mail', Phone:'call', Location:'location_on', Started:'event', Notes:'notes' };
  function mins(t) { var p = t.split(':'); return +p[0] * 60 + +p[1]; }

  var DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  var PALETTE = [
    { bar:'#4fa874', bg:'#e3f4ea', fg:'#2b7048' }, { bar:'#4d6bf0', bg:'#e6ebff', fg:'#3150d1' },
    { bar:'#7a4fd6', bg:'#eee8fd', fg:'#5a32b4' }, { bar:'#f2547d', bg:'#fde8ee', fg:'#c42f58' },
    { bar:'#f08a3c', bg:'#fdeedd', fg:'#a85a14' }, { bar:'#14a3a3', bg:'#dff5f5', fg:'#0e6f6f' },
    { bar:'#d9a400', bg:'#fbf3d4', fg:'#8a6a00' }, { bar:'#475569', bg:'#e8ecf2', fg:'#334155' }
  ];
  var NOCAT = { bar:'#8a94a8', bg:'#eceff5', fg:'#4a5568' };
  var cats = [], catSeq = 1;          // user-created categories: {id, name, pi}
  var people = [], pidSeq = 1, ciSeq = 0, shown = {};
  var refreshCal = function () {};

  function catStyle(id) { for (var i = 0; i < cats.length; i++) if (cats[i].id === id) return PALETTE[cats[i].pi]; return NOCAT; }
  function personStyle(p) { return PALETTE[p.ci % PALETTE.length]; }
  function schedMinutes(sc) { var t = 0; (sc || []).forEach(function (d) { if (d.on) t += mins(d.end) - mins(d.start); }); return t; }
  function hm(m) { return Math.floor(m / 60) + 'h' + pad(m % 60); }
  function schedSummary(sc) {
    var out = [], i = 0;
    while (i < 7) {
      var d = sc[i];
      if (!d || !d.on) { i++; continue; }
      var j = i;
      while (j + 1 < 7 && sc[j + 1] && sc[j + 1].on && sc[j + 1].start === d.start && sc[j + 1].end === d.end) j++;
      out.push((i === j ? DAYS[i] : DAYS[i] + '–' + DAYS[j]) + ' ' + d.start + '–' + d.end);
      i = j + 1;
    }
    return out;
  }

  /* ================= CALENDAR ================= */
  (function () {
    var HH = 56, START = 7, END = 21;
    var MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    var MS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    function iso(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
    function parse(s) { var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
    function addDays(d, n) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); }
    function monday(d) { return addDays(d, -((d.getDay() + 6) % 7)); }
    function isoWeek(d) {
      var t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
      var n = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - n);
      var y = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
      return Math.ceil(((t - y) / 864e5 + 1) / 7);
    }
    var ICON_CLOCK = '<span class="ms sm" aria-hidden="true">schedule</span>';
    var ICON_EDIT = '<span class="ms sm" aria-hidden="true">edit</span>';

    var now = new Date();
    var todayD = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    var sel = todayD, weekStart = monday(sel), miniM = new Date(sel.getFullYear(), sel.getMonth(), 1);
    var hidden = {}, events = [], nextId = 1, editId = null;

    function visible(e) { return !e.cat || !hidden[e.cat]; }

    function renderMini() {
      $('miniTitle').textContent = MONTHS[miniM.getMonth()] + ' ' + miniM.getFullYear();
      var g = $('miniGrid'); g.innerHTML = '';
      DAYS.forEach(function (d) { g.appendChild(el('div', 'dow', d)); });
      var first = monday(miniM);
      var dim = new Date(miniM.getFullYear(), miniM.getMonth() + 1, 0).getDate();
      var rows = Math.ceil((((miniM.getDay() + 6) % 7) + dim) / 7);
      for (var i = 0; i < rows * 7; i++) {
        (function (d) {
          var b = el('button', 'mini-day', String(d.getDate())); b.type = 'button';
          if (d.getMonth() !== miniM.getMonth()) b.classList.add('other');
          if (iso(d) === iso(sel)) b.classList.add('sel');
          if (iso(d) === iso(todayD)) b.classList.add('today');
          b.setAttribute('aria-label', d.toDateString());
          var seen = [];
          events.forEach(function (e) { if (e.date === iso(d) && visible(e) && seen.indexOf(e.cat) < 0) seen.push(e.cat); });
          if (seen.length) {
            var dots = el('span', 'dots');
            seen.slice(0, 3).forEach(function (c) { var x = el('i'); x.style.background = catStyle(c).bar; dots.appendChild(x); });
            b.appendChild(dots);
          }
          b.addEventListener('click', function () { sel = d; weekStart = monday(d); miniM = new Date(d.getFullYear(), d.getMonth(), 1); render(); });
          g.appendChild(b);
        })(addDays(first, i));
      }
    }

    function renderCats() {
      var ul = $('catList'); ul.innerHTML = '';
      if (!cats.length) { ul.appendChild(el('li', 'cat-empty', 'No categories yet. Create one to colour and filter your events.')); return; }
      var ws = iso(weekStart), we = iso(addDays(weekStart, 6));
      cats.forEach(function (c) {
        var total = 0;
        events.forEach(function (e) { if (e.cat === c.id && e.date >= ws && e.date <= we) total += mins(e.end) - mins(e.start); });
        var li = el('li', 'cat'), lab = el('label');
        var cb = el('input'); cb.type = 'checkbox'; cb.checked = !hidden[c.id]; cb.style.setProperty('--c', PALETTE[c.pi].bar);
        cb.addEventListener('change', function () { hidden[c.id] = !cb.checked; render(); });
        lab.append(cb, document.createTextNode(c.name));
        var h = el('span', 'hrs'); h.innerHTML = ICON_CLOCK; h.appendChild(document.createTextNode(hm(total)));
        var ed = el('button', 'edit'); ed.type = 'button'; ed.innerHTML = ICON_EDIT; ed.setAttribute('aria-label', 'Edit category ' + c.name);
        ed.addEventListener('click', function () { openCat(c.id); });
        li.append(lab, h, ed); ul.appendChild(li);
      });
    }

    function renderShiftList() {
      var ul = $('shiftList'); ul.innerHTML = '';
      if (!people.length) { ul.appendChild(el('li', 'cat-empty', 'Add colleagues and their work schedules will show up here.')); return; }
      people.forEach(function (p) {
        var li = el('li', 'cat'), lab = el('label');
        var cb = el('input'); cb.type = 'checkbox'; cb.checked = !!shown[p.id]; cb.style.setProperty('--c', personStyle(p).bar);
        cb.addEventListener('change', function () { shown[p.id] = cb.checked; renderWeek(); });
        lab.append(cb, document.createTextNode(p.name));
        var tot = schedMinutes(p.sched);
        var h = el('span', 'hrs');
        if (tot) { h.innerHTML = ICON_CLOCK; h.appendChild(document.createTextNode(hm(tot) + '/wk')); } else { h.textContent = 'No schedule'; }
        li.append(lab, h); ul.appendChild(li);
      });
    }

    function layout(list) {
      list.sort(function (a, b) { return a.s - b.s || b.e - a.e; });
      var cols = [], cluster = [], cEnd = 0;
      function flush() { var n = cols.length; cluster.forEach(function (x) { x.n = n; }); cols = []; cluster = []; cEnd = 0; }
      list.forEach(function (x) {
        if (cluster.length && x.s >= cEnd) flush();
        var c = 0; while (cols[c] !== undefined && cols[c] > x.s) c++;
        cols[c] = x.e; x.c = c; cluster.push(x); cEnd = Math.max(cEnd, x.e);
      });
      flush();
    }
    function place(b, x) {
      b.style.top = ((x.s - START * 60) / 60 * HH) + 'px';
      b.style.height = Math.max((x.e - x.s) / 60 * HH - 2, 22) + 'px';
      b.style.left = 'calc(' + (x.c / x.n * 100) + '% + 3px)';
      b.style.width = 'calc(' + (100 / x.n) + '% - 6px)';
    }

    function makeCol(d) {
      var col = el('div', 'dcol');
      col.addEventListener('click', function (e) {
        if (e.target !== col) return;
        var r = col.getBoundingClientRect();
        var h = Math.min(Math.max(START + Math.floor((e.clientY - r.top) / HH), START), END - 1);
        openEv(null, { date: iso(d), start: pad(h) + ':00', end: pad(h + 1) + ':00' });
      });
      // fixed weekly work schedules (behind events)
      var idx = (d.getDay() + 6) % 7, sl = [];
      people.forEach(function (p) {
        if (!shown[p.id]) return;
        var sd = p.sched && p.sched[idx];
        if (!sd || !sd.on) return;
        var s = Math.max(mins(sd.start), START * 60), e = Math.min(mins(sd.end), END * 60);
        if (e > s) sl.push({ p: p, sd: sd, s: s, e: e });
      });
      layout(sl);
      sl.forEach(function (x) {
        var st = personStyle(x.p), b = el('div', 'shift');
        b.style.setProperty('--bar', st.bar); b.style.setProperty('--bgc', st.bg); b.style.setProperty('--fg2', st.fg);
        place(b, x);
        b.appendChild(document.createTextNode(x.p.name));
        b.appendChild(el('small', '', x.sd.start + ' - ' + x.sd.end));
        col.appendChild(b);
      });
      var list = [];
      events.forEach(function (ev) {
        if (ev.date !== iso(d) || !visible(ev)) return;
        var s = Math.max(mins(ev.start), START * 60), e = Math.min(mins(ev.end), END * 60);
        if (e > s) list.push({ ev: ev, s: s, e: e });
      });
      layout(list);
      list.forEach(function (x) {
        var st = catStyle(x.ev.cat), b = el('button', 'ev'); b.type = 'button';
        b.style.setProperty('--bar', st.bar); b.style.setProperty('--bgc', st.bg); b.style.setProperty('--fg2', st.fg);
        place(b, x);
        if ((x.e - x.s) / 60 * HH < 44) b.classList.add('short');
        b.appendChild(el('b', '', x.ev.title));
        b.appendChild(el('small', '', x.ev.start + ' - ' + x.ev.end));
        b.setAttribute('aria-label', x.ev.title + ', ' + x.ev.start + ' to ' + x.ev.end);
        b.addEventListener('click', function (e) { e.stopPropagation(); openEv(x.ev.id); });
        col.appendChild(b);
      });
      if (iso(d) === iso(todayD)) {
        var n = new Date(), nm = n.getHours() * 60 + n.getMinutes();
        if (nm >= START * 60 && nm < END * 60) { var line = el('div', 'now'); line.style.top = ((nm - START * 60) / 60 * HH) + 'px'; col.appendChild(line); }
      }
      return col;
    }

    function renderWeek() {
      var end = addDays(weekStart, 6);
      $('wkTitle').textContent = MS[weekStart.getMonth()] + ' ' + weekStart.getDate() + ' – ' +
        (end.getMonth() !== weekStart.getMonth() ? MS[end.getMonth()] + ' ' : '') + end.getDate() + ', ' + end.getFullYear();
      $('wkBadge').textContent = 'Week ' + isoWeek(addDays(weekStart, 3));
      var head = $('wkHead'); head.innerHTML = ''; head.appendChild(el('div'));
      var body = $('wkBody'); body.innerHTML = '';
      var tc = el('div', 'tcol');
      for (var h = START; h < END; h++) { var sp = el('span', '', pad(h) + ':00'); sp.style.top = ((h - START) * HH) + 'px'; tc.appendChild(sp); }
      body.appendChild(tc);
      for (var i = 0; i < 7; i++) {
        (function (d, i) {
          var b = el('button', 'dayh'); b.type = 'button';
          b.appendChild(document.createTextNode(DAYS[i]));
          b.appendChild(el('b', '', String(d.getDate())));
          if (iso(d) === iso(sel)) b.classList.add('sel');
          b.setAttribute('aria-label', d.toDateString());
          b.addEventListener('click', function () { sel = d; miniM = new Date(d.getFullYear(), d.getMonth(), 1); render(); });
          head.appendChild(b); body.appendChild(makeCol(d));
        })(addDays(weekStart, i), i);
      }
    }

    function render() { renderMini(); renderCats(); renderShiftList(); renderWeek(); }
    refreshCal = render;

    function shiftWeek(n) { weekStart = addDays(weekStart, n * 7); sel = addDays(sel, n * 7); miniM = new Date(sel.getFullYear(), sel.getMonth(), 1); render(); }
    $('wkPrev').addEventListener('click', function () { shiftWeek(-1); });
    $('wkNext').addEventListener('click', function () { shiftWeek(1); });
    $('miniPrev').addEventListener('click', function () { miniM = new Date(miniM.getFullYear(), miniM.getMonth() - 1, 1); renderMini(); });
    $('miniNext').addEventListener('click', function () { miniM = new Date(miniM.getFullYear(), miniM.getMonth() + 1, 1); renderMini(); });

    /* ---- category dialog ---- */
    var catDlg = $('catDlg'), editCat = null, selPi = 0;
    function renderSw() {
      var row = $('swRow'); row.innerHTML = '';
      PALETTE.forEach(function (c, i) {
        var b = el('button', 'sw'); b.type = 'button'; b.style.background = c.bar;
        b.setAttribute('aria-label', 'Colour ' + (i + 1)); b.setAttribute('aria-pressed', String(i === selPi));
        b.addEventListener('click', function () { selPi = i; renderSw(); });
        row.appendChild(b);
      });
    }
    function openCat(id) {
      editCat = id || null;
      var c = id ? cats.filter(function (x) { return x.id === id; })[0] : null;
      $('c-name').value = c ? c.name : '';
      selPi = c ? c.pi : cats.length % PALETTE.length;
      $('catTitle').textContent = c ? 'Edit category' : 'New category';
      $('catDel').style.display = c ? '' : 'none';
      renderSw(); catDlg.showModal(); $('c-name').focus();
    }
    function closeCat() { catDlg.close(); }
    $('addCat').addEventListener('click', function () { openCat(); });
    $('catClose').addEventListener('click', closeCat);
    $('catCancel').addEventListener('click', closeCat);
    catDlg.addEventListener('click', function (e) { if (e.target === catDlg) closeCat(); });
    $('catDel').addEventListener('click', function () {
      cats = cats.filter(function (x) { return x.id !== editCat; });
      events.forEach(function (e) { if (e.cat === editCat) e.cat = ''; });
      delete hidden[editCat]; closeCat(); render();
    });
    $('catForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var name = $('c-name').value.trim(); if (!name) return;
      if (editCat) cats.forEach(function (c) { if (c.id === editCat) { c.name = name; c.pi = selPi; } });
      else cats.push({ id: 'c' + (catSeq++), name: name, pi: selPi });
      closeCat(); render();
    });

    /* ---- event dialog ---- */
    var evDlg = $('evDlg'), selCat = $('e-cat');
    function openEv(id, preset) {
      editId = id;
      var e = id ? events.filter(function (x) { return x.id === id; })[0] : preset;
      selCat.innerHTML = '';
      var none = el('option', '', 'No category'); none.value = ''; selCat.appendChild(none);
      cats.forEach(function (c) { var o = el('option', '', c.name); o.value = c.id; selCat.appendChild(o); });
      $('e-title').value = e.title || '';
      selCat.value = e.cat || '';
      $('e-date').value = e.date || iso(sel);
      $('e-start').value = e.start || '09:00';
      $('e-end').value = e.end || '10:00';
      $('evTitle').textContent = id ? 'Edit event' : 'Create event';
      $('evSave').textContent = id ? 'Save changes' : 'Save event';
      $('evDel').style.display = id ? '' : 'none';
      evDlg.showModal(); $('e-title').focus();
    }
    function closeEv() { evDlg.close(); }
    $('createEv').addEventListener('click', function () { openEv(null, { date: iso(sel), start: '09:00', end: '10:00' }); });
    $('evClose').addEventListener('click', closeEv);
    $('evCancel').addEventListener('click', closeEv);
    evDlg.addEventListener('click', function (e) { if (e.target === evDlg) closeEv(); });
    $('e-start').addEventListener('input', function () { $('e-end').setCustomValidity(''); });
    $('e-end').addEventListener('input', function () { $('e-end').setCustomValidity(''); });
    $('evDel').addEventListener('click', function () { events = events.filter(function (x) { return x.id !== editId; }); closeEv(); render(); });
    $('evForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var o = { title: $('e-title').value.trim(), cat: selCat.value, date: $('e-date').value, start: $('e-start').value, end: $('e-end').value };
      if (!o.title || !o.date) return;
      if (mins(o.end) <= mins(o.start)) { $('e-end').setCustomValidity('End time must be after start time'); $('e-end').reportValidity(); return; }
      if (editId) { events = events.map(function (x) { if (x.id === editId) { o.id = editId; return o; } return x; }); }
      else { o.id = nextId++; events.push(o); }
      var d = parse(o.date); sel = d; weekStart = monday(d); miniM = new Date(d.getFullYear(), d.getMonth(), 1);
      closeEv(); render();
    });

    render();
    $('gridScroll').scrollTop = (8 - START) * HH;
  })();

  /* ================= COLLEAGUES ================= */
  var editIndex = null;
  var peopleEl = $('people'), dlg = $('dlg'), form = $('colleagueForm');
  var ids = ['name','position','dept','start','email','phone','loc','notes'];

  function initials(n) { return n.trim().split(/\s+/).slice(0, 2).map(function (w) { return w[0]; }).join('').toUpperCase() || '?'; }
  function fmtDate(d) {
    if (!d) return '';
    var dt = new Date(d + 'T00:00:00');
    return isNaN(dt) ? d : dt.toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' });
  }
  function row(k, v, href) {
    if (!v) return null;
    var li = el('li');
    var kk = el('span', 'k'); kk.appendChild(ic(ICONS[k] || 'info')); kk.appendChild(el('span', 'sr', k)); li.appendChild(kk);
    var val = el('span', (k === 'Notes' || k === 'Schedule') ? 'notes' : '');
    if (href) { var a = el('a', '', v); a.href = href; val.appendChild(a); } else { val.textContent = v; }
    li.appendChild(val);
    return li;
  }

  /* work schedule editor (inside the colleague dialog) */
  var schedGrid = $('schedGrid'), schedRows = [];
  function syncRow(i) { var r = schedRows[i]; r.s.disabled = r.e.disabled = !r.cb.checked; r.s.required = r.e.required = r.cb.checked; }
  DAYS.forEach(function (d, i) {
    var lab = el('label', 'd'), cb = el('input'); cb.type = 'checkbox'; cb.setAttribute('aria-label', 'Works on ' + d);
    lab.append(cb, document.createTextNode(d));
    var s = el('input'); s.type = 'time'; s.value = '09:00'; s.setAttribute('aria-label', d + ' start');
    var e = el('input'); e.type = 'time'; e.value = '17:00'; e.setAttribute('aria-label', d + ' end');
    cb.addEventListener('change', function () { syncRow(i); });
    s.addEventListener('input', function () { e.setCustomValidity(''); });
    e.addEventListener('input', function () { e.setCustomValidity(''); });
    schedGrid.append(lab, s, e);
    schedRows.push({ cb: cb, s: s, e: e });
  });
  function fillSched(sc) {
    schedRows.forEach(function (r, i) {
      var d = sc && sc[i];
      r.cb.checked = !!(d && d.on); r.s.value = (d && d.start) || '09:00'; r.e.value = (d && d.end) || '17:00';
      r.e.setCustomValidity(''); syncRow(i);
    });
  }
  function readSched() { return schedRows.map(function (r) { return { on: r.cb.checked, start: r.s.value, end: r.e.value }; }); }
  $('schedPreset').addEventListener('click', function () {
    schedRows.forEach(function (r, i) { r.cb.checked = i < 5; r.s.value = '09:00'; r.e.value = '17:00'; r.e.setCustomValidity(''); syncRow(i); });
  });

  function renderPeople() {
    var q = $('search').value.trim().toLowerCase();
    peopleEl.innerHTML = '';
    var shownCount = 0;
    people.forEach(function (p, i) {
      var hay = (p.name + ' ' + p.position + ' ' + p.dept).toLowerCase();
      if (q && hay.indexOf(q) === -1) return;
      shownCount++;
      var card = el('div', 'cards');
      var head = el('div', 'card-head');
      head.appendChild(el('div', 'avatar', initials(p.name)));
      var t = el('div'); t.appendChild(el('h3', '', p.name)); t.appendChild(el('p', 'role', p.position));
      head.appendChild(t); card.appendChild(head);
      if (p.dept) card.appendChild(el('span', 'tag', p.dept));
      var summary = schedSummary(p.sched);
      if (summary.length) {
        var pills = el('div', 'sched-days'); pills.setAttribute('role', 'img'); pills.setAttribute('aria-label', 'Works ' + summary.join(', '));
        'MTWTFSS'.split('').forEach(function (l, k) { pills.appendChild(el('span', p.sched[k].on ? 'on' : '', l)); });
        card.appendChild(pills);
      }
      var ul = el('ul', 'details'); ul.hidden = true;
      [row('Schedule', summary.join('\n')),
       row('Email', p.email, p.email ? 'mailto:' + p.email : ''),
       row('Phone', p.phone, p.phone ? 'tel:' + p.phone.replace(/\s+/g, '') : ''),
       row('Location', p.loc), row('Started', fmtDate(p.start)), row('Notes', p.notes)
      ].forEach(function (r) { if (r) ul.appendChild(r); });
      if (!ul.children.length) ul.appendChild(el('li', '', 'No more details yet. Use Edit to add some.'));
      card.appendChild(ul);
      var act = el('div', 'actions');
      var info = btn('sm ghost', 'expand_more', 'Details'); info.setAttribute('aria-expanded', 'false');
      info.addEventListener('click', function () { ul.hidden = !ul.hidden; info.setAttribute('aria-expanded', String(!ul.hidden)); info.firstChild.textContent = ul.hidden ? 'expand_more' : 'expand_less'; });
      var edit = btn('sm', 'edit', 'Edit');
      edit.addEventListener('click', function () { openDialog(i); });
      var del = btn('sm ghost', 'person_remove', 'Remove');
      del.addEventListener('click', function () { delete shown[p.id]; people.splice(i, 1); renderPeople(); });
      act.append(info, edit, del); card.appendChild(act);
      peopleEl.appendChild(card);
    });
    if (!shownCount) { var em = el('div', 'empty'); em.appendChild(ic(people.length ? 'search_off' : 'group', 'lg')); em.appendChild(el('p', '', people.length ? 'No colleagues match your search.' : 'No colleagues yet. Click “Add colleague” to start.')); peopleEl.appendChild(em); }
    $('count').textContent = people.length + (people.length === 1 ? ' colleague' : ' colleagues');
    refreshCal();
  }

  function openDialog(i) {
    editIndex = (typeof i === 'number') ? i : null;
    var p = editIndex === null ? {} : people[editIndex];
    ids.forEach(function (k) { $('f-' + k).value = p[k] || ''; });
    fillSched(p.sched);
    $('dlgTitle').textContent = editIndex === null ? 'Add colleague' : 'Edit colleague';
    $('saveBtn').textContent = editIndex === null ? 'Add colleague' : 'Save changes';
    dlg.showModal(); $('f-name').focus();
  }
  function closeDialog() { dlg.close(); }
  $('openAdd').addEventListener('click', function () { openDialog(); });
  $('closeDlg').addEventListener('click', closeDialog);
  $('cancelDlg').addEventListener('click', closeDialog);
  dlg.addEventListener('click', function (e) { if (e.target === dlg) closeDialog(); });
  $('search').addEventListener('input', renderPeople);
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var p = {};
    ids.forEach(function (k) { p[k] = $('f-' + k).value.trim(); });
    if (!p.name || !p.position) return;
    for (var i = 0; i < 7; i++) {
      var r = schedRows[i];
      if (r.cb.checked && mins(r.e.value) <= mins(r.s.value)) {
        r.e.setCustomValidity('End time must be after start time'); r.e.reportValidity(); return;
      }
    }
    p.sched = readSched();
    if (editIndex === null) { p.id = 'p' + (pidSeq++); p.ci = ciSeq++; people.push(p); }
    else { p.id = people[editIndex].id; p.ci = people[editIndex].ci; people[editIndex] = p; }
    closeDialog(); renderPeople();
  });
  renderPeople();
  if (document.fonts && document.fonts.load) {
    document.fonts.load('24px "Material Symbols Rounded"', 'add').then(function () { document.documentElement.classList.add('icons'); });
  }

  /* ================= SIDE NAV ================= */
  (function () {
    var nav = $('sideNav'), toggle = $('navToggle');
    var links = nav.querySelectorAll('a');
    var small = window.matchMedia('(max-width:900px)');

    function setClosed(closed, save) {
      document.body.classList.toggle('nav-closed', closed);
      toggle.setAttribute('aria-expanded', String(!closed));
      toggle.setAttribute('aria-label', closed ? 'Expand navigation' : 'Collapse navigation');
      if (save) { try { localStorage.setItem('navClosed', closed ? '1' : '0'); } catch (e) {} }
    }

    var saved = null;
    try { saved = localStorage.getItem('navClosed'); } catch (e) {}
    setClosed(saved === null ? small.matches : saved === '1', false);

    toggle.addEventListener('click', function () {
      setClosed(!document.body.classList.contains('nav-closed'), true);
    });

    links.forEach(function (a) {
      a.addEventListener('click', function () {
        links.forEach(function (l) { l.classList.remove('active'); });
        a.classList.add('active');
        if (small.matches) setClosed(true, false); // auto-close on phones
      });
    });
  })();