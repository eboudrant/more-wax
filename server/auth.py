"""
More'Wax — Google OAuth Authentication
Single-user gate using Authorization Code flow with PKCE.
Auth is enabled when GOOGLE_CLIENT_ID is configured.
"""

import hashlib
import json
import secrets
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from base64 import urlsafe_b64encode
from pathlib import Path

from server import config

# ── Google endpoints ────────────────────────────────────────────
GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo"

# ── Session storage ─────────────────────────────────────────────
SESSION_DIR = config.DATA_DIR / "sessions"
SESSION_DIR.mkdir(exist_ok=True)
SESSION_MAX_AGE = 7 * 24 * 3600  # 7 days

# In-memory caches
_session_cache: dict[str, dict] = {}
_session_cache_lock = threading.Lock()

# Pending OAuth states (short-lived, in-memory only)
_pending_states: dict[str, dict] = {}
_pending_lock = threading.Lock()
_STATE_TTL = 300  # 5 minutes


# ── PKCE helpers ────────────────────────────────────────────────


def _generate_code_verifier() -> str:
    return secrets.token_urlsafe(64)


def _generate_code_challenge(verifier: str) -> str:
    digest = hashlib.sha256(verifier.encode("ascii")).digest()
    return urlsafe_b64encode(digest).rstrip(b"=").decode("ascii")


# ── Session helpers ─────────────────────────────────────────────


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()[:32]


def _session_path(token_hash: str) -> Path:
    return SESSION_DIR / f"{token_hash}.json"


def _parse_cookie(cookie_header: str) -> str | None:
    """Extract morewax_session value from Cookie header."""
    if not cookie_header:
        return None
    for part in cookie_header.split(";"):
        part = part.strip()
        if part.startswith("morewax_session="):
            return part[len("morewax_session=") :]
    return None


def create_session(email: str, name: str, picture: str) -> str:
    """Create a new session, return the token."""
    token = secrets.token_urlsafe(48)
    token_hash = _hash_token(token)
    now = time.time()
    session_data = {
        "email": email,
        "name": name,
        "picture": picture,
        "created_at": now,
        "last_seen": now,
        "expires_at": now + SESSION_MAX_AGE,
    }
    # Write to disk
    _session_path(token_hash).write_text(json.dumps(session_data))
    # Update cache
    with _session_cache_lock:
        _session_cache[token_hash] = session_data
    return token


def get_session(cookie_header: str) -> dict | None:
    """Return session data if valid, else None."""
    token = _parse_cookie(cookie_header)
    if not token:
        return None
    token_hash = _hash_token(token)

    # Check cache first
    with _session_cache_lock:
        cached = _session_cache.get(token_hash)
    if cached:
        if cached["expires_at"] < time.time():
            delete_session_by_hash(token_hash)
            return None
        return cached

    # Read from disk
    path = _session_path(token_hash)
    if not path.exists():
        return None
    try:
        data = json.loads(path.read_text())
    except (json.JSONDecodeError, OSError):
        return None
    if data.get("expires_at", 0) < time.time():
        delete_session_by_hash(token_hash)
        return None
    # Cache it
    with _session_cache_lock:
        _session_cache[token_hash] = data
    return data


def delete_session_by_hash(token_hash: str):
    """Remove a session by its hash."""
    path = _session_path(token_hash)
    if path.exists():
        path.unlink(missing_ok=True)
    with _session_cache_lock:
        _session_cache.pop(token_hash, None)


def delete_session(cookie_header: str):
    """Remove the session referenced by the cookie."""
    token = _parse_cookie(cookie_header)
    if token:
        delete_session_by_hash(_hash_token(token))


def cleanup_expired_sessions():
    """Delete expired session files. Called periodically."""
    now = time.time()
    for path in SESSION_DIR.glob("*.json"):
        try:
            data = json.loads(path.read_text())
            if data.get("expires_at", 0) < now:
                path.unlink(missing_ok=True)
                with _session_cache_lock:
                    _session_cache.pop(path.stem, None)
        except (json.JSONDecodeError, OSError):
            path.unlink(missing_ok=True)


def start_cleanup_thread():
    """Start background thread that cleans expired sessions every hour."""

    def _loop():
        while True:
            time.sleep(3600)
            try:
                cleanup_expired_sessions()
            except Exception:
                pass

    t = threading.Thread(target=_loop, daemon=True)
    t.start()


# ── Auth check ──────────────────────────────────────────────────


def is_auth_enabled() -> bool:
    return bool(config.GOOGLE_CLIENT_ID) and bool(config.GOOGLE_CLIENT_SECRET)


def is_email_allowed(email: str) -> bool:
    """Check if an email is allowed to log in."""
    allowed = config.ALLOWED_EMAILS.strip()
    if not allowed:
        # First-login-locks: no restriction configured yet
        return True
    emails = [e.strip().lower() for e in allowed.split(",") if e.strip()]
    return email.lower() in emails


# ── OAuth handlers ──────────────────────────────────────────────


def _get_redirect_uri(handler) -> str:
    """Build the OAuth redirect URI from the request."""
    # Respect X-Forwarded-Proto/Host from reverse proxy (Cloudflare, Caddy, nginx)
    proto = (
        handler.headers.get("X-Forwarded-Proto")
        or handler.headers.get("Cf-Visitor", "").split('"scheme":"')[-1].rstrip('"}')
        or ""
    )
    host = handler.headers.get("X-Forwarded-Host") or handler.headers.get(
        "Host", "localhost"
    )
    if not proto:
        proto = "https" if hasattr(handler.server, "ssl_context") else "http"
    # Strip port from host if it's a standard port
    if (proto == "https" and host.endswith(":443")) or (
        proto == "http" and host.endswith(":80")
    ):
        host = host.rsplit(":", 1)[0]
    uri = f"{proto}://{host}/auth/callback"
    print(f"  🔑 [auth] redirect_uri={uri}")
    return uri


def handle_login(handler):
    """GET /auth/login — Redirect to Google's OAuth consent screen."""
    if not config.GOOGLE_CLIENT_ID:
        handler.send_json({"error": "Google OAuth not configured"}, 400)
        return

    state = secrets.token_urlsafe(32)
    verifier = _generate_code_verifier()
    challenge = _generate_code_challenge(verifier)

    with _pending_lock:
        # Clean old states
        now = time.time()
        expired = [
            k for k, v in _pending_states.items() if v["created_at"] + _STATE_TTL < now
        ]
        for k in expired:
            del _pending_states[k]
        _pending_states[state] = {"code_verifier": verifier, "created_at": now}

    redirect_uri = _get_redirect_uri(handler)
    params = urllib.parse.urlencode(
        {
            "client_id": config.GOOGLE_CLIENT_ID,
            "redirect_uri": redirect_uri,
            "response_type": "code",
            "scope": "openid email profile",
            "state": state,
            "code_challenge": challenge,
            "code_challenge_method": "S256",
            "access_type": "online",
            "prompt": "select_account",
        }
    )
    url = f"{GOOGLE_AUTH_URL}?{params}"
    handler.send_response(302)
    handler.send_header("Location", url)
    handler.end_headers()


def handle_callback(handler):
    """GET /auth/callback — Exchange code for token, create session."""
    parsed = urllib.parse.urlparse(handler.path)
    qs = urllib.parse.parse_qs(parsed.query)

    code = qs.get("code", [None])[0]
    state = qs.get("state", [None])[0]
    error = qs.get("error", [None])[0]

    if error:
        handler._send_html(
            400, _error_page("Login cancelled", f"Google returned: {error}")
        )
        return

    if not code or not state:
        handler._send_html(
            400, _error_page("Invalid callback", "Missing code or state parameter.")
        )
        return

    # Validate state and get verifier
    with _pending_lock:
        pending = _pending_states.pop(state, None)
    if not pending:
        handler._send_html(
            400,
            _error_page(
                "Invalid state", "OAuth state expired or invalid. Please try again."
            ),
        )
        return
    if pending["created_at"] + _STATE_TTL < time.time():
        handler._send_html(
            400, _error_page("Expired", "Login attempt timed out. Please try again.")
        )
        return

    redirect_uri = _get_redirect_uri(handler)

    # Exchange code for access token
    token_data = urllib.parse.urlencode(
        {
            "code": code,
            "client_id": config.GOOGLE_CLIENT_ID,
            "client_secret": config.GOOGLE_CLIENT_SECRET,
            "redirect_uri": redirect_uri,
            "grant_type": "authorization_code",
            "code_verifier": pending["code_verifier"],
        }
    ).encode()

    try:
        req = urllib.request.Request(GOOGLE_TOKEN_URL, data=token_data, method="POST")
        req.add_header("Content-Type", "application/x-www-form-urlencoded")
        with urllib.request.urlopen(req, timeout=10) as resp:  # nosec B310 — hardcoded Google URL
            tokens = json.loads(resp.read())
    except (urllib.error.URLError, json.JSONDecodeError) as e:
        handler._send_html(500, _error_page("Token exchange failed", str(e)))
        return

    access_token = tokens.get("access_token")
    if not access_token:
        handler._send_html(
            500,
            _error_page("No access token", "Google did not return an access token."),
        )
        return

    # Get user info
    try:
        req = urllib.request.Request(GOOGLE_USERINFO_URL)
        req.add_header("Authorization", f"Bearer {access_token}")
        with urllib.request.urlopen(req, timeout=10) as resp:  # nosec B310 — hardcoded Google URL
            userinfo = json.loads(resp.read())
    except (urllib.error.URLError, json.JSONDecodeError) as e:
        handler._send_html(500, _error_page("Userinfo fetch failed", str(e)))
        return

    email = userinfo.get("email", "")
    name = userinfo.get("name", "")
    picture = userinfo.get("picture", "")

    if not email:
        handler._send_html(
            400, _error_page("No email", "Could not retrieve email from Google.")
        )
        return

    # Check if this is a first-login-locks scenario
    if not config.ALLOWED_EMAILS.strip():
        # First login — lock to this email
        config.save_token("ALLOWED_EMAILS", email)
        print(f"  🔒 [auth] First login — locked to {email}")

    # Check if email is allowed
    if not is_email_allowed(email):
        handler._send_html(
            403,
            _error_page(
                "Access denied",
                f"The account {email} is not authorized to use this app.",
            ),
        )
        return

    # Create session
    session_token = create_session(email, name, picture)
    print(f"  ✅ [auth] {email} logged in")

    # Set cookie and redirect
    secure_flag = (
        "; Secure" if handler.headers.get("X-Forwarded-Proto") == "https" else ""
    )
    cookie = f"morewax_session={session_token}; HttpOnly; SameSite=Lax{secure_flag}; Path=/; Max-Age={SESSION_MAX_AGE}"
    handler.send_response(302)
    handler.send_header("Location", "/")
    handler.send_header("Set-Cookie", cookie)
    handler.end_headers()


def handle_logout(handler):
    """GET /auth/logout — Clear session and redirect to login."""
    delete_session(handler.headers.get("Cookie", ""))
    handler.send_response(302)
    handler.send_header("Location", "/")
    handler.send_header("Set-Cookie", "morewax_session=; HttpOnly; Path=/; Max-Age=0")
    handler.end_headers()


def handle_status(handler):
    """GET /auth/status — Return auth state (always public)."""
    enabled = is_auth_enabled()
    session = get_session(handler.headers.get("Cookie", "")) if enabled else None
    result = {
        "auth_enabled": enabled,
        "authenticated": session is not None,
        "user": None,
    }
    if session:
        result["user"] = {
            "email": session.get("email", ""),
            "name": session.get("name", ""),
            "picture": session.get("picture", ""),
        }
    handler.send_json(result)


# ── HTML helpers ────────────────────────────────────────────────


def _error_page(title: str, message: str) -> str:
    return f"""<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{title} — More'Wax</title>
<style>
  body {{ background: #131313; color: #e0c097; font-family: system-ui; display: flex;
         align-items: center; justify-content: center; min-height: 100vh; margin: 0; }}
  .card {{ background: #201f1f; border-radius: 16px; padding: 2rem; max-width: 400px;
           text-align: center; }}
  h1 {{ font-size: 1.25rem; margin: 0 0 1rem; }}
  p {{ color: #a39e9b; font-size: 0.9rem; margin: 0 0 1.5rem; }}
  a {{ color: #fddcb1; text-decoration: none; padding: 0.75rem 1.5rem;
       border: 1px solid #fddcb133; border-radius: 9999px; display: inline-block; }}
  a:hover {{ background: #fddcb110; }}
</style></head><body>
<div class="card"><h1>{title}</h1><p>{message}</p><a href="/">Back to More'Wax</a></div>
</body></html>"""
