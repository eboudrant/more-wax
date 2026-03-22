"""
Tests for image processing helpers (server/images.py).
Tests parsing logic only — no actual API calls or file I/O.
"""

import base64
import json
import unittest
from unittest import mock


class TestIdentifyCoverParsing(unittest.TestCase):
    """Test the identify_cover function's response parsing."""

    def _call_identify(self, claude_response_text, api_key="test-key"):
        """Helper: mock the API call and return identify_cover result."""
        # Build a fake urllib response
        api_response = json.dumps(
            {"content": [{"type": "text", "text": claude_response_text}]}
        ).encode()

        # 1x1 red pixel JPEG as base64
        img_data = "data:image/jpeg;base64,/9j/4AAQSkZJRg=="

        with (
            mock.patch("server.config.ANTHROPIC_API_KEY", api_key),
            mock.patch("server.config.VISION_MODEL", "claude-sonnet-4-6"),
            mock.patch("urllib.request.urlopen") as mock_urlopen,
        ):
            mock_resp = mock.MagicMock()
            mock_resp.read.return_value = api_response
            mock_resp.__enter__ = mock.MagicMock(return_value=mock_resp)
            mock_resp.__exit__ = mock.MagicMock(return_value=False)
            mock_urlopen.return_value = mock_resp

            from server.images import identify_cover

            return identify_cover(img_data)

    def test_basic_identification(self):
        response = json.dumps(
            {
                "artist": "DJ Shadow",
                "title": "Endtroducing",
                "label": "Mo Wax",
                "catalog_number": "MW059LP",
                "country": "UK",
                "year": "1996",
                "barcode": "5021392052625",
                "format_details": "2xLP",
            }
        )
        result = self._call_identify(response)
        self.assertTrue(result["success"])
        self.assertEqual(result["artist"], "DJ Shadow")
        self.assertEqual(result["title"], "Endtroducing")
        self.assertEqual(result["label"], "Mo Wax")
        self.assertEqual(result["catalog_number"], "MW059LP")
        self.assertEqual(result["country"], "UK")
        self.assertEqual(result["barcode"], "5021392052625")

    def test_markdown_code_fence_stripped(self):
        result = self._call_identify(
            '```json\n{"artist": "UNKLE", "title": "Psyence Fiction", '
            '"label": "", "catalog_number": "", "country": "", "year": "", '
            '"barcode": "", "format_details": ""}\n```'
        )
        self.assertTrue(result["success"])
        self.assertEqual(result["artist"], "UNKLE")
        self.assertEqual(result["title"], "Psyence Fiction")

    def test_empty_artist_and_title_returns_failure(self):
        result = self._call_identify(
            '{"artist": "", "title": "", "label": "", "catalog_number": "", '
            '"country": "", "year": "", "barcode": "", "format_details": ""}'
        )
        self.assertFalse(result["success"])

    def test_missing_api_key(self):
        result = self._call_identify("{}", api_key="")
        self.assertFalse(result["success"])
        self.assertIn("ANTHROPIC_API_KEY", result["error"])

    def test_partial_fields(self):
        """Only artist + title provided, other fields empty."""
        result = self._call_identify(
            '{"artist": "Massive Attack", "title": "Mezzanine", '
            '"label": "", "catalog_number": "", "country": "", "year": "", '
            '"barcode": "", "format_details": ""}'
        )
        self.assertTrue(result["success"])
        self.assertEqual(result["artist"], "Massive Attack")
        self.assertEqual(result["label"], "")


class TestUploadCoverPaths(unittest.TestCase):
    """Test upload_cover path handling."""

    @mock.patch("server.images.db_update")
    @mock.patch("server.images.COVERS_DIR")
    def test_data_url_prefix_stripped(self, mock_covers_dir, mock_db_update):
        """data:image/jpeg;base64, prefix should be stripped before decode."""
        import tempfile
        from pathlib import Path

        tmp_dir = Path(tempfile.mkdtemp())
        mock_covers_dir.__truediv__ = lambda self, x: tmp_dir / x

        # Minimal valid base64 for a tiny file
        raw_b64 = base64.b64encode(b"fake-image-data").decode()
        img_data = f"data:image/jpeg;base64,{raw_b64}"

        from server.images import upload_cover

        result = upload_cover(img_data, "42")

        self.assertTrue(result["success"])
        self.assertIn("cover_42.jpg", result["path"])
        mock_db_update.assert_called_once_with(42, {"local_cover": result["path"]})

    @mock.patch("server.images.db_update")
    @mock.patch("server.images.COVERS_DIR")
    def test_tmp_record_skips_db_update(self, mock_covers_dir, mock_db_update):
        import tempfile
        from pathlib import Path

        tmp_dir = Path(tempfile.mkdtemp())
        mock_covers_dir.__truediv__ = lambda self, x: tmp_dir / x

        raw_b64 = base64.b64encode(b"fake-image-data").decode()
        from server.images import upload_cover

        result = upload_cover(raw_b64, "tmp")

        self.assertTrue(result["success"])
        mock_db_update.assert_not_called()


class TestUploadCoverValidation(unittest.TestCase):
    """Test input validation added to upload_cover."""

    def test_empty_image_data(self):
        from server.images import upload_cover

        result = upload_cover("", "1")
        self.assertFalse(result["success"])
        self.assertIn("No image", result["error"])

    def test_invalid_base64(self):
        from server.images import upload_cover

        result = upload_cover("not-valid-base64!!!", "1")
        self.assertFalse(result["success"])
        self.assertIn("Invalid base64", result["error"])

    @mock.patch("server.images.db_update")
    @mock.patch("server.images.COVERS_DIR")
    def test_record_id_sanitised(self, mock_covers_dir, mock_db_update):
        """Path traversal in record_id must be stripped."""
        import tempfile
        from pathlib import Path

        tmp_dir = Path(tempfile.mkdtemp())
        mock_covers_dir.__truediv__ = lambda self, x: tmp_dir / x

        raw_b64 = base64.b64encode(b"fake-image-data").decode()
        from server.images import upload_cover

        result = upload_cover(raw_b64, "../../../etc/passwd")
        self.assertTrue(result["success"])
        # The filename should NOT contain path separators
        self.assertNotIn("..", result["path"])
        self.assertNotIn("/etc/", result["path"])


class TestConvertImageValidation(unittest.TestCase):
    """Test input validation for convert_image."""

    def test_empty_image_data(self):
        from server.images import convert_image

        result = convert_image("")
        self.assertFalse(result["success"])

    def test_invalid_base64(self):
        from server.images import convert_image

        result = convert_image("not!!valid!!base64")
        self.assertFalse(result["success"])
        self.assertIn("Invalid base64", result["error"])


class TestCodeFenceParsing(unittest.TestCase):
    """Test that code-fence stripping doesn't crash on edge cases."""

    def _call_identify(self, claude_response_text):
        api_response = json.dumps(
            {"content": [{"type": "text", "text": claude_response_text}]}
        ).encode()
        img_data = "data:image/jpeg;base64,/9j/4AAQSkZJRg=="

        with (
            mock.patch("server.config.ANTHROPIC_API_KEY", "test-key"),
            mock.patch("server.config.VISION_MODEL", "claude-sonnet-4-6"),
            mock.patch("urllib.request.urlopen") as mock_urlopen,
        ):
            mock_resp = mock.MagicMock()
            mock_resp.read.return_value = api_response
            mock_resp.__enter__ = mock.MagicMock(return_value=mock_resp)
            mock_resp.__exit__ = mock.MagicMock(return_value=False)
            mock_urlopen.return_value = mock_resp

            from server.images import identify_cover

            return identify_cover(img_data)

    def test_triple_backtick_only(self):
        """Single ``` with no closing should not crash."""
        result = self._call_identify("```")
        self.assertFalse(result["success"])

    def test_code_fence_no_json_label(self):
        """Code fence without 'json' label should still parse."""
        result = self._call_identify('```\n{"artist": "Test", "title": "Album"}\n```')
        self.assertTrue(result["success"])
        self.assertEqual(result["artist"], "Test")

    def test_malformed_json_in_fence(self):
        """Malformed JSON inside code fence should not crash."""
        result = self._call_identify("```json\n{not json}\n```")
        self.assertFalse(result["success"])


if __name__ == "__main__":
    unittest.main()
