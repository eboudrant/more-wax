"""
More'Wax — JSON File Database
Thread-safe CRUD operations with atomic writes.
"""

import json
import os
import threading
from datetime import datetime, timezone

from server.config import DB_FILE

_lock = threading.Lock()


def _load() -> dict:
    if DB_FILE.exists():
        try:
            with open(DB_FILE) as f:
                data = json.load(f)
            if isinstance(data, dict) and "records" in data:
                # Migration: add schema_version if missing
                if "schema_version" not in data:
                    data["schema_version"] = "1.0"
                    _save(data)
                return data
            print(f"  ⚠️ [db] Invalid structure in {DB_FILE}, resetting")
        except (json.JSONDecodeError, OSError) as e:
            print(f"  ⚠️ [db] Failed to load {DB_FILE}: {e}")
            # Back up corrupted file before resetting
            backup = DB_FILE.with_suffix(".json.bak")
            try:
                DB_FILE.rename(backup)
                print(f"  ⚠️ [db] Corrupted file backed up to {backup}")
            except OSError:
                pass
    return {"schema_version": "1.0", "records": [], "next_id": 1}


def _save(data: dict) -> None:
    tmp = DB_FILE.with_suffix(".tmp")
    with open(tmp, "w") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    os.replace(tmp, DB_FILE)


def db_list() -> list:
    with _lock:
        records = sorted(
            _load()["records"],
            key=lambda r: (r.get("artist", "").lower(), r.get("title", "").lower()),
        )
        # Strip heavy cached data from list responses
        for r in records:
            r.pop("discogs_extra", None)
        return records


def db_get(rid: int):
    with _lock:
        data = _load()
        return next((r for r in data["records"] if r["id"] == rid), None)


def db_find_duplicate(record: dict):
    """Return an existing record that looks like a duplicate, or None."""
    discogs_id = str(record.get("discogs_id", "")).strip()
    barcode = str(record.get("barcode", "")).strip()
    data = _load()
    for r in data["records"]:
        if discogs_id and str(r.get("discogs_id", "")).strip() == discogs_id:
            return r
        if barcode and str(r.get("barcode", "")).strip() == barcode:
            return r
    return None


def db_add(record: dict) -> int:
    with _lock:
        return _db_add_unlocked(record)


def _db_add_unlocked(record: dict) -> int:
    """Add a record — caller MUST already hold _lock."""
    data = _load()
    record["id"] = data["next_id"]
    record["added_at"] = datetime.now(timezone.utc).isoformat()
    data["next_id"] += 1
    data["records"].append(record)
    _save(data)
    return record["id"]


def db_update(rid: int, fields: dict) -> bool:
    with _lock:
        data = _load()
        for rec in data["records"]:
            if rec["id"] == rid:
                rec.update(fields)
                _save(data)
                return True
        return False


def db_export() -> dict:
    """Return the full database for export, including schema version."""
    with _lock:
        return _load()


def db_delete(rid: int) -> bool:
    with _lock:
        data = _load()
        before = len(data["records"])
        data["records"] = [r for r in data["records"] if r["id"] != rid]
        if len(data["records"]) < before:
            _save(data)
            return True
        return False
