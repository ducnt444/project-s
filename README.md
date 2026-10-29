# Project S

A personal stocks web app: import your trade history, ask for stocks in plain English, chart your gains and losses, and get email alerts when prices move.

| Area | Stack |
|---|---|
| Backend | Node.js 22, NestJS 12, TypeORM, PostgreSQL |
| Frontend | Angular 21 (standalone components, signals), Chart.js |
| AI | Claude API (`@anthropic-ai/sdk`) for reading screenshots and parsing screener questions |
| Market data | [Financial Modeling Prep](https://site.financialmodelingprep.com), or built-in mock data when no key is set |
| Email | SMTP via Nodemailer ([Mailpit](https://mailpit.axllent.org) for local dev) |

## Features

1. **Import trade history**
   - **Screenshots**: upload an image from your brokerage app. Claude extracts the trades, and you review or edit the rows before they are saved.
   - **JSON**: upload an array of trades or `{ "trades": [...] }`. See [`samples/trades.json`](samples/trades.json).
2. **Natural-language screener**: e.g. *"large-cap healthcare stocks yielding over 3% with beta under 1"*. Claude turns the question into structured filters (shown in the UI), and the market data provider runs them.
3. **Charts**: realized P/L by month and by symbol (FIFO lot matching, fees included), plus win rate and open positions.
4. **Email alerts**: price above/below, or daily % change above/below, with a cooldown or one-shot option. A background monitor polls quotes every `ALERT_POLL_SECONDS` (30 s by default).
5. **Accounts**: email and password registration, bcrypt hashing, JWT bearer auth. All data is scoped to the signed-in user.

## Getting started

Prerequisites: Node.js 22.12+ and Docker (or a local PostgreSQL 16).

```bash
# 1. Database + mail catcher
docker compose up -d

# 2. Backend (http://localhost:3000/api)
cd backend
cp .env.example .env        # set JWT_SECRET; add ANTHROPIC_API_KEY / FMP_API_KEY when you have them
npm install
npm run start:dev

# 3. Frontend (http://localhost:4200, proxies /api to the backend)
cd ../frontend
npm install
npm start
```

Alert emails go to Mailpit's inbox at http://localhost:8025.

Without `ANTHROPIC_API_KEY`, screenshot import and the screener return `503 AI features are not configured`; everything else works. Without `FMP_API_KEY`, the screener and alerts use a small mock universe whose prices follow a random walk, so you can try alerts offline.

## Project layout

```
backend/src
  auth/        register, login, JWT strategy and guard
  users/       User entity
  trades/      Trade entity, JSON import, screenshot import (preview only)
  ai/          Claude calls: screenshot to trades, question to screener filter
  analytics/   FIFO realized P/L (pnl.ts, unit tested), summary endpoint
  market/      MarketDataProvider interface, FMP and mock implementations
  screener/    POST /screener/query
  alerts/      Alert CRUD, condition evaluation (unit tested), polling monitor
  mail/        SMTP sender (logs instead when SMTP_URL is empty)
frontend/src/app
  core/        auth service, interceptor, guards, API client, models
  pages/       login, dashboard, trades, screener, alerts
  shared/      P/L bar chart
```

## API

All routes are under `/api` and need `Authorization: Bearer <token>`, except `auth/register`, `auth/login` and `health`.

| Method | Path | Purpose |
|---|---|---|
| POST | `/auth/register`, `/auth/login` | Returns `{ accessToken, user }` |
| GET | `/auth/me` | Current user |
| GET | `/trades?symbol=` | List trades |
| POST | `/trades` | Save reviewed rows: `{ trades, source: "manual" \| "image" }` |
| POST | `/trades/import/json` | Import a JSON export |
| POST | `/trades/import/image` | Multipart `file`; returns extracted rows without saving them |
| DELETE | `/trades/:id` | Delete a trade |
| GET | `/analytics/summary` | Totals, P/L by symbol and month, open positions |
| POST | `/screener/query` | `{ prompt }` returns `{ filter, results }` |
| GET/POST | `/alerts` | List or create alerts |
| PATCH/DELETE | `/alerts/:id` | Update (re-arms the alert) or delete |

## Development notes

- `DB_SYNCHRONIZE=true` lets TypeORM create tables from the entities. Turn it off and add migrations before deploying anywhere real.
- Both packages include `.npmrc` with `legacy-peer-deps=true`. This works around an npm 10 peer-resolution crash with the current Angular and Nest releases.
- Tests: `cd backend && npm test` (P/L and alert logic). CI runs lint, tests and builds for both apps on every push and pull request.

## Roadmap ideas

- Streaming quotes (WebSocket feed) instead of polling, for faster alerts
- Natural-language alerts ("tell me if NVDA drops 5% in a day")
- Unrealized P/L using live quotes; multi-currency support
- Refresh tokens and password reset
