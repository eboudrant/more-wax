# chore: Docker push concurrency and README prerequisites

**Date:** 2026-03-21
**Type:** Chore

## Intent

Avoid redundant Docker builds when merging multiple PRs quickly, and improve onboarding with clear .env setup instructions.

### Prompts summary

1. Add concurrency group to Docker workflow so only the latest push builds and pushes
2. Add .env prerequisites section to README quick start explaining all configuration options

## Changes

- Add `concurrency: cancel-in-progress` to Docker workflow so rapid merges only trigger one build
- Add Prerequisites section to README with annotated `.env` example showing all options
- Simplify Docker run to use `--env-file .env` instead of inline `-e` flags

## Files modified

| File | Change |
|------|--------|
| `.github/workflows/docker.yml` | Added concurrency group |
| `README.md` | Added Prerequisites section with `.env` setup, simplified quick start options |
