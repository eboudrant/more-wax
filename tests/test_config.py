"""
Tests for configuration loading (server/config.py).
Verifies paths and constants are set correctly.
"""

import unittest


class TestConfig(unittest.TestCase):
    def test_paths_exist_as_path_objects(self):
        from server.config import BASE_DIR, STATIC_DIR, DATA_DIR, COVERS_DIR, DB_FILE
        from pathlib import Path

        self.assertIsInstance(BASE_DIR, Path)
        self.assertIsInstance(STATIC_DIR, Path)
        self.assertIsInstance(DATA_DIR, Path)
        self.assertIsInstance(COVERS_DIR, Path)
        self.assertIsInstance(DB_FILE, Path)

    def test_path_hierarchy(self):
        from server.config import BASE_DIR, STATIC_DIR, DATA_DIR, COVERS_DIR, DB_FILE

        self.assertEqual(STATIC_DIR, BASE_DIR / "static")
        self.assertEqual(DATA_DIR, BASE_DIR / "data")
        self.assertEqual(COVERS_DIR, DATA_DIR / "covers")
        self.assertEqual(DB_FILE, DATA_DIR / "collection.json")

    def test_discogs_api_url(self):
        from server.config import DISCOGS_API

        self.assertEqual(DISCOGS_API, "https://api.discogs.com")

    def test_vision_model_has_default(self):
        from server.config import VISION_MODEL

        # Should be a non-empty string (either from .env or default)
        self.assertIsInstance(VISION_MODEL, str)
        self.assertTrue(len(VISION_MODEL) > 0)


if __name__ == "__main__":
    unittest.main()
