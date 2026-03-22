# fix: status cards showing "Not connected" due to render race

**Date:** 2026-03-22
**Type:** Fix

## Intent

Fix a race condition where the dashboard status cards rendered before the `/api/status` response arrived, showing "Not connected" and "Not configured" instead of the actual connection state.

### Prompts summary

1. Investigate flaky screenshot test where empty dashboard shows "Not connected" instead of "testuser"

## Root cause

`_checkStatus()` is non-blocking (not awaited in `DOMContentLoaded`). `renderDashboard()` calls `_renderStatus()` synchronously, but `_serverStatus` is still `null` at that point. The status cards render with empty data, then the status response arrives and updates `_serverStatus` — but `_renderStatus()` never re-runs.

## Fix (`static/js/init.js`)

- Call `_renderStatus()` after `_checkStatus()` resolves and `_serverStatus` is populated
- Status cards now always reflect the actual server response

## Files modified

| File | Change |
|------|--------|
| `static/js/init.js` | Re-render status cards after `_checkStatus()` resolves |
| `tests/screenshots/views.spec.js` | Removed hardcoded 8s timeout on status assertion |
