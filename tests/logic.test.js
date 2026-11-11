// quit-smoking-bd -- node unit tests for js/logic.js (no DOM needed).
// Usage: node tests/logic.test.js   (exit 0 = all green)
const L = require('../js/logic.js');
let count = 0, failures = 0;
function check(name, cond, extra) {
  count++;
  console.log((cond ? 'ok - ' : 'FAIL - ') + name + (cond ? '' : ' :: ' + (extra || '')));
  if (!cond) failures++;
}
const NOW = Date.parse('2026-11-11T18:00:00+06:00');
const TEN_DAYS_AGO = NOW - 10 * 86400 * 1000;
const TEN_DAYS_ISO = new Date(TEN_DAYS_AGO).toISOString().slice(0, 16);

// ---- parseAmount ----
check('parse 300 -> 30000 paisa', L.parseAmount('300') === 30000);
check('parse 300.50 -> 30050', L.parseAmount('300.50') === 30050);
check('parse 1,250.5 strips commas', L.parseAmount('1,250.5') === 125050);
check('parse 0.05 -> 5', L.parseAmount('0.05') === 5);
check('reject empty', L.parseAmount('') === null);
check('reject abc', L.parseAmount('abc') === null);
check('reject 12.345 (3 decimals)', L.parseAmount('12.345') === null);
check('reject -5', L.parseAmount('-5') === null);

// ---- validateSetup ----
function validSetup() { return { quitISO: TEN_DAYS_ISO, cigsPerDay: '20', packPrice: '300', packSize: '20' }; }
let v = L.validateSetup(validSetup(), NOW);
check('valid setup ok', v.ok, JSON.stringify(v.errors));
check('valid setup quitMs', v.values.quitMs === Date.parse(TEN_DAYS_ISO));
check('valid setup cigs 20', v.values.cigsPerDay === 20);
check('valid setup price 30000 paisa', v.values.packPricePaisa === 30000);
check('valid setup size 20', v.values.packSize === 20);
check('future quit rejected', L.validateSetup(Object.assign(validSetup(), { quitISO: '2026-11-12T18:00' }), NOW).errors.quit === 'future');
check('empty quit required', L.validateSetup(Object.assign(validSetup(), { quitISO: '' }), NOW).errors.quit === 'required');
check('cigs 0 min', L.validateSetup(Object.assign(validSetup(), { cigsPerDay: '0' }), NOW).errors.cigs === 'min');
check('cigs 101 tooBig', L.validateSetup(Object.assign(validSetup(), { cigsPerDay: '101' }), NOW).errors.cigs === 'tooBig');
check('cigs abc invalid', L.validateSetup(Object.assign(validSetup(), { cigsPerDay: 'abc' }), NOW).errors.cigs === 'invalid');
check('price 0 min', L.validateSetup(Object.assign(validSetup(), { packPrice: '0' }), NOW).errors.packPrice === 'min');
check('price abc invalid', L.validateSetup(Object.assign(validSetup(), { packPrice: 'abc' }), NOW).errors.packPrice === 'invalid');
check('pack size 0 min', L.validateSetup(Object.assign(validSetup(), { packSize: '0' }), NOW).errors.packSize === 'min');

// ---- elapsed / breakdown ----
check('10 days elapsed = 864000s', L.elapsedSeconds(TEN_DAYS_AGO, NOW) === 864000);
check('breakdown 90061 = 1d 1h 1m 1s', JSON.stringify(L.breakdown(90061)) === JSON.stringify({ days: 1, hours: 1, mins: 1, secs: 1 }));
check('breakdown 0 = all zero', JSON.stringify(L.breakdown(0)) === JSON.stringify({ days: 0, hours: 0, mins: 0, secs: 0 }));

// ---- savings math: 10 days x 20/day = 200 cigs; 200 x 300 Tk / 20 = 3000 Tk ----
check('10 days x 20/day = 200 avoided', L.cigsAvoided(864000, 20) === 200);
check('1 day x 10/day = 10 avoided', L.cigsAvoided(86400, 10) === 10);
check('half day x 20/day = 10 avoided', L.cigsAvoided(43200, 20) === 10);
check('money saved 200 cigs = 300000 paisa', L.moneySavedPaisa(200, 30000, 20) === 300000);
check('money saved 0 cigs = 0', L.moneySavedPaisa(0, 30000, 20) === 0);
check('money saved pack size 10', L.moneySavedPaisa(10, 30000, 10) === 30000);

// ---- milestones (CDC 2004 poster) ----
let ms = L.milestoneStatus(864000); // 10 days = 240h
check('10 days: 2 reached', ms.reachedCount === 2, 'got ' + ms.reachedCount);
check('10 days: next is m3 (2 weeks)', ms.next.id === 'm3', 'got ' + (ms.next && ms.next.id));
check('10 days: 96h to m3 = 345600s', ms.secondsToNext === 345600, 'got ' + ms.secondsToNext);
check('20 min: m1 reached', L.milestoneStatus(1200).reachedCount === 1);
check('19 min: none reached', L.milestoneStatus(1140).reachedCount === 0);
check('12h: m2 reached', L.milestoneStatus(43200).reachedCount === 2);
check('15 years: all 8 reached', L.milestoneStatus(131400 * 3600).reachedCount === 8);
check('15 years: no next milestone', L.milestoneStatus(131400 * 3600).next === null);
check('15 years: secondsToNext null', L.milestoneStatus(131400 * 3600).secondsToNext === null);
check('1 year: 5 reached', L.milestoneStatus(8760 * 3600).reachedCount === 5);

// ---- breathing phases (4-7-8, 19s cycle) ----
check('breath second 0 = inhale', L.breathPhase(0).key === 'breatheIn');
check('breath second 3 = inhale', L.breathPhase(3).key === 'breatheIn');
check('breath second 4 = hold', L.breathPhase(4).key === 'breatheHold');
check('breath second 10 = hold', L.breathPhase(10).key === 'breatheHold');
check('breath second 11 = exhale', L.breathPhase(11).key === 'breatheOut');
check('breath second 18 = exhale', L.breathPhase(18).key === 'breatheOut');
check('breath second 19 = inhale again', L.breathPhase(19).key === 'breatheIn');

// ---- craving validation ----
check('valid craving ok', L.validateCraving({ trigger: 'stress', intensity: '4', beaten: true }).ok);
check('bad trigger invalid', L.validateCraving({ trigger: 'nope', intensity: '4', beaten: true }).errors.trigger === 'invalid');
check('intensity 6 invalid', L.validateCraving({ trigger: 'stress', intensity: '6', beaten: true }).errors.intensity === 'invalid');
check('intensity 0 invalid', L.validateCraving({ trigger: 'stress', intensity: '0', beaten: true }).errors.intensity === 'invalid');
check('beaten null invalid', L.validateCraving({ trigger: 'stress', intensity: '3', beaten: null }).errors.beaten === 'invalid');

// ---- goal validation ----
check('valid goal ok', L.validateGoal({ name: 'New phone', target: '3000' }).ok);
check('empty goal name', L.validateGoal({ name: '  ', target: '3000' }).errors.name === 'name');
check('goal target 0', L.validateGoal({ name: 'Phone', target: '0' }).errors.target === 'target');
check('goal target abc', L.validateGoal({ name: 'Phone', target: 'abc' }).errors.target === 'invalid');

// ---- export / import ----
let st = L.emptyState();
st.setup = { quitMs: TEN_DAYS_AGO, cigsPerDay: 20, packPricePaisa: 30000, packSize: 20 };
st.cravings = [{ ts: NOW - 3600000, trigger: 'stress', intensity: 4, beaten: true }];
st.slips = [{ ts: NOW - 7200000, count: 1 }];
st.goal = { name: 'New phone', targetPaisa: 300000 };
st.lang = 'bn';
let payload = L.exportPayload(st);
check('export carries app id', payload.includes('"app": "quit-smoking-bd"'));
check('export carries goal name', payload.includes('New phone'));
let imp = L.validateImport(payload);
check('import own payload ok', imp.ok, imp.error || '');
check('import restores setup', imp.data.setup.cigsPerDay === 20);
check('import restores lang bn', imp.data.lang === 'bn');
check('import wrong app rejected', !L.validateImport('{"app":"tip-calculator-bd","version":1,"cravings":[],"slips":[]}').ok);
check('import bad json rejected', !L.validateImport('{not json').ok);
check('import bad craving shape rejected', !L.validateImport(JSON.stringify({ app: 'quit-smoking-bd', version: 1, setup: null, cravings: [{ ts: 1, trigger: 'nope', intensity: 3, beaten: true }], slips: [], goal: null, lang: 'en' })).ok);
check('import bad version rejected', !L.validateImport(JSON.stringify({ app: 'quit-smoking-bd', version: 2, setup: null, cravings: [], slips: [], goal: null, lang: 'en' })).ok);

// ---- today stats ----
let st2 = L.emptyState();
st2.cravings = [
  { ts: NOW - 3600000, trigger: 'stress', intensity: 4, beaten: true },
  { ts: NOW - 7200000, trigger: 'boredom', intensity: 2, beaten: false },
  { ts: NOW - 3 * 86400000, trigger: 'stress', intensity: 5, beaten: true },
];
st2.slips = [{ ts: NOW - 1800000, count: 2 }];
let ts = L.todayStats(st2, NOW);
check('today: 2 cravings', ts.cravings === 2, 'got ' + ts.cravings);
check('today: 1 beaten', ts.beaten === 1);
check('today: 3 smoked (1 lost craving + 2 slip)', ts.smoked === 3, 'got ' + ts.smoked);

// ---- formatting ----
check('fmtMoney 300000 -> 3,000.00', L.fmtMoney(300000, 'en') === '3,000.00');
check('fmtMoney 50 -> 0.50', L.fmtMoney(50, 'en') === '0.50');
check('fmtMoney bn digits', L.fmtMoney(300000, 'bn') === '\u09e9,\u09e6\u09e6\u09e6.\u09e6\u09e6');
check('fmtInt bn 200', L.fmtInt(200, 'bn') === '\u09e8\u09e6\u09e6');
check('fmtInt en 1234', L.fmtInt(1234, 'en') === '1,234');

console.log('\n' + count + ' checks, ' + failures + ' failed');
process.exit(failures ? 1 : 0);
