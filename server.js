require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const SHEET_ID = process.env.SHEET_ID || '1HWfIjPqARGR8UqUEtKlO5YZ_9_QyE6vjcSU4P4Fd3rM';
const RBIA_SHEET_ID = '183p2yP9ViMqmJvGDH4YE0JB1EhocuPUt3PFCpr5_zyg';
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const PUBLIC_DIR = path.join(__dirname, 'public');

// Serve Chart.js from local node_modules (no CDN dependency)
app.get('/chart.min.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'node_modules/chart.js/dist/chart.umd.min.js'));
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
  // Trim header names to remove any accidental whitespace from the sheet
  const headers = table.cols.map(c => (c.label || c.id).trim());

  const rows = (table.rows || [])
    .map(row => (row.c || []).map(cell => {
      if (!cell || cell.v === null || cell.v === undefined) return '';
      return cell.f ?? String(cell.v);
    }))
    .filter(row => row.some(cell => cell.trim()));

  return { headers, rows };
}

async function fetchGvizSheet(sheetId, sheetParam, headersMode = 1) {
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json&${sheetParam}&headers=${headersMode}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!res.ok) throw new Error(`Google Sheets returned ${res.status}.`);
  const text = await res.text();
  const match = text.match(/google\.visualization\.Query\.setResponse\(([\s\S]*)\);?\s*$/);
  if (!match) throw new Error('Unexpected response format from Google Sheets.');
  const { table } = JSON.parse(match[1]);
  const headers = table.cols.map(c => (c.label || c.id).trim());
  const rows = (table.rows || [])
    .map(row => (row.c || []).map(cell => {
      if (!cell || cell.v === null || cell.v === undefined) return '';
      return cell.f ?? String(cell.v);
    }))
    .filter(row => row.some(cell => cell.trim()));
  return { headers, rows };
}

async function fetchViaSheetsAPI() {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/A:Z?key=${GOOGLE_API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Sheets API error ${res.status}`);
  }
  const data = await res.json();
  const [rawHeaders, ...rows] = data.values || [];
  const headers = (rawHeaders || []).map(h => h.trim());
  return {
    headers,
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

    // Filter to rows that have both a date (M) and a customer — by name, not position
    const active = all.filter(r => r['M']?.trim() && r['CUSTOMER']?.trim());

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

app.get('/api/rbia-wo', async (req, res) => {
  try {
    const { headers: rawHeaders, rows } = await fetchGvizSheet(RBIA_SHEET_ID, 'sheet=rbia+w%2Fo');
    // Column D has no label in the sheet — rename it to DESCRIPTION
    const headers = rawHeaders.map((h, i) => (h === '' && i === 3) ? 'DESCRIPTION' : h);
    const all = buildRecords(headers, rows);
    const active = all.filter(r => r['CUSTOMER']?.trim() || r['DISC']?.trim());
    res.json({ headers, rows: active, total: active.length, fetched: new Date().toISOString() });
  } catch (err) {
    console.error('[api/rbia-wo]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// rbia po's tab has no header row — use headers=0 and map by position
const RBIA_PO_COLS = ['ORDER_DATE', 'PO_NUM', 'VENDOR', 'BUYER', 'DESCRIPTION', 'ACCOUNT', 'INVOICE_NUM', 'RECEIVED_DATE', 'RECEIVED_BY', 'NOTES'];

app.get('/api/rbia-po', async (req, res) => {
  try {
    const { rows } = await fetchGvizSheet(RBIA_SHEET_ID, 'gid=1831326038', 0);
    const all = rows.map(row => {
      const record = {};
      RBIA_PO_COLS.forEach((name, i) => { record[name] = row[i] ?? ''; });
      return record;
    });
    const active = all.filter(r => r['PO_NUM']?.trim());
    res.json({ rows: active, total: active.length, fetched: new Date().toISOString() });
  } catch (err) {
    console.error('[api/rbia-po]', err.message);
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
