"""
More'Wax — Listens store
Thread-safe JSON file storage for listen events.
Schema: {"schema_version": "1.0", "listens": [...], "next_id": 1}
Each listen: {"id": int, "record_id": int, "listened_at": ISO8601 str}
"""

from __future__ import annotations

import json
import os
import threading
from datetime import datetime, timezone

from server.config import LISTENS_FILE

_lock = threading.Lock()

CURRENT_SCHEMA = "1.0"


def _load() -> dict:
    if LISTENS_FILE.exists():
        try:
            with open(LISTENS_FILE) as f:
                data = json.load(f)
            if isinstance(data, dict) and "listens" in data:
                if "schema_version" not in data:
                    data["schema_version"] = CURRENT_SCHEMA
                if "next_id" not in data:
                    existing_ids = [r.get("id", 0) for r in data["listens"]]
                    data["next_id"] = max(existing_ids, default=0) + 1
                    _save(data)
                return data
            print(f"  ⚠️ [listens] Invalid structure in {LISTENS_FILE}, resetting")
        except (json.JSONDecodeError, OSError) as e:
            print(f"  ⚠️ [listens] Failed to load {LISTENS_FILE}: {e}")
            backup = LISTENS_FILE.with_suffix(".json.bak")
            try:
                LISTENS_FILE.rename(backup)
                print(f"  ⚠️ [listens] Corrupted file backed up to {backup}")
            except OSError:
                pass
    return {"schema_version": CURRENT_SCHEMA, "listens": [], "next_id": 1}


def _save(data: dict) -> None:
    tmp = LISTENS_FILE.with_suffix(".tmp")
    with open(tmp, "w") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    os.replace(tmp, LISTENS_FILE)


def listens_list(record_id: int | None = None) -> list:
    """Return listens, newest first. Filter by record_id when given."""
    with _lock:
        items = _load()["listens"]
        if record_id is not None:
            items = [r for r in items if r.get("record_id") == record_id]
        else:
            items = list(items)
    items.sort(key=lambda r: r.get("listened_at", ""), reverse=True)
    return items


def listens_add(record_id: int) -> dict:
    """Append a listen with server-side UTC timestamp. Returns the new row."""
    with _lock:
        data = _load()
        row = {
            "id": data["next_id"],
            "record_id": record_id,
            "listened_at": datetime.now(timezone.utc).isoformat(),
        }
        data["next_id"] += 1
        data["listens"].append(row)
        _save(data)
        return row


def _delete_where(predicate) -> int:
    """Drop every listen where predicate(row) is true. Returns count removed."""
    with _lock:
        data = _load()
        before = len(data["listens"])
        data["listens"] = [r for r in data["listens"] if not predicate(r)]
        removed = before - len(data["listens"])
        if removed:
            _save(data)
        return removed


def listens_delete(listen_id: int) -> bool:
    return _delete_where(lambda r: r.get("id") == listen_id) > 0


def listens_delete_for_record(record_id: int) -> int:
    """Cascade delete when a record is removed. Returns how many were dropped."""
    return _delete_where(lambda r: r.get("record_id") == record_id)
