"""
Tests for the HTTP handler (server/handler.py).
Covers routing, path traversal protection, input validation, and edge cases.
"""

import json
import tempfile
import unittest
from http.server import HTTPServer
from pathlib import Path
from threading import Thread
from unittest import mock
from urllib.request import Request, urlopen
from urllib.error import HTTPError

# Patch config before importing handler
_tmp = tempfile.mkdtemp(prefix="morewax_handler_test_")
_data_dir = Path(_tmp) / "data"
_static_dir = Path(_tmp) / "static"
_covers_dir = _data_dir / "covers"
_db_file = _data_dir / "collection.json"

_data_dir.mkdir(parents=True, exist_ok=True)
_static_dir.mkdir(parents=True, exist_ok=True)
_covers_dir.mkdir(parents=True, exist_ok=True)

# Create a test static file
(_static_dir / "test.txt").write_text("hello")
(_static_dir / "js").mkdir(exist_ok=True)
(_static_dir / "js" / "app.js").write_text("console.log('hi')")
(_static_dir / "index.html").write_text("<html></html>")

# Create a test cover file
(_covers_dir / "cover_1.jpg").write_bytes(b"\xff\xd8\xff")


@mock.patch("server.config.DB_FILE", _db_file)
@mock.patch("server.config.DATA_DIR", _data_dir)
@mock.patch("server.config.COVERS_DIR", _covers_dir)
@mock.patch("server.config.STATIC_DIR", _static_dir)
class TestHandlerRouting(unittest.TestCase):
    """Test HTTP routing and security measures."""

    @classmethod
    def setUpClass(cls):
        """Start a test server on a random port."""
        with (
            mock.patch("server.config.DB_FILE", _db_file),
            mock.patch("server.config.DATA_DIR", _data_dir),
            mock.patch("server.config.COVERS_DIR", _covers_dir),
            mock.patch("server.config.STATIC_DIR", _static_dir),
        ):
            from server.handler import Handler

            cls.server = HTTPServer(("127.0.0.1", 0), Handler)
            cls.port = cls.server.server_address[1]
            cls.base = f"http://127.0.0.1:{cls.port}"
            cls.thread = Thread(target=cls.server.serve_forever, daemon=True)
            cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()

    def setUp(self):
        """Reset the database before each test."""
        import server.database as db_mod

        db_mod.DB_FILE = _db_file
        if _db_file.exists():
            _db_file.unlink()

    # ── Basic routing ─────────────────────────────────────────

    def test_root_serves_index(self):
        with urlopen(f"{self.base}/") as resp:
            self.assertEqual(resp.status, 200)
            self.assertIn(b"<html>", resp.read())

    def test_static_file_served(self):
        with urlopen(f"{self.base}/static/test.txt") as resp:
            self.assertEqual(resp.status, 200)
            self.assertEqual(resp.read(), b"hello")

    def test_static_nested_file(self):
        with urlopen(f"{self.base}/static/js/app.js") as resp:
            self.assertEqual(resp.status, 200)

    def test_cover_file_served(self):
        # URL /covers/X maps to DATA_DIR/covers/X
        # Our test file is at _data_dir/covers/cover_1.jpg
        # So URL is /covers/cover_1.jpg
        with urlopen(f"{self.base}/covers/cover_1.jpg") as resp:
            self.assertEqual(resp.status, 200)

    def test_404_for_unknown_path(self):
        with self.assertRaises(HTTPError) as ctx:
            urlopen(f"{self.base}/nonexistent")
        self.assertEqual(ctx.exception.code, 404)

    # ── Path traversal protection ─────────────────────────────

    def test_static_path_traversal_blocked(self):
        """../../../etc/passwd style attacks must return 404."""
        with self.assertRaises(HTTPError) as ctx:
            urlopen(f"{self.base}/static/../../etc/passwd")
        self.assertEqual(ctx.exception.code, 404)

    def test_static_path_traversal_encoded_blocked(self):
        """URL-encoded traversal must also be blocked."""
        with self.assertRaises(HTTPError) as ctx:
            urlopen(f"{self.base}/static/..%2F..%2Fetc%2Fpasswd")
        self.assertEqual(ctx.exception.code, 404)

    def test_covers_path_traversal_blocked(self):
        with self.assertRaises(HTTPError) as ctx:
            urlopen(f"{self.base}/covers/../../../etc/passwd")
        self.assertEqual(ctx.exception.code, 404)

    # ── Collection API ────────────────────────────────────────

    def test_collection_list_empty(self):
        with urlopen(f"{self.base}/api/collection") as resp:
            data = json.loads(resp.read())
            self.assertIsInstance(data, list)
            self.assertEqual(len(data), 0)

    def test_add_and_get_record(self):
        body = json.dumps({"artist": "DJ Shadow", "title": "Endtroducing"}).encode()
        req = Request(f"{self.base}/api/collection", data=body, method="POST")
        req.add_header("Content-Type", "application/json")
        with urlopen(req) as resp:
            result = json.loads(resp.read())
            self.assertTrue(result["success"])
            rid = result["id"]

        with urlopen(f"{self.base}/api/collection/{rid}") as resp:
            rec = json.loads(resp.read())
            self.assertEqual(rec["artist"], "DJ Shadow")

    def test_update_record(self):
        # Add
        body = json.dumps({"artist": "Test"}).encode()
        req = Request(f"{self.base}/api/collection", data=body, method="POST")
        req.add_header("Content-Type", "application/json")
        with urlopen(req) as resp:
            rid = json.loads(resp.read())["id"]

        # Update
        body = json.dumps({"year": "2000"}).encode()
        req = Request(f"{self.base}/api/collection/{rid}", data=body, method="PUT")
        req.add_header("Content-Type", "application/json")
        with urlopen(req) as resp:
            self.assertTrue(json.loads(resp.read())["success"])

    def test_delete_record(self):
        body = json.dumps({"artist": "Delete Me"}).encode()
        req = Request(f"{self.base}/api/collection", data=body, method="POST")
        req.add_header("Content-Type", "application/json")
        with urlopen(req) as resp:
            rid = json.loads(resp.read())["id"]

        req = Request(f"{self.base}/api/collection/{rid}", method="DELETE")
        with urlopen(req) as resp:
            self.assertTrue(json.loads(resp.read())["success"])

    def test_get_nonexistent_record(self):
        with self.assertRaises(HTTPError) as ctx:
            urlopen(f"{self.base}/api/collection/99999")
        self.assertEqual(ctx.exception.code, 404)

    def test_delete_nonexistent_record(self):
        req = Request(f"{self.base}/api/collection/99999", method="DELETE")
        with urlopen(req) as resp:
            result = json.loads(resp.read())
            self.assertFalse(result["success"])

    # ── Input validation ──────────────────────────────────────

    def test_invalid_content_type_returns_empty_dict(self):
        """POST with no Content-Length should get empty dict (no crash)."""
        req = Request(f"{self.base}/api/collection", data=b"", method="POST")
        with urlopen(req) as resp:
            result = json.loads(resp.read())
            self.assertIn("id", result)  # Added with empty fields

    def test_invalid_release_id_path(self):
        """Non-numeric release IDs should not crash."""
        with self.assertRaises(HTTPError) as ctx:
            urlopen(f"{self.base}/api/collection/not-a-number")
        self.assertEqual(ctx.exception.code, 404)

    # ── CORS preflight ────────────────────────────────────────

    def test_options_returns_204(self):
        req = Request(f"{self.base}/api/collection", method="OPTIONS")
        with urlopen(req) as resp:
            self.assertEqual(resp.status, 204)

    # ── Duplicate detection ───────────────────────────────────

    def test_duplicate_detection_by_discogs_id(self):
        body = json.dumps({"artist": "A", "discogs_id": "12345"}).encode()
        req = Request(f"{self.base}/api/collection", data=body, method="POST")
        req.add_header("Content-Type", "application/json")
        urlopen(req)

        req2 = Request(f"{self.base}/api/collection", data=body, method="POST")
        req2.add_header("Content-Type", "application/json")
        with self.assertRaises(HTTPError) as ctx:
            urlopen(req2)
        self.assertEqual(ctx.exception.code, 409)


class TestSafeResolve(unittest.TestCase):
    """Unit tests for the _safe_resolve static method."""

    def _resolve(self, base, untrusted):
        from server.handler import Handler

        return Handler._safe_resolve(base, untrusted)

    def test_normal_path(self):
        base = Path(_static_dir)
        result = self._resolve(base, "test.txt")
        self.assertIsNotNone(result)
        self.assertTrue(str(result).startswith(str(base.resolve())))

    def test_traversal_blocked(self):
        base = Path(_static_dir)
        result = self._resolve(base, "../../etc/passwd")
        self.assertIsNone(result)

    def test_double_dot_in_middle(self):
        base = Path(_static_dir)
        result = self._resolve(base, "js/../test.txt")
        # This resolves to base/test.txt which is still inside base
        self.assertIsNotNone(result)

    def test_absolute_path_blocked(self):
        base = Path(_static_dir)
        result = self._resolve(base, "/etc/passwd")
        self.assertIsNone(result)


class TestMaxBody(unittest.TestCase):
    """Test that MAX_BODY_BYTES is defined and reasonable."""

    def test_max_body_constant(self):
        from server.handler import MAX_BODY_BYTES

        self.assertIsInstance(MAX_BODY_BYTES, int)
        self.assertGreater(MAX_BODY_BYTES, 0)
        self.assertLessEqual(MAX_BODY_BYTES, 50 * 1024 * 1024)  # at most 50 MB


if __name__ == "__main__":
    unittest.main()
