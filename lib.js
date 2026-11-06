export const PAPERS = {
  a4: { name: 'A4', w: 8.27, h: 11.69 },
  letter: { name: 'Letter', w: 8.5, h: 11 },
};

export const LAYOUTS = ['thumb', 'bleed', 'logo'];
export const THEMES = ['neutral', 'psa', 'bgs', 'cgc', 'sgc'];

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
    layout: 'thumb',
    theme: '',
  };
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
