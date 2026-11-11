// quit-smoking-bd -- headless-Chrome smoke test via raw CDP (no puppeteer).
// Usage: node tests/smoke.js
// Exits non-zero on any failed assertion; fails on page console errors.
const { spawn } = require('child_process');
const http = require('http');
const path = require('path');

const PORT = 9360;
const BASE = 'file://' + path.resolve(__dirname, '..', 'index.html');
let failures = 0;
let count = 0;
const pageErrors = [];
function check(name, cond, extra) {
  count++;
  console.log((cond ? 'ok - ' : 'FAIL - ') + name + (cond ? '' : ' :: ' + (extra || '')));
  if (!cond) failures++;
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const CHROME_BIN = process.env.CHROME_BIN ||
    require('os').homedir() + '/.cache/ms-playwright/chromium_headless_shell-1187/chrome-linux/headless_shell';
  const chrome = spawn(CHROME_BIN, [
    '--headless=new', '--no-sandbox', '--disable-gpu',
    '--remote-debugging-port=' + PORT, '--user-data-dir=/tmp/qsb-smoke-' + process.pid,
    'about:blank',
  ], { stdio: 'ignore' });
  let targets = [];
  for (let i = 0; i < 50 && targets.length === 0; i++) {
    await wait(200);
    try {
      targets = JSON.parse(await new Promise((res, rej) => {
        http.get('http://127.0.0.1:' + PORT + '/json/list', (r) => {
          let d = ''; r.on('data', (c) => (d += c)); r.on('end', () => res(d));
        }).on('error', rej);
      }));
    } catch (e) { /* retry */ }
  }
  if (!targets.length) { console.log('FAIL - chrome did not start'); process.exit(2); }
  const wsUrl = targets[0].webSocketDebuggerUrl;
  const ws = new WebSocket(wsUrl);
  await new Promise((res) => { ws.onopen = res; });
  let seq = 0; const pending = new Map();
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
    if (msg.method === 'Runtime.exceptionThrown') {
      pageErrors.push('exception: ' + JSON.stringify(msg.params.exceptionDetails).slice(0, 300));
    }
    if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
      pageErrors.push('console.error: ' + JSON.stringify(msg.params.args).slice(0, 300));
    }
  };
  function send(method, params) {
    return new Promise((res) => {
      const id = ++seq;
      pending.set(id, res);
      ws.send(JSON.stringify({ id, method, params: params || {} }));
    });
  }
  await send('Page.enable'); await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  const nav = async (url) => { await send('Page.navigate', { url }); await wait(1200); };
  const ev = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.result && r.result.exceptionDetails) return { error: JSON.stringify(r.result.exceptionDetails).slice(0, 300) };
    return r.result ? r.result.result.value : undefined;
  };
  const clickTab = async (name) => ev(`document.querySelector('[data-tab="${name}"]').click()`);
  const setVal = async (id, v) => ev(
    `var el=document.getElementById('${id}'); el.value=${JSON.stringify(v)}; el.dispatchEvent(new Event('input',{bubbles:true}))`);
  const BN_TITLE = '\u09a7\u09c2\u09ae\u09aa\u09be\u09a8\u0020\u099b\u09be\u09a1\u09bc\u09c1\u09a8\u0020\u09ac\u09bf\u09a1\u09bf';

  // ---- Load: defaults ----
  await nav(BASE);
  check('page title mentions Quit Smoking', (await ev('document.title'))?.includes('Quit Smoking'));
  check('4 tabs present', (await ev(`document.querySelectorAll('[data-tab]').length`)) === 4);
  check('default cigs is 10', (await ev(`document.getElementById('cigsInput').value`)) === '10');
  check('default pack price is 300', (await ev(`document.getElementById('packPriceInput').value`)) === '300');
  check('default pack size is 20', (await ev(`document.getElementById('packSizeInput').value`)) === '20');
  check('stats empty state shown', (await ev(`document.getElementById('statsEmpty').hidden`)) === false);
  check('stats content hidden', (await ev(`document.getElementById('statsContent').hidden`)) === true);
  check('8 milestones render', (await ev(`document.querySelectorAll('#milestoneList li').length`)) === 8);
  check('7 trigger options', (await ev(`document.querySelectorAll('#triggerSelect option').length`)) === 7);
  check('timer shows 05:00', (await ev(`document.getElementById('timerDisplay').textContent`)) === '05:00');

  // ---- Save quit plan: 10 days ago, 20/day, 300 Tk pack, 20/pack ----
  // 10 days x 20/day = 200 cigs avoided; 200 x 300 / 20 = 3000.00 Tk saved.
  const tenDaysAgo = await ev(`(function(){var d=new Date(Date.now()-10*86400e3);var p=function(n){return (n<10?'0':'')+n};return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate())+'T'+p(d.getHours())+':'+p(d.getMinutes())})()`);
  await setVal('quitInput', tenDaysAgo);
  await setVal('cigsInput', '20');
  await setVal('packPriceInput', '300');
  await setVal('packSizeInput', '20');
  await ev(`document.getElementById('saveSetupBtn').click()`);
  check('setup saved message shows', (await ev(`document.getElementById('setupMsg').hidden`)) === false);
  check('stats content shown', (await ev(`document.getElementById('statsContent').hidden`)) === false);
  check('smoke-free shows 10 days', (await ev(`document.getElementById('statTime').textContent`)).includes('10 days'));
  check('200 cigarettes avoided', (await ev(`document.getElementById('statCigs').textContent`)).includes('200'));
  check('money saved 3,000.00', (await ev(`document.getElementById('statMoney').textContent`)).includes('3,000.00'));
  check('next milestone is 2 weeks to 3 months', (await ev(`document.getElementById('statNext').textContent`)).includes('2 weeks to 3 months'));
  const nextTxt = await ev(`document.getElementById('statNext').textContent`);
  check('next milestone in about 4 days', /[34] days/.test(nextTxt), 'got ' + nextTxt);

  // ---- Health tab: 2 milestones reached at 10 days ----
  await clickTab('health');
  check('2 milestones reached', (await ev(`document.querySelectorAll('#milestoneList .milestone.reached').length`)) === 2);
  check('milestone 1 text mentions heart rate', (await ev(`document.getElementById('milestoneList').textContent`)).includes('heart rate'));

  // ---- Validation: future quit date ----
  await clickTab('dash');
  const tomorrow = await ev(`(function(){var d=new Date(Date.now()+86400e3);var p=function(n){return (n<10?'0':'')+n};return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate())+'T'+p(d.getHours())+':'+p(d.getMinutes())})()`);
  await setVal('quitInput', tomorrow);
  await ev(`document.getElementById('saveSetupBtn').click()`);
  check('future quit date shows error', (await ev(`document.getElementById('quitError').hidden`)) === false);
  await setVal('quitInput', tenDaysAgo);
  await ev(`document.getElementById('saveSetupBtn').click()`);
  check('valid quit date clears error', (await ev(`document.getElementById('quitError').hidden`)) === true);

  // ---- Craving timer: starts, counts down, stops ----
  await clickTab('cravings');
  await ev(`document.getElementById('startTimerBtn').click()`);
  await wait(2200);
  const disp = await ev(`document.getElementById('timerDisplay').textContent`);
  check('timer counts down from 05:00', disp !== '05:00' && (disp === '04:59' || disp === '04:58' || disp === '04:57'), 'got ' + disp);
  check('breathing phase shown', (await ev(`document.getElementById('timerPhase').textContent`)).length > 0);
  check('stop button visible while running', (await ev(`document.getElementById('stopTimerBtn').hidden`)) === false);
  await ev(`document.getElementById('stopTimerBtn').click()`);
  check('stop resets timer to 05:00', (await ev(`document.getElementById('timerDisplay').textContent`)) === '05:00');

  // ---- Log a craving ----
  await setVal('triggerSelect', 'stress');
  await setVal('intensityInput', '4');
  await ev(`document.getElementById('logBtn').click()`);
  check('craving logged message', (await ev(`document.getElementById('logMsg').hidden`)) === false);
  check('1 log entry', (await ev(`document.querySelectorAll('#logList li').length`)) === 1);
  check('log entry mentions Stress', (await ev(`document.getElementById('logList').textContent`)).includes('Stress'));
  check('today cravings = 1', (await ev(`document.getElementById('todayCravings').textContent`)) === '1');
  check('today beaten = 1', (await ev(`document.getElementById('todayBeaten').textContent`)) === '1');

  // ---- Slip ----
  await ev(`document.getElementById('slipBtn').click()`);
  check('slip message shows', (await ev(`document.getElementById('slipMsg').hidden`)) === false);
  check('today smoked = 1 after slip', (await ev(`document.getElementById('todaySmoked').textContent`)) === '1');

  // ---- Goal: New phone, 3000 Tk -> 100% (saved is exactly 3000.00) ----
  await clickTab('dash');
  await setVal('goalNameInput', 'New phone');
  await setVal('goalTargetInput', '3000');
  await ev(`document.getElementById('goalSaveBtn').click()`);
  check('goal saved message', (await ev(`document.getElementById('goalMsg').hidden`)) === false);
  check('goal shows 100%', (await ev(`document.getElementById('goalText').textContent`)).includes('100%'));
  check('goal reached message shows', (await ev(`document.getElementById('goalReachedMsg').hidden`)) === false);

  // ---- Export / erase / import round-trip via test hooks ----
  const payload = await ev(`window.__qsb.exportPayload()`);
  check('export payload is quit-smoking-bd v1', payload.includes('"app": "quit-smoking-bd"') && payload.includes('"version": 1'), payload.slice(0, 120));
  check('export carries goal name', payload.includes('New phone'));
  check('export carries craving', payload.includes('"trigger": "stress"'));
  await ev(`window.__qsb.eraseAll()`);
  check('eraseAll empties cravings', (await ev(`window.__qsb.exportPayload()`)).includes('"cravings": []'));
  check('eraseAll clears setup', (await ev(`window.__qsb.exportPayload()`)).includes('"setup": null'));
  const imp = await ev(`JSON.stringify(window.__qsb.importPayload(${JSON.stringify(payload)}))`);
  check('import valid payload ok', imp.includes('"ok":true'), imp);
  check('import restores goal name', (await ev(`window.__qsb.exportPayload()`)).includes('New phone'));
  const badImp = await ev(`JSON.stringify(window.__qsb.importPayload('{"app":"tip-calculator-bd","version":1,"cravings":[],"slips":[]}'))`);
  check('import wrong app rejected', badImp.includes('"ok":false'));
  check('invalid import leaves data intact', (await ev(`window.__qsb.exportPayload()`)).includes('New phone'));

  // ---- Bad import via UI textarea; good import succeeds ----
  await clickTab('data');
  await ev(`document.getElementById('importText').value='{not json'; document.getElementById('importBtn').click()`);
  check('bad UI import shows error', (await ev(`document.getElementById('importFail').hidden`)) === false);
  await ev(`document.getElementById('importText').value=${JSON.stringify(payload)}; document.getElementById('importBtn').click()`);
  check('good UI import succeeds', (await ev(`document.getElementById('importOk').hidden`)) === false);

  // ---- Typed-DELETE erase via UI; wrong word rejected ----
  await ev(`document.getElementById('eraseInput').value='delete'; document.getElementById('eraseBtn').click();`);
  check('wrong erase word rejected', (await ev(`document.getElementById('eraseWrong').hidden`)) === false);
  check('wrong erase keeps data', (await ev(`window.__qsb.exportPayload()`)).includes('New phone'));
  await ev(`document.getElementById('eraseInput').value='DELETE'; document.getElementById('eraseBtn').click();`);
  check('DELETE erases data', (await ev(`window.__qsb.exportPayload()`)).includes('"cravings": []'));
  check('erase success message shows', (await ev(`document.getElementById('erasedMsg').hidden`)) === false);

  // ---- Language toggle: Bengali title + digits, persists after reload ----
  await clickTab('dash');
  await setVal('quitInput', tenDaysAgo);
  await setVal('cigsInput', '20');
  await setVal('packPriceInput', '300');
  await setVal('packSizeInput', '20');
  await ev(`document.getElementById('saveSetupBtn').click()`);
  await ev(`document.getElementById('langBtn').click()`);
  check('BN toggle: title in Bengali', (await ev(`document.getElementById('title').textContent`)) === BN_TITLE);
  check('BN toggle: money in Bengali digits', (await ev(`document.getElementById('statMoney').textContent`)).includes('\u09e9,\u09e6\u09e6\u09e6.\u09e6\u09e6'));
  check('BN toggle: tab label in Bengali', (await ev(`document.querySelector('[data-tab="health"]').textContent`)).includes('\u09b8\u09cd\u09ac\u09be\u09b8\u09cd\u09a5\u09cd\u09af'));
  await nav(BASE);
  check('BN toggle persists after reload', (await ev(`window.__qsb.state.lang`)) === 'bn');
  await ev(`document.getElementById('langBtn').click()`);
  check('back to EN', (await ev(`window.__qsb.state.lang`)) === 'en');

  // ---- Footer disclaimer ----
  check('footer mentions not medical advice', (await ev(`document.getElementById('footerText').textContent`)).includes('not medical advice'));

  // ---- Mobile 390px: no horizontal overflow on any tab ----
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await nav(BASE);
  for (const tab of ['dash', 'health', 'cravings', 'data']) {
    await clickTab(tab);
    await wait(300);
    const overflow = await ev(`document.documentElement.scrollWidth - document.documentElement.clientWidth`);
    check('390px no overflow on ' + tab + ' tab', overflow <= 0, 'overflow=' + overflow);
  }

  // ---- Zero network requests: app is fully offline (only file:// loads) ----
  const reqs = await ev(`performance.getEntriesByType('resource').map(r => r.name).filter(n => !n.startsWith('file://')).length`);
  check('zero non-file network requests', reqs === 0, 'non-file=' + reqs);

  check('no console/page errors', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));

  chrome.kill();
  console.log('\n' + count + ' checks, ' + failures + ' failed');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.log('FAIL - harness error: ' + e.message); try { chrome.kill(); } catch (_) {} process.exit(2); });
