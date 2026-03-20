"""
Tests for the JSON file database (server/database.py).
Uses a temporary directory so tests never touch real data.
"""

import json
import tempfile
import threading
import unittest
from pathlib import Path
from unittest import mock

# Patch config paths BEFORE importing database
_tmp = tempfile.mkdtemp(prefix="morewax_test_")
_db_file = Path(_tmp) / "collection.json"


@mock.patch("server.config.DB_FILE", _db_file)
@mock.patch("server.config.DATA_DIR", Path(_tmp))
@mock.patch("server.config.COVERS_DIR", Path(_tmp) / "covers")
class TestDatabase(unittest.TestCase):
    """Test CRUD operations on the JSON store."""

    def setUp(self):
        # Ensure clean DB for each test — re-patch the module-level reference
        import server.database as db_mod

        db_mod.DB_FILE = _db_file
        if _db_file.exists():
            _db_file.unlink()

    def _get_db(self):
        import server.database as db_mod

        return db_mod

    # ── Add & List ──────────────────────────────────────────

    def test_add_and_list(self):
        db = self._get_db()
        rid = db.db_add({"artist": "DJ Shadow", "title": "Endtroducing"})
        self.assertIsInstance(rid, int)

        records = db.db_list()
        self.assertEqual(len(records), 1)
        self.assertEqual(records[0]["artist"], "DJ Shadow")
        self.assertEqual(records[0]["id"], rid)
        self.assertIn("added_at", records[0])

    def test_add_multiple_sorted(self):
        db = self._get_db()
        db.db_add({"artist": "UNKLE", "title": "Psyence Fiction"})
        db.db_add({"artist": "DJ Shadow", "title": "Endtroducing"})
        db.db_add({"artist": "Attica Blues", "title": "Attica Blues"})

        records = db.db_list()
        artists = [r["artist"] for r in records]
        self.assertEqual(artists, ["Attica Blues", "DJ Shadow", "UNKLE"])

    def test_auto_increment_id(self):
        db = self._get_db()
        id1 = db.db_add({"artist": "A"})
        id2 = db.db_add({"artist": "B"})
        self.assertEqual(id2, id1 + 1)

    # ── Get ─────────────────────────────────────────────────

    def test_get_existing(self):
        db = self._get_db()
        rid = db.db_add({"artist": "DJ Krush", "title": "Meiso"})
        rec = db.db_get(rid)
        self.assertIsNotNone(rec)
        self.assertEqual(rec["artist"], "DJ Krush")

    def test_get_nonexistent(self):
        db = self._get_db()
        self.assertIsNone(db.db_get(9999))

    # ── Update ──────────────────────────────────────────────

    def test_update(self):
        db = self._get_db()
        rid = db.db_add({"artist": "DJ Shadow", "title": "Endtroducing"})
        ok = db.db_update(rid, {"year": "1996", "label": "Mo'Wax"})
        self.assertTrue(ok)

        rec = db.db_get(rid)
        self.assertEqual(rec["year"], "1996")
        self.assertEqual(rec["label"], "Mo'Wax")

    def test_update_nonexistent(self):
        db = self._get_db()
        self.assertFalse(db.db_update(9999, {"year": "2000"}))

    # ── Delete ──────────────────────────────────────────────

    def test_delete(self):
        db = self._get_db()
        rid = db.db_add({"artist": "DJ Shadow"})
        self.assertTrue(db.db_delete(rid))
        self.assertIsNone(db.db_get(rid))
        self.assertEqual(len(db.db_list()), 0)

    def test_delete_nonexistent(self):
        db = self._get_db()
        self.assertFalse(db.db_delete(9999))

    # ── Find duplicate ──────────────────────────────────────

    def test_find_duplicate_by_discogs_id(self):
        db = self._get_db()
        db.db_add({"artist": "DJ Shadow", "discogs_id": "12345"})
        dup = db.db_find_duplicate({"discogs_id": "12345"})
        self.assertIsNotNone(dup)
        self.assertEqual(dup["artist"], "DJ Shadow")

    def test_find_duplicate_by_discogs_id_as_int(self):
        """discogs_id stored as int should still match string lookup."""
        db = self._get_db()
        db.db_add({"artist": "DJ Shadow", "discogs_id": 12345})
        dup = db.db_find_duplicate({"discogs_id": "12345"})
        self.assertIsNotNone(dup)

    def test_find_duplicate_by_barcode(self):
        db = self._get_db()
        db.db_add({"artist": "UNKLE", "barcode": "5021392052625"})
        dup = db.db_find_duplicate({"barcode": "5021392052625"})
        self.assertIsNotNone(dup)

    def test_find_no_duplicate(self):
        db = self._get_db()
        db.db_add({"artist": "DJ Shadow", "discogs_id": "12345"})
        dup = db.db_find_duplicate({"discogs_id": "99999"})
        self.assertIsNone(dup)

    # ── Atomic writes ───────────────────────────────────────

    def test_atomic_write_creates_valid_json(self):
        db = self._get_db()
        db.db_add({"artist": "Test"})
        with open(_db_file) as f:
            data = json.load(f)
        self.assertIn("records", data)
        self.assertIn("next_id", data)

    # ── Thread safety ───────────────────────────────────────

    def test_concurrent_adds(self):
        db = self._get_db()
        errors = []

        def add_record(i):
            try:
                db.db_add({"artist": f"Artist {i}"})
            except Exception as e:
                errors.append(e)

        threads = [threading.Thread(target=add_record, args=(i,)) for i in range(20)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        self.assertEqual(len(errors), 0)
        records = db.db_list()
        self.assertEqual(len(records), 20)
        # All IDs should be unique
        ids = [r["id"] for r in records]
        self.assertEqual(len(set(ids)), 20)


if __name__ == "__main__":
    unittest.main()
