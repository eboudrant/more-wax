"""
More'Wax — HTTP Request Handler
Routes all HTTP requests to the appropriate backend logic.
"""

import http.server
import json
import mimetypes
import os
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
    _discogs_request,
    discogs_add_to_collection,
    discogs_check_collection,
    discogs_refresh_prices,
    discogs_release_details,
    discogs_release_full,
    discogs_remove_from_collection,
    discogs_search,
)
from server.images import convert_image, identify_cover, upload_cover
from server.sync import sync_get_state, sync_start_fetch, sync_start_import

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
        from datetime import datetime, timezone

        status = args[1] if len(args) > 1 else "?"
        # Sanitise path for log output (strip control chars)
        safe_path = self.path.replace("\n", "").replace("\r", "")
        ts = datetime.now(timezone.utc).strftime("%H:%M:%S")
        print(f"  {ts}  {self.command:6s} {safe_path}  →  {status}")

    # ── path safety ───────────────────────────────────────────

    # Trusted base directories — only these are allowed for file serving.
    _ALLOWED_BASES: dict[str, Path] = {
        "static": STATIC_DIR.resolve(),
        "data": DATA_DIR.resolve(),
    }

    @staticmethod
    def _safe_resolve(base_key: str, untrusted: str) -> Path | None:
        """Resolve *untrusted* within a trusted base directory.

        *base_key* must be a key in _ALLOWED_BASES (e.g. "static", "data").
        Walks the directory tree segment-by-segment using only trusted Path
        operations (iterdir), never constructing a Path from user input.
        Returns the resolved Path, or None if the path is invalid.
        """
        base_real = Handler._ALLOWED_BASES.get(base_key)
        if base_real is None:
            return None
        # Reject obvious traversal/absolute paths at the string level
        normalized = os.path.normpath(untrusted)
        if ".." in normalized or os.path.isabs(normalized):
            return None
        segments = [s for s in normalized.replace("\\", "/").split("/") if s]
        if not segments:
            return None
        # Walk the tree segment-by-segment using directory listings
        # so no user-provided string is ever passed to Path constructors.
        current = base_real
        for seg in segments:
            if not current.is_dir():
                return None
            # Find the matching entry in the actual directory listing
            match = None
            try:
                for entry in current.iterdir():
                    if entry.name == seg:
                        match = entry
                        break
            except OSError:
                return None
            if match is None:
                return None
            current = match.resolve()
        # Final containment check against the trusted base
        try:
            current.relative_to(base_real)
        except ValueError:
            return None
        return current

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
        if not path.is_file():
            self._404()
            return
        try:
            data = path.read_bytes()
        except (FileNotFoundError, PermissionError, OSError):
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
            # Tell the client if auth is actually required for this connection.
            # Local/private IPs bypass auth even when credentials are configured.
            is_proxied = bool(
                self.headers.get("X-Forwarded-For")
                or self.headers.get("X-Forwarded-Proto")
                or self.headers.get("Cf-Connecting-Ip")
            )
            skip_auth = not is_proxied and self._is_private_ip(
                self.client_address[0] if self.client_address else ""
            )
            return _auth.handle_status(self, skip_auth=skip_auth)

        # ── Auth gate ─────────────────────────────────────────
        if not self._check_auth():
            return

        if p in ("/", "/index.html"):
            self.send_file(STATIC_DIR / "index.html")
        elif p.startswith("/static/"):
            f = self._safe_resolve("static", p[8:])
            if f:
                self.send_file(f)
            else:
                self._404()
        elif p.startswith("/covers/"):
            f = self._safe_resolve("data", p[1:])
            if f:
                self.send_file(f)
            else:
                self._404()
        elif p.startswith("/api/cover-proxy"):
            self._api_cover_proxy()
        elif p == "/api/status":
            from server.version import VERSION, BUILD_DATE, GIT_REVISION

            self.send_json(
                {
                    "discogs_connected": _discogs_mod._discogs_username is not None,
                    "discogs_username": _discogs_mod._discogs_username,
                    "discogs_token_set": bool(_config.DISCOGS_TOKEN),
                    "anthropic_key_set": bool(_config.ANTHROPIC_API_KEY),
                    "anthropic_key_valid": _anthropic_key_valid,
                    "vision_model": _config.VISION_MODEL,
                    "format_filter": _config.FORMAT_FILTER,
                    "version": VERSION,
                    "build_date": BUILD_DATE,
                    "git_revision": GIT_REVISION,
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
        elif p == "/api/sync/status":
            self._api_sync_status()
        elif p == "/api/discogs/search":
            self._api_discogs_search()
        elif p.startswith("/api/discogs/release/"):
            self._api_discogs_release(p.split("/")[-1])
        elif p.startswith("/api/discogs/prices/"):
            self._api_discogs_prices(p.split("/")[-1])
        elif p.startswith("/api/discogs/in-collection/"):
            rid = p.split("/")[-1]
            self.send_json({"in_collection": discogs_check_collection(rid)})
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
            if ok:
                # Backfill master_id if the local record is missing it
                self._backfill_master_id(rid)
            self.send_json({"success": ok})
        elif p == "/api/collection/refresh-prices":
            self._api_refresh_all_prices()
        elif p == "/api/sync/fetch":
            self._api_sync_fetch()
        elif p == "/api/sync/import":
            self._api_sync_import()
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
        if p.startswith("/api/discogs/collection/"):
            rid = p.split("/")[-1]
            ok = discogs_remove_from_collection(rid)
            self.send_json({"success": ok})
        elif p.startswith("/api/collection/"):
            ok = db_delete(self._tail_id(p))
            self.send_json({"success": ok})
        else:
            self._404()

    def _backfill_master_id(self, discogs_id: str):
        """Fetch and save master_id for a local record if missing."""
        records = db_list()
        rec = next(
            (r for r in records if str(r.get("discogs_id", "")) == discogs_id),
            None,
        )
        if not rec or rec.get("master_id"):
            return  # already has master_id or not in local DB
        try:
            release = _discogs_request("GET", f"/releases/{discogs_id}")
            mid = str(release.get("master_id", "") or "0")
            db_update(rec["id"], {"master_id": mid})
        except Exception:
            pass  # non-critical, will be retried on next startup

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
        """True if the IP is localhost or a private/link-local address (IPv4 + IPv6)."""
        if not ip:
            return True
        ip = ip.strip("[]")  # Strip IPv6 brackets (e.g. [::1])
        # IPv4 loopback and private ranges
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
        # IPv6 private ranges
        ip_lower = ip.lower().strip("[]")
        if ip_lower.startswith("fc") or ip_lower.startswith(
            "fd"
        ):  # Unique Local (fc00::/7)
            return True
        if ip_lower.startswith("fe80"):  # Link-Local (fe80::/10)
            return True
        if ip_lower.startswith("::ffff:"):  # IPv4-mapped IPv6
            return Handler._is_private_ip(ip_lower[7:])
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

    def _count_missing_master_ids(self) -> int:
        """Count records with discogs_id but no master_id."""
        records = db_list()
        return sum(1 for r in records if r.get("discogs_id") and not r.get("master_id"))

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
                "sync_missing_master_ids": self._count_missing_master_ids(),
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

        # Clear Google OAuth
        if data.get("clear_google_auth"):
            _config.save_token("GOOGLE_CLIENT_ID", "")
            _config.save_token("GOOGLE_CLIENT_SECRET", "")
            _config.save_token("ALLOWED_EMAILS", "")
            from server.auth import clear_all_sessions

            clear_all_sessions()
            self._api_get_settings()
            return

        # Google OAuth settings — validate before saving
        google_id = data.get("google_client_id", "").strip()
        google_secret = data.get("google_client_secret", "").strip()

        # Validate Client ID format immediately
        if google_id:
            if not google_id.endswith(".apps.googleusercontent.com"):
                self.send_json(
                    {
                        "success": False,
                        "error": "Invalid Client ID — must end with .apps.googleusercontent.com",
                    },
                    400,
                )
                return
            _config.save_token("GOOGLE_CLIENT_ID", google_id)

        if google_secret:
            _config.save_token("GOOGLE_CLIENT_SECRET", google_secret)

        # If both are now set, validate the full credentials against Google
        if (
            (google_id or google_secret)
            and _config.GOOGLE_CLIENT_ID
            and _config.GOOGLE_CLIENT_SECRET
        ):
            validation = self._validate_google_oauth()
            if not validation["valid"]:
                # Roll back — clear the credential that was just saved
                if google_id:
                    _config.save_token("GOOGLE_CLIENT_ID", "")
                if google_secret:
                    _config.save_token("GOOGLE_CLIENT_SECRET", "")
                self.send_json({"success": False, "error": validation["error"]}, 400)
                return

        if "allowed_emails" in data:
            _config.save_token("ALLOWED_EMAILS", data["allowed_emails"].strip())
            # Invalidate all sessions when allowed emails change
            from server.auth import clear_all_sessions

            clear_all_sessions()

        self._api_get_settings()

    def _validate_google_oauth(self):
        """Validate Google OAuth credentials by making a test token request.

        Returns {"valid": True} or {"valid": False, "error": "..."}.
        A valid client_id/secret will return 'invalid_grant' (no real code).
        An invalid client will return 'invalid_client'.
        """
        import urllib.request
        import urllib.parse
        import urllib.error

        # Build redirect URI from the current request's host
        host = (
            self.headers.get("X-Forwarded-Host")
            or self.headers.get("Host")
            or "localhost"
        )
        proto = self.headers.get("X-Forwarded-Proto", "http")
        redirect_uri = f"{proto}://{host}/auth/callback"

        params = urllib.parse.urlencode(
            {
                "code": "test_validation_code",
                "client_id": _config.GOOGLE_CLIENT_ID,
                "client_secret": _config.GOOGLE_CLIENT_SECRET,
                "redirect_uri": redirect_uri,
                "grant_type": "authorization_code",
            }
        ).encode()

        try:
            req = urllib.request.Request(
                "https://oauth2.googleapis.com/token",
                data=params,
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
            urllib.request.urlopen(req, timeout=10)  # nosec B310
            # Shouldn't succeed with a fake code, but if it does, credentials are valid
            return {"valid": True}
        except urllib.error.HTTPError as e:
            try:
                body = json.loads(e.read())
            except Exception:
                return {"valid": False, "error": f"Google returned {e.code}"}

            error_code = body.get("error", "")
            error_desc = body.get("error_description", "")

            if error_code == "invalid_grant":
                # Client ID and secret are valid — the fake code was rejected
                return {"valid": True}
            elif error_code == "invalid_client":
                return {
                    "valid": False,
                    "error": "Invalid Google Client ID or Secret",
                }
            elif error_code == "redirect_uri_mismatch":
                return {
                    "valid": False,
                    "error": f"Redirect URI mismatch. Register {redirect_uri} in Google Cloud Console.",
                }
            else:
                return {
                    "valid": False,
                    "error": error_desc or f"Google error: {error_code}",
                }
        except Exception as e:
            return {"valid": False, "error": f"Could not reach Google: {e}"}

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

    # ── sync endpoints ────────────────────────────────────────────

    def _api_sync_status(self):
        """Return current sync state."""
        self.send_json(sync_get_state())

    def _api_sync_fetch(self):
        """Fetch Discogs collection and return diff."""
        result = sync_start_fetch()
        if "error" in result:
            self.send_json(result, 400 if result.get("status") != "error" else 500)
        else:
            self.send_json(result)

    def _api_sync_import(self):
        """Start importing selected records in a background thread."""
        data = self.read_json()
        selected = data.get("selected", [])
        replace_ids = data.get("replace", [])
        if not isinstance(selected, list) or not selected:
            self.send_json({"error": "No records selected"}, 400)
            return
        if not isinstance(replace_ids, list):
            replace_ids = []

        def _run():
            sync_start_import(selected, replace_ids)

        t = threading.Thread(target=_run, daemon=True)
        t.start()
        self.send_json({"status": "importing", "total": len(selected)})

    # ── collection endpoints ─────────────────────────────────────

    def _api_add(self):
        data = self.read_json()
        allowed = (
            "discogs_id",
            "master_id",
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
            "add_source",
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
                did = r.get("discogs_id")
                rid = r.get("id")
                if not did or not rid:
                    print(f"  ⚠️ [prices] Skipping record missing discogs_id or id: {r}")
                    continue
                try:
                    needs_rating = not r.get("rating_average")
                    prices = discogs_refresh_prices(did, fetch_rating=needs_rating)
                    if any(
                        prices.get(k)
                        for k in (
                            "price_low",
                            "price_median",
                            "price_high",
                            "rating_average",
                        )
                    ):
                        db_update(rid, prices)
                        updated += 1
                except Exception as e:
                    if "429" in str(e):
                        print(f"  ⚠️ Rate limit hit after {updated} updates, stopping")
                        break
                # 5s between records — leaves ~50% rate budget for user browsing
                time.sleep(5)
            print(f"  📊 Background price refresh done: {updated}/{len(stale)} updated")

        t = threading.Thread(target=_do_refresh, daemon=True)
        t.start()
        self.send_json({"updated": "pending", "total_stale": len(stale)})

    # ── cover proxy (for share card CORS) ──────────────────────

    def _api_cover_proxy(self):
        """Proxy a Discogs cover image to avoid CORS issues for canvas rendering."""
        qs = urllib.parse.urlparse(self.path).query
        params = urllib.parse.parse_qs(qs)
        url = params.get("url", [""])[0]
        if not url or not url.startswith("https://i.discogs.com/"):
            self._404()
            return
        try:
            req = urllib.request.Request(url)
            req.add_header("User-Agent", "MoreWax/1.0")
            with urllib.request.urlopen(req, timeout=10) as resp:  # nosec B310
                data = resp.read(5 * 1024 * 1024)  # 5MB max
                content_type = resp.headers.get("Content-Type", "image/jpeg")
            self.send_response(200)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(data)))
            self.send_header("Cache-Control", "public, max-age=86400")
            self.end_headers()
            self.wfile.write(data)
        except Exception:
            self._404()

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
