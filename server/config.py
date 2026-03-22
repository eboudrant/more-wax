"""
More'Wax — Configuration
Loads environment variables from data/.env and defines all paths/constants.
"""

import os
from pathlib import Path

BASE_DIR = Path(__file__).parent.parent
STATIC_DIR = BASE_DIR / "static"
DATA_DIR = BASE_DIR / "data"
COVERS_DIR = DATA_DIR / "covers"
DB_FILE = DATA_DIR / "collection.json"

# Ensure data directories exist
DATA_DIR.mkdir(exist_ok=True)
COVERS_DIR.mkdir(exist_ok=True)


def _load_env_file(path: Path):
    """Load a .env file into os.environ (setdefault — won't override existing)."""
    if not path.exists():
        return
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" in line:
            key, _, value = line.partition("=")
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            os.environ.setdefault(key, value)


def _migrate_env():
    """One-time migration: copy ./.env to data/.env if data/.env doesn't exist."""
    root_env = BASE_DIR / ".env"
    data_env = DATA_DIR / ".env"
    if root_env.exists() and not data_env.exists():
        import shutil

        shutil.copy2(root_env, data_env)
        print("  📦 Migrated .env → data/.env")


def _load_config():
    """(Re)load configuration from data/.env into module-level variables."""
    global ANTHROPIC_API_KEY, VISION_MODEL, DISCOGS_TOKEN
    _load_env_file(DATA_DIR / ".env")
    ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
    VISION_MODEL = os.environ.get("VISION_MODEL", "claude-sonnet-4-6")
    DISCOGS_TOKEN = os.environ.get("DISCOGS_TOKEN", "")


def save_token(key: str, value: str):
    """Save or update a key=value pair in data/.env and reload config."""
    env_path = DATA_DIR / ".env"
    lines = []
    found = False
    if env_path.exists():
        for line in env_path.read_text().splitlines():
            stripped = line.strip()
            if stripped and not stripped.startswith("#") and "=" in stripped:
                k, _, _ = stripped.partition("=")
                if k.strip() == key:
                    lines.append(f"{key}={value}")
                    found = True
                    continue
            lines.append(line)
    if not found:
        lines.append(f"{key}={value}")
    env_path.write_text("\n".join(lines) + "\n")
    # Update os.environ so reload picks it up
    os.environ[key] = value
    _load_config()


DISCOGS_API = "https://api.discogs.com"

# Initial load
_migrate_env()
_load_config()
