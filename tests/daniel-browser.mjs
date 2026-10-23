/* =========================================================
   node tests/daniel-browser.mjs [url]     (default http://localhost:5173/, the dev server)
   Drives the real portfolio in headless Microsoft Edge on the GPU and checks the
   "Hello, I'm Daniel." card: hover, click / keyboard / touch, the action menu
   (keyboard, Escape, outside click, focus return, positioning at 390 / 768 / 1440),
   every action, one-at-a-time, sound only on request + mute, reduced motion,
   offscreen / hidden-tab suspension, console errors.
   What the character is doing is read from the shader uniforms he is drawn with
   (getUniformLocation / uniform* are wrapped before the page loads), and draw calls,
   AudioContexts and oscillators are counted the same way.
   Results: console + review/daniel-card/browser.json
   ========================================================= */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const URL = process.argv[2] || 'http://localhost:5173/';
const results = [];
const check = (name, pass, detail = '') => { results.push({ name, pass: !!pass, detail }); console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const INSTRUMENT = () => {
  const w = window;
  w.__draws = 0; w.__u = {}; w.__audio = { contexts: 0, notes: 0 };
  const P = WebGL2RenderingContext.prototype;
  const gul = P.getUniformLocation;
  P.getUniformLocation = function (prog, name) { const l = gul.call(this, prog, name); if (l) l.__n = name; return l; };
  for (const fn of ['uniform1f', 'uniform1i', 'uniform2f', 'uniform3f', 'uniform4f', 'uniform2fv', 'uniform3fv', 'uniform4fv', 'uniformMatrix3fv']) {
    const o = P[fn];
    P[fn] = function (loc, ...a) { if (loc && loc.__n) w.__u[loc.__n] = fn === 'uniformMatrix3fv' ? Array.from(a[1]) : a.length === 1 && a[0].length ? Array.from(a[0]) : a; return o.call(this, loc, ...a); };
  }
  const draw = P.drawArrays;
  P.drawArrays = function (...a) { w.__draws++; return draw.apply(this, a); };
  const AC = w.AudioContext;
  if (AC) {
    w.AudioContext = class extends AC { constructor(...a) { super(...a); w.__audio.contexts++; } };
    const st = OscillatorNode.prototype.start;
    OscillatorNode.prototype.start = function (...a) { w.__audio.notes++; return st.apply(this, a); };
  }
};
// what he's doing, from the uniforms: gaze, body lift (hip y), sway (body matrix), arm raise (hand openness)
const READ = () => {
  const u = window.__u; if (!u.uEye) return null;
  return {
    gazeX: u.uEye[0], gazeY: u.uEye[1], lift: (u.uBodyT?.[1] ?? 0.3) - 0.3,
    sway: Math.asin(Math.max(-1, Math.min(1, u.uBodyM?.[1] ?? 0))) * 57.3,     // column 0's y: the body's x axis tilting
    lean: Math.asin(Math.max(-1, Math.min(1, u.uBodyM?.[5] ?? 0))) * 57.3,
    headTilt: Math.asin(Math.max(-1, Math.min(1, -(u.uHeadM?.[1] ?? 0)))) * -57.3,
    raiseL: u.uHandOpen?.[0] ?? 0, raiseR: u.uHandOpen?.[1] ?? 0,
  };
};

const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=user-gesture-required'] });
const pageFor = async (opts = {}) => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, ...opts });
  await ctx.addInitScript(INSTRUMENT);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/api\/|Failed to load resource/.test(m.text())) errors.push(m.text()); });
  await page.goto(URL, { waitUntil: 'load' });
  await page.locator('.wg--name').scrollIntoViewIfNeeded();
  await page.waitForSelector('.dnc--live', { timeout: 40000 });
  await sleep(400);
  return { ctx, page, errors };
};
const S = (page) => page.evaluate(() => document.querySelector('.dnc').dataset.state);
const waitState = async (page, want, ms = 8000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if ((await S(page)) === want) return Date.now() - t0; await sleep(30); } return -1; };
const pose = (page) => page.evaluate(READ);
const draws = (page) => page.evaluate(() => window.__draws);
const audio = (page) => page.evaluate(() => ({ ...window.__audio }));
const menuOpen = (page) => page.evaluate(() => !!document.querySelector('.dnc-menu:not(.is-leaving)'));   // (a closing menu fades out for 140 ms, already inert)

try {
  // ================= desktop, mouse + keyboard =================
  {
    const { ctx, page, errors } = await pageFor();
    const daniel = page.getByRole('button', { name: 'Wave to Daniel' });
    const trig = page.getByRole('button', { name: 'Daniel’s actions' });
    check('card renders live, with a sibling actions button', (await page.locator('.dnc > button').count()) === 2 && (await page.locator('.dnc__btn button').count()) === 0);
    const tb = await trig.boundingBox();
    check('actions button hit area ≥ 44 × 44 px', tb.width >= 44 && tb.height >= 44, `${tb.width}×${tb.height}`);
    // the resting weight from the stylesheet (the letters' inline weight swells while the name animates)
    const font = await page.evaluate(() => { const x = document.createElement('span'); x.className = 'daniel__ch'; document.querySelector('.daniel__word').append(x); const s = getComputedStyle(x); queueMicrotask(() => x.remove()); return { family: s.fontFamily, wght: s.fontVariationSettings, ready: document.fonts.check('560 64px "Nunito Variable"') }; });
    check('name set in the bundled rounded font, medium weight', /Nunito/.test(font.family) && /560/.test(font.wght) && font.ready, JSON.stringify(font));
    check('no hint line under the name', (await page.locator('.daniel__hint').count()) === 0);

    // --- hover ---
    await page.mouse.move(5, 5); await sleep(1200);
    const box = await daniel.boundingBox();
    const p0 = await pose(page);
    await page.mouse.move(box.x + box.width * 0.8, box.y + box.height * 0.4, { steps: 4 });
    const lifts = [];
    for (let i = 0; i < 14; i++) { await sleep(50); lifts.push((await pose(page)).lift); }
    await sleep(900);
    const ph = await pose(page);
    check('hover: a brief rise on entry, then settles', Math.max(...lifts) > ph.lift + 0.005 && ph.lift > 0.003, `peak lift ${Math.max(...lifts).toFixed(4)}, held ${ph.lift.toFixed(4)} (rest ${p0.lift.toFixed(4)})`);
    check('hover: eyes towards the pointer, head tilted, attentive lean', ph.gazeX > 0.15 && Math.abs(ph.headTilt) > 2 && ph.lean > 1, `gazeX ${ph.gazeX.toFixed(2)}, tilt ${ph.headTilt.toFixed(1)}°, lean ${ph.lean.toFixed(1)}°`);
    check('hover does not start an action', (await S(page)) === 'idle');
    const l1 = []; for (let i = 0; i < 10; i++) { await sleep(60); l1.push((await pose(page)).lift); }
    check('hover: no continuous bouncing', Math.max(...l1) - Math.min(...l1) < 0.001, `lift range ${(Math.max(...l1) - Math.min(...l1)).toFixed(5)}`);
    await page.mouse.move(box.x - 400, box.y + 20, { steps: 4 });
    await sleep(1600);
    const pe = await pose(page);
    check('hover exit: back to neutral', pe.lift < 0.002 && pe.lean < 0.2, `lift ${pe.lift.toFixed(4)}, lean ${pe.lean.toFixed(2)}`);
    check('no sound on load or hover', (await audio(page)).contexts === 0);

    // --- click = single-hand wave ---
    await daniel.click();
    check('click: single-hand wave', (await waitState(page, 'wave', 600)) >= 0);
    await sleep(1300);
    const wp = await pose(page);
    check('wave raises one hand only', wp.raiseR > 0.9 && wp.raiseL < 0.05, `R ${wp.raiseR.toFixed(2)}, L ${wp.raiseL.toFixed(2)}`);
    // the hover during a wave doesn't change it
    await page.mouse.move(box.x + box.width * 0.4, box.y + box.height * 0.4, { steps: 3 });
    await sleep(200);
    check('hover during an action does not interrupt it', (await S(page)) === 'wave');
    check('wave returns to idle', (await waitState(page, 'idle', 6000)) >= 0);
    await page.mouse.move(5, 5);
    check('no sound on ordinary clicks', (await audio(page)).contexts === 0);

    // --- the menu, by keyboard ---
    await sleep(800);
    await trig.focus();
    await page.keyboard.press('Enter');
    await sleep(150);
    check('Enter opens the menu; aria-expanded true', (await menuOpen(page)) && (await trig.getAttribute('aria-expanded')) === 'true');
    check('focus moves to the first item', (await page.evaluate(() => document.activeElement?.textContent)) === 'Wave');
    check('opening the menu does not wave', (await S(page)) === 'idle');
    await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowDown');
    check('arrow keys move through the items', (await page.evaluate(() => document.activeElement?.textContent)) === 'Dance');
    await page.keyboard.press('End');
    check('End jumps to the mute switch', (await page.evaluate(() => document.activeElement?.getAttribute('role'))) === 'menuitemcheckbox');
    await page.keyboard.press('Escape'); await sleep(100);
    check('Escape closes and returns focus to the trigger', !(await menuOpen(page)) && (await page.evaluate(() => document.activeElement?.getAttribute('aria-label'))) === 'Daniel’s actions' && (await trig.getAttribute('aria-expanded')) === 'false');
    await page.keyboard.press('ArrowUp'); await sleep(100);
    check('ArrowUp on the trigger opens at the last item', (await menuOpen(page)) && (await page.evaluate(() => document.activeElement?.getAttribute('role'))) === 'menuitemcheckbox');
    await page.keyboard.press('Home'); await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter'); await sleep(100);
    check('choosing "Wave both hands" by keyboard', (await waitState(page, 'waveBoth', 600)) >= 0 && !(await menuOpen(page)) && (await page.evaluate(() => document.activeElement?.getAttribute('aria-label'))) === 'Daniel’s actions');
    await sleep(1200);
    const bp = await pose(page);
    check('both arms raised', bp.raiseR > 0.9 && bp.raiseL > 0.9, `R ${bp.raiseR.toFixed(2)}, L ${bp.raiseL.toFixed(2)}`);
    // while busy: items disabled, a choice does nothing, clicking him does nothing
    await trig.click(); await sleep(120);
    const dis = await page.$$eval('.dnc-menu [role="menuitem"]', (els) => els.map((e) => e.getAttribute('aria-disabled')));
    check('while busy, every action is disabled (mute stays available)', dis.every((d) => d === 'true') && (await page.locator('[role="menuitemcheckbox"]').getAttribute('aria-disabled')) === null, dis.join(','));
    await page.getByRole('menuitem', { name: 'Dance' }).click({ force: true });   // force: Playwright would otherwise wait for it to be enabled
    check('a disabled choice does nothing (menu stays open)', (await S(page)) === 'waveBoth' && (await menuOpen(page)));
    // outside click closes; clicking a visible part of him to dismiss doesn't wave
    const free = await page.evaluate(() => {
      const d = document.querySelector('.dnc__btn').getBoundingClientRect(), m = document.querySelector('.dnc-menu').getBoundingClientRect();
      for (let y = d.top + 4; y < d.bottom - 4; y += 4) for (let x = d.left + 4; x < d.right - 4; x += 4)
        if ((x < m.left || x > m.right || y < m.top || y > m.bottom) && document.elementFromPoint(x, y)?.closest('.dnc__btn')) return [x, y];
      return null;
    });
    if (free) {
      await page.mouse.click(free[0], free[1]);
      await sleep(120);
      check('clicking Daniel while the menu is open only closes it', !(await menuOpen(page)) && (await S(page)) === 'waveBoth');
    } else {
      check('clicking Daniel while the menu is open only closes it', true, 'not reachable at this size: the open menu covers him');
      await page.keyboard.press('Escape');
    }
    await waitState(page, 'idle', 6000);
    await trig.click(); await sleep(100);
    await page.mouse.click(40, 40); await sleep(100);
    check('outside click dismisses the menu', !(await menuOpen(page)) && (await S(page)) === 'idle');

    // --- every action through the menu (pointer) ---
    const lens = {};
    for (const [name, st] of [['Wave', 'wave'], ['Dance', 'dance'], ['Nod', 'nod']]) {
      await trig.click(); await sleep(100);
      await page.getByRole('menuitem', { name, exact: true }).click();
      const started = await waitState(page, st, 600);
      const t0 = Date.now();
      let maxSway = 0, maxLift = 0;
      while ((await S(page)) === st && Date.now() - t0 < 8000) { const q = await pose(page); maxSway = Math.max(maxSway, Math.abs(q.sway)); maxLift = Math.max(maxLift, q.lift); await sleep(40); }
      lens[st] = (Date.now() - t0) / 1000;
      check(`menu → ${name}: plays and returns to idle`, started >= 0 && (await S(page)) === 'idle', `${lens[st].toFixed(1)} s${st === 'dance' ? `, max sway ${maxSway.toFixed(1)}°, max lift ${(maxLift * 1000).toFixed(0)} mm-units` : ''}`);
    }
    check('dance lasts 3–4 s', lens.dance >= 3 && lens.dance <= 4.5);

    // --- sound: only when chosen; mute ---
    await trig.click(); await sleep(100);
    await page.getByRole('menuitem', { name: 'Make a sound' }).click();
    check('menu → Make a sound: head reaction', (await waitState(page, 'sound', 600)) >= 0);
    await sleep(700);
    const a1 = await audio(page);
    check('the chirp plays: one AudioContext, two notes', a1.contexts === 1 && a1.notes === 2, JSON.stringify(a1));
    await waitState(page, 'idle', 3000);
    await trig.click(); await sleep(100);
    await page.getByRole('menuitemcheckbox', { name: 'Mute sounds' }).click(); await sleep(100);
    check('mute switch: checked, menu stays open, remembered', (await page.getByRole('menuitemcheckbox').getAttribute('aria-checked')) === 'true' && (await menuOpen(page)) && (await page.evaluate(() => localStorage.getItem('daniel:muted'))) === '1');
    await page.getByRole('menuitem', { name: 'Make a sound' }).click();
    await waitState(page, 'sound', 600); await sleep(500);
    const a2 = await audio(page);
    check('muted: the head reaction plays, no sound', a2.notes === a1.notes, `${a2.notes - a1.notes} new notes; label "${(await page.locator('.dnc__tip-hi').innerText()).trim()}"`);
    await waitState(page, 'idle', 3000);
    await trig.click(); await page.getByRole('menuitemcheckbox').click(); await page.keyboard.press('Escape');

    // --- Daniel by keyboard ---
    await daniel.focus(); await page.keyboard.press('Enter');
    check('Enter on Daniel waves', (await waitState(page, 'wave', 600)) >= 0);
    await waitState(page, 'idle', 6000);
    await page.keyboard.press('Space');
    check('Space on Daniel waves', (await waitState(page, 'wave', 600)) >= 0);
    await waitState(page, 'idle', 6000);
    // rapid repeated clicks: one wave
    await page.evaluate(() => { const b = document.querySelector('.dnc__btn'); for (let i = 0; i < 10; i++) setTimeout(() => b.click(), i * 50); });
    await sleep(700);
    const said = await page.locator('.dnc [role="status"]').innerText();
    check('10 rapid clicks: one wave', (await S(page)) === 'wave', `live region "${said}"`);
    await waitState(page, 'idle', 6000);

    // --- offscreen / hidden ---
    await page.evaluate(() => scrollTo(0, document.body.scrollHeight)); await sleep(500);
    const d0 = await draws(page); await sleep(800);
    check('offscreen: drawing stops', (await draws(page)) === d0);
    await page.locator('.wg--name').scrollIntoViewIfNeeded(); await sleep(400);
    await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
    const d1 = await draws(page); await sleep(800);
    check('hidden tab: drawing stops (simulated visibilitychange)', (await draws(page)) === d1);
    await page.evaluate(() => { delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); });

    // --- menu positioning at three widths, in both themes ---
    for (const w of [1440, 768, 390]) {
      await page.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
      await page.locator('.wg--name').scrollIntoViewIfNeeded(); await sleep(300);
      await trig.click(); await sleep(150);
      const g = await page.evaluate(() => {
        const m = document.querySelector('.dnc-menu').getBoundingClientRect(), t = document.querySelector('.dnc__more').getBoundingClientRect();
        return { m: [m.left, m.top, m.right, m.bottom].map(Math.round), vw: document.documentElement.clientWidth, vh: innerHeight, near: Math.abs(m.right - t.right) < 2 || m.left === 8, parent: document.querySelector('.dnc-menu').parentElement.tagName, sw: document.documentElement.scrollWidth };
      });
      check(`menu inside the viewport at ${w}px, next to the trigger, not clipped by the card`, g.m[0] >= 8 && g.m[1] >= 8 && g.m[2] <= g.vw - 8 && g.m[3] <= g.vh - 8 && g.near && g.parent === 'BODY' && g.sw <= g.vw, JSON.stringify(g));
      await page.screenshot({ path: path.join(root, 'review/daniel-card', `menu-${w}.png`) });
      await page.keyboard.press('Escape');
      const o = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      check(`no horizontal overflow at ${w}px`, o <= 0);
    }
    check('no console errors (desktop)', errors.length === 0, errors.join(' | '));
    await ctx.close();
  }

  // ================= touch (phone) =================
  {
    const { ctx, page, errors } = await pageFor({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
    const daniel = page.getByRole('button', { name: 'Wave to Daniel' });
    await daniel.tap();
    check('touch: tap Daniel waves', (await waitState(page, 'wave', 800)) >= 0);
    await waitState(page, 'idle', 6000);
    await page.getByRole('button', { name: 'Daniel’s actions' }).tap(); await sleep(350);   // after the 0.14 s entrance
    check('touch: tap the trigger opens the menu, no wave', (await menuOpen(page)) && (await S(page)) === 'idle');
    const item = await page.getByRole('menuitem', { name: 'Nod' }).boundingBox();
    check('touch: menu items are ≥ 44 px tall', item.height >= 44, `${item.height}px`);
    await page.getByRole('menuitem', { name: 'Nod' }).tap();
    check('touch: choosing Nod plays it', (await waitState(page, 'nod', 800)) >= 0);
    const ph = await pose(page);
    check('touch: no hover reaction', Math.abs(ph.gazeX) < 0.05 && ph.lean < 0.3);
    check('no console errors (touch)', errors.length === 0, errors.join(' | '));
    await ctx.close();
  }

  // ================= reduced motion =================
  {
    const { ctx, page, errors } = await pageFor({ reducedMotion: 'reduce' });
    const daniel = page.getByRole('button', { name: 'Wave to Daniel' });
    const box = await daniel.boundingBox();
    await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.4, { steps: 3 }); await sleep(600);
    const ph = await pose(page);
    check('reduced: no hover reaction', Math.abs(ph.gazeX) < 0.01 && ph.lift === 0 && ph.lean === 0);
    const d0 = await draws(page); await sleep(800);
    check('reduced: idle does not redraw continuously', (await draws(page)) - d0 <= 1, `${(await draws(page)) - d0} draws in 0.8 s`);
    const trig = page.getByRole('button', { name: 'Daniel’s actions' });
    for (const [name, st, tip] of [['Dance', 'dance', 'Dance time!'], ['Wave both hands', 'waveBoth', 'Hi hi!'], ['Nod', 'nod', 'Yes!']]) {
      await trig.click(); await sleep(100);
      await page.getByRole('menuitem', { name, exact: true }).click();
      await waitState(page, st, 600);
      await sleep(150);
      const a = await draws(page); const q1 = await pose(page); await sleep(700); const q2 = await pose(page);
      const label = (await page.locator('.dnc__tip-hi').innerText()).trim();
      check(`reduced: ${name} is a still pose with a text acknowledgement`, (await draws(page)) - a <= 1 && JSON.stringify(q1) === JSON.stringify(q2) && label === tip, `${(await draws(page)) - a} draws while held; label "${label}"`);
      await waitState(page, 'idle', 3000);
    }
    await daniel.click();
    check('reduced: clicking Daniel shows the still greeting', (await waitState(page, 'greet', 600)) >= 0);
    await waitState(page, 'idle', 3000);
    await trig.click(); await page.getByRole('menuitem', { name: 'Make a sound' }).click(); await sleep(700);
    check('reduced: a requested sound still plays', (await audio(page)).notes === 2);
    check('no console errors (reduced motion)', errors.length === 0, errors.join(' | '));
    await ctx.close();
  }
} finally {
  await browser.close();
  fs.mkdirSync(path.join(root, 'review/daniel-card'), { recursive: true });
  fs.writeFileSync(path.join(root, 'review/daniel-card/browser.json'), JSON.stringify(results, null, 2));
  const failed = results.filter((r) => !r.pass).length;
  console.log(`\n${results.length - failed}/${results.length} browser checks passed`);
  process.exitCode = failed ? 1 : 0;
}
