# More'Wax — Vinyl Collection Manager

More'Wax is a self-hosted web app for managing your vinyl record collection. It runs a Python server and serves a responsive web UI you open in any browser — desktop or mobile. Records can be added by barcode scan, cover photo identification (via Claude Vision), or manual Discogs search. Prices are fetched from the Discogs marketplace and new additions are automatically synced to your Discogs account.

<p align="center">
  <br/>
  <img src="https://github.com/eboudrant/more-wax/raw/main/docs/screenshot-dashboard.png" width="150" alt="Dashboard">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
  <img src="https://github.com/eboudrant/more-wax/raw/main/docs/screenshot-collection.png" width="150" alt="Collection">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
  <img src="https://github.com/eboudrant/more-wax/raw/main/docs/screenshot-detail.png" width="150" alt="Record detail">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
  <img src="https://github.com/eboudrant/more-wax/raw/main/docs/screenshot-scanner.png" width="150" alt="Barcode scanner">
  <br/>
</p>

## Quick start

```bash
docker run -d \
  --name more-wax \
  -p 8765:8765 -p 8766:8766 \
  -v morewax-data:/app/data \
  eboudrant/more-wax:latest
```

> **Docker Desktop users:** Use the command above, not the "Run" button — Docker Desktop does not map ports automatically without the `-p` flags.

Open `https://localhost:8766` and accept the self-signed certificate. A setup wizard will guide you through connecting your Discogs account and optionally enabling Claude Vision for cover photo identification.

On mobile, use `https://<your-ip>:8766`.

## Features

- **Barcode scan** — point your camera at a barcode for instant Discogs lookup
- **Photo identification** — snap a cover photo, Claude Vision identifies the exact pressing
- **Manual search** — search by artist, album, or label
- **Marketplace prices** — low / median / high from Discogs, auto-refreshed
- **Discogs sync** — new records added to your Discogs collection automatically
- **Self-hosted** — your data stays on your machine, no cloud account needed

## Configuration

API tokens are configured through the in-app setup wizard on first launch. For advanced use cases, you can set them via environment variables instead:

| Variable | Required | Description |
|----------|----------|-------------|
| `DISCOGS_TOKEN` | Yes | [Discogs personal access token](https://www.discogs.com/settings/developers) |
| `ANTHROPIC_API_KEY` | No | [Anthropic API key](https://console.anthropic.com/) for cover photo identification (~$0.007/photo) |
| `VISION_MODEL` | No | Claude model (default: `claude-sonnet-4-6`) |
| `HTTP_PORT` | No | HTTP port (default: `8765`) |
| `HTTPS_PORT` | No | HTTPS port (default: `8766`) |

## Volumes

| Path | Description |
|------|-------------|
| `/app/data` | Collection database, cover photos, TLS certificates, saved configuration |

## License

MIT
