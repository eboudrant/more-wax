#!/usr/bin/env bash
set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

ok()   { echo -e "  ${GREEN}✔${NC} $1"; }
fail() { echo -e "  ${RED}✘${NC} $1"; }
warn() { echo -e "  ${YELLOW}!${NC} $1"; }
info() { echo -e "  ${BLUE}→${NC} $1"; }

echo ""
echo -e "${BOLD}More'Wax Setup${NC}"
echo ""

# ── 1. Python 3.10+ ─────────────────────────────────────────────────

if ! command -v python3 &>/dev/null; then
  fail "Python 3 not found. Please install Python 3.10 or later."
  exit 1
fi

PY_VERSION=$(python3 -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')
PY_MAJOR=$(echo "$PY_VERSION" | cut -d. -f1)
PY_MINOR=$(echo "$PY_VERSION" | cut -d. -f2)

if [ "$PY_MAJOR" -lt 3 ] || { [ "$PY_MAJOR" -eq 3 ] && [ "$PY_MINOR" -lt 10 ]; }; then
  fail "Python $PY_VERSION found — 3.10+ is required."
  exit 1
fi

ok "Python $PY_VERSION"

# ── 2. .env file ────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/.env"
ENV_EXAMPLE="$SCRIPT_DIR/.env.example"

if [ -f "$ENV_FILE" ]; then
  ok ".env already exists"
else
  if [ ! -f "$ENV_EXAMPLE" ]; then
    fail ".env.example not found — cannot create .env"
    exit 1
  fi
  cp "$ENV_EXAMPLE" "$ENV_FILE"
  ok "Created .env from .env.example"
fi

# shellcheck disable=SC1090
source "$ENV_FILE"

# ── 3. Discogs token ───────────────────────────────────────────────

if [ -z "${DISCOGS_TOKEN:-}" ] || [ "$DISCOGS_TOKEN" = "your_discogs_token_here" ]; then
  echo ""
  info "A Discogs personal access token is required."
  info "Create one at: ${BOLD}https://www.discogs.com/settings/developers${NC}"
  echo ""
  read -rp "  Discogs token: " DISCOGS_TOKEN

  if [ -z "$DISCOGS_TOKEN" ]; then
    fail "No token provided."
    exit 1
  fi

  if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' "s|^DISCOGS_TOKEN=.*|DISCOGS_TOKEN=$DISCOGS_TOKEN|" "$ENV_FILE"
  else
    sed -i "s|^DISCOGS_TOKEN=.*|DISCOGS_TOKEN=$DISCOGS_TOKEN|" "$ENV_FILE"
  fi
  ok "Saved Discogs token to .env"
else
  ok "Discogs token is set"
fi

# ── 4. Anthropic API key (optional) ────────────────────────────────

if [ -z "${ANTHROPIC_API_KEY:-}" ] || [ "$ANTHROPIC_API_KEY" = "your_anthropic_api_key_here" ]; then
  echo ""
  info "An Anthropic API key enables AI-powered cover identification."
  info "Get one at: ${BOLD}https://console.anthropic.com/${NC}"
  echo ""
  read -rp "  Anthropic API key (Enter to skip): " ANTHROPIC_API_KEY

  if [ -n "$ANTHROPIC_API_KEY" ]; then
    if [[ "$OSTYPE" == "darwin"* ]]; then
      sed -i '' "s|^ANTHROPIC_API_KEY=.*|ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY|" "$ENV_FILE"
    else
      sed -i "s|^ANTHROPIC_API_KEY=.*|ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY|" "$ENV_FILE"
    fi
    ok "Saved Anthropic API key to .env"
  else
    warn "Skipped — cover identification will be disabled"
  fi
else
  ok "Anthropic API key is set"
fi

# ── 5. Validate Discogs token ──────────────────────────────────────

echo ""
info "Validating Discogs token..."

HTTP_CODE=$(curl -s -o /tmp/discogs_identity.json -w "%{http_code}" \
  -H "Authorization: Discogs token=$DISCOGS_TOKEN" \
  https://api.discogs.com/oauth/identity)

if [ "$HTTP_CODE" = "200" ]; then
  USERNAME=$(python3 -c "import json; print(json.load(open('/tmp/discogs_identity.json'))['username'])" 2>/dev/null || echo "unknown")
  ok "Authenticated as ${BOLD}$USERNAME${NC}"
  rm -f /tmp/discogs_identity.json
else
  rm -f /tmp/discogs_identity.json
  fail "Discogs token is invalid (HTTP $HTTP_CODE)."
  info "Check your token at: https://www.discogs.com/settings/developers"
  exit 1
fi

# ── 6. Data directory ──────────────────────────────────────────────

DATA_DIR="$SCRIPT_DIR/data"
if [ -d "$DATA_DIR" ]; then
  ok "data/ directory exists"
else
  mkdir -p "$DATA_DIR"
  ok "Created data/ directory"
fi

# ── 7. Done ────────────────────────────────────────────────────────

echo ""
echo -e "${GREEN}${BOLD}Setup complete!${NC}"
echo ""
echo "  Start the server:"
echo -e "    ${BOLD}python3 server.py${NC}"
echo ""
echo "  Or use Docker:"
echo -e "    ${BOLD}docker compose up${NC}"
echo ""
