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

import urllib.request as _urllib_request

import server.auth as _auth
import server.config as _config
import server.discogs as _discogs_mod
from server.config import DATA_DIR, STATIC_DIR
from server.database import (
    _db_add_unlocked,
    _lock,
    db_delete,
    db_export,
    db_find_duplicate,
    db_get,
    db_list,
    db_update,
)
from server.discogs import (
    discogs_add_to_collection,
    discogs_refresh_prices,
    discogs_release_details,
    discogs_release_full,
    discogs_search,
)
from server.images import convert_image, identify_cover, upload_cover

MAX_BODY_BYTES = 20 * 1024 * 1024  # 20 MB cap on request bodies

# None = not yet checked, True = valid, False = invalid
_anthropic_key_valid = None


def check_anthropic_key():
    """Background check: validate the Anthropic key and cache the result."""
    global _anthropic_key_valid
    if not _config.ANTHROPIC_API_KEY:
        _anthropic_key_valid = None
        return
    result = _validate_anthropic_key(_config.ANTHROPIC_API_KEY)
    _anthropic_key_valid = result["valid"]
    if result["valid"]:
        print("  🤖 [anthropic] API key is valid")
    else:
        print(f"  ⚠️ [anthropic] API key invalid: {result.get('error', '')}")


def _validate_anthropic_key(key: str) -> dict:
    """Validate an Anthropic API key by listing models (free, no tokens used)."""
    req = _urllib_request.Request(
        "https://api.anthropic.com/v1/models",
        method="GET",
        headers={
            "x-api-key": key,
            "anthropic-version": "2023-06-01",
        },
    )
    try:
        with _urllib_request.urlopen(req, timeout=10):  # nosec B310
            return {"valid": True}
    except urllib.error.HTTPError as e:
        return {"valid": False, "error": f"Anthropic returned {e.code}"}
    except Exception as e:
        return {"valid": False, "error": str(e)}


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
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def send_json(self, obj, status: int = 200):
        body = json.dumps(obj, ensure_ascii=False, default=str).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
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
        self.send_header("Content-Type", mime or "application/octet-stream")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-cache")
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

        # ── Auth routes (always public) ───────────────────────
        if p == "/auth/login":
            return _auth.handle_login(self)
        elif p == "/auth/callback":
            return _auth.handle_callback(self)
        elif p == "/auth/logout":
            return _auth.handle_logout(self)
        elif p == "/auth/status":
            return _auth.handle_status(self)

        # ── Auth gate ─────────────────────────────────────────
        if not self._check_auth():
            return

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
        elif p == "/api/status":
            self.send_json(
                {
                    "discogs_connected": _discogs_mod._discogs_username is not None,
                    "discogs_username": _discogs_mod._discogs_username,
                    "discogs_token_set": bool(_config.DISCOGS_TOKEN),
                    "anthropic_key_set": bool(_config.ANTHROPIC_API_KEY),
                    "anthropic_key_valid": _anthropic_key_valid,
                    "vision_model": _config.VISION_MODEL,
                    "format_filter": _config.FORMAT_FILTER,
                }
            )
        elif p == "/api/collection":
            self.send_json(db_list())
        elif p.startswith("/api/collection/") and p.endswith("/details"):
            self._api_collection_details(p)
        elif p.startswith("/api/collection/"):
            rid = self._tail_id(p)
            rec = db_get(rid)
            self.send_json(rec) if rec else self.send_json({"error": "Not found"}, 404)
        elif p == "/api/settings":
            self._api_get_settings()
        elif p == "/api/export":
            self._api_export()
        elif p == "/api/discogs/search":
            self._api_discogs_search()
        elif p.startswith("/api/discogs/release/"):
            self._api_discogs_release(p.split("/")[-1])
        elif p.startswith("/api/discogs/prices/"):
            self._api_discogs_prices(p.split("/")[-1])
        else:
            self._404()

    def do_POST(self):
        if not self._check_auth():
            return
        p = self.path_parts()
        if p == "/api/setup":
            self._api_setup()
        elif p == "/api/setup/validate":
            self._api_setup_validate()
        elif p == "/api/settings":
            self._api_update_settings()
        elif p == "/api/collection":
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
        if not self._check_auth():
            return
        p = self.path_parts()
        if p.startswith("/api/collection/"):
            self._api_update(self._tail_id(p))
        else:
            self._404()

    def do_DELETE(self):
        if not self._check_auth():
            return
        p = self.path_parts()
        if p.startswith("/api/collection/"):
            ok = db_delete(self._tail_id(p))
            self.send_json({"success": ok})
        else:
            self._404()

    def _404(self):
        self.send_response(404)
        self.end_headers()

    def _send_html(self, status: int, html: str):
        body = html.encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    # ── auth middleware ────────────────────────────────────────────

    # Paths that never require authentication
    _PUBLIC_PATHS = frozenset(
        {
            "/auth/login",
            "/auth/callback",
            "/auth/logout",
            "/auth/status",
        }
    )

    @staticmethod
    def _is_private_ip(ip: str) -> bool:
        """True if the IP is localhost or a private network address."""
        if not ip:
            return True
        if ip in ("127.0.0.1", "::1", "localhost"):
            return True
        if ip.startswith("192.168.") or ip.startswith("10."):
            return True
        if ip.startswith("172."):
            parts = ip.split(".")
            try:
                if len(parts) >= 2 and 16 <= int(parts[1]) <= 31:
                    return True
            except ValueError:
                pass
        return False

    def _check_auth(self) -> bool:
        """Return True if request is authorized. If False, a response was sent."""
        if not _config.GOOGLE_CLIENT_ID or not _config.GOOGLE_CLIENT_SECRET:
            return True  # auth disabled — need both client ID and secret
        # If a reverse proxy is forwarding the request, auth is required
        # (even if the proxy itself connects from a private IP like Docker).
        # Otherwise, skip auth for direct LAN connections so users are never locked out.
        is_proxied = bool(
            self.headers.get("X-Forwarded-For")
            or self.headers.get("X-Forwarded-Proto")
            or self.headers.get("Cf-Connecting-Ip")
        )
        if not is_proxied:
            client_ip = self.client_address[0] if self.client_address else ""
            if self._is_private_ip(client_ip):
                return True
        p = self.path_parts()
        # Auth routes are always public
        if p in self._PUBLIC_PATHS:
            return True
        # The index page, static assets, and covers are public so
        # auth.js can load and show the login overlay
        if p in ("/", "/index.html"):
            return True
        if p.startswith("/static/") or p.startswith("/covers/"):
            return True
        # Check session cookie
        session = _auth.get_session(self.headers.get("Cookie", ""))
        if session:
            return True
        # Not authenticated
        if p.startswith("/api/"):
            self.send_json({"error": "Not authenticated"}, 401)
        else:
            # Redirect to home (auth.js will show login overlay)
            self.send_response(302)
            self.send_header("Location", "/")
            self.end_headers()
        return False

    @staticmethod
    def _tail_id(path: str) -> int:
        try:
            return int(path.split("/")[-1])
        except ValueError:
            return -1

    # ── setup endpoint ─────────────────────────────────────────────

    def _api_setup(self):
        data = self.read_json()
        discogs_token = data.get("discogs_token", "").strip()
        anthropic_key = data.get("anthropic_api_key", "").strip()

        # Validate Discogs token if provided
        if discogs_token:
            result = _discogs_mod.discogs_validate_token(discogs_token)
            if not result["valid"]:
                self.send_json({"success": False, "error": result["error"]}, 400)
                return
            _config.save_token("DISCOGS_TOKEN", discogs_token)
            # Start identity fetch in background
            _discogs_mod._discogs_username = result["username"]

        # Save Anthropic key if provided
        if anthropic_key:
            global _anthropic_key_valid
            _config.save_token("ANTHROPIC_API_KEY", anthropic_key)
            _anthropic_key_valid = True  # validated inline already

        self.send_json(
            {
                "success": True,
                "discogs_connected": _discogs_mod._discogs_username is not None,
                "discogs_username": _discogs_mod._discogs_username,
                "discogs_token_set": bool(_config.DISCOGS_TOKEN),
                "anthropic_key_set": bool(_config.ANTHROPIC_API_KEY),
            }
        )

    def _api_setup_validate(self):
        data = self.read_json()
        discogs_token = data.get("discogs_token", "").strip()
        anthropic_key = data.get("anthropic_api_key", "").strip()

        if discogs_token:
            result = _discogs_mod.discogs_validate_token(discogs_token)
            self.send_json(result)
            return

        if anthropic_key:
            result = _validate_anthropic_key(anthropic_key)
            self.send_json(result)
            return

        self.send_json({"valid": False, "error": "No token provided"}, 400)

    # ── settings endpoints ────────────────────────────────────────

    def _api_get_settings(self):
        """Return current settings with masked tokens."""
        dt = _config.DISCOGS_TOKEN
        ak = _config.ANTHROPIC_API_KEY
        gid = _config.GOOGLE_CLIENT_ID
        gs = _config.GOOGLE_CLIENT_SECRET
        self.send_json(
            {
                "discogs_token_set": bool(dt),
                "discogs_token_masked": f"••••{dt[-4:]}" if len(dt) > 4 else "",
                "anthropic_key_set": bool(ak),
                "anthropic_key_masked": f"••••{ak[-4:]}" if len(ak) > 4 else "",
                "vision_model": _config.VISION_MODEL,
                "supported_models": _config.SUPPORTED_MODELS,
                "format_filter": _config.FORMAT_FILTER,
                "google_client_id_set": bool(gid),
                "google_client_id_masked": f"••••{gid[-4:]}" if len(gid) > 4 else "",
                "google_client_secret_set": bool(gs),
                "google_client_secret_masked": f"••••{gs[-4:]}" if len(gs) > 4 else "",
                "allowed_emails": _config.ALLOWED_EMAILS,
            }
        )

    def _api_update_settings(self):
        """Update individual settings."""
        data = self.read_json()
        global _anthropic_key_valid

        # Token updates (reuse setup validation)
        discogs_token = data.get("discogs_token", "").strip()
        if discogs_token:
            result = _discogs_mod.discogs_validate_token(discogs_token)
            if not result["valid"]:
                self.send_json({"success": False, "error": result["error"]}, 400)
                return
            _config.save_token("DISCOGS_TOKEN", discogs_token)
            _discogs_mod._discogs_username = result["username"]

        anthropic_key = data.get("anthropic_api_key", "").strip()
        if anthropic_key:
            result = _validate_anthropic_key(anthropic_key)
            if not result["valid"]:
                self.send_json({"success": False, "error": result["error"]}, 400)
                return
            _config.save_token("ANTHROPIC_API_KEY", anthropic_key)
            _anthropic_key_valid = True

        # Non-token settings
        if "vision_model" in data:
            model = data["vision_model"].strip()
            if model in _config.SUPPORTED_MODELS:
                _config.save_token("VISION_MODEL", model)

        if "format_filter" in data:
            fmt = data["format_filter"].strip()
            if fmt in ("Vinyl", "CD", "All"):
                _config.save_token("FORMAT_FILTER", fmt)

        # Google OAuth settings (no validation — just save; empty string disables)
        if "google_client_id" in data:
            _config.save_token("GOOGLE_CLIENT_ID", data["google_client_id"].strip())

        if "google_client_secret" in data:
            _config.save_token(
                "GOOGLE_CLIENT_SECRET", data["google_client_secret"].strip()
            )

        if "allowed_emails" in data:
            _config.save_token("ALLOWED_EMAILS", data["allowed_emails"].strip())

        self._api_get_settings()

    def _api_export(self):
        """Export the collection as a downloadable JSON file."""
        from datetime import datetime, timezone

        data = db_export()
        export = {
            "schema_version": data.get("schema_version", "1.0"),
            "exported_at": datetime.now(timezone.utc).isoformat(),
            "records": data.get("records", []),
        }
        body = json.dumps(export, indent=2, ensure_ascii=False).encode("utf-8")
        date_str = datetime.now().strftime("%Y-%m-%d")
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header(
            "Content-Disposition",
            f'attachment; filename="morewax-export-{date_str}.json"',
        )
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    # ── collection endpoints ─────────────────────────────────────

    def _api_add(self):
        data = self.read_json()
        allowed = (
            "discogs_id",
            "title",
            "artist",
            "year",
            "label",
            "catalog_number",
            "format",
            "genres",
            "styles",
            "country",
            "notes",
            "cover_image_url",
            "local_cover",
            "barcode",
            "price_low",
            "price_median",
            "price_high",
            "price_currency",
            "num_for_sale",
            "rating_average",
            "rating_count",
        )
        record = {k: data[k] for k in allowed if k in data}
        record.setdefault("title", "")
        record.setdefault("artist", "")

        with _lock:
            dup = db_find_duplicate(record)
            if dup:
                self.send_json({"duplicate": True, "existing": dup}, 409)
                return
            new_id = _db_add_unlocked(record)

        self.send_json({"id": new_id, "success": True}, 201)

    def _api_update(self, rid: int):
        data = self.read_json()
        allowed = (
            "title",
            "artist",
            "year",
            "label",
            "notes",
            "local_cover",
            "cover_image_url",
            "price_low",
            "price_median",
            "price_high",
            "price_currency",
            "num_for_sale",
            "rating_average",
            "rating_count",
        )
        fields = {k: data[k] for k in allowed if k in data}
        ok = db_update(rid, fields)
        self.send_json({"success": ok})

    def _api_collection_details(self, path: str):
        """Return cached Discogs extra details, fetching on first request."""
        # /api/collection/5/details → 5
        parts = path.strip("/").split("/")
        try:
            rid = int(parts[2])
        except (IndexError, ValueError):
            self.send_json({"error": "Invalid ID"}, 400)
            return

        rec = db_get(rid)
        if not rec:
            self.send_json({"error": "Not found"}, 404)
            return

        discogs_id = rec.get("discogs_id")
        if not discogs_id:
            self.send_json({"error": "No Discogs ID"}, 400)
            return

        # Return from cache if available
        if rec.get("discogs_extra"):
            self.send_json(rec["discogs_extra"])
            return

        # Fetch from Discogs and cache
        try:
            extra = discogs_release_details(str(discogs_id))
            db_update(rid, {"discogs_extra": extra})
            self.send_json(extra)
        except Exception as e:
            self._send_discogs_error(e)

    # ── Discogs endpoints ────────────────────────────────────────

    def _send_discogs_error(self, e: Exception):
        """Unified error response for Discogs API failures."""
        if isinstance(e, urllib.error.HTTPError):
            self.send_json(
                {"error": f"Discogs {e.code}"}, e.code if e.code < 500 else 502
            )
        else:
            self.send_json({"error": str(e)}, 502)

    def _api_discogs_search(self):
        qs = urllib.parse.urlparse(self.path).query
        params = urllib.parse.parse_qs(qs)
        q = params.get("q", [""])[0]
        barcode = params.get("barcode", [""])[0]
        if not q and not barcode:
            self.send_json({"results": [], "error": "No search query provided"}, 400)
            return
        try:
            results = discogs_search(
                q=q, barcode=barcode, format_filter=_config.FORMAT_FILTER
            )
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
        """Refresh prices for all (or stale) records. Runs in background thread."""
        qs = urllib.parse.urlparse(self.path).query
        force = "force" in urllib.parse.parse_qs(qs)
        records = db_list()
        stale = [
            r
            for r in records
            if r.get("discogs_id")
            and (
                force
                or not r.get("price_median")
                or not r.get("price_high")
                or not r.get("rating_average")
            )
        ]

        if not stale:
            self.send_json({"updated": 0, "total_stale": 0})
            return

        def _do_refresh():
            updated = 0
            for r in stale:
                try:
                    needs_rating = not r.get("rating_average")
                    prices = discogs_refresh_prices(
                        r["discogs_id"], fetch_rating=needs_rating
                    )
                    if any(
                        prices.get(k)
                        for k in (
                            "price_low",
                            "price_median",
                            "price_high",
                            "rating_average",
                        )
                    ):
                        db_update(r["id"], prices)
                        updated += 1
                except Exception as e:
                    if "429" in str(e):
                        print(f"  ⚠️ Rate limit hit after {updated} updates, stopping")
                        break
                time.sleep(
                    2.5
                )  # respect rate limits (3 calls per record when rating needed)
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
        status = (
            200
            if result.get("success")
            else (501 if "not configured" in result.get("error", "") else 200)
        )
        self.send_json(result, status)
