# Project assessment (historical)

**Status:** Partially superseded by the Vision Implementation Plan (2026-09).

This file was a planning baseline for mapper/UI gaps. Many items listed as missing
(Delta 3 keys, Smart Plug `/10`, history, alerts) are now implemented:

- Contract-driven mapping (`data/contracts/`, `@ecoflow/shared` contract engine)
- Plug watts scale + anomaly flag; remaining charge/discharge time
- SQLite history (30d raw + monthly rollups), Telegram alerts, locations
- Diagnostics UI + [docs/TAU_8521_SPIKE.md](./docs/TAU_8521_SPIKE.md)

Prefer **README.md**, **ARCHITECTURE.md**, and `data/contracts/README.md` for current behavior.
Keep this file only as historical context; do not treat § gap tables as current truth.
