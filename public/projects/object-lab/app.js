(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const canvas = $('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) { $('announcement').textContent = 'Canvas is unavailable in this browser.'; return; }
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const LIMIT = 32;
  const STEP = 1 / 120;
  const colors = ['#dc5932', '#a6b28c', '#e5b85d', '#7e9287', '#e4d9bd'];
  let width = 1, height = 1, dpr = 1, objects = [], serial = 0;
  let gravity = 1, paused = reducedMotion.matches, drag = null;
  let last = 0, accumulator = 0, frame = 0;
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  const announce = text => { $('announcement').textContent = text; };
  function updateUI() {
    $('countLabel').textContent = `${String(objects.length).padStart(2, '0')} OBJECTS`;
    $('pauseText').textContent = paused ? 'Resume' : 'Pause';
    $('pauseIcon').textContent = paused ? '▷' : 'Ⅱ';
    $('stateLabel').textContent = paused ? 'SIMULATION PAUSED' : 'LIVE SIMULATION';
    $('liveDot').classList.toggle('paused', paused);
    $('pausedTag').hidden = !paused;
    $('addCircle').disabled = $('addSquare').disabled = objects.length >= LIMIT;
  }
  function bounds(b) {
    const r = b.r;
    if (b.x < r) { b.x = r; if (b.vx < 0) b.vx *= -.65; }
    if (b.x > width - r) { b.x = width - r; if (b.vx > 0) b.vx *= -.65; }
    if (b.y < r) { b.y = r; if (b.vy < 0) b.vy *= -.65; }
    if (b.y > height - r) {
      b.y = height - r;
      if (b.vy > 0) b.vy = b.vy < 35 ? 0 : -b.vy * .57;
      b.vx *= .985;
    }
  }
  function add(type, x, y, size) {
    if (objects.length >= LIMIT) return;
    const r = size || (width < 500 ? 21 : 28) + Math.random() * 9;
    const b = { type, r, x: x ?? width * (.22 + Math.random() * .56), y: y ?? 65 + Math.random() * 55,
      vx: (Math.random() - .5) * 100, vy: 0, color: colors[serial % colors.length], id: ++serial, mass: r * r };
    objects.push(b); bounds(b); updateUI(); render();
    return b;
  }
  // Contact normals point from A to B. Squares stay aligned with the chamber.
  function contact(a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    if (Math.abs(dx) >= a.r + b.r || Math.abs(dy) >= a.r + b.r) return null;
    if (a.type === 'circle' && b.type === 'circle') {
      const distance = Math.hypot(dx, dy), depth = a.r + b.r - distance;
      return depth > 0 ? { nx: distance ? dx / distance : 1, ny: distance ? dy / distance : 0, depth } : null;
    }
    if (a.type === 'square' && b.type === 'square') {
      const px = a.r + b.r - Math.abs(dx), py = a.r + b.r - Math.abs(dy);
      return px < py ? { nx: Math.sign(dx) || 1, ny: 0, depth: px } : { nx: 0, ny: Math.sign(dy) || 1, depth: py };
    }
    const c = a.type === 'circle' ? a : b, s = a.type === 'square' ? a : b;
    const qx = clamp(c.x, s.x - s.r, s.x + s.r), qy = clamp(c.y, s.y - s.r, s.y + s.r);
    let nx = c.x - qx, ny = c.y - qy, distance = Math.hypot(nx, ny), depth;
    if (distance) { depth = c.r - distance; nx /= distance; ny /= distance; }
    else {
      const px = s.r - Math.abs(c.x - s.x), py = s.r - Math.abs(c.y - s.y);
      if (px < py) { nx = Math.sign(c.x - s.x) || 1; ny = 0; depth = c.r + px; }
      else { nx = 0; ny = Math.sign(c.y - s.y) || 1; depth = c.r + py; }
    }
    if (a === c) { nx *= -1; ny *= -1; }
    return depth > 0 ? { nx, ny, depth } : null;
  }
  function resolve(a, b) {
    const hit = contact(a, b);
    if (!hit) return;
    const { nx, ny, depth } = hit;
    const ia = drag?.body === a ? 0 : 1 / a.mass, ib = drag?.body === b ? 0 : 1 / b.mass;
    const sum = ia + ib;
    if (!sum) return;
    const correction = Math.max(depth - .05, 0) * .8 / sum;
    a.x -= nx * correction * ia; a.y -= ny * correction * ia;
    b.x += nx * correction * ib; b.y += ny * correction * ib;
    const rvx = b.vx - a.vx, rvy = b.vy - a.vy, speed = rvx * nx + rvy * ny;
    if (speed >= 0) return;
    const impulse = -(1 + (speed < -45 ? .57 : 0)) * speed / sum;
    a.vx -= impulse * nx * ia; a.vy -= impulse * ny * ia;
    b.vx += impulse * nx * ib; b.vy += impulse * ny * ib;
    const friction = clamp(-(rvx * -ny + rvy * nx) / sum, -impulse * .22, impulse * .22);
    a.vx -= friction * -ny * ia; a.vy -= friction * nx * ia;
    b.vx += friction * -ny * ib; b.vy += friction * nx * ib;
  }
  function step() {
    for (const b of objects) {
      if (drag?.body === b) continue;
      b.vy += 780 * gravity * STEP;
      b.vx *= .999; b.vy *= .999;
      b.x += b.vx * STEP; b.y += b.vy * STEP;
      bounds(b);
    }
    for (let pass = 0; pass < 5; pass++) {
      for (let i = 0; i < objects.length; i++) for (let j = i + 1; j < objects.length; j++) resolve(objects[i], objects[j]);
      objects.forEach(bounds);
    }
  }
  function shape(b, inset = 0) {
    const r = b.r - inset;
    ctx.beginPath();
    if (b.type === 'circle') ctx.arc(b.x, b.y, r, 0, Math.PI * 2);
    else ctx.rect(b.x - r, b.y - r, r * 2, r * 2);
  }
  function render() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#d8ddce';
    for (let x = 16; x < width; x += 24) for (let y = 16; y < height; y += 24) ctx.fillRect(x, y, 1, 1);
    ctx.strokeStyle = '#d1d6c6'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, height - 1); ctx.lineTo(width, height - 1); ctx.stroke();
    for (const b of objects) {
      ctx.save(); ctx.shadowColor = '#333b2720'; ctx.shadowBlur = 6; ctx.shadowOffsetY = 4;
      shape(b); ctx.fillStyle = b.color; ctx.fill(); ctx.shadowColor = 'transparent';
      ctx.strokeStyle = '#353b4160'; ctx.lineWidth = 1.4; ctx.stroke();
      shape(b, 5); ctx.strokeStyle = '#ffffff55'; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = '#2d3226b0'; ctx.font = '10px "Courier New", monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(String(b.id).padStart(2, '0'), b.x, b.y + 1);
      if (drag?.body === b) { shape(b, -5); ctx.strokeStyle = '#d84b25'; ctx.setLineDash([3, 4]); ctx.stroke(); }
      ctx.restore();
    }
  }
  function tick(time) {
    frame = 0;
    if (paused || document.hidden) return;
    if (last) accumulator += Math.min((time - last) / 1000, .05);
    last = time;
    while (accumulator >= STEP) { step(); accumulator -= STEP; }
    render(); frame = requestAnimationFrame(tick);
  }
  function schedule() {
    cancelAnimationFrame(frame); frame = 0; last = 0; accumulator = 0;
    if (!paused && !document.hidden) frame = requestAnimationFrame(tick);
  }
  function endDrag(throwIt = true) {
    if (!drag) return;
    const old = drag; drag = null;
    old.body.vx = old.body.vy = 0;
    if (throwIt && !paused && performance.now() - old.updated < 110) {
      old.body.vx = clamp(old.vx, -1000, 1000); old.body.vy = clamp(old.vy, -1000, 1000);
    }
    if (canvas.hasPointerCapture(old.pointerId)) canvas.releasePointerCapture(old.pointerId);
    canvas.classList.remove('dragging'); render();
  }
  function setPaused(value) {
    endDrag(false); paused = value; updateUI(); schedule(); render();
    announce(paused ? 'Simulation paused. Add or arrange shapes, then resume.' : 'Simulation running.');
  }
  function reset() {
    endDrag(false); objects = []; serial = 0; gravity = 1;
    $('gravity').value = '1'; updateGravity();
    const r = width < 500 ? 25 : 37;
    add('circle', width * .28, height * .35, r);
    add('square', width * .48, height * .24, r * .85);
    add('circle', width * .68, height * .42, r * 1.2);
    add('square', width * .4, height * .68, r * .7);
    add('circle', width * .75, height * .75, r * .65);
    schedule(); announce('Chamber reset. Five objects. Gravity 1.0 times.');
  }
  function resize() {
    const rect = canvas.getBoundingClientRect(), oldWidth = width, oldHeight = height;
    width = Math.max(1, rect.width); height = Math.max(1, rect.height);
    dpr = Math.min(devicePixelRatio || 1, 3);
    canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
    endDrag(false);
    for (const b of objects) { b.x *= width / oldWidth; b.y *= height / oldHeight; bounds(b); }
    render();
  }
  function point(e) { const rect = canvas.getBoundingClientRect(); return { x: e.clientX - rect.left, y: e.clientY - rect.top }; }
  canvas.addEventListener('pointerdown', e => {
    if (drag || e.button !== 0) return;
    const p = point(e);
    const body = [...objects].reverse().find(b => b.type === 'circle' ? Math.hypot(p.x - b.x, p.y - b.y) <= b.r : Math.abs(p.x - b.x) <= b.r && Math.abs(p.y - b.y) <= b.r);
    if (!body) return;
    e.preventDefault(); canvas.focus({ preventScroll: true });
    drag = { body, pointerId: e.pointerId, dx: p.x - body.x, dy: p.y - body.y, updated: performance.now(), vx: 0, vy: 0 };
    body.vx = body.vy = 0;
    objects.splice(objects.indexOf(body), 1); objects.push(body);
    canvas.setPointerCapture(e.pointerId); canvas.classList.add('dragging'); render();
  });
  canvas.addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== drag.pointerId) return;
    const p = point(e), b = drag.body, now = performance.now(), dt = Math.max((now - drag.updated) / 1000, .008);
    const x = clamp(p.x - drag.dx, b.r, width - b.r), y = clamp(p.y - drag.dy, b.r, height - b.r);
    drag.vx = (x - b.x) / dt; drag.vy = (y - b.y) / dt; drag.updated = now;
    b.x = x; b.y = y; render();
  });
  canvas.addEventListener('pointerup', e => { if (e.pointerId === drag?.pointerId) endDrag(); });
  for (const event of ['pointercancel', 'lostpointercapture']) canvas.addEventListener(event, e => { if (e.pointerId === drag?.pointerId) endDrag(false); });
  canvas.tabIndex = 0;
  canvas.addEventListener('keydown', e => {
    if (e.code === 'Space') { e.preventDefault(); if (!e.repeat) setPaused(!paused); }
    if (e.key === 'Escape') endDrag(false);
  });
  for (const type of ['circle', 'square']) $('add' + type[0].toUpperCase() + type.slice(1)).addEventListener('click', () => {
    add(type); announce(objects.length === LIMIT ? 'Chamber full: 32 objects. Reset to start again.' : `${type} added. ${objects.length} objects in the chamber.`);
  });
  function updateGravity() {
    gravity = Number($('gravity').value);
    $('gravityValue').textContent = `${gravity.toFixed(1)}×`;
    $('gravity').setAttribute('aria-valuetext', `${gravity.toFixed(1)} times normal gravity`);
  }
  $('gravity').addEventListener('input', updateGravity);
  $('pause').addEventListener('click', () => setPaused(!paused));
  $('reset').addEventListener('click', reset);
  document.addEventListener('visibilitychange', () => { if (document.hidden) endDrag(false); schedule(); });
  window.addEventListener('blur', () => endDrag(false));
  reducedMotion.addEventListener('change', e => { if (e.matches) setPaused(true); });
  new ResizeObserver(resize).observe($('chamber'));
  window.addEventListener('resize', resize);
  resize(); reset();
  if (paused) announce('Simulation starts paused for reduced motion. Select Resume when ready.');
})();
