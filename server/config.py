"""
More'Wax — Configuration
Loads environment variables from .env and defines all paths/constants.
"""

import os
from pathlib import Path

BASE_DIR   = Path(__file__).parent.parent
STATIC_DIR = BASE_DIR / "static"
DATA_DIR   = BASE_DIR / "data"
COVERS_DIR = DATA_DIR / "covers"
DB_FILE    = DATA_DIR / "collection.json"

# Load .env file if present (no third-party dependency needed)
_env_file = BASE_DIR / ".env"
if _env_file.exists():
    for _line in _env_file.read_text().splitlines():
        _line = _line.strip()
        if not _line or _line.startswith("#"):
            continue
        if "=" in _line:
            _key, _, _value = _line.partition("=")
            _key = _key.strip()
            _value = _value.strip().strip('"').strip("'")
            os.environ.setdefault(_key, _value)

ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
VISION_MODEL      = os.environ.get("VISION_MODEL", "claude-sonnet-4-6")
DISCOGS_TOKEN     = os.environ.get("DISCOGS_TOKEN", "")
DISCOGS_API       = "https://api.discogs.com"

# Ensure data directories exist
DATA_DIR.mkdir(exist_ok=True)
COVERS_DIR.mkdir(exist_ok=True)
