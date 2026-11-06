import assert from 'node:assert/strict';
import {
  DEFAULT_SETTINGS,
  THEMES,
  pageSize,
  gridFor,
  paginate,
  cleanImport,
  toneFor,
  code39Bars,
} from './lib.js';

const settings = (over) => ({ ...DEFAULT_SETTINGS, ...over });

// A4 default: 2 columns x 11 rows
const a4 = gridFor(settings({}));
assert.equal(a4.cols, 2, 'A4 columns');
assert.equal(a4.rows, 11, 'A4 rows');
assert.equal(a4.perPage, 22, 'A4 per page');

// Letter: 2 x 10
const letter = gridFor(settings({ paper: 'letter' }));
assert.equal(letter.perPage, 20, 'Letter per page');

// Larger top margin removes a row
const topMargin = gridFor(settings({ marginTop: 2 }));
assert.equal(topMargin.rows, 10, 'top margin rows');
assert.equal(topMargin.perPage, 20, 'top margin per page');

// Zero gap packs more rows
assert.equal(gridFor(settings({ gap: 0 })).perPage, 24, 'no-gap packing');

// Custom page size
const custom = gridFor(settings({ paper: 'custom', pageW: 5, pageH: 5 }));
assert.equal(custom.cols, 1, 'custom columns');
assert.equal(custom.rows, 4, 'custom rows');
assert.equal(custom.page.w, 5, 'custom width');

// Label larger than page never yields zero cells
const huge = gridFor(settings({ paper: 'custom', pageW: 4, pageH: 4, labelW: 6, labelH: 3 }));
assert.equal(huge.cols, 1);
assert.equal(huge.rows, 1);

// Custom page size clamps to sane minimum
assert.equal(pageSize(settings({ paper: 'custom', pageW: 1, pageH: 1 })).w, 3);

// Missing / invalid paper falls back to A4
assert.equal(pageSize(settings({ paper: 'bogus' })).w, 8.27);

// Pagination
const items = Array.from({ length: 27 }, (_, i) => i);
const pages = paginate(items, 26);
assert.equal(pages.length, 2);
assert.equal(pages[0].length, 26);
assert.equal(pages[1].length, 1);
assert.deepEqual(paginate([], 26), [[]], 'empty state still renders a page');

// Import: minimal valid backup fills defaults
const minimal = cleanImport({ labels: [{ name: 'Charizard' }] });
assert.equal(minimal.settings.paper, 'a4');
assert.equal(minimal.labels.length, 1);
assert.equal(minimal.labels[0].name, 'Charizard');
assert.equal(minimal.labels[0].layout, 'thumb');
assert.ok(minimal.labels[0].id);

// Import: rejects malformed payloads
assert.throws(() => cleanImport(null), /backup/);
assert.throws(() => cleanImport({ labels: 'nope' }), /labels/);
assert.throws(() => cleanImport({ labels: [] }), /usable/);
assert.throws(() => cleanImport({ labels: [null, 3, 'x'] }), /usable/);

// Import: settings clamped, unknown fields ignored
const clamped = cleanImport({
  settings: { paper: 'a4', labelW: 999, margin: 'big', cutlines: false, drop: 'me' },
  labels: [{ name: 'x' }],
});
assert.equal(clamped.settings.labelW, 9);
assert.equal(clamped.settings.margin, DEFAULT_SETTINGS.margin);
assert.equal(clamped.settings.cutlines, false);
assert.equal(clamped.settings.border, 1, 'border default');
assert.equal(cleanImport({ settings: { border: 99 }, labels: [{ name: 'x' }] }).settings.border, 6, 'border clamped');
assert.ok(!('drop' in clamped.settings));

// Import: unsafe fields dropped or sanitised
const unsafe = cleanImport({
  settings: {},
  labels: [
    {
      name: 'a'.repeat(300),
      image: 'javascript:alert(1)',
      layout: 'evil',
      theme: 'evil',
      customLines: Array.from({ length: 10 }, (_, i) => `line ${i}`),
      id: 'same',
    },
    { name: 'b', id: 'same' },
  ],
});
assert.equal(unsafe.labels[0].name.length, 200);
assert.equal(unsafe.labels[0].image, null);
assert.equal(unsafe.labels[0].layout, 'thumb');
assert.equal(unsafe.labels[0].theme, '');
assert.equal(unsafe.labels[0].customLines.length, 6);
assert.notEqual(unsafe.labels[0].id, unsafe.labels[1].id, 'duplicate ids replaced');

// Import: valid data image kept
const img = 'data:image/jpeg;base64,AAAA';
assert.equal(cleanImport({ labels: [{ image: img }] }).labels[0].image, img);

// Import: background slot separate from photo slot
const bg = 'data:image/webp;base64,BBBB';
const two = cleanImport({
  labels: [{ image: 'javascript:x', bgImage: bg, bgFit: 'contain', fit: 'bogus' }],
});
assert.equal(two.labels[0].image, null);
assert.equal(two.labels[0].bgImage, bg);
assert.equal(two.labels[0].bgFit, 'contain');
assert.equal(two.labels[0].fit, 'cover');
assert.equal(
  cleanImport({ labels: [{ bgImage: 'javascript:x' }] }).labels[0].bgImage,
  null
);

// Import: logo slot and BGS colour override
const logo = 'data:image/png;base64,CCCC';
const themed = cleanImport({
  labels: [{ logoImage: logo, bgsTone: 'gold' }, { logoImage: 'javascript:x', bgsTone: 'evil' }],
});
assert.equal(themed.labels[0].logoImage, logo);
assert.equal(themed.labels[0].bgsTone, 'gold');
assert.equal(themed.labels[1].logoImage, null);
assert.equal(themed.labels[1].bgsTone, '');
assert.ok(THEMES.includes('tag'), 'TAG theme present');

// BGS tone: override wins, otherwise grade tier
assert.equal(toneFor({ bgsTone: 'silver', gradeValue: '10' }), 'silver');
assert.equal(toneFor({ bgsTone: '', gradeValue: '10' }), 'black');
assert.equal(toneFor({ bgsTone: '', gradeValue: '9.5' }), 'gold');
assert.equal(toneFor({ bgsTone: '', gradeValue: '9' }), 'silver');
assert.equal(toneFor({ bgsTone: '', gradeValue: '' }), 'silver');

// Code 39: quiet empty input, bars for serials
assert.deepEqual(code39Bars(''), []);
assert.ok(code39Bars('PSA 123').length > 0);
assert.ok(code39Bars('abc-123').length > 0);

console.log('check.mjs: all assertions passed');
