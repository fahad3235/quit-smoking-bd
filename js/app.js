// quit-smoking-bd -- browser app (pure ASCII; Bengali via js/i18n.js).
(function () {
  var L = window.QSBLogic;
  var KEY = 'quit-smoking-bd-v1';
  var state = load();

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return L.emptyState();
      var parsed = JSON.parse(raw);
      // Stored state has no app/version envelope; wrap it for the same
      // strict validation the import path uses.
      var v = L.validateImport(JSON.stringify({ app: 'quit-smoking-bd', version: 1,
        setup: parsed.setup, cravings: parsed.cravings, slips: parsed.slips,
        goal: parsed.goal, lang: parsed.lang }));
      if (v.ok) return v.data;
      return L.emptyState();
    } catch (e) { return L.emptyState(); }
  }
  function save() { localStorage.setItem(KEY, JSON.stringify(state)); }

  function t(key) { return I18N[state.lang][key] || I18N.en[key] || key; }
  function $(id) { return document.getElementById(id); }

  // ---------- language ----------
  function applyLang() {
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      el.textContent = t(el.getAttribute('data-i18n'));
    });
    document.querySelectorAll('[data-i18n-ph]').forEach(function (el) {
      el.setAttribute('placeholder', t(el.getAttribute('data-i18n-ph')));
    });
    document.documentElement.lang = state.lang === 'bn' ? 'bn' : 'en';
    $('langBtn').textContent = state.lang === 'bn' ? 'English' : '\u09ac\u09be\u0982\u09b2\u09be';
    renderAll();
  }

  // ---------- tabs ----------
  function showTab(name) {
    document.querySelectorAll('[data-tab]').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-tab') === name);
    });
    document.querySelectorAll('.tabpage').forEach(function (p) {
      p.hidden = p.id !== 'tab-' + name;
    });
  }

  // ---------- errors ----------
  function showErr(id, key) {
    var el = $(id);
    if (!key) { el.hidden = true; el.textContent = ''; return; }
    el.hidden = false; el.textContent = t('err_' + key);
  }

  // ---------- dashboard ----------
  function renderSetup() {
    if (state.setup) {
      var d = new Date(state.setup.quitMs);
      var pad = function (n) { return (n < 10 ? '0' : '') + n; };
      $('quitInput').value = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
        'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
      $('cigsInput').value = String(state.setup.cigsPerDay);
      $('packPriceInput').value = (state.setup.packPricePaisa / 100).toFixed(2).replace(/\.00$/, '');
      $('packSizeInput').value = String(state.setup.packSize);
    }
  }

  function renderStats() {
    var has = !!state.setup;
    $('statsEmpty').hidden = has;
    $('statsContent').hidden = !has;
    if (!has) return;
    var el = L.elapsedSeconds(state.setup.quitMs);
    var bd = L.breakdown(el);
    $('statTime').textContent = L.fmtInt(bd.days, state.lang) + ' ' + t('days') + ' ' +
      L.fmtInt(bd.hours, state.lang) + ' ' + t('hours') + ' ' +
      L.fmtInt(bd.mins, state.lang) + ' ' + t('mins') + ' ' +
      L.fmtInt(bd.secs, state.lang) + ' ' + t('secs');
    var avoided = L.cigsAvoided(el, state.setup.cigsPerDay);
    $('statCigs').textContent = L.fmtInt(avoided, state.lang) + ' ' + t('cigsUnit');
    var saved = L.moneySavedPaisa(avoided, state.setup.packPricePaisa, state.setup.packSize);
    $('statMoney').textContent = '\u09f3' + L.fmtMoney(saved, state.lang);
    var ms = L.milestoneStatus(el);
    if (ms.next) {
      var nb = L.breakdown(ms.secondsToNext);
      var parts = [];
      if (nb.days > 0) parts.push(L.fmtInt(nb.days, state.lang) + ' ' + t('days'));
      if (nb.hours > 0) parts.push(L.fmtInt(nb.hours, state.lang) + ' ' + t('hours'));
      if (nb.days === 0 && nb.mins > 0) parts.push(L.fmtInt(nb.mins, state.lang) + ' ' + t('mins'));
      if (parts.length === 0) parts.push(L.fmtInt(nb.secs, state.lang) + ' ' + t('secs'));
      $('statNext').textContent = t(ms.next.id + 't') + ' - ' + t('inPrefix') + ' ' + parts.join(' ');
    } else {
      $('statNext').textContent = t('nextNone');
    }
    renderGoal(saved);
  }

  function renderGoal(savedPaisa) {
    var has = !!state.goal;
    $('goalEmpty').hidden = has;
    $('goalContent').hidden = !has;
    if (!has) return;
    var saved = (savedPaisa === undefined)
      ? (state.setup ? L.moneySavedPaisa(L.cigsAvoided(L.elapsedSeconds(state.setup.quitMs), state.setup.cigsPerDay), state.setup.packPricePaisa, state.setup.packSize) : 0)
      : savedPaisa;
    $('goalName').textContent = state.goal.name;
    var pct = Math.min(100, Math.floor(saved * 100 / state.goal.targetPaisa));
    $('goalBar').style.width = pct + '%';
    $('goalText').textContent = '\u09f3' + L.fmtMoney(saved, state.lang) + ' ' + t('goalOf') +
      ' \u09f3' + L.fmtMoney(state.goal.targetPaisa, state.lang) + ' (' + L.fmtInt(pct, state.lang) + '%)';
    $('goalReachedMsg').hidden = saved < state.goal.targetPaisa;
  }

  // ---------- health ----------
  function renderMilestones() {
    var list = $('milestoneList');
    list.innerHTML = '';
    var el = state.setup ? L.elapsedSeconds(state.setup.quitMs) : 0;
    var ms = L.milestoneStatus(el);
    ms.list.forEach(function (m) {
      var li = document.createElement('li');
      li.className = 'milestone' + (m.reached ? ' reached' : '');
      var badge = document.createElement('span');
      badge.className = 'ms-badge';
      badge.textContent = m.reached ? '\u2713 ' + t('reached') : t('inPrefix') + ' ' + fmtHours(m.hours);
      var title = document.createElement('strong');
      title.textContent = t(m.id + 't');
      var desc = document.createElement('p');
      desc.textContent = t(m.id + 'd');
      li.appendChild(badge); li.appendChild(title); li.appendChild(desc);
      list.appendChild(li);
    });
  }
  function fmtHours(h) {
    if (h < 1) return L.fmtInt(20, state.lang) + ' ' + t('mins');
    if (h < 24) return L.fmtInt(h, state.lang) + ' ' + t('hours');
    if (h < 720) return L.fmtInt(Math.round(h / 24), state.lang) + ' ' + t('days');
    if (h < 8760) return L.fmtInt(Math.round(h / 720), state.lang) + ' ' + (state.lang === 'bn' ? '\u09ae\u09be\u09b8' : 'months');
    return L.fmtInt(Math.round(h / 8760), state.lang) + ' ' + (state.lang === 'bn' ? '\u09ac\u099b\u09b0' : 'years');
  }

  // ---------- cravings ----------
  var timer = { running: false, remaining: L.CRAVING_SECONDS, interval: null };
  function renderTimer() {
    var m = Math.floor(timer.remaining / 60);
    var s = timer.remaining % 60;
    $('timerDisplay').textContent = (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
    var elapsed = L.CRAVING_SECONDS - timer.remaining;
    var ph = L.breathPhase(elapsed);
    $('timerPhase').textContent = timer.running ? t(ph.key) : '';
    $('timerBar').style.width = Math.floor(elapsed * 100 / L.CRAVING_SECONDS) + '%';
    $('startTimerBtn').hidden = timer.running;
    $('stopTimerBtn').hidden = !timer.running;
  }
  function startTimer() {
    timer.running = true;
    timer.remaining = L.CRAVING_SECONDS;
    $('timerDone').hidden = true;
    renderTimer();
    timer.interval = setInterval(function () {
      timer.remaining--;
      if (timer.remaining <= 0) {
        clearInterval(timer.interval);
        timer.running = false;
        $('timerDone').hidden = false;
        renderTimer();
        return;
      }
      renderTimer();
    }, 1000);
  }
  function stopTimer() {
    clearInterval(timer.interval);
    timer.running = false;
    timer.remaining = L.CRAVING_SECONDS;
    $('timerDone').hidden = true;
    renderTimer();
  }

  function renderToday() {
    var ts = L.todayStats(state);
    $('todayCravings').textContent = L.fmtInt(ts.cravings, state.lang);
    $('todayBeaten').textContent = L.fmtInt(ts.beaten, state.lang);
    $('todaySmoked').textContent = L.fmtInt(ts.smoked, state.lang);
  }

  function renderLog() {
    var list = $('logList');
    list.innerHTML = '';
    $('logEmpty').hidden = state.cravings.length > 0;
    var items = state.cravings.slice(-30).reverse();
    items.forEach(function (c) {
      var li = document.createElement('li');
      var d = new Date(c.ts);
      var pad = function (n) { return (n < 10 ? '0' : '') + n; };
      li.textContent = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' +
        pad(d.getHours()) + ':' + pad(d.getMinutes()) + ' - ' + t('trigger_' + c.trigger) +
        ' (' + L.fmtInt(c.intensity, state.lang) + '/5) - ' + (c.beaten ? t('logBeaten') : t('logSmoked'));
      list.appendChild(li);
    });
  }

  // ---------- data ----------
  function renderExport() { $('exportText').value = L.exportPayload(state); }

  function renderAll() {
    renderSetup();
    renderStats();
    renderGoal();
    renderMilestones();
    renderToday();
    renderLog();
    renderExport();
  }

  // ---------- events ----------
  document.querySelectorAll('[data-tab]').forEach(function (b) {
    b.addEventListener('click', function () { showTab(b.getAttribute('data-tab')); });
  });
  $('langBtn').addEventListener('click', function () {
    state.lang = state.lang === 'bn' ? 'en' : 'bn';
    save(); applyLang();
  });

  $('saveSetupBtn').addEventListener('click', function () {
    var v = L.validateSetup({
      quitISO: $('quitInput').value,
      cigsPerDay: $('cigsInput').value,
      packPrice: $('packPriceInput').value,
      packSize: $('packSizeInput').value
    });
    showErr('quitError', v.errors.quit);
    showErr('cigsError', v.errors.cigs);
    showErr('packPriceError', v.errors.packPrice);
    showErr('packSizeError', v.errors.packSize);
    if (!v.ok) { $('setupMsg').hidden = true; return; }
    state.setup = { quitMs: v.values.quitMs, cigsPerDay: v.values.cigsPerDay,
      packPricePaisa: v.values.packPricePaisa, packSize: v.values.packSize };
    save();
    $('setupMsg').hidden = false;
    renderAll();
  });

  $('goalSaveBtn').addEventListener('click', function () {
    var v = L.validateGoal({ name: $('goalNameInput').value, target: $('goalTargetInput').value });
    showErr('goalNameError', v.errors.name);
    showErr('goalTargetError', v.errors.target);
    if (!v.ok) { $('goalMsg').hidden = true; return; }
    state.goal = { name: v.values.name, targetPaisa: v.values.targetPaisa };
    save();
    $('goalMsg').hidden = false;
    renderAll();
  });

  $('startTimerBtn').addEventListener('click', startTimer);
  $('stopTimerBtn').addEventListener('click', stopTimer);

  $('logBtn').addEventListener('click', function () {
    var beaten = document.querySelector('input[name="beaten"]:checked');
    var v = L.validateCraving({
      trigger: $('triggerSelect').value,
      intensity: $('intensityInput').value,
      beaten: beaten ? beaten.value === 'yes' : null
    });
    showErr('triggerError', v.errors.trigger);
    showErr('intensityError', v.errors.intensity);
    showErr('beatenError', v.errors.beaten);
    if (!v.ok) { $('logMsg').hidden = true; return; }
    state.cravings.push({ ts: Date.now(), trigger: v.values.trigger,
      intensity: v.values.intensity, beaten: v.values.beaten });
    save();
    $('logMsg').hidden = false;
    renderToday(); renderLog(); renderExport();
  });

  $('slipBtn').addEventListener('click', function () {
    state.slips.push({ ts: Date.now(), count: 1 });
    save();
    $('slipMsg').hidden = false;
    renderToday(); renderExport();
  });

  $('restartBtn').addEventListener('click', function () {
    if (!state.setup) return;
    state.setup.quitMs = Date.now();
    save();
    $('restartMsg').hidden = false;
    renderAll();
  });

  $('copyBtn').addEventListener('click', function () {
    var ta = $('exportText');
    ta.select();
    try { document.execCommand('copy'); } catch (e) { /* clipboard may be blocked */ }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(ta.value).catch(function () {});
    }
    $('copiedMsg').hidden = false;
  });

  $('downloadBtn').addEventListener('click', function () {
    var blob = new Blob([L.exportPayload(state)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'quit-smoking-bd-backup.json';
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  });

  $('importBtn').addEventListener('click', function () {
    var v = L.validateImport($('importText').value);
    $('importOk').hidden = true; $('importFail').hidden = true;
    if (!v.ok) { $('importFail').hidden = false; return; }
    state = v.data;
    save();
    $('importOk').hidden = false;
    applyLang();
  });

  $('eraseBtn').addEventListener('click', function () {
    $('eraseWrong').hidden = true; $('erasedMsg').hidden = true;
    if ($('eraseInput').value !== 'DELETE') { $('eraseWrong').hidden = false; return; }
    state = L.emptyState();
    save();
    $('eraseInput').value = '';
    $('erasedMsg').hidden = false;
    stopTimer();
    applyLang();
  });

  // ---------- init ----------
  // Trigger select options (labels are i18n).
  var trig = $('triggerSelect');
  L.TRIGGERS.forEach(function (key) {
    var opt = document.createElement('option');
    opt.value = key; opt.setAttribute('data-i18n', 'trigger_' + key);
    trig.appendChild(opt);
  });
  // Default quit time = now (only shown when no setup yet).
  if (!state.setup) {
    var now = new Date();
    var pad = function (n) { return (n < 10 ? '0' : '') + n; };
    $('quitInput').value = now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate()) +
      'T' + pad(now.getHours()) + ':' + pad(now.getMinutes());
    $('cigsInput').value = '10';
    $('packPriceInput').value = '300';
    $('packSizeInput').value = '20';
  }
  applyLang();
  showTab('dash');
  renderTimer();
  setInterval(function () { if (state.setup) renderStats(); }, 1000);

  window.__qsb = {
    state: state,
    exportPayload: function () { return L.exportPayload(state); },
    importPayload: function (text) { var v = L.validateImport(text); if (v.ok) { state = v.data; save(); applyLang(); } return v; },
    eraseAll: function () { state = L.emptyState(); save(); applyLang(); }
  };
})();
