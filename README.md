# Trainer

A small **workout planner** web app: a shared exercise library (name, description, YouTube link), per-user workout templates (with sets/reps per exercise), a monthly calendar, optional **weekly repeating** defaults (e.g. every Monday), and SQLite persistence. Users are identified by **name only** (no auth)—use only on networks you trust.

**Stack:** React (Vite + TypeScript + Tailwind), Express + `better-sqlite3`, Zustand.

## Prerequisites

- Node.js 20+ recommended  
- npm

## Install

```bash
npm install
```

## Development

Run the API and the Vite dev server together (API on port **3001**; Vite proxies `/api` to it):

```bash
npm run dev:all
```

Open the URL Vite prints (usually `http://localhost:5173`).

Alternatively, run two terminals:

```bash
npm run server   # API only → http://127.0.0.1:3001
npm run dev      # frontend only → Vite
```

The database file defaults to `data/trainer.db`. Override with `SQLITE_PATH=/path/to/file.db`.

## Production

Build the client and compile the server, then start a single process that serves the API and static assets:

```bash
npm run build
npm start
```

By default the app listens on port **3000** when `NODE_ENV=production`. Set `PORT` to change it.

## Docker

```bash
docker compose up --build
```

Then open `http://localhost:3000`. SQLite is stored in the `trainer_data` volume at `/data/trainer.db` inside the container (`SQLITE_PATH` is set in `docker-compose.yml`).
