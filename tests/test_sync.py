"""Tests for the Discogs sync module."""

import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import server.config as _config


class TestSync(unittest.TestCase):
    """Test sync state machine, diff, and import logic."""

    def setUp(self):
        """Create a fresh test database for each test."""
        import server.database as db_mod
        import server.sync as sync_mod

        self.db_file = Path(tempfile.mktemp(suffix=".json"))
        # Patch DB_FILE in both config and database modules
        _config.DB_FILE = self.db_file
        db_mod.DB_FILE = self.db_file

        self.sync = sync_mod
        sync_mod._master_ids_backfilled = True  # skip backfill in tests
        with sync_mod._sync_lock:
            sync_mod._sync_state.update(
                status="idle",
                phase="",
                total=0,
                progress=0,
                diff=[],
                imported=0,
                skipped=0,
                replaced=0,
                error=None,
            )
        # Write a test collection
        self.test_data = {
            "schema_version": "1.1",
            "records": [
                {
                    "id": 1,
                    "discogs_id": "100",
                    "master_id": "M1",
                    "title": "Album One",
                    "artist": "Artist A",
                    "year": "2020",
                    "add_source": "barcode",
                },
                {
                    "id": 2,
                    "discogs_id": "200",
                    "master_id": "M2",
                    "title": "Album Two",
                    "artist": "Artist B",
                    "year": "2021",
                    "add_source": "search",
                },
            ],
            "next_id": 3,
        }
        with open(self.db_file, "w") as f:
            json.dump(self.test_data, f)

    def tearDown(self):
        if self.db_file.exists():
            self.db_file.unlink()

    def _mock_discogs_collection(self):
        """Return mock Discogs collection data."""
        return [
            {
                "discogs_id": "100",
                "master_id": "M1",
                "title": "Album One",
                "artist": "Artist A",
                "year": "2020",
                "label": "Label X",
                "format": "Vinyl",
                "cover_image_url": "",
                "thumb": "",
            },
            {
                "discogs_id": "200",
                "master_id": "M2",
                "title": "Album Two",
                "artist": "Artist B",
                "year": "2021",
                "label": "Label Y",
                "format": "Vinyl",
                "cover_image_url": "",
                "thumb": "",
            },
            # New record not in local
            {
                "discogs_id": "300",
                "master_id": "M3",
                "title": "Album Three",
                "artist": "Artist C",
                "year": "2022",
                "label": "Label Z",
                "format": "Vinyl",
                "cover_image_url": "",
                "thumb": "",
            },
            # Different pressing of Album One (same master_id)
            {
                "discogs_id": "101",
                "master_id": "M1",
                "title": "Album One",
                "artist": "Artist A",
                "year": "2020",
                "label": "Label X Reissue",
                "format": "Vinyl, LP, Reissue",
                "cover_image_url": "",
                "thumb": "",
            },
        ]

    @patch("server.sync.discogs_fetch_collection")
    def test_fetch_returns_diff(self, mock_fetch):
        """Fetch should return records in Discogs but not in local DB."""
        mock_fetch.return_value = self._mock_discogs_collection()
        result = self.sync.sync_start_fetch()

        self.assertEqual(result["status"], "ok")
        self.assertEqual(result["total_in_discogs"], 4)
        self.assertEqual(result["already_in_morewax"], 2)
        self.assertEqual(len(result["diff"]), 2)  # 300 (new) + 101 (dup)

    @patch("server.sync.discogs_fetch_collection")
    def test_fetch_detects_master_id_duplicate(self, mock_fetch):
        """Records with same master_id should be flagged as duplicates."""
        mock_fetch.return_value = self._mock_discogs_collection()
        result = self.sync.sync_start_fetch()

        diff = result["diff"]
        dup = next((r for r in diff if r["discogs_id"] == "101"), None)
        self.assertIsNotNone(dup)
        self.assertTrue(dup["_duplicate"])
        self.assertEqual(dup["_local_match"]["discogs_id"], "100")

    @patch("server.sync.discogs_fetch_collection")
    def test_fetch_new_record_not_duplicate(self, mock_fetch):
        """Records with no master_id or name match should not be duplicates."""
        mock_fetch.return_value = self._mock_discogs_collection()
        result = self.sync.sync_start_fetch()

        diff = result["diff"]
        new = next((r for r in diff if r["discogs_id"] == "300"), None)
        self.assertIsNotNone(new)
        self.assertFalse(new["_duplicate"])

    @patch("server.sync.discogs_fetch_collection")
    def test_fetch_empty_diff(self, mock_fetch):
        """All records already in local → empty diff."""
        mock_fetch.return_value = [
            {
                "discogs_id": "100",
                "master_id": "M1",
                "title": "Album One",
                "artist": "Artist A",
                "year": "2020",
                "label": "",
                "format": "",
                "cover_image_url": "",
                "thumb": "",
            },
        ]
        result = self.sync.sync_start_fetch()
        self.assertEqual(len(result["diff"]), 0)

    @patch("server.sync.discogs_fetch_collection")
    def test_fetch_fuzzy_name_match(self, mock_fetch):
        """Records matching by artist+title should be flagged as duplicates."""
        mock_fetch.return_value = [
            {
                "discogs_id": "999",
                "master_id": "M99",
                "title": "Album One",
                "artist": "artist a",  # different case
                "year": "2020",
                "label": "Other Label",
                "format": "CD",
                "cover_image_url": "",
                "thumb": "",
            },
        ]
        # Remove master_id from local so only fuzzy match works
        with open(self.db_file) as f:
            data = json.load(f)
        data["records"][0]["master_id"] = ""
        with open(self.db_file, "w") as f:
            json.dump(data, f)

        result = self.sync.sync_start_fetch()
        self.assertEqual(len(result["diff"]), 1)
        self.assertTrue(result["diff"][0]["_duplicate"])

    @patch("server.sync.discogs_fetch_collection")
    def test_import_new_records(self, mock_fetch):
        """Import should add new records to the database."""
        mock_fetch.return_value = self._mock_discogs_collection()
        self.sync.sync_start_fetch()

        result = self.sync.sync_start_import(["300"])
        self.assertEqual(result["imported"], 1)
        self.assertEqual(result["skipped"], 0)

        # Verify in DB
        from server.database import db_list

        records = db_list()
        ids = [r["discogs_id"] for r in records]
        self.assertIn("300", ids)

    @patch("server.sync.discogs_fetch_collection")
    def test_import_skips_duplicates(self, mock_fetch):
        """Import should skip records that already exist by discogs_id."""
        mock_fetch.return_value = self._mock_discogs_collection()
        self.sync.sync_start_fetch()
        self.sync.sync_start_import(["300"])

        # Re-fetch to get fresh diff (300 now in local, should be skipped in diff)
        with self.sync._sync_lock:
            self.sync._sync_state["status"] = "idle"
        result = self.sync.sync_start_fetch()
        # 300 should no longer be in diff since it's now in local
        ids_in_diff = [r["discogs_id"] for r in result["diff"]]
        self.assertNotIn("300", ids_in_diff)

    @patch("server.sync.discogs_fetch_collection")
    def test_import_replace(self, mock_fetch):
        """Import with replace should delete old record and add new one."""
        mock_fetch.return_value = self._mock_discogs_collection()
        self.sync.sync_start_fetch()

        result = self.sync.sync_start_import(["101"], replace_ids=["101"])
        self.assertEqual(result["imported"], 1)
        self.assertEqual(result["replaced"], 1)

        # Old record (id=1, discogs_id=100) should be gone
        from server.database import db_get

        self.assertIsNone(db_get(1))

    @patch("server.sync.discogs_fetch_collection")
    def test_import_sets_add_source(self, mock_fetch):
        """Imported records should have add_source='discogs_sync'."""
        mock_fetch.return_value = self._mock_discogs_collection()
        self.sync.sync_start_fetch()
        self.sync.sync_start_import(["300"])

        from server.database import db_list

        r = next(r for r in db_list() if r["discogs_id"] == "300")
        self.assertEqual(r["add_source"], "discogs_sync")

    @patch("server.sync.discogs_fetch_collection")
    def test_concurrent_fetch_rejected(self, mock_fetch):
        """Starting a fetch while one is running should return error."""
        with self.sync._sync_lock:
            self.sync._sync_state["status"] = "fetching"
        result = self.sync.sync_start_fetch()
        self.assertIn("error", result)

    @patch("server.sync.discogs_fetch_collection")
    def test_concurrent_import_rejected(self, mock_fetch):
        """Starting an import while one is running should return error."""
        with self.sync._sync_lock:
            self.sync._sync_state["status"] = "importing"
        result = self.sync.sync_start_import(["100"])
        self.assertIn("error", result)

    def test_normalize(self):
        """Normalize should lowercase and collapse whitespace."""
        self.assertEqual(self.sync._normalize("  Daft  Punk "), "daft punk")
        self.assertEqual(self.sync._normalize("THE BEATLES"), "the beatles")
        self.assertEqual(self.sync._normalize(""), "")

    @patch("server.sync.discogs_fetch_collection")
    def test_import_clears_diff(self, mock_fetch):
        """After import, diff should be cleared to free memory."""
        mock_fetch.return_value = self._mock_discogs_collection()
        self.sync.sync_start_fetch()
        self.sync.sync_start_import(["300"])

        with self.sync._sync_lock:
            self.assertEqual(self.sync._sync_state["diff"], [])

    @patch("server.sync.discogs_fetch_collection")
    def test_get_state_excludes_diff(self, mock_fetch):
        """sync_get_state should not include diff (too large for polling)."""
        mock_fetch.return_value = self._mock_discogs_collection()
        self.sync.sync_start_fetch()

        state = self.sync.sync_get_state()
        self.assertNotIn("diff", state)

    @patch("server.sync.discogs_fetch_collection")
    def test_string_normalization_of_ids(self, mock_fetch):
        """Import should handle integer IDs from client."""
        mock_fetch.return_value = self._mock_discogs_collection()
        self.sync.sync_start_fetch()

        # Pass integer instead of string
        result = self.sync.sync_start_import([300])
        self.assertEqual(result["imported"], 1)


class TestSchemaMigration(unittest.TestCase):
    """Test database schema migration."""

    def setUp(self):
        import server.database as db_mod

        self.db_file = Path(tempfile.mktemp(suffix=".json"))
        _config.DB_FILE = self.db_file
        db_mod.DB_FILE = self.db_file

    def tearDown(self):
        if self.db_file.exists():
            self.db_file.unlink()

    def test_migration_1_0_to_1_1(self):
        """Migration should add add_source field."""
        data = {
            "schema_version": "1.0",
            "records": [
                {"id": 1, "discogs_id": "123", "title": "Test"},
            ],
            "next_id": 2,
        }
        with open(self.db_file, "w") as f:
            json.dump(data, f)

        from server.database import db_list

        records = db_list()
        self.assertEqual(records[0].get("add_source"), "barcode")

        # Check schema version was bumped
        with open(self.db_file) as f:
            saved = json.load(f)
        self.assertEqual(saved["schema_version"], "1.1")


if __name__ == "__main__":
    unittest.main()
