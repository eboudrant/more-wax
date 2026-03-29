"""Tests for the auth module — pure logic, no network calls."""

import json
import shutil
import tempfile
import time
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

import server.config as _config


class TestEmailMasking(unittest.TestCase):
    def test_normal_email(self):
        from server.auth import _mask_email

        self.assertEqual(_mask_email("user@example.com"), "us...@example.com")

    def test_short_local_3_chars(self):
        from server.auth import _mask_email

        # 3+ chars → first 2 + "..."
        self.assertEqual(_mask_email("abc@x.com"), "ab...@x.com")

    def test_short_local_2_chars(self):
        from server.auth import _mask_email

        # ≤2 chars → kept as-is
        self.assertEqual(_mask_email("ab@x.com"), "ab@x.com")

    def test_single_char_local(self):
        from server.auth import _mask_email

        self.assertEqual(_mask_email("a@x.com"), "a@x.com")

    def test_no_at_sign_long(self):
        from server.auth import _mask_email

        self.assertEqual(_mask_email("noemail"), "no...")

    def test_no_at_sign_short(self):
        from server.auth import _mask_email

        self.assertEqual(_mask_email("ab"), "ab")

    def test_empty_string(self):
        from server.auth import _mask_email

        # empty → no local, no domain
        result = _mask_email("")
        self.assertIsInstance(result, str)


class TestPKCE(unittest.TestCase):
    def test_code_verifier_length(self):
        from server.auth import _generate_code_verifier

        v = _generate_code_verifier()
        self.assertGreaterEqual(len(v), 43)
        self.assertLessEqual(len(v), 128)

    def test_code_verifier_unique(self):
        from server.auth import _generate_code_verifier

        a = _generate_code_verifier()
        b = _generate_code_verifier()
        self.assertNotEqual(a, b)

    def test_code_challenge_deterministic(self):
        from server.auth import _generate_code_challenge

        c1 = _generate_code_challenge("test-verifier")
        c2 = _generate_code_challenge("test-verifier")
        self.assertEqual(c1, c2)

    def test_code_challenge_base64url(self):
        from server.auth import _generate_code_challenge

        c = _generate_code_challenge("test-verifier")
        self.assertNotIn("+", c)
        self.assertNotIn("/", c)
        self.assertNotIn("=", c)

    def test_code_challenge_different_for_different_verifiers(self):
        from server.auth import _generate_code_challenge

        c1 = _generate_code_challenge("verifier-a")
        c2 = _generate_code_challenge("verifier-b")
        self.assertNotEqual(c1, c2)


class TestTokenHashing(unittest.TestCase):
    def test_hash_deterministic(self):
        from server.auth import _hash_token

        self.assertEqual(_hash_token("abc123"), _hash_token("abc123"))

    def test_hash_different_tokens(self):
        from server.auth import _hash_token

        self.assertNotEqual(_hash_token("abc"), _hash_token("def"))

    def test_hash_is_64_hex_chars(self):
        from server.auth import _hash_token

        h = _hash_token("test")
        self.assertEqual(len(h), 64)
        int(h, 16)  # should not raise


class TestCookieParsing(unittest.TestCase):
    def test_parse_valid_cookie(self):
        from server.auth import _parse_cookie

        self.assertEqual(_parse_cookie("morewax_session=abc123; other=x"), "abc123")

    def test_parse_missing_cookie(self):
        from server.auth import _parse_cookie

        self.assertIsNone(_parse_cookie("other=x"))

    def test_parse_none(self):
        from server.auth import _parse_cookie

        self.assertIsNone(_parse_cookie(None))

    def test_parse_empty_string(self):
        from server.auth import _parse_cookie

        self.assertIsNone(_parse_cookie(""))

    def test_parse_multiple_cookies(self):
        from server.auth import _parse_cookie

        self.assertEqual(_parse_cookie("a=1; morewax_session=hello; b=2"), "hello")

    def test_parse_no_morewax_session(self):
        from server.auth import _parse_cookie

        self.assertIsNone(_parse_cookie("session=abc; auth=xyz"))


class TestSessionManagement(unittest.TestCase):
    def setUp(self):
        import server.auth as auth_mod

        self.auth = auth_mod
        self.sessions_dir = Path(tempfile.mkdtemp())
        self._orig_session_dir = auth_mod.SESSION_DIR
        auth_mod.SESSION_DIR = self.sessions_dir
        with auth_mod._session_cache_lock:
            auth_mod._session_cache.clear()

    def tearDown(self):
        shutil.rmtree(self.sessions_dir, ignore_errors=True)
        self.auth.SESSION_DIR = self._orig_session_dir

    def test_create_and_get_session(self):
        token = self.auth.create_session("test@example.com", "Test User", "")
        # get_session takes a cookie header string
        cookie = f"morewax_session={token}"
        session = self.auth.get_session(cookie)
        self.assertIsNotNone(session)
        self.assertEqual(session["email"], "test@example.com")
        self.assertEqual(session["name"], "Test User")

    def test_get_nonexistent_session(self):
        session = self.auth.get_session("morewax_session=nonexistent")
        self.assertIsNone(session)

    def test_get_no_cookie(self):
        session = self.auth.get_session(None)
        self.assertIsNone(session)

    def test_delete_session(self):
        token = self.auth.create_session("test@example.com", "Test", "")
        token_hash = self.auth._hash_token(token)
        self.auth.delete_session_by_hash(token_hash)
        session = self.auth.get_session(f"morewax_session={token}")
        self.assertIsNone(session)

    def test_delete_session_from_cookie(self):
        token = self.auth.create_session("test@example.com", "Test", "")
        self.auth.delete_session(f"morewax_session={token}")
        session = self.auth.get_session(f"morewax_session={token}")
        self.assertIsNone(session)

    def test_clear_all_sessions(self):
        self.auth.create_session("a@example.com", "A", "")
        self.auth.create_session("b@example.com", "B", "")
        self.auth.clear_all_sessions()
        files = list(self.sessions_dir.glob("*.json"))
        self.assertEqual(len(files), 0)

    def test_session_has_expiry(self):
        token = self.auth.create_session("test@example.com", "Test", "")
        session = self.auth.get_session(f"morewax_session={token}")
        self.assertIn("expires_at", session)
        self.assertGreater(session["expires_at"], time.time())

    def test_expired_session_rejected(self):
        token = self.auth.create_session("test@example.com", "Test", "")
        token_hash = self.auth._hash_token(token)
        session_file = self.sessions_dir / f"{token_hash}.json"
        with open(session_file) as f:
            data = json.load(f)
        data["expires_at"] = time.time() - 100
        with open(session_file, "w") as f:
            json.dump(data, f)
        with self.auth._session_cache_lock:
            self.auth._session_cache.clear()
        session = self.auth.get_session(f"morewax_session={token}")
        self.assertIsNone(session)

    def test_session_cache_used(self):
        token = self.auth.create_session("test@example.com", "Test", "")
        # First call populates cache
        s1 = self.auth.get_session(f"morewax_session={token}")
        # Delete the file — cache should still return session
        token_hash = self.auth._hash_token(token)
        (self.sessions_dir / f"{token_hash}.json").unlink()
        s2 = self.auth.get_session(f"morewax_session={token}")
        self.assertIsNotNone(s2)
        self.assertEqual(s1["email"], s2["email"])

    def test_cleanup_expired_sessions(self):
        token = self.auth.create_session("test@example.com", "Test", "")
        token_hash = self.auth._hash_token(token)
        session_file = self.sessions_dir / f"{token_hash}.json"
        with open(session_file) as f:
            data = json.load(f)
        data["expires_at"] = time.time() - 100
        with open(session_file, "w") as f:
            json.dump(data, f)
        self.auth.cleanup_expired_sessions()
        self.assertFalse(session_file.exists())

    def test_cleanup_corrupted_session_file(self):
        bad_file = self.sessions_dir / "corrupted.json"
        bad_file.write_text("not json{{{")
        self.auth.cleanup_expired_sessions()
        self.assertFalse(bad_file.exists())


class TestAuthEnabled(unittest.TestCase):
    def test_auth_enabled_with_both(self):
        from server.auth import is_auth_enabled

        with (
            patch.object(_config, "GOOGLE_CLIENT_ID", "test-id"),
            patch.object(_config, "GOOGLE_CLIENT_SECRET", "test-secret"),
        ):
            self.assertTrue(is_auth_enabled())

    def test_auth_disabled_without_id(self):
        from server.auth import is_auth_enabled

        with (
            patch.object(_config, "GOOGLE_CLIENT_ID", ""),
            patch.object(_config, "GOOGLE_CLIENT_SECRET", "test-secret"),
        ):
            self.assertFalse(is_auth_enabled())

    def test_auth_disabled_without_secret(self):
        from server.auth import is_auth_enabled

        with (
            patch.object(_config, "GOOGLE_CLIENT_ID", "test-id"),
            patch.object(_config, "GOOGLE_CLIENT_SECRET", ""),
        ):
            self.assertFalse(is_auth_enabled())

    def test_auth_disabled_both_empty(self):
        from server.auth import is_auth_enabled

        with (
            patch.object(_config, "GOOGLE_CLIENT_ID", ""),
            patch.object(_config, "GOOGLE_CLIENT_SECRET", ""),
        ):
            self.assertFalse(is_auth_enabled())


class TestEmailAllowed(unittest.TestCase):
    def test_allowed_email(self):
        from server.auth import is_email_allowed

        with patch.object(_config, "ALLOWED_EMAILS", "admin@test.com,user@test.com"):
            self.assertTrue(is_email_allowed("admin@test.com"))

    def test_disallowed_email(self):
        from server.auth import is_email_allowed

        with patch.object(_config, "ALLOWED_EMAILS", "admin@test.com"):
            self.assertFalse(is_email_allowed("hacker@evil.com"))

    def test_empty_allowlist_allows_all(self):
        from server.auth import is_email_allowed

        with patch.object(_config, "ALLOWED_EMAILS", ""):
            self.assertTrue(is_email_allowed("anyone@test.com"))

    def test_case_insensitive(self):
        from server.auth import is_email_allowed

        with patch.object(_config, "ALLOWED_EMAILS", " Admin@Test.COM "):
            self.assertTrue(is_email_allowed("admin@test.com"))

    def test_whitespace_handling(self):
        from server.auth import is_email_allowed

        with patch.object(_config, "ALLOWED_EMAILS", " a@b.com , c@d.com "):
            self.assertTrue(is_email_allowed("c@d.com"))


class TestClientIP(unittest.TestCase):
    def _make_handler(self, headers=None, client_addr=("127.0.0.1", 1234)):
        handler = MagicMock()
        handler.client_address = client_addr
        # Mock headers.get() to return from our dict
        _headers = headers or {}
        handler.headers = MagicMock()
        handler.headers.get = lambda k, d=None: _headers.get(k, d)
        return handler

    def test_cf_connecting_ip(self):
        from server.auth import _get_client_ip

        h = self._make_handler({"Cf-Connecting-Ip": "1.2.3.4"})
        self.assertEqual(_get_client_ip(h), "1.2.3.4")

    def test_x_forwarded_for(self):
        from server.auth import _get_client_ip

        h = self._make_handler({"X-Forwarded-For": "5.6.7.8, 10.0.0.1"})
        self.assertEqual(_get_client_ip(h), "5.6.7.8")

    def test_cf_takes_priority(self):
        from server.auth import _get_client_ip

        h = self._make_handler(
            {"Cf-Connecting-Ip": "1.2.3.4", "X-Forwarded-For": "5.6.7.8"}
        )
        self.assertEqual(_get_client_ip(h), "1.2.3.4")

    def test_fallback_to_client_address(self):
        from server.auth import _get_client_ip

        h = self._make_handler({}, ("192.168.1.1", 5555))
        self.assertEqual(_get_client_ip(h), "192.168.1.1")


class TestAuditLog(unittest.TestCase):
    def setUp(self):
        import server.auth as auth_mod

        self.auth = auth_mod
        self.data_dir = Path(tempfile.mkdtemp())
        self._orig_log = auth_mod._AUDIT_LOG
        auth_mod._AUDIT_LOG = self.data_dir / "auth.log"

    def tearDown(self):
        shutil.rmtree(self.data_dir, ignore_errors=True)
        self.auth._AUDIT_LOG = self._orig_log

    def test_audit_writes_log(self):
        self.auth.audit("TEST_EVENT", "user@test.com", "1.2.3.4")
        log_file = self.data_dir / "auth.log"
        self.assertTrue(log_file.exists())
        content = log_file.read_text()
        self.assertIn("TEST_EVENT", content)
        self.assertIn("us...@test.com", content)
        self.assertIn("1.2.3.4", content)

    def test_audit_rotation(self):
        log_file = self.auth._AUDIT_LOG
        # Write enough to trigger rotation
        log_file.write_text("x" * (self.auth._AUDIT_MAX_SIZE + 1))
        self.auth.audit("NEW_EVENT", "user@test.com", "1.2.3.4")
        backup = log_file.with_suffix(".log.1")
        self.assertTrue(backup.exists())
        self.assertLess(log_file.stat().st_size, self.auth._AUDIT_MAX_SIZE)

    def test_audit_without_ip(self):
        self.auth.audit("NO_IP_EVENT", "test@x.com")
        content = self.auth._AUDIT_LOG.read_text()
        self.assertIn("NO_IP_EVENT", content)
        self.assertNotIn("ip=", content)

    def test_audit_without_email(self):
        self.auth.audit("PLAIN_EVENT", "no-email-here")
        content = self.auth._AUDIT_LOG.read_text()
        self.assertIn("no-email-here", content)


class TestRateLimit(unittest.TestCase):
    def test_first_request_not_limited(self):
        from server.auth import _check_rate_limit

        # Returns False = not rate limited
        self.assertFalse(_check_rate_limit(f"unique-{time.time_ns()}"))

    def test_many_requests_eventually_limited(self):
        from server.auth import _check_rate_limit, _CALLBACK_MAX_ATTEMPTS

        key = f"flood-{time.time_ns()}"
        results = [_check_rate_limit(key) for _ in range(_CALLBACK_MAX_ATTEMPTS + 5)]
        # First N should be False (not limited), then True (limited)
        self.assertFalse(any(results[:_CALLBACK_MAX_ATTEMPTS]))
        self.assertTrue(results[-1])


if __name__ == "__main__":
    unittest.main()
