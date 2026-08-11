# fix: bind-mount ./data and restart:always in docker-compose

**Date:** 2026-07-13
**Type:** Fix

## Intent

Two operational fixes that came out of a real outage (Mac mini power-cycled while unattended):

1. The compose file mounted a docker-managed named volume (`morewax-data`), while the long-running `python3 server.py` workflow had been writing to `./data`. First `docker compose up` therefore booted with an empty collection and looked like data loss. Bind-mounting `./data` makes the container use the same directory as the bare-metal workflow — visible, backupable, and consistent.

2. `restart: unless-stopped` did not revive the container after the hard reboot — the unclean shutdown left the container marked "stopped", which `unless-stopped` respects. `restart: always` revives it whenever the daemon starts, which is the right policy for a self-hosted server.

### Prompts summary

1. Start More'Wax via Docker plus the Cloudflare tunnel; investigate why the collection appeared empty (chose bind-mounting `./data` over copying data into the named volume).
2. After an unattended reboot left everything down, make the whole stack come back automatically; the compose restart policy was one of the fixes.

## Changes

### `docker-compose.yml`
- `volumes`: `morewax-data:/app/data` → `./data:/app/data`; dropped the now-unused named-volume declaration.
- `restart`: `unless-stopped` → `always`.

## Files modified

| File | Change |
|------|--------|
| `docker-compose.yml` | Bind-mount `./data`; `restart: always` |
