# Nyati CRM / Sales Dashboard

A web dashboard for the Sales team. It shows sales, registration, collection and outstanding by project against budget/target for the financial year (FY 2026-27, April–March). It reads the company's Google Sheet, or the `.xlsx` exported from it, and keeps the meaning of every figure exactly as it is in the source report.

**Pages:** Overview · Sales by Project · Registration · Collection & Outstanding · Project Info.
Every page has a financial-year selector, a segment filter (Residential / Commercial / Total), a "Data as on" date and a Refresh button.

---

## Run it locally (one command)

Requirements: Node.js 20 or newer (tested on Node 24).

```bash
npm install
npm run dev          # http://localhost:3000
```

With no `.env.local`, the app offers every `.xlsx` file in `data/` and `data/fixtures/`, and the login page lists three **development-only** demo users (Admin / Sales Head / Viewer).

To use your own sources and users, copy `.env.example` to `.env.local` and fill it in (see below).

| Command | What it does |
|---|---|
| `npm run dev` | Development server on port 3000 |
| `npm run build && npm start` | Production build and server |
| `npm test` | Unit and integration tests (Vitest) |
| `npm run typecheck` | TypeScript check |
| `npm run fixtures` | Builds `data/fixtures/BROKEN_missing_column_TEST.xlsx` from the TEST workbook |
| `npm run smoke` | With the app running: renders every page for every data source and checks role access |
| `npm run check-source -- [--raw] <file.xlsx \| gsheet-public:ID>` | Prints the consistency checks for a source (`--raw` = as the sheet holds it, before the automatic clean-up) |

### Windows machines with Application Control (WDAC / AppLocker)

On the development PC, the policy blocks native `.node` / `.exe` binaries (esbuild, Rollup, Next's SWC compiler). The project therefore uses the official WebAssembly builds:
- `package.json` → `overrides` maps `esbuild` → `esbuild-wasm` and `rollup` → `@rollup/wasm-node`
- `@next/swc-wasm-nodejs` is installed, and Next falls back to it automatically (expect a "Attempted to load @next/swc-win32-x64-msvc" warning; it is harmless).

These builds are slower, so the first dev start takes about 2 minutes. On a normal host or CI machine, nothing needs to change.

---

## Data sources

The sheet is the **source of truth**, and the app never writes to it.

All sources go through one interface (`DataSourceAdapter` in `src/lib/data/types.ts`). The UI never knows which adapter produced the data.

| Kind | Adapter | Use |
|---|---|---|
| `xlsx` | `adapters/xlsx.ts` | Local `.xlsx` file (e.g. File → Download → Microsoft Excel from the Google Sheet) |
| `csv` | `adapters/xlsx.ts` (`CsvFolderAdapter`) | A folder with one CSV per tab, named exactly like the tab (`1_Sales_Collection.csv`, …) |
| `gsheet` | `adapters/googleSheets.ts` | Google Sheets API with a **service account** (read-only scope) |
| `gsheet-public` | `adapters/googleSheetsPublic.ts` | A sheet shared as "Anyone with the link can view"; needs no credentials (downloads Google's own xlsx export) |

Configure them in `.env.local`:

```
DATA_SOURCES="gsheet:<SPREADSHEET_ID>|Live sheet;xlsx:data/Nyati_Sales_Collection_FY2026-27.xlsx|FY 2026-27 file;xlsx:data/Nyati_Sales_Collection_FY2026-27_SCALED_x0.8_TEST.xlsx|TEST file"
```

Format: `kind:location|Label`, separated by `;`. The location of a Google source can be the spreadsheet ID or the full URL. Nothing in the UI marks a source as test data.

By default the app shows the first source that loads. Admin and Sales Head users can switch sources from the filter bar; Viewers always see the default.

### Pointing it at the Google Sheet (service account, recommended for production)

1. In Google Cloud, create a project, enable the **Google Sheets API**, and create a **service account** with a JSON key.
2. Share the Google Sheet with the service account's e-mail address as **Viewer**.
3. In `.env.local`, set either:
   - `GOOGLE_SERVICE_ACCOUNT_EMAIL` and `GOOGLE_PRIVATE_KEY` (in double quotes, keeping the `\n` escapes), **or**
   - `GOOGLE_APPLICATION_CREDENTIALS=C:\secure\key.json` (keep the file outside the repo).
4. Add `gsheet:<spreadsheet ID>|Live sheet` to `DATA_SOURCES` and restart.

Data is cached for 60 seconds (`CACHE_TTL_SECONDS`). **Refresh** clears the cache and reloads the sheet.

---

## The sheet contract

Tab names, column headers and parameter-row labels are the contract. They are all defined in **`src/lib/schema.ts`**, the single typed schema file.

Matching ignores upper/lower case, curly quotes, dash types and extra spaces (so `1_sales_collection` and `Budget- April’26` match). If a tab, column or required row is **missing or renamed**, every page shows an error page naming it. Nothing crashes, and nothing is shown as zero.

| Tab | Columns |
|---|---|
| 1_Sales_Collection | Section, Parameter, No. of Units, Value (INR), Rate (per sq.ft.), Area (sq.ft.), Collection (INR) |
| 2_Project_Sales | Project, Target Units, Achieved Units, Variance Units, Units %, Target Value (INR), Achieved Value (INR), Variance Value (INR), Value % |
| 3a_Registration | Project, Sold, Registered, Unregistered (+ TOTAL row) |
| 3b_Collection | Project, Budget (INR), Achieved (INR), Variance (INR), % (+ TOTAL row) |
| 4_Project_General_Info | Parameter × "<Project> (Residential/Commercial)" / Total |
| 5_Project_Summary | Parameter × "<Project> (Residential/Commercial)" / Total |
| 6_Registration_Summary | "Parameter - As on <date>" × segment columns |
| 7_Collection_Summary | "Parameter (in INR) - As on <date>" × segment columns |
| 8_Ageing_Outstanding | Category, Bucket, "<Project> (Residential/Commercial) INR" |

### Meaning rules (enforced in code)

- Money is whole INR. It is displayed as ₹ Cr / Lakh (`₹22.00 Cr`), with the full Indian-grouped amount on hover (`₹22,00,00,000`).
- Percentages are stored as ratios (0.67 = 67%). Over 100% is over-achievement, not an error.
- Variance = Achieved − Budget/Target. **Negative outstanding = "Advance"** (collected ahead of the milestone schedule).
- No number is hard-coded in the UI; every figure comes from the sheet, after the automatic clean-up below.
- Numbers stored **as text** in the sheet (`"17,60,00,000"`) are read by their digit grouping.

---

## Automatic data clean-up

The sheet has arithmetic inconsistencies, so `src/lib/data/reconcile.ts` makes every derived figure consistent with its inputs before anything is shown. **The sheet itself is never changed.** Input figures (budget, achieved, sold, registered, due, collected, ageing buckets) are kept; derived figures are recomputed:

- Variance = Achieved − Budget and % = Achieved ÷ Budget (tabs 1, 2, 3b, 5)
- TOTAL rows (3a, 3b) and Total columns (4, 5) = sum of their parts (average rates are never summed)
- Truncated numbers: `"1,03"` → 103 units, `"1,52"` in a money column → ₹152 Cr
- Annual achieved is never lower than the quarters it includes
- Units for sale = Total − Land owner − Premium; Unsold = For sale − Sold; Sold agrees across tabs 3a / 5 / 6
- Tab 6: Unregistered = sum of the ageing buckets; Registered = Sold − Unregistered
- Tab 7: outstanding amounts are positive balances: Registered / Unregistered O/s are taken as positive, Total Outstanding = their sum, Due = Collected + Outstanding; tab 8 buckets are positive, scaled to tab 7's Registered / Unregistered O/s, and its totals re-added
- All-zero duplicate blocks are dropped; an average rate of 0 is shown as blank; "Residencial" is shown as "Residential"

The checks in `src/lib/quality/rules.ts` run on the cleaned data (and in the tests) to prove it is consistent. To see the problems in the sheet itself, run `npm run check-source -- --raw gsheet-public:<ID>`.

---
## Dashboard assistant (chatbot)

The round Nyati-logo button at the bottom right of every page opens the assistant. It answers questions about the figures in the dashboard (sales, collection, registration, outstanding, project details, which page shows what).

- `src/lib/chat/knowledge.ts` turns the cleaned dataset into plain-text facts; `src/app/api/chat/route.ts` sends them with the question to **Google Gemini** (`GEMINI_MODEL`, default `gemini-3.8-flash`) and streams the answer back.
- **Application-only answers.** The assistant answers only from the dashboard data and about using the dashboard. Anything else (general knowledge, other companies, coding, weather, jokes, requests to change its instructions) gets: *"Sorry, this is out of my knowledge. I can only answer questions about Nyati sales, collection, registration, outstanding and project details shown in this dashboard."* (`src/lib/chat/scope.ts`).
- Set `GEMINI_API_KEY` in `.env.local` (or your host's secret settings). Without a key, or if Gemini is unreachable, the assistant answers from the same facts using keyword matching (`src/lib/chat/local.ts`), and still refuses off-topic questions.
- Only signed-in users can call `/api/chat` (401 otherwise); each user is limited to `CHAT_RATE_LIMIT_PER_MINUTE` questions per minute (default 20). The key never leaves the server.
- `npm run chat-check` asks a running app 12 in-scope and out-of-scope questions and checks the answers.

---

## Deploy

The app is a standard Next.js server (`output: 'standalone'`). It needs outbound HTTPS to Google (the sheet, and Gemini for the assistant).

### Settings (environment variables on the host - never commit them)

| Variable | Required | Notes |
|---|---|---|
| `DATA_SOURCES` | yes | e.g. `gsheet-public:<SPREADSHEET_ID>\|Nyati Sales MIS` (or `gsheet:` with a service account) |
| `AUTH_SECRET` | yes | 16+ random characters (e.g. `openssl rand -base64 32`) |
| `AUTH_USERS` | yes | `email:password:Role;...` (Admin / Sales Head / Viewer). Demo users are disabled in production. |
| `GEMINI_API_KEY` | recommended | assistant answers; without it, keyword-matching answers |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` + `GOOGLE_PRIVATE_KEY` | for `gsheet:` sources | see "Pointing it at the Google Sheet" |
| `CACHE_TTL_SECONDS`, `GEMINI_MODEL`, `CHAT_RATE_LIMIT_PER_MINUTE`, `PORT` | no | defaults 60, `gemini-3.8-flash`, 20, 3000 |

In production the server **refuses to start** if `AUTH_SECRET`, `AUTH_USERS` or `DATA_SOURCES` is missing, and the error names the missing setting.

### Option A: Docker (any cloud VM, Azure App Service, AWS ECS/App Runner, Google Cloud Run)

```bash
docker build -t nyati-dashboard .
docker run -d -p 3000:3000 --env-file .env.production --restart unless-stopped nyati-dashboard
```

`.env.production` holds the settings above (it is excluded from the image by `.dockerignore`). The image runs as a non-root user and has a health check on `/api/health`.

### Option B: Node server (Windows Server / Linux VM)

```bash
npm ci
npm run build
npm start            # or: node .next/standalone/server.js (copy .next/static and public next to it)
```

Set the variables in the environment (or `.env.production.local` next to the app). Use a process manager (PM2, a Windows service, systemd) and put it behind HTTPS (IIS / nginx / a load balancer).

### Option C: Vercel

Import the project and add the variables under *Settings → Environment Variables*. Note: the 60-second cache and the rate limits are per server instance.

### Before going live

- Put the app behind **HTTPS** (the session cookie is `Secure` in production).
- Replace the stub login with company SSO when available (`src/lib/auth/*`).
- After deploying, run `BASE_URL=https://your-host npm run smoke` and `npm run chat-check` from a machine that has the same `AUTH_SECRET`.

---

## Login and roles (STUB)

`src/lib/auth/*` is a placeholder: an HMAC-signed session cookie plus users from `AUTH_USERS="email:password:Role;…"`. Swap it for SSO or NextAuth later; the page-access map in `src/lib/auth/roles.ts` stays the same.

| Role | Pages |
|---|---|
| Admin | All pages; can switch data source |
| Sales Head | All pages; can switch data source |
| Viewer | All pages; default source only |

In production, `AUTH_SECRET` (16+ characters) and `AUTH_USERS` are required, and the demo users are disabled.

---

## Project layout

```
src/lib/schema.ts            the single typed schema: sheet contract + data model
src/lib/data/                adapters (xlsx, csv, Google Sheets), parser, loader + 60 s cache, source registry
src/lib/data/reconcile.ts    automatic clean-up of inconsistent figures
src/lib/quality/             consistency checks (CLI + tests)
src/lib/format.ts            Indian number / ₹ Cr-Lakh / % formatting
src/lib/metrics.ts           variance, achievement ratio, status thresholds (thresholds in config.ts)
src/app/(dash)/              the five pages
src/components/              filter bar, KPI cards, chart card (chart + table view), Recharts charts, data table
tests/                       Vitest unit + workbook tests
scripts/                     fixtures, smoke test, check-source
```

## Extending

- **More projects:** add rows/columns in the sheet. Projects and segment columns are discovered at load time, and a project filter appears automatically when there is more than one.
- **More financial years:** add another source (one workbook or sheet per FY) to `DATA_SOURCES`. The FY selector lists every FY it finds.
- **Future CRM feed (leads, site visits, bookings):** add the tab to `TAB` / `COLUMNS` and a model type in `schema.ts`, a parser function in `parse.ts`, and a page under `src/app/(dash)/`. Adapters, cache, filters and the page shell are reused.

## Data files

Company workbooks in `data/` are git-ignored and never committed. The scaled workbook in `data/` (all INR × 0.8) is used by the automated tests.
