#!/usr/bin/env bash
set -euo pipefail

# Install the forellm-advisor skill for OpenClaw
# Usage: ./scripts/install-openclaw-skill.sh

SKILL_NAME="forellm-advisor"
SKILL_SRC="$(cd "$(dirname "$0")/.." && pwd)/skills/$SKILL_NAME"
SKILL_DST="$HOME/.openclaw/skills/$SKILL_NAME"

# Verify source exists
if [ ! -f "$SKILL_SRC/SKILL.md" ]; then
    echo "Error: SKILL.md not found at $SKILL_SRC"
    exit 1
fi

# Check forellm is installed
if ! command -v forellm &>/dev/null; then
    echo "Warning: forellm is not on PATH."
    echo "Install it first:"
    echo "  cargo install forellm"
    echo "  # or: brew install forellm"
    echo ""
    echo "Continuing with skill install anyway..."
fi

# Create destination and copy
mkdir -p "$SKILL_DST"
cp "$SKILL_SRC/SKILL.md" "$SKILL_DST/SKILL.md"

echo "Installed $SKILL_NAME skill to $SKILL_DST"
echo ""
echo "The skill will be available on your next OpenClaw session."
echo "Verify with: openclaw skills list | grep $SKILL_NAME"
