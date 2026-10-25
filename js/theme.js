/* ==========================================================================
   Brand color explorer
   One base color drives every brand token: buttons, glows, gradients, tints,
   the logo and pattern SVGs, the animated symbol, the phone and the brandbook.
   Tesseract Violet (#A700FF) keeps its exact official values.
   ========================================================================== */
(() => {
  'use strict';

  const INK = '#111513', WHITE = '#FFFFFF', BLACK = '#000000';
  const OFFICIAL_HEX = '#A700FF';

  /* Twelve candidates for a dark, gaming-first product. Notes flag where a
     color overlaps a well-known platform or an interface status color. */
  const PRESETS = [
    { id: 'violet', name: 'Tesseract Violet', hex: '#A700FF', note: 'The current brand color, from the logo files. Saturated and unusual. Twitch purple (#9146FF) is its nearest neighbour in gaming.' },
    { id: 'ultraviolet', name: 'Ultraviolet', hex: '#7C3AFF', note: 'A cooler, bluer violet. Calmer and more technical, but it sits between Twitch purple and Discord blurple.' },
    { id: 'orchid', name: 'Orchid', hex: '#C13BFF', note: 'A pinker violet. Keeps the identity and adds warmth, moving it further from Twitch.' },
    { id: 'magenta', name: 'Magenta', hex: '#F0168C', note: 'Rare among gaming platforms and loud on dark backgrounds. Strong recall, strong opinions.' },
    { id: 'neon-pink', name: 'Neon Pink', hex: '#FF4FA3', note: 'Playful and arcade-like. Friendlier than magenta; reads younger.' },
    { id: 'crimson', name: 'Crimson', hex: '#FF2E4D', note: 'Competitive esports energy. Shares ground with gaming hardware reds, and red also means "error" in the interface.' },
    { id: 'ember', name: 'Ember', hex: '#FF6A1A', note: 'Warm and fast. No major streaming platform owns orange. Buttons need dark text.' },
    { id: 'amber', name: 'Amber', hex: '#FFB21E', note: 'Premium and distinctive, like hardware status lights. Buttons need dark text; close to the warning color.' },
    { id: 'volt', name: 'Volt', hex: '#C6FF1A', note: 'Maximum energy. Neighbours gaming-hardware greens; buttons need dark text.' },
    { id: 'mint', name: 'Mint', hex: '#19E6A0', note: 'Fresh and technical. Close to the "online / ready" green, so status colors would need to change.' },
    { id: 'cyan', name: 'Cyan', hex: '#1EC8FF', note: 'Cool, clean, "cloud". Very legible on dark; common across cloud-gaming brands.' },
    { id: 'cobalt', name: 'Cobalt', hex: '#3D6BFF', note: 'Trustworthy and familiar, but PlayStation and Steam already live in blue.' }
  ];

  const OFFICIAL_TOKENS = {
    'brand-violet': '#A700FF', 'brand-violet-deep': '#7B19C9', 'brand-hover': '#B42BFF', 'brand-press': '#8E00DA',
    'brand-panel-a': '#8711D8', 'brand-100': '#E8CCFF', 'brand-shadow': '#2B0D3D', 'brand-night': '#1C0B2A',
    'brand-night-2': '#2A1640', 'brand-night-3': '#3A0D5A', 'violet-300': '#C77DFF', 'on-brand': '#FFFFFF',
    'brand-rgb': '167 0 255', 'brand-300-rgb': '199 125 255', 'brand-deep-rgb': '120 20 190', 'brand-shade-rgb': '70 8 115', 'brand-night-rgb': '28 6 44'
  };

  /* ---------- color math ---------- */
  const norm = (h) => {
    h = String(h || '').trim().replace(/^#?/, '#');
    if (/^#[0-9a-f]{3}$/i.test(h)) h = '#' + h.slice(1).split('').map((c) => c + c).join('');
    return /^#[0-9a-f]{6}$/i.test(h) ? h.toUpperCase() : null;
  };
  const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const hex = (r) => '#' + r.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('').toUpperCase();
  const mix = (a, b, t) => { const A = rgb(a), B = rgb(b); return hex(A.map((v, i) => v + (B[i] - v) * t)); };
  const lum = (h) => {
    const c = rgb(h).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const trip = (h) => rgb(h).join(' ');

  function derive(base) {
    if (base === OFFICIAL_HEX) return { ...OFFICIAL_TOKENS };
    // deep: dark enough to carry white type and to sit on white
    let t = 0.25, deep = mix(base, BLACK, t);
    while (contrast(deep, WHITE) < 4.6 && t < 0.9) { t += 0.04; deep = mix(base, BLACK, t); }
    // 300: light enough to be read as text on Ink
    let u = 0.3, v300 = mix(base, WHITE, u);
    while (contrast(v300, INK) < 6.5 && u < 0.95) { u += 0.04; v300 = mix(base, WHITE, u); }
    // text on a brand fill: whichever of white or ink reads better
    const onBrand = contrast(WHITE, base) >= contrast(INK, base) ? WHITE : INK;
    const tint = (k) => mix(INK, base, k);
    return {
      'brand-violet': base, 'brand-violet-deep': deep,
      'brand-hover': mix(base, WHITE, 0.16), 'brand-press': mix(base, BLACK, 0.15),
      'brand-panel-a': mix(base, deep, 0.45), 'brand-100': mix(base, WHITE, 0.78),
      'brand-shadow': tint(0.22), 'brand-night': tint(0.12), 'brand-night-2': tint(0.2), 'brand-night-3': tint(0.3),
      'violet-300': v300, 'on-brand': onBrand,
      'brand-rgb': trip(base), 'brand-300-rgb': trip(v300), 'brand-deep-rgb': trip(mix(base, BLACK, 0.22)),
      'brand-shade-rgb': trip(mix(base, BLACK, 0.55)), 'brand-night-rgb': trip(tint(0.18))
    };
  }

  /* ---------- state ---------- */
  const store = {
    get() { try { return JSON.parse(localStorage.getItem('t4:brand') || 'null'); } catch { return null; } },
    set(v) { try { localStorage.setItem('t4:brand', JSON.stringify(v)); } catch { /* ignore */ } }
  };
  const saved = store.get();
  const state = { hex: norm(saved?.hex) || OFFICIAL_HEX, id: saved?.id || 'violet', tokens: null };
  const isOfficial = () => state.hex === OFFICIAL_HEX;
  const presetOf = () => PRESETS.find((p) => p.hex === state.hex);
  const nameOf = () => presetOf()?.name || 'Custom';

  /* ---------- SVG recoloring (logos, pattern, line symbol) ---------- */
  const RECOLOR = /assets\/brand\/(Icon_on_Dark|Icon_on_Light|Logo_on_Dark|Logo_on_Light|Short_Logo_on_Dark|Short_Logo_on_Light|Pattern|Icon_Line)\.svg$/;
  const textCache = new Map();
  const blobCache = new Map();
  const fetchText = (url) => {
    if (!textCache.has(url)) textCache.set(url, fetch(url).then((r) => (r.ok ? r.text() : Promise.reject(r.status))));
    return textCache.get(url);
  };
  const recolorSvg = (txt, tk = state.tokens) => txt.replace(/#a700ff/gi, tk['brand-violet']).replace(/#7b19c9/gi, tk['brand-violet-deep']);
  async function brandURL(url) {
    const key = url + '|' + state.hex;
    if (!blobCache.has(key)) {
      blobCache.set(key, fetchText(url).then((t) => URL.createObjectURL(new Blob([recolorSvg(t)], { type: 'image/svg+xml' }))));
    }
    return blobCache.get(key);
  }
  async function paintImg(img) {
    const orig = img.dataset.brandSrc || img.getAttribute('src');
    if (!orig || !RECOLOR.test(orig)) return;
    img.dataset.brandSrc = orig;
    if (isOfficial()) { if (img.getAttribute('src') !== orig) img.src = orig; return; }
    const want = state.hex;
    try { const u = await brandURL(orig); if (state.hex === want) img.src = u; } catch { /* file:// or offline: keep original */ }
  }
  const paintAll = (root = document) => root.querySelectorAll('img').forEach(paintImg);

  async function paintPattern() {
    const root = document.documentElement;
    if (isOfficial()) { root.style.removeProperty('--pattern-img'); return; }
    try { root.style.setProperty('--pattern-img', `url("${await brandURL('assets/brand/Pattern.svg')}")`); } catch { /* keep default */ }
  }
  async function paintFavicon() {
    const link = document.querySelector('link[rel="icon"]'); if (!link) return;
    link.dataset.brandSrc = link.dataset.brandSrc || link.getAttribute('href');
    if (isOfficial()) { link.href = link.dataset.brandSrc; return; }
    try { link.href = await brandURL(link.dataset.brandSrc); } catch { /* keep */ }
  }

  /* ---------- live text in the brandbook ---------- */
  const tokenOrHex = (v) => (v.startsWith('#') ? v : state.tokens[v]);
  function paintText(root = document) {
    root.querySelectorAll('[data-brand-status]').forEach((el) => { el.hidden = isOfficial(); const b = el.querySelector('b'); if (b) b.textContent = `${nameOf()} ${state.hex}`; });
    root.querySelectorAll('[data-hex]').forEach((el) => { el.textContent = state.tokens[el.dataset.hex] || el.textContent; });
    root.querySelectorAll('[data-name]').forEach((el) => {
      const n = nameOf();
      el.textContent = el.dataset.name === 'deep' ? (isOfficial() ? 'Deep Violet' : `Deep ${n}`) : n;
    });
    root.querySelectorAll('[data-contrast]').forEach((el) => {
      const [a, b] = el.dataset.contrast.split(',');
      el.textContent = contrast(tokenOrHex(a), tokenOrHex(b)).toFixed(1);
    });
    root.querySelectorAll('[data-onbrand-label]').forEach((el) => {
      const span = el.querySelector('[data-contrast]');
      el.textContent = `${state.tokens['on-brand'] === WHITE ? 'White' : 'Ink'} on ${isOfficial() ? 'Violet' : nameOf()} · `;
      el.appendChild(span); el.append(':1');
    });
  }

  /* ---------- apply ---------- */
  function apply(h, { save = true } = {}) {
    h = norm(h); if (!h) return;
    state.hex = h; state.tokens = derive(h);
    const root = document.documentElement;
    Object.entries(state.tokens).forEach(([k, v]) => {
      if (isOfficial()) root.style.removeProperty('--' + k); else root.style.setProperty('--' + k, v);
    });
    root.dataset.brand = presetOf()?.id || 'custom';
    if (save) store.set({ hex: h, id: presetOf()?.id || 'custom' });
    paintAll(); paintPattern(); paintFavicon(); paintText();
    renderPanel();
    document.dispatchEvent(new CustomEvent('t4:brand', { detail: { hex: h, official: isOfficial(), name: nameOf() } }));
  }

  // new content (brandbook template, platform rows) gets painted as it arrives
  new MutationObserver((muts) => {
    muts.forEach((m) => m.addedNodes.forEach((n) => {
      if (n.nodeType !== 1) return;
      if (n.tagName === 'IMG') paintImg(n); else { paintAll(n); paintText(n); }
    }));
  }).observe(document.documentElement, { childList: true, subtree: true });

  /* ---------- downloads in the previewed color ---------- */
  const DL_RECOLOR = /assets\/downloads\/(logos|graphics|motion)\/.+\.(svg|png)$/;
  const recolorable = (f) => !isOfficial() && DL_RECOLOR.test(f.href);
  async function recolorDownload(f) {
    if (!recolorable(f)) return null;
    const svgHref = f.href.replace(/\.png$/, '.svg');
    const src = await fetchText(svgHref);
    if (!/#a700ff|#7b19c9/i.test(src)) return null;           // white / outline art: original is correct
    const svg = recolorSvg(src);
    const file = f.file.replace(/\.(svg|png)$/, `-${presetOf()?.id || 'custom-' + state.hex.slice(1).toLowerCase()}.$1`);
    if (f.href.endsWith('.svg')) return { blob: new Blob([svg], { type: 'image/svg+xml' }), file };
    // PNG: render the recolored vector at the original PNG's pixel size
    const size = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok([i.naturalWidth, i.naturalHeight]); i.onerror = no; i.src = f.href; });
    const sized = svg.replace(/<svg\b/, `<svg width="${size[0]}" height="${size[1]}"`);
    const url = URL.createObjectURL(new Blob([sized], { type: 'image/svg+xml' }));
    const img = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = url; });
    const c = document.createElement('canvas'); c.width = size[0]; c.height = size[1];
    c.getContext('2d').drawImage(img, 0, 0, size[0], size[1]);
    URL.revokeObjectURL(url);
    const blob = await new Promise((ok) => c.toBlob(ok, 'image/png'));
    return { blob, file };
  }

  /* ---------- the picker ---------- */
  let panel, btn, opener;
  function renderPanel() {
    if (!panel) return;
    const p = presetOf();
    panel.querySelectorAll('.bp__sw').forEach((b) => {
      const on = b.dataset.sw === state.hex;
      b.setAttribute('aria-checked', String(on)); b.tabIndex = on || (!p && b.dataset.sw === OFFICIAL_HEX) ? 0 : -1;
    });
    panel.querySelector('#bpName').textContent = nameOf();
    panel.querySelector('#bpHex').textContent = state.hex;
    panel.querySelector('#bpNote').textContent = p ? p.note : 'Your own color. Check the contrast figures below before committing to it.';
    panel.querySelector('#bpCustom').value = state.hex.toLowerCase();
    const hexIn = panel.querySelector('#bpHexIn'); if (document.activeElement !== hexIn) hexIn.value = state.hex;
    panel.querySelector('#bpCustomWrap').classList.toggle('is-on', !p);
    const tk = state.tokens;
    const btnC = contrast(tk['on-brand'], tk['brand-violet']);
    const rows = [
      ['Button text', `${tk['on-brand'] === WHITE ? 'White' : 'Ink'} · ${btnC.toFixed(1)}:1`, btnC >= 4.5 ? 'ok' : btnC >= 3 ? 'warn' : 'no'],
      ['Color on Ink', `${contrast(tk['brand-violet'], INK).toFixed(1)}:1`, contrast(tk['brand-violet'], INK) >= 3 ? 'ok' : 'no'],
      ['Text tint on Ink', `${contrast(tk['violet-300'], INK).toFixed(1)}:1`, contrast(tk['violet-300'], INK) >= 4.5 ? 'ok' : 'no']
    ];
    panel.querySelector('#bpChecks').innerHTML = rows.map(([k, v, s]) => `<div><dt>${k}</dt><dd class="bp__${s}">${v}</dd></div>`).join('');
    panel.querySelector('#bpReset').disabled = isOfficial();
    if (btn) {
      btn.querySelector('.bp-trigger__label').textContent = isOfficial() ? 'Brand color' : nameOf();
      btn.classList.toggle('is-exploring', !isOfficial());
    }
  }

  function buildPanel() {
    panel = document.getElementById('brandPanel');
    btn = document.getElementById('brandBtn');
    if (!panel) return;
    panel.querySelector('#bpGrid').innerHTML = PRESETS.map((p) =>
      `<button type="button" role="radio" class="bp__sw" data-sw="${p.hex}" style="--sw:${p.hex}" aria-checked="false" aria-label="${p.name} ${p.hex}" title="${p.name}"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M6 12.5l4 4L18 8" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg></button>`).join('');
    panel.querySelectorAll('.bp__sw').forEach((b) => {
      b.style.color = contrast(WHITE, b.dataset.sw) >= contrast(INK, b.dataset.sw) ? WHITE : INK;
      b.addEventListener('click', () => apply(b.dataset.sw));
    });
    panel.querySelector('#bpGrid').addEventListener('keydown', (e) => {
      const list = [...panel.querySelectorAll('.bp__sw')]; const i = list.indexOf(document.activeElement); if (i < 0) return;
      const step = { ArrowRight: 1, ArrowDown: 6, ArrowLeft: -1, ArrowUp: -6 }[e.key]; if (!step) return;
      e.preventDefault(); const n = list[(i + step + list.length) % list.length]; n.focus(); apply(n.dataset.sw);
    });
    const picker = panel.querySelector('#bpCustom');
    picker.addEventListener('input', () => apply(picker.value));
    const hexIn = panel.querySelector('#bpHexIn');
    hexIn.addEventListener('change', () => { const h = norm(hexIn.value); if (h) apply(h); else { hexIn.value = state.hex; } });
    hexIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); hexIn.dispatchEvent(new Event('change')); } });
    panel.querySelector('#bpReset').addEventListener('click', () => apply(OFFICIAL_HEX));
    panel.querySelector('[data-bp-close]').addEventListener('click', () => close(true));
    document.addEventListener('click', (e) => {
      const t = e.target.closest('[data-brand-open]');
      if (t) { e.preventDefault(); panel.hidden ? open(t) : close(); return; }
      if (!panel.hidden && !panel.contains(e.target) && !e.target.closest('#brandBtn')) close();
    });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !panel.hidden) { e.stopImmediatePropagation(); close(true); } }, true);
    renderPanel();
  }
  function open(t) {
    opener = t; panel.hidden = false;
    document.querySelectorAll('[data-brand-open]').forEach((b) => b.setAttribute('aria-expanded', 'true'));
    (panel.querySelector('.bp__sw[aria-checked="true"]') || panel.querySelector('#bpHexIn')).focus();
  }
  function close(focus) {
    if (!panel || panel.hidden) return;
    panel.hidden = true;
    document.querySelectorAll('[data-brand-open]').forEach((b) => b.setAttribute('aria-expanded', 'false'));
    if (focus && opener && document.contains(opener)) opener.focus();
  }

  // tokens go on immediately (no flash of the old color); images and panel once the DOM exists
  state.tokens = derive(state.hex);
  if (!isOfficial()) Object.entries(state.tokens).forEach(([k, v]) => document.documentElement.style.setProperty('--' + k, v));
  const ready = () => { buildPanel(); apply(state.hex, { save: false }); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready); else ready();

  window.T4Theme = {
    presets: PRESETS, apply, contrast, recolorable, recolorDownload,
    get hex() { return state.hex; }, get name() { return nameOf(); }, get official() { return isOfficial(); }
  };
})();
