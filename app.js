import {
  DEFAULT_SETTINGS,
  PAPERS,
  LAYOUTS,
  LABEL_TEXT,
  LABEL_FONTS,
  THEME_BORDER,
  THEME_FONT_SCALE,
  THEME_ACCENT,
  CERT_LEN,
  uid,
  newLabel,
  toneFor,
  code39Bars,
  pageSize,
  stamp,
  gridFor,
  paginate,
  cleanImport,
  normalizeHex,
  hsvToHex,
  hsvToRgb,
  hexToHsv,
} from './lib.js?v=26.11.25';

const KEY = 'cardslabstudio.v1';
const $ = (sel) => document.querySelector(sel);

const el = (tag, cls, text) => {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text != null) node.textContent = text;
  return node;
};

const state = {
  settings: { ...DEFAULT_SETTINGS },
  labels: [],
  selectedId: null,
};
let saveTimer = null;
let toastTimer = null;
let undoSnapshot = null;

function syncUndo() {
  document.querySelectorAll('.undo-btn').forEach((button) => {
    button.disabled = !undoSnapshot;
  });
}

function pushUndo() {
  undoSnapshot = JSON.parse(
    JSON.stringify({ labels: state.labels, selectedId: state.selectedId })
  );
  syncUndo();
}

function undoDelete() {
  if (!undoSnapshot) return;
  state.labels = undoSnapshot.labels;
  state.selectedId = undoSnapshot.selectedId;
  undoSnapshot = null;
  syncUndo();
  renderAll();
  scheduleSave();
}

const THEME_KEY = 'cardslabstudio.theme';
const ICON_MOON =
  '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/></svg>';
const ICON_SUN =
  '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';

function syncTheme() {
  const dark = document.documentElement.dataset.theme === 'dark';
  const button = $('#btn-theme');
  button.innerHTML = dark ? ICON_SUN : ICON_MOON;
  button.setAttribute('aria-pressed', String(dark));
  button.title = dark ? 'Switch to light mode' : 'Switch to dark mode';
}

function toggleTheme() {
  const dark = document.documentElement.dataset.theme === 'dark';
  if (dark) delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = 'dark';
  try {
    localStorage.setItem(THEME_KEY, dark ? 'light' : 'dark');
  } catch {}
  syncTheme();
}

function sel() {
  return state.labels.find((label) => label.id === state.selectedId) || null;
}

function seedLabel() {
  const label = newLabel();
  Object.assign(label, {
    name: 'Pikachu',
    year: '1999',
    setLine: 'Pokémon Base Set',
    variation: 'Yellow Cheeks',
    cardNo: '58/102',
    gradeValue: '10',
    gradeLabel: 'GEM MINT',
  });
  return label;
}

/* ---------- persistence ---------- */

function loadState() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const data = cleanImport(JSON.parse(raw));
      state.settings = data.settings;
      state.labels = data.labels;
    }
  } catch (err) {
    console.warn('Stored data ignored:', err);
  }
  if (!state.labels.length) state.labels = [seedLabel()];
  state.selectedId = state.labels[0].id;
}

function saveNow() {
  try {
    localStorage.setItem(
      KEY,
      JSON.stringify({ version: 1, settings: state.settings, labels: state.labels })
    );
  } catch {
    toast('Storage full — export a backup, then remove some images.', true);
  }
}

function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNow, 300);
}

/* ---------- render ---------- */

function renderSettings() {
  const s = state.settings;
  $('#s-paper').value = s.paper;
  $('#s-theme').value = s.theme;
  $('#s-labelW').value = s.labelW;
  $('#s-labelH').value = s.labelH;
  $('#s-margin').value = s.margin;
  $('#s-marginTop').value = s.marginTop;
  $('#s-gap').value = s.gap;
  $('#s-pageW').value = s.pageW;
  $('#s-pageH').value = s.pageH;
  $('#s-offsetX').value = s.offsetX;
  $('#s-offsetY').value = s.offsetY;
  $('#s-border').value = s.border;
  $('#s-font').value = s.font;
  $('#s-fontScale').value = s.fontScale;
  $('#s-cutlines').checked = s.cutlines;
  $('#s-calib').checked = s.calib;
  document.querySelectorAll('.custom-page').forEach((node) => {
    node.hidden = s.paper !== 'custom';
  });
}

function resetThemeDefaults(theme = state.settings.theme) {
  const border = THEME_BORDER[theme] ?? DEFAULT_SETTINGS.border;
  const scale = THEME_FONT_SCALE[theme] ?? DEFAULT_SETTINGS.fontScale;
  state.settings.border = border;
  state.settings.fontScale = scale;
  $('#s-border').value = border;
  $('#s-fontScale').value = scale;
}

/** Accent in force for a label: its own colour, else the theme's built-in one. */
function accentFor(label) {
  return (label && label.accent) || THEME_ACCENT[state.settings.theme] || '#c8102e';
}

function setAccent(hex) {
  const label = sel();
  const norm = normalizeHex(hex);
  if (!label || !norm) return;
  label.accent = norm === THEME_ACCENT[state.settings.theme] ? '' : norm;
  $('#s-accent').value = norm;
  commit();
}

function renderForm() {
  const label = sel();
  for (const key of LABEL_TEXT) {
    $('#f-' + key).value = label ? label[key] : '';
  }
  $('#f-lines').value = label ? label.customLines.join('\n') : '';
  $('#f-layout').value = label ? label.layout : 'thumb';
  $('#f-bgsTone').value = label ? label.bgsTone : '';
  $('#tone-field').hidden = state.settings.theme !== 'bgs';
  $('#f-certNo').placeholder = '0'.repeat(CERT_LEN[state.settings.theme] || 8);
  $('#s-accent').value = accentFor(label);
  $('#f-bgFit').value = label ? label.bgFit : 'cover';
  $('#f-logoFit').value = label ? label.logoFit : 'contain';
  const bgPreview = $('#bg-preview');
  if (label && label.bgImage) {
    bgPreview.src = label.bgImage;
    bgPreview.hidden = false;
  } else {
    bgPreview.removeAttribute('src');
    bgPreview.hidden = true;
  }
  const logoPreview = $('#logo-preview');
  const art = label && (label.logoImage || label.image);
  if (art) {
    logoPreview.src = art;
    logoPreview.hidden = false;
  } else {
    logoPreview.removeAttribute('src');
    logoPreview.hidden = true;
  }
}

function renderList() {
  const list = $('#label-list');
  list.textContent = '';
  state.labels.forEach((label, index) => {
    const item = el('li');
    const button = el('button', 'label-item');
    button.type = 'button';
    if (label.id === state.selectedId) button.classList.add('active');
    button.append(el('span', 'li-name', label.name || `Label ${index + 1}`));
    const grade = [label.gradeValue, label.gradeLabel].filter(Boolean).join(' ');
    button.append(el('span', 'li-meta', grade || label.layout));
    button.addEventListener('click', () => select(label.id));
    item.append(button);
    list.append(item);
  });
}

function imgEl(src, fit, extraClass) {
  const wrap = el('div', extraClass ? `lb-img ${extraClass}` : 'lb-img');
  const img = document.createElement('img');
  img.src = src;
  img.alt = '';
  img.style.objectFit = fit === 'contain' ? 'contain' : 'cover';
  wrap.append(img);
  return wrap;
}

function barcodeEl(value) {
  const wrap = el('div', 'lb-barcode');
  const bars = code39Bars(value);
  if (!bars.length) {
    wrap.hidden = true;
    return wrap;
  }
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  const total = bars.reduce((sum, bar) => sum + bar.w, 0) + 10;
  svg.setAttribute('viewBox', `0 0 ${total} 1`);
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('aria-hidden', 'true');
  // No leading quiet zone: label padding is wider than the 10x spec, keeps bars flush left.
  let x = 0;
  for (const bar of bars) {
    if (bar.on) {
      const rect = document.createElementNS(ns, 'rect');
      rect.setAttribute('x', x);
      rect.setAttribute('y', 0);
      rect.setAttribute('width', bar.w);
      rect.setAttribute('height', 1);
      rect.setAttribute('fill', 'currentColor');
      svg.append(rect);
    }
    x += bar.w;
  }
  wrap.append(svg);
  return wrap;
}

// Decorative QR silhouette: deterministic from serial, not a scannable QR.
function qrEl(value) {
  const box = el('div', 'lb-qr');
  if (!value) {
    box.hidden = true;
    return box;
  }
  const n = 21;
  let seed = 2166136261;
  for (const ch of value) seed = Math.imul(seed ^ ch.charCodeAt(0), 16777619);
  const rand = () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const finder = (x, y) => {
    const fx = x < 7 ? 0 : x >= n - 7 ? n - 7 : -1;
    const fy = y < 7 ? 0 : y >= n - 7 ? n - 7 : -1;
    if (!((fx === 0 && fy === 0) || (fx === n - 7 && fy === 0) || (fx === 0 && fy === n - 7))) {
      return null;
    }
    const dx = x - fx;
    const dy = y - fy;
    return dx === 0 || dx === 6 || dy === 0 || dy === 6 || (dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4);
  };
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', `0 0 ${n} ${n}`);
  svg.setAttribute('shape-rendering', 'crispEdges');
  svg.setAttribute('aria-hidden', 'true');
  for (let y = 0; y < n; y += 1) {
    for (let x = 0; x < n; x += 1) {
      const f = finder(x, y);
      const on = f !== null ? f : x === 6 || y === 6 ? (x + y) % 2 === 0 : rand() > 0.5;
      if (!on) continue;
      const rect = document.createElementNS(ns, 'rect');
      rect.setAttribute('x', x);
      rect.setAttribute('y', y);
      rect.setAttribute('width', 1);
      rect.setAttribute('height', 1);
      rect.setAttribute('fill', 'currentColor');
      svg.append(rect);
    }
  }
  box.append(svg);
  return box;
}

function logoEl(label, text, extra = '') {
  const box = el('div', `lb-logo ${extra}`.trim());
  if (label.layout === 'theme' && label.logoImage) {
    const img = document.createElement('img');
    img.src = label.logoImage;
    img.alt = '';
    img.style.objectFit = label.logoFit || 'contain';
    box.append(img);
  } else {
    box.append(el('span', 'lb-logo-text', text));
  }
  return box;
}

function cgcHeader(label) {
  const head = el('div', 'lb-header');
  const brand = el('div', 'lb-brand');
  brand.append(logoEl(label, 'CGC', 'lb-logo-head'));
  brand.append(el('span', 'lb-brand-text', 'UNIVERSAL GRADE'));
  head.append(brand);
  head.append(el('span', 'lb-header-text', 'CGC CARDS'));
  return head;
}

function gradeEl(label, theme) {
  const cardNo = String(label.cardNo || '').replace(/^#/, '');
  const serial = theme === 'psa' || theme === 'bgs' ? label.certNo || '' : '';
  if (!label.gradeValue && !label.gradeLabel && !cardNo && !serial) {
    return null;
  }
  const grade = el('div', 'lb-grade');
  if (theme === 'psa') {
    if (cardNo) grade.append(el('div', 'gl-card', `#${cardNo}`));
    if (label.gradeLabel) grade.append(el('div', 'gl', label.gradeLabel));
    if (label.gradeValue) grade.append(el('div', 'gv', label.gradeValue));
  } else if (theme === 'cgc') {
    if (label.gradeLabel) grade.append(el('div', 'gl', label.gradeLabel));
    if (label.gradeValue) grade.append(el('div', 'gv', label.gradeValue));
  } else {
    if (label.gradeValue) grade.append(el('div', 'gv', label.gradeValue));
    if (label.gradeLabel) grade.append(el('div', 'gl', label.gradeLabel));
  }
  if ((theme === 'bgs' || theme === 'psa') && serial) {
    grade.append(el('div', 'lb-serial', serial));
  }
  return grade;
}

function fillMain(main, label, theme) {
  const cardNo = String(label.cardNo || '').replace(/^#/, '');
  const meta = [label.year, label.setLine].filter(Boolean).join(' ');
  const add = (cls, text) => {
    if (text) main.append(el('div', cls, text));
  };
  if (theme === 'psa') {
    add('lb-sub', meta);
    add('lb-name', label.name);
    add('lb-line', label.variation);
    for (const line of label.customLines) add('lb-line', line);
  } else if (theme === 'bgs') {
    add('lb-sub', meta);
    add('lb-line', label.customLines[0]);
    add('lb-line', label.variation);
    add('lb-name', [cardNo ? `#${cardNo}` : '', label.name].filter(Boolean).join(' '));
    for (const line of label.customLines.slice(1)) add('lb-line', line);
  } else if (theme === 'cgc') {
    add('lb-name', label.name);
    add('lb-sub', [label.setLine, label.year ? `(${label.year})` : ''].filter(Boolean).join(' '));
    add('lb-line', label.variation);
    for (const line of label.customLines) add('lb-line', line);
    if (!label.customLines.length && cardNo) add('lb-line', `#${cardNo}`);
  } else if (theme === 'tag') {
    add('lb-name', label.name);
    add('lb-sub', meta);
    add('lb-line', label.variation);
    for (const line of label.customLines) add('lb-line', line);
  } else {
    add('lb-name', label.name);
    add('lb-sub', meta);
    add('lb-line', label.variation);
    for (const line of label.customLines) add('lb-line', line);
    const cert = label.certNo || '';
    const foot = [
      cardNo ? `#${cardNo}` : '',
      cert ? `Cert ${cert}` : '',
    ]
      .filter(Boolean)
      .join(' · ');
    add('lb-foot', foot);
  }
}

function codeFooter(label, withValue = true) {
  const value = String(label.certNo || label.cardNo || '').replace(/^#/, '').trim();
  if (!value) return null;
  const foot = el('div', 'lb-codes');
  foot.append(barcodeEl(value));
  if (withValue) foot.append(el('div', 'lb-code-val', label.certNo || value));
  return foot;
}

function tagSide(label) {
  const serial = String(label.certNo || label.cardNo || '').replace(/^#/, '').trim();
  const grade = gradeEl(label, 'tag');
  if (!grade && !serial) return null;
  const side = el('div', 'lb-side');
  if (grade) side.append(grade);
  if (serial) {
    const row = el('div', 'lb-qrrow');
    row.append(qrEl(serial));
    row.append(el('div', 'lb-qr-serial', serial));
    side.append(row);
  }
  return side;
}

function labelEl(label, settings) {
  const layout = LAYOUTS.includes(label.layout) ? label.layout : 'thumb';
  const theme = settings.theme;
  const hasMark = theme === 'psa' || theme === 'cgc' || theme === 'bgs';
  const place = layout === 'theme' && (!hasMark || !label.logoImage) ? 'thumb' : layout;
  const root = el('div', 'label ' + place);
  root.dataset.id = label.id;
  root.dataset.theme = theme;
  if (theme === 'bgs') root.dataset.tone = toneFor(label);
  // Dark labels need the red cut line; black would disappear on them.
  if (label.bgImage || theme === 'sgc' || root.dataset.tone === 'black') root.classList.add('cut-light');
  if (label.accent) root.style.setProperty('--l-accent', label.accent);
  if (LABEL_FONTS[settings.font]) root.style.setProperty('--l-font', LABEL_FONTS[settings.font]);
  if (settings.fontScale !== 1) root.style.setProperty('--l-scale', settings.fontScale);
  root.style.setProperty('--l-border-w', settings.border + 'px');
  if (label.id === state.selectedId) root.classList.add('selected');
  root.addEventListener('click', () => select(label.id));

  const body = el('div', 'lb-body');
  const art = place === 'theme' ? null : (label.logoImage || label.image);
  const artFit = label.logoImage ? label.logoFit : label.fit;

  if (label.bgImage) {
    root.classList.add('has-bg');
    root.append(imgEl(label.bgImage, label.bgFit, 'lb-bg'));
  }

  if (place === 'logo' && art) {
    const top = el('div', 'lb-top');
    top.append(imgEl(art, artFit));
    body.append(top);
  }
  if (place === 'bleed' && art && !label.bgImage) {
    root.append(imgEl(art, 'cover', 'lb-bleed-img'));
  }
  if (theme === 'cgc') root.append(cgcHeader(label));

  const row = el('div', 'lb-row');
  if (theme === 'bgs') row.append(logoEl(label, 'BGS'));
  if (art && (place === 'thumb' || (place === 'bleed' && label.bgImage))) {
    row.append(imgEl(art, artFit));
  }

  const main = el('div', 'lb-main');
  if (theme === 'tag') main.classList.add('lb-frame');
  fillMain(main, label, theme);
  if (theme === 'psa') {
    const bars = codeFooter(label, false);
    if (bars) main.append(bars);
  }
  row.append(main);

  if (theme === 'tag') {
    const side = tagSide(label);
    if (side) row.append(side);
  } else {
    const grade = gradeEl(label, theme);
    if (grade) row.append(grade);
  }

  body.append(row);
  if (theme === 'cgc') {
    const foot = codeFooter(label);
    if (foot) body.append(foot);
  }
  root.append(body);
  return root;
}

// PSA theme position: bottom-centre brand logo, measured from the variation line
// up to the end of the first line. Overlaps the border on purpose.
function psaLogoBox(root) {
  const label = state.labels.find((item) => item.id === root.dataset.id);
  if (label?.layout !== 'theme' || !label.logoImage) return;
  const first = root.querySelector('.lb-sub');
  const line = root.querySelector('.lb-line');
  const text = line && line.firstChild;
  const rootRect = root.getBoundingClientRect();
  if (!first || !text || text.nodeType !== 3 || !text.length || !rootRect.width) return;
  // .sheets zoom scales client rects but not style px, so normalise by the ratio.
  const z = rootRect.width / root.offsetWidth;
  const em = parseFloat(getComputedStyle(line).fontSize);
  const range = document.createRange();
  range.selectNodeContents(first);
  const right = range.getBoundingClientRect().right;
  range.setStart(text, text.length - 1);
  range.setEnd(text, text.length);
  const sRect = range.getBoundingClientRect();
  const top = line.getBoundingClientRect().bottom;
  const width = (right - sRect.left + em * 0.35) / z;
  const height = (rootRect.bottom - top) / z;
  const box = el('div', 'lb-logo-box');
  const img = document.createElement('img');
  img.src = label.logoImage;
  img.alt = '';
  img.style.objectFit = label.logoFit || 'contain';
  box.append(img);
  box.style.width = `${width}px`;
  box.style.height = `${height}px`;
  box.style.left = `${(root.clientWidth - width) / 2}px`;
  box.style.top = `${(top - (rootRect.top + root.clientTop)) / z}px`;
  root.append(box);
}

function renderSheet() {
  const s = state.settings;
  const grid = gridFor(s);
  const pages = paginate(state.labels, grid.perPage);
  const host = $('#sheets');
  host.textContent = '';
  host.classList.toggle('show-cutlines', !!s.cutlines);
  document.documentElement.style.setProperty('--page-w', grid.page.w + 'in');
  document.documentElement.style.setProperty('--page-h', grid.page.h + 'in');
  host.style.setProperty('--label-w', grid.labelW * 96 + 'px');
  host.style.setProperty('--label-h', grid.labelH * 96 + 'px');

  pages.forEach((items, pageIndex) => {
    const wrap = el('div', 'page-wrap');
    if (pages.length > 1) {
      wrap.append(
        el('div', 'page-tag no-print', `Page ${pageIndex + 1} of ${pages.length}`)
      );
    }
    const sheet = el('div', 'sheet');
    sheet.style.width = grid.page.w + 'in';
    sheet.style.height = grid.page.h + 'in';

    const inner = el('div', 'sheet-inner');
    inner.style.padding = `${grid.marginTop}in ${grid.margin}in ${grid.margin}in`;
    inner.style.transform = `translate(${s.offsetX || 0}in, ${s.offsetY || 0}in)`;

    const layoutGrid = el('div', 'grid');
    layoutGrid.style.gridTemplateColumns = `repeat(${grid.cols}, ${grid.labelW}in)`;
    layoutGrid.style.gridAutoRows = `${grid.labelH}in`;
    layoutGrid.style.gap = `${grid.gap}in`;

    for (let i = 0; i < grid.perPage; i += 1) {
      const cell = el('div', 'cell');
      if (items[i]) cell.append(labelEl(items[i], s));
      layoutGrid.append(cell);
    }
    inner.append(layoutGrid);
    sheet.append(inner);
    sheet.append(el('div', 'print-stamp', stamp()));
    wrap.append(sheet);
    host.append(wrap);
  });

  // PSA logo box: bottom-centre white block on every PSA label.
  host.querySelectorAll('.label[data-theme="psa"]').forEach(psaLogoBox);

  if (s.calib) {
    const wrap = el('div', 'page-wrap');
    wrap.append(el('div', 'page-tag no-print', 'Calibration'));
    const sheet = el('div', 'sheet calib');
    sheet.style.width = grid.page.w + 'in';
    sheet.style.height = grid.page.h + 'in';
    sheet.append(el('div', 'calib-box', '1 in'));
    sheet.append(
      el(
        'p',
        'calib-note',
        'Print at 100% / Actual Size. This square must measure exactly 1 inch.'
      )
    );
    wrap.append(sheet);
    host.append(wrap);
  }
}

function renderHint() {
  const s = state.settings;
  const grid = gridFor(s);
  const paper = PAPERS[s.paper] ? PAPERS[s.paper].name : 'Custom';
  const pages = paginate(state.labels, grid.perPage).length;
  $('#sheet-hint').textContent =
    `${paper} ${grid.page.w} × ${grid.page.h} in · ` +
    `${grid.cols} × ${grid.rows} = ${grid.perPage} per page · ` +
    `${state.labels.length} label(s), ${pages} page(s)`;
}

function updateCount() {
  $('#count').textContent = `(${state.labels.length})`;
}

function renderAll() {
  renderSettings();
  renderForm();
  renderList();
  renderSheet();
  renderHint();
  updateCount();
}

function commit() {
  renderSheet();
  renderList();
  renderHint();
  updateCount();
  scheduleSave();
}

function select(id) {
  state.selectedId = id;
  renderForm();
  renderList();
  renderSheet();
}

/* ---------- toast ---------- */

function toast(message, isError = false) {
  const node = $('#status');
  node.textContent = message;
  node.classList.toggle('error', isError);
  node.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => node.classList.remove('show'), 4200);
}

/* ---------- image ---------- */

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image decode failed'));
    img.src = src;
  });
}

async function shrink(file, keepAlpha = false) {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const longest = Math.max(img.naturalWidth, img.naturalHeight) || 1;
    const scale = Math.min(1, 900 / longest);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = canvas.getContext('2d');
    if (!keepAlpha) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return keepAlpha ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', 0.82);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/* ---------- print / backup ---------- */

function applyPageStyle() {
  const size = pageSize(state.settings);
  const paper = state.settings.paper;
  const page =
    paper === 'a4' ? 'A4' : paper === 'letter' ? 'letter' : `${size.w}in ${size.h}in`;
  let style = document.getElementById('page-size');
  if (!style) {
    style = document.createElement('style');
    style.id = 'page-size';
    document.head.append(style);
  }
  style.textContent = `@page { size: ${page}; margin: 0; }`;
}

// Browsers name "Save as PDF" after document.title, so the print timestamp
// doubles as the filename. BASE_TITLE puts the tab title back afterwards.
const BASE_TITLE = document.title;

function applyPrintStamp() {
  const now = stamp();
  document.title = `cardslab-${now}`;
  document.querySelectorAll('.print-stamp').forEach((node) => {
    node.textContent = now;
  });
}

function exportBackup() {
  const payload = JSON.stringify(
    { version: 1, settings: state.settings, labels: state.labels },
    null,
    2
  );
  const blob = new Blob([payload], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `cardslab-studio-${stamp()}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ---------- binding ---------- */

function bindNumber(selector, key, min, max) {
  $(selector).addEventListener('input', (event) => {
    const value = parseFloat(event.target.value);
    if (!Number.isFinite(value)) return;
    state.settings[key] = Math.min(max, Math.max(min, value));
    commit();
  });
}

function bind() {
  for (const key of LABEL_TEXT) {
    $('#f-' + key).addEventListener('input', (event) => {
      const label = sel();
      if (!label) return;
      label[key] = event.target.value;
      commit();
    });
  }

  $('#f-lines').addEventListener('input', (event) => {
    const label = sel();
    if (!label) return;
    label.customLines = event.target.value
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 6);
    commit();
  });

  $('#f-layout').addEventListener('change', (event) => {
    const label = sel();
    if (!label) return;
    label.layout = event.target.value;
    commit();
  });

  $('#f-bgsTone').addEventListener('change', (event) => {
    const label = sel();
    if (!label) return;
    label.bgsTone = event.target.value;
    commit();
  });

  $('#f-bgImage').addEventListener('change', async (event) => {
    const file = event.target.files && event.target.files[0];
    event.target.value = '';
    const label = sel();
    if (!label || !file) return;
    if (!file.type.startsWith('image/')) {
      toast('Choose an image file.', true);
      return;
    }
    try {
      label.bgImage = await shrink(file);
      commit();
      renderForm();
    } catch {
      toast('Could not read that image.', true);
    }
  });

  $('#f-bgFit').addEventListener('change', (event) => {
    const label = sel();
    if (!label) return;
    label.bgFit = event.target.value;
    commit();
  });

  $('#f-logoFit').addEventListener('change', (event) => {
    const label = sel();
    if (!label) return;
    label.logoFit = event.target.value;
    commit();
  });

  $('#f-logoImage').addEventListener('change', async (event) => {
    const file = event.target.files && event.target.files[0];
    event.target.value = '';
    const label = sel();
    if (!label || !file) return;
    if (!file.type.startsWith('image/')) {
      toast('Choose an image file.', true);
      return;
    }
    try {
      label.logoImage = await shrink(file, true);
      label.image = null;
      commit();
      renderForm();
    } catch {
      toast('Could not read that image.', true);
    }
  });

  $('#btn-logo-clear').addEventListener('click', () => {
    const label = sel();
    if (!label) return;
    label.logoImage = null;
    label.image = null;
    commit();
    renderForm();
  });

  $('#btn-bg-clear').addEventListener('click', () => {
    const label = sel();
    if (!label) return;
    label.bgImage = null;
    commit();
    renderForm();
  });

  $('#btn-new').addEventListener('click', () => {
    const label = newLabel();
    state.labels.push(label);
    state.selectedId = label.id;
    commit();
    renderForm();
  });

  $('#btn-dup').addEventListener('click', () => {
    const label = sel();
    if (!label) return;
    const copy = { ...label, id: uid(), customLines: [...label.customLines] };
    state.labels.splice(state.labels.indexOf(label) + 1, 0, copy);
    state.selectedId = copy.id;
    commit();
    renderForm();
  });

  $('#btn-del').addEventListener('click', () => {
    const label = sel();
    if (!label) return;
    pushUndo();
    const index = state.labels.indexOf(label);
    state.labels.splice(index, 1);
    if (!state.labels.length) state.labels.push(newLabel());
    state.selectedId = state.labels[Math.min(index, state.labels.length - 1)].id;
    commit();
    renderForm();
  });

  $('#btn-clear').addEventListener('click', () => {
    pushUndo();
    const label = newLabel();
    state.labels = [label];
    state.selectedId = label.id;
    commit();
    renderForm();
  });

  $('#btn-theme').addEventListener('click', toggleTheme);

  document.querySelectorAll('.undo-btn').forEach((button) => {
    button.addEventListener('click', undoDelete);
  });

  const zoom = $('#zoom');
  const applyZoom = () => {
    document.documentElement.style.setProperty('--zoom', Number(zoom.value) / 100);
    $('#zoom-val').textContent = zoom.value + '%';
  };
  zoom.addEventListener('input', applyZoom);
  applyZoom();

  $('#s-paper').addEventListener('change', (event) => {
    state.settings.paper = event.target.value;
    document.querySelectorAll('.custom-page').forEach((node) => {
      node.hidden = state.settings.paper !== 'custom';
    });
    commit();
    applyPageStyle();
  });

  $('#s-theme').addEventListener('change', (event) => {
    state.settings.theme = event.target.value;
    resetThemeDefaults(event.target.value);
    $('#s-accent').value = accentFor(sel());
    commit();
    renderForm();
  });

  $('#s-cutlines').addEventListener('change', (event) => {
    state.settings.cutlines = event.target.checked;
    commit();
  });

  $('#s-calib').addEventListener('change', (event) => {
    state.settings.calib = event.target.checked;
    commit();
  });

  const accentInput = $('#s-accent');
  accentInput.addEventListener('change', () => {
    const norm = normalizeHex(accentInput.value);
    if (norm) setAccent(norm);
    else accentInput.value = accentFor(sel());
  });
  accentInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') accentInput.blur();
  });

  document.querySelectorAll('.swatch').forEach((swatch) => {
    swatch.addEventListener('click', () => setAccent(swatch.dataset.color));
  });

  $('#s-accent-reset').addEventListener('click', () => {
    const label = sel();
    if (label) label.accent = '';
    accentInput.value = accentFor(label);
    resetThemeDefaults(state.settings.theme);
    commit();
  });

  /* Colour wheel: hue + saturation from the disc, brightness from the slider. */
  const wheelCanvas = $('#s-wheel');
  const wheelCtx = wheelCanvas.getContext('2d');
  const wheelValue = $('#s-wheel-v');
  const wheelPop = $('#accent-wheel');
  const wheelBtn = $('#s-accent-wheel');
  let wheelH = 0;
  let wheelS = 1;
  let wheelDrag = false;

  const drawWheel = (v) => {
    const size = wheelCanvas.width;
    const radius = size / 2;
    const img = wheelCtx.createImageData(size, size);
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const dx = x - radius + 0.5;
        const dy = y - radius + 0.5;
        const dist = Math.hypot(dx, dy);
        if (dist > radius) continue;
        const [r, g, b] = hsvToRgb((Math.atan2(dy, dx) * 180) / Math.PI, Math.min(1, dist / radius), v);
        const i = (y * size + x) * 4;
        img.data[i] = r;
        img.data[i + 1] = g;
        img.data[i + 2] = b;
        img.data[i + 3] = Math.max(0, Math.min(255, Math.round((radius - dist) * 255)));
      }
    }
    wheelCtx.putImageData(img, 0, 0);
  };

  const pickWheel = (event) => {
    const rect = wheelCanvas.getBoundingClientRect();
    const radius = rect.width / 2 || 1;
    const dx = event.clientX - rect.left - radius;
    const dy = event.clientY - rect.top - radius;
    wheelH = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360;
    wheelS = Math.min(1, Math.hypot(dx, dy) / radius);
    syncWheelGradient();
    setAccent(hsvToHex(wheelH, wheelS, wheelValue.value / 100));
  };

  const syncWheelGradient = () => {
    wheelValue.style.background = `linear-gradient(to top, #000, ${hsvToHex(wheelH, wheelS, 1)})`;
  };

  wheelBtn.addEventListener('click', () => {
    if (!wheelPop.hidden) {
      wheelPop.hidden = true;
      wheelBtn.setAttribute('aria-expanded', 'false');
      return;
    }
    const hsv = hexToHsv(accentFor(sel()));
    wheelH = hsv.h;
    wheelS = hsv.s;
    wheelValue.value = Math.round(hsv.v * 100);
    drawWheel(hsv.v);
    syncWheelGradient();
    wheelPop.hidden = false;
    wheelBtn.setAttribute('aria-expanded', 'true');
  });

  wheelValue.addEventListener('input', () => {
    drawWheel(wheelValue.value / 100);
    setAccent(hsvToHex(wheelH, wheelS, wheelValue.value / 100));
  });

  wheelCanvas.addEventListener('pointerdown', (event) => {
    wheelDrag = true;
    wheelCanvas.setPointerCapture(event.pointerId);
    pickWheel(event);
  });
  wheelCanvas.addEventListener('pointermove', (event) => {
    if (wheelDrag) pickWheel(event);
  });
  wheelCanvas.addEventListener('pointerup', () => { wheelDrag = false; });
  wheelCanvas.addEventListener('pointercancel', () => { wheelDrag = false; });

  bindNumber('#s-margin', 'margin', 0, 3);
  bindNumber('#s-marginTop', 'marginTop', 0, 3);
  bindNumber('#s-gap', 'gap', 0, 1);
  bindNumber('#s-labelW', 'labelW', 0.5, 9);
  bindNumber('#s-labelH', 'labelH', 0.3, 6);
  bindNumber('#s-pageW', 'pageW', 3, 20);
  bindNumber('#s-pageH', 'pageH', 3, 20);
  bindNumber('#s-offsetX', 'offsetX', -2, 2);
  bindNumber('#s-offsetY', 'offsetY', -2, 2);
  bindNumber('#s-border', 'border', 0, 6);
  bindNumber('#s-fontScale', 'fontScale', 0.6, 2);

  $('#s-font').addEventListener('change', (event) => {
    state.settings.font = event.target.value;
    commit();
  });

  $('#btn-print').addEventListener('click', () => {
    saveNow();
    applyPageStyle();
    applyPrintStamp();
    window.print();
  });

  $('#btn-export').addEventListener('click', exportBackup);
  $('#btn-import').addEventListener('click', () => $('#import-file').click());

  $('#import-file').addEventListener('change', async (event) => {
    const file = event.target.files && event.target.files[0];
    event.target.value = '';
    if (!file) return;
    try {
      const data = cleanImport(JSON.parse(await file.text()));
      const ok = confirm(
        `Replace the current ${state.labels.length} label(s) with ${data.labels.length} from this backup?`
      );
      if (!ok) return;
      state.settings = data.settings;
      state.labels = data.labels;
      state.selectedId = data.labels[0].id;
      renderAll();
      applyPageStyle();
      saveNow();
      toast(`Imported ${data.labels.length} label(s).`);
    } catch (err) {
      toast(`Import failed: ${err.message}`, true);
    }
  });

  window.addEventListener('beforeprint', () => {
    applyPageStyle();
    applyPrintStamp();
  });
  window.addEventListener('afterprint', () => {
    document.title = BASE_TITLE;
  });
  window.addEventListener('beforeunload', saveNow);
}

loadState();
applyPageStyle();
syncTheme();
bind();
renderAll();
