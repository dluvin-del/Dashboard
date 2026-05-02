# Dashboard — Claude Code Instructions

## Repo & Branch
- **Repo:** https://github.com/dluvin-del/Dashboard
- **Working branch:** gh-pages

## Rules — Always Follow
1. Do not create a new repo.
2. Do not switch branches unless told to.
3. Pull the latest version of gh-pages before editing.
4. Make all changes only in this repo.
5. After changes, show modified files and commit message before pushing.
6. If you cannot access the repo or branch, stop and tell me.

## Session Start Protocol
1. `git checkout gh-pages && git pull origin gh-pages`
2. Read `index.html` to confirm current state
3. Provide a brief summary of the last commit and any visible recent changes

## Architecture
- Single file: `index.html` — all HTML, CSS, and JS self-contained
- Data fetched client-side from Google Sheets via `gviz/tq?tqx=out:json`
- No API key needed — sheets must be set to "Anyone with the link can view"
- Chart.js v4.4.3 from CDN with `onload` ready-flag pattern
- `logo.png` lives in repo root alongside `index.html`
- 3 panels, auto-rotate (2/5/10/30 min intervals), progress bar, countdown, pause/play

## Panel 0 — Service Orders
- Sheet ID: `1HWfIjPqARGR8UqUEtKlO5YZ_9_QyE6vjcSU4P4Fd3rM`
- Columns: M (date), SERVICE ORDER #, INVOICE #, Invoice Amount, CUSTOMER, SITE NAME, JOB INFO, GOOGLE PIN LOCATION, TECH., COMMENTS
- Filter: rows must have both M and CUSTOMER non-empty
- Stats: Total Orders, Invoiced, Pending, Technicians, Customers
- Charts: Jobs by Date bar, Invoiced vs Open doughnut (% labels), Invoice Amount by Date bar
- Features: Filters, sortable paginated table, sidebar with tech breakdown and recent orders

## Panel 1 — Analytics
- Same data source as Panel 0
- Tech breakdown cards (jobs/invoiced/pending + invoice rate bar)
- Charts: Jobs by Tech horizontal bar, Top Customers horizontal bar

## Panel 2 — RB W/O
- Sheet ID: `183p2yP9ViMqmJvGDH4YE0JB1EhocuPUt3PFCpr5_zyg`, tab: `rbia w/o`
- Columns: DISC, CUSTOMER, SITE, ORDER #, JOB LOCATION, EST. #, PHOTO, TECH., INVOICE #
- Filter: rows must have CUSTOMER non-empty
- Stats: Total Jobs, Invoiced, Pending, Technicians, Customers
- Charts: Jobs by Tech horizontal bar, Invoiced vs Open doughnut

## Key Implementation Details
- All header names are `.trim()`'d on fetch — handles leading/trailing spaces
- Column matching is by name, not position — safe if columns are reordered
- `Invoice Amount` is mixed case — must match exactly
- `fetchGviz(sheetId, sheetName)` is shared helper; both sheets load in parallel via `loadAll()`
- `makeBarLabelPlugin(fmt)` draws value labels above bars
- `makePctPlugin()` draws % inside doughnut slices
- Rotation: `NUM_PANELS = 3`; manual tab click pauses, auto-resumes after 30s

## Git Workflow
- Deploy branch is `gh-pages` — pushing here updates the live GitHub Pages site
- Never push untested changes without showing the diff and commit message first
