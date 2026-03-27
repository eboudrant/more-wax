"""Tests for the Discogs module — pure logic, no network calls."""

import unittest


class TestCleanName(unittest.TestCase):
    def test_strip_disambiguation(self):
        from server.discogs import _clean_name

        self.assertEqual(_clean_name("Daft Punk (42)"), "Daft Punk")

    def test_no_disambiguation(self):
        from server.discogs import _clean_name

        self.assertEqual(_clean_name("Daft Punk"), "Daft Punk")

    def test_multiple_parens(self):
        from server.discogs import _clean_name

        self.assertEqual(_clean_name("DJ Shadow (2) (3)"), "DJ Shadow (2)")

    def test_empty_string(self):
        from server.discogs import _clean_name

        self.assertEqual(_clean_name(""), "")

    def test_parens_in_title(self):
        from server.discogs import _clean_name

        # "(Remix)" should be stripped since it has " ("
        self.assertEqual(_clean_name("Track (Remix)"), "Track")


class TestFormatArtists(unittest.TestCase):
    def test_single_artist(self):
        from server.discogs import _format_artists

        self.assertEqual(_format_artists([{"name": "Daft Punk"}]), "Daft Punk")

    def test_multiple_artists(self):
        from server.discogs import _format_artists

        self.assertEqual(
            _format_artists([{"name": "Artist A"}, {"name": "Artist B"}]),
            "Artist A, Artist B",
        )

    def test_with_disambiguation(self):
        from server.discogs import _format_artists

        self.assertEqual(_format_artists([{"name": "DJ Shadow (2)"}]), "DJ Shadow")

    def test_empty_list(self):
        from server.discogs import _format_artists

        self.assertEqual(_format_artists([]), "")

    def test_none_input(self):
        from server.discogs import _format_artists

        self.assertEqual(_format_artists(None), "")

    def test_missing_name_field(self):
        from server.discogs import _format_artists

        self.assertEqual(_format_artists([{}]), "")

    def test_mixed_artists(self):
        from server.discogs import _format_artists

        self.assertEqual(
            _format_artists(
                [
                    {"name": "Daft Punk"},
                    {"name": "Pharrell Williams (2)"},
                ]
            ),
            "Daft Punk, Pharrell Williams",
        )


class TestParsePrices(unittest.TestCase):
    def test_full_prices(self):
        from server.discogs import _parse_prices

        stats = {"num_for_sale": 42}
        suggestions = {
            "Very Good (VG)": {"value": 5.0, "currency": "USD"},
            "Very Good Plus (VG+)": {"value": 10.0, "currency": "USD"},
            "Near Mint (NM or M-)": {"value": 20.0, "currency": "USD"},
        }
        result = _parse_prices(stats, suggestions)
        self.assertEqual(result["price_low"], "5.0")
        self.assertEqual(result["price_median"], "10.0")
        self.assertEqual(result["price_high"], "20.0")
        self.assertEqual(result["num_for_sale"], "42")
        self.assertEqual(result["price_currency"], "USD")

    def test_empty_stats_and_suggestions(self):
        from server.discogs import _parse_prices

        result = _parse_prices({}, {})
        self.assertEqual(result["price_low"], "")
        self.assertEqual(result["price_median"], "")
        self.assertEqual(result["price_high"], "")

    def test_none_stats_and_suggestions(self):
        from server.discogs import _parse_prices

        result = _parse_prices(None, None)
        self.assertEqual(result["price_low"], "")

    def test_fallback_good_plus(self):
        from server.discogs import _parse_prices

        suggestions = {
            "Good Plus (G+)": {"value": 3.0, "currency": "EUR"},
        }
        result = _parse_prices({}, suggestions)
        self.assertEqual(result["price_low"], "3.0")
        self.assertEqual(result["price_currency"], "EUR")

    def test_fallback_mint(self):
        from server.discogs import _parse_prices

        suggestions = {
            "Mint (M)": {"value": 50.0, "currency": "GBP"},
        }
        result = _parse_prices({}, suggestions)
        self.assertEqual(result["price_high"], "50.0")

    def test_partial_suggestions(self):
        from server.discogs import _parse_prices

        suggestions = {
            "Very Good Plus (VG+)": {"value": 15.0, "currency": "USD"},
        }
        result = _parse_prices({}, suggestions)
        self.assertEqual(result["price_low"], "")
        self.assertEqual(result["price_median"], "15.0")
        self.assertEqual(result["price_high"], "")

    def test_zero_num_for_sale(self):
        from server.discogs import _parse_prices

        result = _parse_prices({"num_for_sale": 0}, {})
        self.assertEqual(result["num_for_sale"], "0")

    def test_none_value_in_suggestion(self):
        from server.discogs import _parse_prices

        suggestions = {
            "Very Good Plus (VG+)": {"value": None, "currency": "USD"},
        }
        result = _parse_prices({}, suggestions)
        self.assertEqual(result["price_median"], "")

    def test_currency_propagation(self):
        from server.discogs import _parse_prices

        suggestions = {
            "Very Good (VG)": {"value": 5.0, "currency": "EUR"},
            "Very Good Plus (VG+)": {"value": 10.0},
        }
        result = _parse_prices({}, suggestions)
        # VG+ has no currency, should inherit from VG
        self.assertEqual(result["price_currency"], "EUR")


class TestDiscogsApiUrl(unittest.TestCase):
    def test_api_base_url(self):
        from server.config import DISCOGS_API

        self.assertTrue(DISCOGS_API.startswith("https://"))


if __name__ == "__main__":
    unittest.main()
