# Dashboard — Claude Code Instructions

## Project Identity
- **Repo:** https://github.com/dluvin-del/Dashboard
- **Working branch:** gh-main
- **Purpose:** AG Service Desk service call metrics dashboard for American Irrigation

## Session Start Protocol
At the start of every session:
1. Run `git status` and `git log --oneline -5` to confirm branch and recent history
2. Read `index.html`, `server.js`, and any files in `public/` to understand current state
3. Provide a brief summary of the dashboard's current structure and last changes

## Key Files
- `index.html` — Main dashboard UI
- `server.js` — Backend/data serving logic
- `public/` — Static assets
- `package.json` — Dependencies and scripts
- `.env.example` — Environment variable reference (never commit `.env`)

## Coding Conventions
- Keep all UI changes in `index.html` unless extracting to `public/`
- Do not introduce new npm dependencies without confirming with the user
- Preserve existing variable/function naming unless explicitly asked to refactor
- Keep service desk metrics logic clearly commented

## Git Workflow — ALWAYS FOLLOW
- Always work on branch `gh-main`
- Before making any changes: `git checkout gh-main && git pull origin gh-main`
- After completing any change: stage, commit with a descriptive message, and push
