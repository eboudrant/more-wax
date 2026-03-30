# fix: harden .env file permissions (CodeQL clear-text storage alert)

**Date:** 2026-03-29
**Type:** Security

## Intent

Address CodeQL `py/clear-text-storage` alert #19 flagging plain-text API tokens in `data/.env`.

### Prompts summary

1. Fix CodeQL clear-text storage of sensitive information alert in config.py

## Analysis

Self-hosted single-user app — tokens stored in a local `.env` file on the user's own machine. Encryption at rest would require a key stored on the same machine, providing no real security benefit (security theater). This is the standard approach for self-hosted apps (Plex, Home Assistant, Gitea, etc.).

## Mitigation

### `server/config.py`
- Set file permissions to `0o600` (owner-only read/write) after every write to `data/.env`
- Added documentation comment explaining the accepted risk

## Files modified

| File | Change |
|------|--------|
| `server/config.py` | `os.chmod(env_path, 0o600)` after write, risk documentation comment |
