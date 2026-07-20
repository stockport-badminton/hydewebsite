# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Server-rendered Express/EJS website for Hyde Badminton Club. No build step, no test suite, no linter configured.

## Commands

- `npm start` — run the server (`node server.js`) on `PORT` env var or 3000.
- `npm run dev` — run with `nodemon` for auto-restart on file changes. Use this while developing.
- There are no test or lint scripts in this repo.

## Architecture

**Entry point:** `server.js` just requires `app.js` and calls `.listen()`. All actual logic lives in `app.js` as a single flat file of Express route handlers — there is no router/controller/model split.

**Content sources — three distinct patterns coexist in `app.js`:**
1. **Contentful CMS** — most static pages (`/`, `/how-to-find-us`, `/links`, `/history/:season`, `/gallery`, `/news`, `/contact-us`) fetch a specific entry by hardcoded Contentful entry ID via `client.getEntry(id)`, convert the rich-text field with `documentToHtmlString`, and render it through the generic `views/homepage.ejs` template (which just drops the resulting HTML string into the page via `entry`). The Contentful space ID and access token are hardcoded at the top of `app.js`, not read from env vars.
2. **Live scraping of external league sites** — `/getMancFixtures`, `/tables`, and `/fixtures/:team` fetch HTML from `manchesterbadmintonleague.org.uk` and JSON/HTML from `tameside-badminton.co.uk` using raw `https.get` (not a promise-based HTTP client) and parse it with `cheerio`. Results from both sources are normalized into a common shape (`date`, `competition`, `opposition`, `homeOrAway`, `result`, etc.), concatenated, and sorted by date. Team-name matching against "Hyde" substrings and a `historyMap`/`tamesideTeam` switch statement is brittle string matching tied to the external sites' exact markup/naming — if either site changes its HTML structure or team naming, these routes break silently (errors are just `console.error`'d, not surfaced well to the user).
3. **Static/no-op fallback** — the catch-all 404 handler renders `homepage.ejs` with an error message.

**Views (`views/*.ejs`):** `header.ejs` and `footer.ejs`/`nav.ejs` are included at the top/bottom of every page via `<%- include(...) %>`. `homepage.ejs` is the generic single-column template reused across most CMS-backed routes (it just injects a pre-rendered HTML blob as `entry`). `fixtures.ejs`, `tables.ejs`, and `gallery.ejs` are purpose-built templates that iterate over structured data (arrays/objects) passed in as `entry`/`result`, rather than raw HTML.

**Styling:** `bootstrap/style.sass` is compiled by `node-sass-middleware` (configured in `app.js`) into `public/style.css`, served at `/public`. Despite the `.sass` extension, the file's contents are actually SCSS syntax (`@import "../node_modules/bootstrap/scss/bootstrap"`) — the middleware is configured with `indentedSyntax: false`, so it parses everything as SCSS regardless of the file extension. Don't "fix" the file to indented Sass syntax; that would break the build.

**Static assets:** `static/` (custom JS/images) is served at `/static`; the entire `node_modules` tree is also exposed at `/scripts` specifically so `static/js/main.js` can `import` Bootstrap's client-side JS bundle directly from `node_modules/bootstrap/dist/js/bootstrap.bundle.min.js` as an ES module in the browser.

**Deployment:** Google App Engine, `runtime: nodejs20` (`app.yaml`). `.gcloudignore` excludes `node_modules` and git metadata from deploys.
