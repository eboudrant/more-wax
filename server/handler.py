"""
More'Wax — HTTP Request Handler
Routes all HTTP requests to the appropriate backend logic.
"""

import http.server
import json
import mimetypes
import threading
import time
import urllib.error
import urllib.parse
from pathlib import Path

from server.config import DATA_DIR, STATIC_DIR
from server.database import (
    _db_add_unlocked, _lock, db_delete, db_find_duplicate, db_get,
    db_list, db_update,
)
from server.discogs import (
    discogs_add_to_collection, discogs_refresh_prices, discogs_release_full,
    discogs_search,
)
from server.images import convert_image, identify_cover, upload_cover

MAX_BODY_BYTES = 20 * 1024 * 1024  # 20 MB cap on request bodies


class Handler(http.server.BaseHTTPRequestHandler):

    def log_message(self, fmt, *args):
        status = args[1] if len(args) > 1 else "?"
        # Sanitise path for log output (strip control chars)
        safe_path = self.path.replace("\n", "").replace("\r", "")
        print(f"  {self.command:6s} {safe_path}  →  {status}")

    # ── path safety ───────────────────────────────────────────

    @staticmethod
    def _safe_resolve(base: Path, untrusted: str) -> Path | None:
        """Resolve *untrusted* relative to *base* and ensure it stays inside.

        Returns the resolved Path, or None if the result escapes the base
        directory (path traversal attempt).
        """
        resolved = (base / untrusted).resolve()
        try:
            resolved.relative_to(base.resolve())
            return resolved
        except ValueError:
            return None

    # ── low-level helpers ────────────────────────────────────────

    def _cors_headers(self):
        self.send_header("Access-Control-Allow-Origin",  "*")
        self.send_header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def send_json(self, obj, status: int = 200):
        body = json.dumps(obj, ensure_ascii=False, default=str).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type",   "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self._cors_headers()
        self.end_headers()
        self.wfile.write(body)

    def send_file(self, path: Path):
        try:
            data = path.read_bytes()
        except (FileNotFoundError, PermissionError):
            self._404()
            return
        mime, _ = mimetypes.guess_type(str(path))
        self.send_response(200)
        self.send_header("Content-Type",   mime or "application/octet-stream")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control",  "no-cache")
        self._cors_headers()
        self.end_headers()
        self.wfile.write(data)

    def read_json(self) -> dict:
        try:
            n = int(self.headers.get("Content-Length", 0))
        except (ValueError, TypeError):
            return {}
        if n <= 0:
            return {}
        if n > MAX_BODY_BYTES:
            return {}
        raw = self.rfile.read(n)
        try:
            return json.loads(raw)
        except (json.JSONDecodeError, ValueError):
            return {}

    def path_parts(self):
        return urllib.parse.urlparse(self.path).path.rstrip("/") or "/"

    # ── routing ──────────────────────────────────────────────────

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors_headers()
        self.end_headers()

    def do_GET(self):
        p = self.path_parts()

        if p in ("/", "/index.html"):
            self.send_file(STATIC_DIR / "index.html")
        elif p.startswith("/static/"):
            f = self._safe_resolve(STATIC_DIR, p[8:])
            if f and f.exists():
                self.send_file(f)
            else:
                self._404()
        elif p.startswith("/covers/"):
            f = self._safe_resolve(DATA_DIR, p[1:])
            if f and f.exists():
                self.send_file(f)
            else:
                self._404()
        elif p == "/api/collection":
            self.send_json(db_list())
        elif p.startswith("/api/collection/"):
            rid = self._tail_id(p)
            rec = db_get(rid)
            self.send_json(rec) if rec else self.send_json({"error": "Not found"}, 404)
        elif p == "/api/discogs/search":
            self._api_discogs_search()
        elif p.startswith("/api/discogs/release/"):
            self._api_discogs_release(p.split("/")[-1])
        elif p.startswith("/api/discogs/prices/"):
            self._api_discogs_prices(p.split("/")[-1])
        else:
            self._404()

    def do_POST(self):
        p = self.path_parts()
        if p == "/api/collection":
            self._api_add()
        elif p == "/api/upload-cover":
            self._api_upload_cover()
        elif p == "/api/convert-image":
            self._api_convert_image()
        elif p == "/api/identify-cover":
            self._api_identify_cover()
        elif p.startswith("/api/discogs/add-to-collection/"):
            rid = p.split("/")[-1]
            ok = discogs_add_to_collection(rid)
            self.send_json({"success": ok})
        elif p == "/api/collection/refresh-prices":
            self._api_refresh_all_prices()
        else:
            self._404()

    def do_PUT(self):
        p = self.path_parts()
        if p.startswith("/api/collection/"):
            self._api_update(self._tail_id(p))
        else:
            self._404()

    def do_DELETE(self):
        p = self.path_parts()
        if p.startswith("/api/collection/"):
            ok = db_delete(self._tail_id(p))
            self.send_json({"success": ok})
        else:
            self._404()

    def _404(self):
        self.send_response(404)
        self.end_headers()

    @staticmethod
    def _tail_id(path: str) -> int:
        try:
            return int(path.split("/")[-1])
        except ValueError:
            return -1

    # ── collection endpoints ─────────────────────────────────────

    def _api_add(self):
        data = self.read_json()
        allowed = (
            "discogs_id", "title", "artist", "year", "label",
            "catalog_number", "format", "genres", "styles",
            "country", "notes", "cover_image_url", "local_cover", "barcode",
            "price_low", "price_median", "price_high", "price_currency", "num_for_sale",
            "rating_average", "rating_count"
        )
        record = {k: data[k] for k in allowed if k in data}
        record.setdefault("title",  "")
        record.setdefault("artist", "")

        with _lock:
            dup = db_find_duplicate(record)
            if dup:
                self.send_json({"duplicate": True, "existing": dup}, 409)
                return
            new_id = _db_add_unlocked(record)

        self.send_json({"id": new_id, "success": True}, 201)

    def _api_update(self, rid: int):
        data   = self.read_json()
        allowed = ("title", "artist", "year", "label", "notes",
                   "local_cover", "cover_image_url",
                   "price_low", "price_median", "price_high",
                   "price_currency", "num_for_sale",
                   "rating_average", "rating_count")
        fields = {k: data[k] for k in allowed if k in data}
        ok = db_update(rid, fields)
        self.send_json({"success": ok})

    # ── Discogs endpoints ────────────────────────────────────────

    def _send_discogs_error(self, e: Exception):
        """Unified error response for Discogs API failures."""
        if isinstance(e, urllib.error.HTTPError):
            self.send_json({"error": f"Discogs {e.code}"}, e.code if e.code < 500 else 502)
        else:
            self.send_json({"error": str(e)}, 502)

    def _api_discogs_search(self):
        qs = urllib.parse.urlparse(self.path).query
        params = urllib.parse.parse_qs(qs)
        q       = params.get("q",       [""])[0]
        barcode = params.get("barcode", [""])[0]
        if not q and not barcode:
            self.send_json({"results": [], "error": "No search query provided"}, 400)
            return
        try:
            results = discogs_search(q=q, barcode=barcode)
            self.send_json({"results": results})
        except Exception as e:
            self._send_discogs_error(e)

    def _api_discogs_release(self, release_id: str):
        if not release_id or not release_id.isdigit():
            self.send_json({"error": "Invalid release ID"}, 400)
            return
        try:
            data = discogs_release_full(release_id)
            self.send_json(data)
        except Exception as e:
            self._send_discogs_error(e)

    def _api_discogs_prices(self, release_id: str):
        try:
            prices = discogs_refresh_prices(release_id)
            self.send_json(prices)
        except Exception as e:
            self._send_discogs_error(e)

    def _api_refresh_all_prices(self):
        """Refresh prices for all stale records. Runs in background thread."""
        records = db_list()
        stale = [r for r in records if r.get("discogs_id") and (not r.get("price_median") or not r.get("price_high") or not r.get("rating_average"))]

        if not stale:
            self.send_json({"updated": 0, "total_stale": 0})
            return

        def _do_refresh():
            updated = 0
            for r in stale:
                try:
                    needs_rating = not r.get("rating_average")
                    prices = discogs_refresh_prices(r["discogs_id"], fetch_rating=needs_rating)
                    if any(prices.get(k) for k in ("price_low", "price_median", "price_high", "rating_average")):
                        db_update(r["id"], prices)
                        updated += 1
                except Exception as e:
                    if "429" in str(e):
                        print(f"  ⚠️ Rate limit hit after {updated} updates, stopping")
                        break
                time.sleep(2.5)  # respect rate limits (3 calls per record when rating needed)
            print(f"  📊 Background price refresh done: {updated}/{len(stale)} updated")

        t = threading.Thread(target=_do_refresh, daemon=True)
        t.start()
        self.send_json({"updated": "pending", "total_stale": len(stale)})

    # ── media endpoints ──────────────────────────────────────────

    def _api_upload_cover(self):
        data = self.read_json()
        result = upload_cover(data.get("image", ""), data.get("record_id", "tmp"))
        self.send_json(result)

    def _api_convert_image(self):
        data = self.read_json()
        result = convert_image(data.get("image", ""))
        status = 200 if result.get("success") else 500
        self.send_json(result, status)

    def _api_identify_cover(self):
        data = self.read_json()
        result = identify_cover(data.get("image", ""))
        status = 200 if result.get("success") else (501 if "not configured" in result.get("error", "") else 200)
        self.send_json(result, status)
