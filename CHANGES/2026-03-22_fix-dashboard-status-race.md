# fix: dashboard screenshot test race condition

**Date:** 2026-03-22
**Type:** Fix

## Intent

Dashboard screenshot tests intermittently failed because the status cards rendered before the `/api/status` mock response arrived, showing "Not connected" instead of the expected "testuser".

### Prompts summary

1. Fix intermittent dashboard-empty screenshot failure caused by status card race condition

## Screenshot tests (`tests/screenshots/views.spec.js`)

- Added `await expect(page.locator('#dash-status')).toContainText(/testuser/)` before taking screenshots in both dashboard tests
- Ensures the status cards are fully rendered with mock data before comparison

## Files modified

| File | Change |
|------|--------|
| `tests/screenshots/views.spec.js` | Wait for status card content before screenshot |
