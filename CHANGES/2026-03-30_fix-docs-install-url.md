# fix: consistent install URL in landing page

**Date:** 2026-03-30
**Type:** Fix

## Intent

All three install options on the landing page should tell users where to open the app after setup.

### Prompts summary

1. Add "Then open https://localhost:8766" to Docker Compose and Run from source cards

## Changes

### `docs/index.html`
- Docker Compose card: added "Then open https://localhost:8766"
- Run from source card: added "Then open https://localhost:8766"
- Docker run card already had it

## Files modified

| File | Change |
|------|--------|
| `docs/index.html` | Consistent open URL on all install options |
