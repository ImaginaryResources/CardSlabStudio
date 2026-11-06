export const PAPERS = {
  a4: { name: 'A4', w: 8.27, h: 11.69 },
  letter: { name: 'Letter', w: 8.5, h: 11 },
};

export const LAYOUTS = ['thumb', 'bleed', 'logo', 'theme'];
export const THEMES = ['neutral', 'psa', 'bgs', 'cgc', 'sgc', 'tag'];
export const BGS_TONES = ['', 'black', 'gold', 'silver'];

/** Border width a theme wants when it is selected. */
export const THEME_BORDER = { psa: 6 };

/** Text scale a theme wants when it is selected. */
export const THEME_FONT_SCALE = { psa: 0.9 };

/** Digits shown as the cert # placeholder, by theme. */
export const CERT_LEN = { neutral: 8, psa: 9, bgs: 10, cgc: 10, sgc: 7, tag: 8 };

/** Label font overrides. Empty id = keep the theme's font. */
export const LABEL_FONTS = {
  '': '',
  roboto: 'Roboto, "Helvetica Neue", Arial, sans-serif',
  figtree: 'Figtree, "Helvetica Neue", Arial, sans-serif',
  helvetica: '"Helvetica Neue", Helvetica, Arial, sans-serif',
  arial: 'Arial, Helvetica, sans-serif',
  georgia: 'Georgia, "Times New Roman", serif',
  courier: '"Courier New", Courier, monospace',
};

export const DEFAULT_SETTINGS = {
  paper: 'a4',
  pageW: 8.27,
  pageH: 11.69,
  margin: 0.25,
  marginTop: 1,
  gap: 0.1,
  labelW: 2.72,
  labelH: 0.84,
  offsetX: 0,
  offsetY: 0,
  theme: 'neutral',
  accent: '',
  font: '',
  fontScale: 1,
  border: 1,
  cutlines: true,
  calib: false,
};

export const LABEL_TEXT = [
  'name',
  'setLine',
  'variation',
  'year',
  'cardNo',
  'certNo',
  'gradeValue',
  'gradeLabel',
];

const NUMBER_LIMITS = {
  pageW: [3, 20],
  pageH: [3, 20],
  margin: [0, 3],
  marginTop: [0, 3],
  gap: [0, 1],
  labelW: [0.5, 9],
  labelH: [0.3, 6],
  offsetX: [-2, 2],
  offsetY: [-2, 2],
  border: [0, 6],
  fontScale: [0.6, 2],
};

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
const num = (v, fallback) => (Number.isFinite(v) ? v : fallback);

export function uid() {
  if (globalThis.crypto && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'l-' + Math.random().toString(36).slice(2, 10);
}

export function newLabel() {
  return {
    id: uid(),
    name: '',
    setLine: '',
    variation: '',
    year: '',
    cardNo: '',
    certNo: '',
    gradeValue: '',
    gradeLabel: '',
    customLines: [],
    image: null,
    fit: 'cover',
    bgImage: null,
    bgFit: 'cover',
    logoImage: null,
    logoFit: 'contain',
    bgsTone: '',
    layout: 'thumb',
    theme: '',
  };
}

/** Resolve BGS label colour: explicit override wins, otherwise grade tier. */
// shortcut: 10 always reads black; real Black Label needs four 10 subgrades, override covers that.
export function toneFor(label) {
  if (BGS_TONES.includes(label.bgsTone) && label.bgsTone) return label.bgsTone;
  const grade = parseFloat(label.gradeValue);
  if (!Number.isFinite(grade)) return 'silver';
  if (grade >= 10) return 'black';
  if (grade >= 9.5) return 'gold';
  return 'silver';
}

// Code 39: 9 modules per character, wide = 3, narrow = 1. Bars at even indexes.
const CODE39 = {
  '0': '000110100', '1': '100100001', '2': '001100001', '3': '101100000',
  '4': '000110001', '5': '100110000', '6': '001110000', '7': '000100101',
  '8': '100100100', '9': '001100100', A: '100001001', B: '001001001',
  C: '101001000', D: '000011001', E: '100011000', F: '001011000',
  G: '000001101', H: '100001100', I: '001001100', J: '000011100',
  K: '100000011', L: '001000011', M: '101000010', N: '000010011',
  O: '100010010', P: '001010010', Q: '000000111', R: '100000110',
  S: '001000110', T: '000010110', U: '110000001', V: '011000001',
  W: '111000000', X: '010010001', Y: '110010000', Z: '011010000',
  '-': '010000101', '.': '110000100', ' ': '011000100', '$': '010101000',
  '/': '010100010', '+': '010001010', '%': '000101010', '*': '010010100',
};

/** Code 39 bars for the values the label already stores (cert or card number). */
export function code39Bars(value) {
  const text = String(value || '').toUpperCase().replace(/[^0-9A-Z\-. $/+%]/g, '');
  if (!text) return [];
  const bars = [];
  for (const ch of `*${text}*`) {
    const pattern = CODE39[ch];
    if (!pattern) continue;
    for (let i = 0; i < 9; i += 1) {
      bars.push({ w: pattern[i] === '1' ? 3 : 1, on: i % 2 === 0 });
    }
    bars.push({ w: 1, on: false });
  }
  return bars;
}

export function pageSize(settings) {
  if (settings.paper === 'custom') {
    return {
      w: clamp(num(settings.pageW, 8.27), 3, 20),
      h: clamp(num(settings.pageH, 11.69), 3, 20),
    };
  }
  const p = PAPERS[settings.paper] || PAPERS.a4;
  return { w: p.w, h: p.h };
}

export function gridFor(settings) {
  const page = pageSize(settings);
  const gap = clamp(num(settings.gap, 0.1), 0, 1);
  const margin = clamp(num(settings.margin, 0.25), 0, 3);
  const marginTop = clamp(num(settings.marginTop, 1), 0, 3);
  const labelW = clamp(num(settings.labelW, 2.72), 0.5, 9);
  const labelH = clamp(num(settings.labelH, 0.84), 0.3, 6);
  const cols = Math.max(
    1,
    Math.floor((page.w - 2 * margin + gap) / (labelW + gap))
  );
  const rows = Math.max(
    1,
    Math.floor((page.h - marginTop - margin + gap) / (labelH + gap))
  );
  return {
    page,
    labelW,
    labelH,
    gap,
    margin,
    marginTop,
    cols,
    rows,
    perPage: cols * rows,
  };
}

export function paginate(items, perPage) {
  const size = Math.max(1, perPage | 0);
  const pages = [];
  for (let i = 0; i < items.length; i += size) {
    pages.push(items.slice(i, i + size));
  }
  return pages.length ? pages : [[]];
}

const IMAGE_RE = /^data:image\/(png|jpe?g|webp);base64,/i;
const ACCENT_RE = /^#[0-9a-f]{6}$/i;

/** Parse a stored/uploaded backup. Throws on malformed data, never trusts fields. */
export function cleanImport(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('not a label backup');
  }
  if (!Array.isArray(raw.labels)) {
    throw new Error('backup has no "labels" array');
  }

  const settings = { ...DEFAULT_SETTINGS };
  const rs = raw.settings;
  if (rs && typeof rs === 'object' && !Array.isArray(rs)) {
    if (PAPERS[rs.paper] || rs.paper === 'custom') settings.paper = rs.paper;
    for (const [key, [min, max]] of Object.entries(NUMBER_LIMITS)) {
      if (typeof rs[key] === 'number' && Number.isFinite(rs[key])) {
        settings[key] = clamp(rs[key], min, max);
      }
    }
    if (THEMES.includes(rs.theme)) settings.theme = rs.theme;
    if (typeof rs.accent === 'string' && ACCENT_RE.test(rs.accent)) {
      settings.accent = rs.accent;
    }
    if (typeof rs.font === 'string' && rs.font in LABEL_FONTS) settings.font = rs.font;
    if (typeof rs.cutlines === 'boolean') settings.cutlines = rs.cutlines;
    if (typeof rs.calib === 'boolean') settings.calib = rs.calib;
  }

  const seen = new Set();
  const labels = [];
  for (const src of raw.labels) {
    if (labels.length >= 500) break;
    if (!src || typeof src !== 'object' || Array.isArray(src)) continue;
    const label = newLabel();
    for (const key of LABEL_TEXT) {
      if (typeof src[key] === 'string') label[key] = src[key].slice(0, 200);
    }
    if (Array.isArray(src.customLines)) {
      label.customLines = src.customLines
        .filter((line) => typeof line === 'string')
        .map((line) => line.slice(0, 120))
        .slice(0, 6);
    }
    if (typeof src.image === 'string' && IMAGE_RE.test(src.image)) {
      label.image = src.image;
    }
    if (src.fit === 'contain' || src.fit === 'cover') label.fit = src.fit;
    if (typeof src.bgImage === 'string' && IMAGE_RE.test(src.bgImage)) {
      label.bgImage = src.bgImage;
    }
    if (src.bgFit === 'contain' || src.bgFit === 'cover') label.bgFit = src.bgFit;
    if (typeof src.logoImage === 'string' && IMAGE_RE.test(src.logoImage)) {
      label.logoImage = src.logoImage;
    }
    if (src.logoFit === 'contain' || src.logoFit === 'cover') label.logoFit = src.logoFit;
    if (BGS_TONES.includes(src.bgsTone)) label.bgsTone = src.bgsTone;
    if (LAYOUTS.includes(src.layout)) label.layout = src.layout;
    if (THEMES.includes(src.theme)) label.theme = src.theme;
    if (typeof src.id === 'string' && src.id && !seen.has(src.id)) {
      label.id = src.id;
    }
    seen.add(label.id);
    labels.push(label);
  }

  if (!labels.length) throw new Error('backup has no usable labels');
  return { settings, labels };
}
