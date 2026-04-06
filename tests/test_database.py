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

    # ── Export ────────────────────────────────────────────

    def test_export_returns_full_data(self):
        db = self._get_db()
        db.db_add({"artist": "DJ Shadow", "title": "Endtroducing"})
        db.db_add({"artist": "UNKLE", "title": "Psyence Fiction"})
        data = db.db_export()
        self.assertIn("records", data)
        self.assertIn("schema_version", data)
        self.assertEqual(len(data["records"]), 2)

    def test_export_empty_db(self):
        db = self._get_db()
        data = db.db_export()
        self.assertEqual(len(data["records"]), 0)

    def test_export_includes_schema_version(self):
        db = self._get_db()
        data = db.db_export()
        self.assertIn("schema_version", data)
        self.assertEqual(data["schema_version"], db.CURRENT_SCHEMA)

    # ── Corrupted DB recovery ────────────────────────────

    def test_corrupted_json_resets(self):
        _db_file.write_text("not valid json{{{")
        db = self._get_db()
        records = db.db_list()
        self.assertEqual(len(records), 0)  # should recover with empty DB

    def test_invalid_structure_resets(self):
        _db_file.write_text(json.dumps({"wrong": "structure"}))
        db = self._get_db()
        records = db.db_list()
        self.assertEqual(len(records), 0)

    def test_corrupted_creates_backup(self):
        _db_file.write_text("corrupted{{{")
        db = self._get_db()
        db.db_list()  # triggers load
        backup = _db_file.with_suffix(".json.bak")
        self.assertTrue(backup.exists())
        backup.unlink(missing_ok=True)

    # ── Partial fields ───────────────────────────────────

    def test_add_minimal_record(self):
        db = self._get_db()
        rid = db.db_add({})
        self.assertIsInstance(rid, int)
        rec = db.db_get(rid)
        self.assertIsNotNone(rec)

    def test_partial_fields_preserved(self):
        db = self._get_db()
        rid = db.db_add({"artist": "Test", "custom_field": "value"})
        rec = db.db_get(rid)
        # custom fields should be preserved
        self.assertEqual(rec.get("custom_field", ""), "value")

    def test_missing_next_id_recovered_on_load(self):
        """DB file missing next_id should be auto-recovered."""
        from server.database import db_add

        # Write a DB file without next_id
        data = {
            "schema_version": "1.1",
            "records": [
                {"id": 5, "title": "A", "artist": "X", "discogs_id": "1"},
                {"id": 10, "title": "B", "artist": "Y", "discogs_id": "2"},
            ],
        }
        with open(_db_file, "w") as f:
            json.dump(data, f)

        # Should still be able to add a record
        new_id = db_add({"title": "C", "artist": "Z", "discogs_id": "3"})
        self.assertEqual(new_id, 11)  # max(5, 10) + 1

    def test_missing_next_id_empty_records(self):
        """DB file with empty records and no next_id starts at 1."""
        from server.database import db_add

        data = {"schema_version": "1.1", "records": []}
        with open(_db_file, "w") as f:
            json.dump(data, f)

        new_id = db_add({"title": "First", "artist": "A", "discogs_id": "1"})
        self.assertEqual(new_id, 1)


@mock.patch("server.config.DB_FILE", _db_file)
@mock.patch("server.config.DATA_DIR", Path(_tmp))
@mock.patch("server.config.COVERS_DIR", Path(_tmp) / "covers")
class TestLikedTracks(unittest.TestCase):
    def setUp(self):
        import server.database as db_mod
        from server.database import db_add

        db_mod.DB_FILE = _db_file
        if _db_file.exists():
            _db_file.unlink()
        self.rid = db_add(
            {"title": "Test Album", "artist": "Test Artist", "discogs_id": "123"}
        )

    def test_liked_tracks_initially_absent(self):
        from server.database import db_get

        r = db_get(self.rid)
        self.assertNotIn("liked_tracks", r)

    def test_update_liked_tracks(self):
        from server.database import db_get, db_update

        db_update(self.rid, {"liked_tracks": ["A1", "B2"]})
        r = db_get(self.rid)
        self.assertEqual(r["liked_tracks"], ["A1", "B2"])

    def test_toggle_liked_track(self):
        from server.database import db_get, db_update

        db_update(self.rid, {"liked_tracks": ["A1", "B2"]})
        r = db_get(self.rid)
        liked = r["liked_tracks"]
        liked.remove("A1")
        db_update(self.rid, {"liked_tracks": liked})
        r = db_get(self.rid)
        self.assertEqual(r["liked_tracks"], ["B2"])

    def test_liked_tracks_empty_after_clearing(self):
        from server.database import db_get, db_update

        db_update(self.rid, {"liked_tracks": ["A1"]})
        db_update(self.rid, {"liked_tracks": []})
        r = db_get(self.rid)
        self.assertEqual(r["liked_tracks"], [])

    def test_liked_tracks_in_list_response(self):
        from server.database import db_list, db_update

        db_update(self.rid, {"liked_tracks": ["A1", "A2"]})
        records = db_list()
        r = next(x for x in records if x["id"] == self.rid)
        self.assertEqual(r["liked_tracks"], ["A1", "A2"])

    def test_liked_tracks_persists_across_loads(self):
        from server.database import db_get, db_update

        db_update(self.rid, {"liked_tracks": ["C1"]})
        r = db_get(self.rid)
        self.assertEqual(r["liked_tracks"], ["C1"])

    def test_liked_tracks_preserves_order(self):
        from server.database import db_get, db_update

        db_update(self.rid, {"liked_tracks": ["B2", "A1", "C3"]})
        r = db_get(self.rid)
        self.assertEqual(r["liked_tracks"], ["B2", "A1", "C3"])

    def test_liked_tracks_allows_duplicates(self):
        """Server stores whatever the client sends — dedup is client-side."""
        from server.database import db_get, db_update

        db_update(self.rid, {"liked_tracks": ["A1", "A1"]})
        r = db_get(self.rid)
        self.assertEqual(r["liked_tracks"], ["A1", "A1"])

    def test_liked_tracks_with_special_characters(self):
        from server.database import db_get, db_update

        db_update(self.rid, {"liked_tracks": ["A1", "Don't Stop", 'He Said "Hello"']})
        r = db_get(self.rid)
        self.assertEqual(r["liked_tracks"], ["A1", "Don't Stop", 'He Said "Hello"'])

    def test_liked_tracks_does_not_affect_other_fields(self):
        from server.database import db_get, db_update

        db_update(self.rid, {"liked_tracks": ["A1"]})
        r = db_get(self.rid)
        self.assertEqual(r["title"], "Test Album")
        self.assertEqual(r["artist"], "Test Artist")

    def test_liked_tracks_independent_per_record(self):
        from server.database import db_add, db_get, db_update

        rid2 = db_add({"title": "Album 2", "artist": "Artist 2", "discogs_id": "456"})
        db_update(self.rid, {"liked_tracks": ["A1"]})
        db_update(rid2, {"liked_tracks": ["B1", "B2"]})
        r1 = db_get(self.rid)
        r2 = db_get(rid2)
        self.assertEqual(r1["liked_tracks"], ["A1"])
        self.assertEqual(r2["liked_tracks"], ["B1", "B2"])

    def test_next_id_persisted_after_recovery(self):
        """After recovering next_id, it should be saved to the file."""
        from server.database import db_list

        data = {
            "schema_version": "1.1",
            "records": [{"id": 7, "title": "A", "artist": "X", "discogs_id": "1"}],
        }
        with open(_db_file, "w") as f:
            json.dump(data, f)

        # Trigger load which should recover and save next_id
        db_list()

        with open(_db_file) as f:
            saved = json.load(f)
        self.assertEqual(saved["next_id"], 8)


if __name__ == "__main__":
    unittest.main()
