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


class TestLoadEnvFile(unittest.TestCase):
    def setUp(self):
        import tempfile

        self.tmpdir = tempfile.mkdtemp()

    def tearDown(self):
        import shutil

        shutil.rmtree(self.tmpdir)

    def test_load_simple_key_value(self):
        import os
        from pathlib import Path

        from server.config import _load_env_file

        env_file = Path(self.tmpdir) / ".env"
        env_file.write_text("TEST_CONFIG_KEY=hello\n")
        os.environ.pop("TEST_CONFIG_KEY", None)
        _load_env_file(env_file)
        self.assertEqual(os.environ.get("TEST_CONFIG_KEY"), "hello")
        os.environ.pop("TEST_CONFIG_KEY", None)

    def test_load_strips_quotes(self):
        import os
        from pathlib import Path

        from server.config import _load_env_file

        env_file = Path(self.tmpdir) / ".env"
        env_file.write_text('TEST_CONFIG_Q="quoted"\n')
        os.environ.pop("TEST_CONFIG_Q", None)
        _load_env_file(env_file)
        self.assertEqual(os.environ.get("TEST_CONFIG_Q"), "quoted")
        os.environ.pop("TEST_CONFIG_Q", None)

    def test_load_skips_comments(self):
        import os
        from pathlib import Path

        from server.config import _load_env_file

        env_file = Path(self.tmpdir) / ".env"
        env_file.write_text("# comment\nTEST_CONFIG_C=value\n")
        os.environ.pop("TEST_CONFIG_C", None)
        _load_env_file(env_file)
        self.assertEqual(os.environ.get("TEST_CONFIG_C"), "value")
        os.environ.pop("TEST_CONFIG_C", None)

    def test_load_skips_blank_lines(self):
        import os
        from pathlib import Path

        from server.config import _load_env_file

        env_file = Path(self.tmpdir) / ".env"
        env_file.write_text("\n\n  \nTEST_CONFIG_B=val\n\n")
        os.environ.pop("TEST_CONFIG_B", None)
        _load_env_file(env_file)
        self.assertEqual(os.environ.get("TEST_CONFIG_B"), "val")
        os.environ.pop("TEST_CONFIG_B", None)

    def test_setdefault_does_not_override(self):
        import os
        from pathlib import Path

        from server.config import _load_env_file

        env_file = Path(self.tmpdir) / ".env"
        env_file.write_text("TEST_CONFIG_X=from_file\n")
        os.environ["TEST_CONFIG_X"] = "from_env"
        _load_env_file(env_file)
        self.assertEqual(os.environ.get("TEST_CONFIG_X"), "from_env")
        os.environ.pop("TEST_CONFIG_X", None)

    def test_load_nonexistent_file(self):
        from pathlib import Path

        from server.config import _load_env_file

        _load_env_file(Path("/nonexistent/.env"))  # should not raise

    def test_strips_whitespace(self):
        import os
        from pathlib import Path

        from server.config import _load_env_file

        env_file = Path(self.tmpdir) / ".env"
        env_file.write_text("  TEST_CONFIG_W  =  spaced  \n")
        os.environ.pop("TEST_CONFIG_W", None)
        _load_env_file(env_file)
        self.assertEqual(os.environ.get("TEST_CONFIG_W"), "spaced")
        os.environ.pop("TEST_CONFIG_W", None)


class TestSaveToken(unittest.TestCase):
    def setUp(self):
        import tempfile

        self.tmpdir = tempfile.mkdtemp()
        self._orig_data_dir = __import__("server.config", fromlist=["config"]).DATA_DIR
        import server.config as cfg

        cfg.DATA_DIR = __import__("pathlib").Path(self.tmpdir)

    def tearDown(self):
        import shutil

        import server.config as cfg

        cfg.DATA_DIR = self._orig_data_dir
        shutil.rmtree(self.tmpdir)

    def test_save_new_token(self):
        import os

        import server.config as cfg

        cfg.save_token("TEST_SAVE_KEY", "myvalue")
        env_file = cfg.DATA_DIR / ".env"
        content = env_file.read_text()
        self.assertIn("TEST_SAVE_KEY=myvalue", content)
        os.environ.pop("TEST_SAVE_KEY", None)

    def test_save_updates_existing(self):
        import os

        import server.config as cfg

        env_file = cfg.DATA_DIR / ".env"
        env_file.write_text("EXISTING_KEY=old\n")
        cfg.save_token("EXISTING_KEY", "new")
        content = env_file.read_text()
        self.assertIn("EXISTING_KEY=new", content)
        self.assertNotIn("EXISTING_KEY=old", content)
        os.environ.pop("EXISTING_KEY", None)

    def test_save_preserves_other_keys(self):
        import os

        import server.config as cfg

        env_file = cfg.DATA_DIR / ".env"
        env_file.write_text("KEY_A=1\nKEY_B=2\n")
        cfg.save_token("KEY_A", "updated")
        content = env_file.read_text()
        self.assertIn("KEY_A=updated", content)
        self.assertIn("KEY_B=2", content)
        os.environ.pop("KEY_A", None)
        os.environ.pop("KEY_B", None)

    def test_save_preserves_comments(self):
        import os

        import server.config as cfg

        env_file = cfg.DATA_DIR / ".env"
        env_file.write_text("# My comment\nKEY=val\n")
        cfg.save_token("KEY", "new")
        content = env_file.read_text()
        self.assertIn("# My comment", content)
        os.environ.pop("KEY", None)


class TestSupportedModels(unittest.TestCase):
    def test_supported_models_not_empty(self):
        from server.config import SUPPORTED_MODELS

        self.assertGreater(len(SUPPORTED_MODELS), 0)

    def test_default_model_in_list(self):
        from server.config import SUPPORTED_MODELS

        self.assertIn("claude-sonnet-4-6", SUPPORTED_MODELS)


if __name__ == "__main__":
    unittest.main()
