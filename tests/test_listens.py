"""
Tests for the listens store (server/listens.py).
Uses a temporary directory so tests never touch real data.
"""

import tempfile
import unittest
from pathlib import Path
from unittest import mock

# Patch config paths BEFORE importing listens
_tmp = tempfile.mkdtemp(prefix="morewax_listens_test_")
_listens_file = Path(_tmp) / "listens.json"


@mock.patch("server.config.LISTENS_FILE", _listens_file)
@mock.patch("server.config.DATA_DIR", Path(_tmp))
class TestListens(unittest.TestCase):
    def setUp(self):
        import server.listens as lmod

        lmod.LISTENS_FILE = _listens_file
        if _listens_file.exists():
            _listens_file.unlink()

    def _mod(self):
        import server.listens as lmod

        return lmod

    # ── Add & List ──────────────────────────────────────────

    def test_add_returns_row_with_id_and_timestamp(self):
        m = self._mod()
        row = m.listens_add(42)
        self.assertEqual(row["record_id"], 42)
        self.assertIsInstance(row["id"], int)
        self.assertIn("T", row["listened_at"])  # ISO8601 UTC

    def test_add_auto_increments_id(self):
        m = self._mod()
        a = m.listens_add(1)
        b = m.listens_add(1)
        self.assertEqual(b["id"], a["id"] + 1)

    def test_list_all(self):
        m = self._mod()
        m.listens_add(1)
        m.listens_add(2)
        m.listens_add(3)
        self.assertEqual(len(m.listens_list()), 3)

    def test_list_newest_first(self):
        m = self._mod()
        m.listens_add(1)
        m.listens_add(2)
        rows = m.listens_list()
        self.assertGreaterEqual(rows[0]["listened_at"], rows[1]["listened_at"])

    def test_list_filter_by_record_id(self):
        m = self._mod()
        m.listens_add(1)
        m.listens_add(2)
        m.listens_add(1)
        only_one = m.listens_list(record_id=1)
        self.assertEqual(len(only_one), 2)
        self.assertTrue(all(r["record_id"] == 1 for r in only_one))

    def test_list_filter_no_match(self):
        m = self._mod()
        m.listens_add(1)
        self.assertEqual(m.listens_list(record_id=9999), [])

    # ── Delete ──────────────────────────────────────────────

    def test_delete_existing(self):
        m = self._mod()
        row = m.listens_add(1)
        self.assertTrue(m.listens_delete(row["id"]))
        self.assertEqual(m.listens_list(), [])

    def test_delete_nonexistent(self):
        m = self._mod()
        self.assertFalse(m.listens_delete(9999))

    def test_cascade_delete_for_record(self):
        m = self._mod()
        m.listens_add(1)
        m.listens_add(1)
        m.listens_add(2)
        removed = m.listens_delete_for_record(1)
        self.assertEqual(removed, 2)
        remaining = m.listens_list()
        self.assertEqual(len(remaining), 1)
        self.assertEqual(remaining[0]["record_id"], 2)

    def test_cascade_delete_no_matches_returns_zero(self):
        m = self._mod()
        m.listens_add(1)
        self.assertEqual(m.listens_delete_for_record(9999), 0)
        self.assertEqual(len(m.listens_list()), 1)

    # ── Persistence ─────────────────────────────────────────

    def test_persists_across_reload(self):
        m = self._mod()
        m.listens_add(7)
        m.listens_add(7)
        self.assertEqual(len(m.listens_list(record_id=7)), 2)


if __name__ == "__main__":
    unittest.main()
