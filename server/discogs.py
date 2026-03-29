"""
More'Wax — Discogs API Client
All external Discogs API calls are routed through this module.
"""

import concurrent.futures
import json
import urllib.error
import urllib.parse
import urllib.request

import server.config as _config

_discogs_username = None  # populated on first call to discogs_fetch_identity()


def _clean_name(name: str) -> str:
    """Strip Discogs disambiguation suffixes like ' (42)' from artist names."""
    return name.rsplit(" (", 1)[0] if " (" in name else name


def _format_artists(artists: list) -> str:
    """Format a Discogs artists list into a clean comma-separated string."""
    if not artists:
        return ""
    return ", ".join(_clean_name(a.get("name", "")) for a in artists)


def _discogs_request(method: str, path: str, params: dict = None) -> dict:
    """Make a request to the Discogs API. Returns parsed JSON."""
    url = _config.DISCOGS_API + path
    if params:
        url += "?" + urllib.parse.urlencode(params)

    tag = f"{method} {path}"
    print(f"  🔵 [discogs] {tag}")

    if not url.startswith("https://"):
        raise ValueError(f"Refusing non-HTTPS URL: {url}")

    req = urllib.request.Request(
        url,
        method=method,
        headers={
            "Authorization": f"Discogs token={_config.DISCOGS_TOKEN}",
            "User-Agent": "More'Wax/1.0",
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:  # nosec B310
            rate_remain = resp.headers.get("X-Discogs-Ratelimit-Remaining", "?")
            raw = resp.read()
            body = json.loads(raw) if raw else {}
            print(f"  ✅ [discogs] {tag} → OK (rate remaining: {rate_remain})")
            return body
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8", errors="replace")[:300]
        print(f"  ❌ [discogs] {tag} → {e.code}: {err_body}")
        raise


def _parse_prices(stats: dict, suggestions: dict) -> dict:
    """Extract price fields from Discogs marketplace stats and price suggestions."""
    prices = {
        "price_low": "",
        "price_median": "",
        "price_high": "",
        "price_currency": "USD",
        "num_for_sale": "",
    }

    if stats:
        if stats.get("num_for_sale") is not None:
            prices["num_for_sale"] = str(stats["num_for_sale"])

    if suggestions:
        # Use price suggestions for all three tiers (consistent source):
        # Good (G+) or Very Good (VG) → low
        # Very Good Plus (VG+) → median
        # Near Mint (NM or M-) or Mint (M) → high
        vg = (
            suggestions.get("Very Good (VG)") or suggestions.get("Good Plus (G+)") or {}
        )
        if vg.get("value") is not None:
            prices["price_low"] = str(vg["value"])
            prices["price_currency"] = vg.get("currency", "USD")
        vgp = suggestions.get("Very Good Plus (VG+)") or {}
        if vgp.get("value") is not None:
            prices["price_median"] = str(vgp["value"])
            prices["price_currency"] = vgp.get("currency", prices["price_currency"])
        nm = (
            suggestions.get("Near Mint (NM or M-)") or suggestions.get("Mint (M)") or {}
        )
        if nm.get("value") is not None:
            prices["price_high"] = str(nm["value"])

    return prices


def discogs_search(q: str = "", barcode: str = "", format_filter: str = "All") -> list:
    """Search Discogs for releases by text or barcode."""
    params = {"type": "release"}
    if barcode:
        params["barcode"] = barcode
        params["per_page"] = "10"
    else:
        params["q"] = q
        params["per_page"] = "25"
        if format_filter and format_filter != "All":
            params["format"] = format_filter
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
            return _discogs_request(
                "GET", f"/marketplace/price_suggestions/{release_id}"
            )
        except Exception:
            return {}

    def _get_collection():
        if not _discogs_username:
            return None
        try:
            return _discogs_request(
                "GET", f"/users/{_discogs_username}/collection/releases/{release_id}"
            )
        except Exception:
            return None

    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        f_release = pool.submit(_get_release)
        f_stats = pool.submit(_get_stats)
        f_suggestions = pool.submit(_get_suggestions)
        f_collection = pool.submit(_get_collection)

    release = f_release.result()
    stats = f_stats.result()
    sugg = f_suggestions.result()
    coll = f_collection.result()

    prices = _parse_prices(stats, sugg)

    # Collection status
    already_in_discogs = False
    if coll and isinstance(coll.get("releases"), list):
        already_in_discogs = len(coll["releases"]) > 0

    artist_str = (
        _format_artists(release.get("artists") or [])
        or release.get("title", "").split(" - ")[0]
    )

    # Find barcode in identifiers
    barcode_val = ""
    for ident in release.get("identifiers") or []:
        if ident.get("type") == "Barcode":
            barcode_val = ident.get("value", "")
            break

    # Community rating
    community = release.get("community") or {}
    rating_info = community.get("rating") or {}
    rating_average = rating_info.get("average", 0)
    rating_count = rating_info.get("count", 0)

    return {
        "discogs_id": str(release.get("id", "")),
        "master_id": str(release.get("master_id", "") or ""),
        "title": release.get("title", ""),
        "artist": artist_str,
        "year": str(release.get("year", "")),
        "label": ", ".join(
            lbl.get("name", "") for lbl in (release.get("labels") or [])
        ),
        "catalog_number": ", ".join(
            lbl.get("catno", "")
            for lbl in (release.get("labels") or [])
            if lbl.get("catno")
        ),
        "format": ", ".join(f.get("name", "") for f in (release.get("formats") or [])),
        "genres": json.dumps(release.get("genres") or []),
        "styles": json.dumps(release.get("styles") or []),
        "country": release.get("country", ""),
        "cover_image_url": (release.get("images") or [{}])[0].get("uri", ""),
        "barcode": barcode_val,
        "price_low": prices["price_low"],
        "price_median": prices["price_median"],
        "price_high": prices["price_high"],
        "price_currency": prices["price_currency"],
        "num_for_sale": prices["num_for_sale"],
        "rating_average": str(rating_average) if rating_average else "",
        "rating_count": str(rating_count) if rating_count else "",
        "already_in_discogs": already_in_discogs,
        "discogs_extra": {
            "tracklist": release.get("tracklist") or [],
            "formats": release.get("formats") or [],
            "extraartists": release.get("extraartists") or [],
            "notes": release.get("notes", ""),
            "identifiers": release.get("identifiers") or [],
            "companies": release.get("companies") or [],
            "series": release.get("series") or [],
        },
    }


def discogs_refresh_prices(release_id: str, fetch_rating: bool = True) -> dict:
    """Fetch prices (and optionally rating) for a release.

    Set fetch_rating=False to skip the extra /releases/ call when the
    rating is already known — saves one API hit per record.
    """
    stats = {}
    try:
        stats = _discogs_request("GET", f"/marketplace/stats/{release_id}")
    except Exception as e:
        print(f"  ⚠️ [discogs] stats failed for {release_id}: {e}")

    sugg = {}
    try:
        sugg = _discogs_request("GET", f"/marketplace/price_suggestions/{release_id}")
    except Exception as e:
        print(f"  ⚠️ [discogs] suggestions failed for {release_id}: {e}")

    prices = _parse_prices(stats, sugg)
    prices["rating_average"] = ""
    prices["rating_count"] = ""

    # Only fetch rating when needed (costs one extra API call)
    if fetch_rating:
        try:
            release = _discogs_request("GET", f"/releases/{release_id}")
            community = release.get("community") or {}
            rating_info = community.get("rating") or {}
            avg = rating_info.get("average", 0)
            cnt = rating_info.get("count", 0)
            if avg:
                prices["rating_average"] = str(avg)
            if cnt:
                prices["rating_count"] = str(cnt)
        except Exception as e:
            print(f"  ⚠️ [discogs] release rating failed for {release_id}: {e}")

    return prices


def discogs_add_to_collection(release_id: str) -> bool:
    """Add a release to the user's Discogs collection."""
    if not _discogs_username:
        return False
    try:
        _discogs_request(
            "POST",
            f"/users/{_discogs_username}/collection/folders/1/releases/{release_id}",
        )
        return True
    except Exception as e:
        print(f"  ⚠️ [discogs] add to collection failed: {e}")
        return False


def discogs_check_collection(release_id: str) -> bool:
    """Check if a release is in the user's Discogs collection."""
    if not _discogs_username:
        return False
    try:
        data = _discogs_request(
            "GET",
            f"/users/{_discogs_username}/collection/releases/{release_id}",
        )
        return bool(data.get("releases"))
    except Exception:
        return False


def discogs_remove_from_collection(release_id: str) -> bool:
    """Remove a release from the user's Discogs collection (folder 1)."""
    if not _discogs_username:
        return False
    try:
        # First get the instance_id
        data = _discogs_request(
            "GET",
            f"/users/{_discogs_username}/collection/releases/{release_id}",
        )
        releases = data.get("releases", [])
        if not releases:
            return False
        # Remove each instance (usually just one)
        for r in releases:
            instance_id = r.get("instance_id")
            folder_id = r.get("folder_id", 1)
            if instance_id:
                _discogs_request(
                    "DELETE",
                    f"/users/{_discogs_username}/collection/folders/{folder_id}/releases/{release_id}/instances/{instance_id}",
                )
        return True
    except Exception as e:
        print(f"  ⚠️ [discogs] remove from collection failed: {e}")
        return False


def discogs_release_details(release_id: str) -> dict:
    """Fetch extended release details (tracklist, credits, etc.) for caching."""
    release = _discogs_request("GET", f"/releases/{release_id}")

    # Tracklist
    tracklist = []
    for t in release.get("tracklist") or []:
        entry = {
            "position": t.get("position", ""),
            "title": t.get("title", ""),
            "duration": t.get("duration", ""),
            "type_": t.get("type_", "track"),
        }
        # Track-level credits
        track_artists = t.get("extraartists") or []
        if track_artists:
            entry["extraartists"] = [
                {
                    "name": _clean_name(a.get("name", "Unknown")),
                    "role": a.get("role", ""),
                }
                for a in track_artists
            ]
        tracklist.append(entry)

    # Format details
    formats = []
    for f in release.get("formats") or []:
        formats.append(
            {
                "name": f.get("name", ""),
                "qty": f.get("qty", "1"),
                "descriptions": f.get("descriptions") or [],
            }
        )

    # Release-level credits
    extraartists = [
        {"name": _clean_name(a.get("name", "Unknown")), "role": a.get("role", "")}
        for a in (release.get("extraartists") or [])
    ]

    # Identifiers (matrix/runout, ISRC, etc.)
    identifiers = [
        {
            "type": i.get("type", ""),
            "value": i.get("value", ""),
            "description": i.get("description", ""),
        }
        for i in (release.get("identifiers") or [])
    ]

    # Companies (pressed by, distributed by, etc.)
    companies = [
        {
            "name": _clean_name(c.get("name", "")),
            "entity_type_name": c.get("entity_type_name", ""),
            "catno": c.get("catno", ""),
        }
        for c in (release.get("companies") or [])
    ]

    # Series
    series = [
        {"name": s.get("name", ""), "catno": s.get("catno", "")}
        for s in (release.get("series") or [])
    ]

    return {
        "tracklist": tracklist,
        "formats": formats,
        "extraartists": extraartists,
        "notes": release.get("notes", ""),
        "identifiers": identifiers,
        "companies": companies,
        "series": series,
    }


def discogs_validate_token(token: str) -> dict:
    """Validate a Discogs token by calling /oauth/identity with it.

    Returns {"valid": True, "username": "..."} or {"valid": False, "error": "..."}.
    """
    url = _config.DISCOGS_API + "/oauth/identity"
    req = urllib.request.Request(
        url,
        method="GET",
        headers={
            "Authorization": f"Discogs token={token}",
            "User-Agent": "More'Wax/1.0",
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:  # nosec B310
            data = json.loads(resp.read())
            return {"valid": True, "username": data.get("username", "")}
    except urllib.error.HTTPError as e:
        return {"valid": False, "error": f"Discogs returned {e.code}"}
    except Exception as e:
        return {"valid": False, "error": str(e)}


def discogs_fetch_identity():
    """Fetch and cache the authenticated Discogs username."""
    global _discogs_username
    try:
        data = _discogs_request("GET", "/oauth/identity")
        _discogs_username = data.get("username")
        print(f"  👤 [discogs] Authenticated as: {_discogs_username}")
    except Exception as e:
        print(f"  ⚠️ [discogs] Could not fetch identity: {e}")


def discogs_fetch_collection() -> list:
    """Fetch all releases from the user's Discogs collection.

    Paginates through folder 0 (All) at 100 per page with 1s sleep
    between pages. Returns lightweight dicts with basic metadata.
    """
    import time

    if not _discogs_username:
        raise RuntimeError("Discogs username not available — check token")

    results = []
    page = 1

    while True:
        data = _discogs_request(
            "GET",
            f"/users/{_discogs_username}/collection/folders/0/releases",
            {"page": page, "per_page": 100},
        )

        for item in data.get("releases", []):
            info = item.get("basic_information", {})
            release_id = str(info.get("id", ""))
            if not release_id:
                continue

            artist_str = _format_artists(info.get("artists") or [])

            labels = info.get("labels") or []
            formats = info.get("formats") or []

            results.append(
                {
                    "discogs_id": release_id,
                    "master_id": str(info.get("master_id", "") or ""),
                    "title": info.get("title", ""),
                    "artist": artist_str,
                    "year": str(info.get("year", "")),
                    "label": ", ".join(lbl.get("name", "") for lbl in labels),
                    "catalog_number": ", ".join(
                        lbl.get("catno", "") for lbl in labels if lbl.get("catno")
                    ),
                    "format": ", ".join(f.get("name", "") for f in formats),
                    "genres": json.dumps(info.get("genres") or []),
                    "styles": json.dumps(info.get("styles") or []),
                    "cover_image_url": info.get("cover_image", ""),
                    "thumb": info.get("thumb", ""),
                }
            )

        pagination = data.get("pagination", {})
        total_pages = pagination.get("pages", 1)
        print(
            f"  📦 [discogs] Collection page {page}/{total_pages}"
            f" ({len(results)} records so far)"
        )

        if page >= total_pages:
            break
        page += 1
        time.sleep(1)

    return results
