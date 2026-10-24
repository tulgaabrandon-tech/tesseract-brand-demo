/* ==========================================================================
   Tesseract T4 — interactive prototype
   Plain JS, no dependencies. All behaviour is simulated locally.
   ========================================================================== */
(() => {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  /* ------------------------------------------------------------------
     Storage (per-viewer convenience only; app works without it)
     ------------------------------------------------------------------ */
  const store = {
    get(k, fallback) { try { const v = localStorage.getItem('t4:' + k); return v ? JSON.parse(v) : fallback; } catch { return fallback; } },
    set(k, v) { try { localStorage.setItem('t4:' + k, JSON.stringify(v)); } catch { /* ignore */ } }
  };

  /* ------------------------------------------------------------------
     Options & defaults (from the reference screenshots)
     ------------------------------------------------------------------ */
  const OPTIONS = {
    resolution: [
      ['native', 'Native (2560 × 1600)'], ['2160', '3840 × 2160 (4K)'], ['1440', '2560 × 1440 (1440p)'],
      ['1080', '1920 × 1080 (1080p)'], ['720', '1280 × 720 (720p)']
    ],
    fps: [['30', '30 FPS'], ['60', '60 FPS'], ['90', '90 FPS'], ['120', '120 FPS'], ['144', '144 FPS']],
    codec: [['auto', 'Automatic (recommended)'], ['h264', 'H.264'], ['hevc', 'HEVC (H.265)'], ['av1', 'AV1']],
    displayMode: [['fullscreen', 'Fullscreen'], ['borderless', 'Borderless windowed'], ['windowed', 'Windowed']],
    audio: [['stereo', 'Stereo'], ['51', '5.1 surround'], ['71', '7.1 surround']],
    captureWhen: [['fullscreen', 'in fullscreen'], ['always', 'always']],
    language: [['auto', 'Automatic'], ['en', 'English'], ['mn', 'Монгол'], ['ja', '日本語'], ['de', 'Deutsch']],
    guiMode: [['windowed', 'Windowed'], ['maximized', 'Maximized'], ['fullscreen', 'Fullscreen']],
    decoder: [['auto', 'Automatic (recommended)'], ['hw', 'Force hardware decoding'], ['sw', 'Force software decoding']]
  };
  const RES_SHORT = { native: '2560 × 1600', 2160: '3840 × 2160', 1440: '2560 × 1440', 1080: '1920 × 1080', 720: '1280 × 720' };
  const RES_MOBILE = { native: '1600p', 2160: '4K', 1440: '1440p', 1080: '1080p', 720: '720p' };
  const DELAYS = [9, 8, 9, 10, 7, 9, 8, 11, 9];
  const JITTERS = [5, 4, 5, 6, 5, 4, 5, 5, 6];
  const RES_BASE = { 720: 10, 1080: 20.5, 1440: 32, native: 40, 2160: 80 };

  const DEFAULTS = {
    resolution: '1080', fps: '60', bitrate: 20.5, codec: 'auto', displayMode: 'borderless',
    vsync: true, framePacing: false, perfStats: true, muteUnfocused: false, askEveryLaunch: true,
    audio: 'stereo', muteHost: true, optimizeGames: true, quitAfter: false,
    mouseDesktop: false, captureKeys: false, captureWhen: 'fullscreen', trackpad: false, swapMouse: false, reverseScroll: false,
    swapAB: false, forcePad: false, padMouse: true, padBackground: false,
    language: 'auto', guiMode: 'windowed', qualityWarnings: true, discord: true, keepAwake: true,
    decoder: 'auto', hdr: false, yuv444: false, unlockBitrate: false, findLocal: true, detectBlocked: true
  };

  const PLATFORMS = [
    { id: 'epic', name: 'Epic Games', mono: 'E' },
    { id: 'xbox', name: 'Xbox', mono: 'X' },
    { id: 'ubisoft', name: 'Ubisoft Connect', mono: 'U' },
    { id: 'ea', name: 'EA app', mono: 'EA' },
    { id: 'gog', name: 'GOG', mono: 'GOG' },
    { id: 'battlenet', name: 'Battle.net', mono: 'B' }
  ];

  const state = {
    settings: Object.assign({}, DEFAULTS, store.get('settings', {})),
    draft: null,                  // popover working copy
    linked: store.get('linked', {}), // id -> true
    connecting: {},               // id -> true
    signedIn: true,
    phoneSignedIn: true
  };

  const recommendBitrate = (res, fps) => {
    const base = RES_BASE[res] ?? 20.5;
    const v = base * Math.pow(Number(fps) / 60, 0.8);
    return Math.min(maxBitrate(), Math.max(5, Math.round(v * 2) / 2));
  };
  const maxBitrate = () => (state.settings.unlockBitrate ? 150 : 80);
  const fmtRate = (v) => `${Number(v).toFixed(1)} Mbps`;

  /* ------------------------------------------------------------------
     Toasts
     ------------------------------------------------------------------ */
  const ICON = { ok: 'i-check', warn: 'i-warn', err: 'i-warn', info: 'i-info' };
  function toast(msg, kind = 'info', host = $('#toasts'), ms = 3200) {
    const el = document.createElement('div');
    el.className = `toast toast--${kind}`;
    el.innerHTML = `<svg class="ic"><use href="#${ICON[kind]}"/></svg><span></span>`;
    el.lastChild.textContent = msg;
    host.appendChild(el);
    setTimeout(() => { el.classList.add('is-out'); setTimeout(() => el.remove(), 260); }, ms);
  }

  /* ------------------------------------------------------------------
     Data binding: [data-bind] controls read/write a settings object.
     Controls inside #streamPop bind to the draft, everything else to
     the saved settings.
     ------------------------------------------------------------------ */
  const pop = $('#streamPop');
  const popLayer = $('#popLayer');
  const scopeOf = (el) => (pop.contains(el) ? 'draft' : 'settings');
  const objOf = (el) => (scopeOf(el) === 'draft' ? state.draft : state.settings);

  function fillSelects() {
    $$('select[data-bind]').forEach((sel) => {
      const opts = OPTIONS[sel.dataset.bind];
      if (!opts || sel.options.length) return;
      opts.forEach(([v, label]) => sel.add(new Option(label, v)));
    });
  }

  function paintRange(input) {
    const min = +input.min, max = +input.max;
    input.style.setProperty('--p', `${((+input.value - min) / (max - min)) * 100}%`);
  }

  function renderBound(root = document) {
    $$('[data-bind]', root).forEach((el) => {
      const obj = objOf(el);
      if (!obj) return;
      const key = el.dataset.bind;
      const v = obj[key];
      if (el.type === 'checkbox') el.checked = !!v;
      else if (el.type === 'range') {
        el.max = maxBitrate();
        el.value = v;
        paintRange(el);
      } else el.value = v;
    });
    $$('[data-out="bitrate"]', root).forEach((out) => {
      const obj = pop.contains(out) ? state.draft : state.settings;
      if (obj) out.textContent = fmtRate(obj.bitrate);
    });
  }

  function renderSummaries() {
    const s = state.settings;
    $('#rigCfg').textContent = `${RES_SHORT[s.resolution]} · ${s.fps} FPS · ${fmtRate(s.bitrate)}`;
    $('#aQuality').textContent = `${RES_MOBILE[s.resolution]} · ${s.fps} FPS · ${fmtRate(s.bitrate)}`;
    // phone fps chips + preset
    $$('#aFps button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.fps === s.fps)));
    const preset = matchPreset(s);
    $$('#aPreset button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.preset === preset)));
  }

  function saveSettings() { store.set('settings', state.settings); }

  function syncAll() {
    renderBound(document);
    renderSummaries();
  }

  document.addEventListener('input', onBoundChange);
  document.addEventListener('change', onBoundChange);
  function onBoundChange(e) {
    const el = e.target;
    if (!el.matches || !el.matches('[data-bind]')) return;
    const obj = objOf(el);
    if (!obj) return;
    const key = el.dataset.bind;
    if (el.type === 'checkbox') obj[key] = el.checked;
    else if (el.type === 'range') { obj[key] = +el.value; paintRange(el); }
    else obj[key] = el.value;

    // resolution / fps change → recommended bitrate (as the real app does)
    if ((key === 'resolution' || key === 'fps') && e.type === 'change') {
      obj.bitrate = recommendBitrate(obj.resolution, obj.fps);
    }
    if (key === 'unlockBitrate' && !obj.unlockBitrate && obj.bitrate > 80) obj.bitrate = 80;

    if (scopeOf(el) === 'draft') { renderBound(pop); return; }

    saveSettings();
    if (e.type === 'change' || el.type === 'range') syncAll();
    if (e.type === 'change' && el.closest('#view-settings')) savedPing();
  }

  let savedTimer;
  function savedPing() {
    clearTimeout(savedTimer);
    savedTimer = setTimeout(() => toast('Settings saved', 'ok', $('#toasts'), 1600), 250);
  }

  /* ------------------------------------------------------------------
     Navigation (Home / Settings / signed out)
     ------------------------------------------------------------------ */
  function showView(name) {
    if (!state.signedIn && name !== 'signedout') name = 'signedout';
    $$('.view').forEach((v) => { v.hidden = v.dataset.view !== name; });
    $$('.app-nav__item').forEach((b) => {
      const on = b.dataset.nav === name;
      b.classList.toggle('is-active', on);
      if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
    $('.app-nav').style.visibility = name === 'signedout' ? 'hidden' : '';
    $('.user').style.visibility = name === 'signedout' ? 'hidden' : '';
    $('#fab').hidden = name === 'signedout';
    $('.app-body').scrollTop = 0;
  }

  /* ------------------------------------------------------------------
     Focus trap helper
     ------------------------------------------------------------------ */
  const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea, [tabindex]:not([tabindex="-1"])';
  function trapTab(e, container) {
    if (e.key !== 'Tab') return;
    const items = $$(FOCUSABLE, container).filter((el) => el.offsetParent !== null || el === document.activeElement);
    if (!items.length) return;
    const first = items[0], last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  /* ------------------------------------------------------------------
     Stream settings popover
     ------------------------------------------------------------------ */
  const playBtn = $('#playBtn');
  let popOpener = null;

  function openPop(opener) {
    if (launch.active) return;
    closeMenu(); closeChat();
    state.draft = Object.assign({}, state.settings);
    renderBound(pop);
    popLayer.hidden = false;
    document.body.classList.add('pop-open');
    popOpener = opener || playBtn;
    playBtn.setAttribute('aria-expanded', 'true');
    requestAnimationFrame(() => $('#p-res').focus({ preventScroll: true }));
  }
  function closePop({ restoreFocus = true } = {}) {
    if (popLayer.hidden) return;
    popLayer.hidden = true;
    document.body.classList.remove('pop-open');
    state.draft = null;
    playBtn.setAttribute('aria-expanded', 'false');
    if (restoreFocus && popOpener) popOpener.focus();
  }
  function commitPop() {
    Object.assign(state.settings, state.draft);
    saveSettings();
    syncAll();
  }

  playBtn.addEventListener('click', () => {
    if (launch.active) return;
    if (!popLayer.hidden) { closePop(); return; }
    if (state.settings.askEveryLaunch) openPop(playBtn);
    else startLaunch();
  });
  $$('[data-pop-close]').forEach((b) => b.addEventListener('click', () => closePop()));
  $('#startStream').addEventListener('click', () => {
    commitPop();
    closePop({ restoreFocus: false });
    startLaunch();
  });
  pop.addEventListener('keydown', (e) => trapTab(e, pop));

  /* ------------------------------------------------------------------
     The mark: single-line symbol that draws itself
     Geometry: centerlines of Icon_on_Dark.svg (assets/brand/Icon_Line.svg)
     ------------------------------------------------------------------ */
  const MARK = {
    edges: [
      'M43.31 49.65 L43.31 96.54 L2.63 73.06 L2.63 39.37',
      'M43.31 49.65 L2.63 26.14 L43.31 2.83 L72.54 19.73',
      'M43.31 49.65 L83.99 26.14 L83.99 73.06 L54.77 89.94'
    ],
    ring: 'M22.97 51.85 C28.28 54.92 32.59 61.71 32.59 67.02 C32.59 72.34 28.28 74.16 22.97 71.09 C17.66 68.02 13.35 61.23 13.35 55.92 C13.35 50.60 17.66 48.78 22.97 51.85Z',
    square: 'M54.88 57.64 L72.43 47.51 L72.43 65.06 L54.88 75.19 Z',
    cross: ['M43.31 26.14 H26.71', 'M43.31 26.14 H59.91', 'M43.31 26.14 V15.69', 'M43.31 26.14 V36.59']
  };
  const markSVG = () => {
    const p = (cls, d) => `<path class="m-ln ${cls}" pathLength="1" d="${d}"/>`;
    return `<svg viewBox="-3 -3 92.62 105.17" aria-hidden="true" focusable="false">` +
      `<circle class="m-dot" cx="43.31" cy="49.65" r="2.63"/>` +
      MARK.edges.map((d) => p('m-edge', d)).join('') + p('m-ring', MARK.ring) + p('m-sq', MARK.square) +
      MARK.cross.map((d) => p('m-x', d)).join('') + `</svg>`;
  };
  let maskSeq = 0;
  const markOutlineSVG = () => {
    const id = `markCut${++maskSeq}`;
    const lines = (cut) => `<circle class="m-dot" cx="43.31" cy="49.65" r="${cut ? 2.51 : 2.75}"/>` +
      MARK.edges.map((d) => `<path class="m-ln m-edge" pathLength="1" d="${d}"/>`).join('') +
      `<path class="m-ln m-ring" pathLength="1" d="${MARK.ring}"/><path class="m-ln m-sq" pathLength="1" d="${MARK.square}"/>` +
      MARK.cross.map((d) => `<path class="m-ln m-x" pathLength="1" d="${d}"/>`).join('');
    return `<svg viewBox="-3 -3 92.62 105.17" aria-hidden="true" focusable="false"><defs><mask id="${id}" maskUnits="userSpaceOnUse" x="-4" y="-4" width="95" height="108">` +
      `<rect x="-4" y="-4" width="95" height="108" fill="#fff"/><g class="m-cut">${lines(true)}</g></mask></defs>` +
      `<g mask="url(#${id})">${lines(false)}</g></svg>`;
  };
  function buildMark(el, play = true, factory = markSVG) {
    if (!el) return;
    el.classList.add('mark');
    if (!el.firstElementChild) el.innerHTML = factory();
    el.classList.remove('is-build');
    void el.offsetWidth;                       // restart the animation
    if (play && !reduceMotion()) el.classList.add('is-build');
  }
  const BUILD_MS = 1900;

  /* ------------------------------------------------------------------
     Teleport: Play → fold into the cube → stream → back home
     Same timeline every run, so live demos are predictable.
     ------------------------------------------------------------------ */
  const TP = { root: $('#tp'), mark: $('#tpMark'), steps: $$('#tpSteps li'), cfg: $('#tpCfg') };
  const ST = { root: $('#stream'), hello: $('#streamHello'), stats: $('#stats'), toggle: $('#statsToggle'), time: $('#streamTime') };
  const launch = { active: false, timers: [], phase: 'idle', t0: 0, tick: null, idle: null, lastFocus: null };
  const CODEC = { auto: 'HEVC', h264: 'H.264', hevc: 'HEVC', av1: 'AV1' };
  const FPS_WOBBLE = [1, .998, 1, 1, .997, 1, .999, 1];
  const RATE_WOBBLE = [.97, 1, .99, 1.02, .98, 1.01, .99, 1];

  function clearLaunchTimers() { launch.timers.forEach(clearTimeout); launch.timers = []; }
  function later(fn, ms) { launch.timers.push(setTimeout(fn, ms)); }
  const fmtDur = (ms) => { const t = Math.max(0, Math.round(ms / 1000)); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; };
  const setAway = (on) => {
    document.body.classList.toggle('is-away', on);
    ['#stage', '.stage-bar'].forEach((q) => on ? $(q).setAttribute('inert', '') : $(q).removeAttribute('inert'));
  };
  function stepTo(i) {
    TP.steps.forEach((li, n) => { li.classList.toggle('is-done', n < i); li.classList.toggle('is-active', n === i); });
  }

  function startLaunch() {
    if (launch.active) return;               // no duplicate launches
    launch.active = true; launch.phase = 'in';
    clearLaunchTimers();
    closePop({ restoreFocus: false }); closeMenu(); closeChat();
    playBtn.classList.add('is-busy'); playBtn.setAttribute('aria-disabled', 'true');

    const r = playBtn.getBoundingClientRect();
    TP.root.style.setProperty('--x', `${r.left + r.width / 2}px`);
    TP.root.style.setProperty('--y', `${r.top + r.height / 2}px`);
    TP.root.style.setProperty('--dx', `${r.left + r.width / 2 - innerWidth / 2}px`);
    TP.root.style.setProperty('--dy', `${r.top + r.height / 2 - innerHeight / 2}px`);
    const s = state.settings;
    TP.cfg.textContent = `${RES_SHORT[s.resolution]} · ${s.fps} FPS · ${fmtRate(s.bitrate)}`;
    stepTo(-1);
    TP.root.className = 'tp';
    TP.mark.classList.add('mark--glow');
    TP.root.hidden = false;
    void TP.root.offsetWidth;
    TP.root.classList.add('is-open');
    setAway(true);

    const rm = reduceMotion();
    const T = rm ? { load: 0, s1: 350, s2: 700, s3: 1050, turn: 1300, flash: 1300, fade: 1300, done: 1300 }
                 : { load: 320, s1: 1050, s2: 1650, s3: 2250, turn: 2450, flash: 2800, fade: 3150, done: 3600 };
    later(() => { TP.root.classList.add('is-loading'); buildMark(TP.mark); stepTo(0); $('#tpCancel').focus({ preventScroll: true }); }, T.load);
    later(() => stepTo(1), T.s1);
    later(() => stepTo(2), T.s2);
    later(() => stepTo(3), T.s3);
    later(() => { launch.phase = 'turning'; TP.root.classList.add('is-turn'); }, T.turn);
    later(() => { TP.root.classList.add('is-flash'); startSession(); }, T.flash);
    later(() => TP.root.classList.add('is-fade'), T.fade);
    later(() => { TP.root.hidden = true; TP.root.className = 'tp'; launch.phase = 'live'; $('#endStream').focus({ preventScroll: true }); }, T.done);
  }

  function cancelLaunch() {
    if (launch.phase !== 'in') return;
    clearLaunchTimers();
    launch.phase = 'closing';
    TP.root.classList.remove('is-loading');
    TP.root.classList.add('is-closing');
    setAway(false);
    later(() => { finishLaunch(); toast('Launch cancelled. Your stream settings are kept.', 'info'); }, reduceMotion() ? 0 : 600);
  }

  function startSession() {
    const s = state.settings;
    ST.root.className = 'stream';
    ST.root.hidden = false;
    ST.hello.classList.remove('is-quiet');
    ST.stats.hidden = !s.perfStats;
    ST.toggle.setAttribute('aria-pressed', String(!!s.perfStats));
    $('#stRes').textContent = RES_SHORT[s.resolution];
    $('#stDec').textContent = `${CODEC[s.codec]} · ${s.decoder === 'sw' ? 'software' : 'hardware'}`;
    launch.t0 = Date.now();
    let n = 0;
    const paint = () => {
      ST.time.textContent = fmtDur(Date.now() - launch.t0);
      $('#stFps').textContent = `${(Number(s.fps) * FPS_WOBBLE[n % 8]).toFixed(1)} FPS`;
      $('#stRate').textContent = fmtRate(s.bitrate * RATE_WOBBLE[n % 8]);
      $('#stDelay').textContent = `${DELAYS[n % DELAYS.length]} ms`;
      $('#stJitter').textContent = `${JITTERS[n % JITTERS.length]} ms`;
      n++;
    };
    paint();
    launch.tick = setInterval(paint, 1000);
    later(() => ST.hello.classList.add('is-quiet'), reduceMotion() ? 2500 : 3400);
    armIdle(4600);
  }

  function armIdle(ms = 2600) {
    ST.root.classList.remove('is-idle');
    clearTimeout(launch.idle);
    launch.idle = setTimeout(() => { if (launch.phase === 'live' || launch.phase === 'turning') ST.root.classList.add('is-idle'); }, ms);
  }
  ['pointermove', 'pointerdown'].forEach((ev) => ST.root.addEventListener(ev, () => armIdle()));

  function toggleStats() {
    const on = ST.stats.hidden;
    ST.stats.hidden = !on;
    ST.toggle.setAttribute('aria-pressed', String(on));
    state.settings.perfStats = on; saveSettings(); syncAll();
  }

  function endStream() {
    if (!['live', 'turning'].includes(launch.phase)) return;
    clearLaunchTimers();
    launch.phase = 'out';
    clearInterval(launch.tick); clearTimeout(launch.idle);
    const dur = Date.now() - launch.t0;
    const s = state.settings;
    const rm = reduceMotion();

    // the cube waits underneath; the stream collapses into it
    TP.root.className = 'tp';
    TP.root.hidden = false;
    TP.root.querySelector('.tp__veil').style.transition = 'none';
    TP.root.classList.add('is-open');
    void TP.root.offsetWidth;
    TP.root.querySelector('.tp__veil').style.transition = '';
    buildMark(TP.mark, false);
    TP.root.classList.add('is-unturn');
    ST.root.style.zIndex = '650';
    ST.root.classList.add('is-closing');

    later(() => { ST.root.hidden = true; ST.root.style.zIndex = ''; ST.root.className = 'stream'; }, rm ? 0 : 540);
    later(() => { TP.root.classList.add('is-closing'); setAway(false); }, rm ? 0 : 1150);
    later(() => {
      finishLaunch();
      const last = $('#rigLast');
      last.textContent = `Last session ${fmtDur(dur)} · ${RES_SHORT[s.resolution]} at ${s.fps} FPS`;
      last.hidden = false;
      toast(`Stream ended after ${fmtDur(dur)}`, 'ok');
    }, rm ? 0 : 1750);
  }

  function finishLaunch() {
    clearLaunchTimers();
    TP.root.hidden = true; TP.root.className = 'tp';
    ST.root.hidden = true; ST.root.className = 'stream';
    setAway(false);
    playBtn.classList.remove('is-busy'); playBtn.removeAttribute('aria-disabled');
    launch.active = false; launch.phase = 'idle';
    showView('home');
    playBtn.focus({ preventScroll: true });
  }

  $('#tpCancel').addEventListener('click', cancelLaunch);
  $('#endStream').addEventListener('click', endStream);
  ST.toggle.addEventListener('click', toggleStats);
  TP.root.addEventListener('keydown', (e) => trapTab(e, TP.root));
  ST.root.addEventListener('keydown', (e) => trapTab(e, ST.root));
  document.addEventListener('keydown', (e) => {
    if (!launch.active || !(e.ctrlKey && e.altKey && e.shiftKey)) return;
    if (e.code === 'KeyQ') { e.preventDefault(); endStream(); }
    if (e.code === 'KeyS' && launch.phase === 'live') { e.preventDefault(); toggleStats(); }
  });

  /* ------------------------------------------------------------------
     Platforms (desktop grid, brandbook demo, phone list)
     ------------------------------------------------------------------ */
  function platState(id) { return state.connecting[id] ? 'connecting' : state.linked[id] ? 'linked' : 'idle'; }

  const LOGOS = window.T4_LOGOS || {};
  const tileHTML = (id, mono, extra = '') => LOGOS[id]
    ? `<div class="tile tile--logo ${extra}" aria-hidden="true"><img src="${LOGOS[id]}" alt=""></div>`
    : `<div class="tile ${extra}" aria-hidden="true">${mono}</div>`;
  function applyStaticLogos() {
    $$('[data-logo]').forEach((t) => {
      const src = LOGOS[t.dataset.logo]; if (!src) return;
      t.classList.add('tile--logo'); t.innerHTML = `<img src="${src}" alt="">`;
    });
    if (LOGOS.steam) $('#streamBrand').innerHTML = `<img src="${LOGOS.steam}" alt="">`;
  }

  function platRowHTML(p) {
    const st = platState(p.id);
    const label = st === 'linked' ? 'Linked · launches via Steam' : st === 'connecting' ? 'Connecting…' : 'Not connected';
    const btn = st === 'connecting'
      ? `<button type="button" class="btn btn--secondary btn--sm is-loading" disabled aria-busy="true"><span class="spinner"></span>Connecting</button>`
      : st === 'linked'
        ? `<button type="button" class="btn btn--ghost btn--sm" data-plat="${p.id}" data-op="disconnect" aria-label="Disconnect ${p.name}">Disconnect</button>`
        : `<button type="button" class="btn btn--secondary btn--sm" data-plat="${p.id}" data-op="connect" aria-label="Connect ${p.name}">Connect</button>`;
    return `<li class="plat ${st === 'linked' ? 'is-linked' : ''}">
      ${tileHTML(p.id, p.mono)}
      <div class="plat__info"><div class="plat__name">${p.name}</div><div class="plat__state">${st === 'linked' ? '<svg class="ic ic--xs"><use href="#i-check"/></svg>' : ''}${label}</div></div>
      ${btn}</li>`;
  }
  function phoneRowHTML(p) {
    const st = platState(p.id);
    const sub = st === 'linked' ? 'Linked' : st === 'connecting' ? 'Connecting…' : 'Not connected';
    const btn = st === 'connecting' ? `<button class="a-btn a-btn--sm a-btn--link" disabled>…</button>`
      : st === 'linked' ? `<button class="a-btn a-btn--sm a-btn--linked" data-plat="${p.id}" data-op="disconnect" aria-label="Disconnect ${p.name}">Linked</button>`
        : `<button class="a-btn a-btn--sm a-btn--link" data-plat="${p.id}" data-op="connect" aria-label="Connect ${p.name}">Connect</button>`;
    return `<li class="${st === 'linked' ? 'is-linked' : ''}">${tileHTML(p.id, p.mono)}<div class="a-list__txt"><strong>${p.name}</strong><span>${sub}</span></div>${btn}</li>`;
  }
  function renderPlatforms() {
    const focusedKey = document.activeElement?.dataset?.plat ? `${document.activeElement.closest('ul')?.id}:${document.activeElement.dataset.plat}` : null;
    $('#platGrid').innerHTML = PLATFORMS.map(platRowHTML).join('');
    const bb = $('#bbPlat'); if (bb) bb.innerHTML = PLATFORMS.slice(0, 4).map(platRowHTML).join('');
    $('#aPlatList').innerHTML = PLATFORMS.map(phoneRowHTML).join('');
    const n = Object.keys(state.linked).filter((k) => state.linked[k]).length;
    $('#linkedCount').textContent = `${n} of ${PLATFORMS.length} linked`;
    $('#aLinked').textContent = `Steam + ${n} platform${n === 1 ? '' : 's'} linked`;
    if (focusedKey) {
      const [ul, id] = focusedKey.split(':');
      const again = $(`#${ul} [data-plat="${id}"]`); again && again.focus();
    }
  }
  document.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-plat]');
    if (!b) return;
    const p = PLATFORMS.find((x) => x.id === b.dataset.plat);
    const inPhone = !!b.closest('#phone');
    const inBook = !!b.closest('#bookModal');
    const say = (m, k) => inPhone ? snack(m) : toast(m, k, inBook ? $('#bbToasts') : $('#toasts'));
    if (b.dataset.op === 'connect') {
      state.connecting[p.id] = true; renderPlatforms();
      await wait(1300);
      delete state.connecting[p.id]; state.linked[p.id] = true; store.set('linked', state.linked);
      renderPlatforms();
      say(`${p.name} linked (simulated). Its games will launch through Steam.`, 'ok');
    } else {
      delete state.linked[p.id]; store.set('linked', state.linked); renderPlatforms();
      say(`${p.name} disconnected`, 'info');
    }
  });

  /* ------------------------------------------------------------------
     User menu
     ------------------------------------------------------------------ */
  const userBtn = $('#userBtn'), userMenu = $('#userMenu');
  function openMenu() { userMenu.hidden = false; userBtn.setAttribute('aria-expanded', 'true'); $('.menu__item', userMenu).focus(); }
  function closeMenu(focus) { if (userMenu.hidden) return; userMenu.hidden = true; userBtn.setAttribute('aria-expanded', 'false'); if (focus) userBtn.focus(); }
  userBtn.addEventListener('click', () => (userMenu.hidden ? openMenu() : closeMenu()));
  userMenu.addEventListener('keydown', (e) => {
    const items = $$('.menu__item', userMenu); const i = items.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length].focus(); }
    if (e.key === 'ArrowUp') { e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
    if (e.key === 'Tab') closeMenu();
  });
  document.addEventListener('pointerdown', (e) => { if (!userMenu.hidden && !e.target.closest('.user')) closeMenu(); });

  /* ------------------------------------------------------------------
     Support chat
     ------------------------------------------------------------------ */
  const fab = $('#fab'), chat = $('#chat');
  function closeChat(focus) { if (chat.hidden) return; chat.hidden = true; fab.setAttribute('aria-expanded', 'false'); if (focus) fab.focus(); }
  fab.addEventListener('click', () => {
    if (chat.hidden) { chat.hidden = false; fab.setAttribute('aria-expanded', 'true'); $('#chatInput').focus(); } else closeChat();
  });
  $('[data-chat-close]').addEventListener('click', () => closeChat(true));
  $('#chatForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const inp = $('#chatInput'); const v = inp.value.trim(); if (!v) return;
    const log = $('#chatLog');
    const me = document.createElement('p'); me.className = 'bubble bubble--me'; me.textContent = v; log.appendChild(me);
    inp.value = '';
    setTimeout(() => {
      const sys = document.createElement('p'); sys.className = 'bubble bubble--sys';
      sys.textContent = 'Prototype: messages are not sent anywhere. In the live app the support team replies in this thread.';
      log.appendChild(sys); log.scrollTop = log.scrollHeight;
    }, 600);
    log.scrollTop = log.scrollHeight;
  });

  /* ------------------------------------------------------------------
     Global actions
     ------------------------------------------------------------------ */
  document.addEventListener('click', (e) => {
    const nav = e.target.closest('[data-nav]');
    if (nav && !nav.closest('#bookModal')) { closeMenu(); closePop({ restoreFocus: false }); showView(nav.dataset.nav); return; }
    const a = e.target.closest('[data-action]');
    if (!a) return;
    switch (a.dataset.action) {
      case 'open-stream': closeMenu(); showView('home'); openPop(a.closest('.menu') ? playBtn : a); break;
      case 'all-options': closePop({ restoreFocus: false }); showView('settings'); selectSettingsTab($('#st-video')); break;
      case 'sign-out': closeMenu(); state.signedIn = false; showView('signedout'); toast('Signed out', 'info'); break;
      case 'sign-in': state.signedIn = true; showView('home'); toast('Signed in as tulgaa.brandon', 'ok'); break;
      case 'reset-settings':
        state.settings = Object.assign({}, DEFAULTS); saveSettings(); syncAll(); toast('All settings restored to defaults', 'ok'); break;
      case 'open-phone-from-book': closeModal($('#bookModal')); openModal($('#phoneModal')); break;
    }
  });

  /* ------------------------------------------------------------------
     Settings tabs (vertical, roving tabindex)
     ------------------------------------------------------------------ */
  const sTabs = $$('#settingsTabs [role=tab]');
  function selectSettingsTab(tab) {
    sTabs.forEach((t) => {
      const on = t === tab;
      t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1;
      $('#' + t.getAttribute('aria-controls')).hidden = !on;
    });
  }
  sTabs.forEach((t) => t.addEventListener('click', () => selectSettingsTab(t)));
  $('#settingsTabs').addEventListener('keydown', (e) => {
    const i = sTabs.indexOf(document.activeElement); if (i < 0) return;
    let n = null;
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') n = sTabs[(i + 1) % sTabs.length];
    if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') n = sTabs[(i - 1 + sTabs.length) % sTabs.length];
    if (n) { e.preventDefault(); n.focus(); selectSettingsTab(n); }
  });

  /* ------------------------------------------------------------------
     Window controls
     ------------------------------------------------------------------ */
  const win = $('#window'), stage = $('#stage');
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-win]'); if (!b) return;
    switch (b.dataset.win) {
      case 'min': closePop({ restoreFocus: false }); win.classList.add('is-min'); $('#taskChip').hidden = false; $('#taskChip').focus(); break;
      case 'restore': win.classList.remove('is-min'); $('#taskChip').hidden = true; playBtn.focus({ preventScroll: true }); break;
      case 'max': {
        const on = !win.classList.contains('is-max');
        win.classList.toggle('is-max', on); stage.classList.toggle('is-max', on);
        b.setAttribute('aria-label', on ? 'Restore down' : 'Maximize');
        b.querySelector('use').setAttribute('href', on ? '#i-restore' : '#i-max');
        break;
      }
      case 'close': closePop({ restoreFocus: false }); win.hidden = true; $('#closedState').hidden = false; $('[data-win="reopen"]').focus(); break;
      case 'reopen': win.hidden = false; $('#closedState').hidden = true; showView(state.signedIn ? 'home' : 'signedout'); break;
    }
  });

  /* ------------------------------------------------------------------
     Status bar telemetry (gentle live variation)
     ------------------------------------------------------------------ */
  let tick = 0;
  setInterval(() => {
    tick = (tick + 1) % DELAYS.length;
    $('#sbDelay').textContent = `${DELAYS[tick]} ms`;
    $('#sbJitter').textContent = `${JITTERS[tick]} ms`;
  }, 3000);

  /* ------------------------------------------------------------------
     Modals (Android, Brandbook)
     ------------------------------------------------------------------ */
  let modalOpener = null;
  function openModal(m) {
    if (launch.active) return;
    closePop({ restoreFocus: false }); closeMenu(); closeChat();
    modalOpener = document.activeElement;
    m.hidden = false;
    document.body.style.overflow = 'hidden';
    $('#stage').setAttribute('inert', '');
    if (m.id === 'bookModal') { ensureBook(); $('#bookScroll').focus({ preventScroll: true }); startLoopMarks(); }
    else { const first = $('.modal__x', m); first && first.focus(); }
  }
  // the animated-symbol tile in the brandbook replays while the book is open
  let loopTimer = null;
  function startLoopMarks() {
    clearInterval(loopTimer);
    if (reduceMotion()) return;
    loopTimer = setInterval(() => $$('[data-loop-mark]').forEach((f) => buildMark(f)), 3600);
  }
  function closeModal(m) {
    if (m.hidden) return;
    if (m.id === 'bookModal') clearInterval(loopTimer);
    m.hidden = true;
    $('#stage').removeAttribute('inert');
    if (modalOpener && document.contains(modalOpener)) modalOpener.focus();
  }
  $('#openPhone').addEventListener('click', () => openModal($('#phoneModal')));
  $('#openBrandbook').addEventListener('click', () => openModal($('#bookModal')));
  $$('.modal').forEach((m) => {
    $$('[data-modal-close]', m).forEach((b) => b.addEventListener('click', (e) => {
      if (b.classList.contains('modal__scrim') && e.target !== b) return;
      closeModal(m);
    }));
    m.addEventListener('keydown', (e) => trapTab(e, m));
  });

  /* ------------------------------------------------------------------
     Android app
     ------------------------------------------------------------------ */
  const phone = $('#phone');
  function aTab(name) {
    if (!state.phoneSignedIn) name = 'signedout';
    $$('.a-screen', phone).forEach((s) => { s.hidden = s.dataset.ascreen !== name; });
    $$('.a-nav button', phone).forEach((b) => {
      const on = b.dataset.atab === name; b.classList.toggle('is-active', on);
      if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
    $('.a-nav', phone).style.display = name === 'signedout' ? 'none' : '';
    const sc = $(`.a-screen[data-ascreen="${name}"] .a-scroll`, phone); if (sc) sc.scrollTop = 0;
  }
  phone.addEventListener('click', (e) => {
    const t = e.target.closest('[data-atab]'); if (t) aTab(t.dataset.atab);
  });

  let snackTimer;
  function snack(msg) {
    const s = $('#aSnack'); s.textContent = msg; s.hidden = false;
    clearTimeout(snackTimer); snackTimer = setTimeout(() => { s.hidden = true; }, 2600);
  }

  // fps chips
  $('#aFps').innerHTML = ['30', '60', '90', '120'].map((f) => `<button type="button" role="radio" aria-checked="false" data-fps="${f}">${f}</button>`).join('');
  $('#aFps').addEventListener('click', (e) => {
    const b = e.target.closest('[data-fps]'); if (!b) return;
    state.settings.fps = b.dataset.fps;
    state.settings.bitrate = recommendBitrate(state.settings.resolution, state.settings.fps);
    saveSettings(); syncAll();
  });
  // presets
  const PRESETS = { saver: { resolution: '720', fps: '30' }, balanced: { resolution: '1080', fps: '60' }, max: { resolution: 'native', fps: '120' } };
  function matchPreset(s) {
    for (const [k, p] of Object.entries(PRESETS)) if (p.resolution === s.resolution && p.fps === s.fps) return k;
    return null;
  }
  $('#aPreset').addEventListener('click', (e) => {
    const b = e.target.closest('[data-preset]'); if (!b) return;
    Object.assign(state.settings, PRESETS[b.dataset.preset]);
    state.settings.bitrate = recommendBitrate(state.settings.resolution, state.settings.fps);
    saveSettings(); syncAll();
    snack(`${b.textContent} · ${RES_MOBILE[state.settings.resolution]} at ${state.settings.fps} FPS`);
  });

  // connection test (scripted, same result every time)
  $('#aTest').addEventListener('click', async (e) => {
    const b = e.currentTarget; b.disabled = true; b.textContent = 'Testing…';
    const dd = ['#aDelay', '#aJitter', '#aLoss'].map((s) => $(s));
    dd.forEach((d) => { d.classList.add('is-testing'); d.textContent = '—'; });
    $('#aVerdict').textContent = 'Measuring the route to Tesseract-Dev…';
    await wait(1600);
    $('#aDelay').textContent = '8 ms'; $('#aJitter').textContent = '4 ms'; $('#aLoss').textContent = '0 %';
    dd.forEach((d) => d.classList.remove('is-testing'));
    $('#aVerdict').textContent = 'Good for 1440p at 60 FPS or 1080p at 120 FPS.';
    b.disabled = false; b.textContent = 'Test again';
    snack('Connection test complete');
  });

  // sign out / in
  $('#aSignOut').addEventListener('click', () => { state.phoneSignedIn = false; aTab('signedout'); });
  $('#aSignIn').addEventListener('click', () => { state.phoneSignedIn = true; aTab('home'); snack('Signed in as tulgaa.brandon'); });

  // phone launch → bottom sheet with the build → live screen → end
  const sheet = { el: $('#aSheet'), timers: [], active: false, t0: 0, tick: null };
  const screen = $('.phone__screen');
  function phoneLaunch() {
    if (sheet.active) return;
    sheet.active = true;
    sheet.timers.forEach(clearTimeout); sheet.timers = [];
    sheet.el.hidden = false;
    buildMark($('#aMark'));
    const bar = $('#aSheetBar'); bar.style.transition = 'none'; bar.style.width = '0'; void bar.offsetWidth; bar.style.transition = '';
    const steps = [[0, 15, 'Waking your rig'], [700, 48, 'Starting Steam'], [1400, 82, 'Connecting the stream'], [2000, 100, 'Connected']];
    steps.forEach(([t, p, m]) => sheet.timers.push(setTimeout(() => { bar.style.width = p + '%'; $('#aSheetDetail').textContent = m; }, t)));
    sheet.timers.push(setTimeout(startPhoneLive, 2400));
    $('[data-asheet-close]', $('#aSheetLoading')).focus();
  }
  function startPhoneLive() {
    sheet.el.hidden = true;
    $('#aLive').hidden = false; screen.classList.add('is-live');
    const s = state.settings;
    sheet.t0 = Date.now();
    let n = 0;
    const paint = () => {
      $('#aLiveTime').textContent = fmtDur(Date.now() - sheet.t0);
      $('#aLiveStats').textContent = `${RES_MOBILE[s.resolution]} · ${s.fps} FPS · ${DELAYS[n++ % DELAYS.length]} ms`;
    };
    paint(); sheet.tick = setInterval(paint, 1000);
    $('#aEnd').focus();
  }
  function endPhoneLive() {
    clearInterval(sheet.tick);
    const dur = Date.now() - sheet.t0;
    $('#aLive').hidden = true; screen.classList.remove('is-live');
    sheet.active = false;
    snack(`Stream ended after ${fmtDur(dur)}`);
    $('#aPlay').focus();
  }
  function closeSheet() {
    sheet.timers.forEach(clearTimeout); sheet.timers = [];
    sheet.el.hidden = true; sheet.active = false; $('#aPlay').focus();
  }
  $('#aPlay').addEventListener('click', phoneLaunch);
  $('#aEnd').addEventListener('click', endPhoneLive);
  $$('[data-asheet-close]').forEach((b) => b.addEventListener('click', closeSheet));

  // clock
  const clock = () => { const d = new Date(); $('#aClock').textContent = `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`; };
  clock(); setInterval(clock, 30000);

  /* ------------------------------------------------------------------
     Brandbook
     ------------------------------------------------------------------ */
  let bookReady = false;
  function ensureBook() {
    if (bookReady) return;
    bookReady = true;
    const scroll = $('#bookScroll');
    scroll.appendChild($('#bookTpl').content.cloneNode(true));
    renderPlatforms();
    // section index → scroll inside the modal
    $$('#bookIndex a').forEach((a) => a.addEventListener('click', (e) => {
      e.preventDefault();
      const target = $(a.getAttribute('href'), scroll);
      scroll.scrollTo({ top: target.offsetTop - 8, behavior: reduceMotion() ? 'auto' : 'smooth' });
      target.setAttribute('tabindex', '-1'); target.focus({ preventScroll: true });
    }));
    // scroll spy
    const links = new Map($$('#bookIndex a').map((a) => [a.getAttribute('href').slice(1), a]));
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) {
          links.forEach((l) => l.classList.remove('is-current'));
          links.get(en.target.id)?.classList.add('is-current');
        }
      });
    }, { root: scroll, rootMargin: '-35% 0px -60% 0px' });
    $$('.bb-sec', scroll).forEach((s) => io.observe(s));

    renderDownloads(scroll);
    renderDownloads($('.book__nav'));

    // storyboard frames (static) and the looping logo tile
    $$('.bb-frame', scroll).forEach((f) => buildMark(f, false));
    $$('[data-loop-mark]', scroll).forEach((f) => { f.classList.add('mark--glow'); buildMark(f); });

    // motion demo
    const bbMark = $('#bbMark', scroll);
    bbMark.classList.add('mark--glow');
    buildMark(bbMark);
    $('#bbReplay', scroll).addEventListener('click', () => buildMark(bbMark));

    // demo: tabs
    $$('[data-demo-tabs]', scroll).forEach((list) => {
      const tabs = $$('[role=tab]', list);
      const out = list.parentElement.querySelector('[data-demo-tabout]');
      const select = (t) => { tabs.forEach((x) => { x.setAttribute('aria-selected', String(x === t)); x.tabIndex = x === t ? 0 : -1; }); out.textContent = `Selected: ${t.textContent}`; };
      tabs.forEach((t) => t.addEventListener('click', () => select(t)));
      list.addEventListener('keydown', (e) => {
        const en = tabs.filter((t) => !t.disabled); const i = en.indexOf(document.activeElement); if (i < 0) return;
        let n = null;
        if (e.key === 'ArrowRight') n = en[(i + 1) % en.length];
        if (e.key === 'ArrowLeft') n = en[(i - 1 + en.length) % en.length];
        if (n) { e.preventDefault(); n.focus(); select(n); }
      });
    });
    // demo: segmented + nav
    $$('[data-demo-seg]', scroll).forEach((g) => g.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return; $$('button', g).forEach((x) => x.setAttribute('aria-checked', String(x === b)));
    }));
    $$('[data-demo-anav]', scroll).forEach((g) => g.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return; $$('button', g).forEach((x) => x.classList.toggle('is-active', x === b));
    }));
    $$('.bb-navdemo', scroll).forEach((g) => g.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return; $$('button', g).forEach((x) => x.classList.toggle('is-active', x === b));
    }));
    // demo: range
    const r = $('#bbRange', scroll); paintRange(r);
    r.addEventListener('input', () => { paintRange(r); r.nextElementSibling.textContent = fmtRate(r.value); });
    // demo: loading button
    $$('[data-demo="loading"]', scroll).forEach((b) => b.addEventListener('click', (e) => e.preventDefault()));
    // demo: toasts
    const msgs = { ok: 'Epic Games linked', warn: 'Connection is unstable: bitrate lowered to 12 Mbps', err: 'Rig Tesseract-Dev is offline' };
    $$('[data-demo-toast]', scroll).forEach((b) => b.addEventListener('click', () => toast(msgs[b.dataset.demoToast], b.dataset.demoToast, $('#bbToasts', scroll), 3000)));
    // demo: dialog
    const dlg = $('#bbDialog', scroll);
    let dlgOpener;
    $('[data-demo-dialog]', scroll).addEventListener('click', (e) => { dlgOpener = e.currentTarget; dlg.hidden = false; $('[data-dlg-close]', dlg).focus(); });
    $$('[data-dlg-close]', dlg).forEach((b) => b.addEventListener('click', () => { dlg.hidden = true; dlgOpener.focus(); }));
    dlg.addEventListener('click', (e) => { if (e.target === dlg) { dlg.hidden = true; dlgOpener.focus(); } });
  }


  /* ------------------------------------------------------------------
     Brandbook downloads: every asset gets a format menu
     On GitHub Pages / locally a plain download link does the work.
     Inside the claude.ai artifact viewer, files go through the
     `downloads` capability, which asks the viewer to confirm.
     ------------------------------------------------------------------ */
  const DLS = window.T4_DOWNLOADS || {};
  let openDl = null;
  function renderDownloads(root) {
    $$('[data-dl]', root).forEach((host) => {
      const a = DLS[host.dataset.dl]; if (!a || host.firstChild) return;
      const id = `dl-${Math.random().toString(36).slice(2, 8)}`;
      const primary = host.classList.contains('dl--primary');
      const single = a.files.length === 1;
      host.innerHTML = `
        <button type="button" class="dl__btn" aria-haspopup="${single ? 'false' : 'menu'}" aria-expanded="false" ${single ? '' : `aria-controls="${id}"`} aria-label="Download ${a.name}">
          <svg class="ic ic--sm" aria-hidden="true"><use href="#i-dl"/></svg><span>${primary ? `Download ${single ? a.files[0].fmt : ''} · ${a.files[0].size}` : 'Download'}</span>${single ? '' : '<svg class="ic ic--sm dl__chev" aria-hidden="true"><use href="#i-chev"/></svg>'}
        </button>
        ${single ? '' : `<div class="dl__menu" id="${id}" role="menu" aria-label="${a.name} formats" hidden>
          <p class="dl__title">${a.name}</p>
          ${a.files.map((f) => `<a role="menuitem" class="dl__item" href="${f.href}" download="${f.file}" data-file="${f.file}"><b>${f.fmt}</b><span>${f.note}</span><em>${f.size}</em></a>`).join('')}
        </div>`}`;
      if (single) host.querySelector('.dl__btn').addEventListener('click', () => saveFile(a.files[0]));
    });
    $$('[data-dl-fmts]', root).forEach((el) => {
      const a = DLS[el.dataset.dlFmts]; if (!a) return;
      el.innerHTML = [...new Set(a.files.map((f) => f.fmt))].map((f) => `<span>${f}</span>`).join('');
    });
  }
  function closeDl(focus) {
    if (!openDl) return;
    const m = openDl.querySelector('.dl__menu'); m.hidden = true;
    openDl.querySelector('.dl__btn').setAttribute('aria-expanded', 'false');
    openDl.classList.remove('is-open');
    if (focus) openDl.querySelector('.dl__btn').focus();
    openDl = null;
  }
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.dl__btn');
    if (btn && btn.getAttribute('aria-haspopup') === 'menu') {
      const host = btn.closest('.dl');
      if (openDl === host) { closeDl(); return; }
      closeDl();
      const m = host.querySelector('.dl__menu'); m.hidden = false; host.classList.add('is-open');
      btn.setAttribute('aria-expanded', 'true'); openDl = host;
      // open upward / leftward when there is no room
      const r = m.getBoundingClientRect();
      host.classList.toggle('dl--flipX', r.right > innerWidth - 8);
      host.classList.toggle('dl--flipY', r.bottom > innerHeight - 8 && !host.classList.contains('dl--up'));
      m.querySelector('.dl__item').focus();
      return;
    }
    const item = e.target.closest('.dl__item');
    if (item) {
      const host = item.closest('.dl'); const a = DLS[host.dataset.dl];
      const f = a.files.find((x) => x.file === item.dataset.file);
      if (window.claude?.use) { e.preventDefault(); saveFile(f); }
      else toast(`Downloading ${f.file}`, 'ok', $('#bookModal').hidden ? $('#toasts') : bookToastHost());
      closeDl(); return;
    }
    if (openDl && !e.target.closest('.dl')) closeDl();
  });
  document.addEventListener('keydown', (e) => {
    if (!openDl) return;
    const items = $$('.dl__item', openDl); const i = items.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length].focus(); }
    if (e.key === 'ArrowUp') { e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
    if (e.key === 'Tab') closeDl();
  });
  const bookToastHost = () => {
    let h = $('#bookToasts');
    if (!h) { h = document.createElement('div'); h.id = 'bookToasts'; h.className = 'toasts toasts--book'; h.setAttribute('aria-live', 'polite'); $('.book').appendChild(h); }
    return h;
  };
  // The claude.ai preview can't host .zip/.ase files, so they are rebuilt here when a plain fetch fails.
  const BUILD = window.T4_DOWNLOADS_BUILD || { embed: {}, text: {}, zips: {} };
  const b64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  let jszip = null;
  function loadJSZip() {
    if (window.JSZip) return Promise.resolve(window.JSZip);
    return jszip || (jszip = new Promise((ok, no) => {
      const sc = document.createElement('script');
      sc.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
      sc.onload = () => ok(window.JSZip); sc.onerror = no; document.head.appendChild(sc);
    }));
  }
  async function partBlob(src) {
    if (src.startsWith('text:')) return new Blob([BUILD.text[src.slice(5)]]);
    const name = src.split('/').pop();
    if (BUILD.embed[name]) return new Blob([b64(BUILD.embed[name])]);
    const r = await fetch(src); if (!r.ok) throw new Error('missing ' + src); return r.blob();
  }
  async function fileBlob(f) {
    if (BUILD.embed[f.file]) return new Blob([b64(BUILD.embed[f.file])]);
    try { const r = await fetch(f.href); if (r.ok) return await r.blob(); } catch { /* fall through */ }
    let recipe = BUILD.zips[f.file];
    if (!recipe) throw { code: 'missing' };
    if (recipe === 'kit') {
      recipe = [];
      Object.values(DLS).forEach((a) => a.files.forEach((x) => {
        if (x.file.endsWith('.zip')) return;
        const rel = x.href.replace('assets/downloads/', '');
        if (!recipe.some((r) => r[1].endsWith(rel))) recipe.push([x.href, 'Tesseract brand kit/' + rel]);
      }));
      BUILD.zips['manrope-ttf.zip'].forEach(([src, name]) => recipe.push([src, 'Tesseract brand kit/fonts/' + name]));
      recipe.push(['text:Tesseract brand kit/README.txt', 'Tesseract brand kit/README.txt']);
    }
    const JSZip = await loadJSZip();
    const zip = new JSZip();
    for (const [src, name] of recipe) zip.file(name, await partBlob(src));
    return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  }

  async function saveFile(f) {
    const host = $('#bookModal').hidden ? $('#toasts') : bookToastHost();
    if (!window.claude?.use) {               // regular website: plain download link
      const a = document.createElement('a'); a.href = f.href; a.download = f.file; document.body.appendChild(a); a.click(); a.remove();
      toast(`Downloading ${f.file}`, 'ok', host); return;
    }
    const downloads = await window.claude.use('downloads');
    if (!downloads) { toast('Downloads aren\'t available in this view. Open the GitHub Pages version to download.', 'warn', host, 4200); return; }
    try {
      if (f.file.endsWith('.zip')) toast(`Preparing ${f.file}…`, 'info', host, 1800);
      const blob = await fileBlob(f);
      const r = await downloads.save({ filename: f.file, data: blob });
      if (r.status === 'saved') toast(`Saved ${f.file}`, 'ok', host);
    } catch (err) {
      const code = err && err.code;
      if (code === 'declined') return;
      if (code === 'rejected_extension' || code === 'extension_not_enabled') toast(`${f.fmt} files can't be saved from this preview. Get it in the complete brand kit (ZIP).`, 'warn', host, 4600);
      else if (code === 'rate_limited') toast('Another download is waiting for confirmation.', 'info', host);
      else toast('That download didn\'t go through. Try again.', 'err', host);
    }
  }

  /* ------------------------------------------------------------------
     Escape: innermost layer first
     ------------------------------------------------------------------ */
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (openDl) { closeDl(true); return; }
    if (launch.active) {
      e.preventDefault();
      if (launch.phase === 'in') cancelLaunch();
      // in a stream Escape belongs to the game: show how to leave instead
      else if (launch.phase === 'live') { armIdle(); ST.root.classList.remove('is-shake'); void ST.root.offsetWidth; ST.root.classList.add('is-shake'); }
      return;
    }
    const dlg = $('#bbDialog');
    if (dlg && !dlg.hidden) { dlg.hidden = true; $('[data-demo-dialog]').focus(); return; }
    if (!$('#phoneModal').hidden) {
      if (!$('#aLive').hidden) { endPhoneLive(); return; }
      if (!sheet.el.hidden) { closeSheet(); return; }
      closeModal($('#phoneModal')); return;
    }
    if (!$('#bookModal').hidden) { closeModal($('#bookModal')); return; }
    if (!popLayer.hidden) { closePop(); return; }
    if (!userMenu.hidden) { closeMenu(true); return; }
    if (!chat.hidden) { closeChat(true); }
  });

  /* ------------------------------------------------------------------
     Init
     ------------------------------------------------------------------ */
  fillSelects();
  applyStaticLogos();
  syncAll();
  renderPlatforms();
  showView('home');
  aTab('home');

  // boot: the symbol builds, the wordmark arrives, the app opens
  (function boot() {
    const el = $('#boot'); if (!el) return;
    const mk = $('.boot__mark', el);
    mk.classList.add('mark--glow');
    const rm = reduceMotion();
    buildMark(mk);
    const timers = [];
    let done = false;
    const finish = () => {
      if (done) return; done = true;
      timers.forEach(clearTimeout);
      el.classList.add('is-type', 'is-done');
      win.classList.add('is-entering');
      setTimeout(() => { el.hidden = true; win.classList.remove('is-entering'); }, 650);
      playBtn.focus({ preventScroll: true });
      removeEventListener('keydown', finish); el.removeEventListener('pointerdown', finish);
    };
    timers.push(setTimeout(() => el.classList.add('is-type'), rm ? 0 : BUILD_MS));
    timers.push(setTimeout(finish, rm ? 700 : BUILD_MS + 900));
    addEventListener('keydown', finish); el.addEventListener('pointerdown', finish);
  })();
})();
