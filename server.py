#!/usr/bin/env python3
"""
More'Wax — Vinyl Collection Manager
Entry point. Run with: python3 server.py
"""

import http.server
import os
import ssl
import subprocess
import threading

from server.auth import start_cleanup_thread as _start_session_cleanup
from server.config import ANTHROPIC_API_KEY, DATA_DIR, DISCOGS_TOKEN
from server.discogs import discogs_fetch_identity
from server.handler import Handler, check_anthropic_key


class _HttpsRedirectHandler(Handler):
    """Subclass of Handler that redirects non-localhost HTTP to HTTPS.

    Localhost requests are served normally (via Handler).
    """

    https_port = 8766

    def _is_remote(self):
        host = self.headers.get("Host", "")
        return not (host.startswith("localhost") or host.startswith("127.0.0.1"))

    def _redirect(self, status=301):
        host = self.headers.get("Host", "").split(":")[0]
        target = f"https://{host}:{self.https_port}{self.path}"
        self.send_response(status)
        self.send_header("Location", target)
        self.end_headers()

    def do_GET(self):
        if self._is_remote():
            self._redirect(301)
        else:
            super().do_GET()

    def do_POST(self):
        if self._is_remote():
            self._redirect(308)
        else:
            super().do_POST()

    def do_PUT(self):
        if self._is_remote():
            self._redirect(308)
        else:
            super().do_PUT()

    def do_DELETE(self):
        if self._is_remote():
            self._redirect(308)
        else:
            super().do_DELETE()

    def do_OPTIONS(self):
        if self._is_remote():
            self._redirect(308)
        else:
            super().do_OPTIONS()


def _generate_cert():
    """Generate a self-signed TLS cert (needed for camera on non-localhost)."""
    cert = DATA_DIR / "server.crt"
    key = DATA_DIR / "server.key"
    if not cert.exists() or not key.exists():
        print("    Generating self-signed TLS certificate…")
        subprocess.run(
            [
                "openssl",
                "req",
                "-x509",
                "-newkey",
                "rsa:2048",
                "-keyout",
                str(key),
                "-out",
                str(cert),
                "-days",
                "3650",
                "-nodes",
                "-subj",
                "/CN=More'Wax",
            ],
            check=True,
            capture_output=True,
        )
    return str(cert), str(key)


def _start_https(port):
    try:
        cert, key = _generate_cert()
        ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        ctx.load_cert_chain(cert, key)
        srv = http.server.ThreadingHTTPServer(("0.0.0.0", port), Handler)
        srv.socket = ctx.wrap_socket(srv.socket, server_side=True)
        return srv
    except Exception as e:
        print(f"    ⚠  HTTPS unavailable: {e}")
        return None


def main():
    HTTP_PORT = int(os.environ.get("HTTP_PORT", 8765))
    HTTPS_PORT = int(os.environ.get("HTTPS_PORT", 8766))

    if not DISCOGS_TOKEN:
        print("ℹ️  DISCOGS_TOKEN is not set — open the app to run the setup wizard.")
    else:
        if not ANTHROPIC_API_KEY:
            print(
                "ℹ️  ANTHROPIC_API_KEY is not set — cover photo identification will be disabled."
            )

    https_server = _start_https(HTTPS_PORT)

    # When HTTPS is available, redirect remote HTTP requests to HTTPS
    if https_server:
        _HttpsRedirectHandler.https_port = HTTPS_PORT
        http_handler = _HttpsRedirectHandler
    else:
        http_handler = Handler
    http_server = http.server.ThreadingHTTPServer(("0.0.0.0", HTTP_PORT), http_handler)

    print("\n🎵  More'Wax is running!")
    if https_server:
        print(f"    →  https://localhost:{HTTPS_PORT}")
    else:
        print(f"    →  http://localhost:{HTTP_PORT}")
    print(f"    📀  Collection: {DATA_DIR / 'collection.json'}")
    if https_server:
        print(f"\n    On iPhone: https://[your-mac-ip]:{HTTPS_PORT}")
    print("    Press Ctrl+C to stop\n")

    # Validate credentials in background (don't block server startup)
    if DISCOGS_TOKEN:
        threading.Thread(target=discogs_fetch_identity, daemon=True).start()
    if ANTHROPIC_API_KEY:
        threading.Thread(target=check_anthropic_key, daemon=True).start()
    # Session cleanup for OAuth
    _start_session_cleanup()

    if https_server:
        t = threading.Thread(target=https_server.serve_forever, daemon=True)
        t.start()

    try:
        http_server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping…")
        http_server.shutdown()
        if https_server:
            https_server.shutdown()


if __name__ == "__main__":
    main()
