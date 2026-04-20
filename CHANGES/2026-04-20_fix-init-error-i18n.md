# fix: translate setup-wizard error messages

**Date:** 2026-04-20
**Type:** Fix

## Intent

The status check in `init.js` passed hardcoded English strings to `showSetupWizard()` and `_renderStep2()` for the "Discogs token invalid" and "Anthropic key invalid" cases. Matching translation keys already exist in all four locale files (`init.error.discogsTokenInvalid`, `init.error.anthropicKeyInvalid`), so the strings were just not being used.

### Prompts summary

1. Code review flagged two hardcoded English error strings in the setup-wizard path; asked to replace them with the existing i18n keys.

## Changes

### `static/js/init.js`
- `_checkStatus()`: Discogs-token-invalid branch now uses `t('init.error.discogsTokenInvalid')`.
- `_checkStatus()`: Anthropic-key-invalid branch now uses `t('init.error.anthropicKeyInvalid')`.

## Files modified

| File | Change |
|------|--------|
| `static/js/init.js` | Use existing i18n keys for setup-wizard error messages |
