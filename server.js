require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const SHEET_ID = process.env.SHEET_ID || '1HWfIjPqARGR8UqUEtKlO5YZ_9_QyE6vjcSU4P4Fd3rM';
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const PUBLIC_DIR = path.join(__dirname, 'public');

// Find logo: tries logo.* first, then any image file in public/
app.get('/logo', (req, res) => {
  const files = fs.readdirSync(PUBLIC_DIR);
  const logo = files.find(f => /^logo\./i.test(f))
    || files.find(f => /\.(png|jpg|jpeg|svg|webp|gif)$/i.test(f));
  if (logo) return res.sendFile(path.join(PUBLIC_DIR, logo));
  res.status(404).json({ files, hint: 'Place your logo image in the public/ folder' });
});

app.use(express.static(PUBLIC_DIR));

async function fetchViaGviz() {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json`;
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!res.ok) throw new Error(`Google Sheets returned ${res.status}. Ensure the sheet is shared with "Anyone with the link can view".`);

  const text = await res.text();
  const match = text.match(/google\.visualization\.Query\.setResponse\(([\s\S]*)\);?\s*$/);
  if (!match) throw new Error('Unexpected response format from Google Sheets.');

  const { table } = JSON.parse(match[1]);
  const headers = table.cols.map(c => c.label || c.id);

  const rows = (table.rows || [])
    .map(row => (row.c || []).map(cell => {
      if (!cell || cell.v === null || cell.v === undefined) return '';
      return cell.f ?? String(cell.v);
    }))
    .filter(row => row.some(cell => cell.trim()));

  return { headers, rows };
}

async function fetchViaSheetsAPI() {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/A:J?key=${GOOGLE_API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Sheets API error ${res.status}`);
  }
  const data = await res.json();
  const [headers, ...rows] = data.values || [];
  return {
    headers: headers || [],
    rows: (rows || []).filter(r => r.some(c => c?.trim()))
  };
}

function buildRecords(headers, rows) {
  return rows.map(row => {
    const record = {};
    headers.forEach((h, i) => { record[h] = row[i] ?? ''; });
    return record;
  });
}

app.get('/api/data', async (req, res) => {
  try {
    const { headers, rows } = GOOGLE_API_KEY
      ? await fetchViaSheetsAPI()
      : await fetchViaGviz();

    const all = buildRecords(headers, rows);

    // Only count rows that have a date (col 0) AND a customer (col 3) — by position, not name
    const active = all.filter(r => {
      const vals = Object.values(r);
      return vals[0]?.trim() && vals[3]?.trim();
    });

    res.json({
      headers,
      rows: active,
      total: active.length,
      fetched: new Date().toISOString()
    });
  } catch (err) {
    console.error('[api/data]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Debug endpoint — visit http://localhost:3000/api/debug to inspect raw data
app.get('/api/debug', async (req, res) => {
  try {
    const { headers, rows } = GOOGLE_API_KEY
      ? await fetchViaSheetsAPI()
      : await fetchViaGviz();
    const all = buildRecords(headers, rows);
    res.json({
      headers,
      totalRawRows: rows.length,
      first5: all.slice(0, 5),
      last5: all.slice(-5),
      publicFiles: fs.readdirSync(PUBLIC_DIR)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Service Order Dashboard → http://localhost:${PORT}`);
});
