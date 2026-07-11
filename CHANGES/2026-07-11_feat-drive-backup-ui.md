# feat: Drive Backup section in Settings

**Date:** 2026-07-11
**Type:** Feature

## Intent

Settings UI for the Google Drive backup backend (PR #107). A "Drive Backup" section between Authentication and Data with three states: unavailable (Google Sign-In not configured — hint text), available-but-not-connected ("Connect Google Drive" button → `/auth/drive/connect`), and connected (email, last-backup line with pending indicator, last-error line, "Back up now" + "Disconnect" actions).

### Prompts summary

1. Build the Settings UI for the Drive backup feature; screenshot tests and interactive browser verification required; no auto-merge on UI PRs.

## Changes

### `static/index.html`
- New "Drive Backup" block in the settings modal with a `#settings-backup-body` container rendered by JS.

### `static/js/settings.js`
- `openSettings()` also fetches `/api/backup/status` (independent of `/api/settings` so one failing doesn't block the other).
- `_renderBackup()` renders the three states from cached status; `settingsBackupNow()` posts and toasts; `settingsBackupDisconnect()` posts and re-renders.
- `_renderSettings()` now ends with `_renderBackup()` so the section re-translates on `locale-changed` (bug found during browser verification — the section stayed English after a language switch).
- Timestamps reuse `_formatListenTime` (locale-aware Intl formatting).

### `static/locales/{en,ja,fr,de}.json`
- 13 new keys under `settings.backup.*`.

### `tests/screenshots/fixtures.js`
- `mockApi` mocks `/api/backup/status` (default: unavailable). New `mockBackupConnected(page)` override with fixed timestamps.

### `tests/screenshots/views.spec.js`
- `Settings › drive backup shows connected state with actions` — asserts email/last-backup/actions, snapshots `settings-backup-connected.png`.
- `Settings › drive backup hidden behind auth hint when Google not configured` — asserts the unavailable hint.

### Baselines
- New: `settings-backup-connected.png` (desktop + mobile).
- Regenerated: `settings-modal.png` (desktop + mobile) — the new section shifts the modal.

## Manual verification (Browser pane, dev backend on :9769 with fake Google creds)

| Scenario | Result |
|---|---|
| Available, not connected | ✓ "Connect Google Drive" primary button |
| Connected (fake token injected server-side) | ✓ Email, "No backup yet · changes pending", both action buttons |
| "Back up now" with fake creds | ✓ Fails gracefully — "Last backup failed: HTTP Error 401: Unauthorized" renders in the section |
| Locale switch to FR with section open | ✓ Fully re-translated (after fix) |
| Disconnect | ✓ Section returns to the Connect button; token file removed |

## Files modified

| File | Change |
|------|--------|
| `static/index.html` | Drive Backup section markup |
| `static/js/settings.js` | Status fetch, three-state render, actions, locale re-render fix |
| `static/locales/{en,fr,de,ja}.json` | 13 new keys each |
| `tests/screenshots/fixtures.js` | Backup status mocks |
| `tests/screenshots/views.spec.js` | 2 new settings tests |
| `tests/screenshots/{desktop,mobile}/settings-backup-connected.png` | New baselines |
| `tests/screenshots/{desktop,mobile}/settings-modal.png` | Regenerated |
