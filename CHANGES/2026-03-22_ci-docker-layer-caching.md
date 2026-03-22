# ci: cache Docker build layers for screenshot tests

**Date:** 2026-03-22
**Type:** CI

## Intent

The screenshot test Docker image rebuild takes ~30s on every CI run even when only app code changed. Caching the base image and dependency layers speeds up subsequent builds.

### Prompts summary

1. Add Docker layer caching to the screenshot test build step in CI

## CI workflow (`.github/workflows/ci.yml`)

- Added `docker/setup-buildx-action@v3` for BuildKit support
- Replaced `docker build` with `docker/build-push-action@v6` using GitHub Actions cache (`type=gha`)
- Base image pull, apt-get install, and npm install layers are cached across runs; only the `COPY . .` layer rebuilds on code changes

## Measured impact

- Cold cache (first run): 2m 50s
- Warm cache (second run): 2m 38s (~7% faster)
- Modest improvement because the ~770MB Playwright base image still needs to be transferred from the GHA cache and extracted; the real win is when dependencies change (avoids re-running `npm install` or `apt-get`)

## Files modified

| File | Change |
|------|--------|
| `.github/workflows/ci.yml` | Docker Buildx setup and layer caching for test image |
