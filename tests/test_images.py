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
        api_response = json.dumps({
            "content": [{"type": "text", "text": claude_response_text}]
        }).encode()

        # 1x1 red pixel JPEG as base64
        img_data = "data:image/jpeg;base64,/9j/4AAQSkZJRg=="

        with mock.patch("server.images.ANTHROPIC_API_KEY", api_key), \
             mock.patch("server.images.VISION_MODEL", "claude-sonnet-4-6"), \
             mock.patch("urllib.request.urlopen") as mock_urlopen:

            mock_resp = mock.MagicMock()
            mock_resp.read.return_value = api_response
            mock_resp.__enter__ = mock.MagicMock(return_value=mock_resp)
            mock_resp.__exit__ = mock.MagicMock(return_value=False)
            mock_urlopen.return_value = mock_resp

            from server.images import identify_cover
            return identify_cover(img_data)

    def test_basic_identification(self):
        response = json.dumps({
            "artist": "DJ Shadow", "title": "Endtroducing",
            "label": "Mo Wax", "catalog_number": "MW059LP",
            "country": "UK", "year": "1996",
            "barcode": "5021392052625", "format_details": "2xLP"
        })
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
        result = self._call_identify('{}', api_key="")
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


if __name__ == "__main__":
    unittest.main()
