# Project assessment (trimmed)

**Updated:** 2026-09-13  
**Scope:** Snapshot after Phases 0–5 (stack upgrades, status honesty, proxy/ops, shared package, docs).

This file used to list stale gaps (missing `.env.example`, Express 4 vs 5 mismatch, relative `shared/` imports, file-based production logs). Those items are **resolved**. Prefer [ARCHITECTURE.md](./ARCHITECTURE.md) and [README.md](./README.md) for current truth.

## Current baseline

| Area | Status |
|------|--------|
| Stack | React 19.3, Vite 8, Tailwind 4, React Router 7, Express 5, Zod 4 |
| Shared | `@ecoflow/shared` workspace; `mapQuotaData` for quota / watt units |
| Status API | MQTT miss + REST fail → HTTP 502 `STATUS_FETCH_ERROR` (no fake 0% SOC) |
| Auth | HMAC + `ECOFLOW_ACCESS_KEY` / `SECRET_KEY`; MQTT via `/iot-open/sign/certification` |
| Ops | Winston stdout JSON in production; Zod env; `/health` + `/ready`; Helmet `unsafe-eval` only in development |
| Deploy | Nginx proxies `/api/`, `/ws`, `/health`; not `/metrics` or `/api-docs` on :80 |
| Config | Root `.env.example` present; client same-origin by default (`VITE_API_BASE_URL` override) |
| Docker | Dev builds from repo root with workspaces; volumes under `/app/{client,server,shared}` |

## Remaining / intentional gaps

Not in the recent fix pass (and still open if you need them later):

- History storage / charts / DB
- CI pipelines
- Multi-user auth
- Auth-gated public metrics (metrics stay off Nginx :80 by design)
- React Router framework mode / React Compiler

## Quality notes

- TypeScript strict; Vitest on server and client
- npm workspaces; installs may need `--legacy-peer-deps`
- Production browser traffic is same-origin through Nginx; Ecoflow credentials stay on the server

**Verdict:** Docs and implementation are aligned for the current baseline. Use README for onboarding and ARCHITECTURE for system design.
