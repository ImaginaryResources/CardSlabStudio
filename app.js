import {
  DEFAULT_SETTINGS,
  PAPERS,
  LAYOUTS,
  LABEL_TEXT,
  uid,
  newLabel,
  pageSize,
  gridFor,
  paginate,
  cleanImport,
} from './lib.js?v=26.11';

const KEY = 'opengrading.v1';
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

const THEME_KEY = 'opengrading.theme';
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
  $('#s-cutlines').checked = s.cutlines;
  $('#s-calib').checked = s.calib;
  $('#s-accent').value = s.accent || '#c8102e';
  document.querySelectorAll('.custom-page').forEach((node) => {
    node.hidden = s.paper !== 'custom';
  });
}

function renderForm() {
  const label = sel();
  for (const key of LABEL_TEXT) {
    $('#f-' + key).value = label ? label[key] : '';
  }
  $('#f-lines').value = label ? label.customLines.join('\n') : '';
  $('#f-layout').value = label ? label.layout : 'thumb';
  $('#f-theme').value = label ? label.theme : '';
  $('#f-fit').value = label ? label.fit : 'cover';
  $('#f-bgFit').value = label ? label.bgFit : 'cover';
  const preview = $('#img-preview');
  if (label && label.image) {
    preview.src = label.image;
    preview.hidden = false;
  } else {
    preview.removeAttribute('src');
    preview.hidden = true;
  }
  const bgPreview = $('#bg-preview');
  if (label && label.bgImage) {
    bgPreview.src = label.bgImage;
    bgPreview.hidden = false;
  } else {
    bgPreview.removeAttribute('src');
    bgPreview.hidden = true;
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

function labelEl(label, settings) {
  const layout = LAYOUTS.includes(label.layout) ? label.layout : 'thumb';
  const root = el('div', 'label ' + layout);
  root.dataset.theme = label.theme || settings.theme;
  if (settings.accent) root.style.setProperty('--l-accent', settings.accent);
  if (label.id === state.selectedId) root.classList.add('selected');
  root.addEventListener('click', () => select(label.id));

  const body = el('div', 'lb-body');

  if (label.bgImage) {
    root.classList.add('has-bg');
    root.append(imgEl(label.bgImage, label.bgFit, 'lb-bg'));
  }

  if (layout === 'logo' && label.image) {
    const top = el('div', 'lb-top');
    top.append(imgEl(label.image, label.fit));
    body.append(top);
  }
  if (layout === 'bleed' && label.image && !label.bgImage) {
    root.append(imgEl(label.image, 'cover', 'lb-bleed-img'));
  }

  const row = el('div', 'lb-row');
  if (label.image && (layout === 'thumb' || (layout === 'bleed' && label.bgImage))) {
    row.append(imgEl(label.image, label.fit));
  }

  const main = el('div', 'lb-main');
  if (label.name) main.append(el('div', 'lb-name', label.name));
  const meta = [label.year, label.setLine].filter(Boolean).join(' ');
  if (meta) main.append(el('div', 'lb-sub', meta));
  if (label.variation) main.append(el('div', 'lb-line', label.variation));
  for (const line of label.customLines) main.append(el('div', 'lb-line', line));
  const cardNo = String(label.cardNo || '').replace(/^#/, '');
  const foot = [
    cardNo ? `#${cardNo}` : '',
    label.certNo ? `Cert ${label.certNo}` : '',
  ]
    .filter(Boolean)
    .join(' · ');
  if (foot) main.append(el('div', 'lb-foot', foot));
  row.append(main);

  if (label.gradeValue || label.gradeLabel) {
    const grade = el('div', 'lb-grade');
    if (label.gradeValue) grade.append(el('div', 'gv', label.gradeValue));
    if (label.gradeLabel) grade.append(el('div', 'gl', label.gradeLabel));
    row.append(grade);
  }

  body.append(row);
  root.append(body);
  return root;
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

    for (const label of items) layoutGrid.append(labelEl(label, s));
    inner.append(layoutGrid);
    sheet.append(inner);
    wrap.append(sheet);
    host.append(wrap);
  });

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

async function shrink(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const longest = Math.max(img.naturalWidth, img.naturalHeight) || 1;
    const scale = Math.min(1, 900 / longest);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.82);
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
  a.download = `opengrading-${new Date().toISOString().slice(0, 10)}.json`;
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

  $('#f-theme').addEventListener('change', (event) => {
    const label = sel();
    if (!label) return;
    label.theme = event.target.value;
    commit();
  });

  $('#f-fit').addEventListener('change', (event) => {
    const label = sel();
    if (!label) return;
    label.fit = event.target.value;
    commit();
  });

  $('#f-image').addEventListener('change', async (event) => {
    const file = event.target.files && event.target.files[0];
    event.target.value = '';
    const label = sel();
    if (!label || !file) return;
    if (!file.type.startsWith('image/')) {
      toast('Choose an image file.', true);
      return;
    }
    try {
      label.image = await shrink(file);
      commit();
      renderForm();
    } catch {
      toast('Could not read that image.', true);
    }
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

  $('#btn-bg-clear').addEventListener('click', () => {
    const label = sel();
    if (!label) return;
    label.bgImage = null;
    commit();
    renderForm();
  });

  $('#btn-img-clear').addEventListener('click', () => {
    const label = sel();
    if (!label) return;
    label.image = null;
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
  zoom.addEventListener('input', () => {
    document.documentElement.style.setProperty('--zoom', Number(zoom.value) / 100);
    $('#zoom-val').textContent = zoom.value + '%';
  });

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
    commit();
  });

  $('#s-cutlines').addEventListener('change', (event) => {
    state.settings.cutlines = event.target.checked;
    commit();
  });

  $('#s-calib').addEventListener('change', (event) => {
    state.settings.calib = event.target.checked;
    commit();
  });

  $('#s-accent').addEventListener('input', (event) => {
    state.settings.accent = event.target.value;
    commit();
  });

  $('#s-accent-reset').addEventListener('click', () => {
    state.settings.accent = '';
    $('#s-accent').value = '#c8102e';
    commit();
  });

  bindNumber('#s-margin', 'margin', 0, 3);
  bindNumber('#s-marginTop', 'marginTop', 0, 3);
  bindNumber('#s-gap', 'gap', 0, 1);
  bindNumber('#s-labelW', 'labelW', 0.5, 9);
  bindNumber('#s-labelH', 'labelH', 0.3, 6);
  bindNumber('#s-pageW', 'pageW', 3, 20);
  bindNumber('#s-pageH', 'pageH', 3, 20);
  bindNumber('#s-offsetX', 'offsetX', -2, 2);
  bindNumber('#s-offsetY', 'offsetY', -2, 2);

  $('#btn-print').addEventListener('click', () => {
    saveNow();
    applyPageStyle();
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

  window.addEventListener('beforeprint', applyPageStyle);
  window.addEventListener('beforeunload', saveNow);
}

loadState();
applyPageStyle();
syncTheme();
bind();
renderAll();
