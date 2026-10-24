"""Tests for startup credential checks retrying on transient failures — no network calls."""

import unittest
import urllib.error
from unittest import mock


def _http_error(code):
    return urllib.error.HTTPError("https://example.test", code, "err", {}, None)


class TestRetryUntilSettled(unittest.TestCase):
    def test_stops_after_first_settled_attempt(self):
        from server.retry import retry_until_settled

        attempt = mock.Mock(return_value=True)
        sleep = mock.Mock()
        retry_until_settled(attempt, "t", sleep=sleep)
        self.assertEqual(attempt.call_count, 1)
        sleep.assert_not_called()

    def test_retries_with_backoff_and_repeats_last_delay(self):
        from server.retry import retry_until_settled

        attempt = mock.Mock(side_effect=[False, False, False, False, True])
        sleep = mock.Mock()
        retry_until_settled(attempt, "t", delays=(1, 2, 3), sleep=sleep)
        self.assertEqual(attempt.call_count, 5)
        self.assertEqual([c.args[0] for c in sleep.call_args_list], [1, 2, 3, 3])


class TestDiscogsFetchIdentity(unittest.TestCase):
    def setUp(self):
        import server.discogs as d

        self.d = d
        self._saved = d._discogs_username
        d._discogs_username = None

    def tearDown(self):
        self.d._discogs_username = self._saved

    def test_success_sets_username(self):
        with mock.patch.object(
            self.d, "_discogs_request", return_value={"username": "u"}
        ):
            self.assertTrue(self.d.discogs_fetch_identity())
        self.assertEqual(self.d._discogs_username, "u")

    def test_network_error_is_transient(self):
        with mock.patch.object(
            self.d, "_discogs_request", side_effect=OSError("no route")
        ):
            self.assertFalse(self.d.discogs_fetch_identity())
        self.assertIsNone(self.d._discogs_username)

    def test_server_error_is_transient(self):
        with mock.patch.object(
            self.d, "_discogs_request", side_effect=_http_error(503)
        ):
            self.assertFalse(self.d.discogs_fetch_identity())

    def test_rejected_token_settles(self):
        with mock.patch.object(
            self.d, "_discogs_request", side_effect=_http_error(401)
        ):
            self.assertTrue(self.d.discogs_fetch_identity())
        self.assertIsNone(self.d._discogs_username)


class TestCheckAnthropicKey(unittest.TestCase):
    def setUp(self):
        import server.config as c
        import server.handler as h

        self.h = h
        self._saved = (h._anthropic_key_valid, c.ANTHROPIC_API_KEY)
        self.key_patch = mock.patch.object(c, "ANTHROPIC_API_KEY", "sk-test")
        self.key_patch.start()

    def tearDown(self):
        self.key_patch.stop()
        self.h._anthropic_key_valid = self._saved[0]

    def _check(self, urlopen_effect):
        with mock.patch.object(
            self.h._urllib_request, "urlopen", side_effect=urlopen_effect
        ):
            return self.h.check_anthropic_key()

    def test_network_error_is_transient_and_unknown(self):
        self.assertFalse(self._check(OSError("no route")))
        self.assertIsNone(self.h._anthropic_key_valid)

    def test_server_error_is_transient(self):
        self.assertFalse(self._check(_http_error(529)))
        self.assertIsNone(self.h._anthropic_key_valid)

    def test_rejected_key_settles_invalid(self):
        self.assertTrue(self._check(_http_error(401)))
        self.assertFalse(self.h._anthropic_key_valid)

    def test_valid_key_settles_valid(self):
        self.assertTrue(self._check([mock.MagicMock()]))
        self.assertTrue(self.h._anthropic_key_valid)


if __name__ == "__main__":
    unittest.main()
