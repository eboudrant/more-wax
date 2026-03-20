# More'Wax — Vinyl Collection Manager

More'Wax is a self-hosted web app for managing your vinyl record collection. It runs on a Mac (or Linux) as a Python server and serves a mobile-friendly web UI. Records can be added by barcode scan, cover photo identification (via Claude Vision), or manual Discogs search. Prices are fetched from the Discogs marketplace and new additions are automatically synced to your Discogs account.

![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)

## Quick start

### Option A: Setup wizard (recommended)

```bash
./setup.sh        # checks Python, prompts for API tokens, validates everything
python3 server.py
```

### Option B: Docker

```bash
cp .env.example .env
# Edit .env and add your Discogs token (required) and Anthropic API key (optional)
docker compose up
```

### Option C: Manual

```bash
cp .env.example .env
# Edit .env and add your Discogs token (required) and Anthropic API key (optional)
python3 server.py
```

Open `http://localhost:8765` in a browser. For iPhone/iPad access (camera features require HTTPS), open `https://<your-mac-ip>:8766` in Safari and accept the self-signed certificate once.

Press Ctrl+C to stop the server.

## Configuration

More'Wax reads configuration from environment variables. You can set them in a `.env` file in the project root (see `.env.example`).

| Variable | Required | Description |
|----------|----------|-------------|
| `DISCOGS_TOKEN` | Yes | Discogs personal access token ([get one here](https://www.discogs.com/settings/developers)) |
| `ANTHROPIC_API_KEY` | No | Anthropic API key for cover photo identification ([get one here](https://console.anthropic.com/)) |
| `HTTP_PORT` | No | HTTP port (default: `8765`) |
| `HTTPS_PORT` | No | HTTPS port (default: `8766`) |

## Architecture

More'Wax follows a **fat server / thin client** architecture. All API tokens, business logic, and external service calls live on the Python backend. The browser client is pure UI — it knows nothing about Discogs credentials or Claude API keys.

```
┌─────────────────────────┐     ┌──────────────────────────┐
│   Browser (static/js/)   │────▶│   Python server (server/) │
│   Pure UI layer          │◀────│   Business logic + APIs    │
│   No tokens / secrets    │     │   JSON file storage        │
└─────────────────────────┘     └────────┬────────┬──────────┘
                                         │        │
                                    Discogs    Anthropic
                                    REST API   Claude API
```

### Server (`server/`)

Pure Python stdlib (no pip dependencies). Organized as a package:

```
server.py              # Entry point — starts HTTP/HTTPS servers
server/
├── config.py          # .env loading, constants, paths
├── database.py        # JSON store — thread-safe CRUD with atomic writes
├── discogs.py         # Discogs API client — search, releases, prices, collection
├── images.py          # Image processing — HEIC conversion, cover upload, Claude Vision
└── handler.py         # HTTP request handler — routing and API endpoints
```

Key design decisions: threading lock protects all database writes, atomic file replacement prevents corruption, `ThreadPoolExecutor` parallelizes Discogs API calls, and background threads handle batch price refresh without blocking HTTP responses.

### Client (`static/js/`)

Vanilla JavaScript with Bootstrap 5 for layout/modals and Quagga.js for barcode scanning. No build step, no framework. Split into focused modules:

```
static/js/
├── state.js           # Global state variables
├── helpers.js         # Utilities — HTML escaping, price formatting, toasts
├── api.js             # HTTP wrappers + Discogs API functions
├── collection.js      # Main grid — load, sort, filter, render, background refresh
├── detail.js          # Record detail modal with live price updates
├── image-convert.js   # HEIC → JPEG conversion (server → heic2any → native fallback)
├── camera.js          # Live barcode scanning + cover photo capture
├── search.js          # Discogs search and results rendering
├── photo-search.js    # Photo-based identification (barcode detection + Claude Vision)
├── add-modal.js       # Add record wizard — step router, confirm, save
└── init.js            # Page initialization
```

### Data storage

```
data/                       # auto-created, git-ignored
├── collection.json         # main database
├── covers/                 # locally captured cover photos
│   └── cover_42.jpg
├── server.crt              # auto-generated TLS cert
└── server.key
```

## API endpoints

### Collection CRUD

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/collection` | List all records (sorted by artist) |
| GET | `/api/collection/:id` | Get a single record |
| POST | `/api/collection` | Add a new record (duplicate check by discogs_id or barcode) |
| PUT | `/api/collection/:id` | Update allowed fields on a record |
| DELETE | `/api/collection/:id` | Delete a record |

### Discogs proxy

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/discogs/search?q=...&barcode=...` | Search Discogs by text or barcode |
| GET | `/api/discogs/release/:id` | Full release details (release + stats + prices + collection check, parallelized) |
| GET | `/api/discogs/prices/:id` | Refresh marketplace prices only |
| POST | `/api/discogs/add-to-collection/:id` | Add release to Discogs collection |
| POST | `/api/collection/refresh-prices` | Batch-refresh stale prices (background, rate-limited) |

### Media

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/upload-cover` | Upload a cover photo (base64 JPEG) |
| POST | `/api/convert-image` | Convert HEIC/AVIF/TIFF to JPEG |
| POST | `/api/identify-cover` | Send cover photo to Claude Vision for artist/title identification |

## Features

### Adding records

Three methods for adding vinyl to the collection:

1. **Photo** — Take or upload a photo. The app first tries barcode detection (Quagga.js on the still image). If no barcode is found, it sends the image to Claude Vision for cover identification. The identified artist/title is then searched on Discogs.

2. **Live scan** — Point the camera at a barcode. Quagga.js runs in real-time mode with a confidence threshold (3 consistent reads required). Once detected, automatically searches Discogs.

3. **Manual search** — Type artist, album, or label name. Results show cover thumbnails, year, label, and format.

After selecting a release, a confirmation screen shows full metadata, marketplace prices, and lets the user take/upload a custom cover photo and add personal notes before saving.

### Marketplace prices

Three price tiers are tracked per record: Low (lowest listed), Median (VG+ suggested), and High (Near Mint suggested). Prices are fetched when a release is selected, when a detail modal is opened (if missing), and via a one-per-session background batch refresh for stale records. The batch refresh runs server-side with rate-limit delays and stops on 429 responses.

### Discogs sync

New records are automatically added to your Discogs collection (folder 1). If already present, sync is skipped.

### Cover photos

Cover images come from Discogs by default. Users can take or upload a custom cover photo. HEIC files (from iPhone) are converted to JPEG using a fallback chain: `sips` (macOS) → `heic2any` (browser) → native decoder.

### HTTPS and mobile

Camera access requires a secure context. The server auto-generates a self-signed TLS certificate for HTTPS. On iPhone/iPad, open the HTTPS URL and accept the certificate warning once.

## Dependencies

### Server (Python 3)

No pip packages required — uses only stdlib modules: `http.server`, `json`, `ssl`, `urllib`, `threading`, `subprocess`, `base64`, `concurrent.futures`.

External tools (optional, for HEIC conversion): `sips` (macOS built-in), `convert` (ImageMagick), `ffmpeg`.

### Client (browser)

Loaded from CDN, no build step:

- Bootstrap 5.3.2 (CSS + JS)
- Bootstrap Icons 1.11.3
- Quagga.js 0.12.1 (barcode scanning)
- heic2any 0.0.4 (HEIC conversion fallback)

### External APIs

- **Discogs API** — Personal access token auth. Used for search, release metadata, marketplace pricing, and collection management.
- **Anthropic Claude API** (optional) — Used for cover photo identification via Claude Vision.

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Commit your changes (`git commit -m 'Add my feature'`)
4. Push to the branch (`git push origin feature/my-feature`)
5. Open a Pull Request

## License

[MIT](LICENSE)
