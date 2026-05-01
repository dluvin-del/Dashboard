require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const SHEET_ID = process.env.SHEET_ID || '1HWfIjPqARGR8UqUEtKlO5YZ_9_QyE6vjcSU4P4Fd3rM';
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;

app.use(express.static(path.join(__dirname, 'public')));

const fs = require('fs');
// Serve logo regardless of file extension case
app.get('/logo.:ext', (req, res) => {
  const exts = [req.params.ext, req.params.ext.toUpperCase(), req.params.ext.toLowerCase()];
  for (const ext of exts) {
    const file = path.join(__dirname, 'public', `logo.${ext}`);
    if (fs.existsSync(file)) return res.sendFile(file);
  }
  res.status(404).send('Logo not found');
});

async function fetchViaGviz() {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });
  if (!res.ok) throw new Error(`Google Sheets returned ${res.status}. Ensure the sheet is shared with "Anyone with the link can view".`);

  const text = await res.text();
  // Strip JSONP wrapper: /*O_o*/google.visualization.Query.setResponse({...});
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

app.get('/api/data', async (req, res) => {
  try {
    const { headers, rows } = GOOGLE_API_KEY
      ? await fetchViaSheetsAPI()
      : await fetchViaGviz();

    const records = rows
      .map(row => {
        const record = {};
        headers.forEach((h, i) => { record[h] = row[i] ?? ''; });
        return record;
      })
      // Keep only rows with at least 3 non-empty fields (excludes pre-allocated placeholder rows)
      .filter(r => Object.values(r).filter(v => String(v).trim()).length >= 3);

    res.json({
      headers,
      rows: records,
      total: records.length,
      fetched: new Date().toISOString()
    });
  } catch (err) {
    console.error('[api/data]', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Service Order Dashboard → http://localhost:${PORT}`);
});
