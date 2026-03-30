# fix: add explicit permissions to GitHub Actions workflows

**Date:** 2026-03-29
**Type:** Security

## Intent

Fix 6 Medium-severity CodeQL alerts for missing workflow permissions (principle of least privilege).

### Prompts summary

1. Fix CodeQL "Workflow does not contain permissions" alerts in ci.yml and docker.yml

## Changes

### `.github/workflows/ci.yml`
- Added workflow-level `permissions: contents: read`
- Screenshot-tests job already had `permissions: pull-requests: write`, inherits `contents: read`

### `.github/workflows/docker.yml`
- Added workflow-level `permissions: contents: read, packages: write`

## Alerts resolved

| Alert | File | Line |
|-------|------|------|
| #1 | ci.yml | 11 (python-checks) |
| #3 | ci.yml | 40 (python-lint) |
| #4 | ci.yml | 61 (python-security) |
| #5 | ci.yml | 80 (js-checks) |
| #6 | ci.yml | 128 (css-build) |
| #2 | docker.yml | 17 (docker) |

## Files modified

| File | Change |
|------|--------|
| `.github/workflows/ci.yml` | Workflow-level `permissions: contents: read` |
| `.github/workflows/docker.yml` | Workflow-level `permissions: contents: read, packages: write` |
