// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: blue; icon-glyph: pound-sign;

// Spendings — Scriptable widget.
// The easiest way to get this script: in the Spendings app open
// “⋯” → “Copy widget script” — the values below are filled in for you.
const TOKEN = '';   // GitHub token with the gist scope
const GIST_ID = ''; // ID of the gist that holds the data
const APP_URL = ''; // app link (opened when you tap the widget)

// Widget parameter (long-press → Edit Widget → Parameter):
// for the small widget you can enter a category name, e.g. “Groceries”.
// Without a parameter the small widget shows the total budget.

const FILE = 'spendings.json';
const BG = new Color('#16171a');
const SURFACE = new Color('#2a2c31');
const MUTED = new Color('#9a9ca3');
const DANGER = '#ef6b6b';
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const money = (n) => '£' + (Math.abs(n) >= 1000 || Number.isInteger(n)
  ? Math.round(n).toLocaleString('en-GB')
  : n.toFixed(2));

async function loadData() {
  const fm = FileManager.local();
  const cachePath = fm.joinPath(fm.cacheDirectory(), 'spendings-widget-cache.json');
  try {
    if (!TOKEN || !GIST_ID) throw new Error('not-configured');
    const req = new Request(`https://api.github.com/gists/${GIST_ID}`);
    req.headers = {
      Authorization: `Bearer ${TOKEN}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'Spendings-Widget',
    };
    const gist = await req.loadJSON();
    const file = gist && gist.files && gist.files[FILE];
    if (!file) throw new Error(gist && gist.message ? gist.message : 'Data file not found');
    let content = file.content;
    if (file.truncated) content = await new Request(file.raw_url).loadString();
    const data = JSON.parse(content);
    fm.writeString(cachePath, content);
    return { data, stale: false };
  } catch (e) {
    if (e.message !== 'not-configured' && fm.fileExists(cachePath)) {
      return { data: JSON.parse(fm.readString(cachePath)), stale: true };
    }
    throw e;
  }
}

function compute(db) {
  const now = new Date();
  const key = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const spent = {};
  for (const e of db.expenses || []) {
    if (String(e.date).slice(0, 7) === key) spent[e.catId] = (spent[e.catId] || 0) + e.amount;
  }
  const cats = (db.categories || []).map((c) => {
    const s = spent[c.id] || 0;
    return { ...c, spent: s, pct: c.budget > 0 ? (s / c.budget) * 100 : 0 };
  });
  const totalBudget = cats.reduce((t, c) => t + c.budget, 0);
  const totalSpent = cats.reduce((t, c) => t + c.spent, 0);
  return {
    month: MONTHS[now.getMonth()],
    cats,
    totalBudget,
    totalSpent,
    totalPct: totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0,
  };
}

// Draws one "bubble": a circle filled from the bottom up to pct (capped at 100%).
function bubble(size, { pct, color, emoji, sub }) {
  const ctx = new DrawContext();
  ctx.size = new Size(size, size);
  ctx.opaque = false;
  ctx.respectScreenScale = true;

  const r = size / 2;
  const over = pct > 100;
  const main = over ? DANGER : color;
  const full = new Rect(0, 0, size, size);

  ctx.setFillColor(SURFACE);
  ctx.fillEllipse(full);

  const h = Math.min(Math.max(pct, 0), 100) / 100;
  ctx.setFillColor(new Color(main));
  if (h >= 0.999) {
    ctx.fillEllipse(full);
  } else if (h > 0) {
    // circular segment below the horizontal line y = size * (1 - h)
    const a = Math.asin(((size * (1 - h)) - r) / r);
    const path = new Path();
    const steps = 64;
    for (let i = 0; i <= steps; i++) {
      const t = a + ((Math.PI - 2 * a) * i) / steps;
      const p = new Point(r + r * Math.cos(t), r + r * Math.sin(t));
      if (i === 0) path.move(p); else path.addLine(p);
    }
    path.closeSubpath();
    ctx.addPath(path);
    ctx.fillPath();
  }

  const lw = Math.max(2, size * 0.035);
  ctx.setStrokeColor(new Color(main, over ? 1 : 0.55));
  ctx.setLineWidth(lw);
  ctx.strokeEllipse(new Rect(lw / 2, lw / 2, size - lw, size - lw));

  ctx.setTextAlignedCenter();
  ctx.setTextColor(Color.white());
  const top = sub ? 0.13 : 0.16;
  if (emoji) {
    ctx.setFont(Font.systemFont(size * 0.2));
    ctx.drawTextInRect(emoji, new Rect(0, size * top, size, size * 0.26));
  }
  ctx.setFont(Font.boldRoundedSystemFont(size * (sub ? 0.22 : 0.25)));
  ctx.drawTextInRect(`${Math.round(pct)}%`, new Rect(0, size * (emoji ? top + 0.25 : 0.34), size, size * 0.32));
  if (sub) {
    ctx.setTextColor(new Color('#ffffff', 0.8));
    ctx.setFont(Font.mediumSystemFont(size * 0.095));
    ctx.drawTextInRect(sub, new Rect(size * 0.08, size * (emoji ? 0.66 : 0.62), size * 0.84, size * 0.14));
  }
  return ctx.getImage();
}

function centered(parent, build) {
  const row = parent.addStack();
  row.layoutHorizontally();
  row.addSpacer();
  build(row);
  row.addSpacer();
  return row;
}

function text(stack, value, { size = 12, color = Color.white(), weight = 'regular', lines = 1 } = {}) {
  const t = stack.addText(value);
  t.font = weight === 'bold' ? Font.boldSystemFont(size) : weight === 'semibold' ? Font.semiboldSystemFont(size) : Font.systemFont(size);
  t.textColor = color;
  t.lineLimit = lines;
  t.minimumScaleFactor = 0.7;
  return t;
}

function leftLine(stack, s, budget) {
  const left = budget - s;
  return left >= 0
    ? { value: `${money(left)} left`, color: MUTED }
    : { value: `${money(-left)} over`, color: new Color(DANGER) };
}

function buildSmall(w, m) {
  const param = (args.widgetParameter || '').trim().toLowerCase();
  const cat = param ? m.cats.find((c) => c.name.toLowerCase() === param) : null;
  const title = cat ? cat.name : m.month;
  const s = cat ? cat.spent : m.totalSpent;
  const b = cat ? cat.budget : m.totalBudget;
  const pct = cat ? cat.pct : m.totalPct;

  text(w, title, { size: 13, weight: 'semibold' }).centerAlignText();
  w.addSpacer(4);
  centered(w, (row) => {
    const img = row.addImage(bubble(200, {
      pct,
      color: cat ? cat.color : '#2f6fde',
      emoji: cat ? cat.emoji : '',
      sub: `${money(s)} / ${money(b)}`,
    }));
    img.imageSize = new Size(88, 88);
  });
  w.addSpacer(4);
  const l = leftLine(w, s, b);
  text(w, l.value, { size: 11, color: l.color }).centerAlignText();
}

function buildGrid(w, m, family) {
  const header = w.addStack();
  header.layoutHorizontally();
  header.centerAlignContent();
  text(header, m.month, { size: 15, weight: 'bold' });
  header.addSpacer();
  text(header, money(m.totalSpent), { size: 14, weight: 'bold', color: m.totalSpent > m.totalBudget ? new Color(DANGER) : Color.white() });
  text(header, ` of ${money(m.totalBudget)}`, { size: 13, color: MUTED });

  if (family === 'large') {
    w.addSpacer(2);
    const l = leftLine(w, m.totalSpent, m.totalBudget);
    text(w, l.value, { size: 12, color: l.color });
  }

  const perRow = 4;
  const maxRows = family === 'large' ? 3 : 1;
  const shown = m.cats.slice(0, perRow * maxRows);
  const bubbleSize = family === 'large' ? 64 : 62;

  if (family === 'large') w.addSpacer(16); else w.addSpacer();
  for (let r = 0; r * perRow < shown.length; r++) {
    if (r > 0) w.addSpacer(10);
    const row = w.addStack();
    row.layoutHorizontally();
    const rowCats = shown.slice(r * perRow, r * perRow + perRow);
    for (let i = 0; i < perRow; i++) {
      if (i > 0) row.addSpacer();
      const col = row.addStack();
      col.layoutVertically();
      col.size = new Size(72, 0);
      const c = rowCats[i];
      if (!c) continue;
      centered(col, (line) => {
        const img = line.addImage(bubble(180, { pct: c.pct, color: c.color, emoji: c.emoji }));
        img.imageSize = new Size(bubbleSize, bubbleSize);
      });
      col.addSpacer(3);
      centered(col, (line) => {
        text(line, c.name, { size: 11, color: c.pct > 100 ? new Color(DANGER) : Color.white(), weight: 'semibold' });
      });
    }
  }
  w.addSpacer();
  const hidden = m.cats.length - shown.length;
  if (hidden > 0) text(w, `+${hidden} more`, { size: 10, color: MUTED }).rightAlignText();
}

function message(w, title, body) {
  text(w, title, { size: 14, weight: 'bold' });
  w.addSpacer(4);
  text(w, body, { size: 12, color: MUTED, lines: 4 });
}

async function main() {
  const family = config.widgetFamily || 'medium';
  const w = new ListWidget();
  w.backgroundColor = BG;
  w.setPadding(12, 14, 12, 14);
  w.refreshAfterDate = new Date(Date.now() + 15 * 60 * 1000);
  if (APP_URL) w.url = APP_URL;

  try {
    const { data, stale } = await loadData();
    const m = compute(data);
    if (!m.cats.length) {
      message(w, 'Spendings', 'Create categories in the app and they will show up here.');
    } else if (family === 'small') {
      buildSmall(w, m);
    } else {
      buildGrid(w, m, family);
    }
    if (stale) {
      const t = text(w, 'offline — showing saved data', { size: 9, color: MUTED });
      t.centerAlignText();
    }
  } catch (e) {
    if (e.message === 'not-configured') {
      message(w, 'Spendings', 'Open the app → “⋯” → “Copy widget script” and paste it here.');
    } else {
      message(w, 'Spendings', `Could not load data: ${e.message}`);
    }
  }

  if (config.runsInWidget) {
    Script.setWidget(w);
  } else if (family === 'small') {
    await w.presentSmall();
  } else if (family === 'large') {
    await w.presentLarge();
  } else {
    await w.presentMedium();
  }
  Script.complete();
}

await main();
