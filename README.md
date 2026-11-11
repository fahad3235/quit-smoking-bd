# Quit Smoking BD

A free, fully offline bilingual (Bangla/English) quit-smoking tracker for Bangladesh. Set your quit date, watch your smoke-free time, cigarettes avoided and money saved tick up live, follow your body's recovery milestones, breathe through cravings with a 5-minute timer, and log every craving — all on your device, with no account and no network requests.

## Features

- **Live dashboard** — smoke-free time ticking every second, cigarettes not smoked, money saved (integer-paisa math), and a countdown to your next health milestone.
- **Health milestones** — 8 recovery milestones from the U.S. Surgeon General's 2004 report (CDC): 20 minutes (heart rate drops), 12 hours (carbon monoxide normal), 2 weeks–3 months (lung function improves), 1–9 months (less coughing), 1 year (heart-disease risk halved), 5 years (stroke risk falls), 10 years (lung-cancer death rate halved), 15 years (heart-disease risk back to a nonsmoker's). Reached milestones are marked; the next one shows a live countdown.
- **Craving tools** — 5-minute timer with a 4-7-8 breathing guide (inhale 4s, hold 7s, exhale 8s); log a craving with trigger (stress, after a meal, tea/coffee, friends, boredom, alcohol, other), intensity 1–5, and whether you beat it; today's summary (cravings, beaten, cigarettes smoked).
- **Slips, without judgement** — log a slip in one tap, and restart your quit date from now whenever you are ready. One slip does not erase your progress.
- **Reward goal** — set something nice to buy with the money you save and watch the progress bar fill.
- **Your data, yours** — everything in localStorage; JSON export (copy or download), strict JSON import, and typed-DELETE erase-all.
- **Bilingual** — EN/বাংলা toggle persisted across reloads, with Bengali digits in Bangla mode. Responsive down to 390px. Zero network requests.

## Stack

Plain HTML, CSS and JavaScript — no frameworks, no build step, no dependencies. Pure-ASCII sources (Bengali strings live in `tools/gen_i18n.py` and are emitted as `\uXXXX` escapes into `js/i18n.js`, so the GitHub push path can never corrupt them).

## Prerequisites

Any modern browser. Nothing to install.

## Run locally

Open `index.html` in a browser, or serve the folder:

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

## Regenerate the i18n bundle

Edit the `EN` / `BN` dicts in `tools/gen_i18n.py` (UTF-8), then:

```sh
python3 tools/gen_i18n.py   # rewrites js/i18n.js
```

## Testing

```sh
node tests/logic.test.js   # 73 pure-logic checks (no DOM)
node tests/smoke.js        # 62 headless-Chrome checks via raw CDP (file://)
```

Both suites exit non-zero on any failure. The smoke test also fails on any page console error and asserts zero non-`file://` network requests.

Verified hand-checked cases (2026-11-11): quit 10 days ago, 20 cigarettes/day, ৳300 pack, 20/pack → 200 cigarettes avoided, ৳3,000.00 saved, 2 of 8 milestones reached, next milestone (2 weeks to 3 months) in ~4 days; a ৳3,000 reward goal reads 100%.

## Limitations

- Money saved is an estimate from the numbers you enter (cigarettes per day, pack price, pack size). It assumes you would have kept smoking at the same rate.
- Health milestones are population averages from the CDC/Surgeon General's report; your own recovery depends on how long and how much you smoked.
- This app is a personal tracker, not medical advice. If quitting feels hard, talk to a doctor or your nearest health centre.
- Data lives in one browser's localStorage — export a backup before clearing browser data or switching devices.

## Status

Complete MVP. No known issues.
