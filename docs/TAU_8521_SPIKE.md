# Spike: Ecoflow Open API error 8521 (quota/all)

## Summary

Vendor code **8521** on `GET /iot-open/sign/device/quota/all` is typically an **entitlement / unsupported SN** rejection for the Open API developer account and region — not a broken HMAC signature for the whole integration.

Misleading vendor text such as `"signature is wrong"` often accompanies 8521 (and similar rejects). Compare a failing SN with a known-good SN on the **same** access key before chasing signing bugs.

## Devices in this project

| Family | SN prefix | Notes |
|--------|-----------|--------|
| DELTA 3 Max Plus (Taurus) | `D3M1…` | Usually entitled; field family `cmsBattSoc` / `powInSumW` / `powOutSumW` |
| Delta 3 Plus (Tau) | `P351…` | **Same field family as D3M1 when entitled**; 8521 often means the SN is not enabled for Open API on this key/region |
| Smart Plug | `HW52…` | Separate plug contract (`2_1.*` / nested `param`) |

## Investigation steps

1. Confirm the SN appears in `GET /iot-open/sign/device/list` for the same credentials.
2. Call `quota/all` for a working `D3M1…` and the failing `P351…` (or other) with identical signing.
3. Check server logs for `Ecoflow quota/all rejected` — includes `apiCode`, `canonicalSigningString`, nonce/timestamp (no secret).
4. Open `GET /api/devices/:deviceId/diagnostics` — list membership, MQTT subscribe/cache, family, last REST error.
5. If list contains the device but quota/all returns 8521: treat as **Open API entitlement** — contact Ecoflow developer support or try the matching regional API base URL.
6. Do **not** “fix” 8521 by inventing SOC/W in the UI; surface the error and use MQTT when the device publishes.

## Outcome for P351

When entitled, **P351 uses the same Delta 3 heartbeat fields as D3M1** (`cmsBattSoc`, `powInSumW`, `powOutSumW`, remaining-time keys). Mapping is covered by the `delta3-plus` device contract. Until entitlement is fixed, REST status will fail with a clarified message; MQTT may still deliver live data if the broker subscription works.
