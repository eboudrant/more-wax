"""
More'Wax — Image Processing
Cover upload, HEIC conversion, and Claude Vision identification.
"""

import base64
import json
import os
import subprocess
import tempfile
import urllib.error
import urllib.request
import uuid
from pathlib import Path

from server.config import ANTHROPIC_API_KEY, COVERS_DIR
from server.database import db_update


def upload_cover(img_data: str, record_id: str) -> dict:
    """Save a base64-encoded cover image to disk. Returns {"path": ..., "success": True}."""
    # Strip data-URL prefix if present
    if "," in img_data:
        img_data = img_data.split(",", 1)[1]

    filename  = f"cover_{record_id}.jpg"
    dest_path = COVERS_DIR / filename
    dest_path.write_bytes(base64.b64decode(img_data))

    local_url = f"/covers/covers/{filename}"

    if str(record_id) != "tmp":
        db_update(int(record_id), {"local_cover": local_url})

    return {"path": local_url, "success": True}


def convert_image(img_data: str) -> dict:
    """Convert any image (HEIC, AVIF, TIFF, …) to JPEG.

    Tries in order: sips (macOS) → ImageMagick → ffmpeg.
    Returns {"image": "data:image/jpeg;base64,…", "success": True} or error dict.
    """
    # Strip data-URL prefix
    if "," in img_data:
        img_data = img_data.split(",", 1)[1]

    raw_bytes = base64.b64decode(img_data)

    # Write source to a temp file (unique names to avoid race conditions)
    _uid = uuid.uuid4().hex[:8]
    src_path = os.path.join(tempfile.gettempdir(), f"morewax_src_{_uid}.heic")
    dst_path = os.path.join(tempfile.gettempdir(), f"morewax_dst_{_uid}.jpg")

    with open(src_path, "wb") as f:
        f.write(raw_bytes)

    converters = [
        ["sips", "-s", "format", "jpeg",
         "-s", "formatOptions", "88",
         src_path, "--out", dst_path],
        ["convert", src_path,
         "-auto-orient", "-quality", "88",
         "-resize", "1600x1600>", dst_path],
        ["ffmpeg", "-y", "-i", src_path,
         "-q:v", "4", dst_path],
    ]

    last_error = ""
    for cmd in converters:
        tool = cmd[0]
        try:
            subprocess.run(cmd, check=True, capture_output=True, timeout=20)
            if os.path.exists(dst_path) and os.path.getsize(dst_path) > 0:
                jpeg_bytes = Path(dst_path).read_bytes()
                _cleanup(src_path, dst_path)
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

    _cleanup(src_path, dst_path)
    return {
        "error": f"No converter could handle this file. Last: {last_error}",
        "success": False
    }


def identify_cover(img_data: str) -> dict:
    """Send a cover image to Claude Vision and return artist + title."""
    if not ANTHROPIC_API_KEY:
        return {"success": False, "error": "ANTHROPIC_API_KEY not configured"}

    # Strip data-URL prefix, keep raw base64
    if "," in img_data:
        media_type_part, img_data = img_data.split(",", 1)
        media_type = media_type_part.split(":")[1].split(";")[0] if ":" in media_type_part else "image/jpeg"
    else:
        media_type = "image/jpeg"

    MAX_B64_CHARS = 5_000_000
    if len(img_data) > MAX_B64_CHARS:
        print(f"  [identify] image too large ({len(img_data)} chars), rejecting")
        return {"success": False, "error": "Image too large — please use a smaller photo"}

    print(f"  [identify] calling Claude Vision ({len(img_data)} base64 chars, {media_type})")

    body = json.dumps({
        "model": "claude-sonnet-4-6",
        "max_tokens": 150,
        "messages": [{
            "role": "user",
            "content": [
                {
                    "type": "image",
                    "source": {
                        "type":       "base64",
                        "media_type": media_type,
                        "data":       img_data
                    }
                },
                {
                    "type": "text",
                    "text": (
                        "This is a vinyl record cover. Identify the artist and album title.\n"
                        "Return ONLY valid JSON, nothing else: "
                        "{\"artist\": \"...\", \"title\": \"...\"}\n"
                        "If you cannot identify the record, return: "
                        "{\"artist\": \"\", \"title\": \"\"}"
                    )
                }
            ]
        }]
    }).encode("utf-8")

    req = urllib.request.Request(
        "https://api.anthropic.com/v1/messages",
        data=body,
        headers={
            "x-api-key":         ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
            "content-type":      "application/json"
        },
        method="POST"
    )

    text = ""
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            result = json.loads(resp.read())

        text = result["content"][0]["text"].strip()
        print(f"  [identify] Claude replied: {text!r}")

        # Claude sometimes wraps JSON in ```json ... ``` — strip that
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
            text = text.strip()

        parsed = json.loads(text)
        artist = parsed.get("artist", "").strip()
        title  = parsed.get("title",  "").strip()
        print(f"  [identify] → artist={artist!r} title={title!r}")

        if artist or title:
            return {"success": True, "artist": artist, "title": title}
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
