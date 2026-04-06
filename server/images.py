"""
More'Wax — Image Processing
Cover upload, HEIC conversion, and Claude Vision identification.
"""

from __future__ import annotations

import base64
import json
import os
import subprocess
import tempfile
import urllib.error
import urllib.request
import uuid
from pathlib import Path

import server.config as _config
from server.config import COVERS_DIR
from server.database import db_update


MAX_UPLOAD_BYTES = 15 * 1024 * 1024  # 15 MB decoded limit


def _strip_data_url(data: str) -> str:
    """Strip the ``data:…;base64,`` prefix from a data-URL string."""
    if "," in data:
        return data.split(",", 1)[1]
    return data


def _decode_base64(data: str) -> tuple[bytes | None, str | None]:
    """Decode a base64 string, returning (raw_bytes, None) or (None, error_msg)."""
    try:
        raw = base64.b64decode(data)
    except Exception:
        return None, "Invalid base64 image data"
    if len(raw) > MAX_UPLOAD_BYTES:
        return None, "Image too large (max 15 MB)"
    return raw, None


def upload_cover(img_data: str, record_id: str) -> dict:
    """Save a base64-encoded cover image to disk. Returns {"path": ..., "success": True}."""
    if not img_data:
        return {"success": False, "error": "No image data provided"}

    img_data = _strip_data_url(img_data)
    raw, err = _decode_base64(img_data)
    if err:
        return {"success": False, "error": err}

    # Convert record_id to int to break CodeQL taint chain — only digits survive.
    try:
        numeric_id = int(record_id)
    except (ValueError, TypeError):
        numeric_id = 0

    # Build path from the untainted integer — no user string touches Path.
    fname = f"cover_{numeric_id}.jpg"
    covers_root = COVERS_DIR.resolve()
    dest_path = covers_root / fname
    dest_path.write_bytes(raw)

    local_url = f"/covers/covers/{fname}"

    if numeric_id > 0:
        db_update(numeric_id, {"local_cover": local_url})

    return {"path": local_url, "success": True}


def convert_image(img_data: str) -> dict:
    """Convert any image (HEIC, AVIF, TIFF, …) to JPEG.

    Tries in order: sips (macOS) → ImageMagick → ffmpeg.
    Returns {"image": "data:image/jpeg;base64,…", "success": True} or error dict.
    """
    if not img_data:
        return {"success": False, "error": "No image data provided"}

    img_data = _strip_data_url(img_data)
    raw_bytes, err = _decode_base64(img_data)
    if err:
        return {"success": False, "error": err}

    # Write source to a temp file (unique names to avoid race conditions)
    _uid = uuid.uuid4().hex[:8]
    src_path = os.path.join(tempfile.gettempdir(), f"morewax_src_{_uid}.heic")
    dst_path = os.path.join(tempfile.gettempdir(), f"morewax_dst_{_uid}.jpg")

    try:
        with open(src_path, "wb") as f:
            f.write(raw_bytes)

        converters = [
            [
                "sips",
                "-s",
                "format",
                "jpeg",
                "-s",
                "formatOptions",
                "88",
                src_path,
                "--out",
                dst_path,
            ],
            [
                "convert",
                src_path,
                "-auto-orient",
                "-quality",
                "88",
                "-resize",
                "1600x1600>",
                dst_path,
            ],
            ["ffmpeg", "-y", "-i", src_path, "-q:v", "4", dst_path],
        ]

        last_error = ""
        for cmd in converters:
            tool = cmd[0]
            try:
                subprocess.run(cmd, check=True, capture_output=True, timeout=20)
                if os.path.exists(dst_path) and os.path.getsize(dst_path) > 0:
                    jpeg_bytes = Path(dst_path).read_bytes()
                    jpeg_b64 = base64.b64encode(jpeg_bytes).decode("ascii")
                    data_url = f"data:image/jpeg;base64,{jpeg_b64}"
                    print(f"    ✓ HEIC converted via {tool}")
                    return {"image": data_url, "success": True}
            except FileNotFoundError:
                last_error = f"{tool} not found"
            except subprocess.CalledProcessError as e:
                last_error = f"{tool}: {e.stderr.decode(errors='replace')[:120]}"
            except subprocess.TimeoutExpired:
                last_error = f"{tool} timed out"

        return {
            "error": f"No converter could handle this file. Last: {last_error}",
            "success": False,
        }
    finally:
        _cleanup(src_path, dst_path)


def identify_cover(img_data: str) -> dict:
    """Send a cover image to Claude Vision and return artist + title."""
    if not _config.ANTHROPIC_API_KEY:
        return {"success": False, "error": "_config.ANTHROPIC_API_KEY not configured"}

    # Strip data-URL prefix, keep raw base64
    media_type = "image/jpeg"
    if "," in img_data:
        media_type_part = img_data.split(",", 1)[0]
        if ":" in media_type_part:
            media_type = media_type_part.split(":")[1].split(";")[0]
        img_data = _strip_data_url(img_data)

    MAX_B64_CHARS = 5_000_000
    if len(img_data) > MAX_B64_CHARS:
        print(f"  [identify] image too large ({len(img_data)} chars), rejecting")
        return {
            "success": False,
            "error": "Image too large — please use a smaller photo",
        }

    print(
        f"  [identify] calling Claude Vision ({len(img_data)} base64 chars, {media_type})"
    )

    body = json.dumps(
        {
            "model": _config.VISION_MODEL,
            "max_tokens": 300,
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": media_type,
                                "data": img_data,
                            },
                        },
                        {
                            "type": "text",
                            "text": (
                                "This is a photo of a vinyl record. Examine the image carefully — look at "
                                "everything visible: cover art, spine, label, catalog number, barcode, "
                                "country of pressing, label logo, matrix/runout etchings, any stickers or "
                                "hype stickers, color of the vinyl, and any other visual details.\n\n"
                                "Your goal is to identify the EXACT pressing/release, not just the album. "
                                "Many albums have dozens of different releases on Discogs (different countries, "
                                "labels, years, reissues). Use every visual clue to narrow it down.\n\n"
                                "Return ONLY valid JSON:\n"
                                '{"artist": "...", "title": "...", "label": "...", '
                                '"catalog_number": "...", "country": "...", "year": "...", '
                                '"barcode": "...", "format_details": "..."}\n'
                                "Include only fields you can identify with confidence. "
                                "Leave others as empty strings.\n"
                                "If you cannot identify the record at all, return: "
                                '{"artist": "", "title": ""}'
                            ),
                        },
                    ],
                }
            ],
        }
    ).encode("utf-8")

    req = urllib.request.Request(
        "https://api.anthropic.com/v1/messages",
        data=body,
        headers={
            "x-api-key": _config.ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        },
        method="POST",
    )

    text = ""
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:  # nosec B310
            result = json.loads(resp.read())

        content = result.get("content") or []
        if not content or not content[0].get("text"):
            return {"success": False, "error": "Empty response from Claude"}
        text = content[0]["text"].strip()
        print(f"  [identify] Claude replied: {text!r}")

        # Claude sometimes wraps JSON in ```json ... ``` — strip that
        if text.startswith("```"):
            parts = text.split("```")
            if len(parts) >= 3:
                inner = parts[1]
                if inner.startswith("json"):
                    inner = inner[4:]
                text = inner.strip()

        parsed = json.loads(text)
        artist = parsed.get("artist", "").strip()
        title = parsed.get("title", "").strip()
        label = parsed.get("label", "").strip()
        catalog_number = parsed.get("catalog_number", "").strip()
        country = parsed.get("country", "").strip()
        year = parsed.get("year", "").strip()
        barcode = parsed.get("barcode", "").strip()
        format_details = parsed.get("format_details", "").strip()
        print(
            f"  [identify] → artist={artist!r} title={title!r} label={label!r} cat={catalog_number!r} country={country!r} barcode={barcode!r}"
        )

        if artist or title:
            return {
                "success": True,
                "artist": artist,
                "title": title,
                "label": label,
                "catalog_number": catalog_number,
                "country": country,
                "year": year,
                "barcode": barcode,
                "format_details": format_details,
            }
        else:
            return {"success": False, "error": "Could not identify record"}

    except urllib.error.HTTPError as e:
        err = e.read().decode("utf-8", errors="replace")
        print(f"  [identify] HTTP error {e.code}: {err}")
        return {"success": False, "error": f"Claude API error {e.code}: {err[:200]}"}
    except json.JSONDecodeError as e:
        print(f"  [identify] JSON parse error: {e} — raw text was: {text!r}")
        return {"success": False, "error": "Could not parse Claude response"}
    except Exception as e:
        print(f"  [identify] unexpected error: {e}")
        return {"success": False, "error": str(e)}


def _cleanup(*paths):
    """Remove temp files, ignoring errors."""
    for p in paths:
        try:
            os.remove(p)
        except OSError:
            pass
