# TEST RESULTS — quit-smoking-bd (run #310, 2026-11-11 18:00 slot)

## Unit tests — `node tests/logic.test.js`
**73 checks, 0 failed** (2026-11-11 ~18:25 +06, re-run after fixes).

Covered: parseAmount (incl. comma stripping, 3-decimal / negative rejection),
validateSetup (valid, future, empty, cigs 0/101/abc, price 0/abc, pack size 0),
elapsedSeconds + breakdown, savings math (10 days x 20/day = 200 cigs;
200 x 300 Tk / 20 = 3000 Tk = 300000 paisa), milestone thresholds at 19 min /
20 min / 12 h / 10 days (2 reached, next m3, 345600s to go) / 1 yr (5) /
15 yr (8, no next), 4-7-8 breathing phases incl. cycle wrap at 19s, craving
and goal validation, export/import round-trip + wrong-app / bad-JSON /
bad-shape / bad-version rejection, todayStats (2 cravings, 1 beaten, 3 smoked),
fmtMoney / fmtInt incl. Bengali digits.

Repairs during testing (2, both real):
1. `validateSetup` mapped cigarettes-per-day 0 to 'tooBig' instead of 'min'
   (test caught it; fixed the range-reason logic for cigs + pack size).
2. `load()` in js/app.js validated the raw localStorage object with
   `validateImport`, which requires an app/version envelope the stored state
   never has — so language (and everything) silently reset on reload. Fixed
   by wrapping the stored state in the envelope before validation. The smoke
   test's BN-persistence check caught it.

## Smoke tests — `node tests/smoke.js` (headless_shell-1187, raw CDP, file://)
**62 checks, 0 failed** (2026-11-11 ~18:27 +06, final re-run).

Covered: defaults (cigs 10, price 300, size 20, stats empty, 8 milestones,
7 triggers, timer 05:00); save quit plan 10 days ago / 20 per day / 300 Tk /
20 per pack -> "10 days", "200" cigarettes, "3,000.00" saved, next milestone
"2 weeks to 3 months" in ~4 days; health tab 2 reached; future-date error
then cleared; craving timer counts down (05:00 -> 04:5x) and resets on stop;
log craving (Stress, 4/5, beaten) -> 1 entry, today 1/1; slip -> today smoked
1; goal "New phone" 3000 Tk -> 100% + reached message; export/import
round-trip via `window.__qsb` hooks + wrong-app rejection + bad UI import
error + good UI import; typed-DELETE erase (wrong word rejected, data kept;
DELETE erases); BN toggle (title, money digits, tab label), persistence
across reload, back to EN; footer disclaimer; 390px no horizontal overflow
on all 4 tabs; zero non-file:// network requests; no console/page errors.

One smoke-test expectation was corrected (not an app bug): the "in about
4 days" check now accepts 3 or 4 days, because the minute-precision
datetime-local value truncates up to 59 seconds off the 10-day span.

## Hand-verified
- 10 days x 20/day, 300 Tk pack, 20/pack -> 200 cigarettes, 3000.00 Tk saved,
  2/8 milestones, next in ~4 days (matches unit math exactly).
- Health milestone wording checked against the CDC 2004 Surgeon General's
  report poster ("Within 20 Minutes of Quitting", stacks.cdc.gov) via web
  search on 2026-11-11.
