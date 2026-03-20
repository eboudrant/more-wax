# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability, please report it privately by emailing **security@morewax.app**. Do **not** open a public issue.

Include as much detail as possible: steps to reproduce, affected components, and potential impact.

## What Counts as a Security Issue

- Authentication or authorization bypass
- API token exposure or leakage
- Path traversal or file access outside intended directories
- Injection vulnerabilities (SQL, command, template, etc.)
- Cross-site scripting (XSS) or cross-site request forgery (CSRF)

## Response Timeline

We will acknowledge your report within **48 hours** and work with you to understand and address the issue promptly.

## Architecture Note

API tokens are handled server-side only and are never exposed to the browser. If you find any scenario where tokens are leaked to the client, please report it immediately.
