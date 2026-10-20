// Reads the shift roster from the shared Google Sheet and returns it as JSON:
// [{ name, date: 'YYYY-MM-DD', st, en } | { name, date, off: true, label }]
const SHEET_ID = process.env.SHEET_ID || '1gZLR1cRGpVOpX3okwepuprAwxq7JqF_95Lb9nmQlDJA';
const SHEET_GID = process.env.SHEET_GID || '934440999';

function parseCsv(text) {
  const rows = [];
  let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++ }
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row) }
  return rows;
}

const pad = (n) => String(n).padStart(2, '0');
const time = (s) => { const m = s.match(/^(\d{1,2})[:.](\d{2})$/); return m ? pad(+m[1]) + ':' + m[2] : null };

function toDate(s) {
  const m = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (!m) return null;
  const y = m[3].length === 2 ? 2000 + +m[3] : +m[3];
  return `${y}-${pad(+m[2])}-${pad(+m[1])}`;
}

function parseRoster(rows) {
  const out = [];
  let dates = null;
  for (const r of rows) {
    const cells = r.map((c) => c.trim());
    const ds = cells.map(toDate);
    if (ds.some(Boolean)) { dates = ds; continue }
    const name = cells[1];
    if (!dates || !name) continue;
    for (let i = 2; i < cells.length; i++) {
      const date = dates[i], v = cells[i];
      if (!date || !v) continue;
      const p = v.split(/\s*[-–]\s*/);
      const st = p.length === 2 && time(p[0]), en = p.length === 2 && time(p[1]);
      out.push(st && en ? { name, date, st, en } : { name, date, off: true, label: v });
    }
  }
  return out;
}

export default async () => {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${SHEET_GID}`;
  const res = await fetch(url, { redirect: 'follow' });
  const type = res.headers.get('content-type') || '';
  if (!res.ok || !type.includes('csv')) {
    return Response.json({ error: 'อ่าน Google Sheet ไม่ได้ ตรวจสอบว่าแชร์เป็น “ทุกคนที่มีลิงก์ดูได้”' }, { status: 502 });
  }
  const items = parseRoster(parseCsv(await res.text()));
  return Response.json({ items, fetched: new Date().toISOString() }, {
    headers: { 'Cache-Control': 'public, max-age=0, must-revalidate', 'Netlify-CDN-Cache-Control': 'public, s-maxage=120' },
  });
};

export const config = { path: '/api/sheet-schedule' };
