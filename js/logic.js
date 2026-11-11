// quit-smoking-bd -- pure logic (no DOM). Node + browser compatible.
// Money is integer paisa everywhere (1 Tk = 100 paisa).
(function (root) {
  var D = (typeof require === 'function')
    ? require('./data.js')
    : { MILESTONES: MILESTONES, TRIGGERS: TRIGGERS, APP_ID: APP_ID,
        APP_VERSION: APP_VERSION, STORAGE_KEY: STORAGE_KEY,
        CRAVING_SECONDS: CRAVING_SECONDS, BREATH_PHASES: BREATH_PHASES };

  var BN_DIGITS = ['\u09e6', '\u09e7', '\u09e8', '\u09e9', '\u09ea',
    '\u09eb', '\u09ec', '\u09ed', '\u09ee', '\u09ef'];

  function toBnDigits(s) {
    return String(s).replace(/[0-9]/g, function (d) { return BN_DIGITS[+d]; });
  }

  // "1250" / "1250.50" / "1,250.5" -> paisa int; null when invalid.
  function parseAmount(str) {
    if (str === null || str === undefined) return null;
    var s = String(str).trim().replace(/,/g, '');
    if (s === '') return null;
    if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
    var parts = s.split('.');
    var paisa = parseInt(parts[0], 10) * 100;
    if (parts[1]) paisa += parseInt((parts[1] + '0').slice(0, 2), 10);
    return paisa;
  }

  function parseIntField(str, min, max) {
    if (str === null || str === undefined) return null;
    var s = String(str).trim();
    if (!/^\d+$/.test(s)) return null;
    var n = parseInt(s, 10);
    if (n < min || n > max) return null;
    return n;
  }

  // quitISO: "YYYY-MM-DDTHH:mm" (datetime-local value). nowMs for tests.
  function validateSetup(input, nowMs) {
    var errors = {};
    var now = (nowMs === undefined) ? Date.now() : nowMs;
    var values = {};
    if (!input.quitISO || String(input.quitISO).trim() === '') {
      errors.quit = 'required';
    } else {
      var ms = Date.parse(input.quitISO);
      if (isNaN(ms)) errors.quit = 'invalid';
      else if (ms > now) errors.quit = 'future';
      else if (now - ms > 50 * 365.25 * 24 * 3600 * 1000) errors.quit = 'tooOld';
      else values.quitMs = ms;
    }
    var cigsRaw = (input.cigsPerDay === null || input.cigsPerDay === undefined) ? '' : String(input.cigsPerDay).trim();
    if (cigsRaw === '') errors.cigs = 'required';
    else if (!/^\d+$/.test(cigsRaw)) errors.cigs = 'invalid';
    else if (+cigsRaw < 1) errors.cigs = 'min';
    else if (+cigsRaw > 100) errors.cigs = 'tooBig';
    else values.cigsPerDay = +cigsRaw;
    var price = parseAmount(input.packPrice);
    if (input.packPrice === '' || input.packPrice === null || input.packPrice === undefined) errors.packPrice = 'required';
    else if (price === null) errors.packPrice = 'invalid';
    else if (price === 0) errors.packPrice = 'min';
    else if (price > 10000000) errors.packPrice = 'tooBig';
    else values.packPricePaisa = price;
    var sizeRaw = (input.packSize === null || input.packSize === undefined) ? '' : String(input.packSize).trim();
    if (sizeRaw === '') errors.packSize = 'required';
    else if (!/^\d+$/.test(sizeRaw)) errors.packSize = 'invalid';
    else if (+sizeRaw < 1) errors.packSize = 'min';
    else if (+sizeRaw > 100) errors.packSize = 'tooBig';
    else values.packSize = +sizeRaw;
    return { ok: Object.keys(errors).length === 0, errors: errors, values: values };
  }

  function elapsedSeconds(quitMs, nowMs) {
    var diff = Math.floor(((nowMs === undefined ? Date.now() : nowMs) - quitMs) / 1000);
    return diff < 0 ? 0 : diff;
  }

  function breakdown(totalSeconds) {
    var d = Math.floor(totalSeconds / 86400);
    var h = Math.floor((totalSeconds % 86400) / 3600);
    var m = Math.floor((totalSeconds % 3600) / 60);
    var s = totalSeconds % 60;
    return { days: d, hours: h, mins: m, secs: s };
  }

  function cigsAvoided(elapsedSec, cigsPerDay) {
    return Math.floor(elapsedSec * cigsPerDay / 86400);
  }

  // Integer paisa: avoided cigarettes * price per cigarette, floored.
  function moneySavedPaisa(avoided, packPricePaisa, packSize) {
    return Math.floor(avoided * packPricePaisa / packSize);
  }

  function milestoneStatus(elapsedSec) {
    var elapsedHours = elapsedSec / 3600;
    var list = D.MILESTONES.map(function (ms) {
      return { id: ms.id, hours: ms.hours, reached: elapsedHours >= ms.hours };
    });
    var next = null;
    for (var i = 0; i < list.length; i++) {
      if (!list[i].reached) { next = list[i]; break; }
    }
    var secondsToNext = next ? Math.ceil(next.hours * 3600 - elapsedSec) : null;
    var reachedCount = list.filter(function (x) { return x.reached; }).length;
    return { list: list, next: next, secondsToNext: secondsToNext, reachedCount: reachedCount };
  }

  // Breathing phase for a given second (0-based) inside the craving timer.
  function breathPhase(second) {
    var cycle = 0;
    for (var i = 0; i < D.BREATH_PHASES.length; i++) cycle += D.BREATH_PHASES[i].seconds;
    var t = second % cycle;
    var acc = 0;
    for (var j = 0; j < D.BREATH_PHASES.length; j++) {
      var ph = D.BREATH_PHASES[j];
      if (t < acc + ph.seconds) {
        return { key: ph.key, phaseSecond: t - acc, phaseTotal: ph.seconds };
      }
      acc += ph.seconds;
    }
    return { key: 'breatheIn', phaseSecond: 0, phaseTotal: 4 };
  }

  function validateCraving(input) {
    var errors = {};
    if (D.TRIGGERS.indexOf(input.trigger) === -1) errors.trigger = 'invalid';
    var inten = parseIntField(input.intensity, 1, 5);
    if (inten === null) errors.intensity = 'invalid';
    if (input.beaten !== true && input.beaten !== false) errors.beaten = 'invalid';
    return { ok: Object.keys(errors).length === 0, errors: errors,
      values: { trigger: input.trigger, intensity: inten, beaten: input.beaten } };
  }

  function validateGoal(input) {
    var errors = {};
    var name = (input.name === null || input.name === undefined) ? '' : String(input.name).trim();
    if (name === '') errors.name = 'name';
    else if (name.length > 60) errors.name = 'tooBig';
    var target = parseAmount(input.target);
    if (target === null) errors.target = 'invalid';
    else if (target === 0) errors.target = 'target';
    else if (target > 100000000) errors.target = 'tooBig';
    return { ok: Object.keys(errors).length === 0, errors: errors,
      values: { name: name, targetPaisa: target } };
  }

  function emptyState() {
    return { setup: null, cravings: [], slips: [], goal: null, lang: 'en' };
  }

  function exportPayload(state) {
    return JSON.stringify({ app: D.APP_ID, version: D.APP_VERSION,
      setup: state.setup, cravings: state.cravings, slips: state.slips,
      goal: state.goal, lang: state.lang }, null, 2);
  }

  function validateImport(text) {
    var data;
    try { data = JSON.parse(text); } catch (e) { return { ok: false, error: 'notJson' }; }
    if (!data || data.app !== D.APP_ID || data.version !== D.APP_VERSION) {
      return { ok: false, error: 'wrongApp' };
    }
    if (!Array.isArray(data.cravings) || !Array.isArray(data.slips)) {
      return { ok: false, error: 'shape' };
    }
    if (data.setup !== null) {
      if (typeof data.setup !== 'object' || typeof data.setup.quitMs !== 'number' ||
          typeof data.setup.cigsPerDay !== 'number' ||
          typeof data.setup.packPricePaisa !== 'number' ||
          typeof data.setup.packSize !== 'number') {
        return { ok: false, error: 'shape' };
      }
    }
    if (data.goal !== null) {
      if (typeof data.goal !== 'object' || typeof data.goal.name !== 'string' ||
          typeof data.goal.targetPaisa !== 'number') {
        return { ok: false, error: 'shape' };
      }
    }
    for (var i = 0; i < data.cravings.length; i++) {
      var c = data.cravings[i];
      if (typeof c !== 'object' || typeof c.ts !== 'number' ||
          D.TRIGGERS.indexOf(c.trigger) === -1 ||
          typeof c.intensity !== 'number' || c.intensity < 1 || c.intensity > 5 ||
          typeof c.beaten !== 'boolean') {
        return { ok: false, error: 'shape' };
      }
    }
    for (var j = 0; j < data.slips.length; j++) {
      var s = data.slips[j];
      if (typeof s !== 'object' || typeof s.ts !== 'number' ||
          typeof s.count !== 'number' || s.count < 1) {
        return { ok: false, error: 'shape' };
      }
    }
    if (data.lang !== 'en' && data.lang !== 'bn') data.lang = 'en';
    return { ok: true, data: { setup: data.setup, cravings: data.cravings,
      slips: data.slips, goal: data.goal, lang: data.lang } };
  }

  function todayStats(state, nowMs) {
    var now = new Date(nowMs === undefined ? Date.now() : nowMs);
    var start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    var end = start + 86400000;
    var cravings = 0, beaten = 0, smoked = 0;
    state.cravings.forEach(function (c) {
      if (c.ts >= start && c.ts < end) { cravings++; if (c.beaten) beaten++; else smoked++; }
    });
    state.slips.forEach(function (s) {
      if (s.ts >= start && s.ts < end) smoked += s.count;
    });
    return { cravings: cravings, beaten: beaten, smoked: smoked };
  }

  function fmtMoney(paisa, lang) {
    var neg = paisa < 0;
    var abs = Math.abs(paisa);
    var whole = Math.floor(abs / 100);
    var frac = abs % 100;
    var s = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '.' +
      (frac < 10 ? '0' : '') + frac;
    if (lang === 'bn') s = toBnDigits(s);
    return (neg ? '-' : '') + s;
  }

  function fmtInt(n, lang) {
    var s = String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return lang === 'bn' ? toBnDigits(s) : s;
  }

  var api = { parseAmount: parseAmount, parseIntField: parseIntField,
    validateSetup: validateSetup, elapsedSeconds: elapsedSeconds,
    breakdown: breakdown, cigsAvoided: cigsAvoided,
    moneySavedPaisa: moneySavedPaisa, milestoneStatus: milestoneStatus,
    breathPhase: breathPhase, validateCraving: validateCraving,
    validateGoal: validateGoal, emptyState: emptyState,
    exportPayload: exportPayload, validateImport: validateImport,
    todayStats: todayStats, fmtMoney: fmtMoney, fmtInt: fmtInt,
    toBnDigits: toBnDigits, MILESTONES: D.MILESTONES, TRIGGERS: D.TRIGGERS,
    CRAVING_SECONDS: D.CRAVING_SECONDS, BREATH_PHASES: D.BREATH_PHASES };
  if (typeof module !== 'undefined') module.exports = api;
  else root.QSBLogic = api;
})(typeof window !== 'undefined' ? window : globalThis);
