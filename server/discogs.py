"""
More'Wax — Discogs API Client
All external Discogs API calls are routed through this module.
"""

import concurrent.futures
import json
import urllib.error
import urllib.parse
import urllib.request

from server.config import DISCOGS_API, DISCOGS_TOKEN

_discogs_username = None  # populated on first call to discogs_fetch_identity()


def _discogs_request(method: str, path: str, params: dict = None) -> dict:
    """Make a request to the Discogs API. Returns parsed JSON."""
    url = DISCOGS_API + path
    if params:
        url += "?" + urllib.parse.urlencode(params)

    tag = f"{method} {path}"
    print(f"  🔵 [discogs] {tag}")

    req = urllib.request.Request(url, method=method, headers={
        "Authorization": f"Discogs token={DISCOGS_TOKEN}",
        "User-Agent":    "More'Wax/1.0",
        "Content-Type":  "application/json",
    })
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            rate_remain = resp.headers.get("X-Discogs-Ratelimit-Remaining", "?")
            body = json.loads(resp.read())
            print(f"  ✅ [discogs] {tag} → OK (rate remaining: {rate_remain})")
            return body
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8", errors="replace")[:300]
        print(f"  ❌ [discogs] {tag} → {e.code}: {err_body}")
        raise


def discogs_search(q: str = "", barcode: str = "") -> list:
    """Search Discogs for releases by text or barcode."""
    params = {"type": "release"}
    if barcode:
        params["barcode"] = barcode
        params["per_page"] = "10"
    else:
        params["q"] = q
        params["per_page"] = "25"
    data = _discogs_request("GET", "/database/search", params)
    return data.get("results", [])


def discogs_release_full(release_id: str) -> dict:
    """Fetch a release with prices and collection status."""

    def _get_release():
        return _discogs_request("GET", f"/releases/{release_id}")

    def _get_stats():
        try:
            return _discogs_request("GET", f"/marketplace/stats/{release_id}")
        except Exception:
            return {}

    def _get_suggestions():
        try:
            return _discogs_request("GET", f"/marketplace/price_suggestions/{release_id}")
        except Exception:
            return {}

    def _get_collection():
        if not _discogs_username:
            return None
        try:
            return _discogs_request("GET", f"/users/{_discogs_username}/collection/releases/{release_id}")
        except Exception:
            return None

    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        f_release     = pool.submit(_get_release)
        f_stats       = pool.submit(_get_stats)
        f_suggestions = pool.submit(_get_suggestions)
        f_collection  = pool.submit(_get_collection)

    release = f_release.result()
    stats   = f_stats.result()
    sugg    = f_suggestions.result()
    coll    = f_collection.result()

    # Parse prices
    price_low = price_median = price_high = ""
    price_currency = "USD"
    num_for_sale = ""

    if stats:
        lp = stats.get("lowest_price") or {}
        if lp.get("value") is not None:
            price_low      = str(lp["value"])
            price_currency = lp.get("currency", "USD")
        if stats.get("num_for_sale") is not None:
            num_for_sale = str(stats["num_for_sale"])

    if sugg:
        vgp = sugg.get("Very Good Plus (VG+)") or {}
        if vgp.get("value") is not None:
            price_median   = str(vgp["value"])
            price_currency = vgp.get("currency", price_currency)
        nm = sugg.get("Near Mint (NM or M-)") or sugg.get("Mint (M)") or {}
        if nm.get("value") is not None:
            price_high = str(nm["value"])

    # Collection status
    already_in_discogs = False
    if coll and isinstance(coll.get("releases"), list):
        already_in_discogs = len(coll["releases"]) > 0

    # Parse artist string (remove Discogs (12345) suffixes)
    artists = release.get("artists") or []
    artist_str = ", ".join(
        a["name"].rsplit(" (", 1)[0] if " (" in a["name"] else a["name"]
        for a in artists
    ) if artists else release.get("title", "").split(" - ")[0]

    # Find barcode in identifiers
    barcode_val = ""
    for ident in (release.get("identifiers") or []):
        if ident.get("type") == "Barcode":
            barcode_val = ident.get("value", "")
            break

    return {
        "discogs_id":      str(release.get("id", "")),
        "title":           release.get("title", ""),
        "artist":          artist_str,
        "year":            str(release.get("year", "")),
        "label":           ", ".join(l.get("name", "") for l in (release.get("labels") or [])),
        "catalog_number":  ", ".join(l.get("catno", "") for l in (release.get("labels") or []) if l.get("catno")),
        "format":          ", ".join(f.get("name", "") for f in (release.get("formats") or [])),
        "genres":          json.dumps(release.get("genres") or []),
        "styles":          json.dumps(release.get("styles") or []),
        "country":         release.get("country", ""),
        "cover_image_url": (release.get("images") or [{}])[0].get("uri", ""),
        "barcode":         barcode_val,
        "price_low":       price_low,
        "price_median":    price_median,
        "price_high":      price_high,
        "price_currency":  price_currency,
        "num_for_sale":    num_for_sale,
        "already_in_discogs": already_in_discogs,
    }


def discogs_refresh_prices(release_id: str) -> dict:
    """Fetch just the prices for a release (stats + suggestions)."""
    prices = {"price_low": "", "price_median": "", "price_high": "",
              "price_currency": "USD", "num_for_sale": ""}
    try:
        stats = _discogs_request("GET", f"/marketplace/stats/{release_id}")
        lp = stats.get("lowest_price") or {}
        if lp.get("value") is not None:
            prices["price_low"]      = str(lp["value"])
            prices["price_currency"] = lp.get("currency", "USD")
        if stats.get("num_for_sale") is not None:
            prices["num_for_sale"] = str(stats["num_for_sale"])
    except Exception as e:
        print(f"  ⚠️ [discogs] stats failed for {release_id}: {e}")

    try:
        sugg = _discogs_request("GET", f"/marketplace/price_suggestions/{release_id}")
        vgp = sugg.get("Very Good Plus (VG+)") or {}
        if vgp.get("value") is not None:
            prices["price_median"]   = str(vgp["value"])
            prices["price_currency"] = vgp.get("currency", prices["price_currency"])
        nm = sugg.get("Near Mint (NM or M-)") or sugg.get("Mint (M)") or {}
        if nm.get("value") is not None:
            prices["price_high"] = str(nm["value"])
    except Exception as e:
        print(f"  ⚠️ [discogs] suggestions failed for {release_id}: {e}")

    return prices


def discogs_add_to_collection(release_id: str) -> bool:
    """Add a release to the user's Discogs collection."""
    if not _discogs_username:
        return False
    try:
        _discogs_request("POST", f"/users/{_discogs_username}/collection/folders/1/releases/{release_id}")
        return True
    except Exception as e:
        print(f"  ⚠️ [discogs] add to collection failed: {e}")
        return False


def discogs_fetch_identity():
    """Fetch and cache the authenticated Discogs username."""
    global _discogs_username
    try:
        data = _discogs_request("GET", "/oauth/identity")
        _discogs_username = data.get("username")
        print(f"  👤 [discogs] Authenticated as: {_discogs_username}")
    except Exception as e:
        print(f"  ⚠️ [discogs] Could not fetch identity: {e}")
