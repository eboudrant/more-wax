"""
More'Wax — Discogs Collection Sync
One-way import: fetch user's Discogs collection, diff against local DB,
import selected records with basic metadata. Prices/ratings backfill
via the existing background refresh job.

Fuzzy duplicate detection: records with matching master_id or artist+title
(different pressing) are flagged as "possible duplicates" so the user can
decide whether to skip, import alongside, or replace the existing version.
"""

import copy
import threading
import time

from server.database import (
    _db_add_unlocked,
    _lock as _db_lock,
    db_delete,
    db_find_duplicate,
    db_list,
    db_update,
)
from server.discogs import _discogs_request, discogs_fetch_collection

_sync_lock = threading.Lock()
_master_ids_backfilled = False

_sync_state = {
    "status": "idle",  # idle | fetching | importing | done | error
    "phase": "",
    "total": 0,
    "progress": 0,
    "diff": [],
    "imported": 0,
    "skipped": 0,
    "replaced": 0,
    "error": None,
}


def backfill_master_ids():
    """Background job: backfill master_id on local records.

    1. Fetch Discogs collection (bulk, ~5 requests for 500 records)
    2. Match local records by discogs_id to get master_id
    3. For records not in the Discogs collection, fetch /releases/{id} individually

    Safe to call multiple times — skips if already done or not needed.
    """
    global _master_ids_backfilled
    with _sync_lock:
        if _master_ids_backfilled:
            return

    local = db_list()
    needs_backfill = [
        r for r in local if r.get("discogs_id") and not r.get("master_id")
    ]
    if not needs_backfill:
        with _sync_lock:
            _master_ids_backfilled = True
        return

    print(f"  📦 [sync] {len(needs_backfill)} records missing master_id")

    # Phase 1: bulk resolve via collection API
    try:
        discogs_records = discogs_fetch_collection()
        discogs_master_map = {
            r["discogs_id"]: r.get("master_id", "")
            for r in discogs_records
            if r.get("master_id")
        }
    except Exception as e:
        print(f"  ⚠️ [sync] Collection fetch failed: {e}")
        discogs_master_map = {}

    backfilled = 0
    still_missing = []
    for r in needs_backfill:
        did = str(r.get("discogs_id", "")).strip()
        mid = discogs_master_map.get(did, "")
        if mid:
            try:
                db_update(r["id"], {"master_id": mid})
                backfilled += 1
            except Exception as e:
                print(f"  ⚠️ [sync] Failed to update master_id for {did}: {e}")
        else:
            still_missing.append(r)

    # Phase 2: individual release lookups for records not in Discogs collection
    if still_missing:
        print(
            f"  📦 [sync] Fetching master_id for {len(still_missing)}"
            " records via release API..."
        )
        for r in still_missing:
            did = str(r["discogs_id"]).strip()
            try:
                release = _discogs_request("GET", f"/releases/{did}")
                mid = str(release.get("master_id", "") or "")
                if mid:
                    db_update(r["id"], {"master_id": mid})
                    backfilled += 1
                else:
                    # No master release — mark so we don't retry
                    db_update(r["id"], {"master_id": "0"})
                time.sleep(1)
            except Exception as e:
                print(f"  ⚠️ [sync] Failed for {did}: {e}")

    with _sync_lock:
        _master_ids_backfilled = True
    print(f"  📦 [sync] Backfilled master_id for {backfilled} records")


def _normalize(s: str) -> str:
    """Normalize a string for fuzzy comparison."""
    return " ".join(s.lower().split())


def sync_get_state() -> dict:
    """Return current sync state for polling (excludes diff to keep it small)."""
    with _sync_lock:
        s = dict(_sync_state)
        s.pop("diff", None)
        return s


def sync_start_fetch() -> dict:
    """Fetch Discogs collection and compute diff against local DB.

    Runs synchronously (fast: ~1 req per 100 records).
    Returns the diff list with fuzzy duplicate annotations.
    """
    with _sync_lock:
        if _sync_state["status"] in ("fetching", "importing"):
            return {
                "error": "A sync is already in progress",
                "status": _sync_state["status"],
            }
        _sync_state.update(
            status="fetching",
            phase="Fetching your Discogs collection...",
            total=0,
            progress=0,
            diff=[],
            imported=0,
            skipped=0,
            replaced=0,
            error=None,
        )

    try:
        # Fetch full Discogs collection (paginated)
        discogs_records = discogs_fetch_collection()

        # Build lookup structures from local collection
        local = db_list()
        local_ids = {str(r.get("discogs_id", "")).strip() for r in local}
        local_ids.discard("")

        # Ensure master_ids are backfilled (no-op if already done at startup)
        with _sync_lock:
            needs_backfill = not _master_ids_backfilled
        if needs_backfill:
            discogs_master_map = {
                r["discogs_id"]: r.get("master_id", "")
                for r in discogs_records
                if r.get("master_id")
            }
            backfilled = 0
            for r in local:
                if not r.get("master_id"):
                    did = str(r.get("discogs_id", "")).strip()
                    mid = discogs_master_map.get(did, "")
                    if mid:
                        db_update(r["id"], {"master_id": mid})
                        r["master_id"] = mid
                        backfilled += 1
            if backfilled:
                print(f"  📦 [sync] Backfilled master_id for {backfilled} records")

            # Fallback: individual lookups for records not in Discogs collection
            still_missing = [
                r for r in local if r.get("discogs_id") and not r.get("master_id")
            ]
            if still_missing:
                print(
                    f"  📦 [sync] Fetching master_id for {len(still_missing)}"
                    " records not in Discogs collection..."
                )
                for r in still_missing:
                    did = str(r["discogs_id"]).strip()
                    try:
                        release = _discogs_request("GET", f"/releases/{did}")
                        mid = str(release.get("master_id", "") or "")
                        if mid:
                            db_update(r["id"], {"master_id": mid})
                            r["master_id"] = mid
                        time.sleep(1)
                    except Exception as e:
                        print(f"  ⚠️ [sync] Failed to fetch master_id for {did}: {e}")

        # Build master_id index: master_id → local record
        local_by_master = {}
        for r in local:
            mid = str(r.get("master_id", "")).strip()
            if mid and mid != "0":
                local_by_master[mid] = r

        # Build fuzzy index: normalized "artist|title" → local record
        # (fallback for records without master_id)
        local_by_name = {}
        for r in local:
            key = _normalize(r.get("artist", "")) + "|" + _normalize(r.get("title", ""))
            local_by_name[key] = r

        # Diff: records in Discogs but not in More'Wax
        diff = []
        for r in discogs_records:
            if r["discogs_id"] in local_ids:
                continue  # exact discogs_id match — already imported

            # Check for duplicate pressing: master_id match first, then fuzzy
            local_match = None
            master_id = str(r.get("master_id", "")).strip()
            if master_id and master_id != "0":
                local_match = local_by_master.get(master_id)

            if not local_match:
                key = (
                    _normalize(r.get("artist", ""))
                    + "|"
                    + _normalize(r.get("title", ""))
                )
                local_match = local_by_name.get(key)

            if local_match:
                r["_duplicate"] = True
                r["_local_match"] = {
                    "id": local_match.get("id"),
                    "discogs_id": str(local_match.get("discogs_id", "")),
                    "master_id": str(local_match.get("master_id", "")),
                    "title": local_match.get("title", ""),
                    "artist": local_match.get("artist", ""),
                    "year": local_match.get("year", ""),
                    "label": local_match.get("label", ""),
                    "format": local_match.get("format", ""),
                    "catalog_number": local_match.get("catalog_number", ""),
                    "cover_image_url": local_match.get("cover_image_url", ""),
                }
            else:
                r["_duplicate"] = False

            diff.append(r)

        with _sync_lock:
            _sync_state.update(
                status="done" if not diff else "idle",
                phase="",
                diff=diff,
                total=len(discogs_records),
            )

        return {
            "status": "ok",
            "diff": diff,
            "total_in_discogs": len(discogs_records),
            "already_in_morewax": len(discogs_records) - len(diff),
        }

    except Exception as e:
        with _sync_lock:
            _sync_state.update(status="error", error=str(e), phase="")
        return {"error": str(e), "status": "error"}


def sync_start_import(selected_ids: list, replace_ids: list = None) -> dict:
    """Import selected records using basic data from the fetch phase.

    selected_ids: discogs_ids to import (new or import alongside existing)
    replace_ids: discogs_ids where the user chose to replace the local version

    No per-record API calls — uses data already fetched.
    Prices/ratings will backfill via background refresh.
    """
    # Normalize inputs to strings
    selected_ids = [str(x) for x in (selected_ids or [])]
    replace_ids = [str(x) for x in (replace_ids or [])]
    replace_set = set(replace_ids)

    with _sync_lock:
        if _sync_state["status"] == "importing":
            return {"error": "Import already in progress"}

        # Deep copy selected records from diff so we're safe outside the lock
        diff_by_id = {r["discogs_id"]: r for r in _sync_state["diff"]}
        to_import = [
            copy.deepcopy(diff_by_id[did]) for did in selected_ids if did in diff_by_id
        ]

        if not to_import:
            return {"error": "No valid records selected", "imported": 0}

        _sync_state.update(
            status="importing",
            phase="Importing records...",
            total=len(to_import),
            progress=0,
            imported=0,
            skipped=0,
            replaced=0,
        )

    imported = 0
    skipped = 0
    replaced = 0

    for i, rec in enumerate(to_import):
        record = {
            "discogs_id": rec["discogs_id"],
            "master_id": rec.get("master_id", ""),
            "title": rec.get("title", ""),
            "artist": rec.get("artist", ""),
            "year": rec.get("year", ""),
            "label": rec.get("label", ""),
            "catalog_number": rec.get("catalog_number", ""),
            "format": rec.get("format", ""),
            "genres": rec.get("genres", "[]"),
            "styles": rec.get("styles", "[]"),
            "cover_image_url": rec.get("cover_image_url", ""),
            "add_source": "discogs_sync",
        }

        # Handle replace: delete old record first
        if rec["discogs_id"] in replace_set and rec.get("_local_match"):
            old_id = rec["_local_match"].get("id")
            if old_id:
                db_delete(old_id)
                replaced += 1

        # Atomic duplicate check + add under the DB lock
        with _db_lock:
            dup = db_find_duplicate(record)
            if dup:
                skipped += 1
            else:
                _db_add_unlocked(record)
                imported += 1

        with _sync_lock:
            _sync_state["progress"] = i + 1
            _sync_state["imported"] = imported
            _sync_state["skipped"] = skipped
            _sync_state["replaced"] = replaced

    with _sync_lock:
        _sync_state.update(
            status="done",
            phase="",
            diff=[],  # Clear diff to free memory
        )

    print(
        f"  📦 [sync] Import complete: {imported} imported,"
        f" {replaced} replaced, {skipped} skipped (duplicates)"
    )
    return {"imported": imported, "replaced": replaced, "skipped": skipped}
