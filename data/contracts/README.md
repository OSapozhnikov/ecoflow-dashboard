# Runtime device contracts

JSON contracts in this directory override bundled defaults at process start
(restart-only; no hot reload).

If this folder is empty on startup, the server seeds it from
`server/src/contracts/defaults/` (or shared built-ins).

Tracked defaults:
- `delta3-max-plus.json` (SN `D3M1…`)
- `delta3-plus.json` (SN `P351…`)
- `smart-plug.json` (SN `HW52…`)

Do not put secrets here. Runtime SQLite / settings live in the parent `data/` folder.
