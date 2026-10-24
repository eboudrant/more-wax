# fix: retry startup credential checks until the network is up

**Date:** 2026-10-24
**Type:** Bug fix

## Intent

After an unattended reboot, the app showed the Discogs setup wizard even though a valid token was configured. The container (`restart: always`) starts before the host network is ready; the Discogs identity and Anthropic key checks ran once in a background thread at startup, failed on DNS, and were never retried. `discogs_connected` stayed false until a manual restart, and `init.js` treats that as "no token" and opens the wizard.

### Prompts summary

1. Asked why the server was requesting the Discogs key again.
2. Approved making the startup checks retry until the network is available.

## Design

A small `retry_until_settled(attempt, label)` helper calls a check until it reports a settled outcome, sleeping 5s, 10s, 30s, 60s, 120s, then every 300s. Each check now distinguishes:

- **settled**: success, or a definitive rejection (Discogs 401/403, Anthropic 4xx other than 429) — stop retrying.
- **transient**: network errors, 5xx, 429 — retry.

While the Anthropic check is transient, `anthropic_key_valid` stays `null` ("not yet checked") instead of `false`, so a temporary outage no longer reports a valid key as invalid. Master-id backfill still runs after the identity check, now only once it has settled.

## Changes

### `server/retry.py` (new)
- `retry_until_settled()` with capped backoff; `sleep` is injectable for tests.

### `server/discogs.py`
- `discogs_fetch_identity()` returns `True` when settled, `False` on a transient failure.

### `server/handler.py`
- `_validate_anthropic_key()` adds a `transient` flag to failures.
- `check_anthropic_key()` returns settled/transient and keeps the state `None` while transient.

### `server.py`
- Both startup threads run their check through `retry_until_settled()`.

### `tests/test_retry.py` (new)
- 10 unit tests: backoff sequence, and settled vs transient outcomes for both checks. No network.

### `ruff.toml` (new)
- CI installs the latest ruff; ruff 0.17 widened its default rule set and failed lint with 65 findings across untouched files. Pins `select` to the previous defaults (`E4`, `E7`, `E9`, `F`) so lint stays stable across ruff releases.

## Verification

- 252 unit tests pass; ruff clean; bandit findings unchanged from `main`.
- Live check: started the server in a container on an internal-only Docker network. Both checks failed with DNS errors and retried; status reported `discogs_connected: false`, `anthropic_key_valid: null`. After attaching the bridge network, the next retry authenticated (`ebtokyo`) and validated the Anthropic key — `discogs_connected: true` with no restart.

## Files modified

| File | Change |
|------|--------|
| `server/retry.py` | New retry helper |
| `server/discogs.py` | Identity check reports settled/transient |
| `server/handler.py` | Anthropic check reports settled/transient |
| `server.py` | Run startup checks with retry |
| `tests/test_retry.py` | 10 unit tests |
| `ruff.toml` | Pin lint rules to previous ruff defaults |
