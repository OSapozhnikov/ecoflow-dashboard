# Ecoflow Monitor

Web app for real-time monitoring of Ecoflow devices (Delta 3 Max Plus, Delta 3 Plus, Smart Plug, and related SKUs).

**Supported SKUs:** Delta 3 Max Plus and Delta 3 Plus are first-class. Vendor PDF documentation exists for Max / Max Plus only; Delta 3 Plus uses the same heartbeat/quota field family (`cmsBattSoc`, `powInSumW` / `powOutSumW`, etc.) until a live dump shows otherwise.

## Stack

- **Backend:** Node.js 22 LTS, Express 5, TypeScript, Zod 4, Winston, MQTT, WebSocket
- **Frontend:** React 19.3, Vite 8, Tailwind 4 (`@tailwindcss/vite`), React Router 7, TanStack Query 5
- **Shared:** `@ecoflow/shared` (npm workspaces) — types, `REFETCH_INTERVALS`, `mapQuotaData`
- **Tests:** Vitest (server + client)
- **Deploy:** Docker Compose, Nginx (proxies `/api/`, `/ws`, `/health`)

Workspace installs often need: `npm install --legacy-peer-deps`

## Quick start

### Prerequisites

- Node.js 22.x LTS+
- Docker / Docker Compose (optional)
- Ecoflow Developer API keys ([developer portal](https://developer-eu.ecoflow.com))

### Install

```bash
git clone <repository-url>
cd ecoflow-dashboard

cp .env.example .env
# Set ECOFLOW_ACCESS_KEY, ECOFLOW_SECRET_KEY, ECOFLOW_API_BASE_URL
```

Root workspace install:

```bash
npm install --legacy-peer-deps
```

### Environment

Required (see `.env.example`):

```env
ECOFLOW_ACCESS_KEY=your_access_key
ECOFLOW_SECRET_KEY=your_secret_key
ECOFLOW_API_BASE_URL=https://api-e.ecoflow.com
PORT=5000
NODE_ENV=development
CORS_ORIGIN=http://localhost:3000
```

Optional real-time:

```env
ECOFLOW_MQTT_ENABLED=true
# MQTT credentials come from GET /iot-open/sign/certification (HMAC auth)
WEBSOCKET_ENABLED=true
WEBSOCKET_PATH=/ws
```

Frontend API base:

- **Default:** same-origin (empty) — use with Vite proxy or Nginx
- **Override:** `VITE_API_BASE_URL=http://localhost:5000` when the API is on another origin
- **Dev Docker:** Compose sets `VITE_API_BASE_URL=http://localhost:5000` and `VITE_API_BASE_URL_DOCKER=http://server:5000` (proxy target inside the container)

### Development

**Docker (recommended):**

```bash
docker compose -f docker-compose.dev.yml up --build
```

- API: http://localhost:5000  
- UI: http://localhost:3000  

Dev images build from the **repo root** workspace context (`/app/{client,server,shared}`) and use `--legacy-peer-deps`.

**Local (without Docker):**

```bash
# from repo root
npm run type-check   # builds shared, then type-checks server + client

npm run dev --workspace=server
npm run dev --workspace=client
```

Vite proxies `/api`, `/ws`, and `/health` to the backend in development.

### Production

```bash
docker compose build
docker compose up -d
```

- UI + proxied API/WS: http://localhost (port 80)  
- Express directly (metrics / Swagger): http://localhost:5000  

Nginx on `:80` proxies `/api/`, `/ws`, and `/health` to the server. It does **not** expose `/metrics` or `/api-docs` on port 80.

**Rate limiting:** Express limits `/api` (default **2000 req / 15 min**). Private/loopback IPs (LAN + Docker bridge) are **skipped** by default so a polling dashboard behind Nginx does not 429 itself. Override with `RATE_LIMIT_*` / `TRUST_PROXY` in `.env.example`.

## API surface

| Endpoint | Description |
|----------|-------------|
| `GET /health` | Liveness |
| `GET /ready` | Readiness (MQTT + data success when enabled) |
| `GET /api/devices` | Device list |
| `GET /api/devices/:deviceId/status` | Status (MQTT preferred, REST fallback); **502** `{ error: { code: 'STATUS_FETCH_ERROR' } }` if both fail — no fake 0% SOC |
| `GET /api/devices/:deviceId/diagnostics` | List membership, MQTT cache, family, last REST error |
| `GET /api/devices/:deviceId/quota/raw` | Lab: live REST `quota/all` envelope + last MQTT raw (manual only) |
| `GET /api/devices/:deviceId/history` | Raw samples (`from`/`to` ms); default last 30 days |
| `GET /api/devices/:deviceId/history/monthly` | Monthly rollups (estimated Wh) |
| `GET /api/devices/connection-status` | MQTT / WebSocket connection info |
| `GET/PUT /api/settings` | Telegram + alert thresholds + retention (`data/settings.json`) |
| `POST /api/settings/telegram/test` | Send a test Telegram message |
| `GET/PUT /api/locations` | Location labels + device assignments |
| `WS /ws` | Real-time status updates |
| `GET /api-docs` | Swagger UI (port 5000) |
| `GET /metrics` | Prometheus metrics (port 5000) |

Auth to Ecoflow: **HMAC-SHA256 + ACCESS_KEY / SECRET_KEY** (not OAuth2).

Real-time path: MQTT via `/iot-open/sign/certification` → WebSocket `/ws` → React Query polling fallback (`DEVICES` 60s, `DEVICE_STATUS` 30s, `DEVICE_STATUS_WS` 60s). Client Axios limiter: 10 req / 60s.

### Data directory (`DATA_DIR`, default `./data`)

Docker Compose mounts `./data:/app/data`. Contents:

| Path | Purpose |
|------|---------|
| `contracts/*.json` | Device field maps (SN prefix → quota keys). Drop a file + restart to add a SKU |
| `ecoflow.sqlite` | 30-day samples + daily/monthly aggregates |
| `settings.json` | Telegram bot + alert thresholds (gitignored) |
| `locations.json` | Location groupings (gitignored) |

**Smart Plug watts:** Ecoflow documents plug power in **0.1 W** units. The mapper divides by 10 once (`scalePlugTenthWatts`). Values still above 4000 W are flagged as anomalous in the UI.

**Controls:** intentionally out of scope (monitor + alerts only).

## Project layout

```
ecoflow-dashboard/
├── server/                 # Express API
├── client/                 # React + Vite SPA
├── shared/                 # @ecoflow/shared (mapper, contracts, types)
├── data/                   # Runtime volume (contracts tracked; sqlite/settings gitignored)
├── docs/                   # Ecoflow PDFs + TAU_8521_SPIKE.md
├── .github/workflows/ci.yml
├── docker-compose.yml
├── docker-compose.dev.yml
├── .env.example
├── ARCHITECTURE.md
└── README.md
```

## Testing

From repo root:

```bash
npm run type-check
npm test                  # server vitest + client vitest run
```

Or per package:

```bash
npm run test --workspace=server
npm run test:run --workspace=client
```

Coverage / Docker test profile:

```bash
./run-tests.sh            # Linux/Mac
.\run-tests.ps1           # Windows
# or
docker compose -f docker-compose.dev.yml --profile tests up --build tests
```

MQTT smoke script:

```bash
npm run test-mqtt --workspace=server
```

## Docs

- [ARCHITECTURE.md](./ARCHITECTURE.md) — auth, MQTT cert flow, polling intervals, Nginx proxy, ops, shared package
- [docs/TAU_8521_SPIKE.md](./docs/TAU_8521_SPIKE.md) — Open API entitlement / vendor code 8521
- [data/contracts/README.md](./data/contracts/README.md) — adding a device contract
- Swagger: http://localhost:5000/api-docs (when server is running)

### Lab — raw quota inspector

From a device card, open **Inspect quota** (or `/device/:id?lab=raw`). On the detail page use **Fetch raw** (manual only — no polling).

- **REST** — full `quota/all` when the SN is entitled; otherwise vendor error body (e.g. 8521).
- **MQTT merged** — fields accumulated from partial MQTT heartbeats since server start (use this when REST fails).
- **MQTT last** — single latest message only (often just a few power keys).

Useful when writing `data/contracts/*.json`.

### Station Ports & Limits

For Delta 3 Max Plus / Plus, Device Detail shows read-only **Ports** (AC in/out, PV, 12V, USB) and **Limits** (charge ceiling, discharge floor, backup reserve) when MQTT/REST provide those keys. AC out line watts use absolute values (vendor sign is direction).

If you expose the UI beyond LAN, put it behind reverse-proxy auth (Basic/SSO). The app itself has no multi-user login.

## License

MIT
