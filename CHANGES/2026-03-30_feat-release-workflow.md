# feat: automated release workflow with Docker push

**Date:** 2026-03-30
**Type:** Feature

## Intent

Create a single workflow that handles the entire release process: validate version, create git tag, generate GitHub Release, build and push Docker image. Triggered manually from GitHub Actions UI.

### Prompts summary

1. Semi-automatic release process from GitHub Actions
2. Include Docker push in the release workflow (GitHub Actions bot tokens don't trigger other workflows)
3. Dry run option to preview without creating anything

## Changes

### `.github/workflows/release.yml` (new)
- Manual trigger (`workflow_dispatch`) with version input and dry run option
- Validates semver format and checks tag doesn't already exist
- Shows release summary (commit count, changes since last tag) in job summary
- Creates annotated git tag and pushes
- Creates GitHub Release with auto-generated notes from merged PRs
- Builds multi-arch Docker image (amd64 + arm64) with version stamping
- Pushes to Docker Hub as `X.Y.Z` and `latest`
- All steps skipped on dry run except validation and summary

### `.github/workflows/docker.yml`
- Removed `tags: ["v*"]` trigger — releases now handle tagged Docker pushes
- Changed from push-per-commit to **hourly schedule** (cron `17 * * * *`)
- Skips build if no new commits in the last hour
- Only pushes `main` + `<sha>` tags (no `latest` — that's release-only)
- Can be triggered manually via workflow_dispatch

## How to release

1. Go to **Actions → Release → Run workflow**
2. Enter version (e.g. `1.0.1`)
3. Optionally check **Dry run** to preview
4. Click **Run workflow**

## Files modified

| File | Change |
|------|--------|
| `.github/workflows/release.yml` | New — tag, release, Docker push |
| `.github/workflows/docker.yml` | Removed tag trigger |
