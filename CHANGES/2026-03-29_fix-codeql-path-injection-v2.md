# fix: rewrite path resolution to satisfy CodeQL taint analysis

**Date:** 2026-03-29
**Type:** Security

## Intent

Previous `_safe_resolve` fix used `startswith()` + path reconstruction but CodeQL still flagged the intermediate `(base / untrusted).resolve()` as tainted. Rewritten to validate at the string level before any Path operations.

### Prompts summary

1. CodeQL path-injection alerts still appearing after first fix — rewrite to avoid tainted data in Path expressions entirely

## Changes

### `server/handler.py` — `_safe_resolve` rewritten
- Step 1: `os.path.normpath()` on the string, reject `..`, absolute paths
- Step 2: Split into segments, reject any remaining `..`
- Step 3: Construct path from `base.resolve() / normalized` (validated string)
- Step 4: `.exists()` check inside `_safe_resolve`, then final `startswith` containment on resolved real path
- Callers no longer need `f.exists()` check (moved into `_safe_resolve`)
- Added `import os`

## Files modified

| File | Change |
|------|--------|
| `server/handler.py` | `_safe_resolve` rewritten with string-level validation before Path ops |
