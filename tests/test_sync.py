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

    @patch("server.sync.discogs_fetch_collection")
    def test_import_crash_recovery(self, mock_fetch):
        """If import thread crashes, status should reset to 'done'."""
        mock_fetch.return_value = self._mock_discogs_collection()
        self.sync.sync_start_fetch()

        # Patch _db_add_unlocked to raise on first call
        original_add = self.sync._db_add_unlocked
        call_count = [0]

        def _exploding_add(record):
            call_count[0] += 1
            if call_count[0] == 1:
                raise RuntimeError("Simulated DB crash")
            return original_add(record)

        with patch.object(self.sync, "_db_add_unlocked", _exploding_add):
            self.sync.sync_start_import(["300", "101"])

        # Status should be "done" (not stuck at "importing")
        with self.sync._sync_lock:
            self.assertEqual(self.sync._sync_state["status"], "done")

    @patch("server.sync.discogs_fetch_collection")
    def test_import_progress_tracking(self, mock_fetch):
        """Import should update progress counter for each record."""
        mock_fetch.return_value = self._mock_discogs_collection()
        self.sync.sync_start_fetch()

        self.sync.sync_start_import(["300", "101"])

        with self.sync._sync_lock:
            self.assertEqual(self.sync._sync_state["progress"], 2)

    @patch("server.sync.discogs_fetch_collection")
    def test_import_invalid_ids_returns_error(self, mock_fetch):
        """Import with IDs not in diff should return error."""
        mock_fetch.return_value = self._mock_discogs_collection()
        self.sync.sync_start_fetch()

        result = self.sync.sync_start_import(["nonexistent"])
        self.assertIn("error", result)

    @patch("server.sync.discogs_fetch_collection")
    def test_import_empty_collection(self, mock_fetch):
        """Import into empty collection should work."""
        # Clear the local DB
        with open(self.db_file, "w") as f:
            json.dump({"schema_version": "1.1", "records": [], "next_id": 1}, f)

        mock_fetch.return_value = self._mock_discogs_collection()
        result = self.sync.sync_start_fetch()
        # All 4 records should be new
        self.assertEqual(len(result["diff"]), 4)

        import_result = self.sync.sync_start_import(["100", "200", "300", "101"])
        self.assertEqual(import_result["imported"], 4)

        from server.database import db_list

        self.assertEqual(len(db_list()), 4)

    @patch("server.sync.discogs_fetch_collection")
    def test_import_multiple_then_refetch_empty_diff(self, mock_fetch):
        """After importing all, re-fetch should return empty diff."""
        mock_fetch.return_value = self._mock_discogs_collection()
        self.sync.sync_start_fetch()
        self.sync.sync_start_import(["300", "101"])

        # Reset state and re-fetch
        with self.sync._sync_lock:
            self.sync._sync_state["status"] = "idle"
        result = self.sync.sync_start_fetch()
        # 101 is a dup of 100 by master_id, but now both are in local
        new_only = [r for r in result["diff"] if not r.get("_duplicate")]
        self.assertEqual(len(new_only), 0)

    @patch("server.sync.discogs_fetch_collection")
    def test_import_mixed_actions(self, mock_fetch):
        """Import with both new and replace in one call."""
        mock_fetch.return_value = self._mock_discogs_collection()
        self.sync.sync_start_fetch()

        # 300 = new, 101 = replace (duplicate of 100)
        result = self.sync.sync_start_import(["300", "101"], replace_ids=["101"])
        self.assertEqual(result["imported"], 2)
        self.assertEqual(result["replaced"], 1)

        from server.database import db_list, db_get

        records = db_list()
        ids = [r["discogs_id"] for r in records]
        self.assertIn("300", ids)
        self.assertIn("101", ids)
        # Original record 1 (discogs_id=100) should be replaced
        self.assertIsNone(db_get(1))

    @patch("server.sync.discogs_fetch_collection")
    def test_import_preserves_all_fields(self, mock_fetch):
        """Imported records should have all expected fields."""
        mock_fetch.return_value = self._mock_discogs_collection()
        self.sync.sync_start_fetch()
        self.sync.sync_start_import(["300"])

        from server.database import db_list

        r = next(r for r in db_list() if r["discogs_id"] == "300")
        self.assertEqual(r["title"], "Album Three")
        self.assertEqual(r["artist"], "Artist C")
        self.assertEqual(r["year"], "2022")
        self.assertEqual(r["label"], "Label Z")
        self.assertEqual(r["format"], "Vinyl")
        self.assertEqual(r["master_id"], "M3")
        self.assertEqual(r["add_source"], "discogs_sync")
        self.assertIn("id", r)

    @patch("server.sync.discogs_fetch_collection")
    def test_import_large_batch(self, mock_fetch):
        """Import 100+ records to verify no performance issues."""
        # Generate 150 records
        big_collection = [
            {
                "discogs_id": str(1000 + i),
                "master_id": f"M{1000 + i}",
                "title": f"Album {i}",
                "artist": f"Artist {i}",
                "year": "2023",
                "label": "Big Label",
                "format": "Vinyl",
                "cover_image_url": "",
                "thumb": "",
            }
            for i in range(150)
        ]
        mock_fetch.return_value = big_collection
        result = self.sync.sync_start_fetch()
        self.assertEqual(len(result["diff"]), 150)

        all_ids = [str(1000 + i) for i in range(150)]
        import_result = self.sync.sync_start_import(all_ids)
        self.assertEqual(import_result["imported"], 150)

        from server.database import db_list

        # 2 original + 150 imported
        self.assertEqual(len(db_list()), 152)

    @patch("server.sync.discogs_fetch_collection")
    def test_import_after_diff_lost(self, mock_fetch):
        """Import should fail gracefully if diff was cleared (e.g. server restart)."""
        mock_fetch.return_value = self._mock_discogs_collection()
        self.sync.sync_start_fetch()

        # Simulate server restart — clear diff and reset state
        with self.sync._sync_lock:
            self.sync._sync_state.update(status="idle", diff=[], total=0, progress=0)

        result = self.sync.sync_start_import(["300"])
        self.assertIn("error", result)

    @patch("server.sync.discogs_fetch_collection")
    def test_import_with_stale_diff(self, mock_fetch):
        """If a record was added manually between fetch and import, it should be skipped."""
        mock_fetch.return_value = self._mock_discogs_collection()
        self.sync.sync_start_fetch()

        # Manually add record 300 before importing
        from server.database import db_add

        db_add(
            {
                "discogs_id": "300",
                "title": "Album Three",
                "artist": "Artist C",
                "year": "2022",
                "add_source": "search",
            }
        )

        result = self.sync.sync_start_import(["300"])
        # Should be skipped as duplicate
        self.assertEqual(result["imported"], 0)
        self.assertEqual(result["skipped"], 1)


class TestBackfillMasterIds(unittest.TestCase):
    """Test master_id backfill logic."""

    def setUp(self):
        import server.database as db_mod
        import server.sync as sync_mod

        self.db_file = Path(tempfile.mktemp(suffix=".json"))
        _config.DB_FILE = self.db_file
        db_mod.DB_FILE = self.db_file

        self.sync = sync_mod
        # Reset backfill flag so it runs
        sync_mod._master_ids_backfilled = False

    def tearDown(self):
        if self.db_file.exists():
            self.db_file.unlink()
        # Reset flag for other tests
        self.sync._master_ids_backfilled = False

    def _write_db(self, records):
        data = {
            "schema_version": "1.1",
            "records": records,
            "next_id": max((r["id"] for r in records), default=0) + 1,
        }
        with open(self.db_file, "w") as f:
            json.dump(data, f)

    @patch("server.sync.discogs_fetch_collection")
    def test_phase1_bulk_resolve(self, mock_fetch):
        """Phase 1 should resolve master_ids from Discogs collection."""
        self._write_db(
            [
                {
                    "id": 1,
                    "discogs_id": "100",
                    "title": "A",
                    "artist": "X",
                    "add_source": "barcode",
                },
                {
                    "id": 2,
                    "discogs_id": "200",
                    "title": "B",
                    "artist": "Y",
                    "add_source": "barcode",
                },
            ]
        )
        mock_fetch.return_value = [
            {"discogs_id": "100", "master_id": "M1", "title": "A", "artist": "X"},
            {"discogs_id": "200", "master_id": "M2", "title": "B", "artist": "Y"},
        ]

        self.sync.backfill_master_ids()

        from server.database import db_get

        self.assertEqual(db_get(1)["master_id"], "M1")
        self.assertEqual(db_get(2)["master_id"], "M2")
        self.assertTrue(self.sync._master_ids_backfilled)

    @patch("server.sync._discogs_request")
    @patch("server.sync.discogs_fetch_collection")
    def test_phase2_individual_fallback(self, mock_fetch, mock_request):
        """Phase 2 should fetch from /releases/ for records not in collection."""
        self._write_db(
            [
                {
                    "id": 1,
                    "discogs_id": "100",
                    "title": "A",
                    "artist": "X",
                    "add_source": "barcode",
                },
            ]
        )
        # Collection doesn't contain this record
        mock_fetch.return_value = []
        # Release endpoint returns master_id
        mock_request.return_value = {"master_id": 999}

        self.sync.backfill_master_ids()

        from server.database import db_get

        self.assertEqual(db_get(1)["master_id"], "999")

    @patch("server.sync._discogs_request")
    @patch("server.sync.discogs_fetch_collection")
    def test_phase2_no_master_marks_zero(self, mock_fetch, mock_request):
        """Records with no master release should be marked '0' to avoid retries."""
        self._write_db(
            [
                {
                    "id": 1,
                    "discogs_id": "100",
                    "title": "A",
                    "artist": "X",
                    "add_source": "barcode",
                },
            ]
        )
        mock_fetch.return_value = []
        mock_request.return_value = {"master_id": 0}

        self.sync.backfill_master_ids()

        from server.database import db_get

        self.assertEqual(db_get(1)["master_id"], "0")

    @patch("server.sync.discogs_fetch_collection")
    def test_skips_when_all_have_master_id(self, mock_fetch):
        """Should not make API calls when all records already have master_id."""
        self._write_db(
            [
                {
                    "id": 1,
                    "discogs_id": "100",
                    "master_id": "M1",
                    "title": "A",
                    "artist": "X",
                    "add_source": "barcode",
                },
            ]
        )

        self.sync.backfill_master_ids()

        mock_fetch.assert_not_called()
        self.assertTrue(self.sync._master_ids_backfilled)

    @patch("server.sync.discogs_fetch_collection")
    def test_skips_when_already_done(self, mock_fetch):
        """Should return immediately if backfill already completed."""
        self.sync._master_ids_backfilled = True
        self._write_db(
            [
                {
                    "id": 1,
                    "discogs_id": "100",
                    "title": "A",
                    "artist": "X",
                    "add_source": "barcode",
                },
            ]
        )

        self.sync.backfill_master_ids()

        mock_fetch.assert_not_called()

    @patch("server.sync.discogs_fetch_collection")
    def test_collection_fetch_failure_continues(self, mock_fetch):
        """If collection fetch fails, should still try phase 2."""
        self._write_db(
            [
                {
                    "id": 1,
                    "discogs_id": "100",
                    "title": "A",
                    "artist": "X",
                    "add_source": "barcode",
                },
            ]
        )
        mock_fetch.side_effect = Exception("Network error")

        with patch("server.sync._discogs_request") as mock_request:
            mock_request.return_value = {"master_id": 42}
            self.sync.backfill_master_ids()

        from server.database import db_get

        self.assertEqual(db_get(1)["master_id"], "42")

    @patch("server.sync._discogs_request")
    @patch("server.sync.discogs_fetch_collection")
    def test_phase2_api_error_skips_record(self, mock_fetch, mock_request):
        """If release API fails for a record, should skip it and continue."""
        self._write_db(
            [
                {
                    "id": 1,
                    "discogs_id": "100",
                    "title": "A",
                    "artist": "X",
                    "add_source": "barcode",
                },
                {
                    "id": 2,
                    "discogs_id": "200",
                    "title": "B",
                    "artist": "Y",
                    "add_source": "barcode",
                },
            ]
        )
        mock_fetch.return_value = []
        mock_request.side_effect = [
            Exception("429 rate limit"),
            {"master_id": 55},
        ]

        self.sync.backfill_master_ids()

        from server.database import db_get

        # Record 1 should still have no master_id (API failed)
        self.assertFalse(db_get(1).get("master_id"))
        # Record 2 should have master_id
        self.assertEqual(db_get(2)["master_id"], "55")

    @patch("server.sync.discogs_fetch_collection")
    def test_mixed_phase1_and_phase2(self, mock_fetch):
        """Some records resolved by collection, others need individual fetch."""
        self._write_db(
            [
                {
                    "id": 1,
                    "discogs_id": "100",
                    "title": "A",
                    "artist": "X",
                    "add_source": "barcode",
                },
                {
                    "id": 2,
                    "discogs_id": "200",
                    "title": "B",
                    "artist": "Y",
                    "add_source": "barcode",
                },
                {
                    "id": 3,
                    "discogs_id": "300",
                    "master_id": "M3",
                    "title": "C",
                    "artist": "Z",
                    "add_source": "barcode",
                },
            ]
        )
        # Only record 100 is in collection
        mock_fetch.return_value = [
            {"discogs_id": "100", "master_id": "M1", "title": "A", "artist": "X"},
        ]

        with patch("server.sync._discogs_request") as mock_request:
            mock_request.return_value = {"master_id": 77}
            self.sync.backfill_master_ids()

        from server.database import db_get

        self.assertEqual(db_get(1)["master_id"], "M1")  # Phase 1
        self.assertEqual(db_get(2)["master_id"], "77")  # Phase 2
        self.assertEqual(db_get(3)["master_id"], "M3")  # Already had it


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
